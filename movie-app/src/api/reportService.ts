import { apiRequest } from "./client";

type ReportReviewResponse = {
    ok: boolean;
    message?: string;
};

export function reportReview(input: {
    reviewId: number;
    userId: number;
    reason: string;
}): Promise<ReportReviewResponse> {
    return apiRequest<ReportReviewResponse>("/reviews/report", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
