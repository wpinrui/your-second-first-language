export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function normalizeLanguage(language: string): string {
  return language.toLowerCase();
}

export function isLanguageInList(language: string, list: string[]): boolean {
  const normalized = normalizeLanguage(language);
  return list.some(l => normalizeLanguage(l) === normalized);
}
