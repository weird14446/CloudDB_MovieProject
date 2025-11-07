import { corsEmpty, corsJson } from "@/lib/cors";
import { withConnection } from "@/lib/db";
import { mapMovies } from "@/lib/formatters";
import type { Movie } from "@/lib/types";
import type { PoolConnection } from "mysql2/promise";

const ADMIN_TOKEN = process.env.ADMIN_IMPORT_TOKEN || "root-import";

type AdminMoviePayload = {
    tmdbId?: number | null;
    title?: string;
    year?: number;
    director?: string | null;
    overview?: string | null;
    posterUrl?: string | null;
    releaseDate?: string | null;
    status?: string | null;
    budget?: number | null;
    revenue?: number | null;
    runtimeMinutes?: number | null;
    trailerSite?: Movie["trailerSite"];
    trailerKey?: string | null;
    ageRating?: string | null;
    genres?: string[];
    streamingPlatforms?: string[];
};

type CreateMovieBody = {
    movie?: AdminMoviePayload;
};

type DeleteMovieBody = {
    movieId?: number;
};

type UpdateMovieBody = {
    movieId?: number;
    movie?: AdminMoviePayload;
};

function authorize(request: Request): boolean {
    return request.headers.get("x-admin-token") === ADMIN_TOKEN;
}

function normalizeString(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizeYear(value?: number): number | null {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return null;
    }
    const year = Math.round(value);
    if (year < 1888 || year > 2100) {
        return null;
    }
    return year;
}

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, "")
        .replace(/\s+/g, "-");
}

async function ensureDirectorId(
    conn: PoolConnection,
    name?: string | null
): Promise<number | null> {
    const directorName = normalizeString(name);
    if (!directorName) return null;
    const [rows] = await conn.query<{ id: number }[]>(
        "SELECT id FROM directors WHERE name = ? LIMIT 1",
        [directorName]
    );
    if (rows.length) {
        return rows[0].id;
    }
    const [insert] = await conn.query<{ insertId: number }>(
        "INSERT INTO directors (name) VALUES (?)",
        [directorName]
    );
    return insert.insertId;
}

async function attachGenres(
    conn: PoolConnection,
    movieId: number,
    genres: string[] = []
): Promise<void> {
    for (const entry of genres) {
        const displayName = normalizeString(entry);
        if (!displayName) continue;
        const [genreRows] = await conn.query<{ id: number }[]>(
            "SELECT id FROM genres WHERE name = ? LIMIT 1",
            [displayName]
        );
        let genreId = genreRows[0]?.id;
        if (!genreId) {
            const [res] = await conn.query<{ insertId: number }>(
                "INSERT INTO genres (name) VALUES (?)",
                [displayName]
            );
            genreId = res.insertId;
        }
        await conn.query(
            "INSERT IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)",
            [movieId, genreId]
        );
    }
}

async function attachPlatforms(
    conn: PoolConnection,
    movieId: number,
    platforms: string[] = []
): Promise<void> {
    for (const name of platforms) {
        const trimmed = normalizeString(name);
        if (!trimmed) continue;
        const [platformRows] = await conn.query<{ id: number }[]>(
            "SELECT id FROM streaming_platforms WHERE name = ? LIMIT 1",
            [trimmed]
        );
        let platformId = platformRows[0]?.id;
        if (!platformId) {
            const [res] = await conn.query<{ insertId: number }>(
                "INSERT INTO streaming_platforms (name) VALUES (?)",
                [trimmed]
            );
            platformId = res.insertId;
        }
        await conn.query(
            "INSERT IGNORE INTO movie_streaming_platforms (movie_id, platform_id) VALUES (?, ?)",
            [movieId, platformId]
        );
    }
}

