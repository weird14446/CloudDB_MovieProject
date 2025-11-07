import { getPool } from "@/lib/db";
import { corsJson, corsEmpty } from "@/lib/cors";
import { hashPassword } from "@/lib/password";

type LoginBody = {
    email?: string;
    password?: string;
};

export async function POST(request: Request) {
    const body: LoginBody = await request.json();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
        return corsJson(
            { ok: false, message: "이메일과 비밀번호를 입력해주세요." },
            { status: 400 }
        );
    }

    const pool = getPool();
    try {
        const hashed = hashPassword(password);
        const [rows] = await pool.query<{ id: number; name: string; email: string }[]>(
            `
            SELECT id, name, email
            FROM users
            WHERE email = ? AND password_hash = ?
            LIMIT 1
        `,
            [email, hashed]
        );

        if (!rows.length) {
            return corsJson(
                {
                    ok: false,
                    message: "입력하신 이메일 또는 비밀번호를 다시 확인해주세요.",
                },
                { status: 401 }
            );
        }

        return corsJson({ ok: true, user: rows[0] });
    } catch (error) {
        console.error("[auth/login]", error);
        return corsJson(
            { ok: false, message: "로그인에 실패했습니다." },
            { status: 500 }
        );
    }
}

export function OPTIONS() {
    return corsEmpty();
}
