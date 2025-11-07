import { withConnection } from "@/lib/db";
import { corsJson, corsEmpty } from "@/lib/cors";
import { recalcMovieAggregates } from "@/lib/reviews";

type ReviewBody = {
    userId?: number;
    movieId?: number;
    rating?: number;
    content?: string;
};

export async function POST(request: Request) {
    const body: ReviewBody = await request.json();
    const userId = body.userId;
    const movieId = body.movieId;
    const rating = body.rating;
    const content = body.content?.trim();

    if (
        !userId ||
        !movieId ||
        typeof rating !== "number" ||
        rating < 1 ||
        rating > 10 ||
        !content
    ) {
        return corsJson(
            { ok: false, message: "유효한 리뷰 정보를 입력해주세요." },
            { status: 400 }
        );
    }

    try {
        const result = await withConnection(async (conn) => {
            const [userRows] = await conn.query<{ id: number; name: string }[]>(
                "SELECT id, name FROM users WHERE id = ? LIMIT 1",
                [userId]
            );
            if (!userRows.length) {
                throw new Error("사용자를 찾을 수 없습니다.");
            }

            const [movieRows] = await conn.query<{ id: number }[]>(
                "SELECT id FROM movies WHERE id = ? LIMIT 1",
                [movieId]
            );
            if (!movieRows.length) {
                throw new Error("영화를 찾을 수 없습니다.");
            }

            const [existingReviews] = await conn.query<{ id: number }[]>(
                "SELECT id FROM reviews WHERE movie_id = ? AND user_id = ? LIMIT 1",
                [movieId, userId]
            );
            if (existingReviews.length) {
                return {
                    duplicate: true as const,
                    userName: userRows[0].name,
                };
            }

            const [insertResult] = await conn.query<{ insertId: number }>(
                `
                INSERT INTO reviews (movie_id, user_id, rating, content, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
            `,
                [movieId, userId, rating, content]
            );

            await recalcMovieAggregates(conn, movieId);

            return {
                duplicate: false as const,
                id: insertResult.insertId,
                userName: userRows[0].name,
            };
        });

        if (result?.duplicate) {
            return corsJson(
                { ok: false, message: "이미 이 영화에 작성한 리뷰가 있습니다." },
                { status: 409 }
            );
        }

        return corsJson({
            ok: true,
            review: {
                id: result.id,
                movieId,
                userName: result.userName,
                rating,
                content,
                createdAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error("[reviews] error", error);
        return corsJson(
            {
                ok: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "리뷰 등록에 실패했습니다.",
            },
            { status: 500 }
        );
    }
}

export function OPTIONS() {
    return corsEmpty();
}
