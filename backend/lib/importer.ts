import type { Movie } from "./types";
import type { PoolConnection } from "mysql2/promise";

export async function importMovies(
    conn: PoolConnection,
    movies: Movie[]
): Promise<{ inserted: number; skipped: number }> {
    await conn.beginTransaction();
    let inserted = 0;
    let skipped = 0;

    try {
        for (const movie of movies) {
            const directorName = movie.director?.trim();
            let directorId: number | null = null;
            if (directorName) {
                const [directorRows] = await conn.query<{ id: number }[]>(
                    "SELECT id FROM directors WHERE name = ? LIMIT 1",
                    [directorName]
                );
                if (directorRows.length > 0) {
                    directorId = directorRows[0].id;
                } else {
                    const [res] = await conn.query<{ insertId: number }>(
                        "INSERT INTO directors (name) VALUES (?)",
                        [directorName]
                    );
                    directorId = res.insertId;
                }
            }

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
                 runtime_minutes, trailer_site, trailer_key, age_rating, director_id)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
                    directorId,
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
    const directorName = movie.director?.trim();
    let directorId: number | null = null;
    if (directorName) {
        const [directorRows] = await conn.query<{ id: number }[]>(
            "SELECT id FROM directors WHERE name = ? LIMIT 1",
            [directorName]
        );
        if (directorRows.length > 0) {
            directorId = directorRows[0].id;
        } else {
            const [res] = await conn.query<{ insertId: number }>(
                "INSERT INTO directors (name) VALUES (?)",
                [directorName]
            );
            directorId = res.insertId;
        }
    }

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
            directorId,
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
}
