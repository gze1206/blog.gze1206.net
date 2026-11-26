import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { BLOG_LAYOUT } from '@gze1206/content-contract';

import { BookAssetStore } from '../src/server/adapters/bookAssets.js';
import { bookSlug } from '../src/core/books/metadata.js';
import { ServerFileStore } from '../src/server/adapters/fileStore.js';
import { ServerScheduleStore } from '../src/server/adapters/scheduleStore.js';
import { ServerJournalStore } from '../src/server/adapters/journalStore.js';
import { PublicBlogAdapter } from '../src/server/adapters/publicBlog.js';
import { createApp } from '../src/server/app.js';
import { startHttpsGitServer } from '../test/fixtures/httpsGitServer.js';
import { LoopbackTestRemotePolicy } from '../test/fixtures/loopbackRemotePolicy.js';

const run = promisify(execFile);

const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'workbench-e2e-workspace-'));
const publicBlogRoot = await mkdtemp(path.join(tmpdir(), 'workbench-e2e-public-'));
const publishWorkBase = await mkdtemp(path.join(tmpdir(), 'workbench-e2e-publish-work-'));
const publishOutboxRoot = await mkdtemp(path.join(tmpdir(), 'workbench-e2e-publish-outbox-'));
await mkdir(path.join(workspaceRoot, 'templates'));
await mkdir(path.join(workspaceRoot, 'drafts'));
await cp(path.resolve('workspace-seed/templates'), path.join(workspaceRoot, 'templates'), {
  recursive: true,
});
await mkdir(path.join(workspaceRoot, 'journal', '2026', '08'), { recursive: true });
await writeFile(
  path.join(workspaceRoot, 'journal', '2026', '08', '2026-08-11.md'),
  `---
title: 2026-08-11
kind: journal
createdAt: 2026-08-11
updatedAt: 2026-08-11
date: 2026-08-11
---
# 2026-08-11

- □ 첫 번째 남은 일 <!-- wb:id=01J5AR7W6M3Q9N8K2T4V1X0ZBC -->
- □ 두 번째 남은 일 <!-- wb:id=01J5AR7W6M3Q9N8K2T4V1X0ZBD -->
`,
);
// ○ 불렛을 일정으로 옮기는 시험용(NOR-248).
await writeFile(
  path.join(workspaceRoot, 'journal', '2026', '08', '2026-08-09.md'),
  `---
title: 2026-08-09
kind: journal
createdAt: 2026-08-09
updatedAt: 2026-08-09
date: 2026-08-09
---
# 2026-08-09

- ○ 옮길 컨퍼런스 <!-- wb:id=01J5AR7W6M3Q9N8K2T4V1X0ZBG -->
`,
);
// 손가락으로 지난 할 일을 닫는 시험용(NOR-238). 다른 시험이 쓰는 2026-08-11 과 겹치지 않게 따로 둔다.
await writeFile(
  path.join(workspaceRoot, 'journal', '2026', '08', '2026-08-10.md'),
  `---
title: 2026-08-10
kind: journal
createdAt: 2026-08-10
updatedAt: 2026-08-10
date: 2026-08-10
---
# 2026-08-10

- □ 손으로 끝낼 일 <!-- wb:id=01J5AR7W6M3Q9N8K2T4V1X0ZBE -->
- □ 손으로 그만둘 일 <!-- wb:id=01J5AR7W6M3Q9N8K2T4V1X0ZBF -->
`,
);
await mkdir(path.join(workspaceRoot, 'books'));
await writeFile(
  path.join(workspaceRoot, 'books/9788934972464.md'),
  `---
title: 인용 테스트
kind: book
createdAt: 2026-08-12
updatedAt: 2026-08-12
authors: [저자]
isbn13: '9788934972464'
status: reading
format: paper
source: purchase
visible: true
excerpts:
  - id: 01J5AR7W6M3Q9N8K2T4V1X0ZBC
    text: 공개할 문장
---
`,
);
await writeFile(
  path.join(workspaceRoot, 'drafts/quote-test.md'),
  `---
title: Quote test
kind: public-draft
createdAt: 2026-08-12
updatedAt: 2026-08-12
publicEligible: true
description: quote test
slug: quote-test
category: engineering
tags: [git]
publishedAt: 2026-08-12
---
{% bookquote book="9788934972464" excerpt="01J5AR7W6M3Q9N8K2T4V1X0ZBC" /%}
`,
);
const seededDraftPath = 'drafts/asset-publish.md';
const seededDraftId = createHash('sha256').update(seededDraftPath, 'utf8').digest('base64url');
await writeFile(
  path.join(workspaceRoot, seededDraftPath),
  `---
title: Asset publish
kind: public-draft
createdAt: 2026-08-12
updatedAt: 2026-08-12T09:00:00.000Z
publicEligible: true
description: Review a selected asset
slug: asset-publish
category: engineering
tags: ['git']
publishedAt: 2026-08-12T09:00:00.000Z
---
# Asset publish

![diagram](images/flow.png)
`,
);
const seededAsset = path.join(workspaceRoot, 'assets/public', seededDraftId, 'images/flow.png');
await mkdir(path.dirname(seededAsset), { recursive: true });
await writeFile(seededAsset, 'approved-image');
await writeFile(path.join(publicBlogRoot, 'README.md'), 'public blog fixture\n');
// 사이트 콘텐츠(NOR-208). 워크벤치는 이 main 을 읽고 고친다.
const siteContent = path.join(publicBlogRoot, 'apps/blog/src/content');
await mkdir(path.join(siteContent, 'series'), { recursive: true });
await writeFile(
  path.join(siteContent, 'profile.json'),
  '{\n  "name": "E2E",\n  "headline": "직함",\n  "introduction": "소개",\n  "skills": ["C#"]\n}\n',
);
await writeFile(
  path.join(siteContent, 'series/e2e-series.json'),
  '{\n  "name": "E2E 시리즈",\n  "slug": "e2e-series",\n  "description": "설명"\n}\n',
);
for (const args of [
  ['init', '-b', BLOG_LAYOUT.publishBranch],
  ['config', 'user.name', 'E2E Publisher'],
  ['config', 'user.email', 'publisher@example.test'],
  ['add', '.'],
  ['commit', '-m', 'initial'],
]) {
  await run('git', ['-C', publicBlogRoot, ...args]);
}
const publicBlogServer = await startHttpsGitServer(publicBlogRoot);

