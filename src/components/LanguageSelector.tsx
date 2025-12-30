import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

const PRESET_LANGUAGES = ["Chinese", "Korean", "Japanese", "Spanish", "French", "German"];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function isLanguageInList(language: string, list: string[]): boolean {
  const normalized = language.toLowerCase();
  return list.some(l => l.toLowerCase() === normalized);
}

type Props = {
  existingLanguages: string[];
  onLanguageSelected: (language: string) => void;
  onLanguagesUpdated: () => void;
};

export default function LanguageSelector({ existingLanguages, onLanguageSelected, onLanguagesUpdated }: Props) {
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customLanguage, setCustomLanguage] = useState("");
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  async function selectLanguage(lang: string) {
    if (!lang.trim()) return;

    const langLower = lang.toLowerCase();
    const exists = isLanguageInList(langLower, existingLanguages);

    if (!exists) {
      setIsBootstrapping(true);
      setBootstrapError(null);
      try {
        await invoke("bootstrap_language", { language: lang });
        onLanguagesUpdated();
      } catch (error) {
        setBootstrapError(`Failed to set up ${lang}: ${getErrorMessage(error)}`);
        setIsBootstrapping(false);
        return;
      }
      setIsBootstrapping(false);
    }

    setShowCustomInput(false);
    setCustomLanguage("");
    onLanguageSelected(langLower);
  }

  const customExisting = existingLanguages.filter(
    lang => !isLanguageInList(lang, PRESET_LANGUAGES)
  );

  return (
    <div className="container">
      <h1>Your Second First Language</h1>
      <p>Choose a language to learn:</p>
      {isBootstrapping && <p className="hint">Setting up language...</p>}
      {bootstrapError && <p className="error">{bootstrapError}</p>}
      <div className="language-grid">
        {PRESET_LANGUAGES.map((lang) => {
          const isExisting = isLanguageInList(lang, existingLanguages);
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
