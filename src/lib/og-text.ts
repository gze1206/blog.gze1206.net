/**
 * OG 카드 텍스트 배치의 순수 계산 (NOR-28).
 *
 * OG 이미지는 1200×630 **고정 크기**라 텍스트가 넘치면 잘리거나 카드 밖으로 밀린다.
 * 그런데 렌더러(Satori)는 실제 폰트 메트릭으로 줄바꿈하므로, 이 모듈이 하는 일은
 * "몇 줄이 될지 **미리 가늠해서 글자 크기를 고르는 것**"이다.
 *
 * - 실제 줄바꿈(픽셀 정확) — Satori 가 한다.
 * - 넘침 방지 최종 방어선 — Satori 의 `lineClamp` 가 `…` 로 자른다.
 * - **글자 크기 선택과 하드 상한** — 여기(순수 함수). 그래서 단위 테스트가 가능하다.
 *
 * 폭 추정은 em 단위다(1.0 = 글자 크기와 같은 폭). 한글·CJK 는 정확히 1em 이고
 * 라틴 문자는 폰트마다 다르므로 Pretendard 기준 근사값을 쓴다. 근사가 틀려도
 * 결과는 "글자 크기가 한 단계 크거나 작다" 정도이며 카드가 깨지지는 않는다.
 */

/** 한글 음절 · 자모 · CJK · 전각 문자처럼 폭이 1em 인 구간. */
const FULL_WIDTH_RANGES: readonly (readonly [number, number])[] = [
  [0x1100, 0x11ff], // 한글 자모
  [0x2e80, 0x303e], // CJK 부수 · 한중일 기호
  [0x3041, 0x33ff], // 가나 · 한글 호환 자모 · CJK 기호
  [0x3400, 0x4dbf], // CJK 확장 A
  [0x4e00, 0x9fff], // CJK 통합 한자
  [0xa000, 0xa4cf], // 이족 음절
  [0xac00, 0xd7a3], // 한글 음절
  [0xf900, 0xfaff], // CJK 호환 한자
  [0xfe30, 0xfe4f], // CJK 호환 형태
  [0xff00, 0xff60], // 전각 라틴
  [0xffe0, 0xffe6], // 전각 기호
];

/** 라틴 좁은 글자(대략 0.3em). */
const NARROW_LATIN = new Set([...'ijlt!|.,;:\'"`()[]{}/\\-'].map((c) => c.codePointAt(0)));
/** 라틴 넓은 글자(대략 0.85em). */
const WIDE_LATIN = new Set([...'MWmw@%&'].map((c) => c.codePointAt(0)));

const SPACE_WIDTH = 0.28;
const NARROW_WIDTH = 0.32;
const WIDE_WIDTH = 0.85;
const DEFAULT_LATIN_WIDTH = 0.56;
const FULL_WIDTH = 1;

function isFullWidth(code: number): boolean {
  return FULL_WIDTH_RANGES.some(([start, end]) => code >= start && code <= end);
}

/** 문자 하나의 폭(em). 코드포인트 단위이므로 이모지 같은 서로게이트 쌍도 한 글자로 센다. */
export function charWidth(char: string): number {
  const code = char.codePointAt(0);
  if (code === undefined) return 0;
  if (char === ' ' || char === '\u00a0') return SPACE_WIDTH;
  if (isFullWidth(code)) return FULL_WIDTH;
  if (code > 0x2000) return FULL_WIDTH; // 이모지·기호는 넉넉히 잡는다(넘침보다 여백이 낫다)
  if (NARROW_LATIN.has(code)) return NARROW_WIDTH;
  if (WIDE_LATIN.has(code)) return WIDE_WIDTH;
  return DEFAULT_LATIN_WIDTH;
}

/** 문자열 전체 폭(em). */
export function estimateTextWidth(text: string): number {
  let width = 0;
  for (const char of text) width += charWidth(char);
  return width;
}

/** 연속 공백·개행을 공백 하나로 접고 양끝을 다듬는다. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * 폭 상한(em)에 맞춰 줄을 나눈다.
 *
 * 라틴은 단어 단위, 한글·CJK 는 글자 단위로 끊는다 — CSS 의 `word-break` 기본 동작과 같다.
 * 한 단어가 통째로 상한보다 길면(예: 아주 긴 URL) 그 단어 안에서 강제로 끊는다.
 */
