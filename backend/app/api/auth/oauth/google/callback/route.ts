import { NextResponse } from "next/server";
import {
  exchangeCodeForTokens,
  ensureUserFromGoogle,
  verifyState,
} from "@/lib/oauth/google";

function renderResultHtml(payload: Record<string, unknown>) {
  const safePayload = JSON.stringify(payload);
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script>
  (function() {
    const data = ${safePayload};
    if (window.opener) {
      window.opener.postMessage(data, "*");
    }
    window.close();
  })();
</script>
로그인 창을 닫아주세요.
</body>
</html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");

  const state = verifyState(stateParam);
  if (!code) {
    const html = renderResultHtml({
      type: "oauth-google",
      ok: false,
      message: "코드가 없습니다.",
    });
    return new NextResponse(html, {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const user = await ensureUserFromGoogle(tokens.access_token);

    const html = renderResultHtml({
      type: "oauth-google",
      ok: true,
      user,
      origin: state.origin ?? null,
    });
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html" },
    });
  } catch (error) {
    console.error("[auth/oauth/google/callback] error", error);
    const message =
      error instanceof Error ? error.message : "OAuth 처리에 실패했습니다.";
    const html = renderResultHtml({
      type: "oauth-google",
      ok: false,
      message,
    });
    return new NextResponse(html, {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
}
