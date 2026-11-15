/**
 * 글 상세 페이지가 쓰는 **파생 데이터를 한 곳에서** 만든다 (NOR-17).
 *
 * TOC·읽기 시간·ISO 날짜를 상세 페이지 템플릿 안에 묻어두면, 같은 값이 필요한 다음 소비자가
 * 계산을 복사해 간다. 그러면 표시되는 값과 구조화 데이터가 조용히 어긋난다.
 *
 * ### Phase 7(JSON-LD · OG · RSS, NOR-27~30) 이 여기서 꺼내 쓸 것
 *
 * | 필요한 값                     | 여기서 쓸 것                                  |
 * | ----------------------------- | --------------------------------------------- |
 * | `datePublished`               | {@link PostDetail.publishedISO}                |
 * | `dateModified`                | {@link PostDetail.updatedISO} (`isUpdated` 로 생략 판단) |
 * | `timeRequired`                | {@link PostDetail.readingTime}`.iso` (`PT3M`)  |
 * | 목차·앵커 기반 딥링크         | {@link PostDetail.toc}                         |
 *
 * JSON-LD 자체 구현은 Phase 7 범위다. 이 모듈은 **데이터만** 준비한다.
 */

import { toISODate } from './date';
import { estimateReadingTime, type ReadingTime } from './reading-time';
import { buildToc, type HeadingRef, type TocEntry } from './toc';

/** {@link derivePostDetail} 입력. `astro:content` 에 의존하지 않도록 구조적 타입만 받는다. */
export interface PostDetailInput {
  readonly publishedAt: Date;
  readonly updatedAt: Date;
  /** 글 본문 원문(`CollectionEntry.body`). 읽기 시간 계산에만 쓴다. */
  readonly body: string | undefined;
  /** 렌더러가 돌려준 헤딩 목록(`render(post)` 의 `headings`). */
  readonly headings: readonly HeadingRef[];
}

/** 상세 페이지·구조화 데이터가 공유하는 파생 값 묶음. */
export interface PostDetail {
  /** TOC 트리. 비어 있으면 목차를 렌더하지 않는다(판단은 `buildToc` 가 이미 했다). */
  readonly toc: readonly TocEntry[];
  readonly readingTime: ReadingTime;
  /** `<time datetime>` · JSON-LD `datePublished` 용 ISO 날짜. */
  readonly publishedISO: string;
  /** `<time datetime>` · JSON-LD `dateModified` 용 ISO 날짜. */
  readonly updatedISO: string;
  /** 수정일이 발행일과 다른가. 같으면 화면에도 구조화 데이터에도 수정일을 따로 내보내지 않는다. */
  readonly isUpdated: boolean;
}

/** 글 하나의 파생 데이터를 만든다. 같은 입력은 항상 같은 출력이다. */
export function derivePostDetail(input: PostDetailInput): PostDetail {
  return {
    toc: buildToc(input.headings),
    readingTime: estimateReadingTime(input.body),
    publishedISO: toISODate(input.publishedAt),
    updatedISO: toISODate(input.updatedAt),
    isUpdated: input.updatedAt.getTime() !== input.publishedAt.getTime(),
  };
}
