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

async function fixture(extra: Readonly<Record<string, string>> = {}) {
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
  for (const [relativePath, content] of Object.entries(extra)) {
    await mkdir(path.dirname(path.join(source, CONTENT, relativePath)), { recursive: true });
    await writeFile(path.join(source, CONTENT, relativePath), content);
  }
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
      expect(listed.entries).toMatchObject([
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

it(
  'NOR-208 AC-9: 편집을 시작한 뒤 main 이 바뀌었거나 새 항목이 이미 있으면 검토를 거절한다',
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      const listed = (await f.adapter['listSite']?.()) as {
        entries: { id: string; hash?: string }[];
      };
      const series = listed.entries.find((entry) => entry.id === 'a');
      expect(series).toHaveProperty('hash');
      expect(series?.hash).toMatch(/^[0-9a-f]{64}$/u);
      const data = { name: '시리즈', slug: 'a', description: '새 설명' };
      await expect(
        f.adapter['reviewSite']?.({
          collection: 'series',
          id: 'a',
          data,
          baseHash: 'f'.repeat(64),
        }),
      ).rejects.toThrow('site content changed on main');
      await expect(
        f.adapter['reviewSite']?.({ collection: 'series', id: 'a', data, baseHash: null }),
      ).rejects.toThrow('site content changed on main');
      const review = (await f.adapter['reviewSite']?.({
        collection: 'series',
        id: 'a',
        data,
        baseHash: series?.hash,
      })) as { kind: string };
      expect(review.kind).toBe('write');
    } finally {
      await f.close();
    }
  },
);

it(
  'NOR-208 AC-9: 같은 검토를 동시에 두 번 확정하면 하나만 발행한다',
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      const change = {
        collection: 'series',
        id: 'a',
        data: { name: '시리즈', slug: 'a', description: '동시' },
      };
      const review = (await f.adapter['reviewSite']?.(change)) as { reviewId: string };
      const confirm = { confirmPublish: true, reviewId: review.reviewId };
      const results = await Promise.allSettled([
        f.adapter['publishSite']?.(change, confirm),
        f.adapter['publishSite']?.(change, confirm),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect((await readdir(f.outbox)).filter((name) => name.endsWith('.json'))).toHaveLength(1);
    } finally {
      await f.close();
    }
  },
);

it(
  'NOR-235 AC-1, NOR-235 AC-2: 글이 가리키는 시리즈는 지우지 못하고, 아무도 쓰지 않는 시리즈는 지운다',
  { timeout: 30000 },
  async () => {
    const f = await fixture({
      'posts/uses-a.mdoc': "---\ntitle: 'x'\nseries: 'a'\nseriesOrder: 1\ndraft: true\n---\n본문\n",
      'series/b.json': SERIES.replace('"a"', '"b"'),
    });
    try {
      const rejected = f.adapter['reviewSite']?.({ collection: 'series', id: 'a', delete: true });
      await expect(rejected).rejects.toMatchObject({
        status: 400,
        issues: [expect.objectContaining({ path: `${CONTENT}/posts/uses-a.mdoc` })],
      });
      expect(await readdir(f.outbox)).toEqual([]);
      const review = (await f.adapter['reviewSite']?.({
        collection: 'series',
        id: 'b',
        delete: true,
      })) as { kind: string };
      expect(review.kind).toBe('delete');
    } finally {
      await f.close();
    }
  },
);
