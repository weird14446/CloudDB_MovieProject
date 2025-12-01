import { corsJson, corsEmpty } from "@/lib/cors";
import { withConnection } from "@/lib/db";
import { recommendationModel } from "@/lib/integrated-model";
import type { Movie, Review } from "@/lib/types";
import type { RowDataPacket } from "mysql2";

type RecommendationRequestBody = {
  userId?: number;
  topK?: number;
};

type DbMovieRow = {
  id: number;
  title: string;
  genres_str: string | null;
  director_name: string | null;
  cast_ids: string | null;
};

type DbReviewRow = {
  user_id: number;
  movie_id: number;
  rating: number;
};

type DbLikeRow = {
  user_id: number;
  movie_id: number;
};

function mapRowsToMovies(rows: DbMovieRow[]): Movie[] {
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    year: 0, // 통합 모델은 연도를 사용하지 않음
    director: row.director_name ?? "미상",
    genres: row.genres_str ? row.genres_str.split(",") : [],
    cast: row.cast_ids
      ? row.cast_ids.split(",").map((id) => ({ id: Number(id), name: "" }))
      : [],
  }));
}

export async function POST(request: Request) {
  let body: RecommendationRequestBody = {};
  try {
    body = (await request.json()) ?? {};
  } catch {
    body = {};
  }

  const userId = typeof body.userId === "number" ? body.userId : null;
  const topK = typeof body.topK === "number" && Number.isFinite(body.topK) ? body.topK : 6;

  try {
    const result = await withConnection(async (conn) => {
      // 1) 영화 메타데이터
      const [movieRows] = await conn.query<(DbMovieRow & RowDataPacket)[]>(`
        SELECT m.id, m.title,
               (SELECT GROUP_CONCAT(g.name SEPARATOR ',')
                FROM movie_genres mg
                JOIN genres g ON mg.genre_id = g.id
                WHERE mg.movie_id = m.id) AS genres_str,
               (SELECT p.name
                FROM movie_directors md
                JOIN people p ON md.person_id = p.id
                WHERE md.movie_id = m.id
                LIMIT 1) AS director_name,
               (SELECT GROUP_CONCAT(person_id SEPARATOR ',')
                FROM movie_cast mc
                WHERE mc.movie_id = m.id
                ORDER BY cast_order
                LIMIT 3) AS cast_ids
        FROM movies m
        ORDER BY m.id DESC
        LIMIT 400
      `);
      const movies = mapRowsToMovies(movieRows);

      // 2) 평점(명시적 피드백)
      const [reviewRows] = await conn.query<(DbReviewRow & RowDataPacket)[]>(`
        SELECT user_id, movie_id, rating
        FROM reviews
        WHERE status = 'active'
      `);
      const reviews: Review[] = reviewRows.map((r) => ({
        id: 0,
        movieId: r.movie_id,
        userId: r.user_id,
        rating: r.rating,
        userName: "",
        content: "",
        createdAt: "",
      }));

      // 3) 좋아요(암묵적 피드백)
      const [likeRows] = await conn.query<(DbLikeRow & RowDataPacket)[]>(`
        SELECT user_id, movie_id FROM likes
      `);
      const likes = likeRows.map((l) => ({
        userId: l.user_id,
        movieId: l.movie_id,
      }));

      // 4) 모델 초기화 및 학습 (데모: 요청마다 수행)
      recommendationModel.initialize(movies, reviews, likes);
      recommendationModel.train(reviews);

      // 5) 예측
      const scores: { movieId: number; score: number }[] = [];
      const seen = new Set<number>();
      if (userId) {
        reviews.filter((r) => r.userId === userId).forEach((r) => seen.add(r.movieId));
        likes.filter((l) => l.userId === userId).forEach((l) => seen.add(l.movieId));
      }

      for (const movie of movies) {
        if (userId && seen.has(movie.id)) continue; // 이미 본 영화 제외
        const score = recommendationModel.predict(userId ?? -1, movie.id);
        scores.push({ movieId: movie.id, score });
      }

      scores.sort((a, b) => b.score - a.score);
      const topScores = scores.slice(0, Math.max(1, topK));

      // 디버그용 로그: 예측 결과
      console.log("[recommendations] predict", {
        userId: userId ?? null,
        candidates: scores.length,
        topK: topScores.length,
        samples: topScores.slice(0, 6), // 상위 일부만 출력
      });

      return topScores;
    });

    return corsJson({
      ok: true,
      recommendations: result,
      directorScores: [],
    });
  } catch (error) {
    console.error("[recommendations] error", error);
    return corsJson(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "추천 정보를 계산하지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return corsEmpty();
}
