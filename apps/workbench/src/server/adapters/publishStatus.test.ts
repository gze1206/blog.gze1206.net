import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { expect, it } from 'vitest';

import { transformPublicDraft } from '../../core/publishing/transform.js';
import { encodeDocumentId } from '../documentIds.js';
import { PublicBlogAdapter } from './publicBlog.js';
import { startHttpsGitServer } from '../../../test/fixtures/httpsGitServer.js';
import { LoopbackTestRemotePolicy } from '../../../test/fixtures/loopbackRemotePolicy.js';

const exec = promisify(execFile);
const id = (name: string) => encodeDocumentId(`drafts/${name}.md`);
const POSTS = 'apps/blog/src/content/posts';

const draft = (slug: string, body = '본문') => `---
title: ${slug} 글
kind: public-draft
createdAt: 2026-08-10
updatedAt: 2026-08-12
publicEligible: true
description: 설명
slug: ${slug}
category: engineering
tags: ['a']
publishedAt: 2026-08-12T09:00:00.000Z
---
${body}
`;

async function git(root: string, ...args: string[]) {
  return (await exec('git', ['-C', root, ...args])).stdout.trim();
}

it(
  'NOR-209 AC-3: 공개 초안마다 발행 상태를, 그리고 블로그에만 있는 글을 돌려준다',
  { timeout: 30000 },
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'publish-status-'));
    const source = path.join(root, 'source');
    const workspace = path.join(root, 'workspace');
    await mkdir(path.join(source, POSTS), { recursive: true });
    await mkdir(path.join(workspace, 'drafts'), { recursive: true });
    await mkdir(path.join(root, 'work'));
    await mkdir(path.join(root, 'outbox'));
    const same = transformPublicDraft({
      source: draft('same'),
      privateRoot: workspace,
      assets: [],
    }).source;
    await writeFile(path.join(source, POSTS, 'same.mdoc'), same);
    await writeFile(
      path.join(source, POSTS, 'changed.mdoc'),
      same.replace('slug: same', 'slug: changed'),
    );
    await writeFile(
      path.join(source, POSTS, 'blog-only.mdoc'),
      same.replace('slug: same', 'slug: blog-only').replace('title: same 글', 'title: 블로그 글'),
    );
    // 스모크 테스트·픽스처 같은 draft 글은 "블로그에만 있는 글" 로 알리지 않는다.
    await writeFile(
      path.join(source, POSTS, 'smoke.mdoc'),
      same.replace('slug: same', 'slug: smoke').replace('draft: false', 'draft: true'),
    );
    await git(source, 'init', '-b', 'main');
    await git(source, 'config', 'user.name', 'Fixture');
    await git(source, 'config', 'user.email', 'fixture@example.test');
    await git(source, 'add', '.');
    await git(source, 'commit', '-m', 'initial');
    const server = await startHttpsGitServer(source);
    try {
      const adapter = new PublicBlogAdapter({
        privateRoot: workspace,
        remote: server.remote,
        branch: 'main',
        workBase: path.join(root, 'work'),
        outboxRoot: path.join(root, 'outbox'),
        author: { name: 'Fixture', email: 'fixture@example.test' },
        remotePolicy: new LoopbackTestRemotePolicy(server.certificateAuthority),
      }) as unknown as Record<string, (...args: unknown[]) => Promise<unknown>>;
      expect(adapter).toHaveProperty('publishStatus');
      const status = (await adapter['publishStatus']?.([
        { documentId: id('same'), source: draft('same') },
        { documentId: id('changed'), source: draft('changed', '고친 본문') },
        { documentId: id('new'), source: draft('new') },
        { documentId: id('bad'), source: draft('bad', '![x](images/missing.png)') },
      ])) as {
        documents: { documentId: string; slug: string | null; status: string }[];
        blogOnly: { slug: string; title: string; repoPath: string }[];
      };
      expect(status.documents).toEqual([
        { documentId: id('same'), slug: 'same', status: 'published' },
        { documentId: id('changed'), slug: 'changed', status: 'differs' },
        { documentId: id('new'), slug: 'new', status: 'unpublished' },
        { documentId: id('bad'), slug: 'bad', status: 'invalid' },
      ]);
      expect(status.blogOnly).toEqual([
        { slug: 'blog-only', title: '블로그 글', repoPath: `${POSTS}/blog-only.mdoc` },
      ]);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  },
);