async function fetchMovie(
    conn: PoolConnection,
    movieId: number
): Promise<Movie | null> {
    const [movieRows] = await conn.query<any[]>(
        `
        SELECT m.*,
               d.name AS director_name,
               s.avg_rating,
               s.vote_count,
               s.weighted_rating
        FROM movies m
        LEFT JOIN directors d ON d.id = m.director_id
        LEFT JOIN movie_rating_stats s ON s.movie_id = m.id
        WHERE m.id = ?
        LIMIT 1
    `,
        [movieId]
    );
    if (!movieRows.length) return null;

    const [genreRows] = await conn.query<{ movie_id: number; name: string }[]>(
        `
        SELECT mg.movie_id, g.name
        FROM movie_genres mg
        JOIN genres g ON g.id = mg.genre_id
        WHERE mg.movie_id = ?
    `,
        [movieId]
    );

    const [platformRows] = await conn.query<{ movie_id: number; name: string }[]>(
        `
        SELECT msp.movie_id, sp.name
        FROM movie_streaming_platforms msp
        JOIN streaming_platforms sp ON sp.id = msp.platform_id
        WHERE msp.movie_id = ?
    `,
        [movieId]
    );

    const genresByMovie = {
        [movieId]: genreRows.map((row) => slugify(row.name)),
    };
    const platformsByMovie = {
        [movieId]: platformRows.map((row) => row.name),
    };

    return mapMovies(movieRows, genresByMovie, platformsByMovie)[0] ?? null;
}

function buildMovieValues(
    movie: AdminMoviePayload | undefined,
    title: string,
    year: number,
    directorId: number | null
) {
    return [
        movie?.tmdbId ?? null,
        title,
        year,
        normalizeString(movie?.overview),
        normalizeString(movie?.posterUrl),
        normalizeString(movie?.releaseDate),
        normalizeString(movie?.status),
        movie?.budget ?? null,
        movie?.revenue ?? null,
        movie?.runtimeMinutes ?? null,
        movie?.trailerSite ?? null,
        normalizeString(movie?.trailerKey),
        normalizeString(movie?.ageRating),
        directorId,
    ];
}

async function runInTransaction<T>(
    conn: PoolConnection,
    fn: () => Promise<T>
): Promise<T> {
    await conn.beginTransaction();
    try {
        const result = await fn();
        await conn.commit();
        return result;
    } catch (error) {
        await conn.rollback();
        throw error;
    }
}

