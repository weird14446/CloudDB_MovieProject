import { apiRequest } from "./client";

export async function getGoogleAuthUrl(origin?: string) {
    const query = origin ? `?origin=${encodeURIComponent(origin)}` : "";
    return apiRequest<{ ok: boolean; authUrl?: string; message?: string }>(
        `/auth/oauth/google${query}`
    );
}
