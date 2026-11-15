/**
 * `.md` 렌더 경로의 헤딩 id + 앵커 링크 (NOR-17, ADR 0010).
 *
 * `.md` 는 `astro.config.mjs` 의 `markdown.processor = unified({ rehypePlugins })` 를 탄다.
 * `.mdoc` 은 **이 파이프라인을 타지 않는다** — 같은 일을 `markdoc.config.mjs` 의
 * `nodes.heading` 이 한다. 두 파일이 {@link createHeadingIdFactory} 와
 * {@link headingAnchorLabel} 을 공유해서 결과가 어긋나지 않게 한다.
 *
 * ### 실행 순서가 중요하다
 *
 * Astro 는 사용자 rehype 플러그인 **뒤에** 자체 `rehypeHeadingIds` 를 돌린다. 그것은
 * `id` 가 이미 문자열이면 건드리지 않고, 그 상태로 `headings`(= `render()` 의 반환값,
 * 곧 TOC 의 입력) 를 모은다. 그래서 이 플러그인이 먼저 id 를 박아 두면
 * **화면의 헤딩 id 와 TOC 의 href 가 같은 출처**를 갖게 된다.
 *
 * 또 이 플러그인은 `rehypeKatex` 보다 **앞**에 두어야 한다. 뒤에 두면 수식이 MathML 로
 * 부풀어 오른 뒤라 헤딩 텍스트가 주석·대체표현으로 오염되고 id 가 흉해진다.
 */

import { createHeadingIdFactory } from '../lib/heading-id';
import { HEADING_ANCHOR_CLASS, headingAnchorLabel } from '../lib/heading-anchor';

/** 이 플러그인이 필요로 하는 최소한의 hast 노드 모양. `@types/hast` 를 끌어오지 않으려고 직접 좁혔다. */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

const HEADING_TAG = /^h([1-6])$/;

/** `<div>` 처럼 통째로 태그인 raw 노드. Astro 의 heading 수집기와 같은 판정을 쓴다. */
const RAW_TAG_ONLY = /^\n?<.*>\n?$/;

/** 헤딩 안의 사람이 읽는 텍스트만 모은다. 주입된 태그(raw)는 텍스트로 치지 않는다. */
function collectText(node: HastNode): string {
  if (node.type === 'text') return node.value ?? '';
  if (node.type === 'raw') {
    const value = node.value ?? '';
    return RAW_TAG_ONLY.test(value) ? '' : value;
  }
  return (node.children ?? []).map(collectText).join('');
}

function isHeading(node: HastNode): boolean {
  return (
    node.type === 'element' && typeof node.tagName === 'string' && HEADING_TAG.test(node.tagName)
  );
}

/**
 * 모든 헤딩에 결정적인 `id` 를 붙이고, 그 뒤에 앵커 링크를 하나 덧붙인다.
 *
 * 앵커는 **자식이 없는** `<a>` 다. 이유는 `src/lib/heading-anchor.ts` 참고 — 요약하면
 * 헤딩 텍스트(=TOC 텍스트)를 오염시키지 않기 위해서다.
 */
export function rehypeHeadingAnchors() {
  return function transform(tree: HastNode): void {
    // 팩토리는 **파일 하나당 하나**여야 한다. 공유하면 다른 글의 카운터가 새어 id 가 흔들린다.
    const nextHeadingId = createHeadingIdFactory();

    const walk = (node: HastNode): void => {
      if (isHeading(node)) {
        const text = collectText(node);
        const properties = (node.properties ??= {});
        const existing = properties['id'];
        const id =
          typeof existing === 'string' && existing.length > 0 ? existing : nextHeadingId(text);

        properties['id'] = id;
        (node.children ??= []).push({
          type: 'element',
          tagName: 'a',
          properties: {
            className: [HEADING_ANCHOR_CLASS],
            href: `#${id}`,
            'aria-label': headingAnchorLabel(text),
          },
          children: [],
        });
        // 헤딩 안에 또 헤딩이 있을 수 없다. 방금 넣은 앵커를 다시 훑지 않도록 여기서 끝낸다.
        return;
      }

      for (const child of node.children ?? []) walk(child);
    };

    walk(tree);
  };
}

export default rehypeHeadingAnchors;