export async function POST(request: Request) {
    if (!authorize(request)) {
        return corsJson({ ok: false, message: "인증 실패" }, { status: 401 });
    }

    const { movie }: CreateMovieBody = await request.json();
    const title = normalizeString(movie?.title);
    const year = normalizeYear(movie?.year);

    if (!title || !year) {
        return corsJson(
            { ok: false, message: "제목과 연도는 필수입니다." },
            { status: 400 }
        );
    }

    try {
        const created = await withConnection((conn) =>
            runInTransaction(conn, async () => {
            const [duplicate] = await conn.query<{ id: number }[]>(
                "SELECT id FROM movies WHERE title = ? AND year = ? LIMIT 1",
                [title, year]
            );
            if (duplicate.length) {
                throw new Error("이미 동일한 제목과 연도의 영화가 존재합니다.");
            }

            const directorId = await ensureDirectorId(conn, movie?.director);
            const values = buildMovieValues(movie, title, year, directorId);

            const [insert] = await conn.query<{ insertId: number }>(
                `INSERT INTO movies
                (tmdb_id, title, year, overview, poster_url, release_date, status,
                 budget, revenue, runtime_minutes, trailer_site, trailer_key,
                 age_rating, director_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                values
            );

            const movieId = insert.insertId;
            await attachGenres(conn, movieId, movie?.genres ?? []);
            await attachPlatforms(conn, movieId, movie?.streamingPlatforms ?? []);

            return fetchMovie(conn, movieId);
            })
        );

        if (!created) {
            return corsJson(
                { ok: false, message: "생성된 영화를 불러오지 못했습니다." },
                { status: 500 }
            );
        }

        return corsJson({ ok: true, movie: created });
    } catch (error) {
        console.error("[admin/movies] POST error", error);
        const message =
            error instanceof Error ? error.message : "영화 생성에 실패했습니다.";
        const status = message.includes("동일한") ? 409 : 500;
        return corsJson({ ok: false, message }, { status });
    }
}

export async function PUT(request: Request) {
    if (!authorize(request)) {
        return corsJson({ ok: false, message: "인증 실패" }, { status: 401 });
    }

    const { movieId, movie }: UpdateMovieBody = await request.json();
    if (!movieId || movieId <= 0) {
        return corsJson(
            { ok: false, message: "movieId가 유효하지 않습니다." },
            { status: 400 }
        );
    }

    const title = normalizeString(movie?.title);
    const year = normalizeYear(movie?.year);

    if (!title || !year) {
        return corsJson(
            { ok: false, message: "제목과 연도는 필수입니다." },
            { status: 400 }
        );
    }

    try {
        const updated = await withConnection((conn) =>
            runInTransaction(conn, async () => {
                const [existing] = await conn.query<{ id: number }[]>(
                    "SELECT id FROM movies WHERE id = ? LIMIT 1",
                    [movieId]
                );
                if (!existing.length) {
                    throw new Error("영화를 찾을 수 없습니다.");
                }

                const [duplicate] = await conn.query<{ id: number }[]>(
                    "SELECT id FROM movies WHERE title = ? AND year = ? AND id <> ? LIMIT 1",
                    [title, year, movieId]
                );
                if (duplicate.length) {
                    throw new Error("동일한 제목과 연도의 다른 영화가 이미 존재합니다.");
                }

                const directorId = await ensureDirectorId(conn, movie?.director);
                const values = buildMovieValues(movie, title, year, directorId);

                await conn.query(
                    `UPDATE movies
                     SET tmdb_id = ?,
                         title = ?,
                         year = ?,
                         overview = ?,
                         poster_url = ?,
                         release_date = ?,
                         status = ?,
                         budget = ?,
                         revenue = ?,
                         runtime_minutes = ?,
                         trailer_site = ?,
                         trailer_key = ?,
                         age_rating = ?,
                         director_id = ?
                     WHERE id = ?`,
                    [...values, movieId]
                );

                await conn.query("DELETE FROM movie_genres WHERE movie_id = ?", [
                    movieId,
                ]);
                await conn.query("DELETE FROM movie_streaming_platforms WHERE movie_id = ?", [
                    movieId,
                ]);

                await attachGenres(conn, movieId, movie?.genres ?? []);
                await attachPlatforms(conn, movieId, movie?.streamingPlatforms ?? []);

                return fetchMovie(conn, movieId);
            })
        );

        if (!updated) {
            return corsJson(
                { ok: false, message: "영화 정보를 불러오지 못했습니다." },
                { status: 500 }
            );
        }

        return corsJson({ ok: true, movie: updated });
    } catch (error) {
        console.error("[admin/movies] PUT error", error);
        const message =
            error instanceof Error ? error.message : "영화 수정에 실패했습니다.";
        const status = message.includes("찾을 수 없습니다.")
            ? 404
            : message.includes("동일한")
                ? 409
                : 500;
        return corsJson({ ok: false, message }, { status });
    }
}

export async function DELETE(request: Request) {
    if (!authorize(request)) {
        return corsJson({ ok: false, message: "인증 실패" }, { status: 401 });
    }

    const { movieId }: DeleteMovieBody = await request.json();
    if (!movieId || movieId <= 0) {
        return corsJson(
            { ok: false, message: "movieId가 유효하지 않습니다." },
            { status: 400 }
        );
    }

    try {
        const deleted = await withConnection((conn) =>
            runInTransaction(conn, async () => {
            await conn.query("DELETE FROM movie_genres WHERE movie_id = ?", [
                movieId,
            ]);
            await conn.query("DELETE FROM movie_streaming_platforms WHERE movie_id = ?", [
                movieId,
            ]);
            await conn.query("DELETE FROM reviews WHERE movie_id = ?", [movieId]);
            await conn.query("DELETE FROM likes WHERE movie_id = ?", [movieId]);
            await conn.query("DELETE FROM movie_rating_stats WHERE movie_id = ?", [
                movieId,
            ]);
            await conn.query("DELETE FROM movie_rating_hist WHERE movie_id = ?", [
                movieId,
            ]);

            const [result] = await conn.query<{ affectedRows: number }>(
                "DELETE FROM movies WHERE id = ?",
                [movieId]
            );

            return result.affectedRows;
            })
        );

        if (!deleted) {
            return corsJson(
                { ok: false, message: "영화를 찾을 수 없습니다." },
                { status: 404 }
            );
        }

        return corsJson({ ok: true, movieId });
    } catch (error) {
        console.error("[admin/movies] DELETE error", error);
        return corsJson(
            {
                ok: false,
                message:
                    error instanceof Error ? error.message : "영화 삭제에 실패했습니다.",
            },
            { status: 500 }
        );
    }
}

export function OPTIONS() {
    return corsEmpty();
}
