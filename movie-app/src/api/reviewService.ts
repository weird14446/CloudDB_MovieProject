import { apiRequest } from "./client";
import type { Review } from "../types";

type CreateReviewResponse = {
    ok: boolean;
    review?: Review;
    message?: string;
};

export function createReview(input: {
    userId: number;
    movieId: number;
    rating: number;
    content: string;
}): Promise<CreateReviewResponse> {
    return apiRequest<CreateReviewResponse>("/reviews", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
