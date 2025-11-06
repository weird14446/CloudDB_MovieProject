import React from "react";
import type { User, Genre } from "../types";

type GenreScreenProps = {
    user: User;
    genres: Genre[];
    selected: string[];
    onChangeSelected: (next: string[]) => void;
    onNext: () => void;
    onClose: () => void;
};

const GenreScreen: React.FC<GenreScreenProps> = ({
    user,
    genres,
    selected,
    onChangeSelected,
    onNext,
    onClose,
}) => {
    function toggleSlug(slug: string) {
        if (selected.includes(slug)) {
            onChangeSelected(selected.filter((s) => s !== slug));
        } else {
            onChangeSelected([...selected, slug]);
        }
    }

    return (
        <div className="modal">
            <div className="card card--glass modal-card">
                <div className="modal-header">
                    <div>
                        <div className="badge">Step · 선호 장르</div>
                        <h1 className="card-title">
                            {user.name}님의 선호 장르를 선택해주세요
                        </h1>
                        <p className="card-subtitle">
                            여러 개 선택할 수 있고, 나중에 언제든지 다시 변경할 수 있습니다.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>

                <div className="genre-grid">
                    {genres.map((g) => {
                        const active = selected.includes(g.slug);
                        return (
                            <button
                                key={g.slug}
                                type="button"
                                className={
                                    "genre-pill" +
                                    (active ? " genre-pill--active" : "")
                                }
                                onClick={() => toggleSlug(g.slug)}
                            >
                                {g.name}
                            </button>
                        );
                    })}
                </div>

                <div className="modal-footer">
                    <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={onClose}
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        className="btn btn--primary"
                        onClick={onNext}
                    >
                        선호 장르 저장
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GenreScreen;
