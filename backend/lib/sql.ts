import { DEFAULT_GLOBAL_AVG, DEFAULT_MIN_VOTES } from "./rating";

export const RATING_STATS_SUBQUERY = `
    SELECT r.movie_id,
           ROUND(AVG(r.rating), 2) AS avg_rating,
           COUNT(*) AS vote_count,
           ROUND(
               (COUNT(*) / (COUNT(*) + ${DEFAULT_MIN_VOTES})) * AVG(r.rating) +
               (${DEFAULT_MIN_VOTES} / (COUNT(*) + ${DEFAULT_MIN_VOTES})) * ${DEFAULT_GLOBAL_AVG},
               2
           ) AS weighted_rating
    FROM reviews r
    WHERE r.status = 'active'
    GROUP BY r.movie_id
`;
