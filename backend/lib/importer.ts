import type { Movie } from "./types";
import type { PoolConnection } from "mysql2/promise";

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

function parseDirectors(value?: string | null): string[] {
    if (!value) return [];
    return value
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0);
}

async function attachDirectors(
    conn: PoolConnection,
    movieId: number,
    directorField?: string | null
): Promise<void> {
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

export async function importMovies(
    conn: PoolConnection,
    movies: Movie[]
): Promise<{ inserted: number; skipped: number }> {
    await conn.beginTransaction();
    let inserted = 0;
    let skipped = 0;

    try {
        for (const movie of movies) {
            const tmdbId = movie.tmdbId ?? movie.id;
            const [existingRows] = await conn.query<{ id: number }[]>(
                "SELECT id FROM movies WHERE tmdb_id = ? OR title = ? LIMIT 1",
                [tmdbId, movie.title]
            );

            if (existingRows.length > 0) {
                skipped += 1;
                continue;
            }

            const [insertResult] = await conn.query<{ insertId: number }>(
                `INSERT INTO movies
                (tmdb_id, title, year, overview, poster_url, release_date, status, budget, revenue,
                 runtime_minutes, trailer_site, trailer_key, age_rating)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    tmdbId,
                    movie.title,
                    movie.year,
                    movie.overview ?? null,
                    movie.posterUrl ?? null,
                    movie.releaseDate ?? null,
                    movie.status ?? null,
                    movie.budget ?? null,
                    movie.revenue ?? null,
                    movie.runtimeMinutes ?? null,
                    movie.trailerSite ?? null,
                    movie.trailerKey ?? null,
                    movie.ageRating ?? null,
                ]
            );

            const movieId = insertResult.insertId;

        if (movie.genres?.length) {
            for (const entry of movie.genres) {
                const name = entry.trim();
                if (!name) continue;
                const [genreRows] = await conn.query<{ id: number }[]>(
                    "SELECT id FROM genres WHERE name = ? LIMIT 1",
                    [name]
                );
                let genreId = genreRows[0]?.id;
                if (!genreId) {
                    const [res] = await conn.query<{ insertId: number }>(
                        "INSERT INTO genres (name) VALUES (?)",
                        [name]
                    );
                    genreId = res.insertId;
                }
                await conn.query(
                    "INSERT IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)",
                    [movieId, genreId]
                );
            }
        }

            if (movie.streamingPlatforms?.length) {
                for (const platform of movie.streamingPlatforms) {
                    const [platformRows] = await conn.query<{ id: number }[]>(
                        "SELECT id FROM streaming_platforms WHERE name = ? LIMIT 1",
                        [platform]
                    );
                    let platformId = platformRows[0]?.id;
                    if (!platformId) {
                        const [res] = await conn.query<{ insertId: number }>(
                            "INSERT INTO streaming_platforms (name) VALUES (?)",
                            [platform]
                        );
                        platformId = res.insertId;
                    }
                    await conn.query(
                        "INSERT IGNORE INTO movie_streaming_platforms (movie_id, platform_id) VALUES (?, ?)",
                        [movieId, platformId]
                    );
                }
            }

            if (movie.cast?.length) {
                const topCast = movie.cast.slice(0, 10);
                let order = 0;
                for (const member of topCast) {
                    const castName = member.name?.trim();
                    if (!castName) continue;

                    const [existingPeople] = await conn.query<{ id: number }[]>(
                        "SELECT id FROM people WHERE name = ? LIMIT 1",
                        [castName]
                    );
                    let personId = existingPeople[0]?.id;
                    if (!personId) {
                        const [personInsert] = await conn.query<{ insertId: number }>(
                            "INSERT INTO people (name, profile_url) VALUES (?, ?)",
                            [castName, member.profileUrl ?? null]
                        );
                        personId = personInsert.insertId;
                    } else if (member.profileUrl) {
                        await conn.query(
                            "UPDATE people SET profile_url = ? WHERE id = ?",
                            [member.profileUrl, personId]
                        );
                    }

                    await conn.query(
                        `
                        INSERT INTO movie_cast (movie_id, person_id, character_name, cast_order)
                        VALUES (?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                            character_name = VALUES(character_name),
                            cast_order = VALUES(cast_order)
                    `,
                        [movieId, personId, member.character ?? null, order]
                    );
                    order += 1;
                }
            }

            await attachDirectors(conn, movieId, movie.director);

            inserted += 1;
        }

        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    }

    return { inserted, skipped };
}

export async function updateExistingMovie(
    conn: PoolConnection,
    movieId: number,
    movie: Movie
) {
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
        [
            movie.tmdbId ?? movie.id ?? null,
            movie.title,
            movie.year,
            movie.overview ?? null,
            movie.posterUrl ?? null,
            movie.releaseDate ?? null,
            movie.status ?? null,
            movie.budget ?? null,
            movie.revenue ?? null,
            movie.runtimeMinutes ?? null,
            movie.trailerSite ?? null,
            movie.trailerKey ?? null,
            movie.ageRating ?? null,
            movieId,
        ]
    );

    await conn.query("DELETE FROM movie_genres WHERE movie_id = ?", [movieId]);
    if (movie.genres?.length) {
        for (const entry of movie.genres) {
            const name = entry.trim();
            if (!name) continue;
            const [genreRows] = await conn.query<{ id: number }[]>(
                "SELECT id FROM genres WHERE name = ? LIMIT 1",
                [name]
            );
            let genreId = genreRows[0]?.id;
            if (!genreId) {
                const [res] = await conn.query<{ insertId: number }>(
                    "INSERT INTO genres (name) VALUES (?)",
                    [name]
                );
                genreId = res.insertId;
            }
            await conn.query(
                "INSERT IGNORE INTO movie_genres (movie_id, genre_id) VALUES (?, ?)",
                [movieId, genreId]
            );
        }
    }

    await conn.query("DELETE FROM movie_streaming_platforms WHERE movie_id = ?", [
        movieId,
    ]);
    if (movie.streamingPlatforms?.length) {
        for (const platform of movie.streamingPlatforms) {
            const [platformRows] = await conn.query<{ id: number }[]>(
                "SELECT id FROM streaming_platforms WHERE name = ? LIMIT 1",
                [platform]
            );
            let platformId = platformRows[0]?.id;
            if (!platformId) {
                const [res] = await conn.query<{ insertId: number }>(
                    "INSERT INTO streaming_platforms (name) VALUES (?)",
                    [platform]
                );
                platformId = res.insertId;
            }
            await conn.query(
                "INSERT IGNORE INTO movie_streaming_platforms (movie_id, platform_id) VALUES (?, ?)",
                [movieId, platformId]
            );
        }
    }

    await conn.query("DELETE FROM movie_cast WHERE movie_id = ?", [movieId]);
    if (movie.cast?.length) {
        const topCast = movie.cast.slice(0, 10);
        let order = 0;
        for (const member of topCast) {
            const castName = member.name?.trim();
            if (!castName) continue;

            const [existingPeople] = await conn.query<{ id: number }[]>(
                "SELECT id FROM people WHERE name = ? LIMIT 1",
                [castName]
            );
            let personId = existingPeople[0]?.id;
            if (!personId) {
                const [personInsert] = await conn.query<{ insertId: number }>(
                    "INSERT INTO people (name, profile_url) VALUES (?, ?)",
                    [castName, member.profileUrl ?? null]
                );
                personId = personInsert.insertId;
            } else if (member.profileUrl) {
                await conn.query(
                    "UPDATE people SET profile_url = ? WHERE id = ?",
                    [member.profileUrl, personId]
                );
            }

            await conn.query(
                `
                INSERT INTO movie_cast (movie_id, person_id, character_name, cast_order)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    character_name = VALUES(character_name),
                    cast_order = VALUES(cast_order)
            `,
                [movieId, personId, member.character ?? null, order]
            );
            order += 1;
        }
    }

    await attachDirectors(conn, movieId, movie.director);
}
