import { apiRequest } from "./client";
import type { Movie } from "../types";

export type ImportMoviesResponse = {
    ok: boolean;
    inserted?: number;
    skipped?: number;
    message?: string;
};

export function importMoviesToDatabase(movies: Movie[]): Promise<ImportMoviesResponse> {
    return apiRequest<ImportMoviesResponse>("/admin/import-movies", {
        method: "POST",
        body: JSON.stringify({ movies }),
        headers: {
            "X-Admin-Token": import.meta.env.VITE_ADMIN_IMPORT_TOKEN ?? "",
        },
    });
}

export function fetchAndImportMoviesFromApi(): Promise<ImportMoviesResponse> {
    return apiRequest<ImportMoviesResponse>("/admin/fetch-and-import", {
        method: "POST",
        headers: {
            "X-Admin-Token": import.meta.env.VITE_ADMIN_IMPORT_TOKEN ?? "",
        },
    });
}

export function clearDatabase(): Promise<{ ok: boolean; message?: string }> {
    return apiRequest("/admin/clear-data", {
        method: "POST",
        headers: {
            "X-Admin-Token": import.meta.env.VITE_ADMIN_IMPORT_TOKEN ?? "",
        },
    });
}
