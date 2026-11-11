import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';
import { BLOG_LAYOUT } from '@gze1206/content-contract';

import { PublishOutbox } from './publishOutbox.js';

const run = promisify(execFile);

describe('PublishOutbox', () => {
  it('writes private export artifacts and exposes only outbox-relative references', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'publish-outbox-'));
    const cloneDir = await mkdtemp(path.join(tmpdir(), 'publish-clone-'));
    await mkdir(path.join(cloneDir, BLOG_LAYOUT.postsDir), { recursive: true });
    await writeFile(path.join(cloneDir, 'README.md'), 'base\n');
    await git(cloneDir, 'init', '-b', 'main');
    await git(cloneDir, 'config', 'user.name', 'Test Publisher');
    await git(cloneDir, 'config', 'user.email', 'publisher@example.test');
    await git(cloneDir, 'add', 'README.md');
    await git(cloneDir, 'commit', '-m', 'base');
    const baseSha = await git(cloneDir, 'rev-parse', 'HEAD');
    await git(cloneDir, 'switch', '-c', 'content/safe');
    await writeFile(path.join(cloneDir, BLOG_LAYOUT.postsDir, 'safe.mdoc'), 'published source\n');
    await git(cloneDir, 'add', `${BLOG_LAYOUT.postsDir}/safe.mdoc`);
    await git(cloneDir, 'commit', '-m', 'publish');
    const commit = await git(cloneDir, 'rev-parse', 'HEAD');
    const outbox = new PublishOutbox(root);

    const result = await outbox.write({
      cloneDir,
      baseSha,
      branch: 'content/safe',
      commit,
      commitMessage: 'publish',
      targetPath: `${BLOG_LAYOUT.postsDir}/safe.mdoc`,
      source: 'published source\n',
      diff: 'diff --git a b\n',
      author: 'Publisher <publisher@example.test>',
      assets: [
        {
          reference: `${BLOG_LAYOUT.publicDir}/assets/posts/safe/image.png`,
          bytes: Buffer.from('image'),
        },
      ],
      forceFormat: 'format-patch',
    });

    expect(result).toMatchObject({
      outboxRef: expect.stringMatching(/^safe-.*\.json$/u),
      exportRef: expect.stringMatching(/^safe-.*\.patch$/u),
      exportFormat: 'format-patch',
    });
    expect(path.isAbsolute(result.outboxRef)).toBe(false);
    expect(path.isAbsolute(result.exportRef)).toBe(false);
    await expect(readFile(path.join(root, result.outboxRef), 'utf8')).resolves.toContain(
      'format-patch',
    );
    await expect(stat(root)).resolves.toMatchObject({ mode: expect.any(Number) });
    expect((await stat(root)).mode & 0o777).toBe(0o700);
    expect((await stat(path.join(root, result.exportRef))).mode & 0o777).toBe(0o600);
  });
});

async function git(root: string, ...args: string[]): Promise<string> {
  const { stdout } = await run('git', ['-C', root, ...args], { encoding: 'utf8' });
  return stdout.trim();
}
