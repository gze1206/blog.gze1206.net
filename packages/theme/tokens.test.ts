import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const FILE = new URL('./tokens.css', import.meta.url);

/** `selector { --theme-x: #rrggbb; }` 블록에서 16진수 토큰만 읽는다. */
function readBlock(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const block = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...block.matchAll(/--theme-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/giu)].map((m) => [m[1], m[2]]),
  );
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('theme tokens', () => {
  it('NOR-203 AC-1: 라이트·다크 모두 글자색이 배경 위에서 4.5:1 이상이다', () => {
    expect(existsSync(FILE)).toBe(true);
    const css = readFileSync(FILE, 'utf8');
    for (const selector of [':root', '.dark']) {
      const t = readBlock(css, selector);
      const failures: string[] = [];
      for (const fg of ['foreground', 'body', 'muted', 'muted-strong', 'accent', 'danger'])
        for (const bg of ['background', 'surface', 'surface-sunken']) {
          const ratio = contrast(t[fg] ?? '#000000', t[bg] ?? '#000000');
          if (!(ratio >= 4.5)) failures.push(`${selector} ${fg}/${bg} ${ratio.toFixed(2)}`);
        }
      const notice = contrast(t['notice-foreground'] ?? '#000000', t['notice'] ?? '#000000');
      if (!(notice >= 4.5)) failures.push(`${selector} notice ${notice.toFixed(2)}`);
      expect(failures).toEqual([]);
    }
  });
});
