import { Hono } from 'hono';

import {
  OUTBOX_REF,
  parseLedger,
  publishProgress,
  type PullInfo,
} from '../../core/publishing/progress.js';

interface Dependencies {
  /** 릴레이 ledger 의 공개 사본. 없으면 던진다. */
  readonly readLedger: () => Promise<string>;
  readonly lookupPull: (branch: string) => Promise<PullInfo | null>;
}

const MAX_REFS = 10;
/** ledger 는 늘기만 한다. 끝쪽 1MB 만 본다 — 진행 중인 발행은 최근 줄에 있다. */
const MAX_LEDGER_CHARS = 1024 * 1024;

/** 확정한 발행이 어디까지 왔는지 (NOR-228). */
export function createPublishProgressRoutes(dependencies: Dependencies): Hono {
  const routes = new Hono();
  routes.get('/api/publish/progress', async (context) => {
    const refs = context.req.queries('ref') ?? [];
    if (refs.length === 0 || refs.length > MAX_REFS || !refs.every((ref) => OUTBOX_REF.test(ref)))
      return context.json(
        { error: { code: 'invalid_request', message: 'ref must be 1-10 outbox names' } },
        400,
      );
    const text = await dependencies.readLedger().catch(() => '');
    const ledger = parseLedger(text.slice(-MAX_LEDGER_CHARS));
    const progress = await Promise.all(
      [...new Set(refs)].map(async (ref) => {
        const entry = ledger.get(ref);
        const pull = entry?.kind === 'ok' ? await dependencies.lookupPull(entry.branch) : null;
        return publishProgress(ref, entry, pull);
      }),
    );
    return context.json({ progress });
  });
  return routes;
}
