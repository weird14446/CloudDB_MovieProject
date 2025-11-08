import { corsJson, corsEmpty } from "@/lib/cors";
import { withConnection } from "@/lib/db";
import {
    computeRecommendationRanking,
    type RecommendationMovieInput,
} from "@/lib/recommendations";
import { RATING_STATS_SUBQUERY } from "@/lib/sql";
import type { PoolConnection } from "mysql2/promise";

type RecommendationRequestBody = {
    userId?: number;
    selectedGenres?: string[];
    topK?: number;
};

type MovieRow = {
    id: number;
    director_name: string | null;
    avg_rating: number | null;
    vote_count: number | null;
    weighted_rating: number | null;
};

function toSlug(value: string): string {
    return (
        value
            ?.trim()
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, "")
            .replace(/\s+/g, "-") ?? ""
    );
}

function sanitizeGenreSlugs(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    const result = new Set<string>();
    values.forEach((value) => {
        if (typeof value !== "string") return;
        const slug = toSlug(value);
        if (slug) {
            result.add(slug);
        }
    });
    return Array.from(result);
}

async function loadPreferredGenreSlugs(
    conn: PoolConnection,
    userId: number
): Promise<string[]> {
    const [rows] = await conn.query<{ name: string }[]>(
        `
        SELECT g.name
        FROM user_preferred_genres upg
        JOIN genres g ON g.id = upg.genre_id
        WHERE upg.user_id = ?
    `,
        [userId]
    );
    const unique = new Set<string>();
    rows.forEach((row) => {
        const slug = toSlug(row.name);
        if (slug) {
            unique.add(slug);
        }
    });
    return Array.from(unique);
}

export async function POST(request: Request) {
    let body: RecommendationRequestBody = {};
    try {
        body = (await request.json()) ?? {};
    } catch {
        body = {};
    }

    const userId = typeof body.userId === "number" ? body.userId : null;
    const requestedGenres = sanitizeGenreSlugs(body.selectedGenres);
    const requestedTopK =
        typeof body.topK === "number" && Number.isFinite(body.topK)
            ? Math.round(body.topK)
            : 6;

    try {
        const response = await withConnection(async (conn) => {
            const [movieRows] = await conn.query<MovieRow[]>(
                `
                SELECT m.id,
                       dir.director_names AS director_name,
                       stats.avg_rating,
                       stats.vote_count,
                       stats.weighted_rating
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
                ) stats ON stats.movie_id = m.id
                ORDER BY m.year DESC, m.id DESC
                LIMIT 300
            `
            );

            if (!movieRows.length) {
                return {
                    recommendations: [],
                    directorScores: [],
                };
            }

            const movieIds = movieRows.map((row) => Number(row.id));
            let genreRows: { movie_id: number; name: string }[] = [];
            if (movieIds.length > 0) {
                const [rows] = await conn.query<{ movie_id: number; name: string }[]>(
                    `
                    SELECT mg.movie_id, g.name
                    FROM movie_genres mg
                    JOIN genres g ON g.id = mg.genre_id
                    WHERE mg.movie_id IN (?)
                `,
                    [movieIds]
                );
                genreRows = rows;
            }

            const genresByMovie = genreRows.reduce<Record<number, string[]>>(
                (acc, row) => {
                    const movieId = Number(row.movie_id);
                    const list = acc[movieId] ?? [];
                    const slug = toSlug(row.name);
                    if (slug) {
                        list.push(slug);
                        acc[movieId] = list;
                    }
                    return acc;
                },
                {}
            );

            let likedMovieIds: number[] = [];
            const userRatingsByMovie: Record<number, number> = {};

            if (userId) {
                const [likeRows] = await conn.query<{ movie_id: number }[]>(
                    "SELECT movie_id FROM likes WHERE user_id = ?",
                    [userId]
                );
                likedMovieIds = likeRows.map((row) => Number(row.movie_id));

                const [ratingRows] = await conn.query<
                    { movie_id: number; rating: number }[]
                >(
                    `
                    SELECT movie_id, rating
                    FROM reviews
                    WHERE user_id = ? AND status = 'active'
                `,
                    [userId]
                );
                ratingRows.forEach((row) => {
                    userRatingsByMovie[Number(row.movie_id)] = Number(row.rating);
                });
            }

            let selectedGenres = requestedGenres;
            if (!selectedGenres.length && userId) {
                selectedGenres = await loadPreferredGenreSlugs(conn, userId);
            }

            const moviesForRanking: RecommendationMovieInput[] = movieRows.map(
                (row) => {
                    const movieId = Number(row.id);
                    return {
                        id: movieId,
                        director: row.director_name ?? "미상",
                        genres: genresByMovie[movieId] ?? [],
                        avgRating:
                            row.avg_rating != null ? Number(row.avg_rating) : null,
                        voteCount:
                            row.vote_count != null ? Number(row.vote_count) : null,
                        weightedRating:
                            row.weighted_rating != null
                                ? Number(row.weighted_rating)
                                : null,
                    };
                }
            );

            return computeRecommendationRanking({
                movies: moviesForRanking,
                likedMovieIds,
                userRatingsByMovie,
                selectedGenres,
                topK: requestedTopK,
            });
        });

        return corsJson({
            ok: true,
            recommendations: response.rankedMovies,
            directorScores: response.directorScores,
        });
    } catch (error) {
        console.error("[recommendations] error", error);
        return corsJson(
            {
                ok: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "추천 정보를 계산하지 못했습니다.",
            },
            { status: 500 }
        );
    }
}

export function OPTIONS() {
    return corsEmpty();
}
