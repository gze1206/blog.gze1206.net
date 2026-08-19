/**
 * 책장 표시 규칙 (NOR-188).
 *
 * 표지를 못 구한 책이 절반쯤 된다 — 키 없이 쓸 수 있는 서지정보 제공처는 국내서 표지를 자주
 * 모른다. 그래서 "표지 없음"은 예외가 아니라 **평상시**다. 빈 자리를 회색 상자로 두면 책장이
 * 구멍 난 것처럼 보이므로, 제목으로 색을 정해 표지 대신 세워 둔다.
 */

/** 표지 없는 책에 입힐 색. 종이 위에서 튀지 않는 것만 골랐다. */
export const SPINE_TONE_COUNT = 5;

/**
 * 제목에서 결정되는 색 번호.
 *
 * 무작위가 아니라 **제목의 함수**여야 한다 — 다시 빌드할 때마다 책장 색이 바뀌면 같은 책을
 * 같은 책으로 알아볼 수 없다.
 */
export function spineTone(title: string): number {
  let hash = 0;
  for (const char of title) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 100_003;
  }
  return (hash % SPINE_TONE_COUNT) + 1;
}

/**
 * 표지 자리에 세울 제목.
 *
 * 좁은 칸에 긴 제목을 다 넣으면 글자가 뭉개진다. 부제는 잘라 내고 본 제목만 남긴다 —
 * 전체 제목은 표지 아래 설명에 그대로 있다.
 */
export function spineTitle(title: string): string {
  const [head = title] = title.split(/\s*[:—–]\s*/u);
  return head.length > 24 ? `${head.slice(0, 23)}…` : head;
}
