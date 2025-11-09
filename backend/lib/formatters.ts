import type { Movie, CastMember } from "./types";

type RawMovieRow = {
    id: number;
    tmdb_id: number | null;
    title: string;
    year: number;
    overview: string | null;
    poster_url: string | null;
    release_date: string | null;
    status: string | null;
    budget: number | null;
    revenue: number | null;
    runtime_minutes: number | null;
    trailer_site: string | null;
    trailer_key: string | null;
    age_rating: string | null;
    avg_rating: number | null;
    vote_count: number | null;
    weighted_rating: number | null;
    director_name: string | null;
    like_count?: number | null;
};

export function mapMovies(
    rows: RawMovieRow[],
    genresByMovie: Record<number, string[]>,
    platformsByMovie: Record<number, string[]>,
    castByMovie: Record<number, CastMember[]> = {}
): Movie[] {
    return rows.map((row) => ({
        id: row.id,
        tmdbId: row.tmdb_id ?? undefined,
        title: row.title,
        year: row.year,
        overview: row.overview ?? undefined,
        posterUrl: row.poster_url ?? undefined,
        releaseDate: row.release_date ?? undefined,
        status: row.status ?? undefined,
        budget: row.budget ?? undefined,
        revenue: row.revenue ?? undefined,
        runtimeMinutes: row.runtime_minutes ?? undefined,
        trailerKey: row.trailer_key ?? undefined,
        trailerSite: row.trailer_site as Movie["trailerSite"],
        ageRating: row.age_rating ?? undefined,
        avgRating: row.weighted_rating ?? row.avg_rating ?? undefined,
        voteCount: row.vote_count ?? undefined,
        likeCount: row.like_count ?? 0,
        director: row.director_name ?? "미상",
        genres: genresByMovie[row.id] ?? [],
        streamingPlatforms: platformsByMovie[row.id] ?? [],
        cast: castByMovie[row.id] ?? [],
    }));
}
