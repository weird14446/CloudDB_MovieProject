import React, { useState } from "react";
import { login as requestLogin } from "../api/authService";
import { getGoogleAuthUrl } from "../api/oauthService";

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

const LoginScreen: React.FC<LoginScreenProps> = ({
    onLogin,
    onClose,
    onGoSignup,
}) => {
    const [email, setEmail] = useState<string>("");
    const [pw, setPw] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<boolean>(false);
    const [oauthBusy, setOauthBusy] = useState<boolean>(false);

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
            const msg = extractErrorMessage(
                err,
                "로그인에 실패했습니다. 입력 정보를 다시 확인해주세요."
            );
            setError(msg);
        } finally {
            setBusy(false);
        }
    }

    async function handleGoogleLogin() {
        setError(null);
        setOauthBusy(true);
        try {
            const origin = typeof window !== "undefined" ? window.location.origin : undefined;
            const response = await getGoogleAuthUrl(origin);
            if (!response.ok || !response.authUrl) {
                setError(response.message ?? "Google 로그인 URL을 만들지 못했습니다.");
                setOauthBusy(false);
                return;
            }

            const popup = window.open(
                response.authUrl,
                "oauth-google",
                "width=500,height=650"
            );
            if (!popup) {
                setError("팝업을 열 수 없습니다. 팝업 차단을 해제해주세요.");
                setOauthBusy(false);
                return;
            }

            const timer = setInterval(() => {
                if (popup.closed) {
                    clearInterval(timer);
                    setOauthBusy(false);
                }
            }, 500);

            const listener = (event: MessageEvent) => {
                const data = event.data;
                if (!data || data.type !== "oauth-google") return;
                window.removeEventListener("message", listener);
                clearInterval(timer);
                setOauthBusy(false);
                popup.close();

                if (!data.ok || !data.user) {
                    setError(data.message ?? "Google 로그인에 실패했습니다.");
                    return;
                }

                Promise.resolve(
                    onLogin({
                        name: data.user.name,
                        email: data.user.email,
                        password: "",
                        userId: data.user.id,
                    })
                ).catch((err) => {
                    const msg =
                        err instanceof Error
                            ? err.message
                            : "로그인 처리 중 오류가 발생했습니다.";
                    setError(msg);
                });
            };

            window.addEventListener("message", listener);
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Google 로그인에 실패했습니다.";
            setError(msg);
            setOauthBusy(false);
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

                    <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={handleGoogleLogin}
                        disabled={oauthBusy}
                        style={{ marginTop: 8 }}
                    >
                        {oauthBusy ? "Google 로그인 중..." : "Google로 로그인"}
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
