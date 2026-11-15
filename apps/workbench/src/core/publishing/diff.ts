import { createTwoFilesPatch } from 'diff';

/**
 * 발행 검토에 보여 줄 unified diff (NOR-213). 바뀐 줄만 -·+ 로, 앞뒤 3줄을 문맥으로 둔다.
 * 예전에는 비교 없이 기존 줄 전부를 지우고 새 줄 전부를 더한 모양이라 무엇이 바뀌었는지 보이지 않았다.
 */
export function unifiedDiff(
  targetPath: string,
  before: string | null,
  after: string | null,
): string {
  const patch = createTwoFilesPatch(
    before === null ? '/dev/null' : `a/${targetPath}`,
    after === null ? '/dev/null' : `b/${targetPath}`,
    before ?? '',
    after ?? '',
    undefined,
    undefined,
    { context: 3 },
  );
  // 첫 줄은 "Index"·"===" 구분선이다. 표준 unified diff 처럼 --- 부터 보여 준다.
  const lines = patch.split('\n');
  const start = lines.findIndex((line) => line.startsWith('--- '));
  return lines
    .slice(start)
    .map((line) => line.replace(/^(---|\+\+\+) (\S+)\t.*$/u, '$1 $2'))
    .join('\n');
}
