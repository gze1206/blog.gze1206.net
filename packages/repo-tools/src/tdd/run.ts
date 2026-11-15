import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { classifyGreenRun, classifyRedRun, type VitestJsonReport } from './classify.ts';
import { packageDirOf, planRedGreenChecks } from './plan.ts';
import { LOG_FORMAT, parseCommitLog } from './trailers.ts';

const exec = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;

/** 커밋 하나를 임시 worktree 에 풀고, 바뀐 테스트 파일만 패키지별로 돌린다. */
async function runTestsAt(
  repoRoot: string,
  scratch: string,
  sha: string,
  testFiles: readonly string[],
): Promise<(VitestJsonReport | undefined)[]> {
  const dir = path.join(scratch, sha);
  await exec('git', ['worktree', 'add', '--detach', dir, sha], { cwd: repoRoot });
  try {
    await exec('pnpm', ['install', '--frozen-lockfile', '--prefer-offline'], {
      cwd: dir,
      maxBuffer: MAX_BUFFER,
    });
    const byPackage = new Map<string, string[]>();
    for (const file of testFiles) {
      const pkg = packageDirOf(file);
      if (pkg === undefined) throw new Error(`test outside any package: ${file}`);
      byPackage.set(pkg, [...(byPackage.get(pkg) ?? []), path.posix.relative(pkg, file)]);
    }
    const reports: (VitestJsonReport | undefined)[] = [];
    for (const [pkg, files] of byPackage) {
      const out = path.join(scratch, `${sha}-${pkg.replaceAll('/', '_')}.json`);
      // 실패하면 종료 코드가 0 이 아니다. 판정은 리포트로 한다.
      await exec(
        'pnpm',
        ['exec', 'vitest', 'run', ...files, '--reporter=json', `--outputFile=${out}`],
        {
          cwd: path.join(dir, pkg),
          maxBuffer: MAX_BUFFER,
        },
      ).catch(() => undefined);
      reports.push(
        await readFile(out, 'utf8')
          .then((text) => JSON.parse(text) as VitestJsonReport)
          .catch(() => undefined),
      );
    }
    return reports;
  } finally {
    await exec('git', ['worktree', 'remove', '--force', dir], { cwd: repoRoot });
  }
}

export async function runTddEvidence(options: {
  readonly repoRoot: string;
  readonly base: string;
  readonly head: string;
}): Promise<{ ok: boolean; lines: string[] }> {
  const { stdout } = await exec(
    'git',
    [
      'log',
      '--reverse',
      `--format=${LOG_FORMAT}`,
      '--name-only',
      `${options.base}..${options.head}`,
    ],
    { cwd: options.repoRoot, maxBuffer: MAX_BUFFER },
  );
  const checks = planRedGreenChecks(parseCommitLog(stdout));
  const lines: string[] = [];
  let ok = true;
  const scratch = await mkdtemp(path.join(tmpdir(), 'tdd-evidence-'));
  try {
    for (const check of checks) {
      const red = check.red.slice(0, 7);
      if (check.green === undefined) {
        ok = false;
        lines.push(`✗ ${red}: 뒤따르는 TDD: green 커밋이 없다`);
        continue;
      }
      const redReports = await runTestsAt(options.repoRoot, scratch, check.red, check.testFiles);
      const verdicts = redReports.map((r) =>
        r === undefined
          ? ({ kind: 'broken', reason: 'Vitest JSON 리포트가 없다' } as const)
          : classifyRedRun(r),
      );
      const bad = verdicts.find((v) => v.kind === 'passing' || v.kind === 'broken');
      if (bad !== undefined) {
        ok = false;
        lines.push(
          `✗ ${red}: red 가 아니다 (${bad.kind === 'broken' ? bad.reason : '테스트가 통과한다'})`,
        );
        continue;
      }
      const greenReports = await runTestsAt(
        options.repoRoot,
        scratch,
        check.green,
        check.testFiles,
      );
      const greenOk = greenReports.every((r) => r !== undefined && classifyGreenRun(r));
      if (!greenOk) ok = false;
      lines.push(
        `${greenOk ? '✓' : '✗'} ${red} → ${check.green.slice(0, 7)}: ${verdicts.map((v) => v.kind).join(', ')} → ${greenOk ? 'green' : 'green 이 아니다'}`,
      );
    }
    lines.push(`tdd-evidence: ${checks.length} red commits checked`);
    return { ok, lines };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
