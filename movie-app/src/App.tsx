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
import {
    fetchAndImportMoviesFromApi,
    clearDatabase,
    createMovie as createAdminMovie,
    updateMovie as updateAdminMovie,
    deleteMovie as deleteAdminMovie,
    refreshExistingMovies,
} from "./api/adminService";
import type { AdminMovieInput } from "./api/adminService";
import { createReview } from "./api/reviewService";
import { fetchLikes, toggleLike } from "./api/likeService";
import {
    fetchPreferredGenres,
    savePreferredGenres,
} from "./api/preferenceService";
import { reportReview } from "./api/reportService";

type ReviewsByMovie = Record<number, Review[]>;

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
    const [creatingMovie, setCreatingMovie] = useState<boolean>(false);
    const [updatingMovie, setUpdatingMovie] = useState<boolean>(false);
    const [deletingMovie, setDeletingMovie] = useState<boolean>(false);
    const [refreshingMovies, setRefreshingMovies] = useState<boolean>(false);

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

    const loadPreferredGenresFromServer = useCallback(
        async (userId?: number | null) => {
            if (!userId) return;
            try {
                const response = await fetchPreferredGenres(userId);
                if (response.ok && Array.isArray(response.genres)) {
                    setSelectedGenres(response.genres);
                } else if (response.message) {
                    console.warn("[Preferences] load failed:", response.message);
                }
            } catch (error) {
                console.warn("[Preferences] load error", error);
            }
        },
        []
    );

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
        if (user?.id) {
            void loadPreferredGenresFromServer(user.id);
        } else {
            setSelectedGenres([]);
        }
    }, [user?.id, loadPreferredGenresFromServer]);

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
        void loadPreferredGenresFromServer(payload.userId);

        setShowLogin(false);
        setShowSignup(false);
    }

    function handleSaveGenres(): void {
        if (!user?.id) {
            setShowGenres(false);
            return;
        }
        void (async () => {
            try {
                const response = await savePreferredGenres(user.id!, selectedGenres);
                if (!response.ok) {
                    alert(response.message ?? "선호 장르를 저장하지 못했습니다.");
                    return;
                }
                setShowGenres(false);
            } catch (error) {
                console.error("[Preferences] save error", error);
                alert("선호 장르를 저장하지 못했습니다.");
            }
        })();
    }

    function handleLogout(): void {
        setUser(null);
        setSelectedGenres([]);
        setLikedMovieIds([]);
        window.location.reload();
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
                    const message =
                        response.message &&
                        (response.message.includes("이미") ||
                            response.message.includes("작성"))
                            ? "리뷰는 한 번만 작성할 수 있습니다."
                            : response.message ?? "리뷰 등록에 실패했습니다.";
                    alert(message);
                    return;
                }
                setReviewsByMovie((prev) => ({
                    ...prev,
                    [movieId]: [...(prev[movieId] ?? []), response.review!],
                }));
            } catch (error) {
                console.error("[Review] error", error);
                const message =
                    error instanceof Error &&
                    (error.message.includes("이미") || error.message.includes("작성"))
                        ? "리뷰는 한 번만 작성할 수 있습니다."
                        : "리뷰 등록에 실패했습니다.";
                alert(message);
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

    function handleReportReview(
        movieId: number,
        reviewId: number,
        reason: string
    ): void {
        if (!user?.id) {
            alert("리뷰 신고는 로그인 후 이용 가능합니다.");
            return;
        }

        const alreadyReported =
            reportedReviewsByMovie[movieId]?.includes(reviewId);
        if (alreadyReported) {
            alert("이미 신고한 리뷰입니다.");
            return;
        }

        void (async () => {
            try {
                const response = await reportReview({
                    reviewId,
                    userId: user.id!,
                    reason,
                });
                if (!response.ok) {
                    alert(response.message ?? "리뷰를 신고하지 못했습니다.");
                    if (response.message?.includes("이미 신고한 리뷰입니다.")) {
                        setReportedReviewsByMovie((prev) => {
                            const current = prev[movieId] ?? [];
                            if (current.includes(reviewId)) {
                                return prev;
                            }
                            return {
                                ...prev,
                                [movieId]: [...current, reviewId],
                            };
                        });
                    }
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
            } catch (error) {
                console.error("[Review] report error", error);
                const message =
                    error instanceof Error && error.message.includes("이미")
                        ? "이미 신고한 리뷰입니다."
                        : "리뷰를 신고하지 못했습니다.";
                alert(message);
            }
        })();
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

    const handleCreateMovie = useCallback(
        async (payload: AdminMovieInput): Promise<boolean> => {
            if (!isDevUser) {
                alert("관리자 전용 기능입니다.");
                return false;
            }
            setCreatingMovie(true);
            try {
                const response = await createAdminMovie(payload);
                const createdMovie = response.movie;
                if (!response.ok || !createdMovie) {
                    alert(response.message ?? "영화를 추가하지 못했습니다.");
                    return false;
                }
                setMovies((prev) => {
                    const exists = prev.some((movie) => movie.id === createdMovie.id);
                    if (exists) {
                        return prev.map((movie) =>
                            movie.id === createdMovie.id ? createdMovie : movie
                        );
                    }
                    return [createdMovie, ...prev];
                });
                setReviewsByMovie((prev) => ({
                    ...prev,
                    [createdMovie.id]: prev[createdMovie.id] ?? [],
                }));
                alert("새 영화가 추가되었습니다.");
                return true;
            } catch (error) {
                alert(
                    error instanceof Error
                        ? `영화 추가 실패: ${error.message}`
                        : "영화를 추가하지 못했습니다."
                );
                return false;
            } finally {
                setCreatingMovie(false);
            }
        },
        [isDevUser]
    );

    const handleUpdateMovie = useCallback(
        async (movieId: number, payload: AdminMovieInput): Promise<boolean> => {
            if (!isDevUser) {
                alert("관리자 전용 기능입니다.");
                return false;
            }
            setUpdatingMovie(true);
            try {
                const response = await updateAdminMovie(movieId, payload);
                if (!response.ok || !response.movie) {
                    alert(response.message ?? "영화를 수정하지 못했습니다.");
                    return false;
                }
                setMovies((prev) =>
                    prev.map((movie) =>
                        movie.id === movieId ? response.movie! : movie
                    )
                );
                if (activeMovie?.id === movieId) {
                    setActiveMovie(response.movie!);
                }
                alert("영화 정보가 수정되었습니다.");
                return true;
            } catch (error) {
                alert(
                    error instanceof Error
                        ? `영화 수정 실패: ${error.message}`
                        : "영화를 수정하지 못했습니다."
                );
                return false;
            } finally {
                setUpdatingMovie(false);
            }
        },
        [isDevUser, activeMovie]
    );

    const handleDeleteMovie = useCallback(
        async (movieId: number): Promise<boolean> => {
            if (!isDevUser) {
                alert("관리자 전용 기능입니다.");
                return false;
            }
            setDeletingMovie(true);
            try {
                const response = await deleteAdminMovie(movieId);
                if (!response.ok) {
                    alert(response.message ?? "영화를 삭제하지 못했습니다.");
                    return false;
                }
                setMovies((prev) => prev.filter((movie) => movie.id !== movieId));
                setReviewsByMovie((prev) => {
                    if (!(movieId in prev)) return prev;
                    const next = { ...prev };
                    delete next[movieId];
                    return next;
                });
                setReportedReviewsByMovie((prev) => {
                    if (!(movieId in prev)) return prev;
                    const next = { ...prev };
                    delete next[movieId];
                    return next;
                });
                setLikedMovieIds((prev) => prev.filter((id) => id !== movieId));
                if (activeMovie?.id === movieId) {
                    setActiveMovie(null);
                }
                alert("영화가 삭제되었습니다.");
                return true;
            } catch (error) {
                alert(
                    error instanceof Error
                        ? `영화 삭제 실패: ${error.message}`
                        : "영화를 삭제하지 못했습니다."
                );
                return false;
            } finally {
                setDeletingMovie(false);
            }
        },
        [isDevUser, activeMovie]
    );

    const handleRefreshExistingMovies = useCallback(async () => {
        if (!isDevUser) return;
        setRefreshingMovies(true);
        try {
            const result = await refreshExistingMovies();
            if (!result.ok) {
                alert(result.message ?? "영화 정보를 업데이트하지 못했습니다.");
                return;
            }
            alert(
                `업데이트 완료 (성공 ${result.updated ?? 0}건, 실패 ${result.failed ?? 0}건)`
            );
            await loadInitialData();
        } catch (error) {
            alert(
                error instanceof Error
                    ? `영화 업데이트 중 오류: ${error.message}`
                    : "영화 정보를 업데이트하지 못했습니다."
            );
        } finally {
            setRefreshingMovies(false);
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
                    onCreateMovie={handleCreateMovie}
                    onUpdateMovie={handleUpdateMovie}
                    onDeleteMovie={handleDeleteMovie}
                    isCreatingMovie={creatingMovie}
                    isUpdatingMovie={updatingMovie}
                    isDeletingMovie={deletingMovie}
                    onRefreshMovies={handleRefreshExistingMovies}
                    isRefreshingMovies={refreshingMovies}
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
                    onReportReview={(reviewId, reason) =>
                        handleReportReview(activeMovie.id, reviewId, reason)
                    }
                />
            )}
        </div>
    );
};

export default App;