const app = createApp(
  new ServerFileStore(workspaceRoot),
  new ServerJournalStore(workspaceRoot),
  new PublicBlogAdapter({
    privateRoot: workspaceRoot,
    remote: publicBlogServer.remote,
    branch: BLOG_LAYOUT.publishBranch,
    workBase: publishWorkBase,
    outboxRoot: publishOutboxRoot,
    author: { name: 'E2E Publisher', email: 'publisher@example.test' },
    remotePolicy: new LoopbackTestRemotePolicy(publicBlogServer.certificateAuthority),
  }),
  {
    clock: () => new Date('2026-08-12T12:00:00.000Z'),
    createId: () => 'e2e-review-id',
    timeZone: 'Asia/Seoul',
  },
  {
    provider: { lookup: async () => null },
    assets: new BookAssetStore({ workspaceRoot }),
    options: { today: () => '2026-08-12', slugify: bookSlug },
  },
  // 발행 진행 토스트(NOR-228). 릴레이·GitHub 대신 고정된 답을 준다.
  {
    readLedger: async () => 'e2e-demo.json ok content/e2e-demo\n',
    lookupPull: async () => ({
      number: 1,
      url: 'https://github.com/example/blog/pull/1',
      state: 'open',
      merged: false,
      checks: 'pending',
    }),
  },
  new ServerScheduleStore(workspaceRoot),
);
app.use('*', serveStatic({ root: './dist/web' }));
app.get('*', serveStatic({ path: './dist/web/index.html' }));
serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 4174 });
