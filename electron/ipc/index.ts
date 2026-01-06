import { ipcMain } from 'electron';
import { bootstrapLanguage, listLanguages, deleteLanguage } from './language';
import { sendMessage, getChatHistoryHandler } from './chat';
import { getVocabulary, getGrammar } from './data';

export function registerIpcHandlers(): void {
  // Language management
  ipcMain.handle('bootstrap-language', (_, language: string) =>
    bootstrapLanguage(language)
  );

  ipcMain.handle('list-languages', () => listLanguages());

  ipcMain.handle('delete-language', (_, language: string) =>
    deleteLanguage(language)
  );

  // Chat
  ipcMain.handle(
    'send-message',
    (_, message: string, language: string, mode: string) =>
      sendMessage(message, language, mode)
  );

  ipcMain.handle('get-chat-history', (_, language: string, mode: string) =>
    getChatHistoryHandler(language, mode)
  );

  // Data
  ipcMain.handle('get-vocabulary', (_, language: string) =>
    getVocabulary(language)
  );

  ipcMain.handle('get-grammar', (_, language: string) => getGrammar(language));
}
