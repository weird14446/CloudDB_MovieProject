// src/screens/MovieScreen.tsx

import React, { useMemo, useState } from "react";
import type {
    User,
    Genre,
    Movie,
    Review,
    StreamingPlatform,
} from "../types";
import type { AdminMovieInput } from "../api/adminService";
import AdminMoviePanel from "../components/AdminMoviePanel";
import { buildRecommendations } from "../utils/recommendations";

type MovieScreenProps = {
    user: User | null;
    genres: Genre[];
    selectedGenres: string[];
    movies: Movie[];
    likedMovieIds: number[];
    onToggleLike: (movieId: number) => void;
    onOpenLogin: () => void;
    onOpenGenres: () => void;
    onLogout: () => void;
    onOpenMovie: (movie: Movie) => void;
    reviewsByMovie: Record<number, Review[]>;
    isLoading: boolean;
    fetchError: string | null;
    onReloadData: () => void;
    isDevUser: boolean;
    onImportData: () => Promise<void>;
    isImportingData: boolean;
    onClearData: () => Promise<void>;
    isClearingData: boolean;
    onCreateMovie: (movie: AdminMovieInput) => Promise<boolean>;
    onUpdateMovie: (movieId: number, movie: AdminMovieInput) => Promise<boolean>;
    onDeleteMovie: (movieId: number) => Promise<boolean>;
    isCreatingMovie: boolean;
    isUpdatingMovie: boolean;
    isDeletingMovie: boolean;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: "all", label: "전체 상태" },
    { value: "Released", label: "개봉 완료" },
    { value: "In Production", label: "제작 중" },
    { value: "Post Production", label: "후반 작업 중" },
    { value: "Planned", label: "제작 예정" },
    { value: "Canceled", label: "제작 취소" },
];

const RATING_FILTER_OPTIONS: { value: string; label: string }[] = [
    { value: "all", label: "전체 평점" },
    { value: "9", label: "★ 9.0 이상" },
    { value: "8.5", label: "★ 8.5 이상" },
    { value: "8", label: "★ 8.0 이상" },
    { value: "7.5", label: "★ 7.5 이상" },
    { value: "7", label: "★ 7.0 이상" },
    { value: "6", label: "★ 6.0 이상" },
    { value: "5", label: "★ 5.0 이상" },
];

type RatingStatsSummary = {
    totalRatedMovies: number;
    overallAverage: number | null;
    bucketCounts: Array<{
        label: string;
        min: number;
        max: number;
        count: number;
        percentage: number;
    }>;
    topMovies: Array<{
        movie: Movie;
        rating: number;
    }>;
};

