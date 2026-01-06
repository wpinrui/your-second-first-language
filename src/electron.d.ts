interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ElectronAPI {
  bootstrapLanguage(language: string): Promise<string>;
  listLanguages(): Promise<string[]>;
  deleteLanguage(language: string): Promise<string>;
  sendMessage(message: string, language: string, mode: string): Promise<string>;
  getChatHistory(language: string, mode: string): Promise<ChatMessage[]>;
  getVocabulary(language: string): Promise<string>;
  getGrammar(language: string): Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
