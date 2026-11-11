import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import { bookSlug } from '../core/books/metadata.js';
import { calendarDateInTimeZone } from '../core/reviews/calendar.js';
import { BookAssetStore } from './adapters/bookAssets.js';
import { HttpBookMetadataProvider } from './adapters/bookMetadata.js';
import { ServerFileStore } from './adapters/fileStore.js';
import { ServerJournalStore } from './adapters/journalStore.js';
import { PublicBlogAdapter } from './adapters/publicBlog.js';
import { ProductionRemotePolicy } from './adapters/remotePolicy.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { seedWorkspaceTemplates } from './seedTemplates.js';

// 설정 검증은 전부 `loadConfig` 안에 있다(NOR-148). 여기서 env 를 다시 읽지 않는다 —
// 두 곳에서 읽으면 한쪽만 검증된 값이 흘러 들어간다.
const config = loadConfig();

// 새 작업 공간이면 만들 수 있는 것이 하나도 안 보인다. 부팅할 때 기본 템플릿만 깔아 준다(NOR-191).
const seeded = await seedWorkspaceTemplates({
  workspaceRoot: config.workspaceRoot,
  seedRoot: fileURLToPath(new URL('../../workspace-seed/templates', import.meta.url)),
});
if (seeded.length > 0) console.log(`기본 템플릿을 깔았습니다: ${seeded.join(', ')}`);

const app = createApp(
  new ServerFileStore(config.workspaceRoot),
  new ServerJournalStore(config.workspaceRoot),
  new PublicBlogAdapter({
    privateRoot: config.workspaceRoot,
    remote: config.publicBlogRemote,
    branch: config.publicBlogBranch,
    workBase: config.publishWorkBase,
    outboxRoot: config.publishOutboxRoot,
    author: {
      name: config.publishAuthorName,
      email: config.publishAuthorEmail,
    },
    remotePolicy: new ProductionRemotePolicy({
      allowedHost: new URL(config.publicBlogRemote).hostname,
      expectedPath: new URL(config.publicBlogRemote).pathname,
    }),
  }),
  {
    clock: () => new Date(),
    createId: () => crypto.randomUUID(),
    timeZone: config.appTimeZone,
  },
  {
    provider: new HttpBookMetadataProvider(),
    assets: new BookAssetStore({ workspaceRoot: config.workspaceRoot }),
    options: {
      today: () => calendarDateInTimeZone(new Date(), config.appTimeZone),
      slugify: bookSlug,
    },
  },
);

app.use('*', serveStatic({ root: './dist/web' }));
app.get('*', serveStatic({ path: './dist/web/index.html' }));

serve({
  fetch: app.fetch,
  hostname: '127.0.0.1',
  port: Number(process.env.PORT ?? '3000'),
});
