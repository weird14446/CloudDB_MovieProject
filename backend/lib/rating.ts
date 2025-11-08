export const DEFAULT_GLOBAL_AVG = 6.5;
export const DEFAULT_MIN_VOTES = 150;

export function imdbWeightedRating(
    rating?: number | null,
    voteCount?: number | null,
    globalAverage = DEFAULT_GLOBAL_AVG,
    minVotes = DEFAULT_MIN_VOTES
): number {
    const R = typeof rating === "number" ? rating : globalAverage;
    const v = typeof voteCount === "number" ? voteCount : 0;
    if (v <= 0) {
        return globalAverage;
    }
    return (v / (v + minVotes)) * R + (minVotes / (v + minVotes)) * globalAverage;
}
