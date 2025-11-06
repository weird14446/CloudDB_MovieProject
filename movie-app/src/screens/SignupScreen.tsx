import React, { useState } from "react";

type SignupScreenProps = {
    onSignup: (name: string, email: string, password: string) => void | Promise<void>;
    onClose: () => void;
    onGoLogin: () => void;
};

type StoredUser = {
    name: string;
    email: string;
    password: string;
    createdAt: string;
};

const USERS_KEY = "movieApp:users";

function loadUsers(): StoredUser[] {
    try {
        const raw = localStorage.getItem(USERS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (u) =>
                typeof u === "object" &&
                u !== null &&
                typeof (u as any).email === "string" &&
                typeof (u as any).password === "string"
        ) as StoredUser[];
    } catch {
        return [];
    }
}

function saveUsers(users: StoredUser[]) {
    try {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch {
        // 실패해도 무시
    }
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

            const users = loadUsers();
            const exists = users.find((u) => u.email === email.trim());
            if (exists) {
                setError("이미 가입된 이메일입니다. 로그인으로 진행해주세요.");
                return;
            }

            const newUser: StoredUser = {
                name: name.trim(),
                email: email.trim(),
                password: pw,
                createdAt: new Date().toISOString(),
            };

            saveUsers([...users, newUser]);

            await Promise.resolve(onSignup(newUser.name, newUser.email, pw));
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "회원가입 중 오류가 발생했습니다.";
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
                            현재는 브라우저 localStorage에만 저장됩니다.
                            실제 서비스에서는 HTTPS + 안전한 해시(bcrypt 등)를 사용해야 합니다.
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
