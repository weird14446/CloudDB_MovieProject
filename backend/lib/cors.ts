import { NextResponse } from "next/server";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-Admin-Token",
};

export function corsJson<T>(
  data: T,
  init?: Parameters<typeof NextResponse.json>[1]
) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...CORS_HEADERS,
    },
  });
}

export function corsEmpty(status = 204) {
  return new NextResponse(null, {
    status,
    headers: {
      ...CORS_HEADERS,
    },
  });
}
