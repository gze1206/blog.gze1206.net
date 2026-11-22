/**
 * 방문 분석 (NOR-234).
 *
 * GA4 는 운영 도메인에서만, 첫 화면을 그린 뒤에 싣는다. 광고 기능은 끈다 — CSP 도 광고 출처를 열지 않는다
 * (`csp.ts`). 방문 수보다 "실제로 읽었는가" 를 알고 싶으므로 글 페이지는 끝까지 읽음을 따로 보낸다.
 */

/** 페이지 소스에 그대로 드러나는 공개 값이다. */
export const GA_MEASUREMENT_ID = 'G-VPVRFS2P5S';

/** 미리보기(*.pages.dev)·로컬·e2e 의 방문이 통계에 섞이지 않게 한다. */
const ANALYTICS_HOST = 'gze1206.net';

export const GA_CONFIG = {
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;

/** 아주 짧은 글이라도 이 시간보다 짧게 머물렀다면 훑어본 것으로 본다. */
const MIN_READ_MS = 15_000;
/** 예상 읽는 시간은 천천히 읽는 사람 기준이라, 그 절반이면 읽은 것으로 본다. */
const READ_RATIO = 0.5;

export function shouldLoadAnalytics(hostname: string): boolean {
  return hostname === ANALYTICS_HOST;
}

export interface ReadingState {
  /** 본문 끝에 한 번이라도 닿았는가. */
  readonly reachedEnd: boolean;
  /** 탭이 보이는 동안 페이지에 머문 시간. */
  readonly visibleMs: number;
  /** 글의 예상 읽는 시간(분). */
  readonly minutes: number;
}

export function isReadComplete({ reachedEnd, visibleMs, minutes }: ReadingState): boolean {
  return reachedEnd && visibleMs >= Math.max(MIN_READ_MS, minutes * 60_000 * READ_RATIO);
}

/**
 * gtag.js 의 대기열에 넣는다. GA 를 싣지 않은 곳에서는 대기열에 쌓이기만 하고 아무 데도 가지 않는다.
 * gtag.js 는 배열이 아니라 `arguments` 객체를 기대하므로 나머지 매개변수로 바꾸면 안 된다.
 */
export function gtag(..._args: unknown[]): void {
  const target = window as unknown as { dataLayer?: unknown[] };
  // eslint-disable-next-line prefer-rest-params
  (target.dataLayer ??= []).push(arguments);
}
