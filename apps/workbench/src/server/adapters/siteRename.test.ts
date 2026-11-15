import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';

import { PublicBlogAdapter } from './publicBlog.js';
import { startHttpsGitServer } from '../../../test/fixtures/httpsGitServer.js';
import { LoopbackTestRemotePolicy } from '../../../test/fixtures/loopbackRemotePolicy.js';

const exec = promisify(execFile);
const PORTFOLIO = 'apps/blog/src/content/portfolio';
const OLD =
  '{\n  "id": "blog-v4",\n  "title": "블로그 v4",\n  "summary": "요약",\n  "stack": ["Astro"]\n}\n';

async function git(root: string, ...args: string[]) {
  return (await exec('git', ['-C', root, ...args])).stdout.trim();
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'site-rename-'));
  const source = path.join(root, 'source');
  const outbox = path.join(root, 'outbox');
  await mkdir(path.join(source, PORTFOLIO), { recursive: true });
  await mkdir(path.join(root, 'workspace'));
  await mkdir(path.join(root, 'work'));
  await mkdir(outbox);
  await writeFile(path.join(source, PORTFOLIO, 'blog-v4.json'), OLD);
  await writeFile(path.join(source, PORTFOLIO, 'taken.json'), OLD.replaceAll('blog-v4', 'taken'));
  await git(source, 'init', '-b', 'main');
  await git(source, 'config', 'user.name', 'Fixture');
  await git(source, 'config', 'user.email', 'fixture@example.test');
  await git(source, 'add', '.');
  await git(source, 'commit', '-m', 'initial');
  const server = await startHttpsGitServer(source);
  const adapter = new PublicBlogAdapter({
    privateRoot: path.join(root, 'workspace'),
    remote: server.remote,
    branch: 'main',
    workBase: path.join(root, 'work'),
    outboxRoot: outbox,
    author: { name: 'Fixture', email: 'fixture@example.test' },
    remotePolicy: new LoopbackTestRemotePolicy(server.certificateAuthority),
  }) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
  return {
    source,
    outbox,
    adapter,
    async close() {
      await server.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

const renamed = {
  collection: 'portfolio',
  id: 'boss-toss',
  renameFrom: 'blog-v4',
  baseHash: createHash('sha256').update(OLD).digest('hex'),
  data: { id: 'blog-v4', title: 'Boss Toss', summary: '요약', stack: ['Unity'] },
};

it(
  'NOR-220 AC-2: 이름을 바꾸면 새 파일을 쓰고 옛 파일을 지운 커밋 하나를 만든다',
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      await expect(f.adapter['reviewSite']?.(renamed)).resolves.toMatchObject({
      targetPath: `${PORTFOLIO}/boss-toss.json`,
    });
    const review = (await f.adapter['reviewSite']?.(renamed)) as {
        reviewId: string;
        diff: string;
        targetPath: string;
      };
      expect(review.targetPath).toBe(`${PORTFOLIO}/boss-toss.json`);
      expect(review.diff).toContain(`+++ b/${PORTFOLIO}/boss-toss.json`);
      expect(review.diff).toContain(`--- a/${PORTFOLIO}/blog-v4.json`);
      expect(review.diff).toContain('+  "id": "boss-toss",');
      const result = (await f.adapter['publishSite']?.(renamed, {
        confirmPublish: true,
        reviewId: review.reviewId,
      })) as { exportRef: string; branch: string };
      await git(
        f.source,
        'fetch',
        '-q',
        path.join(f.outbox, result.exportRef),
        `${result.branch}:check`,
      );
      const changed = await git(f.source, 'diff', '--name-status', 'main', 'check');
      expect(changed.split('\n').sort()).toEqual([
        `A\t${PORTFOLIO}/boss-toss.json`,
        `D\t${PORTFOLIO}/blog-v4.json`,
      ]);
      expect(await git(f.source, 'show', `check:${PORTFOLIO}/boss-toss.json`)).toContain(
        '"id": "boss-toss"',
      );
    } finally {
      await f.close();
    }
  },
);

it('NOR-220 AC-1: 새 이름의 파일이 이미 있으면 거절한다', { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    await expect(f.adapter['reviewSite']?.({ ...renamed, id: 'taken' })).rejects.toThrow(
      'already exists',
    );
    expect(await readdir(f.outbox)).toEqual([]);
    expect(await readFile(path.join(f.source, PORTFOLIO, 'blog-v4.json'), 'utf8')).toBe(OLD);
  } finally {
    await f.close();
  }
});
