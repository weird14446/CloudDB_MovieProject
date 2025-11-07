import { corsEmpty, corsJson } from "@/lib/cors";
import { withConnection } from "@/lib/db";

type SavePreferredGenresBody = {
    userId?: number;
    genres?: string[];
};

function normalizeGenres(genres?: string[]): string[] {
    if (!Array.isArray(genres)) return [];
    const set = new Set(
        genres
            .map((genre) => genre?.trim().toLowerCase())
            .filter((slug): slug is string => !!slug)
    );
    return Array.from(set);
}

const toSlug = (name: string) =>
    name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, "")
        .replace(/\s+/g, "-");

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
        const genres = await withConnection(async (conn) => {
            const [rows] = await conn.query<{ name: string }[]>(
                `
                SELECT g.name
                FROM user_preferred_genres upg
                JOIN genres g ON g.id = upg.genre_id
                WHERE upg.user_id = ?
                ORDER BY g.name ASC
            `,
                [userId]
            );
            return rows.map((row) => toSlug(row.name));
        });

        return corsJson({ ok: true, genres });
    } catch (error) {
        console.error("[users/preferred-genres] GET error", error);
        return corsJson(
            {
                ok: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "선호 장르를 불러오지 못했습니다.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const body: SavePreferredGenresBody = await request.json();
    const userId = body.userId;
    const genres = normalizeGenres(body.genres);

    if (!userId) {
        return corsJson(
            { ok: false, message: "userId가 필요합니다." },
            { status: 400 }
        );
    }

    try {
        const result = await withConnection(async (conn) => {
            await conn.beginTransaction();
            try {
                await conn.query("DELETE FROM user_preferred_genres WHERE user_id = ?", [
                    userId,
                ]);

                if (genres.length === 0) {
                    await conn.commit();
                    return { inserted: 0 };
                }

                const [genreRows] = await conn.query<{ id: number; name: string }[]>(
                    "SELECT id, name FROM genres"
                );
                const idBySlug = new Map(
                    genreRows.map((row) => [toSlug(row.name), row.id])
                );
                const values = genres
                    .map((slug) => idBySlug.get(slug))
                    .filter((id): id is number => typeof id === "number")
                    .map((genreId) => [userId, genreId]);

                if (values.length > 0) {
                    await conn.query(
                        "INSERT INTO user_preferred_genres (user_id, genre_id) VALUES ?",
                        [values]
                    );
                }

                await conn.commit();
                return { inserted: values.length };
            } catch (error) {
                await conn.rollback();
                throw error;
            }
        });

        return corsJson({ ok: true, ...result });
    } catch (error) {
        console.error("[users/preferred-genres] POST error", error);
        return corsJson(
            {
                ok: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "선호 장르를 저장하지 못했습니다.",
            },
            { status: 500 }
        );
    }
}

export function OPTIONS() {
    return corsEmpty();
}
