import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const PRESET_LANGUAGES = ["Chinese", "Korean", "Japanese", "Spanish", "French", "German"];

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<string | null>(null);
  const [existingLanguages, setExistingLanguages] = useState<string[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customLanguage, setCustomLanguage] = useState("");
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadExistingLanguages();
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading, isLoadingHistory]);

  async function loadExistingLanguages() {
    try {
      const languages = await invoke<string[]>("list_languages");
      setExistingLanguages(languages);
    } catch (error) {
      console.error("Failed to load languages:", error);
    }
  }

  async function loadChatHistory(lang: string) {
    setIsLoadingHistory(true);
    try {
      const history = await invoke<Message[]>("get_chat_history", { language: lang });
      setMessages(history);
    } catch (error) {
      console.error("Failed to load chat history:", error);
      setMessages([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function selectLanguage(lang: string) {
    if (!lang.trim()) return;

    const langLower = lang.toLowerCase();
    const exists = existingLanguages.map(l => l.toLowerCase()).includes(langLower);

    if (!exists) {
      setIsBootstrapping(true);
      try {
        await invoke("bootstrap_language", { language: lang });
        await loadExistingLanguages();
      } catch (error) {
        alert(`Failed to set up ${lang}: ${error}`);
        setIsBootstrapping(false);
        return;
      }
      setIsBootstrapping(false);
    }

    setLanguage(langLower);
    setShowCustomInput(false);
    setCustomLanguage("");

    // Load previous conversation
    await loadChatHistory(langLower);
  }

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
    // Combine preset languages with any existing custom ones
    const customExisting = existingLanguages.filter(
      lang => !PRESET_LANGUAGES.map(p => p.toLowerCase()).includes(lang.toLowerCase())
    );

    return (
      <div className="container">
        <h1>Your Second First Language</h1>
        <p>Choose a language to learn:</p>
        {isBootstrapping && <p className="hint">Setting up language...</p>}
        <div className="language-grid">
          {PRESET_LANGUAGES.map((lang) => {
            const isExisting = existingLanguages.map(l => l.toLowerCase()).includes(lang.toLowerCase());
            return (
              <button
                key={lang}
                className={`language-btn ${isExisting ? "existing" : ""}`}
                onClick={() => selectLanguage(lang)}
                disabled={isBootstrapping}
              >
                {lang}
                {isExisting && <span className="badge">Started</span>}
              </button>
            );
          })}
          {customExisting.map((lang) => (
            <button
              key={lang}
              className="language-btn existing"
              onClick={() => selectLanguage(lang)}
              disabled={isBootstrapping}
            >
              {lang}
              <span className="badge">Started</span>
            </button>
          ))}
          <button
            className="language-btn other-btn"
            onClick={() => setShowCustomInput(true)}
            disabled={isBootstrapping || showCustomInput}
          >
            Other...
          </button>
        </div>
        {showCustomInput && (
          <div className="custom-language-input">
            <input
              type="text"
              value={customLanguage}
              onChange={(e) => setCustomLanguage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && selectLanguage(customLanguage)}
              placeholder="Enter language name..."
              autoFocus
            />
            <button onClick={() => selectLanguage(customLanguage)} disabled={!customLanguage.trim()}>
              Start
            </button>
            <button className="cancel-btn" onClick={() => setShowCustomInput(false)}>
              Cancel
            </button>
          </div>
        )}
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

      <div className="chat-container" ref={chatContainerRef}>
        {isLoadingHistory && (
          <p className="hint">Loading conversation...</p>
        )}
        {!isLoadingHistory && messages.length === 0 && (
          <p className="hint">Say hello to start learning!</p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
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

export default App;
