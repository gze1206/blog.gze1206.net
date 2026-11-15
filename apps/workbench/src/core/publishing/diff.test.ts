import { describe, expect, it } from 'vitest';

describe('unifiedDiff', () => {
  it('NOR-213 AC-1: 바뀐 줄만 -·+ 로, 앞뒤 3줄을 문맥으로 보여 준다', async () => {
    const mod = await import('./diff.js');
    expect(mod).toHaveProperty('unifiedDiff');
    const before = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].join('\n') + '\n';
    const after = before.replace('e\n', 'E\n');
    const diff: string = mod.unifiedDiff('x.txt', before, after);
    const body = diff.split('\n');
    expect(body[0]).toBe('--- a/x.txt');
    expect(body[1]).toBe('+++ b/x.txt');
    expect(body.filter((line) => line.startsWith('-') && !line.startsWith('---'))).toEqual(['-e']);
    expect(body.filter((line) => line.startsWith('+') && !line.startsWith('+++'))).toEqual(['+E']);
    expect(body).toContain(' b');
    expect(body).toContain(' h');
    expect(body).not.toContain(' a');
  });

  it('NOR-213 AC-1: 새 파일은 /dev/null 에서 시작한다', async () => {
    const mod = await import('./diff.js');
    expect(mod).toHaveProperty('unifiedDiff');
    const diff: string = mod.unifiedDiff('x.txt', null, 'a\n');
    expect(diff.split('\n').slice(0, 2)).toEqual(['--- /dev/null', '+++ b/x.txt']);
    expect(diff).toContain('+a');
  });
});
