import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';

import { PublicBlogAdapter } from './publicBlog.js';
import { startHttpsGitServer } from '../../../test/fixtures/httpsGitServer.js';
import { LoopbackTestRemotePolicy } from '../../../test/fixtures/loopbackRemotePolicy.js';

const exec = promisify(execFile);
const CONTENT = 'apps/blog/src/content';
const PROFILE =
  '{\n  "name": "이름",\n  "headline": "직함",\n  "introduction": "소개",\n  "skills": ["C#"]\n}\n';
const SERIES = '{\n  "name": "시리즈",\n  "slug": "a",\n  "description": "설명"\n}\n';

async function git(root: string, ...args: string[]) {
  return (await exec('git', ['-C', root, ...args])).stdout.trim();
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'site-content-'));
  const source = path.join(root, 'source');
  const outbox = path.join(root, 'outbox');
  await mkdir(path.join(source, CONTENT, 'series'), { recursive: true });
  await mkdir(path.join(source, CONTENT, 'experience'), { recursive: true });
  await mkdir(path.join(root, 'work'));
  await mkdir(path.join(root, 'workspace'));
  await mkdir(outbox);
  await writeFile(path.join(source, CONTENT, 'profile.json'), PROFILE);
  await writeFile(path.join(source, CONTENT, 'series/a.json'), SERIES);
  await writeFile(path.join(source, CONTENT, 'experience/broken.json'), '{ not json');
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
  });
  return {
    source,
    outbox,
    adapter: adapter as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>,
    async close() {
      await server.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

it(
  'NOR-208 AC-3: main 의 사이트 콘텐츠를 읽고, 읽지 못한 파일은 문제로 돌려준다',
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      expect(f.adapter).toHaveProperty('listSite');
      const listed = (await f.adapter['listSite']?.()) as {
        entries: { collection: string; id: string; data: unknown }[];
        problems: { path: string }[];
      };
      expect(listed.entries).toEqual([
        { collection: 'profile', id: 'profile', data: JSON.parse(PROFILE) },
        { collection: 'series', id: 'a', data: JSON.parse(SERIES) },
      ]);
      expect(listed.problems.map((problem) => problem.path)).toEqual([
        `${CONTENT}/experience/broken.json`,
      ]);
    } finally {
      await f.close();
    }
  },
);

it(
  'NOR-208 AC-4·5: 검토한 변경을 커밋으로 만들어 outbox 에 남긴다',
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      expect(f.adapter).toHaveProperty('reviewSite');
      const change = {
        collection: 'series',
        id: 'a',
        data: { name: '시리즈', slug: 'a', description: '새 설명' },
      };
      const review = (await f.adapter['reviewSite']?.(change)) as {
        reviewId: string;
        branch: string;
        diff: string;
        kind: string;
        targetPath: string;
      };
      expect(review.kind).toBe('write');
      expect(review.branch).toBe('content/site-series-a');
      expect(review.targetPath).toBe(`${CONTENT}/series/a.json`);
      expect(review.diff).toContain('+  "description": "새 설명"');
      const result = (await f.adapter['publishSite']?.(change, {
        confirmPublish: true,
        reviewId: review.reviewId,
      })) as { outboxRef: string; branch: string };
      expect(result.branch).toBe('content/site-series-a');
      const manifest = JSON.parse(
        await readFile(path.join(f.outbox, result.outboxRef), 'utf8'),
      ) as {
        targetPath: string;
      };
      expect(manifest.targetPath).toBe(`${CONTENT}/series/a.json`);
      expect((await readdir(f.outbox)).some((name) => name.startsWith('site-series-a-'))).toBe(
        true,
      );
    } finally {
      await f.close();
    }
  },
);

it('NOR-208 AC-5: 검토 뒤 입력이 바뀌면 발행하지 않는다', { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    expect(f.adapter).toHaveProperty('reviewSite');
    const change = { collection: 'series', id: 'a', delete: true };
    const review = (await f.adapter['reviewSite']?.(change)) as { reviewId: string; kind: string };
    expect(review.kind).toBe('delete');
    await expect(
      f.adapter['publishSite']?.(
        { collection: 'series', id: 'a', data: { name: 'x', slug: 'a', description: 'y' } },
        { confirmPublish: true, reviewId: review.reviewId },
      ),
    ).rejects.toThrow();
    expect(await readdir(f.outbox)).toEqual([]);
  } finally {
    await f.close();
  }
});
