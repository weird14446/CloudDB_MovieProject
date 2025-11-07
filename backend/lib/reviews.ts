import type { PoolConnection } from "mysql2/promise";

const DEFAULT_MIN_VOTES = 150;
const DEFAULT_GLOBAL_AVG = 6.5;

async function getRatingParams(
    conn: PoolConnection
): Promise<{ minVotes: number; globalAvg: number }> {
    const [rows] = await conn.query<{ k: string; v: string }[]>(
        "SELECT k, v FROM system_params WHERE k IN ('wr_min_votes', 'wr_global_avg')"
    );
    const map = new Map(rows.map((row) => [row.k, row.v]));
    const minVotes = Number(map.get("wr_min_votes")) || DEFAULT_MIN_VOTES;
    const globalAvg = Number(map.get("wr_global_avg")) || DEFAULT_GLOBAL_AVG;
    return { minVotes, globalAvg };
}

export async function recalcMovieAggregates(
    conn: PoolConnection,
    movieId: number
) {
    const { minVotes, globalAvg } = await getRatingParams(conn);

    await conn.query(
        `
        REPLACE INTO movie_rating_stats (
            movie_id,
            avg_rating,
            vote_count,
            weighted_rating,
            updated_at
        )
        SELECT
            r.movie_id,
            ROUND(AVG(r.rating), 2) AS avg_rating,
            COUNT(*) AS vote_count,
            ROUND(
                (COUNT(*) / (COUNT(*) + ?)) * AVG(r.rating) +
                (? / (COUNT(*) + ?)) * ?
            , 2) AS weighted_rating,
            NOW()
        FROM reviews r
        WHERE r.status = 'active' AND r.movie_id = ?
        GROUP BY r.movie_id
    `,
        [minVotes, minVotes, minVotes, globalAvg, movieId]
    );

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
