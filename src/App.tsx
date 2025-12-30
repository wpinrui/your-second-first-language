import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import LanguageSelector from "./components/LanguageSelector";
import ChatView from "./components/ChatView";

function App() {
  const [language, setLanguage] = useState<string | null>(null);
  const [existingLanguages, setExistingLanguages] = useState<string[]>([]);

  useEffect(() => {
    loadExistingLanguages();
  }, []);

  async function loadExistingLanguages() {
    try {
      const languages = await invoke<string[]>("list_languages");
      setExistingLanguages(languages);
    } catch (error) {
      console.error("Failed to load languages:", error);
    }
  }

  if (!language) {
    return (
      <LanguageSelector
        existingLanguages={existingLanguages}
        onLanguageSelected={setLanguage}
        onLanguagesUpdated={loadExistingLanguages}
      />
    );
  }

  return <ChatView language={language} onBack={() => setLanguage(null)} />;
}

export default App;
