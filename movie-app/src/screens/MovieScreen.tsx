import React, { useMemo, useState } from "react";
import type { User, Genre, Movie } from "../types";

type MovieScreenProps = {
    user: User | null;
    genres: Genre[];
    selectedGenres: string[];
    movies: Movie[];
    onOpenLogin: () => void;
    onOpenGenres: () => void;
    onLogout: () => void;
    onOpenMovie: (movie: Movie) => void;
};

const MovieScreen: React.FC<MovieScreenProps> = ({
    user,
    genres,
    selectedGenres,
    movies,
    onOpenLogin,
    onOpenGenres,
    onLogout,
    onOpenMovie,
}) => {
    // 🔎 검색어 상태
    const [searchQuery, setSearchQuery] = useState<string>("");

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

    // 2) 정렬된 리스트에 검색 필터 적용
    const visibleMovies = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return sortedMovies;

        return sortedMovies.filter((m) => {
            const inTitle = m.title.toLowerCase().includes(q);
            const inGenres = m.genres.some((g) => g.toLowerCase().includes(q));
            const inYear = m.year.toString().includes(q);
            return inTitle || inGenres || inYear;
        });
    }, [sortedMovies, searchQuery]);

    const labelSelected =
        selectedGenres.length > 0
            ? selectedGenres
                .map((s) => genres.find((g) => g.slug === s)?.name || s)
                .join(", ")
            : "전체";

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

                            {user ? (
                                <>
                                    <div className="user-chip">
                                        <div className="user-chip__name">{user.name}</div>
                                        <div className="user-chip__email">{user.email}</div>
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

                    {/* 선택한 장르 + 검색 + 개수 */}
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
                        </div>

                        {/* 오른쪽: 총 개수 + 검색창 */}
                        <div className="movie-main__header-right">
                            <div className="pill pill--outline">
                                총 <strong>{visibleMovies.length}</strong> 편
                            </div>
                            <input
                                className="form-input movie-main__search"
                                placeholder="제목 / 장르 / 연도 검색"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* ✅ 정렬 + 검색이 적용된 영화 리스트 (스크롤 영역) */}
                <section className="movie-grid">
                    {visibleMovies.map((m) => (
                        <article key={m.id} className="movie-card movie-card--compact">
                            <button
                                type="button"
                                className="movie-card__clickable"
                                onClick={() => onOpenMovie(m)}
                            >
                                <div className="movie-card__poster">
                                    {m.posterUrl ? (
                                        <img src={m.posterUrl} alt={m.title} />
                                    ) : (
                                        <div className="movie-card__noimg">No Image</div>
                                    )}
                                </div>
                                <div className="movie-card__body">
                                    <h3 className="movie-card__title">{m.title}</h3>
                                    <p className="movie-card__year">{m.year}</p>
                                    <div className="movie-card__genres">
                                        {m.genres.map((g) => (
                                            <span key={g} className="pill pill--soft">
                                                {g.toUpperCase()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </button>
                        </article>
                    ))}

                    {visibleMovies.length === 0 && (
                        <div className="movie-empty">
                            검색 조건에 해당하는 영화가 없습니다.
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default MovieScreen;
