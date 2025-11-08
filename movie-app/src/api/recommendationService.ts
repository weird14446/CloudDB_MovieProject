import { apiRequest } from "./client";
import type { DirectorScore } from "../types";

export type RecommendationMovieScore = {
    movieId: number;
    score: number;
};

export type RecommendationResponse = {
    ok: boolean;
    recommendations: RecommendationMovieScore[];
    directorScores: DirectorScore[];
    message?: string;
};

export type RecommendationRequest = {
    userId?: number;
    selectedGenres?: string[];
    topK?: number;
};

export async function fetchRecommendations(
    params: RecommendationRequest
): Promise<RecommendationResponse> {
    return apiRequest<RecommendationResponse>("/recommendations", {
        method: "POST",
        body: JSON.stringify(params),
    });
}
