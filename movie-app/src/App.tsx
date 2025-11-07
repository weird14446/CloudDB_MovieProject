// src/App.tsx

import React, { useCallback, useEffect, useState } from "react";
import "./App.css";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import GenreScreen from "./screens/GenreScreen";
import MovieScreen from "./screens/MovieScreen";
import MovieDetailModal from "./components/MovieDetailModal";
import type { User, Genre, Movie, Review } from "./types";
import { fetchInitialData } from "./api/dataService";
import { checkDbHealth } from "./api/health";
import { fetchAndImportMoviesFromApi, clearDatabase } from "./api/adminService";
import { createReview } from "./api/reviewService";
import { fetchLikes, toggleLike } from "./api/likeService";

type ReviewsByMovie = Record<number, Review[]>;

function loadPreferredGenres(email: string): string[] {
    try {
        const raw = localStorage.getItem(`preferredGenres:${email}`);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((slug): slug is string => typeof slug === "string");
    } catch {
        return [];
    }
}

const DEV_EMAIL = "root@dev.local";

type AuthCallbackPayload = {
    name: string;
    email: string;
    password: string;
    userId?: number;
};

const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
    const [movies, setMovies] = useState<Movie[]>([]);
    const [genres, setGenres] = useState<Genre[]>([]);
    const [reviewsByMovie, setReviewsByMovie] = useState<ReviewsByMovie>({});
    const [reportedReviewsByMovie, setReportedReviewsByMovie] = useState<
        Record<number, number[]>
    >({});
    const [likedMovieIds, setLikedMovieIds] = useState<number[]>([]);
    const [showLogin, setShowLogin] = useState(false);
    const [showSignup, setShowSignup] = useState(false);
    const [showGenres, setShowGenres] = useState(false);
    const [activeMovie, setActiveMovie] = useState<Movie | null>(null);
    const [dataLoading, setDataLoading] = useState<boolean>(true);
    const [dataError, setDataError] = useState<string | null>(null);
    const [importingData, setImportingData] = useState<boolean>(false);
    const [clearingData, setClearingData] = useState<boolean>(false);

    const modalOpen =
        showLogin || showSignup || showGenres || activeMovie !== null;

    useEffect(() => {
        if (activeMovie) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
    }, [activeMovie]);

    const isDevUser = user?.email === DEV_EMAIL;

    useEffect(() => {
        checkDbHealth()
            .then((status) => {
                if (status.ok) {
                    console.log(
                        `[DB] 연결 성공: ${status.engine ?? "DB"} ${status.version ?? ""} (${status.time ?? ""})`
                    );
                } else {
                    console.warn(
                        `[DB] 연결 실패: ${status.error ?? "알 수 없는 오류"}`
                    );
                }
            })
            .catch((error) => {
                console.warn("[DB] 상태 확인 요청 실패:", error.message);
            });
    }, []);

    const loadInitialData = useCallback(async () => {
        setDataLoading(true);
        setDataError(null);
        try {
            const { genres, movies, reviewsByMovie } = await fetchInitialData();
            setGenres(genres);
            setMovies(movies);
            setReviewsByMovie(reviewsByMovie);
        } catch (error) {
            setDataError(
                error instanceof Error
                    ? error.message
                    : "데이터를 불러오지 못했습니다."
            );
        } finally {
            setDataLoading(false);
        }
    }, []);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    useEffect(() => {
        if (!genres.length) return;
        setSelectedGenres((prev) =>
            prev.filter((slug) => genres.some((g) => g.slug === slug))
        );
    }, [genres]);

    const fetchUserLikes = useCallback(async (userId: number) => {
        try {
            const response = await fetchLikes(userId);
            if (response.ok && response.likes) {
                setLikedMovieIds(response.likes);
            } else {
                setLikedMovieIds([]);
            }
        } catch (error) {
            console.warn("[Likes] 불러오기 실패:", error);
            setLikedMovieIds([]);
        }
    }, []);

    useEffect(() => {
        if (user?.id) {
            void fetchUserLikes(user.id);
        } else {
            setLikedMovieIds([]);
        }
    }, [user?.id, fetchUserLikes]);

    async function handleLogin(payload: AuthCallbackPayload): Promise<void> {
        const nextUser: User = {
            name: payload.name,
            email: payload.email,
            id: payload.userId,
        };
        setUser(nextUser);

        const savedGenres = loadPreferredGenres(payload.email);
        if (savedGenres.length) {
            setSelectedGenres(savedGenres);
        }

        setShowLogin(false);
        setShowSignup(false);
    }

    function handleSaveGenres(): void {
        if (user?.email) {
            try {
                localStorage.setItem(
                    `preferredGenres:${user.email}`,
                    JSON.stringify(selectedGenres)
                );
            } catch {
                // ignore
            }
        }
        setShowGenres(false);
    }

    function handleLogout(): void {
        setUser(null);
        setSelectedGenres([]);
        setLikedMovieIds([]);
    }

    function openGenreSelection(): void {
        if (!user) {
            setShowLogin(true);
            return;
        }
        if (!genres.length) {
            alert("장르 데이터를 불러오는 중입니다. 잠시 후 다시 시도해주세요.");
            return;
        }
        setShowGenres(true);
    }

    function handleOpenMovie(movie: Movie): void {
        setActiveMovie(movie);
    }

    function handleCloseMovie(): void {
        setActiveMovie(null);
    }

    function handleAddReview(
        movieId: number,
        input: { rating: number; content: string }
    ): void {
        if (!user?.id) {
            alert("리뷰를 작성하려면 로그인이 필요합니다.");
            return;
        }
        const trimmed = input.content.trim();
        if (!trimmed) {
            alert("리뷰 내용을 입력해주세요.");
            return;
        }

        void (async () => {
            try {
                const response = await createReview({
                    movieId,
                    rating: input.rating,
                    content: trimmed,
                    userId: user.id!,
                });
                if (!response.ok || !response.review) {
                    alert(response.message ?? "리뷰 등록에 실패했습니다.");
                    return;
                }
                setReviewsByMovie((prev) => ({
                    ...prev,
                    [movieId]: [...(prev[movieId] ?? []), response.review!],
                }));
            } catch (error) {
                console.error("[Review] error", error);
                alert("리뷰 등록 중 오류가 발생했습니다.");
            }
        })();
    }

    function handleToggleLike(movieId: number): void {
        if (!user?.id) {
            alert("좋아요는 로그인 후 이용 가능합니다.");
            return;
        }

        const isLiked = likedMovieIds.includes(movieId);
        const previousLikes = likedMovieIds;
        const nextLikes = isLiked
            ? likedMovieIds.filter((id) => id !== movieId)
            : [...likedMovieIds, movieId];
        setLikedMovieIds(nextLikes);

        void (async () => {
            try {
                await toggleLike({
                    userId: user.id!,
                    movieId,
                    like: !isLiked,
                });
            } catch (error) {
                console.error("[Likes] toggle error", error);
                setLikedMovieIds(previousLikes);
                alert("좋아요 처리 중 오류가 발생했습니다.");
            }
        })();
    }

    function handleReportReview(movieId: number, reviewId: number): void {
        if (!user) {
            alert("리뷰 신고는 로그인 후 이용 가능합니다.");
            return;
        }

        const alreadyReported =
            reportedReviewsByMovie[movieId]?.includes(reviewId);
        if (alreadyReported) {
            alert("이미 신고된 리뷰입니다.");
            return;
        }

        setReportedReviewsByMovie((prev) => {
            const current = prev[movieId] ?? [];
            return {
                ...prev,
                [movieId]: [...current, reviewId],
            };
        });

        alert("신고가 접수되었습니다. 검토 후 조치하겠습니다.");
    }

    const handleFetchAndStore = useCallback(async () => {
        if (!isDevUser) return;
        setImportingData(true);
        try {
            const result = await fetchAndImportMoviesFromApi();
            alert(
                result.ok
                    ? `데이터 동기화 완료 (추가 ${result.inserted ?? 0}건, 스킵 ${result.skipped ?? 0}건)`
                    : result.message ?? "데이터 동기화 실패"
            );
            if (result.ok) {
                await loadInitialData();
            }
        } catch (error) {
            alert(
                error instanceof Error
                    ? `TMDB 데이터 동기화 실패: ${error.message}`
                    : "TMDB 데이터 동기화 실패"
            );
        } finally {
            setImportingData(false);
        }
    }, [isDevUser, loadInitialData]);

    const handleClearData = useCallback(async () => {
        if (!isDevUser) return;
        const confirmed = window.confirm(
            "DB의 영화 관련 데이터를 모두 비우시겠습니까? 이 작업은 되돌릴 수 없습니다."
        );
        if (!confirmed) return;
        setClearingData(true);
        try {
            const result = await clearDatabase();
            alert(
                result.ok
                    ? "데이터를 모두 삭제했습니다."
                    : result.message ?? "데이터 삭제에 실패했습니다."
            );
            if (result.ok) {
                await loadInitialData();
            }
        } catch (error) {
            alert(
                error instanceof Error
                    ? `데이터 삭제 중 오류: ${error.message}`
                    : "데이터 삭제 중 오류가 발생했습니다."
            );
        } finally {
            setClearingData(false);
        }
    }, [isDevUser, loadInitialData]);

    return (
        <div className="app-root">
            <div
                className={
                    modalOpen
                        ? "app-blur-wrapper app-blur-wrapper--blurred"
                        : "app-blur-wrapper"
                }
            >
                <MovieScreen
                    user={user}
                    genres={genres}
                    selectedGenres={selectedGenres}
                    movies={movies}
                    likedMovieIds={likedMovieIds}
                    onToggleLike={handleToggleLike}
                    onOpenLogin={() => setShowLogin(true)}
                    onOpenGenres={openGenreSelection}
                    onLogout={handleLogout}
                    onOpenMovie={handleOpenMovie}
                    reviewsByMovie={reviewsByMovie}
                    isLoading={dataLoading}
                    fetchError={dataError}
                    onReloadData={loadInitialData}
                    isDevUser={isDevUser}
                    onImportData={handleFetchAndStore}
                    isImportingData={importingData}
                    onClearData={handleClearData}
                    isClearingData={clearingData}
                />
            </div>

            {modalOpen && <div className="modal-backdrop" />}

            {showLogin && (
                <LoginScreen
                    onLogin={handleLogin}
                    onClose={() => setShowLogin(false)}
                    onGoSignup={() => {
                        setShowLogin(false);
                        setShowSignup(true);
                    }}
                />
            )}

            {showSignup && (
                <SignupScreen
                    onSignup={handleLogin}
                    onClose={() => setShowSignup(false)}
                    onGoLogin={() => {
                        setShowSignup(false);
                        setShowLogin(true);
                    }}
                />
            )}

            {showGenres && user && (
                <GenreScreen
                    user={user}
                    genres={genres}
                    selected={selectedGenres}
                    onChangeSelected={setSelectedGenres}
                    onNext={handleSaveGenres}
                    onClose={() => setShowGenres(false)}
                />
            )}

            {activeMovie && (
                <MovieDetailModal
                    movie={activeMovie}
                    reviews={reviewsByMovie[activeMovie.id] ?? []}
                    user={user}
                    liked={!!user && likedMovieIds.includes(activeMovie.id)}
                    onToggleLike={() => handleToggleLike(activeMovie.id)}
                    onClose={handleCloseMovie}
                    onAddReview={(input) => handleAddReview(activeMovie.id, input)}
                    reportedReviewIds={reportedReviewsByMovie[activeMovie.id] ?? []}
                    onReportReview={(reviewId) =>
                        handleReportReview(activeMovie.id, reviewId)
                    }
                />
            )}
        </div>
    );
};

export default App;
