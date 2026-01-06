import fs from 'fs-extra';
import path from 'path';
import { getClaudeProjectDir } from './fileService';

const MODE_SESSIONS_FILE = 'mode-sessions.json';

interface ModeSessions {
  sessions: Record<string, string>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function isValidUuid(s: string): boolean {
  // UUID format: 8-4-4-4-12 hex chars (e.g., 550e8400-e29b-41d4-a716-446655440000)
  const parts = s.split('-');
  if (parts.length !== 5) return false;
  const expectedLengths = [8, 4, 4, 4, 12];
  return parts.every((part, i) =>
    part.length === expectedLengths[i] && /^[0-9a-fA-F]+$/.test(part)
  );
}

export function readModeSessions(claudeProjectDir: string): ModeSessions {
  const filePath = path.join(claudeProjectDir, MODE_SESSIONS_FILE);
  if (!fs.existsSync(filePath)) {
    return { sessions: {} };
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return { sessions: {} };
  }
}

export async function writeModeSessions(claudeProjectDir: string, sessions: ModeSessions): Promise<void> {
  const filePath = path.join(claudeProjectDir, MODE_SESSIONS_FILE);
  await fs.writeFile(filePath, JSON.stringify(sessions, null, 2), 'utf-8');
}

export function findLatestJsonlFile(dir: string): string | null {
  if (!fs.existsSync(dir)) return null;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const jsonlFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith('.jsonl'))
    .map((e) => ({
      name: e.name,
      path: path.join(dir, e.name),
      mtime: fs.statSync(path.join(dir, e.name)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return jsonlFiles.length > 0 ? jsonlFiles[0].path : null;
}

export function findJsonlBySessionId(claudeProjectDir: string, sessionId: string): string | null {
  const filePath = path.join(claudeProjectDir, `${sessionId}.jsonl`);
  return fs.existsSync(filePath) ? filePath : null;
}

function getMessageContent(json: Record<string, unknown>, role: string): unknown | null {
  if (json.type !== role) return null;
  const msg = json.message as Record<string, unknown> | undefined;
  if (!msg || msg.role !== role) return null;
  return msg.content;
}

function extractUserMessage(json: Record<string, unknown>): string | null {
  const content = getMessageContent(json, 'user');
  if (typeof content === 'string') return content;

  // If content is an array, skip tool results
  if (Array.isArray(content)) {
    const hasToolResult = content.some(
      (item) => typeof item === 'object' && item !== null && (item as Record<string, unknown>).type === 'tool_result'
    );
    if (hasToolResult) return null;
  }

  return null;
}

function extractAssistantMessage(json: Record<string, unknown>): string | null {
  const content = getMessageContent(json, 'assistant');
  if (!Array.isArray(content)) return null;

  for (const item of content) {
    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      if (obj.type === 'text' && typeof obj.text === 'string') {
        return obj.text;
      }
    }
  }

  return null;
}

export async function parseChatMessagesFromJsonl(filePath: string): Promise<ChatMessage[]> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);
  const messages: ChatMessage[] = [];

  for (const line of lines) {
    try {
      const json = JSON.parse(line) as Record<string, unknown>;

      const userText = extractUserMessage(json);
      if (userText) {
        messages.push({ role: 'user', content: userText });
      }

      const assistantText = extractAssistantMessage(json);
      if (assistantText) {
        messages.push({ role: 'assistant', content: assistantText });
      }
    } catch {
      // Skip malformed JSON lines
      console.error('[Chat history] Skipping malformed JSON line');
    }
  }

  return messages;
}

export async function getChatHistory(language: string, mode: string, langDir: string): Promise<ChatMessage[]> {
  if (!(await fs.pathExists(langDir))) {
    throw new Error(`Language '${language}' not set up`);
  }

  const claudeProjectDir = getClaudeProjectDir(langDir);

  if (!(await fs.pathExists(claudeProjectDir))) {
    return [];
  }

  const modeSessions = readModeSessions(claudeProjectDir);
  const sessionId = modeSessions.sessions[mode];

  if (!sessionId) {
    return [];
  }

  const jsonlPath = findJsonlBySessionId(claudeProjectDir, sessionId);

  if (!jsonlPath) {
    return [];
  }

  return parseChatMessagesFromJsonl(jsonlPath);
}
