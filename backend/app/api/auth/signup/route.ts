import { getPool } from "@/lib/db";
import { corsJson, corsEmpty } from "@/lib/cors";
import { hashPassword } from "@/lib/password";

type SignupBody = {
    name?: string;
    email?: string;
    password?: string;
};

export async function POST(request: Request) {
    const body: SignupBody = await request.json();
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!name || !email || !password) {
        return corsJson(
            { ok: false, message: "이름, 이메일, 비밀번호를 모두 입력해주세요." },
            { status: 400 }
        );
    }

    const pool = getPool();
    try {
        const hashed = hashPassword(password);
        const [result] = await pool.query<{ insertId: number }>(
            `
            INSERT INTO users (name, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
        `,
            [name, email, hashed]
        );
        return corsJson({
            ok: true,
            user: { id: result.insertId, name, email },
        });
    } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") {
            return corsJson(
                { ok: false, message: "이미 가입된 이메일입니다." },
                { status: 409 }
            );
        }
        console.error("[auth/signup]", error);
        return corsJson(
            { ok: false, message: "회원가입에 실패했습니다." },
            { status: 500 }
        );
    }
}

export function OPTIONS() {
    return corsEmpty();
}
