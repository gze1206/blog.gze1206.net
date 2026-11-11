/**
 * 날짜 표시 유틸 (NOR-16).
 *
 * 프론트매터의 `2026-07-20` 은 zod `coerce.date()` 를 거치며 **UTC 자정**으로 파싱된다.
 * 빌드 머신의 로컬 타임존으로 포매팅하면 UTC 뒤쪽 지역(예: America/*)에서 하루가 밀린다.
 * 그래서 표시·직렬화 모두 UTC 기준으로 고정한다.
 */

const KO_DATE = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

/** `<time datetime="…">` 에 넣을 ISO 날짜(YYYY-MM-DD). */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 화면에 보여줄 한국어 날짜. 예: `2026년 7월 20일`. */
export function formatKoreanDate(date: Date): string {
  return KO_DATE.format(date);
}
