import { withConnection } from "@/lib/db";
import { fetchTmdbMoviesAndGenres } from "@/lib/tmdb";
import { importMovies } from "@/lib/importer";
import { corsJson, corsEmpty } from "@/lib/cors";

const ADMIN_TOKEN = process.env.ADMIN_IMPORT_TOKEN || "root-import";

function authorize(request: Request): boolean {
    const header = request.headers.get("x-admin-token");
    return header === ADMIN_TOKEN;
}

export async function POST(request: Request) {
    if (!authorize(request)) {
    return corsJson({ ok: false, message: "인증 실패" }, { status: 401 });
  }

  try {
    const { movies } = await fetchTmdbMoviesAndGenres(30);
    const result = await withConnection(async (conn) => importMovies(conn, movies));
    return corsJson({ ok: true, ...result });
  } catch (error) {
    console.error("[admin/fetch-and-import]", error);
    return corsJson(
      {
        ok: false,
        message: error instanceof Error ? error.message : "TMDB 데이터 동기화 실패",
      },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return corsEmpty();
}
