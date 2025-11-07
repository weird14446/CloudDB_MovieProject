import type { Movie, Review, User } from "../types";

const DEFAULT_GLOBAL_AVG = 6.5;
const DEFAULT_MIN_VOTES = 150;
const Z_SCORE = 1.281551565545;
const RATING_SHRINK_C = 3;

const DIRECTOR_WEIGHTS = {
    rating: 0.5,
    like: 0.3,
    quality: 0.2,
} as const;

const RECOMMENDATION_WEIGHTS = {
    director: 0.5,
    quality: 0.35,
    genre: 0.15,
} as const;

type DirectorAccumulator = {
    likedCount: number;
    seenCount: number;
    ratingCount: number;
    ratingSum: number;
    qualitySum: number;
};

export type DirectorScore = {
    director: string;
    score: number;
    likedCount: number;
    seenCount: number;
    avgQuality: number;
};

export type RecommendationParams = {
    movies: Movie[];
    likedMovieIds: number[];
    reviewsByMovie: Record<number, Review[]>;
    user: User | null;
    selectedGenres: string[];
    topK?: number;
};

export type RecommendationResult = {
    recommendedMovies: Movie[];
    directorScores: DirectorScore[];
};

function normalizeQuality(value: number, baseline: number): number {
    const normalized = (Number.isFinite(value) ? value : baseline) / 10;
    return Math.max(0, Math.min(1, normalized));
}

export function wilsonLowerBound(successes: number, total: number, z = Z_SCORE): number {
    if (total <= 0) return 0;
    if (successes <= 0) return 0;
    const p = successes / total;
    const z2 = z * z;
    const denom = 1 + z2 / total;
    const centre = p + z2 / (2 * total);
    const margin = z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));
    return Math.max(0, (centre - margin) / denom);
}

export function imdbWeightedRating(
    rating?: number,
    voteCount?: number,
    globalAverage = DEFAULT_GLOBAL_AVG,
    minVotes = DEFAULT_MIN_VOTES
): number {
    const R = typeof rating === "number" ? rating : globalAverage;
    const v = typeof voteCount === "number" ? voteCount : 0;
    if (v <= 0) {
        return R;
    }
    return (v / (v + minVotes)) * R + (minVotes / (v + minVotes)) * globalAverage;
}

function computeUserRatings(
    movies: Movie[],
    reviewsByMovie: Record<number, Review[]>,
    user: User | null
): Record<number, number> {
    if (!user) return {};
    const map: Record<number, number> = {};
    movies.forEach((movie) => {
        const personalReviews = (reviewsByMovie[movie.id] ?? []).filter(
            (review) => review.userName === user.name
        );
        if (personalReviews.length === 0) return;
        const avg =
            personalReviews.reduce((sum, review) => sum + review.rating, 0) /
            personalReviews.length;
        map[movie.id] = avg;
    });
    return map;
}

function computeGenreAffinity(movie: Movie, selected: Set<string>): number {
    if (selected.size === 0) return 0;
    const overlap = movie.genres.reduce(
        (acc, genre) => acc + (selected.has(genre) ? 1 : 0),
        0
    );
    return overlap / selected.size;
}

