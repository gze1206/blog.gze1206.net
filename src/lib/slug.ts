/**
 * 표시 문자열 → URL 슬러그 변환 (NOR-16, ADR 0009).
 *
 * `category` · `tags` 는 스키마상 자유 문자열이다("TypeScript", "웹 성능", "C#" …).
 * URL 세그먼트를 만들려면 표시용 원문과 별개로 **결정적으로 파생된** 슬러그가 필요하다.
 * 원문은 화면 표시에 그대로 쓰고, 슬러그는 여기서만 만든다.
 *
 * 규칙은 ADR 0009 에 근거를 남겼다. 요약:
 * - 유니코드 문자·숫자는 보존한다(한글 태그는 한글 슬러그가 된다).
 * - `#` `+` 는 프로그래밍 언어 이름을 살리려고 `sharp` / `plus` 로 음차한다(C# → `c-sharp`).
 * - 그 외 기호는 버리고, 공백류는 `-` 로 합친다.
 */

/** 슬러그가 비어버리는 입력(기호만으로 이루어진 라벨 등)은 조용히 넘기지 않는다. */
export class EmptySlugError extends Error {
  constructor(value: string) {
    super(`[NOR-16] 슬러그로 변환할 수 없는 값입니다: ${JSON.stringify(value)}`);
    this.name = 'EmptySlugError';
  }
}

/**
 * 표시 문자열을 URL 슬러그로 변환한다. 같은 입력은 항상 같은 출력이다.
 *
 * @throws {EmptySlugError} 변환 결과가 빈 문자열일 때.
 */
export function toSlug(value: string): string {
  const slug = value
    .normalize('NFKC')
    .toLowerCase()
    // 언어 이름 음차: 기호를 그냥 버리면 "C#" 과 "C" 가 같은 슬러그로 충돌한다.
    .replace(/#/g, ' sharp ')
    .replace(/\+/g, ' plus ')
    // 구분자 성격의 문자는 하이픈으로 모은다.
    .replace(/[\s_/\\.,:;~]+/gu, '-')
    // 유니코드 문자·숫자·하이픈만 남긴다(한글·일본어 등은 그대로 보존).
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length === 0) throw new EmptySlugError(value);
  return slug;
}
