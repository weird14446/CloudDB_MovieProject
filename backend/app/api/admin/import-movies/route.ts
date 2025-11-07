import { withConnection } from "@/lib/db";
import type { Movie } from "@/lib/types";
import { importMovies } from "@/lib/importer";
import { corsJson, corsEmpty } from "@/lib/cors";

type ImportRequest = {
  movies?: Movie[];
};

const ADMIN_TOKEN = process.env.ADMIN_IMPORT_TOKEN || "root-import";

function authorize(request: Request): boolean {
  const header = request.headers.get("x-admin-token");
  return header === ADMIN_TOKEN;
}

export async function POST(request: Request) {
  if (!authorize(request)) {
    return corsJson({ ok: false, message: "인증 실패" }, { status: 401 });
  }

  const { movies }: ImportRequest = await request.json();
  if (!Array.isArray(movies) || movies.length === 0) {
    return corsJson({ ok: false, message: "movies 배열이 필요합니다." }, { status: 400 });
  }

  try {
    const result = await withConnection(async (conn) => importMovies(conn, movies));

    return corsJson({ ok: true, ...result });
  } catch (error) {
    console.error("[admin/import-movies]", error);
    return corsJson(
      {
        ok: false,
        message: error instanceof Error ? error.message : "영화 동기화 실패",
      },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return corsEmpty();
}
