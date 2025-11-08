import type { PoolConnection } from "mysql2/promise";

export async function recalcMovieAggregates(
    conn: PoolConnection,
    movieId: number
) {
    await conn.query(
        `
        REPLACE INTO movie_rating_hist (
            movie_id,
            r1, r2, r3, r4, r5,
            r6, r7, r8, r9, r10,
            updated_at
        )
        SELECT
            r.movie_id,
            SUM(r.rating = 1),
            SUM(r.rating = 2),
            SUM(r.rating = 3),
            SUM(r.rating = 4),
            SUM(r.rating = 5),
            SUM(r.rating = 6),
            SUM(r.rating = 7),
            SUM(r.rating = 8),
            SUM(r.rating = 9),
            SUM(r.rating = 10),
            NOW()
        FROM reviews r
        WHERE r.status = 'active' AND r.movie_id = ?
        GROUP BY r.movie_id
    `,
        [movieId]
    );
}
