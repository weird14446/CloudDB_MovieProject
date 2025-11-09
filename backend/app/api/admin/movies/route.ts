import { corsEmpty, corsJson } from "@/lib/cors";
import { withConnection } from "@/lib/db";
import { mapMovies } from "@/lib/formatters";
import type { Movie } from "@/lib/types";
import type { PoolConnection } from "mysql2/promise";
import { RATING_STATS_SUBQUERY } from "@/lib/sql";

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

function parseDirectors(value?: string | null): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
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

async function attachDirectors(
    conn: PoolConnection,
    movieId: number,
    directorField?: string | null
) {
    const names = parseDirectors(directorField);
    await conn.query("DELETE FROM movie_directors WHERE movie_id = ?", [movieId]);
    for (const name of names) {
        const personId = await ensurePerson(conn, name);
        if (!personId) continue;
        await conn.query(
            "INSERT IGNORE INTO movie_directors (movie_id, person_id) VALUES (?, ?)",
            [movieId, personId]
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
               dir.director_names AS director_name,
               s.avg_rating,
               s.vote_count,
               s.weighted_rating,
               COALESCE(likes.like_count, 0) AS like_count
        FROM movies m
        LEFT JOIN (
            SELECT md.movie_id,
                   GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') AS director_names
            FROM movie_directors md
            JOIN people p ON p.id = md.person_id
            GROUP BY md.movie_id
        ) dir ON dir.movie_id = m.id
        LEFT JOIN (
            ${RATING_STATS_SUBQUERY}
        ) s ON s.movie_id = m.id
        LEFT JOIN (
            SELECT movie_id, COUNT(*) AS like_count
            FROM likes
            GROUP BY movie_id
        ) likes ON likes.movie_id = m.id
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

    const [castRows] = await conn.query<{
        person_id: number;
        cast_name: string;
        character_name: string | null;
        profile_url: string | null;
        cast_order: number | null;
    }[]>(
        `
        SELECT p.id AS person_id,
               p.name AS cast_name,
               mc.character_name,
               p.profile_url,
               mc.cast_order
        FROM movie_cast mc
        JOIN people p ON p.id = mc.person_id
        WHERE mc.movie_id = ?
        ORDER BY mc.cast_order ASC
    `,
        [movieId]
    );

    const genresByMovie = {
        [movieId]: genreRows.map((row) => slugify(row.name)),
    };
    const platformsByMovie = {
        [movieId]: platformRows.map((row) => row.name),
    };
    const castByMovie = {
        [movieId]: castRows.map((row) => ({
            id: row.person_id,
            name: row.cast_name,
            character: row.character_name ?? undefined,
            profileUrl: row.profile_url ?? undefined,
        })),
    };

    return mapMovies(movieRows, genresByMovie, platformsByMovie, castByMovie)[0] ?? null;
}

function buildMovieValues(
    movie: AdminMoviePayload | undefined,
    title: string,
    year: number
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

            const values = buildMovieValues(movie, title, year);

            const [insert] = await conn.query<{ insertId: number }>(
                `INSERT INTO movies
                (tmdb_id, title, year, overview, poster_url, release_date, status,
                 budget, revenue, runtime_minutes, trailer_site, trailer_key,
                 age_rating)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                values
            );

            const movieId = insert.insertId;
            await attachGenres(conn, movieId, movie?.genres ?? []);
            await attachPlatforms(conn, movieId, movie?.streamingPlatforms ?? []);
            await attachDirectors(conn, movieId, movie?.director);

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

                const values = buildMovieValues(movie, title, year);

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
                         age_rating = ?
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
                await attachDirectors(conn, movieId, movie?.director);

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
async function ensurePerson(
    conn: PoolConnection,
    name?: string | null,
    profileUrl?: string | null
): Promise<number | null> {
    const normalized = name?.trim();
    if (!normalized) return null;
    const [existing] = await conn.query<{ id: number; profile_url: string | null }[]>(
        "SELECT id, profile_url FROM people WHERE name = ? LIMIT 1",
        [normalized]
    );
    if (existing.length) {
        const person = existing[0];
        if (profileUrl && profileUrl !== person.profile_url) {
            await conn.query("UPDATE people SET profile_url = ? WHERE id = ?", [
                profileUrl,
                person.id,
            ]);
        }
        return person.id;
    }
    const [insert] = await conn.query<{ insertId: number }>(
        "INSERT INTO people (name, profile_url) VALUES (?, ?)",
        [normalized, profileUrl ?? null]
    );
    return insert.insertId;
}
