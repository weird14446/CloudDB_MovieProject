"use client";

export default function Home() {
  return (
    <main
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1>FilmNavi Backend</h1>
        <p>API 서버가 실행 중입니다.</p>
      </div>
    </main>
  );
}
