import { mkdtemp, mkdir, stat, utimes } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

import { EphemeralCloneManager } from './ephemeralClone.js';

const run = promisify(execFile);

describe('EphemeralCloneManager', () => {
  it('removes stale publish directories without touching fresh ones', async () => {
    const workBase = await mkdtemp(path.join(tmpdir(), 'ephemeral-clone-'));
    const stale = path.join(workBase, 'publish-stale');
    const fresh = path.join(workBase, 'publish-fresh');
    await mkdir(stale);
    await mkdir(fresh);
    await utimes(stale, new Date(0), new Date(0));
    const manager = new EphemeralCloneManager({
      workBase,
      remote: 'https://github.com/gze1206/blog.gze1206.net.git',
      branch: 'main',
      remotePolicy: {
        assertAllowed: () => undefined,
        cloneConfig: (remote) => ({ effectiveUrl: remote, gitConfigArgs: [] }),
      },
      orphanAgeMs: 1_000,
    });

    await manager.sweepOrphans(new Date(2_000));

    await expect(stat(stale)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(stat(fresh)).resolves.toMatchObject({ isDirectory: expect.any(Function) });
  });

  it('lets Git reject file transport at the protocol gate', async () => {
    const workBase = await mkdtemp(path.join(tmpdir(), 'ephemeral-clone-'));
    const remote = await mkdtemp(path.join(tmpdir(), 'ephemeral-clone-remote-'));
    await run('git', ['init', '--bare', remote], { encoding: 'utf8' });
    const manager = new EphemeralCloneManager({
      workBase,
      remote: `file://${remote}`,
      branch: 'main',
      remotePolicy: {
        assertAllowed: () => undefined,
        cloneConfig: (effectiveUrl) => ({
          effectiveUrl,
          gitConfigArgs: ['protocol.allow=never', 'protocol.https.allow=always'],
        }),
      },
    });

    await expect(manager.create()).rejects.toThrow(/transport 'file' not allowed/u);
  });
});
