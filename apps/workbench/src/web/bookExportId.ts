/**
 * 내보내기 id 는 작업 공간의 파일 이름이다(NOR-212). ISBN·제목에서 다시 계산하면 등록 뒤 고친 책을
 * 찾지 못한다.
 */
export function bookExportId(document: {
  readonly label: string;
  readonly book?: unknown;
}): string {
  return document.label;
}
