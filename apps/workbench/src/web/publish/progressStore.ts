/**
 * 발행 진행 토스트가 기억하는 발행 목록 (NOR-228).
 *
 * 화면을 옮기거나 새로고침해도 진행 중인 발행을 이어서 보이도록 localStorage 에 둔다. 저장된 값은
 * 이 브라우저가 쓴 것이지만 손으로 고칠 수도 있으므로, 읽을 때 모양을 다시 확인한다.
 */
import type { ProgressStage, PublishProgressItem } from '../api.js';

export interface PublishJob {
  readonly ref: string;
  readonly title: string;
  readonly startedAt: string;
  readonly stage: ProgressStage;
  readonly reason?: string;
  readonly pull?: { readonly number: number; readonly url: string };
}

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'workbench.publishJobs';
const MAX_JOBS = 10;
const REF = /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/u;
const STAGES: readonly ProgressStage[] = [
  'queued',
  'relayed',
  'checking',
  'merged',
  'failed',
  'closed',
  'rejected',
  'stale',
];
/** 링크로 그릴 수 있는 PR 주소(NOR-228 AC-8). 서버 응답과 저장소 모두 이 규칙을 지나야 한다. */
const PULL_URL = /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/pull\/\d+$/u;

export function isPullUrl(url: unknown): url is string {
  return typeof url === 'string' && PULL_URL.test(url);
}

const FINAL: ReadonlySet<ProgressStage> = new Set([
  'merged',
  'failed',
  'closed',
  'rejected',
  'stale',
]);

export function isFinal(stage: ProgressStage): boolean {
  return FINAL.has(stage);
}

/** 새 발행을 맨 앞에 둔다. 같은 이름은 하나만 남긴다. */
export function addJob(jobs: readonly PublishJob[], job: PublishJob): PublishJob[] {
  return [job, ...jobs.filter((item) => item.ref !== job.ref)].slice(0, MAX_JOBS);
}

export function removeJob(jobs: readonly PublishJob[], ref: string): PublishJob[] {
  return jobs.filter((job) => job.ref !== ref);
}

export function applyProgress(
  jobs: readonly PublishJob[],
  progress: readonly PublishProgressItem[],
): PublishJob[] {
  const byRef = new Map(progress.map((item) => [item.ref, item]));
  return jobs.map((job) => {
    const item = byRef.get(job.ref);
    if (!item) return job;
    const { reason: _reason, pull: _pull, ...rest } = job;
    return {
      ...rest,
      stage: item.stage,
      ...(item.reason === undefined ? {} : { reason: item.reason }),
      ...(item.pull === undefined || !isPullUrl(item.pull.url) ? {} : { pull: item.pull }),
    };
  });
}

export function loadJobs(storage: KeyValueStorage): PublishJob[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isJob).slice(0, MAX_JOBS) : [];
  } catch {
    return [];
  }
}

export function saveJobs(storage: KeyValueStorage, jobs: readonly PublishJob[]): void {
  try {
    storage.setItem(KEY, JSON.stringify(jobs));
  } catch {
    // 저장소를 못 쓰면 이번 화면에서만 보인다.
  }
}

function isJob(value: unknown): value is PublishJob {
  if (value === null || typeof value !== 'object') return false;
  const job = value as Record<string, unknown>;
  const pull = job.pull as Record<string, unknown> | undefined;
  return (
    typeof job.ref === 'string' &&
    REF.test(job.ref) &&
    typeof job.title === 'string' &&
    typeof job.startedAt === 'string' &&
    STAGES.includes(job.stage as ProgressStage) &&
    (job.reason === undefined || typeof job.reason === 'string') &&
    (pull === undefined || (typeof pull.number === 'number' && isPullUrl(pull.url)))
  );
}
