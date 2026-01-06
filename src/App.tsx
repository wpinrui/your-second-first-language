import { useState, useEffect } from "react";
import LanguageSelector from "./components/LanguageSelector";
import ModeSelector from "./components/ModeSelector";
import ChatView from "./components/ChatView";
import { LearningMode } from "./types/modes";

type AppScreen = "language" | "mode" | "chat";

function App() {
  const [screen, setScreen] = useState<AppScreen>("language");
  const [language, setLanguage] = useState<string | null>(null);
  const [mode, setMode] = useState<LearningMode | null>(null);
  const [existingLanguages, setExistingLanguages] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadExistingLanguages();
  }, []);

  async function loadExistingLanguages() {
    setLoadError(null);
    try {
      const languages = await window.electronAPI.listLanguages();
      setExistingLanguages(languages);
    } catch (error) {
      console.error("Failed to load languages:", error);
      setLoadError("Failed to load languages. Please restart the app.");
    }
  }

  function handleLanguageSelected(lang: string) {
    setLanguage(lang);
    setScreen("mode");
  }

  function handleModeSelected(selectedMode: LearningMode) {
    setMode(selectedMode);
    setScreen("chat");
  }

  function handleBackToLanguage() {
    setLanguage(null);
    setMode(null);
    setScreen("language");
  }

  function handleBackToMode() {
    setMode(null);
    setScreen("mode");
  }

  function handleModeChange(newMode: LearningMode) {
    setMode(newMode);
  }

  switch (screen) {
    case "language":
      return (
        <LanguageSelector
          existingLanguages={existingLanguages}
          onLanguageSelected={handleLanguageSelected}
          onLanguagesUpdated={loadExistingLanguages}
          loadError={loadError}
        />
      );
    case "mode":
      return (
        <ModeSelector
          language={language!}
          onModeSelected={handleModeSelected}
          onBack={handleBackToLanguage}
        />
      );
    case "chat":
      return (
        <ChatView
          language={language!}
          mode={mode!}
          onBack={handleBackToMode}
          onModeChange={handleModeChange}
        />
      );
  }
}

export default App;
