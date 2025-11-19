const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export interface ChatResponse {
    response?: string;
    error?: string;
}

export async function sendChatMessage(
    message: string,
    history: ChatMessage[]
): Promise<ChatResponse> {
    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ message, history }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Chat API Error:", response.status, errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error("Chat Service Error:", error);
        return { error: error instanceof Error ? error.message : "Failed to send message" };
    }
}
