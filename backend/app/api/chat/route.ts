import { NextResponse } from "next/server";
import { generateChatReply, type ChatHistoryItem } from "@/lib/gemini";
import { getPool } from "@/lib/db";
import { RATING_STATS_SUBQUERY } from "@/lib/sql";

type MovieRow = {
    id: number;
    title: string;
    year: number;
    director: string | null;
    avg_rating: number | null;
    weighted_rating: number | null;
    vote_count: number | null;
    like_count: number | null;
};

type GenreRow = {
    movie_id: number;
    name: string;
};

type MovieForContext = {
    id: number;
    title: string;
    year: number;
    director: string;
    genres: string[];
    genreSlugs: string[];
    rating: number | null;
    likeCount: number;
    slugTitle: string;
    slugDirector: string;
};

function toSlug(value?: string | null): string {
    return (
        value
            ?.trim()
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, "")
            .replace(/\s+/g, "-") ?? ""
    );
}

function tokenize(value: string): string[] {
    const slug = toSlug(value);
    return slug
        .split(/[\s-]+/)
        .filter((token) => token.length >= 2)
        .slice(0, 12);
}

async function loadMovieCatalog(): Promise<MovieForContext[]> {
    const pool = getPool();
    const [movieRows] = await pool.query<MovieRow[]>(
        `
        SELECT m.id,
               m.title,
               m.year,
               dir.director_names AS director,
               stats.avg_rating,
               stats.weighted_rating,
               stats.vote_count,
               COALESCE(likes.like_count, 0) AS like_count
        FROM movies m
        LEFT JOIN (
            SELECT md.movie_id,
                   GROUP_CONCAT(p.name ORDER BY p.name SEPARATOR ', ') AS director_names
            FROM movie_directors md
            JOIN people p ON p.id = md.person_id
            GROUP BY md.movie_id
        ) dir ON dir.movie_id = m.id
        LEFT JOIN (
            ${RATING_STATS_SUBQUERY}
        ) stats ON stats.movie_id = m.id
        LEFT JOIN (
            SELECT movie_id, COUNT(*) AS like_count
            FROM likes
            GROUP BY movie_id
        ) likes ON likes.movie_id = m.id
        ORDER BY m.id DESC
        LIMIT 200
    `
    );

    if (movieRows.length === 0) {
        return [];
    }

    const movieIds = movieRows.map((row) => row.id);
    const [genreRows] =
        movieIds.length > 0
            ? await pool.query<GenreRow[]>(
                `
                SELECT mg.movie_id, g.name
                FROM movie_genres mg
                JOIN genres g ON g.id = mg.genre_id
                WHERE mg.movie_id IN (?)
            `,
                [movieIds]
            )
            : [[] as GenreRow[]];

    const genresByMovie = genreRows.reduce<Record<number, string[]>>(
        (acc, row) => {
            const list = acc[row.movie_id] ?? [];
            list.push(row.name);
            acc[row.movie_id] = list;
            return acc;
        },
        {}
    );

    return movieRows.map((row) => {
        const genres = genresByMovie[row.id] ?? [];
        const genreSlugs = genres.map((name) => toSlug(name)).filter(Boolean);
        const rating =
            row.weighted_rating != null
                ? Number(row.weighted_rating)
                : row.avg_rating != null
                    ? Number(row.avg_rating)
                    : null;

        return {
            id: row.id,
            title: row.title,
            year: row.year,
            director: row.director ?? "미상",
            genres,
            genreSlugs,
            rating,
            likeCount: row.like_count ?? 0,
            slugTitle: toSlug(row.title),
            slugDirector: toSlug(row.director),
        };
    });
}

function selectRelevantMovies(
    catalog: MovieForContext[],
    message: string
): MovieForContext[] {
    if (catalog.length === 0) return [];

    const tokens = tokenize(message);
    const tokenSet = new Set(tokens);
    const hasTokens = tokenSet.size > 0;
    const limit = hasTokens ? 12 : 8;

    const scored = catalog.map((movie) => {
        let score = 0;
        if (hasTokens) {
            tokenSet.forEach((token) => {
                if (movie.slugTitle.includes(token)) score += 3;
                if (movie.slugDirector.includes(token)) score += 2;
                if (movie.genreSlugs.some((g) => g.includes(token))) score += 2;
            });
            if (score > 0 && movie.rating != null) {
                score += movie.rating / 10;
            }
        }

        const popularity = Math.min(movie.likeCount, 1000) / 500;
        const quality = movie.rating != null ? movie.rating / 10 : 0;
        const recency = Math.max(0, Math.min(1, (movie.year - 2000) / 30));
        const base = quality + popularity + recency * 0.2;

        return { movie, score: score + base };
    });

    const selected = scored
        .sort((a, b) => b.score - a.score)
        .map((item) => item.movie)
        .slice(0, limit);

    if (hasTokens && selected.length < 4) {
        const topRated = catalog
            .slice()
            .sort((a, b) => {
                const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
                if (ratingDiff !== 0) return ratingDiff;
                const likeDiff = (b.likeCount ?? 0) - (a.likeCount ?? 0);
                if (likeDiff !== 0) return likeDiff;
                return b.year - a.year;
            })
            .slice(0, 6);

        topRated.forEach((movie) => {
            if (!selected.some((existing) => existing.id === movie.id)) {
                selected.push(movie);
            }
        });
    }

    return selected.slice(0, limit);
}

function buildContextBlock(movies: MovieForContext[]): string {
    if (!movies.length) {
        return "DB에서 불러온 영화 목록이 없습니다. 목록에 없는 영화는 추천하지 말고 사과하세요.";
    }

    const lines = movies.map((movie, idx) => {
        const genres =
            movie.genres.length > 0 ? movie.genres.join(", ") : "장르 정보 없음";
        const ratingLabel =
            movie.rating != null ? `★ ${movie.rating.toFixed(1)}` : "평점 정보 없음";
        return `${idx + 1}. ${movie.title} (${movie.year}) · 감독 ${movie.director} · ${genres} · ${ratingLabel}`;
    });

    return [
        "아래는 현재 DB에 등록된 영화 목록입니다.",
        "반드시 이 목록에 포함된 영화만 언급하거나 추천하세요.",
        "목록에 없는 영화는 추천하지 말고, DB에 없다고 안내하세요.",
        lines.join("\n"),
    ].join("\n");
}

export async function GET() {
    return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}));
        const message =
            typeof body?.message === "string" ? body.message.trim() : "";
        const historyInput = Array.isArray(body?.history) ? body.history : [];

        if (!message) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        const history: ChatHistoryItem[] = historyInput
            .map((item) => ({
                role: item?.role === "assistant" ? "assistant" : "user",
                content:
                    typeof item?.content === "string" ? item.content.trim() : "",
            }))
            .filter((item) => item.content.length > 0)
            .slice(-10);

        let catalog: MovieForContext[] = [];
        try {
            catalog = await loadMovieCatalog();
        } catch (error) {
            console.error("[Chat API] catalog load error:", error);
        }

        const candidates = selectRelevantMovies(catalog, message);
        const contextBlock = buildContextBlock(candidates);
        const ragPrompt = `${contextBlock}\n\n사용자 질문: ${message}\n\n규칙: 위 목록에 없는 영화는 추천하지 말고, 목록 안에서 2~3편 정도만 간단히 제안하세요.`;

        const reply = await generateChatReply(ragPrompt, history);

        return NextResponse.json({ response: reply });
    } catch (error) {
        console.error("[Chat API] Error:", error);
        const message =
            error instanceof Error
                ? error.message
                : "Internal Server Error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
