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
  '89504e470d0a1a0a0000000d4948445200000002000000030802000000368849d60000000b49444154789c6360c0020000150001aa6597c40000000049454e44ae426082',
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
    expect(saved.src).toMatch(/^\/img\/portfolio\/origin-[0-9a-f]{16}\.webp$/u);
    expect(saved).toMatchObject({ width: 2, height: 3 });
    const read = (await f.adapter['readSiteImage']?.(saved.src.split('/').pop())) as {
      bytes: Buffer;
      contentType: string;
    };
    expect(read.contentType).toBe('image/webp');
    expect(read.bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
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

it(
  'NOR-219 AC-6: 공개 초안 본문 이미지를 자산 자리에 두고 자산 목록에 보인다',
  { timeout: 30000 },
  async () => {
    const f = await fixture();
    try {
      expect(f.adapter).toHaveProperty('savePublicAsset');
      const documentId = 'a'.repeat(43);
      const saved = (await f.adapter['savePublicAsset']?.(documentId, PNG, '스크린 Shot.png')) as {
        reference: string;
        id: string;
      };
      expect(saved.reference).toMatch(/^shot-[0-9a-f]{16}\.webp$/u);
      const assets = (await f.adapter['listAssets']?.(documentId)) as {
        id: string;
        reference: string;
      }[];
      expect(assets).toEqual([
        expect.objectContaining({ id: saved.id, reference: saved.reference }),
      ]);
      await expect(
        f.adapter['savePublicAsset']?.(documentId, Buffer.from('nope'), 'a.png'),
      ).rejects.toThrow();
      await expect(f.adapter['savePublicAsset']?.('../x', PNG, 'a.png')).rejects.toThrow();
    } finally {
      await f.close();
    }
  },
);

it('NOR-219 AC-7: 끝이 잘린 이미지는 받지 않는다', { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    const truncated = PNG.subarray(0, PNG.length - 12);
    await expect(f.adapter['saveSiteImage']?.(truncated, 'cut.png')).rejects.toThrow();
    await expect(
      f.adapter['savePublicAsset']?.('a'.repeat(43), truncated, 'cut.png'),
    ).rejects.toThrow();
  } finally {
    await f.close();
  }
});

it(
  'NOR-222 AC-1 · NOR-222 AC-2: 큰 이미지는 줄이고 메타데이터 없는 WebP 로 저장한다',
  { timeout: 30000 },
  async () => {
    const sharp = (await import('sharp')).default;
    const big = await sharp({
      create: { width: 2400, height: 300, channels: 3, background: '#336699' },
    })
      .png()
      .withExif({ IFD0: { Copyright: 'secret-author' } })
      .toBuffer();
    const f = await fixture();
    try {
      const saved = (await f.adapter['saveSiteImage']?.(big, 'wide.png')) as {
        src: string;
        width: number;
        height: number;
      };
      expect(saved).toMatchObject({ width: 1200, height: 150 });
      expect(saved.src).toMatch(/\.webp$/u);
      const read = (await f.adapter['readSiteImage']?.(saved.src.split('/').pop())) as {
        bytes: Buffer;
      };
      expect(read.bytes.includes(Buffer.from('secret-author'))).toBe(false);
      const meta = await sharp(read.bytes).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 1200, height: 150 });
      expect(meta.exif).toBeUndefined();

      const body = (await f.adapter['savePublicAsset']?.('b'.repeat(43), big, 'wide.png')) as {
        reference: string;
      };
      expect(body.reference).toMatch(/\.webp$/u);
    } finally {
      await f.close();
    }
  },
);
