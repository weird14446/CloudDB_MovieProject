import crypto from "crypto";
import { findOrCreateUserByEmail, type BasicUser } from "../users";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

type GoogleConfig = {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    stateSecret: string;
};

type TokenResponse = {
    access_token: string;
    id_token?: string;
    expires_in: number;
    token_type: string;
    refresh_token?: string;
    scope?: string;
};

type GoogleProfile = {
    id: string;
    email: string;
    name?: string;
    picture?: string;
    verified_email?: boolean;
};

function requireConfig(): GoogleConfig {
    const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, OAUTH_STATE_SECRET } =
        process.env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
        throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI를 설정해주세요.");
    }
    return {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        redirectUri: GOOGLE_REDIRECT_URI,
        stateSecret: OAUTH_STATE_SECRET || "film-navi-oauth-state",
    };
}

function hmac(secret: string, value: string): string {
    return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function signState(payload: { origin?: string | null }): string {
    const { stateSecret } = requireConfig();
    const body = JSON.stringify({
        origin: payload.origin ?? null,
        ts: Date.now(),
        nonce: crypto.randomUUID(),
    });
    const sig = hmac(stateSecret, body);
    return Buffer.from(JSON.stringify({ body, sig })).toString("base64url");
}

export function verifyState(state?: string | null): { ok: boolean; origin?: string | null } {
    if (!state) return { ok: false };
    try {
        const decoded = Buffer.from(state, "base64url").toString("utf8");
        const parsed = JSON.parse(decoded) as { body: string; sig: string };
        const { body, sig } = parsed;
        const { stateSecret } = requireConfig();
        if (sig !== hmac(stateSecret, body)) return { ok: false };
        const payload = JSON.parse(body) as { origin?: string | null };
        return { ok: true, origin: payload.origin ?? null };
    } catch {
        return { ok: false };
    }
}

export function buildGoogleAuthUrl(origin?: string | null): string {
    const { clientId, redirectUri } = requireConfig();
    const state = signState({ origin });
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid email profile",
        access_type: "offline",
        include_granted_scopes: "true",
        state,
        prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    const { clientId, clientSecret, redirectUri } = requireConfig();
    const params = new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
    });

    const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || `Google 토큰 교환 실패 (${response.status})`);
    }

    return (await response.json()) as TokenResponse;
}

export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
    const response = await fetch(USERINFO_ENDPOINT, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || `Google 사용자 정보를 가져오지 못했습니다. (${response.status})`);
    }
    return (await response.json()) as GoogleProfile;
}

export async function ensureUserFromGoogle(accessToken: string): Promise<BasicUser> {
    const profile = await fetchGoogleProfile(accessToken);
    if (!profile.email) {
        throw new Error("Google 계정 이메일을 확인하지 못했습니다.");
    }
    return findOrCreateUserByEmail(profile.email, profile.name);
}
