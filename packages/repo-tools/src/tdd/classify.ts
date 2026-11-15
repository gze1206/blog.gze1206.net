export interface VitestJsonReport {
  readonly numFailedTests: number;
  readonly numPassedTests: number;
  readonly numFailedTestSuites: number;
  readonly testResults: readonly {
    readonly name: string;
    readonly status: string;
    readonly message?: string;
    readonly assertionResults: readonly { readonly status: string }[];
  }[];
}

export type RedVerdict =
  | { readonly kind: 'assertion' }
  | { readonly kind: 'missing-module' }
  | { readonly kind: 'passing' }
  | { readonly kind: 'broken'; readonly reason: string };

const MISSING_MODULE =
  /Cannot find module|Cannot find package|Failed to (?:load|resolve) (?:url|import)|does not provide an export named/u;
const BROKEN = /SyntaxError|Transform failed|Unexpected token|Parse failure/u;

export function classifyRedRun(report: VitestJsonReport): RedVerdict {
  if (
    report.testResults.some((suite) => suite.assertionResults.some((a) => a.status === 'failed'))
  ) {
    return { kind: 'assertion' };
  }
  const messages = report.testResults
    .filter((suite) => suite.status === 'failed')
    .map((suite) => suite.message ?? '');
  if (messages.length === 0) return { kind: 'passing' };
  const broken = messages.find((message) => BROKEN.test(message) || !MISSING_MODULE.test(message));
  if (broken !== undefined) return { kind: 'broken', reason: broken.split('\n')[0] ?? broken };
  return { kind: 'missing-module' };
}

export function classifyGreenRun(report: VitestJsonReport): boolean {
  return (
    report.numFailedTests === 0 && report.numFailedTestSuites === 0 && report.numPassedTests > 0
  );
}
