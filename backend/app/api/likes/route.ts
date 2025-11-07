import { getPool } from "@/lib/db";
import { corsJson, corsEmpty } from "@/lib/cors";

type ToggleBody = {
    userId?: number;
    movieId?: number;
    like?: boolean;
};

export async function GET(request: Request) {
    const url = new URL(request.url);
    const userId = Number(url.searchParams.get("userId"));
    if (!userId) {
        return corsJson(
            { ok: false, message: "userId가 필요합니다." },
            { status: 400 }
        );
    }

    try {
        const pool = getPool();
        const [rows] = await pool.query<{ movie_id: number }[]>(
            "SELECT movie_id FROM likes WHERE user_id = ?",
            [userId]
        );
        return corsJson({
            ok: true,
            likes: rows.map((row) => row.movie_id),
        });
    } catch (error) {
        console.error("[likes] GET error", error);
        return corsJson(
            { ok: false, message: "좋아요 정보를 불러오지 못했습니다." },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const body: ToggleBody = await request.json();
    const userId = body.userId;
    const movieId = body.movieId;
    const like = body.like ?? true;

    if (!userId || !movieId) {
        return corsJson(
            { ok: false, message: "userId와 movieId가 필요합니다." },
            { status: 400 }
        );
    }

    try {
        const pool = getPool();
        if (like) {
            await pool.query(
                "INSERT IGNORE INTO likes (user_id, movie_id, created_at) VALUES (?, ?, NOW())",
                [userId, movieId]
            );
        } else {
            await pool.query(
                "DELETE FROM likes WHERE user_id = ? AND movie_id = ?",
                [userId, movieId]
            );
        }

        return corsJson({ ok: true, liked: like });
    } catch (error) {
        console.error("[likes] POST error", error);
        return corsJson(
            { ok: false, message: "좋아요 상태를 변경하지 못했습니다." },
            { status: 500 }
        );
    }
}

export function OPTIONS() {
    return corsEmpty();
}
