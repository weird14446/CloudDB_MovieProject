import { apiRequest } from "./client";
import type { Movie } from "../types";

export type ImportMoviesResponse = {
    ok: boolean;
    inserted?: number;
    skipped?: number;
    message?: string;
};

export type AdminMovieInput = {
    title: string;
    year: number;
    director?: string;
    overview?: string;
    posterUrl?: string;
    releaseDate?: string;
    status?: string;
    budget?: number;
    revenue?: number;
    runtimeMinutes?: number;
    trailerSite?: Movie["trailerSite"];
    trailerKey?: string;
    ageRating?: string;
    genres?: string[];
    streamingPlatforms?: string[];
    tmdbId?: number;
};

type CreateMovieResponse = {
    ok: boolean;
    movie?: Movie;
    message?: string;
};

type DeleteMovieResponse = {
    ok: boolean;
    movieId?: number;
    message?: string;
};

const ADMIN_HEADER = {
    "X-Admin-Token": import.meta.env.VITE_ADMIN_IMPORT_TOKEN ?? "",
};

export function importMoviesToDatabase(movies: Movie[]): Promise<ImportMoviesResponse> {
    return apiRequest<ImportMoviesResponse>("/admin/import-movies", {
        method: "POST",
        body: JSON.stringify({ movies }),
        headers: ADMIN_HEADER,
    });
}

export function fetchAndImportMoviesFromApi(): Promise<ImportMoviesResponse> {
    return apiRequest<ImportMoviesResponse>("/admin/fetch-and-import", {
        method: "POST",
        headers: ADMIN_HEADER,
    });
}

export function clearDatabase(): Promise<{ ok: boolean; message?: string }> {
    return apiRequest("/admin/clear-data", {
        method: "POST",
        headers: ADMIN_HEADER,
    });
}

export function createMovie(movie: AdminMovieInput): Promise<CreateMovieResponse> {
    return apiRequest<CreateMovieResponse>("/admin/movies", {
        method: "POST",
        body: JSON.stringify({ movie }),
        headers: ADMIN_HEADER,
    });
}

export function deleteMovie(movieId: number): Promise<DeleteMovieResponse> {
    return apiRequest<DeleteMovieResponse>("/admin/movies", {
        method: "DELETE",
        body: JSON.stringify({ movieId }),
        headers: ADMIN_HEADER,
    });
}

export function updateMovie(
    movieId: number,
    movie: AdminMovieInput
): Promise<CreateMovieResponse> {
    return apiRequest<CreateMovieResponse>("/admin/movies", {
        method: "PUT",
        body: JSON.stringify({ movieId, movie }),
        headers: ADMIN_HEADER,
    });
}
