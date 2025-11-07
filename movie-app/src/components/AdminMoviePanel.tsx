import React, { useEffect, useMemo, useState } from "react";
import type { AdminMovieInput } from "../api/adminService";
import type { Genre, Movie, StreamingPlatform } from "../types";

type AdminMoviePanelProps = {
    genres: Genre[];
    movies: Movie[];
    onCreateMovie: (movie: AdminMovieInput) => Promise<boolean>;
    onUpdateMovie: (movieId: number, movie: AdminMovieInput) => Promise<boolean>;
    onDeleteMovie: (movieId: number) => Promise<boolean>;
    isCreating: boolean;
    isUpdating: boolean;
    isDeleting: boolean;
};

type FormState = {
    title: string;
    year: string;
    director: string;
    overview: string;
    posterUrl: string;
    releaseDate: string;
    status: string;
    runtimeMinutes: string;
    trailerKey: string;
    trailerSite: "" | NonNullable<AdminMovieInput["trailerSite"]>;
    ageRating: string;
    genres: string[];
    streamingPlatforms: string[];
    budget: string;
    revenue: string;
};

const STREAMING_OPTIONS: StreamingPlatform[] = [
    "Netflix",
    "Disney+",
    "Amazon Prime Video",
    "Apple TV+",
    "Wavve",
    "티빙",
    "기타",
];

const createEmptyFormState = (): FormState => ({
    title: "",
    year: "",
    director: "",
    overview: "",
    posterUrl: "",
    releaseDate: "",
    status: "Released",
    runtimeMinutes: "",
    trailerKey: "",
    trailerSite: "",
    ageRating: "",
    genres: [],
    streamingPlatforms: [],
    budget: "",
    revenue: "",
});

function mapMovieToForm(movie: Movie, knownGenres: Set<string>): FormState {
    const runtime = movie.runtimeMinutes ?? null;
    const budget = movie.budget ?? null;
    const revenue = movie.revenue ?? null;
    const streaming = (movie.streamingPlatforms ?? []).filter(
        (platform): platform is string => typeof platform === "string"
    );

    return {
        title: movie.title ?? "",
        year: movie.year ? String(movie.year) : "",
        director: movie.director ?? "",
        overview: movie.overview ?? "",
        posterUrl: movie.posterUrl ?? "",
        releaseDate: movie.releaseDate ?? "",
        status: movie.status ?? "",
        runtimeMinutes: runtime != null ? String(runtime) : "",
        trailerKey: movie.trailerKey ?? "",
        trailerSite: (movie.trailerSite as FormState["trailerSite"]) ?? "",
        ageRating: movie.ageRating ?? "",
        genres: (movie.genres ?? []).filter((slug) => knownGenres.has(slug)),
        streamingPlatforms: streaming,
        budget: budget != null ? String(budget) : "",
        revenue: revenue != null ? String(revenue) : "",
    };
}

