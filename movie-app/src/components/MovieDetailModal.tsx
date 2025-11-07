// src/components/MovieDetailModal.tsx

import React, { useMemo, useState } from "react";
import type { Movie, Review, User } from "../types";

type MovieDetailModalProps = {
    movie: Movie;
    reviews: Review[];
    user: User | null;
    liked: boolean;
    onClose: () => void;
    onAddReview: (input: { rating: number; content: string }) => void;
    onToggleLike: () => void;
    reportedReviewIds: number[];
    onReportReview: (reviewId: number, reason: string) => void;
};

function formatCurrency(amount?: number): string {
    if (amount == null || amount <= 0) return "-";
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
    onClose,
    onAddReview,
    liked,
    onToggleLike,
    reportedReviewIds,
    onReportReview,
}) => {
    const [showTrailer, setShowTrailer] = useState(false);
    const [rating, setRating] = useState<number>(8);
    const [content, setContent] = useState("");
    const reportedReviewSet = useMemo(
        () => new Set(reportedReviewIds),
        [reportedReviewIds]
    );

    const trailerSrc =
        movie.trailerKey && movie.trailerSite === "Vimeo"
            ? `https://player.vimeo.com/video/${movie.trailerKey}`
            : movie.trailerKey
                ? `https://www.youtube.com/embed/${movie.trailerKey}`
                : null;

    const avgRating =
        reviews.length > 0
            ? Math.round(
                (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10
            ) / 10
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

    function handleClickLike() {
        if (!user) {
            alert("좋아요는 로그인 후 이용 가능합니다.");
            return;
        }
        onToggleLike();
    }

    function handleReportReviewClick(reviewId: number) {
        if (reportedReviewSet.has(reviewId)) {
            alert("이미 신고 처리된 리뷰입니다.");
            return;
        }
        const reason = window.prompt(
            "신고 사유를 입력해주세요.\n(예: 욕설, 광고, 부적절한 내용 등)"
        );
        if (reason === null) return;
        const trimmed = reason.trim();
        if (!trimmed) {
            alert("신고 사유를 입력해주세요.");
            return;
        }
        onReportReview(reviewId, trimmed);
    }

    const streamingLabel =
        movie.streamingPlatforms && movie.streamingPlatforms.length > 0
            ? movie.streamingPlatforms.join(" · ")
            : "정보 없음";

    const genreLabel =
        movie.genres && movie.genres.length > 0
            ? movie.genres
                .map((slug) =>
                    slug
                        .split("-")
                        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                        .join(" ")
                )
                .join(" · ")
            : "정보 없음";

    return (
        <>
        <div className="modal">
            <div className="card card--glass modal-card movie-detail">
                <div className="movie-detail__header">
                    <h1 className="movie-detail__title">
                        {movie.title}{" "}
                        <span className="movie-detail__year">({movie.year})</span>
                    </h1>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={handleClickLike}
                        >
                            {liked ? "♥ 좋아요 취소" : "♡ 좋아요"}
                        </button>
                        <div className="pill pill--soft" style={{ fontSize: 12 }}>
                            {avgRating !== null
                                ? `★ ${avgRating.toFixed(1)} / 10 · 리뷰 ${reviews.length}개`
                                : "아직 평균 평점 없음"}
                        </div>
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
                                <span className="tag-chip">감독</span>
                                <span>{movie.director || "정보 없음"}</span>
                            </div>
                            <div className="movie-detail__meta-row">
                                <span className="tag-chip">장르</span>
                                <span>{genreLabel}</span>
                            </div>
                            <div className="movie-detail__meta-row">
                                <span className="tag-chip">연령 등급</span>
                                <span>{movie.ageRating ?? "정보 없음"}</span>
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
                            <div className="movie-detail__meta-row">
                                <span className="tag-chip">스트리밍</span>
                                <span>{streamingLabel}</span>
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
                                                    <div className="cast-card__role">{c.character}</div>
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
                                        <div
                                            key={r.id}
                                            className={
                                                "review-item" +
                                                (reportedReviewSet.has(r.id)
                                                    ? " review-item--reported"
                                                    : "")
                                            }
                                        >
                                            <div className="review-item__header">
                                                <span className="review-item__author">
                                                    {r.userName}
                                                </span>
                                                <span className="review-item__rating">
                                                    ★ {r.rating}/10
                                                </span>
                                            </div>
                                            <p className="review-item__content">{r.content}</p>
                                            <div className="review-item__footer">
                                                <button
                                                    type="button"
                                                    className="btn btn--ghost btn--xs review-item__report-btn"
                                                    disabled={reportedReviewSet.has(r.id)}
                                                    onClick={() =>
                                                        handleReportReviewClick(r.id)
                                                    }
                                                >
                                                    {reportedReviewSet.has(r.id)
                                                        ? "신고 완료"
                                                        : "신고"}
                                                </button>
                                            </div>
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
                                    <button type="submit" className="btn btn--primary btn--full">
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
        {showTrailer && trailerSrc && (
            <div className="trailer-modal">
                <div
                    className="trailer-modal__backdrop"
                    onClick={() => setShowTrailer(false)}
                />
                <div className="trailer-modal__content">
                    <button
                        type="button"
                        className="btn btn--ghost btn--sm trailer-modal__close"
                        onClick={() => setShowTrailer(false)}
                    >
                        닫기
                    </button>
                    <div className="trailer-modal__video">
                        <iframe
                            src={trailerSrc}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            title="trailer"
                        />
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default MovieDetailModal;
