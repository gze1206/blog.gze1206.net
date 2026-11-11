import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { BlogPost } from '../../core/import/blogImport.js';
import { ServerFileStore } from '../adapters/fileStore.js';
import { createImportRoutes } from './import.js';

function post(slug: string, overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    repoPath: `src/content/posts/${slug}.mdoc`,
    slug,
    title: `제목 ${slug}`,
    draft: false,
    updatedAt: '2026-08-01',
    source: `---\ntitle: 제목 ${slug}\nslug: ${slug}\ncategory: Programming\nupdatedAt: 2026-08-01\ndraft: false\n---\n\n본문\n`,
    ...overrides,
  };
}

/** 블로그를 실제로 clone 하지 않고 목록만 흉내 낸다. 여기서 볼 것은 라우트의 판단이다. */
function importer(posts: readonly BlogPost[], commit = 'abc123') {
  return { listImportablePosts: async () => ({ commit, posts }) };
}

async function workspace(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'workbench-import-'));
  await mkdir(path.join(root, 'drafts'), { recursive: true });
  return root;
}

describe('/api/import', () => {
  it('목록에 겹치는 slug 를 함께 알려 준다', async () => {
    const root = await workspace();
    await writeFile(
      path.join(root, 'drafts', 'alpha.md'),
      `---\ntitle: 기존 알파\nkind: public-draft\ncreatedAt: 2026-08-01\nupdatedAt: 2026-08-01\npublicEligible: true\nslug: alpha\n---\n\n기존\n`,
    );
    const routes = createImportRoutes(
      new ServerFileStore(root),
      importer([post('alpha'), post('beta')]),
    );

    const body = (await (await routes.request('/api/import/posts')).json()) as {
      commit: string;
      posts: { slug: string; conflictsWith: string | null }[];
    };

    expect(body.commit).toBe('abc123');
    expect(body.posts).toEqual([
      expect.objectContaining({ slug: 'alpha', conflictsWith: 'drafts/alpha.md' }),
      expect.objectContaining({ slug: 'beta', conflictsWith: null }),
    ]);
  });

  it('고른 글을 작업 공간에 놓는다', async () => {
    const root = await workspace();
    const routes = createImportRoutes(new ServerFileStore(root), importer([post('beta')]));

    const response = await routes.request('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selections: [{ repoPath: 'src/content/posts/beta.mdoc' }] }),
    });
    const body = (await response.json()) as { imported: string[] };

    expect(response.status).toBe(200);
    expect(body.imported).toEqual(['drafts/beta.md']);
    const written = await readFile(path.join(root, 'drafts', 'beta.md'), 'utf8');
    expect(written).toContain('kind: public-draft');
    // 출처를 남겨야 다시 발행할 때 그 사이 블로그가 앞서 나갔는지 알 수 있다.
    expect(written).toContain('commit: abc123');
  });

  it('결정 없이 겹치면 409 로 막고 아무것도 쓰지 않는다', async () => {
    const root = await workspace();
    await writeFile(
      path.join(root, 'drafts', 'alpha.md'),
      `---\ntitle: 기존 알파\nkind: public-draft\ncreatedAt: 2026-08-01\nupdatedAt: 2026-08-01\npublicEligible: true\nslug: alpha\n---\n\n기존\n`,
    );
    const routes = createImportRoutes(new ServerFileStore(root), importer([post('alpha')]));

    const response = await routes.request('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ selections: [{ repoPath: 'src/content/posts/alpha.mdoc' }] }),
    });

    expect(response.status).toBe(409);
    expect(await readFile(path.join(root, 'drafts', 'alpha.md'), 'utf8')).toContain('기존');
  });

  it('덮어쓰기를 고르면 그 자리를 바꾸고, 취소면 아무것도 하지 않는다', async () => {
    const root = await workspace();
    const existing = path.join(root, 'drafts', 'alpha.md');
    await writeFile(
      existing,
      `---\ntitle: 기존 알파\nkind: public-draft\ncreatedAt: 2026-08-01\nupdatedAt: 2026-08-01\npublicEligible: true\nslug: alpha\n---\n\n기존\n`,
    );
    const routes = createImportRoutes(new ServerFileStore(root), importer([post('alpha')]));

    const cancelled = await routes.request('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        selections: [{ repoPath: 'src/content/posts/alpha.mdoc', resolution: 'cancel' }],
      }),
    });
    expect((await cancelled.json()) as unknown).toMatchObject({ cancelled: true });
    expect(await readFile(existing, 'utf8')).toContain('기존');

    const overwritten = await routes.request('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        selections: [{ repoPath: 'src/content/posts/alpha.mdoc', resolution: 'overwrite' }],
      }),
    });
    expect(overwritten.status).toBe(200);
    expect(await readFile(existing, 'utf8')).toContain('제목 alpha');
  });

  it('대체 슬러그로 나란히 둘 수 있다', async () => {
    const root = await workspace();
    await writeFile(
      path.join(root, 'drafts', 'alpha.md'),
      `---\ntitle: 기존 알파\nkind: public-draft\ncreatedAt: 2026-08-01\nupdatedAt: 2026-08-01\npublicEligible: true\nslug: alpha\n---\n\n기존\n`,
    );
    const routes = createImportRoutes(new ServerFileStore(root), importer([post('alpha')]));

    const response = await routes.request('/api/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        selections: [
          { repoPath: 'src/content/posts/alpha.mdoc', resolution: 'rename', slug: 'alpha-2' },
        ],
      }),
    });

    expect(response.status).toBe(200);
    expect(await readFile(path.join(root, 'drafts', 'alpha-2.md'), 'utf8')).toContain(
      'slug: alpha-2',
    );
    expect(await readFile(path.join(root, 'drafts', 'alpha.md'), 'utf8')).toContain('기존');
  });
});
