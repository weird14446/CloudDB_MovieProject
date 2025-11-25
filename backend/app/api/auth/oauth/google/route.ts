import { NextResponse } from "next/server";
import { buildGoogleAuthUrl } from "@/lib/oauth/google";
import { corsJson, corsEmpty } from "@/lib/cors";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.searchParams.get("origin") || null;
  try {
    const authUrl = buildGoogleAuthUrl(origin);
    return corsJson({ ok: true, authUrl });
  } catch (error) {
    console.error("[auth/oauth/google] build url error", error);
    return corsJson(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "OAuth URL을 생성하지 못했습니다.",
      },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return corsEmpty();
}
