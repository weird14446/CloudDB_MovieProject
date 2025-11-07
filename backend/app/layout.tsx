export const metadata = {
  title: "FilmNavi Admin API",
  description: "Backend service for FilmNavi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
