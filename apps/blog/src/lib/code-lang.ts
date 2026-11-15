const specialLanguages = new Set(['plaintext', 'text', 'txt', 'plain', 'ansi']);
export function isLoadedLanguage(lang: string, loaded: readonly string[]): boolean {
  return specialLanguages.has(lang) || loaded.includes(lang);
}
