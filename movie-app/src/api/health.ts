import { apiRequest } from "./client";

export type DbHealth = {
    ok: boolean;
    engine?: string;
    version?: string;
    time?: string;
    error?: string;
};

export function checkDbHealth(): Promise<DbHealth> {
    return apiRequest<DbHealth>("/health/db");
}
