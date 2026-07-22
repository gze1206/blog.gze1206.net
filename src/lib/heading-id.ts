/**
 * 본문 헤딩의 앵커 id 생성 (NOR-17, ADR 0010).
 *
 * 헤딩 id 는 `https://gze1206.net/blog/foo#설치하기` 형태로 **공유되는 영구 주소**다.
 * 규칙을 나중에 바꾸면 남이 저장해 둔 링크가 조용히 깨진다. 그래서
 *
 * - 규칙을 라이브러리(github-slugger)에 맡기지 않고 이 모듈에 고정하고,
 * - `.md`(rehype) 와 `.mdoc`(Markdoc `nodes.heading`) **양쪽 렌더 경로가 이 함수 하나만** 쓴다.
 *
 * 슬러그화 규칙 자체는 카테고리·태그와 같은 {@link toSlug} 를 재사용한다. 한 사이트 안에서
 * `#` 뒤 문자열과 `/tags/…` 문자열이 다른 규칙으로 만들어지면 설명할 수 없기 때문이다.
 */

import { EmptySlugError, toSlug } from './slug';

/** 슬러그화 결과가 비는 헤딩(예: `## ???`)에 쓰는 대체 id. 유일화는 팩토리가 맡는다. */
export const FALLBACK_HEADING_ID = 'section';

/**
 * 헤딩 텍스트 → id. **유일성은 보장하지 않는다** — 한 문서 안에서는
 * {@link createHeadingIdFactory} 를 쓸 것.
 *
 * {@link toSlug} 와 달리 예외를 던지지 않는다. 기호만으로 된 헤딩 하나 때문에
 * 글 전체 빌드를 세우는 것은 과하다.
 */
export function toHeadingId(text: string): string {
  try {
    return toSlug(text);
  } catch (error) {
    if (error instanceof EmptySlugError) return FALLBACK_HEADING_ID;
    throw error;
  }
}

/** 문서 하나에 대한 id 발급기. 호출 순서가 곧 문서 안의 헤딩 순서다. */
export type HeadingIdFactory = (text: string) => string;

/**
 * 한 문서 안에서 **중복 없는** 헤딩 id 를 발급하는 팩토리를 만든다.
 *
 * 같은 텍스트가 다시 나오면 `-2`, `-3` … 을 붙인다(두 번째 등장이 `-2`). 이미 발급된 id 와
 * 겹치는 후보는 건너뛰므로, 본문에 `## 설치` 두 개와 `## 설치 2` 가 섞여 있어도 충돌하지 않는다.
 *
 * 문서마다 새로 만들어야 한다. 재사용하면 다른 글의 카운터가 새어 들어와 id 가 불안정해진다.
 */
export function createHeadingIdFactory(): HeadingIdFactory {
  const used = new Set<string>();
  /** base 별로 "다음에 시도할 접미 번호". 매번 1부터 훑지 않으려고 기억해 둔다. */
  const nextSuffix = new Map<string, number>();

  return (text: string): string => {
    const base = toHeadingId(text);
    let suffix = nextSuffix.get(base) ?? 1;
    let id = base;

    while (used.has(id)) {
      suffix += 1;
      id = `${base}-${suffix}`;
    }

    nextSuffix.set(base, suffix);
    used.add(id);
    return id;
  };
}
