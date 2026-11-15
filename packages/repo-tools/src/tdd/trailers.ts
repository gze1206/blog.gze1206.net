export type TddPhase = 'red' | 'green' | 'refactor' | 'regression';

export interface CommitInfo {
  readonly sha: string;
  readonly subject: string;
  readonly phase: TddPhase | undefined;
  readonly specs: string[];
  readonly files: string[];
}

/** `git log --name-only` 와 함께 쓴다. 커밋마다 RS 로 시작하고 필드는 US 로 나뉜다. */
export const LOG_FORMAT =
  '%x1e%H%x1f%s%x1f%(trailers:key=TDD,valueonly,separator=%x2c)%x1f%(trailers:key=Spec,valueonly,separator=%x2c)';

const PHASES: ReadonlySet<string> = new Set(['red', 'green', 'refactor', 'regression']);

export function parseCommitLog(raw: string): CommitInfo[] {
  return raw
    .split('\x1e')
    .filter((chunk) => chunk.trim() !== '')
    .map((chunk) => {
      const [sha = '', subject = '', tdd = '', rest = ''] = chunk.split('\x1f');
      const [specLine = '', ...fileLines] = rest.split('\n');
      const phase = tdd.trim();
      if (phase !== '' && !PHASES.has(phase)) {
        throw new Error(`unknown TDD phase "${phase}" in ${sha}`);
      }
      return {
        sha,
        subject,
        phase: phase === '' ? undefined : (phase as TddPhase),
        specs: specLine
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== ''),
        files: fileLines.map((f) => f.trim()).filter((f) => f !== ''),
      };
    });
}