it('NOR-209 AC-5: 동시에 온 발행 상태 조회는 한 번만 계산한다', { timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'publish-status-once-'));
  const source = path.join(root, 'source');
  await mkdir(path.join(source, POSTS), { recursive: true });
  await mkdir(path.join(root, 'workspace'));
  await mkdir(path.join(root, 'work'));
  await mkdir(path.join(root, 'outbox'));
  await writeFile(path.join(source, 'README.md'), 'x\n');
  await git(source, 'init', '-b', 'main');
  await git(source, 'config', 'user.name', 'Fixture');
  await git(source, 'config', 'user.email', 'fixture@example.test');
  await git(source, 'add', '.');
  await git(source, 'commit', '-m', 'initial');
  const server = await startHttpsGitServer(source);
  try {
    const adapter = new PublicBlogAdapter({
      privateRoot: path.join(root, 'workspace'),
      remote: server.remote,
      branch: 'main',
      workBase: path.join(root, 'work'),
      outboxRoot: path.join(root, 'outbox'),
      author: { name: 'Fixture', email: 'fixture@example.test' },
      remotePolicy: new LoopbackTestRemotePolicy(server.certificateAuthority),
    });
    const manager = Reflect.get(adapter, 'cloneManager') as { create: () => Promise<unknown> };
    let clones = 0;
    const create = manager.create.bind(manager);
    manager.create = () => {
      clones += 1;
      return create();
    };
    const call = () =>
      (adapter as unknown as Record<string, (drafts: unknown[]) => Promise<unknown>>)[
        'publishStatus'
      ]?.([]);
    const [first, second] = await Promise.all([call(), call()]);
    expect(second).toEqual(first);
    expect(clones).toBe(1);
  } finally {
    await server.close();
    await rm(root, { recursive: true, force: true });
  }
});

it(
  'NOR-218 AC-2: 새로 받은 main 의 public 에 있는 이미지만 허용한다',
  { timeout: 30000 },
  async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'publish-status-public-'));
    const source = path.join(root, 'source');
    const workspace = path.join(root, 'workspace');
    await mkdir(path.join(source, 'apps/blog/public/img'), { recursive: true });
    await mkdir(path.join(source, POSTS), { recursive: true });
    await mkdir(workspace);
    await mkdir(path.join(root, 'work'));
    await mkdir(path.join(root, 'outbox'));
    await writeFile(path.join(source, 'apps/blog/public/img/a.png'), 'png');
    await git(source, 'init', '-b', 'main');
    await git(source, 'config', 'user.name', 'Fixture');
    await git(source, 'config', 'user.email', 'fixture@example.test');
    await git(source, 'add', '.');
    await git(source, 'commit', '-m', 'initial');
    const server = await startHttpsGitServer(source);
    try {
      const adapter = new PublicBlogAdapter({
        privateRoot: workspace,
        remote: server.remote,
        branch: 'main',
        workBase: path.join(root, 'work'),
        outboxRoot: path.join(root, 'outbox'),
        author: { name: 'Fixture', email: 'fixture@example.test' },
        remotePolicy: new LoopbackTestRemotePolicy(server.certificateAuthority),
      });
      const status = await adapter.publishStatus([
        { documentId: id('kept'), source: draft('kept', '![그림](/img/a.png)') },
        { documentId: id('gone'), source: draft('gone', '![그림](/img/missing.png)') },
      ]);
      expect(status.documents.map((document) => document.status)).toEqual([
        'unpublished',
        'invalid',
      ]);
    } finally {
      await server.close();
      await rm(root, { recursive: true, force: true });
    }
  },
);
