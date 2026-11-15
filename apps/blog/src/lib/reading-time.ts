/**
 * 읽기 시간 추정 (NOR-17, ADR 0010).
 *
 * **빌드타임 전용 순수 함수**다. 런타임 JS 로 본문을 세지 않는다.
 *
 * 흔한 "공백 기준 단어 수 ÷ 200" 은 한국어에서 크게 빗나간다. 한국어 산문은 어절이 짧고
 * 조사·어미가 붙어 어절당 정보량이 영어 단어와 다르기 때문에, **분당 글자 수**로 세는 편이 맞다.
 * 그래서 본문을 문자 종류로 나눠 각각 다른 속도를 적용한다. 상수·근거는 ADR 0010 참고.
 *
 * 입력은 **원본 본문 텍스트**(`CollectionEntry.body`)다. `.md` 든 `.mdoc` 든 같은 함수를 쓴다 —
 * 렌더 결과 HTML 을 세면 렌더 경로마다 다른 값이 나온다.
 */

/** 한글·CJK 문자 기준 읽기 속도(자/분). */
const CJK_CHARS_PER_MINUTE = 500;

/** 라틴 계열 단어 기준 읽기 속도(단어/분). */
const LATIN_WORDS_PER_MINUTE = 200;

/** 코드블럭은 산문처럼 읽지 않는다. 훑는 속도(줄/분). */
const CODE_LINES_PER_MINUTE = 40;

/**
 * 코드블럭 한 개에서 실제로 세는 최대 줄 수.
 * 300줄짜리 덤프를 다 읽는 독자는 없다. 상한이 없으면 코드 많은 글의 추정치가 비현실적으로 튄다.
 */
const MAX_COUNTED_LINES_PER_CODE_BLOCK = 30;

/**
 * "단어"가 아니라 "글자"로 세는 문자들.
 * 한글 자모(U+1100~)·호환 자모(U+3130~)·음절(U+AC00~), 일본어 가나(U+3040~), 한자(기본·확장 A).
 */
const CJK_PATTERN = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-䶿一-鿿가-힣]/gu;

/** 펜스 코드블럭의 여닫는 줄. 여는 줄의 정보 문자열(```ts title="x")은 버린다. */
const CODE_FENCE_PATTERN = /^[ \t]*(`{3,}|~{3,})/;

/** 읽기 시간 추정 결과. 표시 문자열과 기계용 값(JSON-LD `timeRequired`)을 함께 들고 다닌다. */
export interface ReadingTime {
  /** 반올림 전 총 예상 초. 디버깅·튜닝용. */
  readonly seconds: number;
  /** 표시용 분. **항상 1 이상**이다("0분 읽기"를 만들지 않는다). */
  readonly minutes: number;
  /** 화면에 그대로 넣는 한국어 표기. 예: `1분 미만`, `약 3분`. */
  readonly label: string;
  /** ISO 8601 duration. `<time datetime>` 과 JSON-LD `timeRequired`(Phase 7) 가 그대로 쓴다. */
  readonly iso: string;
}

/** 본문에서 코드블럭을 걷어낸 결과. */
interface StrippedCode {
  /** 코드블럭이 빠진 본문. */
  readonly text: string;
  /** 코드 분량으로 가산할 줄 수(블럭당 상한 적용 후). */
  readonly countedLines: number;
}

/** 앞머리 프론트매터 제거. `entry.body` 에는 원래 없지만, 원본 파일을 그대로 넣어도 맞게 동작시킨다. */
function stripFrontmatter(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '');
}

/**
 * 펜스 코드블럭(``` / ~~~)을 걷어내고, 대신 셀 줄 수를 돌려준다.
 * 코드는 산문과 읽는 속도가 다르므로 글자 수에 섞지 않는다.
 *
 * 줄 단위로 훑는다 — 정규식 하나로 처리하면 닫히지 않은 펜스나 길이가 다른 닫는 펜스에서 어긋난다.
 */
