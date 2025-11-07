import { withConnection } from "@/lib/db";
import { corsJson, corsEmpty } from "@/lib/cors";

const ADMIN_TOKEN = process.env.ADMIN_IMPORT_TOKEN || "root-import";

function authorize(request: Request): boolean {
    const header = request.headers.get("x-admin-token");
    return header === ADMIN_TOKEN;
}

export async function POST(request: Request) {
    if (!authorize(request)) {
        return corsJson({ ok: false, message: "인증 실패" }, { status: 401 });
    }

    try {
        await withConnection(async (conn) => {
            await conn.beginTransaction();
            try {
                await conn.query("SET FOREIGN_KEY_CHECKS=0");
                const tablesToTruncate = [
                    "review_reports",
                    "reviews",
                    "likes",
                    "movie_streaming_platforms",
                    "movie_cast",
                    "movie_genres",
                    "movie_rating_hist",
                    "movie_rating_stats",
                    "movies",
                    "directors",
                ];
                for (const table of tablesToTruncate) {
                    await conn.query(`TRUNCATE TABLE ${table}`);
                }
                await conn.query("SET FOREIGN_KEY_CHECKS=1");
                await conn.commit();
            } catch (error) {
                await conn.query("SET FOREIGN_KEY_CHECKS=1");
                await conn.rollback();
                throw error;
            }
        });

        return corsJson({ ok: true });
    } catch (error) {
        console.error("[admin/clear-data]", error);
        return corsJson(
            {
                ok: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "데이터 초기화에 실패했습니다.",
            },
            { status: 500 }
        );
    }
}

export function OPTIONS() {
    return corsEmpty();
}
