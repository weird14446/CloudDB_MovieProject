const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function resolveModel(): string {
    const fromEnv = process.env.GEMINI_MODEL?.trim();
    return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_GEMINI_MODEL;
}

function buildEndpoint(model: string): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

const SYSTEM_PROMPT =
    "You are FilmNavi AI, a concise Korean movie assistant. Answer in Korean by default. Be brief (max 3 short sentences). " +
    "Prioritize practical help: explain how to use the app (로그인, 장르 선택, 좋아요/리뷰, 관리자 패널) and recommend movies with title and 연도. " +
    "If unsure, say you are unsure rather than making up facts. Keep tone friendly and clear. " +
    "Do NOT use markdown, bold, headings, or bullet lists—respond in plain text sentences only.";

type GeminiPart = { text?: string };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

export type ChatHistoryItem = { role: "user" | "assistant"; content: string };

type GeminiPromptFeedback = {
    blockReason?: string;
    safetyRatings?: Array<{ category?: string; probability?: string }>;
};

function requireApiKey(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");
    }
    return key;
}

function toGeminiRole(role: string): "user" | "model" {
    return role === "assistant" ? "model" : "user";
}

function buildContents(history: ChatHistoryItem[], message: string): GeminiContent[] {
    const sanitizedHistory = history
        .filter((item) => typeof item?.content === "string" && item.content.trim().length > 0)
        .slice(-8); // 최근 대화 위주로 전송

    const mappedHistory = sanitizedHistory.map<GeminiContent>((item) => ({
        role: toGeminiRole(item.role),
        parts: [{ text: item.content }],
    }));

    return [
        {
            role: "user",
            parts: [{ text: SYSTEM_PROMPT }],
        },
        ...mappedHistory,
        {
            role: "user",
            parts: [{ text: message }],
        },
    ];
}

type GeminiResponse = {
    candidates?: Array<{
        content?: { parts?: GeminiPart[] };
        finishReason?: string;
    }>;
    promptFeedback?: GeminiPromptFeedback;
};

function sanitizeReply(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .trim();
}

export async function generateChatReply(
    message: string,
    history: ChatHistoryItem[]
): Promise<string> {
    const apiKey = requireApiKey();
    const model = resolveModel();
    const contents = buildContents(history, message);

    const payload = {
        contents,
        generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 320,
        },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
        const response = await fetch(`${buildEndpoint(model)}?key=${apiKey}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            throw new Error(detail || `Gemini 요청 실패 (status ${response.status})`);
        }

        const data = (await response.json()) as GeminiResponse;
        const reply =
            data.candidates
                ?.flatMap((candidate) => candidate.content?.parts ?? [])
                .map((part) => part.text || "")
                .join("")
                .trim() ?? "";

        if (!reply) {
            const blocked =
                data.promptFeedback?.blockReason ||
                data.candidates?.find((c) =>
                    (c.finishReason ?? "").toLowerCase().includes("safety")
                )?.finishReason;
            if (blocked) {
                return "안전 정책으로 답변이 차단되었습니다. 질문을 조금 더 구체적이고 안전하게 바꿔주세요.";
            }
            return "지금은 답변을 생성하지 못했어요. 질문을 조금만 바꿔서 다시 시도해 주세요.";
        }

        return sanitizeReply(reply);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "알 수 없는 오류로 응답 생성에 실패했습니다.";
        if (message.includes("The user aborted")) {
            throw new Error("Gemini 요청 시간이 초과되었습니다.");
        }
        throw new Error(message);
    } finally {
        clearTimeout(timeout);
    }
}
