import { app } from 'electron';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

export function getExeDir(): string {
  return path.dirname(app.getPath('exe'));
}

export function getDataDir(): string {
  return path.join(getExeDir(), 'data');
}

export function validateLanguageName(language: string): void {
  if (!language) {
    throw new Error('Language name cannot be empty');
  }
  if (language.includes('..') || language.includes('/') || language.includes('\\')) {
    throw new Error('Language name contains invalid characters');
  }
  if (!/^[a-zA-Z0-9 -]+$/.test(language)) {
    throw new Error('Language name can only contain letters, numbers, spaces, and hyphens');
  }
}

export function getLanguageDir(language: string): string {
  validateLanguageName(language);
  return path.join(getDataDir(), language.toLowerCase());
}

export function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getClaudeProjectDir(langDir: string): string {
  const resolved = path.resolve(langDir);

  // Convert path to Claude's project folder format:
  // C:\Users\foo\bar -> C--Users-foo-bar
  let encoded = resolved
    .replace(/:\\/g, '--')    // C:\ -> C--
    .replace(/\\/g, '-')      // remaining backslashes
    .replace(/\//g, '-')      // forward slashes (just in case)
    .replace(/ /g, '-');      // spaces

  const homeDir = os.homedir();
  return path.join(homeDir, '.claude', 'projects', encoded);
}

export async function writeLanguageFile(dir: string, filename: string, content: string): Promise<void> {
  await fs.writeFile(path.join(dir, filename), content, 'utf-8');
}
