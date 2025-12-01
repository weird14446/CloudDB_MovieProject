import { imdbWeightedRating, DEFAULT_GLOBAL_AVG } from "./rating";

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

const Z_SCORE = 1.281551565545;
const RATING_SHRINK_C = 3;

export type RecommendationMovieInput = {
    id: number;
    director: string;
    genres: string[];
    avgRating: number | null;
    voteCount: number | null;
    weightedRating: number | null;
    likeCount?: number | null;
};

export type RecommendationMovieScore = {
    movieId: number;
    score: number;
};

export type DirectorScore = {
    director: string;
    score: number;
    likedCount: number;
    seenCount: number;
    avgQuality: number;
};

export type RecommendationComputationInput = {
    movies: RecommendationMovieInput[];
    likedMovieIds: number[];
    userRatingsByMovie: Record<number, number>;
    selectedGenres: string[];
    topK: number;
};

export type RecommendationComputationResult = {
    rankedMovies: RecommendationMovieScore[];
    directorScores: DirectorScore[];
    hasPreferenceSignals: boolean;
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

function computeGenreAffinity(movieGenres: string[], selected: Set<string>): number {
    if (selected.size === 0) return 0;
    const overlap = movieGenres.reduce(
        (total, genre) => total + (selected.has(genre) ? 1 : 0),
        0
    );
    return overlap / selected.size;
}

export function computeRecommendationRanking({
    movies,
    likedMovieIds,
    userRatingsByMovie,
    selectedGenres,
    topK,
}: RecommendationComputationInput): RecommendationComputationResult {
    if (!movies.length) {
        return {
            rankedMovies: [],
            directorScores: [],
            hasPreferenceSignals: false,
        };
    }

    const effectiveTopK = Math.max(1, Math.min(topK, 20));
    const likedSet = new Set(likedMovieIds);
    const selectedGenreSet = new Set(selectedGenres);

    const ratingSamples = movies
        .map((movie) =>
            typeof movie.avgRating === "number"
                ? movie.avgRating
                : typeof movie.weightedRating === "number"
                    ? movie.weightedRating
                    : null
        )
        .filter((value): value is number => value !== null);
    const globalAverage =
        ratingSamples.length > 0
            ? ratingSamples.reduce((sum, value) => sum + value, 0) / ratingSamples.length
            : DEFAULT_GLOBAL_AVG;

    const qualityByMovie = new Map<number, number>();
    const displayQualityByMovie = new Map<number, number>();
    const qualityValues: number[] = [];
    movies.forEach((movie) => {
        const displayRating =
            typeof movie.avgRating === "number"
                ? movie.avgRating
                : typeof movie.weightedRating === "number"
                    ? movie.weightedRating
                    : null;
        const qualityValue =
            typeof movie.weightedRating === "number"
                ? movie.weightedRating
                : imdbWeightedRating(displayRating ?? undefined, movie.voteCount, globalAverage);
        qualityByMovie.set(movie.id, qualityValue);
        displayQualityByMovie.set(movie.id, displayRating ?? globalAverage);
        qualityValues.push(qualityValue);
    });
    const globalQualityMean =
        qualityValues.length > 0
            ? qualityValues.reduce((sum, value) => sum + value, 0) / qualityValues.length
            : globalAverage;

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
        const stats: Record<
            string,
            {
                likedCount: number;
                seenCount: number;
                ratingCount: number;
                ratingSum: number;
                likedQualitySum: number;
                seenQualitySum: number;
                likedDisplaySum: number;
                seenDisplaySum: number;
            }
        > = {};

        movies.forEach((movie) => {
            const director = movie.director || "미상";
            const liked = likedSet.has(movie.id);
            const userRating = userRatingsByMovie[movie.id];
            const seen = liked || typeof userRating === "number";
            if (!seen) return;

            stats[director] ??= {
                likedCount: 0,
                seenCount: 0,
                ratingCount: 0,
                ratingSum: 0,
                likedQualitySum: 0,
                seenQualitySum: 0,
                likedDisplaySum: 0,
                seenDisplaySum: 0,
            };
            const acc = stats[director];
            const qualityValue = qualityByMovie.get(movie.id) ?? globalQualityMean;
            const displayQuality = displayQualityByMovie.get(movie.id) ?? globalQualityMean;
            acc.seenCount += 1;
            acc.seenQualitySum += qualityValue;
            acc.seenDisplaySum += displayQuality;
            if (liked) {
                acc.likedCount += 1;
                acc.likedQualitySum += qualityValue;
                acc.likedDisplaySum += displayQuality;
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
            const qualitySourceCount =
                acc.likedCount > 0 ? acc.likedCount : acc.seenCount;
            const qualitySourceSum =
                acc.likedCount > 0 ? acc.likedQualitySum : acc.seenQualitySum;
            const avgQualityForScore =
                qualitySourceCount > 0
                    ? qualitySourceSum / qualitySourceCount
                    : globalQualityMean;
            const displaySourceCount =
                acc.likedCount > 0 ? acc.likedCount : acc.seenCount;
            const displaySourceSum =
                acc.likedCount > 0 ? acc.likedDisplaySum : acc.seenDisplaySum;
            const displayAvgQuality =
                displaySourceCount > 0
                    ? displaySourceSum / displaySourceCount
                    : globalQualityMean;
            const qualityComponent = normalizeQuality(avgQualityForScore, globalQualityMean);

            const score =
                DIRECTOR_WEIGHTS.rating * ratingComponent +
                DIRECTOR_WEIGHTS.like * likeComponent +
                DIRECTOR_WEIGHTS.quality * qualityComponent;
            directorScores.push({
                director,
                score,
                likedCount: acc.likedCount,
                seenCount: acc.seenCount,
                avgQuality: displayAvgQuality,
            });
        });

        directorScores.sort((a, b) => b.score - a.score);
    }

    const directorScoreMap = new Map<string, number>();
    directorScores.forEach((item) => directorScoreMap.set(item.director, item.score));

    // 사용자 콘텐츠/감독 선호 프로파일
    const genreFrequency = new Map<string, number>();
    const directorFrequency = new Map<string, number>();
    const interactionIds = new Set<number>(likedMovieIds);
    Object.keys(userRatingsByMovie).forEach((movieId) =>
        interactionIds.add(Number(movieId))
    );

    movies.forEach((movie) => {
        if (!interactionIds.has(movie.id)) return;
        movie.genres.forEach((g) => {
            genreFrequency.set(g, (genreFrequency.get(g) ?? 0) + 1);
        });
        const dir = movie.director || "미상";
        directorFrequency.set(dir, (directorFrequency.get(dir) ?? 0) + 1);
    });

    const totalGenreSignals = Array.from(genreFrequency.values()).reduce((a, b) => a + b, 0);
    const totalDirectorSignals = Array.from(directorFrequency.values()).reduce(
        (a, b) => a + b,
        0
    );

    function contentAffinity(movie: RecommendationMovieInput): number {
        const genreScore =
            totalGenreSignals > 0
                ? movie.genres.reduce(
                      (sum, g) => sum + (genreFrequency.get(g) ?? 0) / totalGenreSignals,
                      0
                  ) / Math.max(1, movie.genres.length)
                : 0;
        const directorScore =
            totalDirectorSignals > 0
                ? (directorFrequency.get(movie.director) ?? 0) / totalDirectorSignals
                : 0;
        // 콘텐츠 기반 가중치: 장르 0.6, 감독 0.4
        return 0.6 * genreScore + 0.4 * directorScore;
    }

    // 인기 보정
    const maxLike = movies.reduce(
        (max, m) => Math.max(max, Number(m.likeCount ?? 0)),
        0
    );

    const candidateMovies = movies.filter((movie) => !seenMovieIds.has(movie.id));
    const recommendationPool = candidateMovies.length > 0 ? candidateMovies : movies;

    const rankedByScore = recommendationPool
        .map((movie) => {
            const directorScore = directorScoreMap.get(movie.director) ?? 0;
            const qualityComponent = normalizeQuality(
                qualityByMovie.get(movie.id) ?? globalQualityMean,
                globalQualityMean
            );
            const genreComponent = computeGenreAffinity(movie.genres, selectedGenreSet);
            const contentComponent = contentAffinity(movie);
            const popularityComponent =
                maxLike > 0 ? Math.log1p(Number(movie.likeCount ?? 0)) / Math.log1p(maxLike) : 0;

            const score =
                RECOMMENDATION_WEIGHTS.director * directorScore +
                RECOMMENDATION_WEIGHTS.quality * qualityComponent +
                RECOMMENDATION_WEIGHTS.genre * genreComponent +
                0.35 * contentComponent +
                0.15 * popularityComponent;

            return { movieId: movie.id, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, effectiveTopK);

    if (!hasPreferenceSignals) {
        const fallback = movies
            .slice()
            .sort(
                (a, b) =>
                    (qualityByMovie.get(b.id) ?? globalQualityMean) -
                    (qualityByMovie.get(a.id) ?? globalQualityMean)
            )
            .slice(0, effectiveTopK)
            .map((movie) => ({
                movieId: movie.id,
                score: qualityByMovie.get(movie.id) ?? globalQualityMean,
            }));

        return {
            rankedMovies: fallback,
            directorScores,
            hasPreferenceSignals,
        };
    }

    return {
        rankedMovies: rankedByScore,
        directorScores,
        hasPreferenceSignals,
    };
}
