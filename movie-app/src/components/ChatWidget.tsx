import React, { useState, useRef, useEffect } from "react";
import { sendChatMessage, type ChatMessage } from "../api/chatService";
import "./ChatWidget.css";

const ChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: "user", content: input };
        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const result = await sendChatMessage(input, messages);
            if (result.response) {
                const aiMessage: ChatMessage = {
                    role: "assistant",
                    content: result.response,
                };
                setMessages((prev) => [...prev, aiMessage]);
            } else {
                // Handle error visually if needed
                const errorMessage: ChatMessage = {
                    role: "assistant",
                    content:
                        result.error || "Sorry, I encountered an error. Please try again.",
                };
                setMessages((prev) => [...prev, errorMessage]);
            }
        } catch (error) {
            console.error("Failed to send message", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={`chat-widget ${isOpen ? "open" : ""}`}>
            {!isOpen && (
                <button className="chat-toggle-btn" onClick={() => setIsOpen(true)}>
                    <span className="chat-toggle-icon">💬</span>
                    <span className="chat-toggle-text">AI</span>
                </button>
            )}
            {isOpen && (
                <div className="chat-window">
                    <div className="chat-header">
                        <div className="chat-title">
                            <p className="chat-kicker">AI GUIDE</p>
                            <div className="chat-title-row">
                                <h3>FilmNavi AI</h3>
                                <span className="chat-status-dot" />
                                <span className="chat-status-text">online</span>
                            </div>
                            <p className="chat-subtitle">
                                추천, 리뷰, 관리자 기능까지 궁금한 점을 물어보세요.
                            </p>
                        </div>
                        <button className="close-btn" onClick={() => setIsOpen(false)} aria-label="닫기">
                            ✕
                        </button>
                    </div>
                    <div className="chat-messages">
                        {messages.length === 0 && (
                            <div className="chat-placeholder">
                                영화 추천, 리뷰 작성 방법, 관리자 동기화 등 무엇이든 질문해보세요.
                            </div>
                        )}
                        {messages.map((msg, index) => (
                            <div key={index} className={`message ${msg.role}`}>
                                <div className="message-content">{msg.content}</div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="message assistant">
                                <div className="message-content typing-indicator">...</div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="chat-input-area">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="영화나 기능에 대해 질문을 남겨보세요"
                            rows={1}
                        />
                        <button onClick={handleSend} disabled={isLoading || !input.trim()}>
                            Send
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatWidget;
