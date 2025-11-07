import type { Movie } from "./types";

const TMDB_API_BASE = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const DEFAULT_LANGUAGE = "ko-KR";

function ensureApiKey(): string {
    const key = process.env.TMDB_API_KEY;
    if (!key) {
        throw new Error("TMDB_API_KEY 환경 변수가 설정되어 있지 않습니다.");
    }
    return key;
}

async function tmdbFetch<T>(
    path: string,
    params: Record<string, string | number> = {}
): Promise<T> {
    const key = ensureApiKey();
    const url = new URL(`${TMDB_API_BASE}${path}`);
    url.searchParams.set("api_key", key);
    url.searchParams.set("language", DEFAULT_LANGUAGE);
    Object.entries(params).forEach(([k, v]) =>
        url.searchParams.set(k, String(v))
    );

    const response = await fetch(url.toString());
    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(body || `TMDB 요청 실패 (${response.status})`);
    }
    return (await response.json()) as T;
}

type TrendingResponse = {
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

type GenreResponse = {
    genres: Array<{ id: number; name: string }>;
};

type MovieDetailResponse = {
    release_date?: string;
    runtime: number | null;
    status: string | null;
    budget: number | null;
    revenue: number | null;
    release_dates?: {
        results?: Array<{
            iso_3166_1?: string;
            release_dates?: Array<{ certification?: string | null }>;
        }>;
    };
    "watch/providers"?: {
        results?: Record<
            string,
            {
                flatrate?: Array<{ provider_name?: string | null }>;
                rent?: Array<{ provider_name?: string | null }>;
                buy?: Array<{ provider_name?: string | null }>;
            }
        >;
    };
    credits?: {
        crew?: Array<{ job?: string; name?: string }>;
    };
    videos?: {
        results?: Array<{
            key?: string;
            site?: string;
            type?: string;
            official?: boolean;
        }>;
    };
};

function toSlug(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, "")
        .replace(/\s+/g, "-");
}

function extractCertification(detail?: MovieDetailResponse): string | undefined {
    const entries = detail?.release_dates?.results ?? [];
    const preferred = ["KR", "US"];
    for (const country of preferred) {
        const found = entries.find(
            (entry) => entry.iso_3166_1 === country && entry.release_dates?.length
        );
        if (found) {
            const certification = found.release_dates?.find(
                (r) => (r.certification ?? "").trim().length > 0
            )?.certification;
            if (certification) return certification;
        }
    }
    const fallback = entries.find((entry) => entry.release_dates?.length)?.release_dates?.find(
        (r) => (r.certification ?? "").trim().length > 0
    )?.certification;
    return fallback ?? undefined;
}

function extractPlatforms(detail?: MovieDetailResponse): string[] {
    const results = detail?.["watch/providers"]?.results;
    if (!results) return [];
    const region = results["KR"] ?? results["US"];
    if (!region) return [];
    const candidates = region.flatrate ?? region.rent ?? region.buy ?? [];
    const names = candidates
        .map((p) => p.provider_name)
        .filter((name): name is string => Boolean(name));
    return Array.from(new Set(names));
}

function extractDirector(detail?: MovieDetailResponse): string {
    return (
        detail?.credits?.crew?.find((person) => person.job === "Director")
            ?.name ?? "미상"
    );
}

function extractTrailerKey(detail?: MovieDetailResponse):
    | { site: "YouTube"; key: string }
    | undefined {
    const videos = detail?.videos?.results ?? [];
    const trailer =
        videos.find(
            (video) =>
                video.site === "YouTube" &&
                video.type?.toLowerCase().includes("trailer") &&
                video.official
        ) ??
        videos.find(
            (video) =>
                video.site === "YouTube" &&
                video.type?.toLowerCase().includes("trailer")
        );
    if (trailer?.key) {
        return { site: "YouTube", key: trailer.key };
    }
    return undefined;
}

export async function fetchTmdbMoviesAndGenres(limit = 20): Promise<{
    movies: Movie[];
}> {
    const { genres } = await tmdbFetch<GenreResponse>("/genre/movie/list");
    const trending = await tmdbFetch<TrendingResponse>("/trending/movie/week");
    const genreMap = new Map<number, string>(
        genres.map((g) => [g.id, toSlug(g.name)])
    );

    const targets = trending.results.slice(0, limit);
    const details = await Promise.all(
        targets.map((item) =>
            tmdbFetch<MovieDetailResponse>(`/movie/${item.id}`, {
                append_to_response: "release_dates,watch/providers,credits,videos",
            })
        )
    );

    const movies: Movie[] = targets.map((item, idx) => {
        const detail = details[idx];
        const director = extractDirector(detail);
        const trailer = extractTrailerKey(detail);
        const certification = extractCertification(detail);
        const platforms = extractPlatforms(detail);
        const releaseDate = item.release_date ?? detail.release_date ?? undefined;
        const year = releaseDate
            ? Number(releaseDate.slice(0, 4))
            : new Date().getFullYear();

        return {
            id: item.id,
            tmdbId: item.id,
            title: item.title ?? item.original_title ?? "제목 미상",
            year,
            overview: item.overview ?? undefined,
            posterUrl: item.poster_path
                ? `${TMDB_IMAGE_BASE}${item.poster_path}`
                : undefined,
            releaseDate,
            status: detail.status ?? "Released",
            director,
            genres: (item.genre_ids ?? []).map(
                (id) => genreMap.get(id) ?? "기타"
            ),
            avgRating:
                typeof item.vote_average === "number"
                    ? Number(item.vote_average.toFixed(1))
                    : undefined,
            voteCount: item.vote_count ?? undefined,
            streamingPlatforms: platforms,
            runtimeMinutes: detail.runtime ?? undefined,
            budget: detail.budget ?? undefined,
            revenue: detail.revenue ?? undefined,
            trailerSite: trailer?.site,
            trailerKey: trailer?.key,
            ageRating: certification ?? undefined,
        };
    });

    return { movies };
}
