import { contextBridge, ipcRenderer } from 'electron';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const electronAPI = {
  bootstrapLanguage: (language: string): Promise<string> =>
    ipcRenderer.invoke('bootstrap-language', language),

  listLanguages: (): Promise<string[]> =>
    ipcRenderer.invoke('list-languages'),

  deleteLanguage: (language: string): Promise<string> =>
    ipcRenderer.invoke('delete-language', language),

  sendMessage: (message: string, language: string, mode: string): Promise<string> =>
    ipcRenderer.invoke('send-message', message, language, mode),

  getChatHistory: (language: string, mode: string): Promise<ChatMessage[]> =>
    ipcRenderer.invoke('get-chat-history', language, mode),

  getVocabulary: (language: string): Promise<string> =>
    ipcRenderer.invoke('get-vocabulary', language),

  getGrammar: (language: string): Promise<string> =>
    ipcRenderer.invoke('get-grammar', language),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
