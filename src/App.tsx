import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<string | null>(null);

  async function sendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await invoke<string>("send_message", {
        message: userMessage,
        language: language || "chinese",
      });
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${error}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  if (!language) {
    return (
      <div className="container">
        <h1>Your Second First Language</h1>
        <p>Choose a language to learn:</p>
        <div className="language-grid">
          {["Chinese", "Korean", "Japanese", "Spanish", "French", "German"].map(
            (lang) => (
              <button
                key={lang}
                className="language-btn"
                onClick={() => setLanguage(lang.toLowerCase())}
              >
                {lang}
              </button>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header>
        <h1>Learning {language.charAt(0).toUpperCase() + language.slice(1)}</h1>
        <button className="back-btn" onClick={() => setLanguage(null)}>
          Change Language
        </button>
      </header>

      <div className="chat-container">
        {messages.length === 0 && (
          <p className="hint">Say hello to start learning!</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {isLoading && <div className="message assistant loading">...</div>}
      </div>

      <div className="input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type a message..."
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
