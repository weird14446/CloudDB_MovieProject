import React, { useState } from "react";
import { signup as requestSignup } from "../api/authService";

type AuthCallbackPayload = {
    name: string;
    email: string;
    password: string;
    userId?: number;
};

type SignupScreenProps = {
    onSignup: (payload: AuthCallbackPayload) => void | Promise<void>;
    onClose: () => void;
    onGoLogin: () => void;
};

function extractErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && typeof error.message === "string") {
        const trimmed = error.message.trim();
        if (trimmed.startsWith("{")) {
            try {
                const parsed = JSON.parse(trimmed);
                if (typeof parsed?.message === "string" && parsed.message.trim().length > 0) {
                    return parsed.message;
                }
            } catch {
                // ignore
            }
        } else if (trimmed.length > 0) {
            return trimmed;
        }
    }
    if (typeof error === "string" && error.trim().length > 0) {
        return error.trim();
    }
    return fallback;
}

const SignupScreen: React.FC<SignupScreenProps> = ({
    onSignup,
    onClose,
    onGoLogin,
}) => {
    const [name, setName] = useState<string>("");
    const [email, setEmail] = useState<string>("");
    const [pw, setPw] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<boolean>(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        if (!name.trim() || !email || !pw) {
            setError("이름, 이메일, 비밀번호를 모두 입력해주세요.");
            return;
        }

        try {
            setBusy(true);

            const response = await requestSignup({
                name: name.trim(),
                email: email.trim().toLowerCase(),
                password: pw,
            });

            if (!response.ok || !response.user) {
                setError(response.message ?? "회원가입에 실패했습니다.");
                return;
            }

            await Promise.resolve(
                onSignup({
                    name: response.user.name,
                    email: response.user.email,
                    password: pw,
                    userId: response.user.id,
                })
            );
        } catch (err) {
            const msg = extractErrorMessage(
                err,
                "회원가입에 실패했습니다. 입력 정보를 다시 확인해주세요."
            );
            setError(msg);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="modal">
            <div className="card card--glass login-card modal-card">
                <div className="modal-header">
                    <div className="app-logo">
                        <div className="app-logo__mark">F</div>
                        <div className="app-logo__text">
                            <div className="app-logo__title">FilmNavi</div>
                            <div className="app-logo__subtitle">
                                회원가입하고 취향 맞는 영화 찾기
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={onClose}
                    >
                        닫기
                    </button>
                </div>

                {error && <div className="alert alert--error">{error}</div>}

                <form className="form" onSubmit={handleSubmit}>
                    <label className="form-field">
                        <span className="form-label">이름</span>
                        <input
                            className="form-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="홍길동"
                        />
                    </label>

                    <label className="form-field">
                        <span className="form-label">이메일</span>
                        <input
                            className="form-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            type="email"
                        />
                    </label>

                    <label className="form-field">
                        <span className="form-label">비밀번호</span>
                        <input
                            className="form-input"
                            value={pw}
                            onChange={(e) => setPw(e.target.value)}
                            placeholder="••••••••"
                            type="password"
                        />
                        <span className="form-hint">
                            입력한 정보는 안전하게 서버에 저장됩니다.
                        </span>
                    </label>

                    <button className="btn btn--primary" disabled={busy}>
                        {busy ? "회원가입 중..." : "회원가입 후 시작하기"}
                    </button>

                    <p className="form-hint" style={{ marginTop: 8, textAlign: "center" }}>
                        이미 계정이 있나요?{" "}
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={onGoLogin}
                            style={{ paddingInline: 10 }}
                        >
                            로그인으로 돌아가기
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default SignupScreen;
