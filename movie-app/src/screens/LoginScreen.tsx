import React, { useState } from "react";
import { login as requestLogin } from "../api/authService";

type AuthCallbackPayload = {
    name: string;
    email: string;
    password: string;
    userId?: number;
};

type LoginScreenProps = {
    onLogin: (payload: AuthCallbackPayload) => void | Promise<void>;
    onClose: () => void;
    onGoSignup: () => void;
};

const LoginScreen: React.FC<LoginScreenProps> = ({
    onLogin,
    onClose,
    onGoSignup,
}) => {
    const [email, setEmail] = useState<string>("");
    const [pw, setPw] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<boolean>(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError(null);

        const trimmedEmail = email.trim();
        if (!trimmedEmail || !pw) {
            setError("이메일과 비밀번호를 입력해주세요.");
            return;
        }

        const loginEmail =
            trimmedEmail.toLowerCase() === "root" ? "root@dev.local" : trimmedEmail.toLowerCase();
        try {
            setBusy(true);

            const response = await requestLogin({
                email: loginEmail,
                password: pw,
            });

            if (!response.ok || !response.user) {
                setError(response.message ?? "이메일 또는 비밀번호가 올바르지 않습니다.");
                return;
            }

            await Promise.resolve(
                onLogin({
                    name: response.user.name,
                    email: response.user.email,
                    password: pw,
                    userId: response.user.id,
                })
            );
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.";
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
                                로그인해서 취향 맞는 영화 찾기
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
                            비밀번호는 암호화되어 데이터베이스에 저장됩니다.
                        </span>
                    </label>

                    <button className="btn btn--primary" disabled={busy}>
                        {busy ? "로그인 중..." : "로그인"}
                    </button>

                    <p className="form-hint" style={{ marginTop: 8, textAlign: "center" }}>
                        아직 계정이 없나요?{" "}
                        <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={onGoSignup}
                            style={{ paddingInline: 10 }}
                        >
                            회원가입
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default LoginScreen;
