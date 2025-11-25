import { randomBytes } from "crypto";
import { withConnection } from "./db";
import { hashPassword } from "./password";

export type BasicUser = {
    id: number;
    name: string;
    email: string;
};

function safeDisplayName(email: string, name?: string | null): string {
    const trimmed = name?.trim();
    if (trimmed && trimmed.length > 1) return trimmed;
    const local = email.split("@")[0] ?? "user";
    return local || "user";
}

export async function findOrCreateUserByEmail(
    email: string,
    name?: string | null
): Promise<BasicUser> {
    const normalizedEmail = email.trim().toLowerCase();
    return withConnection(async (conn) => {
        const [existing] = await conn.query<BasicUser[]>(
            "SELECT id, name, email FROM users WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );
        if (existing.length) {
            return existing[0];
        }

        const randomSecret = randomBytes(16).toString("hex");
        const passwordHash = hashPassword(randomSecret);
        const displayName = safeDisplayName(normalizedEmail, name);

        const [result] = await conn.query<{ insertId: number }>(
            `
            INSERT INTO users (name, email, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, NOW(), NOW())
        `,
            [displayName, normalizedEmail, passwordHash]
        );

        return {
            id: result.insertId,
            name: displayName,
            email: normalizedEmail,
        };
    });
}
