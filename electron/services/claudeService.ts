import { spawn, execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
import fs from 'fs-extra';
import path from 'path';
import { app } from 'electron';
import { getLanguageDir, getClaudeProjectDir } from './fileService';
import {
  isValidUuid,
  readModeSessions,
  writeModeSessions,
  findLatestJsonlFile,
} from './sessionService';

// File-based logging for debugging packaged app
const LOG_FILE = path.join(app.getPath('userData'), 'claude-debug.log');

function log(msg: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

// Log startup
log(`=== Claude Service Started === Log file: ${LOG_FILE}`);

const TRACKER_TIMEOUT_MS = 60000; // 60 seconds
const MAX_MESSAGE_LENGTH = 10000;
const MODE_PREFIX_END = '<<<MSG>>>';

const TRACKER_PROMPT = `[TRACKER TASK - UPDATE FILES ONLY, NO RESPONSE]

Process this learner message and update vocabulary.json and grammar.json.

Learner said: {{MESSAGE}}

Instructions:
1. Read config.json to determine the target language
2. Read vocabulary.json and grammar.json
3. For each TARGET LANGUAGE word the learner used (IGNORE all English words):
   - If NEW: add entry with ease=2.5, interval=1, repetitions=1
   - If EXISTS: update SM-2 data (see below)
4. For grammar patterns used:
   - If NEW: add entry with stars=1, correct_streak=1
   - If EXISTS: increment correct_streak, upgrade stars if appropriate
5. Write updated files
6. Output NOTHING - your only job is updating files

CRITICAL: Only extract words in the target language script (Hangul for Korean, Kana/Kanji for Japanese, Hanzi for Chinese, etc). NEVER add English words.

SM-2 Algorithm (when learner uses a word correctly):
- repetitions += 1
- if repetitions == 1: interval = 1
- if repetitions == 2: interval = 6
- if repetitions >= 3: interval = round(interval × ease)
- next_review = today + interval days

IMPORTANT: Check for duplicates by word/rule field. Update existing entries, don't create duplicates.`;

function getModePrefix(mode: string): string {
  let instructions: string;

  switch (mode) {
    case 'think-out-loud':
      instructions =
        '[Think-Out-Loud Mode] ' +
        'Echo corrections only. NO unsolicited explanations, NO vocab notes, NO questions, NO emojis, NO praise. ' +
        "Just restate their sentence correctly. If correct, say 좋아요 and nothing else. " +
        "EXCEPTION: If they ask a direct question (뭐예요? 무슨 뜻이에요? etc), answer it briefly.";
      break;
    case 'story':
      instructions =
        '[Story Mode] ' +
        'Write a short story on the topic they request. Use vocabulary from vocabulary.json. ' +
        'Ask 2-3 comprehension questions about the story. Stay on-topic - this is reading practice, not conversation. ' +
        'When done, ask if they want a new story. If they go off-topic, redirect to the story.';
      break;
    default:
      return ''; // "chat" is default, no prefix
  }

  return `${instructions} ${MODE_PREFIX_END}`;
}

function spawnTrackerAgent(langDir: string, message: string): void {
  const trackerDir = path.join(langDir, '.tracker');
  fs.ensureDirSync(trackerDir);

  const prompt = TRACKER_PROMPT.replace('{{MESSAGE}}', message);

  const child: ChildProcess = spawn('claude', ['--dangerously-skip-permissions', '-p', prompt], {
    cwd: trackerDir,
    windowsHide: true,
    stdio: 'ignore',
    detached: false,
  });

  const timeout = setTimeout(() => {
    child.kill();
    log(`[Tracker] Timed out after ${TRACKER_TIMEOUT_MS}ms`);
  }, TRACKER_TIMEOUT_MS);

  child.on('exit', () => clearTimeout(timeout));
  child.on('error', (err) => log(`[Tracker] Error: ${err}`));
}

const RESPONDER_TIMEOUT_MS = 120000; // 2 minutes

function runResponderAgent(
  langDir: string,
  message: string,
  sessionId?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['--dangerously-skip-permissions'];

    if (sessionId && isValidUuid(sessionId)) {
      args.push('--resume', sessionId);
    }

    args.push('-p', message);

    log(`[Responder] Starting claude with args: ${JSON.stringify(args)}`);
    log(`[Responder] Working directory: ${langDir}`);
    log(`[Responder] PATH: ${process.env.PATH}`);

    const child = spawn('claude', args, {
      cwd: langDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'], // ignore stdin - Claude waits on it otherwise
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      log(`[Responder] stdout chunk: ${data.toString().substring(0, 100)}...`);
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      log(`[Responder] stderr chunk: ${data.toString()}`);
    });

    const timeout = setTimeout(() => {
      child.kill();
      log(`[Responder] Timed out after ${RESPONDER_TIMEOUT_MS}ms`);
      reject(new Error(`Claude timed out after ${RESPONDER_TIMEOUT_MS}ms`));
    }, RESPONDER_TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timeout);
      log(`[Responder] Spawn error: ${err.message}`);
      reject(new Error(`Failed to start Claude: ${err.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      log(`[Responder] Process closed with code: ${code}, stdout length: ${stdout.length}`);
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr || 'No error output'}`));
      }
    });
  });
}

export async function sendMessage(
  message: string,
  language: string,
  mode: string
): Promise<string> {
  log(`[sendMessage] Called with: language=${language}, mode=${mode}, messageLength=${message.length}`);

  if (!message.trim()) {
    throw new Error('Message cannot be empty');
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(
      `Message too long (${message.length} chars). Maximum is ${MAX_MESSAGE_LENGTH} chars.`
    );
  }

  const langDir = getLanguageDir(language);
  log(`[sendMessage] langDir: ${langDir}`);

  if (!(await fs.pathExists(langDir))) {
    throw new Error(`Language '${language}' not set up. Please bootstrap it first.`);
  }

  // Tracker gets raw message (for vocabulary/grammar updates)
  log('[sendMessage] Spawning tracker...');
  spawnTrackerAgent(langDir, message);

  // Get Claude project directory and read mode sessions
  const claudeProjectDir = getClaudeProjectDir(langDir);
  log(`[sendMessage] claudeProjectDir: ${claudeProjectDir}`);
  const modeSessions = readModeSessions(claudeProjectDir);
  const sessionId = modeSessions.sessions[mode];
  log(`[sendMessage] sessionId for mode: ${sessionId}`);

  // Responder gets mode-prefixed message
  const modePrefix = getModePrefix(mode);
  const enhancedMessage = modePrefix + message;
  log('[sendMessage] Calling responder...');
  const response = await runResponderAgent(langDir, enhancedMessage, sessionId);
  log(`[sendMessage] Got response, length: ${response.length}`);

  // After successful response, find the latest jsonl and update mode sessions
  const latestJsonl = findLatestJsonlFile(claudeProjectDir);
  if (latestJsonl) {
    const stem = path.basename(latestJsonl, '.jsonl');
    if (isValidUuid(stem) && stem !== sessionId) {
      modeSessions.sessions[mode] = stem;
      try {
        await writeModeSessions(claudeProjectDir, modeSessions);
      } catch (e) {
        log(`[Mode sessions] Failed to save: ${e}`);
      }
    }
  }

  return response;
}
