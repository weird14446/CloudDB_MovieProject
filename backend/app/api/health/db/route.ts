import { withConnection } from "@/lib/db";
import { corsJson, corsEmpty } from "@/lib/cors";

export async function GET() {
  try {
    const result = await withConnection(async (conn) => {
      const [rows] = await conn.query<{ version: string }[]>("SELECT VERSION() AS version");
      return rows[0]?.version ?? "unknown";
    });

    return corsJson({
      ok: true,
      engine: "mysql",
      version: result,
      time: new Date().toISOString(),
    });
  } catch (error) {
    return corsJson(
      {
        ok: false,
        error: error instanceof Error ? error.message : "DB health check failed",
      },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return corsEmpty();
}
