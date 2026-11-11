import type { CommitInfo } from './trailers.ts';

export interface RedGreenCheck {
  readonly red: string;
  readonly green: string | undefined;
  readonly testFiles: string[];
}

export const TEST_FILE = /\.test\.(?:ts|tsx|mts)$/u;
const PACKAGE_DIR = /^((?:apps|packages)\/[^/]+)\//u;

export function packageDirOf(file: string): string | undefined {
  return PACKAGE_DIR.exec(file)?.[1];
}

export function planRedGreenChecks(commits: readonly CommitInfo[]): RedGreenCheck[] {
  const checks: RedGreenCheck[] = [];
  commits.forEach((commit, index) => {
    if (commit.phase !== 'red') return;
    const testFiles = commit.files.filter((file) => TEST_FILE.test(file));
    if (testFiles.length === 0) throw new Error(`red commit ${commit.sha} changes no test file`);
    const green = commits.slice(index + 1).find((later) => later.phase === 'green');
    checks.push({ red: commit.sha, green: green?.sha, testFiles });
  });
  return checks;
}
