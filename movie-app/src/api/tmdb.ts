import type { Genre, Movie } from "../types";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const DEFAULT_LANGUAGE = "ko-KR";

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

function ensureApiKey(): string {
    if (!TMDB_API_KEY) {
        throw new Error("TMDB API Key가 설정되지 않았습니다. .env에 VITE_TMDB_API_KEY를 추가하세요.");
    }
    return TMDB_API_KEY;
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
    const apiKey = ensureApiKey();
    const url = new URL(`${TMDB_API_BASE}${path}`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", DEFAULT_LANGUAGE);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString());
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
            body || `TMDB 요청 실패 (${response.status} ${response.statusText})`
        );
    }
    return (await response.json()) as T;
}

function toSlug(input: string): string {
    return input
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, "")
        .replace(/\s+/g, "-");
}

type TmdbGenreResponse = {
    genres: Array<{ id: number; name: string }>;
};

type TmdbTrendingResponse = {
    results: Array<{
        id: number;
        title?: string;
        original_title?: string;
        overview?: string;
        release_date?: string;
        poster_path?: string | null;
        vote_average?: number;
        vote_count?: number;
        genre_ids?: number[];
    }>;
};

type TmdbCreditsResponse = {
    crew: Array<{
        job?: string;
        name?: string;
    }>;
};

export async function fetchTmdbGenres(): Promise<Genre[]> {
    const { genres } = await tmdbFetch<TmdbGenreResponse>("/genre/movie/list");
    return genres.map((genre, index) => ({
        id: genre.id ?? index + 1,
        slug: toSlug(genre.name),
        name: genre.name,
    }));
}

async function fetchTmdbDirector(movieId: number): Promise<string> {
    try {
        const credits = await tmdbFetch<TmdbCreditsResponse>(
            `/movie/${movieId}/credits`
        );
        return (
            credits.crew.find((person) => person.job === "Director")?.name ??
            "미상"
        );
    } catch {
        return "미상";
    }
}

export async function fetchTmdbMovies(limit = 20): Promise<Movie[]> {
    const trending = await tmdbFetch<TmdbTrendingResponse>(
        "/trending/movie/week"
    );
    const sliced = trending.results.slice(0, limit);

    const movies = await Promise.all(
        sliced.map(async (item) => {
            const director = await fetchTmdbDirector(item.id);
            return {
                id: item.id,
                title: item.title ?? item.original_title ?? "제목 미상",
                year: item.release_date
                    ? Number(item.release_date.slice(0, 4))
                    : new Date().getFullYear(),
                genres: (item.genre_ids ?? []).map((id) => String(id)),
                posterUrl: item.poster_path
                    ? `${TMDB_IMAGE_BASE}${item.poster_path}`
                    : undefined,
                director,
                overview: item.overview,
                releaseDate: item.release_date,
                status: "Released",
                avgRating:
                    typeof item.vote_average === "number"
                        ? Number(item.vote_average.toFixed(1))
                        : undefined,
                voteCount: item.vote_count,
                streamingPlatforms: [],
            } satisfies Movie;
        })
    );

    return movies;
}
