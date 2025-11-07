import { apiRequest } from "./client";

type PreferredGenresResponse = {
    ok: boolean;
    genres?: string[];
    message?: string;
};

type SavePreferredGenresResponse = {
    ok: boolean;
    inserted?: number;
    message?: string;
};

export function fetchPreferredGenres(userId: number): Promise<PreferredGenresResponse> {
    return apiRequest<PreferredGenresResponse>(
        `/users/preferred-genres?userId=${encodeURIComponent(userId)}`
    );
}

export function savePreferredGenres(
    userId: number,
    genres: string[]
): Promise<SavePreferredGenresResponse> {
    return apiRequest<SavePreferredGenresResponse>("/users/preferred-genres", {
        method: "POST",
        body: JSON.stringify({ userId, genres }),
    });
}
