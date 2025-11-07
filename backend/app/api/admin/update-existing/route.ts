import { corsEmpty, corsJson } from "@/lib/cors";
import { getPool, withConnection } from "@/lib/db";
import { fetchTmdbMovieById } from "@/lib/tmdb";
import { updateExistingMovie } from "@/lib/importer";

const ADMIN_TOKEN = process.env.ADMIN_IMPORT_TOKEN || "root-import";

type UpdateRequestBody = {
    movieIds?: number[];
};

function authorize(request: Request): boolean {
    const header = request.headers.get("x-admin-token");
    return header === ADMIN_TOKEN;
}

function normalizeIds(ids?: number[]): number[] | undefined {
    if (!Array.isArray(ids)) return undefined;
    const normalized = Array.from(
        new Set(
            ids
                .map((id) => Number(id))
                .filter((value) => Number.isInteger(value) && value > 0)
        )
    );
    return normalized.length ? normalized : undefined;
}

export async function POST(request: Request) {
    if (!authorize(request)) {
        return corsJson({ ok: false, message: "인증 실패" }, { status: 401 });
    }

    let body: UpdateRequestBody = {};
    try {
        body = await request.json();
    } catch {
        // ignore
    }
    const requestedIds = normalizeIds(body.movieIds);

    const pool = getPool();
    const [movies] = await pool.query<{ id: number; tmdb_id: number | null }[]>(
        requestedIds
            ? "SELECT id, tmdb_id FROM movies WHERE tmdb_id IS NOT NULL AND id IN (?)"
            : "SELECT id, tmdb_id FROM movies WHERE tmdb_id IS NOT NULL ORDER BY id DESC",
        requestedIds ? [requestedIds] : undefined
    );

    if (!movies.length) {
        return corsJson({ ok: true, total: 0, updated: 0, skipped: 0, failed: 0 });
    }

    let updated = 0;
    let skipped = 0;
    let failed = 0;

    for (const movie of movies) {
        if (!movie.tmdb_id) {
            skipped += 1;
            continue;
        }
        const tmdbData = await fetchTmdbMovieById(movie.tmdb_id);
        if (!tmdbData) {
            failed += 1;
            continue;
        }

        try {
            await withConnection((conn) =>
                updateExistingMovie(conn, movie.id, tmdbData)
            );
            updated += 1;
        } catch (error) {
            console.error("[admin/update-existing] update failed", {
                movieId: movie.id,
                tmdbId: movie.tmdb_id,
                error,
            });
            failed += 1;
        }
    }

    return corsJson({
        ok: true,
        total: movies.length,
        updated,
        skipped,
        failed,
    });
}

export function OPTIONS() {
    return corsEmpty();
}