export function wrapText(text: string, maxWidthEm: number): string[] {
  const normalized = normalizeText(text);
  if (normalized === '' || maxWidthEm <= 0) return normalized === '' ? [] : [normalized];

  const lines: string[] = [];
  let line = '';
  let lineWidth = 0;
  /** 줄을 확정한다. 줄 끝 공백은 버린다 — 오른쪽 정렬·중앙 정렬에서 폭이 어긋난다. */
  const pushLine = (): void => {
    lines.push(line.trimEnd());
    line = '';
    lineWidth = 0;
  };
  /** 아직 줄에 붙이지 않은, 끊을 수 없는 라틴 단어 조각. */
  let word = '';
  let wordWidth = 0;

  const flushWord = (): void => {
    if (word === '') return;
    if (lineWidth > 0 && lineWidth + wordWidth > maxWidthEm) pushLine();
    // 단어 하나가 한 줄보다 길면 글자 단위로 쪼갠다.
    for (const char of word) {
      const w = charWidth(char);
      if (lineWidth > 0 && lineWidth + w > maxWidthEm) pushLine();
      line += char;
      lineWidth += w;
    }
    word = '';
    wordWidth = 0;
  };

  for (const char of normalized) {
    const code = char.codePointAt(0) ?? 0;
    const breakable = char === ' ' || isFullWidth(code);
    if (!breakable) {
      word += char;
      wordWidth += charWidth(char);
      continue;
    }
    flushWord();
    const w = charWidth(char);
    if (char === ' ') {
      // 줄 끝의 공백은 다음 줄로 넘기지 않는다.
      if (lineWidth === 0) continue;
      if (lineWidth + w > maxWidthEm) {
        pushLine();
        continue;
      }
    } else if (lineWidth > 0 && lineWidth + w > maxWidthEm) {
      pushLine();
    }
    line += char;
    lineWidth += w;
  }
  flushWord();
  if (line !== '') pushLine();

  return lines;
}

/** 글자 수 상한을 넘으면 `…` 를 붙여 자른다. 코드포인트 단위라 이모지가 쪼개지지 않는다. */
export function truncateChars(text: string, maxChars: number): string {
  const chars = [...normalizeText(text)];
  if (chars.length <= maxChars) return chars.join('');
  return `${chars
    .slice(0, Math.max(0, maxChars - 1))
    .join('')
    .trimEnd()}…`;
}

/** {@link fitTitle} 결과. 그대로 카드 스타일에 넣는다. */
export interface TitleFit {
  /** 하드 상한까지 자른 제목. 실제 줄바꿈은 렌더러가 한다. */
  readonly text: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  /** 이 줄 수를 넘으면 렌더러가 `…` 로 자른다. */
  readonly maxLines: number;
  /** 추정 줄 수. 디버깅·테스트용. */
  readonly estimatedLines: number;
}

export interface FitTitleOptions {
  /** 제목이 쓸 수 있는 가로 폭(px). */
  readonly contentWidth?: number;
  /** 시도할 글자 크기(px), 큰 것부터. */
  readonly sizes?: readonly number[];
  /** 허용 줄 수. */
  readonly maxLines?: number;
  /** 글자 수 하드 상한. 이보다 길면 `…` 로 자른다. */
  readonly maxChars?: number;
}

/** 제목 영역 기본 가로 폭(px) — 1200 − 좌우 패딩 72×2. */
export const TITLE_CONTENT_WIDTH = 1056;
const DEFAULT_SIZES = [66, 58, 50, 44] as const;
const DEFAULT_MAX_LINES = 3;
/** 4줄 × 44px 로도 못 담는 길이. 여기서 잘라야 렌더러 clamp 가 "…" 만 남기는 일이 없다. */
const DEFAULT_MAX_CHARS = 160;
/** 추정 폭이 실제보다 좁게 나오는 경우를 대비한 여유. */
const WIDTH_SLACK = 1.04;

/**
 * 제목 길이에 맞는 글자 크기를 고른다.
 *
 * 짧은 제목은 크게, 긴 제목은 한 단계씩 줄여 {@link FitTitleOptions.maxLines} 안에 담는다.
 * 가장 작은 크기로도 넘치면 그 크기를 쓰고 넘침은 렌더러의 clamp 에 맡긴다 —
 * 여기서 예외를 던지면 제목 하나 때문에 빌드가 멈춘다.
 */
export function fitTitle(title: string, options: FitTitleOptions = {}): TitleFit {
  const contentWidth = options.contentWidth ?? TITLE_CONTENT_WIDTH;
  const sizes = options.sizes ?? DEFAULT_SIZES;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;

  const text = truncateChars(title, maxChars);
  const lineHeight = 1.28;

  let smallest: TitleFit | null = null;
  for (const fontSize of sizes) {
    const lines = wrapText(text, contentWidth / fontSize / WIDTH_SLACK).length;
    const fit: TitleFit = { text, fontSize, lineHeight, maxLines, estimatedLines: lines };
    if (lines <= maxLines) return fit;
    smallest = fit;
  }
  // 어떤 크기로도 안 담기면 가장 작은 크기를 쓴다. `sizes` 가 비었을 때만 null 이다.
  return smallest ?? { text, fontSize: 44, lineHeight, maxLines, estimatedLines: 1 };
}
