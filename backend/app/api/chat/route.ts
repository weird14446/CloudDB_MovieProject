import { NextResponse } from "next/server";

export async function GET() {
    return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request) {
    try {
        console.log("[Chat API] Received request");
        const body = await request.json();
        const { message, history } = body;

        console.log("[Chat API] Message:", message);

        if (!message) {
            return NextResponse.json(
                { error: "Message is required" },
                { status: 400 }
            );
        }

        // Mock response for now
        // In a real implementation, this would call an LLM API
        const mockResponses = [
            "That's an interesting perspective on movies!",
            "I can definitely recommend some sci-fi movies if you're interested.",
            "Have you seen 'Inception'? It's a classic.",
            "I'm just a simple AI, but I love talking about cinema.",
            "Could you tell me more about your favorite genre?",
        ];

        const randomResponse =
            mockResponses[Math.floor(Math.random() * mockResponses.length)];

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        console.log("[Chat API] Sending response");
        return NextResponse.json({
            response: `[Mock AI]: ${randomResponse} (You said: "${message}")`,
        });
    } catch (error) {
        console.error("[Chat API] Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
