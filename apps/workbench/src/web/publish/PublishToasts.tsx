/**
 * 발행 진행 토스트 (NOR-228).
 *
 * 앱 최상단에 한 번 둔다. 어느 화면에서 확정했든 `trackPublish`(./trackPublish.ts)로 알리면 여기서 받아 기억하고,
 * 끝날 때까지 10초마다 진행을 묻는다. 화면을 옮기거나 새로고침해도 localStorage 에서 이어 간다.
 */
import { useEffect, useRef, useState } from 'react';

import { loadPublishProgress, type ProgressStage } from '../api.js';
import {
  addJob,
  applyProgress,
  isFinal,
  isPullUrl,
  loadJobs,
  removeJob,
  saveJobs,
  type PublishJob,
} from './progressStore.js';
import { PUBLISH_STARTED_EVENT } from './trackPublish.js';

const POLL_MS = 10_000;
/** 병합된 발행은 잠시 보인 뒤 스스로 닫는다. 실패는 사용자가 닫을 때까지 남긴다. */
const MERGED_LINGER_MS = 20_000;

const STEPS: readonly ProgressStage[] = ['queued', 'relayed', 'checking', 'merged'];

function describe(job: PublishJob): string {
  const pr = job.pull ? `PR #${job.pull.number}` : 'PR';
  switch (job.stage) {
    case 'queued':
      return '릴레이 대기 중 · 1분 안에 PR 로 보냅니다';
    case 'relayed':
      return 'PR 을 여는 중';
    case 'checking':
      return `${pr} 검사 중 · 통과하면 자동으로 병합합니다`;
    case 'merged':
      return `${pr} 병합됨 · 블로그에 배포하는 중입니다`;
    case 'failed':
      return `${pr} 검사가 실패했습니다`;
    case 'closed':
      return `${pr} 이 병합되지 않고 닫혔습니다`;
    case 'rejected':
      return `릴레이가 거절했습니다(${job.reason ?? '사유 없음'})`;
    case 'stale':
      return '그사이 블로그가 바뀌었습니다. 다시 검토해 발행하세요';
  }
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function PublishToasts({ onMerged }: { readonly onMerged?: () => void }) {
  const [jobs, setJobs] = useState<PublishJob[]>(() => {
    const store = storage();
    return store ? loadJobs(store) : [];
  });
  const merged = useRef(
    new Set(jobs.filter((job) => job.stage === 'merged').map((job) => job.ref)),
  );
  const onMergedRef = useRef(onMerged);
  useEffect(() => {
    onMergedRef.current = onMerged;
  }, [onMerged]);

  useEffect(() => {
    const store = storage();
    if (store) saveJobs(store, jobs);
  }, [jobs]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ ref?: unknown; title?: unknown }>).detail;
      if (typeof detail?.ref !== 'string' || typeof detail.title !== 'string') return;
      const job: PublishJob = {
        ref: detail.ref,
        title: detail.title,
        startedAt: new Date().toISOString(),
        stage: 'queued',
      };
      setJobs((current) => addJob(current, job));
    };
    window.addEventListener(PUBLISH_STARTED_EVENT, listener);
    return () => window.removeEventListener(PUBLISH_STARTED_EVENT, listener);
  }, []);

  const pending = jobs.filter((job) => !isFinal(job.stage)).map((job) => job.ref);
  const pendingKey = pending.join(',');
  useEffect(() => {
    if (pendingKey === '') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const progress = await loadPublishProgress(pendingKey.split(','));
        if (!cancelled) setJobs((current) => applyProgress(current, progress));
      } catch {
        // 조회가 실패해도 다음 차례에 다시 묻는다.
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pendingKey]);

  // 새로 병합된 발행이 있으면 목록의 발행 상태를 다시 읽게 하고, 잠시 뒤 닫는다.
  useEffect(() => {
    const fresh = jobs.filter((job) => job.stage === 'merged' && !merged.current.has(job.ref));
    if (fresh.length === 0) return;
    for (const job of fresh) merged.current.add(job.ref);
    onMergedRef.current?.();
    const timers = fresh.map((job) =>
      window.setTimeout(() => setJobs((current) => removeJob(current, job.ref)), MERGED_LINGER_MS),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [jobs]);

  if (jobs.length === 0) return null;
  return (
    <div
      aria-label="발행 진행"
      aria-live="polite"
      className="fixed right-4 bottom-4 left-4 z-50 grid gap-2 sm:left-auto sm:w-80"
      role="region"
    >
      {jobs.map((job) => {
        const failed = isFinal(job.stage) && job.stage !== 'merged';
        const step = STEPS.indexOf(job.stage);
        return (
          <div
            className={`rounded-lg border bg-surface px-4 py-3 shadow-lg ${
              failed ? 'border-danger/50' : 'border-border-strong'
            }`}
            key={job.ref}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">{job.title}</p>
              <button
                aria-label={`${job.title} 진행 알림 닫기`}
                className="text-xs text-muted hover:text-foreground"
                onClick={() => setJobs((current) => removeJob(current, job.ref))}
                type="button"
              >
                ✕
              </button>
            </div>
            <p className={`mt-1 text-xs ${failed ? 'text-danger' : 'text-muted-strong'}`}>
              {describe(job)}
            </p>
            {failed ? null : (
              <div aria-hidden="true" className="mt-2 flex gap-1">
                {STEPS.map((item, index) => (
                  <span
                    className={`h-1 flex-1 rounded-full ${
                      index <= step ? 'bg-accent' : 'bg-border'
                    } ${index === step && job.stage !== 'merged' ? 'animate-pulse' : ''}`}
                    key={item}
                  />
                ))}
              </div>
            )}
            {job.pull && isPullUrl(job.pull.url) ? (
              <a
                className="mt-2 inline-block text-xs text-accent underline"
                href={job.pull.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                PR #{job.pull.number} 보기
              </a>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
