/**
 * URL 슬러그 패턴 — 소문자·숫자·하이픈만, 하이픈 연속/양끝 금지.
 *
 * zod 스키마(`schemas.ts`)와 Keystatic 폼(`keystatic.config.ts`)이 **같은 값**을 써야 한다.
 * 한쪽만 느슨하면 CMS 로 저장은 되는데 다음 빌드가 zod 에서 터진다(NOR-19, ADR 0012).
 * 그래서 zod 도 Keystatic 도 아닌 이 모듈에 둔다 — Keystatic 설정은 브라우저 번들로도
 * 실려서 `astro/zod` 를 끌고 들어가면 안 되기 때문이다.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** 슬러그 규칙을 사람이 읽는 문장으로. 폼 오류 메시지에 그대로 쓴다. */
export const SLUG_PATTERN_MESSAGE =
  '소문자·숫자·하이픈만 쓸 수 있습니다 (예: hello-world). 하이픈으로 시작/끝나거나 연달아 쓸 수 없습니다.';
