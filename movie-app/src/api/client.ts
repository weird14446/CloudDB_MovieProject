const DEFAULT_BASE_URL = "/api";

function resolveBaseUrl(): string {
    const fromEnv = import.meta.env.VITE_API_BASE_URL;
    if (typeof fromEnv === "string" && fromEnv.trim().length > 0) {
        return fromEnv.replace(/\/$/, "");
    }
    return DEFAULT_BASE_URL;
}

const API_BASE_URL = resolveBaseUrl();

type RequestOptions = RequestInit & {
    parse?: "json" | "text" | "blob";
};

async function parseResponse<T>(response: Response, parse: RequestOptions["parse"]): Promise<T> {
    if (parse === "text") {
        return (await response.text()) as unknown as T;
    }
    if (parse === "blob") {
        return (await response.blob()) as unknown as T;
    }
    if (response.status === 204) {
        return {} as T;
    }
    return (await response.json()) as T;
}

export async function apiRequest<T>(
    path: string,
    { parse = "json", headers, ...options }: RequestOptions = {}
): Promise<T> {
    const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
    const response = await fetch(url, {
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        ...options,
    });

    if (!response.ok) {
        const fallback = await response.text().catch(() => "");
        const message = fallback || `API 요청이 실패했습니다. (status: ${response.status})`;
        throw new Error(message);
    }

    return parseResponse<T>(response, parse);
}
