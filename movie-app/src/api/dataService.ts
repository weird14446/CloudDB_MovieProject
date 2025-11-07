import { apiRequest } from "./client";
import type { Genre, Movie, Review } from "../types";

type InitialDataResponse = {
    genres?: Genre[];
    movies?: Movie[];
    reviews?: Review[];
    reviewsByMovie?: Record<number, Review[]>;
};

function groupReviewsByMovie(reviews: Review[] = []): Record<number, Review[]> {
    return reviews.reduce<Record<number, Review[]>>((acc, review) => {
        const list = acc[review.movieId] ?? [];
        list.push(review);
        acc[review.movieId] = list;
        return acc;
    }, {});
}

export async function fetchInitialData(): Promise<{
    genres: Genre[];
    movies: Movie[];
    reviewsByMovie: Record<number, Review[]>;
}> {
    const response = await apiRequest<InitialDataResponse>("/initial-data");
    if (!response.movies || !response.genres) {
        throw new Error("데이터베이스에서 영화를 불러오지 못했습니다.");
    }
    return {
        genres: response.genres,
        movies: response.movies,
        reviewsByMovie:
            response.reviewsByMovie ??
            groupReviewsByMovie(response.reviews ?? []),
    };
}
