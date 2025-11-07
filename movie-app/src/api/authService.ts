import { apiRequest } from "./client";
type AuthResponse = {
    ok: boolean;
    message?: string;
    user?: {
        id: number;
        name: string;
        email: string;
    };
};

export function signup(input: {
    name: string;
    email: string;
    password: string;
}): Promise<AuthResponse> {
    return apiRequest<AuthResponse>("/auth/signup", {
        method: "POST",
        body: JSON.stringify(input),
    });
}

export function login(input: {
    email: string;
    password: string;
}): Promise<AuthResponse> {
    return apiRequest<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify(input),
    });
}
