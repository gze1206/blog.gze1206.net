import { Hono } from 'hono';
import { z } from 'zod';

import { planImport, type BlogPost, type ImportSelection } from '../../core/import/blogImport.js';
import type { FileStore } from '../../core/ports.js';

/**
 * 공개 블로그의 글을 작업 공간으로 가져오는 경로 (NOR-187).
 *
 * 목록과 적용을 나눈다. 사람이 목록을 보고 무엇을 가져올지, 겹치면 어떻게 할지 정한 뒤에야
 * 파일이 만들어진다 — 가져오기도 발행처럼 명시적 동작이다.
 */
export interface BlogImporter {
  listImportablePosts(): Promise<{ readonly commit: string; readonly posts: readonly BlogPost[] }>;
}

const selectionSchema = z
  .object({
    repoPath: z.string().min(1),
    resolution: z.enum(['rename', 'overwrite', 'skip', 'cancel']).optional(),
    slug: z.string().min(1).optional(),
  })
  .strict();

const applySchema = z
  .object({
    selections: z.array(selectionSchema).min(1).max(200),
  })
  .strict();

export function createImportRoutes(store: FileStore, importer: BlogImporter): Hono {
  const routes = new Hono();

  routes.get('/api/import/posts', async (context) => {
    const { commit, posts } = await importer.listImportablePosts();
    const existing = await existingSlugs(store);
    return context.json({
      commit,
      posts: posts.map((post) => ({
        repoPath: post.repoPath,
        slug: post.slug,
        title: post.title,
        draft: post.draft,
        updatedAt: post.updatedAt,
        // 겹치는 것을 화면에서 바로 알 수 있어야 결정을 한 번에 할 수 있다.
        conflictsWith: existing[post.slug] ?? null,
      })),
    });
  });

  routes.post('/api/import', async (context) => {
    const input = applySchema.safeParse(await context.req.json().catch(() => null));
    if (!input.success) {
      return context.json(
        { error: { code: 'invalid_request', message: '가져올 항목이 올바르지 않습니다.' } },
        400,
      );
    }

    // 목록을 다시 읽는다. 화면이 보던 것과 지금이 다를 수 있고, 가져오는 것은 지금 것이어야 한다.
    const { commit, posts } = await importer.listImportablePosts();
    const existing = await existingSlugs(store);

    let plan;
    try {
      plan = planImport({
        posts,
        selections: input.data.selections as readonly ImportSelection[],
        existing,
        commit,
      });
    } catch (error) {
      return context.json(
        {
          error: {
            code: 'conflict',
            message: error instanceof Error ? error.message : 'invalid plan',
          },
        },
        409,
      );
    }

    if (plan.cancelled) return context.json({ cancelled: true, imported: [], skipped: [] });

    const imported: string[] = [];
    for (const action of plan.actions) {
      await store.importDocument({
        relativePath: action.relativePath,
        source: action.source,
        overwrite: action.overwrite,
      });
      imported.push(action.relativePath);
    }

    return context.json({ cancelled: false, imported, skipped: plan.skipped, commit });
  });

  return routes;
}

/** 작업 공간이 이미 쓰고 있는 slug → 그 문서의 경로. */
async function existingSlugs(store: FileStore): Promise<Record<string, string>> {
  const { documents } = await store.listDocuments();
  const entries = await Promise.all(
    documents.map(async ({ relativePath }) => {
      const entry = await store.readDocument(relativePath).catch(() => null);
      const slug = entry?.document.slug;
      return slug === undefined ? null : ([slug, relativePath] as const);
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}
