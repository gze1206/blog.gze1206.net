import { Hono } from 'hono';
import { z } from 'zod';

import { createBulletId } from '../core/bullets/syntax.js';
import { DocumentValidationError } from '../core/document/document.js';
import { PublicDraftValidationError } from '../core/publishing/validate.js';
import type { FileStore } from '../core/ports.js';
import type { JournalStore } from './adapters/journalStore.js';
import type { PublicBlogPublisher } from './adapters/publicBlog.js';
import { createBulletRoutes, type BulletRouteOptions } from './routes/bullets.js';
import { createDocumentRoutes } from './routes/documents.js';
import type { BookMetadataProvider } from '../core/books/metadata.js';
import type { BookAssetStore } from './adapters/bookAssets.js';
import { createHealthRoutes } from './routes/health.js';
import { createBookRoutes, type BookRouteOptions } from './routes/books.js';
import { createImportRoutes } from './routes/import.js';
import { createPublishRoutes } from './routes/publish.js';
import { createReviewRoutes, type ReviewRouteOptions } from './routes/reviews.js';

const defaultBulletOptions: BulletRouteOptions = {
  clock: () => new Date(),
  createId: createBulletId,
};

const defaultReviewOptions: ReviewRouteOptions = {
  clock: () => new Date(),
  createId: () => crypto.randomUUID(),
  timeZone: 'UTC',
};

export function createApp(
  store: FileStore,
  journalStoreOrPublisher?: JournalStore | PublicBlogPublisher,
  bulletOptionsOrPublisher: BulletRouteOptions | PublicBlogPublisher = defaultBulletOptions,
  reviewOptions: ReviewRouteOptions = defaultReviewOptions,
  /** 읽은 책 관리 (NOR-189). 제공처와 저장소가 있을 때만 그 경로가 열린다. */
  books?: {
    readonly provider: BookMetadataProvider;
    readonly assets: BookAssetStore;
    readonly options: BookRouteOptions;
  },
): Hono {
  const journalStore = isJournalStore(journalStoreOrPublisher)
    ? journalStoreOrPublisher
    : undefined;
  const publisher = isPublicBlogPublisher(journalStoreOrPublisher)
    ? journalStoreOrPublisher
    : isPublicBlogPublisher(bulletOptionsOrPublisher)
      ? bulletOptionsOrPublisher
      : undefined;
  const bulletOptions = isPublicBlogPublisher(bulletOptionsOrPublisher)
    ? defaultBulletOptions
    : bulletOptionsOrPublisher;
  const app = new Hono();
  app.route('/', createHealthRoutes());
  app.route('/', createDocumentRoutes(store));
  app.route('/', createReviewRoutes(store, journalStore, reviewOptions));
  if (journalStore) app.route('/', createBulletRoutes(journalStore, bulletOptions));
  if (books) app.route('/', createBookRoutes(store, books.provider, books.assets, books.options));
  if (publisher) app.route('/', createPublishRoutes(store, publisher));
  // 가져오기는 발행자와 같은 어댑터가 제공한다(같은 임시 clone 규율을 탄다).
  if (publisher && 'listImportablePosts' in publisher) {
    app.route('/', createImportRoutes(store, publisher as never));
  }
  app.notFound((context) =>
    context.json({ error: { code: 'not_found', message: 'Not found' } }, 404),
  );
  app.onError((error, context) => {
    const nodeCode =
      error instanceof Error && 'code' in error
        ? String((error as NodeJS.ErrnoException).code)
        : '';
    if (nodeCode === 'ENOENT') {
      return context.json({ error: { code: 'not_found', message: 'Document not found' } }, 404);
    }
    if (nodeCode === 'EEXIST') {
      return context.json({ error: { code: 'conflict', message: 'Document already exists' } }, 409);
    }
    if (
      error instanceof z.ZodError ||
      error instanceof DocumentValidationError ||
      error instanceof PublicDraftValidationError ||
      /workspace-relative|escapes workspace|unsupported|bullet|migration|confirmation|date|target|only publicEligible|invalid or unavailable public asset/u.test(
        error.message,
      )
    ) {
      return context.json({ error: { code: 'invalid_request', message: error.message } }, 400);
    }
    if (
      /clean public blog worktree|publish branch already exists|publish review is stale/u.test(
        error.message,
      )
    ) {
      return context.json({ error: { code: 'conflict', message: error.message } }, 409);
    }
    console.error(error);
    return context.json(
      { error: { code: 'internal_error', message: 'Internal server error' } },
      500,
    );
  });
  return app;
}

function isJournalStore(value: unknown): value is JournalStore {
  return (
    typeof value === 'object' && value !== null && 'runExclusive' in value && 'listBefore' in value
  );
}

function isPublicBlogPublisher(value: unknown): value is PublicBlogPublisher {
  return typeof value === 'object' && value !== null && 'listAssets' in value && 'publish' in value;
}
