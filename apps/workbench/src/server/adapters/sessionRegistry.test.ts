import { describe, expect, it } from 'vitest';

import { PublishSessionRegistry } from './sessionRegistry.js';

describe('PublishSessionRegistry', () => {
  it('issues opaque random review ids and consumes them only once', async () => {
    const removed: string[] = [];
    const registry = new PublishSessionRegistry({
      leaseMs: 60_000,
      now: () => new Date('2026-08-13T00:00:00.000Z'),
      removeClone: async (cloneDir) => {
        removed.push(cloneDir);
      },
    });

    const first = registry.register({
      cloneDir: '/tmp/first',
      baseSha: 'a'.repeat(40),
      fingerprint: 'one',
    });
    const second = registry.register({
      cloneDir: '/tmp/second',
      baseSha: 'a'.repeat(40),
      fingerprint: 'one',
    });

    expect(first.reviewId).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(second.reviewId).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(second.reviewId).not.toBe(first.reviewId);
    expect(first).toMatchObject({ baseSha: 'a'.repeat(40), fingerprint: 'one' });

    await registry.consume(first.reviewId, 'one', 'a'.repeat(40));
    await expect(registry.consume(first.reviewId, 'one', 'a'.repeat(40))).rejects.toThrow(/stale/u);
    expect(removed).toEqual(['/tmp/first']);
  });

  it('expires an unconfirmed review and removes its clone', async () => {
    const removed: string[] = [];
    let now = new Date('2026-08-13T00:00:00.000Z');
    const registry = new PublishSessionRegistry({
      leaseMs: 1_000,
      now: () => now,
      removeClone: async (cloneDir) => {
        removed.push(cloneDir);
      },
    });
    const session = registry.register({
      cloneDir: '/tmp/expired',
      baseSha: 'a'.repeat(40),
      fingerprint: 'fingerprint',
    });
    now = new Date('2026-08-13T00:00:01.000Z');

    await expect(registry.lookup(session.reviewId)).rejects.toThrow(/stale/u);
    expect(removed).toEqual(['/tmp/expired']);
  });
});