function stripCodeBlocks(source: string): StrippedCode {
  const kept: string[] = [];
  let countedLines = 0;
  let openFence: string | null = null;
  let linesInBlock = 0;

  for (const line of source.split('\n')) {
    const fence = CODE_FENCE_PATTERN.exec(line)?.[1];

    if (openFence === null) {
      if (fence === undefined) {
        kept.push(line);
      } else {
        openFence = fence;
        linesInBlock = 0;
      }
      continue;
    }

    // 닫는 펜스는 여는 펜스와 같은 문자·같은 길이 이상이어야 한다(``` 안의 ~~~ 는 코드의 일부다).
    if (fence !== undefined && fence[0] === openFence[0] && fence.length >= openFence.length) {
      countedLines += Math.min(linesInBlock, MAX_COUNTED_LINES_PER_CODE_BLOCK);
      openFence = null;
      continue;
    }

    if (line.trim().length > 0) linesInBlock += 1;
  }

  // 닫히지 않은 채 끝난 블럭도 분량으로는 세어 준다.
  if (openFence !== null) {
    countedLines += Math.min(linesInBlock, MAX_COUNTED_LINES_PER_CODE_BLOCK);
  }

  return { text: kept.join('\n'), countedLines };
}

/**
 * 산문이 아닌 것들을 본문에서 걷어낸다.
 *
 * 지우는 것: 수식(인라인·블럭), 인라인 코드, 이미지(대체 텍스트 포함), 링크 URL(표시 텍스트는 남김),
 * HTML 태그, Markdoc 태그 마커, 마크다운 문법 기호.
 * Markdoc 은 `{% callout %}…{% /callout %}` 처럼 **마커만** 지운다 — 그 안의 산문은 독자가 읽는다.
 */
function stripNonProse(source: string): string {
  return (
    source
      // 블럭 수식 → 통째로 제거. 글자 수 대비 읽기 시간 편차가 커서 어떤 상수도 신뢰하기 어렵다.
      .replace(/\$\$[\s\S]*?\$\$/g, ' ')
      // Markdoc 태그 마커(`{% … %}`, `{% /… %}`). 속성값(제목·URL)은 본문이 아니다.
      .replace(/\{%[\s\S]*?%\}/g, ' ')
      // 인라인 코드
      .replace(/`+[^`\n]*`+/g, ' ')
      // 이미지: 캡션/alt 는 본문 분량이 아니다.
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      // 링크: 표시 텍스트만 남기고 URL 은 버린다.
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // 인라인 수식
      .replace(/\$[^$\n]+\$/g, ' ')
      // HTML 태그
      .replace(/<[^>]*>/g, ' ')
      // 헤딩·인용·리스트 등 줄머리 문법 기호
      .replace(/^[ \t]*(?:#{1,6}|>|[-*+]|\d+\.)[ \t]+/gm, ' ')
      // 수평선
      .replace(/^[ \t]*(?:[-*_][ \t]*){3,}$/gm, ' ')
      // 강조·표 구분자
      .replace(/[|*_~]/g, ' ')
      // 남은 맨 URL
      .replace(/https?:\/\/\S+/g, ' ')
  );
}

/** 라틴 등 "단어로 세는" 토큰 개수. 문자·숫자를 하나라도 포함한 토큰만 센다. */
function countWords(text: string): number {
  return text.split(/\s+/u).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/**
 * 본문 원문에서 읽기 시간을 추정한다.
 *
 * @param body 글 본문 원문(`CollectionEntry.body`). `undefined` 는 빈 본문으로 본다.
 */
export function estimateReadingTime(body: string | undefined): ReadingTime {
  const source = stripFrontmatter(body ?? '');
  const { text, countedLines } = stripCodeBlocks(source);
  const prose = stripNonProse(text);

  const cjkChars = prose.match(CJK_PATTERN)?.length ?? 0;
  const latinWords = countWords(prose.replace(CJK_PATTERN, ' '));

  const seconds =
    (cjkChars / CJK_CHARS_PER_MINUTE +
      latinWords / LATIN_WORDS_PER_MINUTE +
      countedLines / CODE_LINES_PER_MINUTE) *
    60;

  // 1분을 못 채우는 글도 "0분"이 되면 안 된다. 표시는 '1분 미만', 기계값은 PT1M 으로 바닥을 친다.
  const minutes = Math.max(1, Math.round(seconds / 60));

  return {
    seconds,
    minutes,
    label: seconds < 60 ? '1분 미만' : `약 ${minutes}분`,
    iso: `PT${minutes}M`,
  };
}
