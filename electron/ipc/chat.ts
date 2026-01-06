import { sendMessage } from '../services/claudeService';
import { getChatHistory } from '../services/sessionService';
import { getLanguageDir } from '../services/fileService';

export { sendMessage };

export async function getChatHistoryHandler(
  language: string,
  mode: string
): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
  const langDir = getLanguageDir(language);
  return getChatHistory(language, mode, langDir);
}
