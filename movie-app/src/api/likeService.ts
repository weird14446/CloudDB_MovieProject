import { apiRequest } from "./client";

type LikesResponse = {
    ok: boolean;
    likes?: number[];
    message?: string;
};

type ToggleResponse = {
    ok: boolean;
    liked?: boolean;
    message?: string;
};

export function fetchLikes(userId: number): Promise<LikesResponse> {
    const url = `/likes?userId=${encodeURIComponent(userId)}`;
    return apiRequest<LikesResponse>(url);
}

export function toggleLike(input: {
    userId: number;
    movieId: number;
    like: boolean;
}): Promise<ToggleResponse> {
    return apiRequest<ToggleResponse>("/likes", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
