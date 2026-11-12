import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { BLOG_LAYOUT } from '@gze1206/content-contract';
import { removeSmokeOutput } from './smoke-gate.ts';

it('NOR-197 AC-1: smoke 가 꺼진 빌드는 dist/smoke 를 지우고 켜진 빌드는 남긴다', async () => {
  for (const smoke of [false, true]) {
    const dist = await mkdtemp(path.join(tmpdir(), 'smoke-gate-'));
    await mkdir(path.join(dist, 'smoke'));
    await writeFile(path.join(dist, 'smoke', 'placeholder.svg'), '<svg/>');
    await removeSmokeOutput(dist, smoke);
    expect((await readdir(dist)).includes('smoke')).toBe(smoke);
  }
});

it('NOR-197 AC-1: draft 자산과 OG 이미지만 제거한다', async () => {
  const dist = await mkdtemp(path.join(tmpdir(), 'draft-gate-'));
  for (const slug of ['draft-example', 'public-example']) {
    await mkdir(path.join(dist, 'assets/posts', slug), { recursive: true });
    await writeFile(path.join(dist, 'assets/posts', slug, 'image.png'), 'image');
    await mkdir(path.join(dist, 'og/blog'), { recursive: true });
    await writeFile(path.join(dist, 'og/blog', `${slug}.png`), 'image');
  }
  await removeSmokeOutput(dist, false, ['draft-example']);
  expect(await readdir(path.join(dist, 'assets/posts'))).toEqual(['public-example']);
  expect(await readdir(path.join(dist, 'og/blog'))).toEqual(['public-example.png']);
});

it('NOR-197 AC-2: 공개 Cloudflare 배포에서 smoke 빌드를 거부한다', async () => {
  const { smokeGate } = await import('./smoke-gate.ts');
  const setup = smokeGate().hooks['astro:config:setup'];
  expect(setup).toBeTypeOf('function');
  for (const branch of [BLOG_LAYOUT.publishBranch]) {
    vi.stubEnv('CF_PAGES', '1');
    vi.stubEnv('CF_PAGES_BRANCH', branch);
    vi.stubEnv('BLOG_SMOKE', '1');
    expect(() => setup?.({} as never)).toThrow(/BLOG_SMOKE/);
  }
  vi.stubEnv('CF_PAGES_BRANCH', 'preview');
  expect(() => setup?.({} as never)).not.toThrow();
  vi.unstubAllEnvs();
});

it('NOR-199 AC-2: publishBranch 의 Pages 배포만 프로덕션이다', async () => {
  const { isProductionDeploy } = await import('./smoke-gate.ts');
  expect(isProductionDeploy({ CF_PAGES: '1', CF_PAGES_BRANCH: 'main' })).toBe(true);
  expect(isProductionDeploy({ CF_PAGES: '1', CF_PAGES_BRANCH: 'v4' })).toBe(false);
  expect(isProductionDeploy({ CF_PAGES_BRANCH: 'main' })).toBe(false);
});
