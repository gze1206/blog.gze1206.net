import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { SHIKI_COLOR_REPLACEMENTS, SHIKI_THEMES } from './themes';

/**
 * 하이라이팅 경로가 둘(`.md` 는 Astro, `.mdoc` 는 Markdoc 설정)이라, 각자 테마 이름을 적어 두면
 * 한쪽만 바뀌어 글 형식에 따라 코드 색이 달라진다. 실제로 그렇게 어긋난 적이 있다.
 */
it('두 하이라이팅 경로가 같은 테마 출처를 쓴다', async () => {
  const [astroConfig, markdocConfig] = await Promise.all([
    readFile(new URL('../../astro.config.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../../markdoc.config.mjs', import.meta.url), 'utf8'),
  ]);

  for (const source of [astroConfig, markdocConfig]) {
    expect(source).toContain("from './src/shiki/themes.ts'");
    expect(source).toContain('SHIKI_THEMES');
    // 테마 이름을 설정 파일에 직접 적지 않는다.
    expect(source).not.toMatch(/light:\s*'[a-z-]+'/);
  }
});

it('라이트·다크 테마가 모두 정해져 있다', () => {
  expect(SHIKI_THEMES.light).toBe('github-light-high-contrast');
  expect(SHIKI_THEMES.dark).toBe('tokyo-night');
});

it('대비 보정 색은 실제로 기준(4.5:1)을 넘긴다', () => {
  // 보정 값을 손으로 고치다 기준 아래로 내려가는 일을 막는다.
  const surfaces: Record<string, string> = {
    'tokyo-night': '#1a1b26',
    'github-light-high-contrast': '#f2eee7',
  };

  for (const [theme, replacements] of Object.entries(SHIKI_COLOR_REPLACEMENTS)) {
    const background = surfaces[theme];
    expect(background, `${theme} 의 기준 배경이 정의돼 있어야 한다`).toBeDefined();

    for (const color of Object.values(replacements)) {
      expect(contrast(color, background ?? '#ffffff')).toBeGreaterThanOrEqual(4.5);
    }
  }
});

/** WCAG 상대 명도 대비. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const channels = [0, 2, 4].map((index) => {
      const value = parseInt(hex.replace('#', '').slice(index, index + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
  };

  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
}
