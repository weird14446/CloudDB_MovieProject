// src/types.ts

export type User = {
    id?: number;
    name: string;
    email: string;
};

export type Genre = {
    id: number;
    slug: string;
    name: string;
};

export type CastMember = {
    id: number;
    name: string;
    character?: string;
    profileUrl?: string | null;
};

// 스트리밍 플랫폼 타입 (필터에 사용)
export type StreamingPlatform =
    | "Netflix"
    | "Disney+"
    | "Amazon Prime Video"
    | "Apple TV+"
    | "Wavve"
    | "티빙"
    | "기타";

export type Movie = {
    id: number;
    title: string;
    year: number;
    genres: string[];
    posterUrl?: string;
    director: string;
    ageRating?: string;

    // 상세 정보용 (있으면 보여주고, 없으면 "정보 없음" 처리)
    overview?: string;
    releaseDate?: string; // "2020-07-15" 이런 형식
    status?: string; // "Released" 등
    budget?: number; // 제작비
    revenue?: number; // 수익
    runtimeMinutes?: number; // 상영 시간(분)

    // 트레일러 정보 (예: YouTube)
    trailerKey?: string; // 영상 ID
    trailerSite?: "YouTube" | "Vimeo";

    // 주요 출연진
    cast?: CastMember[];

    // 어떤 스트리밍 서비스에서 볼 수 있는지
    streamingPlatforms?: StreamingPlatform[];

    // 추천 알고리즘용 메타
    avgRating?: number; // 외부 평균 평점 (0~10 가정)
    voteCount?: number; // 평점 참여 수
    likeCount?: number; // 총 좋아요 수
};

export type Review = {
    id: number;
    movieId: number;
    userName: string;
    rating: number; // 1~10 정도
    content: string;
    createdAt: string; // ISO 문자열
};

export type DirectorScore = {
    director: string;
    score: number;
    likedCount: number;
    seenCount: number;
    avgQuality: number;
};
