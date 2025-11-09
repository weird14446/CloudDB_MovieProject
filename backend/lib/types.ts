export type Review = {
  id: number;
  movieId: number;
  userName: string;
  rating: number;
  content: string;
  createdAt: string;
};

export type Movie = {
  id: number;
  tmdbId?: number | null;
  title: string;
  year: number;
  genres: string[];
  director: string;
  cast?: CastMember[];
  posterUrl?: string;
  overview?: string;
  releaseDate?: string;
  status?: string;
  budget?: number;
  revenue?: number;
  runtimeMinutes?: number;
  trailerKey?: string;
  trailerSite?: "YouTube" | "Vimeo";
  streamingPlatforms?: string[];
  ageRating?: string;
  avgRating?: number;
  voteCount?: number;
  likeCount?: number;
};

export type CastMember = {
  id: number;
  name: string;
  character?: string;
  profileUrl?: string | null;
};

export type Genre = {
  id: number;
  slug: string;
  name: string;
};