const AdminMoviePanel: React.FC<AdminMoviePanelProps> = ({
    genres,
    movies,
    onCreateMovie,
    onUpdateMovie,
    onDeleteMovie,
    isCreating,
    isUpdating,
    isDeleting,
}) => {
    const [form, setForm] = useState<FormState>(() => createEmptyFormState());
    const [movieToDelete, setMovieToDelete] = useState<string>("");
    const [editingMovieId, setEditingMovieId] = useState<number | null>(null);

    const sortedGenres = useMemo(
        () => [...genres].sort((a, b) => a.name.localeCompare(b.name)),
        [genres]
    );
    const sortedMovies = useMemo(
        () => [...movies].sort((a, b) => a.title.localeCompare(b.title)),
        [movies]
    );
    const genreSlugSet = useMemo(
        () => new Set(sortedGenres.map((genre) => genre.slug)),
        [sortedGenres]
    );

    useEffect(() => {
        if (!editingMovieId) return;
        const target = movies.find((movie) => movie.id === editingMovieId);
        if (!target) {
            setEditingMovieId(null);
            setForm(createEmptyFormState());
            return;
        }
        setForm(mapMovieToForm(target, genreSlugSet));
    }, [editingMovieId, movies, genreSlugSet]);

    function handleFieldChange<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    function handleGenreSelect(event: React.ChangeEvent<HTMLSelectElement>) {
        const values = Array.from(event.target.selectedOptions).map((opt) => opt.value);
        handleFieldChange("genres", values);
    }

    function togglePlatform(platform: StreamingPlatform) {
        setForm((prev) => {
            const exists = prev.streamingPlatforms.includes(platform);
            return {
                ...prev,
                streamingPlatforms: exists
                    ? prev.streamingPlatforms.filter((item) => item !== platform)
                    : [...prev.streamingPlatforms, platform],
            };
        });
    }

    function resetForm() {
        setEditingMovieId(null);
        setForm(createEmptyFormState());
    }

    function handleEditSelect(value: string) {
        if (!value) {
            resetForm();
            return;
        }
        const nextId = Number(value);
        if (Number.isNaN(nextId)) {
            resetForm();
            return;
        }
        setEditingMovieId(nextId);
        const target = movies.find((movie) => movie.id === nextId);
        if (target) {
            setForm(mapMovieToForm(target, genreSlugSet));
        }
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const trimmedTitle = form.title.trim();
        const yearNumber = Number(form.year);
        if (!trimmedTitle || Number.isNaN(yearNumber)) {
            alert("제목과 연도를 올바르게 입력해주세요.");
            return;
        }

        const payload: AdminMovieInput = {
            title: trimmedTitle,
            year: yearNumber,
            director: form.director.trim() || undefined,
            overview: form.overview.trim() || undefined,
            posterUrl: form.posterUrl.trim() || undefined,
            releaseDate: form.releaseDate.trim() || undefined,
            status: form.status.trim() || undefined,
            runtimeMinutes: form.runtimeMinutes ? Number(form.runtimeMinutes) : undefined,
            trailerKey: form.trailerKey.trim() || undefined,
            trailerSite: form.trailerSite || undefined,
            ageRating: form.ageRating.trim() || undefined,
            genres: form.genres,
            streamingPlatforms: form.streamingPlatforms,
            budget: form.budget ? Number(form.budget) : undefined,
            revenue: form.revenue ? Number(form.revenue) : undefined,
        };

        if (
            (payload.runtimeMinutes != null && Number.isNaN(payload.runtimeMinutes)) ||
            (payload.budget != null && Number.isNaN(payload.budget)) ||
            (payload.revenue != null && Number.isNaN(payload.revenue))
        ) {
            alert("숫자 필드는 숫자만 입력해주세요.");
            return;
        }

        const isEditMode = editingMovieId != null;
        const success = isEditMode
            ? await onUpdateMovie(editingMovieId!, payload)
            : await onCreateMovie(payload);
        if (success && !isEditMode) {
            setForm(createEmptyFormState());
        }
    }

    async function handleDelete(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!movieToDelete) {
            alert("삭제할 영화를 선택해주세요.");
            return;
        }
        const movieId = Number(movieToDelete);
        const target = movies.find((m) => m.id === movieId);
        const confirmed = window.confirm(
            target
                ? `정말로 "${target.title}" (${target.year}) 영화를 삭제할까요?`
                : "선택한 영화를 삭제할까요?"
        );
        if (!confirmed) return;
        const success = await onDeleteMovie(movieId);
        if (success) {
            setMovieToDelete("");
            if (editingMovieId === movieId) {
                resetForm();
            }
        }
    }

    const isEditMode = editingMovieId != null;
    const submitBusy = isEditMode ? isUpdating : isCreating;
    const submitLabel = isEditMode
        ? submitBusy
            ? "수정 중..."
            : "영화 수정"
        : submitBusy
            ? "등록 중..."
            : "영화 추가";

    return (
        <section className="admin-panel">
            <div>
                <div className="badge">Admin</div>
                <h3 className="card-title">관리자 도구</h3>
                <p className="card-subtitle">
                    개발자 계정에서만 보이는 패널입니다. 새 영화를 추가하거나 기존 영화를 수정/삭제할 수 있습니다.
                </p>
            </div>

            <div className="admin-panel__forms">
                <form className="admin-panel__form" onSubmit={handleSubmit}>
                    <div className="admin-panel__mode">
                        <div>
                            <h4 className="admin-panel__form-title">
                                {isEditMode ? "영화 정보 수정" : "새 영화 등록"}
                            </h4>
                            <p className="admin-panel__mode-hint">
                                {isEditMode
                                    ? "선택한 영화의 메타데이터를 업데이트합니다."
                                    : "필요한 정보를 입력해 새로운 영화를 추가하세요."}
                            </p>
                        </div>
                        <div className="admin-panel__mode-select">
                            <label htmlFor="admin-edit-select" className="form-label">
                                편집 대상
                            </label>
                            <select
                                id="admin-edit-select"
                                className="form-input"
                                value={editingMovieId?.toString() ?? ""}
                                onChange={(event) => handleEditSelect(event.target.value)}
                            >
                                <option value="">새 영화 추가</option>
                                {sortedMovies.map((movie) => (
                                    <option key={movie.id} value={movie.id}>
                                        {movie.title} ({movie.year})
                                    </option>
                                ))}
                            </select>
                            {isEditMode && (
                                <button
                                    type="button"
                                    className="btn btn--ghost btn--sm"
                                    onClick={resetForm}
                                >
                                    새 영화 모드
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="form-field">
                        <label className="form-label" htmlFor="admin-title">
                            제목 *
                        </label>
                        <input
                            id="admin-title"
                            className="form-input"
                            value={form.title}
                            onChange={(e) => handleFieldChange("title", e.target.value)}
                            placeholder="예) Interstellar"
                        />
                    </div>

                    <div className="form-field">
                        <label className="form-label" htmlFor="admin-year">
                            개봉 연도 *
                        </label>
                        <input
                            id="admin-year"
                            className="form-input"
                            value={form.year}
                            onChange={(e) => handleFieldChange("year", e.target.value)}
                            placeholder="예) 2014"
                        />
                    </div>

                    <div className="form-field">
                        <label className="form-label" htmlFor="admin-director">
                            감독
                        </label>
                        <input
                            id="admin-director"
                            className="form-input"
                            value={form.director}
                            onChange={(e) => handleFieldChange("director", e.target.value)}
                            placeholder="감독 이름"
                        />
                    </div>

                    <div className="form-field">
                        <label className="form-label" htmlFor="admin-overview">
                            줄거리
                        </label>
                        <textarea
                            id="admin-overview"
                            className="form-input"
                            rows={3}
                            value={form.overview}
                            onChange={(e) => handleFieldChange("overview", e.target.value)}
                            placeholder="간단한 줄거리를 입력하세요."
                        />
                    </div>

                    <div className="form-grid">
                        <div className="form-field">
                            <label className="form-label" htmlFor="admin-poster">
                                포스터 URL
                            </label>
                            <input
                                id="admin-poster"
                                className="form-input"
                                value={form.posterUrl}
                                onChange={(e) => handleFieldChange("posterUrl", e.target.value)}
                                placeholder="https://"
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label" htmlFor="admin-release">
                                개봉일 (YYYY-MM-DD)
                            </label>
                            <input
                                id="admin-release"
                                className="form-input"
                                value={form.releaseDate}
                                onChange={(e) => handleFieldChange("releaseDate", e.target.value)}
                                placeholder="2024-01-01"
                            />
                        </div>
                    </div>

                    <div className="form-grid">
                        <div className="form-field">
                            <label className="form-label" htmlFor="admin-status">
                                상태
                            </label>
                            <input
                                id="admin-status"
                                className="form-input"
                                value={form.status}
                                onChange={(e) => handleFieldChange("status", e.target.value)}
                                placeholder="Released"
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label" htmlFor="admin-runtime">
                                상영 시간(분)
                            </label>
                            <input
                                id="admin-runtime"
                                className="form-input"
                                value={form.runtimeMinutes}
                                onChange={(e) =>
                                    handleFieldChange("runtimeMinutes", e.target.value)
                                }
                                placeholder="169"
                            />
                        </div>
                    </div>

                    <div className="form-grid">
                        <div className="form-field">
                            <label className="form-label" htmlFor="admin-budget">
                                제작비(USD)
                            </label>
                            <input
                                id="admin-budget"
                                className="form-input"
                                value={form.budget}
                                onChange={(e) => handleFieldChange("budget", e.target.value)}
                                placeholder="예) 165000000"
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-label" htmlFor="admin-revenue">
                                수익(USD)
                            </label>
                            <input
                                id="admin-revenue"
                                className="form-input"
                                value={form.revenue}
                                onChange={(e) => handleFieldChange("revenue", e.target.value)}
                                placeholder="예) 677471339"
                            />
                        </div>
                    </div>

                    <div className="form-grid">
                        <div className="form-field">
                            <label className="form-label" htmlFor="admin-trailer-site">
                                트레일러 사이트
                            </label>
                            <select
                                id="admin-trailer-site"
                                className="form-input"
                                value={form.trailerSite}
                                onChange={(e) =>
                                    handleFieldChange(
                                        "trailerSite",
                                        (e.target.value as FormState["trailerSite"]) ?? ""
                                    )
                                }
                            >
                                <option value="">선택 안 함</option>
                                <option value="YouTube">YouTube</option>
                                <option value="Vimeo">Vimeo</option>
                            </select>
                        </div>
                        <div className="form-field">
                            <label className="form-label" htmlFor="admin-trailer-key">
                                트레일러 키
                            </label>
                            <input
                                id="admin-trailer-key"
                                className="form-input"
                                value={form.trailerKey}
                                onChange={(e) => handleFieldChange("trailerKey", e.target.value)}
                                placeholder="YouTube video key"
                            />
                        </div>
                    </div>

                    <div className="form-field">
                        <label className="form-label" htmlFor="admin-age">
                            관람 등급
                        </label>
                        <input
                            id="admin-age"
                            className="form-input"
                            value={form.ageRating}
                            onChange={(e) => handleFieldChange("ageRating", e.target.value)}
                            placeholder="15세 이상 관람가"
                        />
                    </div>

                    <div className="form-field">
                        <label className="form-label" htmlFor="admin-genres">
                            장르 선택
                        </label>
                        <select
                            id="admin-genres"
                            multiple
                            className="form-input admin-panel__multiselect"
                            value={form.genres}
                            onChange={handleGenreSelect}
                        >
                            {sortedGenres.map((genre) => (
                                <option key={genre.id} value={genre.slug}>
                                    {genre.name}
                                </option>
                            ))}
                        </select>
                        <small className="admin-panel__hint">
                            Ctrl(Command) 키를 누른 채로 여러 장르를 선택하세요.
                        </small>
                    </div>

                    <div className="form-field">
                        <span className="form-label">스트리밍 서비스</span>
                        <div className="admin-panel__checkboxes">
                            {STREAMING_OPTIONS.map((platform) => (
                                <label key={platform}>
                                    <input
                                        type="checkbox"
                                        checked={form.streamingPlatforms.includes(platform)}
                                        onChange={() => togglePlatform(platform)}
                                    />
                                    <span>{platform}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn--primary"
                        disabled={submitBusy}
                    >
                        {submitLabel}
                    </button>
                </form>

                <form className="admin-panel__form admin-panel__form--danger" onSubmit={handleDelete}>
                    <h4 className="admin-panel__form-title">영화 삭제</h4>
                    <div className="form-field">
                        <label className="form-label" htmlFor="admin-delete">
                            삭제할 영화
                        </label>
                        <select
                            id="admin-delete"
                            className="form-input"
                            value={movieToDelete}
                            onChange={(e) => setMovieToDelete(e.target.value)}
                        >
                            <option value="">영화를 선택하세요</option>
                            {sortedMovies.map((movie) => (
                                <option key={movie.id} value={movie.id}>
                                    {movie.title} ({movie.year})
                                </option>
                            ))}
                        </select>
                        <small className="admin-panel__hint">
                            삭제 시 리뷰, 좋아요, 통계가 모두 제거됩니다.
                        </small>
                    </div>

                    <button
                        type="submit"
                        className="btn btn--ghost"
                        style={{ color: "#f87171" }}
                        disabled={isDeleting}
                    >
                        {isDeleting ? "삭제 중..." : "선택한 영화 삭제"}
                    </button>
                </form>
            </div>
        </section>
    );
};

export default AdminMoviePanel;
