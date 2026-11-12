import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';
import { BLOG_LAYOUT } from '@gze1206/content-contract';
import { parseDocument } from '../../core/document/document.js';
import { serializePublicBook, toPublicBook } from '../../core/books/publicBook.js';
import { PublicBlogAdapter } from './publicBlog.js';
import { startHttpsGitServer } from '../../../test/fixtures/httpsGitServer.js';
import { LoopbackTestRemotePolicy } from '../../../test/fixtures/loopbackRemotePolicy.js';
const exec = promisify(execFile);
const png = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489',
  'hex',
);
const document = (extra: string) =>
  `---\ntitle: 책\nkind: book\ncreatedAt: 2026-01-01\nupdatedAt: 2026-01-01\nauthors: [저자]\nstatus: reading\nformat: paper\nsource: purchase\n${extra}\n---\n`;
async function git(root: string, ...args: string[]) {
  return (await exec('git', ['-C', root, ...args])).stdout.trim();
}
async function fixture(initial = '{}\n', { staleCovers = true } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'book-export-'));
  const source = path.join(root, 'source');
  const workspace = path.join(root, 'workspace');
  const work = path.join(root, 'work');
  const outbox = path.join(root, 'outbox');
  await Promise.all([
    mkdir(path.join(source, BLOG_LAYOUT.booksDir), { recursive: true }),
    mkdir(path.join(source, BLOG_LAYOUT.bookCoversDir), { recursive: true }),
    mkdir(path.join(workspace, 'books'), { recursive: true }),
    mkdir(path.join(workspace, 'assets/books'), { recursive: true }),
    mkdir(work),
    mkdir(outbox),
  ]);
  await writeFile(path.join(source, BLOG_LAYOUT.booksDir, '책.json'), initial);
  await writeFile(path.join(source, BLOG_LAYOUT.bookCoversDir, '.gitkeep'), '');
  if (staleCovers)
    for (const ext of ['jpg', 'jpeg', 'png', 'webp'])
      await writeFile(path.join(source, BLOG_LAYOUT.bookCoversDir, `책.${ext}`), 'old');
  await writeFile(path.join(workspace, 'assets/books/new.png'), png);
  await git(source, 'init', '-b', 'main');
  await git(source, 'config', 'user.name', 'Fixture');
  await git(source, 'config', 'user.email', 'fixture@example.test');
  await git(source, 'add', '.');
  await git(source, 'commit', '-m', 'initial');
  const server = await startHttpsGitServer(source);
  const adapter = new PublicBlogAdapter({
    privateRoot: workspace,
    remote: server.remote,
    branch: 'main',
    workBase: work,
    outboxRoot: outbox,
    author: { name: 'Fixture', email: 'fixture@example.test' },
    remotePolicy: new LoopbackTestRemotePolicy(server.certificateAuthority),
  });
  return {
    root,
    source,
    workspace,
    outbox,
    adapter,
    async close() {
      await server.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
it.each([
  { extra: 'visible: false', keep: null },
  { extra: '', keep: null },
  { extra: 'cover: assets/books/new.png', keep: 'png' },
])(
  'NOR-196 AC-13: 삭제하거나 표지를 바꾸면 남은 이전 표지를 지운다 ($extra)',
  { timeout: 30000 },
  async ({ extra, keep }) => {
    const f = await fixture();
    try {
      await writeFile(path.join(f.workspace, 'books/책.md'), document(extra));
      expect(f.adapter).toHaveProperty('reviewBook');
      const review = await Reflect.apply(Reflect.get(f.adapter, 'reviewBook'), f.adapter, ['책']);
      const result = await Reflect.apply(Reflect.get(f.adapter, 'publishBook'), f.adapter, [
        '책',
        { confirmPublish: true, reviewId: review.reviewId },
      ]);
      const consumer = path.join(f.root, 'consumer');
      await exec('git', ['clone', f.source, consumer]);
      await git(
        consumer,
        'fetch',
        path.join(f.outbox, result.exportRef),
        `${result.branch}:${result.branch}`,
      );
      await git(consumer, 'switch', result.branch);
      for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
        const file = path.join(consumer, BLOG_LAYOUT.bookCoversDir, `책.${ext}`);
        if (ext === keep) expect(await readFile(file)).toEqual(png);
        else await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
      }
      if (extra.includes('visible'))
        await expect(
          readFile(path.join(consumer, BLOG_LAYOUT.booksDir, '책.json')),
        ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await f.close();
    }
  },
);

it('NOR-196 AC-13: 바뀐 것이 없으면 확정을 거부한다', { timeout: 30000 }, async () => {
  const source = document('');
  const f = await fixture(serializePublicBook(toPublicBook(parseDocument(source))), {
    staleCovers: false,
  });
  try {
    await writeFile(path.join(f.workspace, 'books/책.md'), source);
    expect(f.adapter).toHaveProperty('reviewBook');
    const review = await Reflect.apply(Reflect.get(f.adapter, 'reviewBook'), f.adapter, ['책']);
    expect(review.kind).toBe('noop');
    await expect(
      Reflect.apply(Reflect.get(f.adapter, 'publishBook'), f.adapter, [
        '책',
        { confirmPublish: true, reviewId: review.reviewId },
      ]),
    ).rejects.toThrow('no changes');
  } finally {
    await f.close();
  }
});

it('NOR-196 AC-13: 책 삭제 검토 diff 는 삭제 대상임을 표시한다', { timeout: 30_000 }, async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.workspace, 'books/책.md'), document('visible: false'));
    const review = await f.adapter.reviewBook('책');
    expect(review.diff).toContain('+++ /dev/null');
    expect(review.diff).toContain('+0,0');
  } finally {
    await f.close();
  }
});

