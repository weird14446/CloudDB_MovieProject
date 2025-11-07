// src/components/MovieDetailModal.tsx

import React, { useState } from "react";
import type { Movie, Review, User } from "../types";

type MovieDetailModalProps = {
    movie: Movie;
    reviews: Review[];
    user: User | null;
    liked: boolean;
    onClose: () => void;
    onAddReview: (input: { rating: number; content: string }) => void;
    onToggleLike: () => void;
};

function formatCurrency(amount?: number): string {
    if (amount == null) return "정보 없음";
    return new Intl.NumberFormat("ko-KR", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(amount);
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return "정보 없음";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function getStatusLabel(status?: string): string {
    if (!status) return "정보 없음";
    switch (status) {
        case "Released":
            return "개봉 완료";
        case "Post Production":
            return "후반 작업 중";
        case "In Production":
            return "제작 중";
        case "Planned":
            return "제작 예정";
        case "Canceled":
            return "제작 취소";
        default:
            return status;
    }
}

const MovieDetailModal: React.FC<MovieDetailModalProps> = ({
    movie,
    reviews,
    user,
    liked,
    onClose,
    onAddReview,
    onToggleLike,
}) => {
    const [showTrailer, setShowTrailer] = useState(false);
    const [rating, setRating] = useState<number>(8);
    const [content, setContent] = useState("");

    const trailerSrc =
        movie.trailerKey && movie.trailerSite === "Vimeo"
            ? `https://player.vimeo.com/video/${movie.trailerKey}`
            : movie.trailerKey
                ? `https://www.youtube.com/embed/${movie.trailerKey}`
                : null;

    function handleSubmitReview(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!content.trim()) return;

        onAddReview({
            rating,
            content: content.trim(),
        });
        setContent("");
    }

    return (
        <div className="modal">
            <div className="card card--glass modal-card movie-detail">
                <div className="movie-detail__header">
                    <div>
                        <h1 className="movie-detail__title">
                            {movie.title}{" "}
                            <span className="movie-detail__year">({movie.year})</span>
                        </h1>
                    </div>
                    <div className="movie-detail__header-actions">
                        <button
                            type="button"
                            className={
                                liked
                                    ? "like-button like-button--active"
                                    : "like-button"
                            }
                            onClick={onToggleLike}
                        >
                            {liked ? "♥ 좋아요" : "♡ 좋아요"}
                        </button>
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={onClose}
                        >
                            닫기
                        </button>
                    </div>
                </div>

                <div className="movie-detail__layout">
                    {/* 포스터 + 메타 정보 */}
                    <div className="movie-detail__left">
                        <div className="movie-detail__poster">
                            {movie.posterUrl ? (
                                <img src={movie.posterUrl} alt={movie.title} />
                            ) : (
                                <div className="movie-card__noimg">No Image</div>
                            )}
                        </div>

                        <div className="movie-detail__meta">
                            <div className="movie-detail__meta-row">
                                <span className="tag-chip">개봉 상태</span>
                                <span>{getStatusLabel(movie.status)}</span>
                            </div>
                            <div className="movie-detail__meta-row">
                                <span className="tag-chip">개봉일</span>
                                <span>{formatDate(movie.releaseDate)}</span>
                            </div>
                            {movie.runtimeMinutes && (
                                <div className="movie-detail__meta-row">
                                    <span className="tag-chip">상영 시간</span>
                                    <span>{movie.runtimeMinutes}분</span>
                                </div>
                            )}
                            <div className="movie-detail__meta-row">
                                <span className="tag-chip">제작비</span>
                                <span>{formatCurrency(movie.budget)}</span>
                            </div>
                            <div className="movie-detail__meta-row">
                                <span className="tag-chip">수익</span>
                                <span>{formatCurrency(movie.revenue)}</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="btn btn--primary btn--full movie-detail__trailer-btn"
                            onClick={() => setShowTrailer((prev) => !prev)}
                            disabled={!trailerSrc}
                        >
                            {trailerSrc
                                ? showTrailer
                                    ? "트레일러 닫기"
                                    : "트레일러 보기"
                                : "트레일러 정보 없음"}
                        </button>

                        {showTrailer && trailerSrc && (
                            <div className="movie-detail__trailer">
                                <div className="movie-detail__trailer-inner">
                                    <iframe
                                        src={trailerSrc}
                                        title={`${movie.title} trailer`}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 줄거리 + 출연진 + 리뷰 */}
                    <div className="movie-detail__right">
                        <section className="movie-detail__section">
                            <h2 className="movie-detail__section-title">줄거리</h2>
                            <p className="movie-detail__overview">
                                {movie.overview || "줄거리 정보가 없습니다."}
                            </p>
                        </section>

                        <section className="movie-detail__section">
                            <h2 className="movie-detail__section-title">주요 출연진</h2>
                            {movie.cast && movie.cast.length > 0 ? (
                                <div className="cast-list">
                                    {movie.cast.map((c) => (
                                        <div key={c.id} className="cast-card">
                                            <div className="cast-card__avatar">
                                                {c.profileUrl ? (
                                                    <img src={c.profileUrl} alt={c.name} />
                                                ) : (
                                                    <div className="cast-card__initial">
                                                        {c.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="cast-card__info">
                                                <div className="cast-card__name">{c.name}</div>
                                                {c.character && (
                                                    <div className="cast-card__role">
                                                        {c.character}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="movie-detail__empty">
                                    출연진 정보가 없습니다.
                                </p>
                            )}
                        </section>

                        <section className="movie-detail__section">
                            <h2 className="movie-detail__section-title">리뷰</h2>
                            {reviews.length > 0 ? (
                                <div className="review-list">
                                    {reviews.map((r) => (
                                        <div key={r.id} className="review-item">
                                            <div className="review-item__header">
                                                <span className="review-item__author">
                                                    {r.userName}
                                                </span>
                                                <span className="review-item__rating">
                                                    ★ {r.rating}/10
                                                </span>
                                            </div>
                                            <p className="review-item__content">{r.content}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="movie-detail__empty">
                                    아직 작성된 리뷰가 없습니다. 첫 리뷰를 남겨보세요!
                                </p>
                            )}

                            {/* ✅ 로그인한 유저만 리뷰 작성 가능 */}
                            {user ? (
                                <form className="review-form" onSubmit={handleSubmitReview}>
                                    <div className="review-form__row">
                                        <div className="form-field review-form__field">
                                            <span className="form-label">작성자</span>
                                            <div className="review-form__author-name">
                                                {user.name}
                                            </div>
                                        </div>
                                        <label className="form-field review-form__field review-form__field--rating">
                                            <span className="form-label">평점</span>
                                            <input
                                                className="form-input"
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={rating}
                                                onChange={(e) =>
                                                    setRating(Number(e.target.value) || 1)
                                                }
                                            />
                                        </label>
                                    </div>
                                    <label className="form-field">
                                        <span className="form-label">리뷰 내용</span>
                                        <textarea
                                            className="form-input review-form__textarea"
                                            value={content}
                                            onChange={(e) => setContent(e.target.value)}
                                            placeholder="영화에 대한 느낌을 자유롭게 적어주세요."
                                        />
                                    </label>
                                    <button
                                        type="submit"
                                        className="btn btn--primary btn--full"
                                    >
                                        리뷰 남기기
                                    </button>
                                </form>
                            ) : (
                                <p className="movie-detail__empty">
                                    리뷰를 작성하려면 로그인 해주세요.
                                </p>
                            )}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MovieDetailModal;
