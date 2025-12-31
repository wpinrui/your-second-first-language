import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import { getErrorMessage, capitalize } from "../utils/strings";
import { LearningMode } from "../types/modes";
import ModeTabs from "./ModeTabs";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function generateMessageId(): string {
  return crypto.randomUUID();
}

/** Strip mode prefix from user messages. Looks for <<<MSG>>> delimiter. */
const MODE_PREFIX_DELIMITER = "<<<MSG>>>";

function stripModePrefix(content: string): string {
  const delimiterIndex = content.indexOf(MODE_PREFIX_DELIMITER);
  if (delimiterIndex !== -1) {
    return content.slice(delimiterIndex + MODE_PREFIX_DELIMITER.length).trimStart();
  }
  return content;
}

type Props = {
  language: string;
  mode: LearningMode;
  onBack: () => void;
  onModeChange: (mode: LearningMode) => void;
};

export default function ChatView({ language, mode, onBack, onModeChange }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatHistory();
  }, [language, mode]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, isLoadingHistory]);

  async function loadChatHistory() {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const history = await invoke<Omit<Message, "id">[]>("get_chat_history", { language, mode });
      setMessages(history.map(msg => ({ ...msg, id: generateMessageId() })));
    } catch (error) {
      console.error("Failed to load chat history:", error);
      setHistoryError(getErrorMessage(error));
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
        mode,
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="container">
      <header>
        <h1>Learning {displayName}</h1>
        <ModeTabs currentMode={mode} onModeChange={onModeChange} />
        <button className="back-btn" onClick={onBack}>
          Change Mode
        </button>
      </header>

      <div className="chat-container" ref={chatContainerRef}>
        {isLoadingHistory && (
          <p className="hint">Loading conversation...</p>
        )}
        {historyError && (
          <p className="hint error">Failed to load history: {historyError}</p>
        )}
        {!isLoadingHistory && !historyError && messages.length === 0 && (
          <p className="hint">Say hello to start learning!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role}`}>
            <ReactMarkdown>
              {msg.role === "user" ? stripModePrefix(msg.content) : msg.content}
            </ReactMarkdown>
          </div>
        ))}
        {isLoading && <div className="message assistant loading">...</div>}
      </div>

      <div className="input-container">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
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
