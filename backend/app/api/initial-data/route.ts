import { getPool } from "@/lib/db";
import { mapMovies } from "@/lib/formatters";
import { corsJson, corsEmpty } from "@/lib/cors";
import type { Genre, Review, CastMember } from "@/lib/types";

type ReviewRow = {
  id: number;
  movie_id: number;
  user_name: string;
  rating: number;
  content: string;
  created_at: Date;
};

export async function GET() {
  const pool = getPool();

  try {
    const [movieRows] = await pool.query<any[]>(`
      SELECT m.*, d.name AS director_name, s.avg_rating, s.vote_count, s.weighted_rating
      FROM movies m
      LEFT JOIN directors d ON d.id = m.director_id
      LEFT JOIN movie_rating_stats s ON s.movie_id = m.id
      ORDER BY m.year DESC, m.id DESC
      LIMIT 200
    `);

    const [genreRows] = await pool.query<{ id: number; name: string }[]>(
      "SELECT id, name FROM genres ORDER BY id ASC"
    );

    const toSlug = (name: string) =>
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, "")
        .replace(/\s+/g, "-") || String(name);

    const normalizedGenres: Genre[] = genreRows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: toSlug(row.name),
    }));

    const movieIds = movieRows.map((row) => row.id);

    const movieGenresRows =
      movieIds.length > 0
        ? await pool
            .query<{ movie_id: number; name: string }[]>(
              `
        SELECT mg.movie_id, g.name
        FROM movie_genres mg
        JOIN genres g ON g.id = mg.genre_id
        WHERE mg.movie_id IN (?)
      `,
              [movieIds]
            )
            .then(([rows]) => rows)
        : [];

    const moviePlatformsRows =
      movieIds.length > 0
        ? await pool.query<{ movie_id: number; name: string }[]>(
            `
        SELECT msp.movie_id, sp.name
        FROM movie_streaming_platforms msp
        JOIN streaming_platforms sp ON sp.id = msp.platform_id
        WHERE msp.movie_id IN (?)
      `,
            [movieIds]
          ).then(([rows]) => rows)
        : [];

    const movieCastRows =
      movieIds.length > 0
        ? await pool
            .query<{
              movie_id: number;
              person_id: number;
              cast_name: string;
              character_name: string | null;
              profile_url: string | null;
              cast_order: number | null;
            }[]>(
              `
        SELECT mc.movie_id,
               p.id AS person_id,
               p.name AS cast_name,
               mc.character_name,
               p.profile_url,
               mc.cast_order
        FROM movie_cast mc
        JOIN people p ON p.id = mc.person_id
        WHERE mc.movie_id IN (?)
        ORDER BY mc.movie_id ASC, mc.cast_order ASC
      `,
              [movieIds]
            )
            .then(([rows]) => rows)
        : [];

    const reviewRows =
      movieIds.length > 0
        ? await pool
            .query<ReviewRow[]>(
              `
        SELECT r.id,
               r.movie_id,
               u.name AS user_name,
               r.rating,
               r.content,
               r.created_at
        FROM reviews r
        JOIN users u ON u.id = r.user_id
        WHERE r.status = 'active' AND r.movie_id IN (?)
        ORDER BY r.created_at DESC
      `,
              [movieIds]
            )
            .then(([rows]) => rows)
        : [];

    const genresByMovie = movieGenresRows.reduce<Record<number, string[]>>( 
      (acc, row) => {
        const list = acc[row.movie_id] ?? [];
        list.push(toSlug(row.name));
        acc[row.movie_id] = list;
        return acc;
      },
      {}
    );

    const platformsByMovie = moviePlatformsRows.reduce<Record<number, string[]>>(
      (acc, row) => {
        const list = acc[row.movie_id] ?? [];
        list.push(row.name);
        acc[row.movie_id] = list;
        return acc;
      },
      {}
    );

    const castByMovie = movieCastRows.reduce<Record<number, CastMember[]>>(
      (acc, row) => {
        const list = acc[row.movie_id] ?? [];
        list.push({
          id: row.person_id,
          name: row.cast_name,
          character: row.character_name ?? undefined,
          profileUrl: row.profile_url ?? undefined,
        });
        acc[row.movie_id] = list;
        return acc;
      },
      {}
    );

    const formattedMovies = mapMovies(
      movieRows,
      genresByMovie,
      platformsByMovie,
      castByMovie
    );
    const reviewsByMovie = reviewRows.reduce<Record<number, Review[]>>((acc, row) => {
      const list = acc[row.movie_id] ?? [];
      list.push({
        id: row.id,
        movieId: row.movie_id,
        userName: row.user_name,
        rating: row.rating,
        content: row.content,
        createdAt: row.created_at.toISOString(),
      });
      acc[row.movie_id] = list;
      return acc;
    }, {});

        return corsJson({
      movies: formattedMovies,
      genres: normalizedGenres,
      reviewsByMovie,
    });
  } catch (error) {
    console.error("[initial-data] error", error);
    return corsJson(
      {
        message: error instanceof Error ? error.message : "초기 데이터를 불러오지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return corsEmpty();
}
