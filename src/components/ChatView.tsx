import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import { getErrorMessage, capitalize } from "../utils/strings";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function generateMessageId(): string {
  return crypto.randomUUID();
}

type Props = {
  language: string;
  onBack: () => void;
};

export default function ChatView({ language, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatHistory();
  }, [language]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, isLoadingHistory]);

  async function loadChatHistory() {
    setIsLoadingHistory(true);
    try {
      const history = await invoke<Omit<Message, "id">[]>("get_chat_history", { language });
      setMessages(history.map(msg => ({ ...msg, id: generateMessageId() })));
    } catch (error) {
      console.error("Failed to load chat history:", error);
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { id: generateMessageId(), role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await invoke<string>("send_message", {
        message: userMessage,
        language,
      });
      setMessages((prev) => [...prev, { id: generateMessageId(), role: "assistant", content: response }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: generateMessageId(), role: "assistant", content: `Error: ${getErrorMessage(error)}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const displayName = capitalize(language);

  return (
    <div className="container">
      <header>
        <h1>Learning {displayName}</h1>
        <button className="back-btn" onClick={onBack}>
          Change Language
        </button>
      </header>

      <div className="chat-container" ref={chatContainerRef}>
        {isLoadingHistory && (
          <p className="hint">Loading conversation...</p>
        )}
        {!isLoadingHistory && messages.length === 0 && (
          <p className="hint">Say hello to start learning!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ))}
        {isLoading && <div className="message assistant loading">...</div>}
      </div>

      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          disabled={isLoading}
          rows={1}
        />
        <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
