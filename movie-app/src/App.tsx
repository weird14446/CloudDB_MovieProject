// src/App.tsx
import React, { useState } from "react";
import "./App.css";
import LoginScreen from "./screens/LoginScreen";
import GenreScreen from "./screens/GenreScreen";
import MovieScreen from "./screens/MovieScreen";
import type { User, Genre, Movie } from "./types";


// 데모 장르/영화 데이터 (나중에 TMDb + DB로 교체 가능)
const DEMO_GENRES: Genre[] = [
  { id: 1, slug: "action", name: "액션" },
  { id: 2, slug: "comedy", name: "코미디" },
  { id: 3, slug: "drama", name: "드라마" },
  { id: 4, slug: "romance", name: "로맨스" },
  { id: 5, slug: "sf", name: "SF" },
];

const DEMO_MOVIES: Movie[] = [
  {
    id: 1,
    title: "도시의 추격자",
    year: 2020,
    genres: ["action"],
    posterUrl:
      "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 2,
    title: "웃음 연구소",
    year: 2019,
    genres: ["comedy"],
    posterUrl:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 3,
    title: "눈물의 계절",
    year: 2021,
    genres: ["drama"],
    posterUrl:
      "https://images.unsplash.com/photo-1517602302552-471fe67acf66?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 4,
    title: "너와 나의 거리",
    year: 2018,
    genres: ["romance", "drama"],
    posterUrl:
      "https://images.unsplash.com/photo-1529634892667-3c0b5b1c5c48?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 5,
    title: "별을 향한 시간",
    year: 2022,
    genres: ["sf", "drama"],
    posterUrl:
      "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: 6,
    title: "액션 코미디 콜라보",
    year: 2017,
    genres: ["action", "comedy"],
    posterUrl:
      "https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?q=80&w=800&auto=format&fit=crop",
  },
];

type Step = "login" | "genres" | "movies";

function App() {
  const [step, setStep] = useState<Step>("login");
  const [user, setUser] = useState<User | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);

  // 로그인 시 호출
  function handleLogin(name: string, email: string, password: string): void {
    const newUser: User = { name, email };
    setUser(newUser);

    // 이전에 이 이메일로 선호 장르를 저장한 적이 있는지 확인
    try {
      const raw = localStorage.getItem(`preferredGenres:${email}`);
      if (raw) {
        const saved = JSON.parse(raw) as unknown;
        if (Array.isArray(saved) && saved.every((s) => typeof s === "string")) {
          const genres = saved as string[];
          if (genres.length > 0) {
            setSelectedGenres(genres);
            setStep("movies"); // 이미 선호 장르 있음 → 바로 영화 리스트
            return;
          }
        }
      }
    } catch {
      // localStorage 에러 시에는 그냥 장르 선택 화면으로
    }

    // 저장된 선호 장르 없으면 → 장르 선택 화면
    setStep("genres");
  }

  // 선호 장르 선택 완료 시 호출
  function handleSaveGenres(): void {
    if (!user) return;
    try {
      localStorage.setItem(
        `preferredGenres:${user.email}`,
        JSON.stringify(selectedGenres)
      );
    } catch {
      // 저장 실패해도 흐름은 계속 진행
    }
    setStep("movies");
  }

  // 영화 리스트에서 "처음부터 다시 선택"
  function handleRestart(): void {
    setStep("genres");
  }

  if (step === "login" || !user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (step === "genres") {
    return (
      <GenreScreen
        user={user}
        genres={DEMO_GENRES}
        selected={selectedGenres}
        onChangeSelected={setSelectedGenres}
        onNext={handleSaveGenres}
      />
    );
  }

  return (
    <MovieScreen
      user={user}
      genres={DEMO_GENRES}
      selectedGenres={selectedGenres}
      movies={DEMO_MOVIES}
      onRestart={handleRestart}
    />
  );
}

export default App;