it(
  'NOR-196 AC-13: 책 JSON 이 같아도 표지 이미지가 바뀌었으면 내보낸다',
  { timeout: 30_000 },
  async () => {
    const source = document('cover: assets/books/new.png');
    const current = serializePublicBook(
      toPublicBook(parseDocument(source), {
        src: `${BLOG_LAYOUT.bookCoverUrlPrefix}/${encodeURIComponent('책')}.png`,
        width: 1,
        height: 1,
      }),
    );
    const f = await fixture(current);
    try {
      await writeFile(path.join(f.workspace, 'books/책.md'), source);
      const review = await f.adapter.reviewBook('책');
      expect(review.kind).toBe('write');
      const result = await f.adapter.publishBook('책', {
        confirmPublish: true,
        reviewId: review.reviewId,
      });
      const consumer = path.join(f.root, 'consumer');
      await exec('git', ['clone', f.source, consumer]);
      await git(
        consumer,
        'fetch',
        path.join(f.outbox, result.exportRef),
        `${result.branch}:${result.branch}`,
      );
      await git(consumer, 'switch', result.branch);
      expect(await readFile(path.join(consumer, BLOG_LAYOUT.booksDir, '책.json'), 'utf8')).toBe(
        current,
      );
      for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
        const file = path.join(consumer, BLOG_LAYOUT.bookCoversDir, `책.${ext}`);
        if (ext === 'png') expect(await readFile(file)).toEqual(png);
        else await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
      }
    } finally {
      await f.close();
    }
  },
);

it('NOR-196 AC-13: 작업 공간의 정규 파일이 아니면 읽지 않는다', { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    await mkdir(path.join(f.workspace, 'books/책.md'));
    await expect(f.adapter.reviewBook('책')).rejects.toThrow('not a regular file');
  } finally {
    await f.close();
  }
});

it('NOR-196 AC-13: 5 MiB를 넘는 표지를 거부한다', { timeout: 30000 }, async () => {
  const f = await fixture();
  try {
    await writeFile(path.join(f.workspace, 'books/책.md'), document('cover: assets/books/new.png'));
    await writeFile(
      path.join(f.workspace, 'assets/books/new.png'),
      Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]),
    );
    await expect(f.adapter.reviewBook('책')).rejects.toThrow('book cover is too large');
  } finally {
    await f.close();
  }
});