export function buildRecommendations({
    movies,
    likedMovieIds,
    reviewsByMovie,
    user,
    selectedGenres,
    topK = 6,
}: RecommendationParams): RecommendationResult {
    const likedSet = new Set(likedMovieIds);
    const selectedGenreSet = new Set(selectedGenres);

    const ratingSamples = movies
        .map((movie) => movie.avgRating)
        .filter((value): value is number => typeof value === "number");
    const globalAverage =
        ratingSamples.length > 0
            ? ratingSamples.reduce((sum, value) => sum + value, 0) / ratingSamples.length
            : DEFAULT_GLOBAL_AVG;

    const qualityByMovie = new Map<number, number>();
    const qualityValues: number[] = [];
    movies.forEach((movie) => {
        const wr = imdbWeightedRating(movie.avgRating, movie.voteCount, globalAverage);
        qualityByMovie.set(movie.id, wr);
        qualityValues.push(wr);
    });
    const globalQualityMean =
        qualityValues.length > 0
            ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length
            : globalAverage;

    const userRatingsByMovie = computeUserRatings(movies, reviewsByMovie, user);
    const userRatingValues = Object.values(userRatingsByMovie);
    const userRatingMean =
        userRatingValues.length > 0
            ? userRatingValues.reduce((sum, value) => sum + value, 0) / userRatingValues.length
            : null;

    const seenMovieIds = new Set<number>(likedMovieIds);
    Object.keys(userRatingsByMovie).forEach((movieId) =>
        seenMovieIds.add(Number(movieId))
    );

    const hasPreferenceSignals = likedSet.size > 0 || userRatingValues.length > 0;
    const directorScores: DirectorScore[] = [];

    if (hasPreferenceSignals) {
        const stats: Record<string, DirectorAccumulator> = {};
        movies.forEach((movie) => {
            const director = movie.director ?? "미상";
            const liked = likedSet.has(movie.id);
            const userRating = userRatingsByMovie[movie.id];
            const seen = liked || typeof userRating === "number";
            if (!seen) return;

            stats[director] ??= {
                likedCount: 0,
                seenCount: 0,
                ratingCount: 0,
                ratingSum: 0,
                qualitySum: 0,
            };
            const acc = stats[director];
            acc.seenCount += 1;
            if (liked) {
                acc.likedCount += 1;
                acc.qualitySum += qualityByMovie.get(movie.id) ?? globalQualityMean;
            }
            if (typeof userRating === "number") {
                acc.ratingCount += 1;
                acc.ratingSum += userRating;
            }
        });

        Object.entries(stats).forEach(([director, acc]) => {
            const ratingMean =
                acc.ratingCount > 0 ? acc.ratingSum / acc.ratingCount : null;
            const ratingDelta =
                ratingMean != null && userRatingMean != null
                    ? ratingMean - userRatingMean
                    : 0;
            const shrink =
                acc.ratingCount > 0
                    ? acc.ratingCount / (acc.ratingCount + RATING_SHRINK_C)
                    : 0;
            const ratingComponent =
                shrink > 0 ? Math.tanh((ratingDelta * shrink) / 0.7) : 0;
            const likeComponent = wilsonLowerBound(acc.likedCount, acc.seenCount);
            const avgQuality =
                acc.likedCount > 0
                    ? acc.qualitySum / acc.likedCount
                    : globalQualityMean;
            const qualityComponent = normalizeQuality(avgQuality, globalQualityMean);

            const score =
                DIRECTOR_WEIGHTS.rating * ratingComponent +
                DIRECTOR_WEIGHTS.like * likeComponent +
                DIRECTOR_WEIGHTS.quality * qualityComponent;
            directorScores.push({
                director,
                score,
                likedCount: acc.likedCount,
                seenCount: acc.seenCount,
                avgQuality,
            });
        });

        directorScores.sort((a, b) => b.score - a.score);
    }

    const directorScoreMap = new Map<string, number>();
    directorScores.forEach((item) => directorScoreMap.set(item.director, item.score));

    const candidateMovies = movies.filter((movie) => !seenMovieIds.has(movie.id));
    const recommendationPool = candidateMovies.length > 0 ? candidateMovies : movies;

    const ranked = recommendationPool
        .map((movie) => {
            const directorScore = directorScoreMap.get(movie.director ?? "") ?? 0;
            const qualityComponent = normalizeQuality(
                qualityByMovie.get(movie.id) ?? globalQualityMean,
                globalQualityMean
            );
            const genreComponent = computeGenreAffinity(movie, selectedGenreSet);

            const score =
                RECOMMENDATION_WEIGHTS.director * directorScore +
                RECOMMENDATION_WEIGHTS.quality * qualityComponent +
                RECOMMENDATION_WEIGHTS.genre * genreComponent;

            return { movie, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .map((entry) => entry.movie);

    if (!hasPreferenceSignals) {
        const fallback = movies
            .slice()
            .sort(
                (a, b) =>
                    (qualityByMovie.get(b.id) ?? globalQualityMean) -
                    (qualityByMovie.get(a.id) ?? globalQualityMean)
            )
            .slice(0, topK);
        return {
            recommendedMovies: fallback,
            directorScores,
        };
    }

    return {
        recommendedMovies: ranked,
        directorScores,
    };
}
