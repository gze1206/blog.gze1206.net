import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { SHIKI_THEMES } from './themes';

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
  expect(SHIKI_THEMES.light).toBe('everforest-light');
  expect(SHIKI_THEMES.dark).toBe('tokyo-night');
});
