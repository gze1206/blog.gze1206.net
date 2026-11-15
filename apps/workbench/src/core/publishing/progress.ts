/**
 * 발행 진행 단계 (NOR-228).
 *
 * 확정한 발행은 outbox 매니페스트(`<이름>.json`)로 남고, 호스트 릴레이가 1분마다 처리해 ledger 에
 * 결과를 적는다. ledger 의 공개 사본과 PR 조회 결과를 합쳐 지금 어디까지 왔는지 정한다.
 */
export type LedgerEntry =
  | { readonly kind: 'ok'; readonly branch: string }
  | { readonly kind: 'rejected' | 'stale'; readonly reason: string };

export interface PullInfo {
  readonly number: number;
  readonly url: string;
  readonly state: 'open' | 'closed';
  readonly merged: boolean;
  readonly checks: 'pending' | 'success' | 'failure';
}

export type ProgressStage =
  'queued' | 'relayed' | 'checking' | 'merged' | 'failed' | 'closed' | 'rejected' | 'stale';

export interface PublishProgress {
  readonly ref: string;
  readonly stage: ProgressStage;
  readonly branch?: string;
  readonly reason?: string;
  readonly pull?: { readonly number: number; readonly url: string };
}

/** 매니페스트 이름. 릴레이(publish-relay.sh)가 받는 규칙과 같다. */
export const OUTBOX_REF = /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/u;

// 릴레이의 record() 가 쓰는 모양과 같다. 그 밖의 줄은 믿지 않는다.
const LEDGER_LINE =
  /^([A-Za-z0-9][A-Za-z0-9._-]*\.json) (?:ok (content\/[a-z0-9._-]+)|(rejected|stale) ([a-z-]+))$/u;

export function parseLedger(text: string): Map<string, LedgerEntry> {
  const entries = new Map<string, LedgerEntry>();
  for (const line of text.split('\n')) {
    const match = LEDGER_LINE.exec(line.trim());
    if (!match) continue;
    const [, name, branch, kind, reason] = match;
    if (name === undefined) continue;
    if (branch !== undefined) entries.set(name, { kind: 'ok', branch });
    else if ((kind === 'rejected' || kind === 'stale') && reason !== undefined)
      entries.set(name, { kind, reason });
  }
  return entries;
}

export function publishProgress(
  ref: string,
  entry: LedgerEntry | undefined,
  pull: PullInfo | null | undefined,
): PublishProgress {
  if (entry === undefined) return { ref, stage: 'queued' };
  if (entry.kind !== 'ok') return { ref, stage: entry.kind, reason: entry.reason };
  const base = { ref, branch: entry.branch };
  if (!pull) return { ...base, stage: 'relayed' };
  const link = { pull: { number: pull.number, url: pull.url } };
  if (pull.merged) return { ...base, stage: 'merged', ...link };
  if (pull.state === 'closed') return { ...base, stage: 'closed', ...link };
  if (pull.checks === 'failure') return { ...base, stage: 'failed', ...link };
  return { ...base, stage: 'checking', ...link };
}
