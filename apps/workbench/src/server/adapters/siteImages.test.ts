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
// 2x3 PNG 머리. 크기 판별에는 IHDR 까지면 된다.
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000200000003080600000000000000',
  'hex',
);
const PORTFOLIO = 'apps/blog/src/content/portfolio';

async function git(root: string, ...args: string[]) {
  return (await exec('git', ['-C', root, ...args])).stdout.trim();
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'site-images-'));
  const source = path.join(root, 'source');
  const outbox = path.join(root, 'outbox');
  await mkdir(path.join(source, PORTFOLIO), { recursive: true });
  await mkdir(path.join(source, 'apps/blog/public/img/portfolio'), { recursive: true });
  await mkdir(path.join(root, 'workspace'));
  await mkdir(path.join(root, 'work'));
  await mkdir(outbox);
  await writeFile(path.join(source, 'apps/blog/public/img/portfolio/old.webp'), 'old');
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
    root,
    outbox,
    adapter,
    async close() {
      await server.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

const portfolio = (media: unknown[], extra: Record<string, unknown> = {}) => ({
  collection: 'portfolio',
  id: 'work',
  data: { title: '작업', summary: '요약', stack: ['C#'], media, ...extra },
});

it('NOR-219 AC-2: 이미지를 저장하고 경로·크기를 돌려준다', { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    expect(f.adapter).toHaveProperty('saveSiteImage');
    const saved = (await f.adapter['saveSiteImage']?.(PNG, '테라 Origin.PNG')) as {
      src: string;
      width: number;
      height: number;
    };
    expect(saved.src).toMatch(/^\/img\/portfolio\/origin-[0-9a-f]{8}\.png$/u);
    expect(saved).toMatchObject({ width: 2, height: 3 });
    const read = (await f.adapter['readSiteImage']?.(saved.src.split('/').pop())) as {
      bytes: Buffer;
      contentType: string;
    };
    expect(read.contentType).toBe('image/png');
    expect(Buffer.compare(read.bytes, PNG)).toBe(0);
    await expect(f.adapter['saveSiteImage']?.(Buffer.from('not image'), 'a.png')).rejects.toThrow();
    await expect(
      f.adapter['saveSiteImage']?.(Buffer.alloc(6 * 1024 * 1024, 1), 'big.png'),
    ).rejects.toThrow();
    expect(await f.adapter['readSiteImage']?.('../secret.png')).toBeNull();
  } finally {
    await f.close();
  }
});

it('NOR-219 AC-3: 올린 이미지를 포트폴리오와 함께 발행한다', { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    expect(f.adapter).toHaveProperty('saveSiteImage');
    const saved = (await f.adapter['saveSiteImage']?.(PNG, 'shot.png')) as { src: string };
    const change = portfolio([{ src: saved.src, alt: '화면', width: 2, height: 3 }], {
      thumbnail: '/img/portfolio/old.webp',
    });
    const review = (await f.adapter['reviewSite']?.(change)) as { reviewId: string; diff: string };
    expect(review.diff).toContain(`apps/blog/public${saved.src}`);
    const result = (await f.adapter['publishSite']?.(change, {
      confirmPublish: true,
      reviewId: review.reviewId,
    })) as { outboxRef: string };
    const manifest = JSON.parse(await readFile(path.join(f.outbox, result.outboxRef), 'utf8')) as {
      assets?: { reference: string }[];
    };
    expect(JSON.stringify(manifest)).toContain(`apps/blog/public${saved.src}`);
    expect((await readdir(f.outbox)).length).toBeGreaterThan(1);
  } finally {
    await f.close();
  }
});

it('NOR-219 AC-3: 어디에도 없는 이미지 경로는 거절한다', { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    expect(f.adapter).toHaveProperty('saveSiteImage');
    await expect(
      f.adapter['reviewSite']?.(
        portfolio([{ src: '/img/portfolio/missing.png', alt: 'x', width: 1, height: 1 }]),
      ),
    ).rejects.toThrow('invalid site content');
  } finally {
    await f.close();
  }
});
