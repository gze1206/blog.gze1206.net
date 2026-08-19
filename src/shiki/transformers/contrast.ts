import type { ShikiTransformer } from 'shiki';
import { SHIKI_COLOR_REPLACEMENTS } from '../themes.ts';

/**
 * 대비가 모자란 구문 색을 렌더 직전에 바꾼다 (NOR-34).
 *
 * Shiki 자체의 `colorReplacements` 는 Markdoc 경로(직접 부르는 `codeToHtml`)에서만 먹고,
 * Astro 의 `markdown.shikiConfig` 경로에서는 조용히 무시된다. 그래서 같은 글이 형식에 따라
 * 다른 색으로 나갔다. 트랜스포머는 **두 경로가 공유**하므로 여기서 한 번만 바꾼다.
 *
 * 색은 `src/shiki/themes.ts` 가 정한다 — 무엇을 왜 바꾸는지는 그 파일에 적혀 있다.
 */
export function transformerContrast(): ShikiTransformer {
  const replacements = new Map<string, string>();
  for (const perTheme of Object.values(SHIKI_COLOR_REPLACEMENTS)) {
    for (const [from, to] of Object.entries(perTheme)) {
      // 테마 파일마다 색을 적는 대소문자가 달라 둘 다 받는다.
      replacements.set(from.toLowerCase(), to);
    }
  }

  return {
    name: 'noru:contrast',
    span(node) {
      const style = node.properties?.['style'];
      if (typeof style !== 'string') return;

      node.properties['style'] = style.replace(/#[0-9a-fA-F]{6}/g, (color) => {
        return replacements.get(color.toLowerCase()) ?? color;
      });
    },
  };
}
