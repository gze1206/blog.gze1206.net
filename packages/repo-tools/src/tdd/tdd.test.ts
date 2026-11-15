import { describe, expect, it } from 'vitest';
import { classifyGreenRun, classifyRedRun, type VitestJsonReport } from './classify.ts';
import { packageDirOf, planRedGreenChecks } from './plan.ts';
import { parseCommitLog } from './trailers.ts';

const RS = '\x1e';
const US = '\x1f';

describe('parseCommitLog', () => {
  it('NOR-195 AC-3: 커밋마다 TDD·Spec trailer 와 바뀐 파일을 읽는다', () => {
    const raw =
      `${RS}aaa${US}✅ test: red${US}red\n${US}NOR-1 AC-2\n\n\napps/blog/src/a.test.ts\n` +
      `${RS}bbb${US}✨ feat: green${US}green${US}\n\napps/blog/src/a.ts\n` +
      `${RS}ccc${US}📝 docs${US}${US}\n\ndocs/x.md\n`;
    expect(parseCommitLog(raw)).toEqual([
      {
        sha: 'aaa',
        subject: '✅ test: red',
        phase: 'red',
        specs: ['NOR-1 AC-2'],
        files: ['apps/blog/src/a.test.ts'],
      },
      {
        sha: 'bbb',
        subject: '✨ feat: green',
        phase: 'green',
        specs: [],
        files: ['apps/blog/src/a.ts'],
      },
      { sha: 'ccc', subject: '📝 docs', phase: undefined, specs: [], files: ['docs/x.md'] },
    ]);
  });

  it('NOR-195 AC-3: 모르는 TDD 단계는 거부한다', () => {
    expect(() => parseCommitLog(`${RS}aaa${US}x${US}blue${US}\n`)).toThrow(
      /unknown TDD phase "blue"/u,
    );
  });
});

describe('planRedGreenChecks', () => {
  const commit = (sha: string, phase: 'red' | 'green' | undefined, files: string[]) => ({
    sha,
    subject: sha,
    phase,
    specs: [],
    files,
  });

  it('NOR-195 AC-3: red 마다 다음 green 과 바뀐 테스트 파일을 짝짓는다', () => {
    expect(
      planRedGreenChecks([
        commit('r1', 'red', ['apps/blog/src/a.test.ts', 'apps/blog/src/a.ts']),
        commit('d1', undefined, ['docs/x.md']),
        commit('g1', 'green', ['apps/blog/src/a.ts']),
        commit('r2', 'red', ['packages/x/src/b.test.ts']),
      ]),
    ).toEqual([
      { red: 'r1', green: 'g1', testFiles: ['apps/blog/src/a.test.ts'] },
      { red: 'r2', green: undefined, testFiles: ['packages/x/src/b.test.ts'] },
    ]);
  });

  it('NOR-195 AC-3: 테스트 파일을 바꾸지 않은 red 는 거부한다', () => {
    expect(() => planRedGreenChecks([commit('r1', 'red', ['apps/blog/src/a.ts'])])).toThrow(
      /r1 changes no test file/u,
    );
  });

  it('NOR-195 AC-3: 테스트 파일이 속한 패키지 디렉터리를 찾는다', () => {
    expect(packageDirOf('apps/blog/src/a.test.ts')).toBe('apps/blog');
    expect(packageDirOf('packages/repo-tools/src/x.test.ts')).toBe('packages/repo-tools');
    expect(packageDirOf('scripts/x.test.ts')).toBeUndefined();
  });
});

function report(overrides: Partial<VitestJsonReport>): VitestJsonReport {
  return {
    numFailedTests: 0,
    numPassedTests: 0,
    numFailedTestSuites: 0,
    testResults: [],
    ...overrides,
  };
}

describe('classifyRedRun', () => {
  it('NOR-195 AC-3: 단언 실패는 red 로 인정한다', () => {
    expect(
      classifyRedRun(
        report({
          numFailedTests: 1,
          testResults: [
            { name: 'a', status: 'failed', message: '', assertionResults: [{ status: 'failed' }] },
          ],
        }),
      ),
    ).toEqual({ kind: 'assertion' });
  });

  it('NOR-195 AC-3: 아직 없는 모듈 때문에 못 읽은 테스트는 red 로 인정한다', () => {
    expect(
      classifyRedRun(
        report({
          numFailedTestSuites: 1,
          testResults: [
            {
              name: 'a',
              status: 'failed',
              message: 'Error: Failed to load url ./x.ts (resolved id: ./x.ts)',
              assertionResults: [],
            },
          ],
        }),
      ),
    ).toEqual({ kind: 'missing-module' });
  });

  it('NOR-195 AC-3: 문법 오류는 가짜 red 로 거부한다', () => {
    expect(
      classifyRedRun(
        report({
          numFailedTestSuites: 1,
          testResults: [
            {
              name: 'a',
              status: 'failed',
              message: 'SyntaxError: Unexpected token',
              assertionResults: [],
            },
          ],
        }),
      ),
    ).toEqual({ kind: 'broken', reason: 'SyntaxError: Unexpected token' });
  });

  it('NOR-195 AC-3: 통과하는 테스트는 red 가 아니다', () => {
    expect(
      classifyRedRun(
        report({
          numPassedTests: 1,
          testResults: [
            { name: 'a', status: 'passed', message: '', assertionResults: [{ status: 'passed' }] },
          ],
        }),
      ),
    ).toEqual({ kind: 'passing' });
  });
});

describe('classifyGreenRun', () => {
  it('NOR-195 AC-3: 실패 없이 하나 이상 통과해야 green 이다', () => {
    expect(classifyGreenRun(report({ numPassedTests: 2 }))).toBe(true);
    expect(classifyGreenRun(report({ numPassedTests: 0 }))).toBe(false);
    expect(classifyGreenRun(report({ numPassedTests: 2, numFailedTests: 1 }))).toBe(false);
    expect(classifyGreenRun(report({ numPassedTests: 2, numFailedTestSuites: 1 }))).toBe(false);
  });
});
