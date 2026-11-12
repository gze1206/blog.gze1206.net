import { expect, it } from 'vitest';
import { isLoadedLanguage } from './code-lang';
it('NOR-197 AC-4: plaintext 와 shiki 특수 언어는 로드된 언어로 본다', () => {
  for (const lang of ['plaintext', 'text', 'txt', 'plain', 'ansi', 'typescript'])
    expect(isLoadedLanguage(lang, ['typescript'])).toBe(true);
  expect(isLoadedLanguage('unknown', ['typescript'])).toBe(false);
});
