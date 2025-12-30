import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import LanguageSelector from "./components/LanguageSelector";
import ChatView from "./components/ChatView";

function App() {
  const [language, setLanguage] = useState<string | null>(null);
  const [existingLanguages, setExistingLanguages] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadExistingLanguages();
  }, []);

  async function loadExistingLanguages() {
    setLoadError(null);
    try {
      const languages = await invoke<string[]>("list_languages");
      setExistingLanguages(languages);
    } catch (error) {
      console.error("Failed to load languages:", error);
      setLoadError("Failed to load languages. Please restart the app.");
    }
  }

  if (!language) {
    return (
      <LanguageSelector
        existingLanguages={existingLanguages}
        onLanguageSelected={setLanguage}
        onLanguagesUpdated={loadExistingLanguages}
        loadError={loadError}
      />
    );
  }

  return <ChatView language={language} onBack={() => setLanguage(null)} />;
}

export default App;