const MovieScreen: React.FC<MovieScreenProps> = ({
    user,
    genres,
    selectedGenres,
    movies,
    likedMovieIds,
    onToggleLike,
    onOpenLogin,
    onOpenGenres,
    onLogout,
    onOpenMovie,
    reviewsByMovie,
    isLoading,
    fetchError,
    onReloadData,
    isDevUser,
    onImportData,
    isImportingData,
    onClearData,
    isClearingData,
    onCreateMovie,
    onUpdateMovie,
    onDeleteMovie,
    isCreatingMovie,
    isUpdatingMovie,
    isDeletingMovie,
}) => {
    // 🔎 검색어
    const [searchQuery, setSearchQuery] = useState<string>("");

    // 좋아요 한 영화만 보기
    const [showLikedOnly, setShowLikedOnly] = useState<boolean>(false);
    const [showPopularOnly, setShowPopularOnly] = useState<boolean>(false);

    // 개봉 상태 필터
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // 평점 필터
    const [ratingFilter, setRatingFilter] = useState<string>("all");

    // 평점 통계 패널
    const [showRatingStats, setShowRatingStats] = useState<boolean>(false);

    // 스트리밍 서비스 필터
    const [platformFilter, setPlatformFilter] = useState<
        StreamingPlatform | "all"
    >("all");

    // 스트리밍 서비스 옵션 (데이터에서 자동 추출)
    const platformOptions = useMemo<StreamingPlatform[]>(() => {
        const set = new Set<StreamingPlatform>();
        movies.forEach((m) =>
            m.streamingPlatforms?.forEach((p) => set.add(p))
        );
        return Array.from(set).sort();
    }, [movies]);

    // 영화별 평균 평점(카드용)
    const avgRatingByMovie = useMemo(() => {
        const map: Record<number, number | null> = {};
        movies.forEach((m) => {
            const list = reviewsByMovie[m.id] ?? [];
            if (!list.length) {
                map[m.id] = null;
            } else {
                const avg =
                    list.reduce((s, r) => s + r.rating, 0) / list.length;
                map[m.id] = Math.round(avg * 10) / 10;
            }
        });
        return map;
    }, [movies, reviewsByMovie]);

    const displayRatingByMovie = useMemo(() => {
        const map: Record<number, number | null> = {};
        movies.forEach((movie) => {
            const userAvg = avgRatingByMovie[movie.id];
            if (userAvg != null) {
                map[movie.id] = userAvg;
            } else if (typeof movie.avgRating === "number") {
                map[movie.id] = movie.avgRating;
            } else {
                map[movie.id] = null;
            }
        });
        return map;
    }, [movies, avgRatingByMovie]);

    const { recommendedMovies, directorScores } = useMemo(
        () =>
            buildRecommendations({
                movies,
                likedMovieIds,
                reviewsByMovie,
                user,
                selectedGenres,
            }),
        [movies, likedMovieIds, reviewsByMovie, user, selectedGenres]
    );

    const topDirectors = directorScores.slice(0, 3);
    const hasPersonalizedRecommendations = directorScores.length > 0;
    const recommendationTitle = hasPersonalizedRecommendations ? "감독 기반 추천" : "지금 뜨는 영화";
    const recommendationSubtitle = hasPersonalizedRecommendations
        ? "평균 평점과 좋아요 신뢰도를 결합해 선호 감독 작품을 우선 정렬했어요."
        : user
            ? "좋아요나 리뷰를 남기면 감독 선호도를 분석해 맞춤 추천을 만들어요."
            : "로그인하고 좋아요를 누르면 감독 선호도를 분석해 드려요.";

    const popularMovieSet = useMemo(() => {
        const sorted = [...movies].sort((a, b) => {
            const voteDiff = (b.voteCount ?? 0) - (a.voteCount ?? 0);
            if (voteDiff !== 0) return voteDiff;
            return (b.avgRating ?? 0) - (a.avgRating ?? 0);
        });
        return new Set(sorted.slice(0, 20).map((movie) => movie.id));
    }, [movies]);

    const ratingStats = useMemo<RatingStatsSummary>(() => {
        const ratedEntries = movies
            .map((movie) => {
                const rating = displayRatingByMovie[movie.id];
                if (rating == null) return null;
                return { movie, rating };
            })
            .filter(
                (
                    entry
                ): entry is {
                    movie: Movie;
                    rating: number;
                } => entry !== null
            );

        const totalRatedMovies = ratedEntries.length;
        const overallAverage =
            totalRatedMovies > 0
                ? ratedEntries.reduce((sum, entry) => sum + entry.rating, 0) /
                totalRatedMovies
                : null;

        const bucketDefinitions = [
            { label: "★ 9.0 이상", min: 9, max: 11 },
            { label: "★ 8.0 ~ 8.9", min: 8, max: 9 },
            { label: "★ 7.0 ~ 7.9", min: 7, max: 8 },
            { label: "★ 6.0 ~ 6.9", min: 6, max: 7 },
            { label: "★ 5.0 ~ 5.9", min: 5, max: 6 },
            { label: "★ 5.0 미만", min: 0, max: 5 },
        ];

        const bucketCounts = bucketDefinitions.map((bucket) => {
            const count = ratedEntries.filter(
                (entry) =>
                    entry.rating >= bucket.min && entry.rating < bucket.max
            ).length;
            const percentage = totalRatedMovies
                ? (count / totalRatedMovies) * 100
                : 0;
            return {
                ...bucket,
                count,
                percentage,
            };
        });

        const topMovies = ratedEntries
            .slice()
            .sort((a, b) => {
                if (b.rating !== a.rating) {
                    return b.rating - a.rating;
                }
                const voteA = a.movie.voteCount ?? 0;
                const voteB = b.movie.voteCount ?? 0;
                return voteB - voteA;
            })
            .slice(0, 3);

        return {
            totalRatedMovies,
            overallAverage,
            bucketCounts,
            topMovies,
        } as RatingStatsSummary;
    }, [displayRatingByMovie, movies]);

    // 1) 선호 장르를 기준으로 우선 정렬
    const sortedMovies = useMemo(() => {
        if (selectedGenres.length === 0) return movies;

        const set = new Set(selectedGenres);

        return [...movies].sort((a, b) => {
            const aScore = a.genres.reduce(
                (acc, g) => acc + (set.has(g) ? 1 : 0),
                0
            );
            const bScore = b.genres.reduce(
                (acc, g) => acc + (set.has(g) ? 1 : 0),
                0
            );

            if (aScore !== bScore) {
                return bScore - aScore;
            }

            // 선호 점수가 같으면 최신 연도 우선
            return b.year - a.year;
        });
    }, [movies, selectedGenres]);

    // 2) 검색 + 좋아요 + 상태 + 플랫폼 필터 적용
    const visibleMovies = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();

        let list = sortedMovies;

        if (q) {
            list = list.filter((m) => {
                const inTitle = m.title.toLowerCase().includes(q);
                const inGenres = m.genres.some((g) =>
                    g.toLowerCase().includes(q)
                );
                const inYear = m.year.toString().includes(q);
                const inDirector = m.director?.toLowerCase().includes(q) ?? false;
                const inCast = (m.cast ?? []).some(
                    (member) =>
                        member.name.toLowerCase().includes(q) ||
                        (member.character?.toLowerCase().includes(q) ?? false)
                );
                return inTitle || inGenres || inYear || inDirector || inCast;
            });
        }

        if (showLikedOnly) {
            list = list.filter((m) => likedMovieIds.includes(m.id));
        }

        if (statusFilter !== "all") {
            list = list.filter((m) => m.status === statusFilter);
        }

        if (platformFilter !== "all") {
            list = list.filter((m) =>
                (m.streamingPlatforms ?? []).includes(platformFilter)
            );
        }

        if (showPopularOnly) {
            list = list.filter((m) => popularMovieSet.has(m.id));
        }

        if (ratingFilter !== "all") {
            const minRating = parseFloat(ratingFilter);
            list = list.filter((m) => {
                const ratingValue = displayRatingByMovie[m.id];
                return ratingValue != null && ratingValue >= minRating;
            });
        }

        return list;
    }, [
        sortedMovies,
        searchQuery,
        showLikedOnly,
        likedMovieIds,
        statusFilter,
        platformFilter,
        showPopularOnly,
        ratingFilter,
        displayRatingByMovie,
        popularMovieSet,
    ]);

    const labelSelected =
        selectedGenres.length > 0
            ? selectedGenres
                .map((s) => genres.find((g) => g.slug === s)?.name || s)
                .join(", ")
            : "전체";

    if (isLoading) {
        return (
            <div className="app app--dark">
                <div className="movie-state movie-state--loading">
                    <div className="movie-state__spinner" />
                    <p>데이터를 불러오는 중입니다...</p>
                </div>
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="app app--dark">
                <div className="movie-state movie-state--error">
                    <p>{fetchError}</p>
                    <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={onReloadData}
                    >
                        다시 시도
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="app app--dark">
            <main className="movie-main">
                {/* ✅ 상단 고정 영역(로고 + 로그인/로그아웃 + 검색/선호 장르) */}
                <div className="movie-main__sticky">
                    {/* 상단 바: 로고 + 우측 액션 */}
                    <header className="movie-main__top">
                        <div className="movie-main__brand">
                            <div className="topbar-logo__mark">F</div>
                            <div>
                                <div className="topbar-logo__title">FilmNavi</div>
                                <div className="topbar-logo__subtitle">
                                    {user
                                        ? `${user.name}님을 위한 영화 추천`
                                        : "로그인 없이 둘러보고, 원하면 취향 설정하기"}
                                </div>
                            </div>
                        </div>

                        <div className="movie-main__top-right">
                            <button
                                className="btn btn--ghost btn--sm"
                                onClick={onOpenGenres}
                            >
                                선호 장르 선택
                            </button>
                            <button
                                className="btn btn--ghost btn--sm"
                                onClick={() => setShowRatingStats(true)}
                            >
                                평점 통계
                            </button>
                            {isDevUser && (
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                        className="btn btn--primary btn--sm"
                                        onClick={() => void onImportData()}
                                        disabled={isImportingData || isClearingData}
                                        style={{ minWidth: 120 }}
                                    >
                                        {isImportingData ? "데이터 불러오는 중..." : "데이터 불러오기"}
                                    </button>
                                    <button
                                        className="btn btn--ghost btn--sm"
                                        style={{ minWidth: 120, color: "#f87171" }}
                                        onClick={() => void onClearData()}
                                        disabled={isClearingData || isImportingData}
                                    >
                                        {isClearingData ? "데이터 비우는 중..." : "데이터 비우기"}
                                    </button>
                                </div>
                            )}

                            {user ? (
                                <>
                                    <div className="user-chip">
                                        <div className="user-chip__name">{user.name}</div>
                                        <div className="user-chip__email">
                                            {user.email}
                                        </div>
                                    </div>
                                    <button
                                        className="btn btn--ghost btn--sm"
                                        onClick={onLogout}
                                    >
                                        로그아웃
                                    </button>
                                </>
                            ) : (
                                <button
                                    className="btn btn--ghost btn--sm"
                                    onClick={onOpenLogin}
                                >
                                    로그인
                                </button>
                            )}
                        </div>
                    </header>

                    {/* 선택한 장르 + 검색 + 개수 + 필터들 */}
                    <div className="movie-main__header">
                        <div>
                            <div className="badge">Movies</div>
                            <h2 className="card-title">
                                선택한 장르:{" "}
                                <span className="accent">{labelSelected}</span>
                            </h2>
                            <p className="card-subtitle">
                                선호 장르를 설정하면 관련도가 높은 영화가 위에 정렬됩니다.
                                (설정하지 않으면 전체 리스트가 노출됩니다.)
                            </p>

                            <div className="movie-main__toggles">
                                <label className="movie-main__toggle">
                                    <input
                                        type="checkbox"
                                        checked={showLikedOnly}
                                        onChange={(e) =>
                                            setShowLikedOnly(e.target.checked)
                                        }
                                    />
                                    <span>좋아요한 영화만 보기</span>
                                </label>
                                <label className="movie-main__toggle">
                                    <input
                                        type="checkbox"
                                        checked={showPopularOnly}
                                        onChange={(e) =>
                                            setShowPopularOnly(e.target.checked)
                                        }
                                    />
                                    <span>인기 영화만 보기</span>
                                </label>
                            </div>
                        </div>

                        {/* 오른쪽: 총 개수 + 검색창 + 상태/플랫폼 필터 */}
                        <div className="movie-main__header-right">
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                    width: "100%",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 8,
                                    }}
                                >
                                    <div className="pill pill--outline">
                                        총 <strong>{visibleMovies.length}</strong> 편
                                    </div>

                                    <select
                                        className="form-input"
                                        style={{ maxWidth: 180 }}
                                        value={statusFilter}
                                        onChange={(e) =>
                                            setStatusFilter(e.target.value)
                                        }
                                    >
                                        {STATUS_OPTIONS.map((opt) => (
                                            <option
                                                key={opt.value}
                                                value={opt.value}
                                            >
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        className="form-input"
                                        style={{ maxWidth: 200 }}
                                        value={platformFilter}
                                        onChange={(e) =>
                                            setPlatformFilter(
                                                e.target
                                                    .value as StreamingPlatform | "all"
                                            )
                                        }
                                    >
                                        <option value="all">
                                            모든 스트리밍 서비스
                                        </option>
                                        {platformOptions.map((p) => (
                                            <option key={p} value={p}>
                                                {p}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        className="form-input"
                                        style={{ maxWidth: 160 }}
                                        value={ratingFilter}
                                        onChange={(e) => setRatingFilter(e.target.value)}
                                    >
                                        {RATING_FILTER_OPTIONS.map((opt) => (
                                            <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <input
                                    className="form-input movie-main__search"
                                    placeholder="제목 / 장르 / 연도 검색"
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                />
                            </div>
                        </div>
                </div>
            </div>

            {isDevUser && (
                <AdminMoviePanel
                    genres={genres}
                    movies={movies}
                    onCreateMovie={onCreateMovie}
                    onUpdateMovie={onUpdateMovie}
                    onDeleteMovie={onDeleteMovie}
                    isCreating={isCreatingMovie}
                    isUpdating={isUpdatingMovie}
                    isDeleting={isDeletingMovie}
                />
            )}

            {recommendedMovies.length > 0 && (
                <section className="movie-reco">
                        <div className="movie-reco__header">
                            <div>
                                <div className="badge">Recommendations</div>
                                <h2 className="card-title">{recommendationTitle}</h2>
                                <p className="card-subtitle">{recommendationSubtitle}</p>
                            </div>

                            {hasPersonalizedRecommendations && topDirectors[0] ? (
                                <div className="movie-reco__director">
                                    <span className="pill pill--outline">
                                        선호 감독 ·{" "}
                                        <strong>{topDirectors[0].director}</strong>
                                    </span>
                                    <span className="pill pill--soft">
                                        좋아요 {topDirectors[0].likedCount}편 · 평균 ★{" "}
                                        {topDirectors[0].avgQuality.toFixed(1)}
                                    </span>
                                </div>
                            ) : (
                                <div className="pill pill--outline movie-reco__hint">
                                    {user
                                        ? "좋아요나 리뷰를 남길수록 추천 정확도가 높아집니다."
                                        : "로그인하고 좋아요를 누르면 개인화 추천이 시작됩니다."}
                                </div>
                            )}
                        </div>

                        {hasPersonalizedRecommendations && topDirectors.length > 1 && (
                            <div className="movie-reco__directors">
                                {topDirectors.map((director) => (
                                    <span key={director.director} className="pill pill--soft">
                                        {director.director} · 점수 {director.score.toFixed(2)}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="movie-reco__list">
                            {recommendedMovies.map((movie) => {
                                const liked = likedMovieIds.includes(movie.id);
                                const ratingValue = displayRatingByMovie[movie.id];
                                const avgLabel =
                                    ratingValue != null ? ratingValue.toFixed(1) : "-";

                                return (
                                    <button
                                        key={movie.id}
                                        type="button"
                                        className="movie-reco-card"
                                        onClick={() => onOpenMovie(movie)}
                                    >
                                        <div
                                            className="movie-reco-card__poster"
                                            style={
                                                movie.posterUrl
                                                    ? {
                                                          backgroundImage: `url(${movie.posterUrl})`,
                                                      }
                                                    : undefined
                                            }
                                        >
                                            {!movie.posterUrl && (
                                                <div className="movie-card__noimg">No Image</div>
                                            )}
                                        </div>
                                        <div className="movie-reco-card__body">
                                            <span className="movie-reco-card__meta">
                                                {movie.director} · {movie.year}
                                            </span>
                                            <h3 className="movie-reco-card__title">
                                                {movie.title}
                                            </h3>
                                            <div className="movie-reco-card__genres">
                                                {movie.genres.slice(0, 2).map((genre) => (
                                                    <span key={genre}>{genre.toUpperCase()}</span>
                                                ))}
                                            </div>
                                            <div className="movie-reco-card__tags">
                                                <span className="pill pill--soft">
                                                    ★ {avgLabel}
                                                </span>
                                                {liked && (
                                                    <span className="pill pill--outline">
                                                        ♥ 좋아요
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ✅ 정렬 + 검색 + 필터가 적용된 영화 리스트 */}
                <section className="movie-grid">
                    {visibleMovies.map((m) => {
                        const liked = likedMovieIds.includes(m.id);
                        const cardRating = displayRatingByMovie[m.id];

                        return (
                            <article
                                key={m.id}
                                className="movie-card movie-card--compact"
                            >
                                <button
                                    type="button"
                                    className="movie-card__clickable"
                                    onClick={() => onOpenMovie(m)}
                                >
                                    <div
                                        className="movie-card__poster"
                                        style={{ position: "relative" }}
                                    >
                                        {/* 평점 평균 (좌측 상단) */}
                                        <div
                                            style={{
                                                position: "absolute",
                                                left: 8,
                                                top: 8,
                                            }}
                                        >
                                            <div className="pill pill--soft">
                                                {cardRating != null
                                                    ? `★ ${cardRating.toFixed(1)}`
                                                    : "★ -"}
                                            </div>
                                        </div>

                                        {/* 좋아요 (우측 상단) */}
                                        <button
                                            type="button"
                                            className={
                                                "movie-card__like-btn" +
                                                (liked ? " movie-card__like-btn--active" : "")
                                            }
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!user) {
                                                    alert("좋아요는 로그인 후 이용 가능합니다.");
                                                    return;
                                                }
                                                onToggleLike(m.id);
                                            }}
                                        >
                                            {liked ? "♥" : "♡"}
                                        </button>


                                        {m.posterUrl ? (
                                            <img src={m.posterUrl} alt={m.title} />
                                        ) : (
                                            <div className="movie-card__noimg">
                                                No Image
                                            </div>
                                        )}
                                    </div>

                                    <div className="movie-card__body">
                                        <h3 className="movie-card__title">
                                            {m.title}
                                        </h3>
                                        <p className="movie-card__year">{m.year}</p>
                                        <div className="movie-card__genres">
                                            {m.genres.map((g) => (
                                                <span
                                                    key={g}
                                                    className="pill pill--soft"
                                                >
                                                    {g.toUpperCase()}
                                                </span>
                                            ))}
                                        </div>
                                        {m.ageRating && (
                                            <div className="movie-card__age">
                                                <span className="pill pill--outline">
                                                    {m.ageRating}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            </article>
                        );
                    })}

                    {visibleMovies.length === 0 && (
                        <div className="movie-empty">
                            검색/필터 조건에 해당하는 영화가 없습니다.
                        </div>
                    )}
                </section>
            </main>
            <RatingStatsPanel
                open={showRatingStats}
                onClose={() => setShowRatingStats(false)}
                stats={ratingStats}
            />
        </div>
    );
};

export default MovieScreen;

type RatingStatsPanelProps = {
    open: boolean;
    onClose: () => void;
    stats: RatingStatsSummary;
};

const RatingStatsPanel: React.FC<RatingStatsPanelProps> = ({
    open,
    onClose,
    stats,
}) => {
    if (!open) return null;

    return (
        <>
            <div className="rating-stats-backdrop" onClick={onClose} />
            <aside className="rating-stats-panel">
                <div className="rating-stats-panel__header">
                    <div>
                        <div className="badge">Insights</div>
                        <h3>평점 통계</h3>
                        <p>현재 데이터에 기반한 평균 평점과 분포를 확인하세요.</p>
                    </div>
                    <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>

                <div className="rating-stats-panel__grid">
                    <div className="rating-stats-card">
                        <p className="rating-stats-card__label">전체 평균</p>
                        <strong className="rating-stats-card__value">
                            {stats.overallAverage != null
                                ? stats.overallAverage.toFixed(1)
                                : "-"}
                        </strong>
                        <span className="rating-stats-card__hint">
                            평가된 영화 {stats.totalRatedMovies}편
                        </span>
                    </div>
                    <div className="rating-stats-card">
                        <p className="rating-stats-card__label">상위 평점</p>
                        <div className="rating-stats-toplist">
                            {stats.topMovies.length === 0 && (
                                <span className="rating-stats-card__hint">
                                    아직 평점 데이터가 없습니다.
                                </span>
                            )}
                            {stats.topMovies.map(({ movie, rating }) => (
                                <div key={movie.id} className="rating-stats-topitem">
                                    <strong>{movie.title}</strong>
                                    <span>★ {rating.toFixed(1)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="rating-stats-distribution">
                    <h4>평점 분포</h4>
                    <ul>
                        {stats.bucketCounts.map((bucket) => (
                            <li key={bucket.label}>
                                <div className="rating-stats-distribution__label">
                                    {bucket.label}
                                    <span>{bucket.count}편</span>
                                </div>
                                <div className="rating-stats-distribution__bar">
                                    <div
                                        style={{
                                            width: `${bucket.percentage}%`,
                                        }}
                                    />
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </aside>
        </>
    );
};
