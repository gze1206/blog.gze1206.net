# 책 공개와 구절 인용 (1b) Implementation Plan

> **For agentic workers:** Task 단위로 진행한다. 각 Task 는 명세 AC 에 연결된 red 커밋 → green 커밋(→ 필요하면 refactor 커밋)으로 끝난다.

**Goal:** 워크벤치 책 기록을 허용 목록 필드만 블로그 책장으로 내보내고, 사람이 `public: true` 로 연 구절만 글 본문의 `{% bookquote %}` 로 인용되게 한다.

**Architecture:** 계약(`@gze1206/content-contract`)이 책 항목 스키마·공개 필드·`bookquote` 태그 속성과 직렬화를 소유한다. 워크벤치 core 가 순수 변환(`toPublicBook`, `expandBookquotes`)을, 서버 어댑터가 파일 입출력과 Git 게이트를 맡는다. 블로그는 계약의 스키마로 책을 읽고 태그를 렌더링한다.

**Tech Stack:** zod 4, Markdoc(`@markdoc/markdoc`), Astro 7, Vitest 4, Playwright, Hono(워크벤치 서버), React(워크벤치 웹).

**명세:** [`docs/spec/contract/NOR-196-books-and-bookquote.md`](../../spec/contract/NOR-196-books-and-bookquote.md) (AC-1 ~ AC-17)

## Global Constraints

- 브랜치 `feat/nor-196-books-bookquote` (base `v4`). 커밋은 `<gitmoji> type(scope): 요약 (NOR-196)`.
- trailer 는 **마지막 한 단락**에 쓴다: `-m $'TDD: red\nSpec: NOR-196 AC-n\nCo-Authored-By: …'`. red 커밋은 테스트를 실제로 돌려 **단언 실패나 모듈 없음**을 확인한 뒤 만든다. red 에는 테스트 파일(과 필요하면 의존성·lockfile)만 넣는다. 처음부터 통과하는 보호 테스트는 `TDD: regression`.
- 테스트 이름은 `NOR-196 AC-n: …` 으로 시작한다. 한 테스트가 두 AC 를 덮으면 이름에 둘 다 적는다.
- 각 green 커밋 뒤 `pnpm tdd:evidence --base v4` 로 방금 red 가 `✓` 인지 확인한다. Task 를 마칠 때 `pnpm verify` 가 통과해야 한다.
- 공개 저장소다. 개인 정보(Tailnet 도메인, IP, 호스트명, 이메일, 로컬 절대 경로)를 코드·문서·커밋에 쓰지 않는다. 테스트 이메일은 `@example.test`.
- 패키지 경계: `apps/*` 끼리 import 하지 않는다. 공유가 필요하면 계약으로 옮긴다(`pnpm boundaries`).
- 새 의존성은 pnpm catalog 를 쓴다. `minimum-release-age=1440` 이므로 하루 안에 나온 버전은 받지 않는다.

## 파일 구조 (완료 시점)

```text
packages/content-contract/src/
  book.ts            bookObject, bookSchema, strictBookSchema, PUBLIC_BOOK_FIELDS, BOOK_ID_PATTERN, isBookId, type PublicBook
  bookquote.ts       bookquoteTag, renderBookquote, type BookquoteSource
  layout.ts          + booksDir, bookCoversDir, bookCoverUrlPrefix
  book.test.ts, bookquote.test.ts, books-corpus.test.ts
apps/blog/
  src/content/schemas.ts           bookSchema 를 계약에서 다시 내보낸다
  src/content/books/니체의-초월자.json   (nietzsche-ubermensch.json 이름 변경)
  markdoc.config.mjs               bookquote 태그 등록
  src/components/markdoc/BookQuote.astro
  src/lib/bookquote.ts (+ .test.ts)  formatBookquoteCaption
  src/pages/books.astro            항목에 id 앵커
  e2e/books.spec.ts
apps/workbench/src/
  core/books/excerpts.ts (+ .test.ts)     ensureExcerptIds, updateExcerpt
  core/books/publicBook.ts (+ .test.ts)   bookIdOf, toPublicBook, serializePublicBook, planBookExport
  core/books/imageSize.ts (+ .test.ts)    readImageSize
  core/books/bookImport.ts (+ .test.ts)   planBookImport
  core/publishing/bookquote.ts (+ .test.ts) expandBookquotes, quoteWarnings
  server/adapters/publicBlog.ts           reviewBook, publishBook, 글 review 에 인용 정보
  server/adapters/publishOutbox.ts        targetKeyFromPath
  server/routes/books.ts, publish.ts
  web/…                                   구절 공개 토글, 책 내보내기 검토·확정, 인용 경고
```

---

### Task 0: 준비

- [ ] `git checkout -b feat/nor-196-books-bookquote v4`
- [ ] 명세와 이 계획을 커밋한다: `📝 docs(contract): 책 공개와 구절 인용 명세·계획을 쓴다 (NOR-196)`
- [ ] `pnpm spec:check` 가 NOR-196 AC-1~15 를 unlinked 로 보고하는지 확인한다(exit 1 이 정상).

### Task 1: 책 항목 계약 (AC-1, AC-2, AC-3, AC-4)

**Files:** Create `packages/content-contract/src/book.ts`, `book.test.ts`, `books-corpus.test.ts`. Modify `layout.ts`, `layout.test.ts`, `index.ts`, `apps/blog/src/content/schemas.ts`, `apps/blog/src/content/contract-wiring.test.ts`, `apps/blog/src/content/schemas.test.ts`(bookSchema 테스트는 계약으로 옮긴다). Rename `apps/blog/src/content/books/nietzsche-ubermensch.json` → `니체의-초월자.json`.

**Produces:**

```ts
// book.ts
export const BOOK_STATUSES = ['reading', 'finished', 'abandoned', 'want'] as const;
export const BOOK_FORMATS = ['ebook', 'paper', 'audio'] as const;
export const BOOK_SOURCES = ['library', 'purchase', 'subscription', 'borrowed'] as const;
export const bookCoverSchema; // { src: string(min 1), width: int>0, height: int>0, source?: string }
export const bookObject;      // z.object — 블로그 schemas.ts:101-134 의 필드·기본값을 그대로 옮긴다 (visible 제외)
export const bookSchema = bookObject;            // 블로그가 쓴다(모르는 키 허용)
export const strictBookSchema = bookObject.strict(); // 내보내기와 전수 검사가 쓴다
export const PUBLIC_BOOK_FIELDS: readonly (keyof typeof bookObject.shape)[]; // 직렬화 순서
export const BOOK_ID_PATTERN: RegExp; // /^\d{13}$/ 또는 bookSlug 결과(공백·/\?%*:|"<>. 없음, 1~60자)
export function isBookId(id: string): boolean;
export type PublicBook = z.infer<typeof bookSchema>;
// layout.ts 에 추가
booksDir: 'apps/blog/src/content/books', bookCoversDir: 'apps/blog/public/assets/books', bookCoverUrlPrefix: '/assets/books'
```

- `visible` 은 계약에서 뺀다. 내보내지 않는 책은 파일이 없으므로 블로그가 거를 필요가 없다. 블로그 `selectVisibleBooks` 의 `visible` 분기는 Task 1 에서 지우고, 기존 `visible: false` 파일이 없음을 전수 검사로 지킨다.
- 블로그 `schemas.ts` 는 `export { bookSchema } from '@gze1206/content-contract'`. 블로그 `content.config.ts` 는 이 스키마를 그대로 쓴다.
- `PUBLIC_BOOK_FIELDS` 는 `Object.keys(bookObject.shape)` 와 같은 집합이어야 한다(AC-2 테스트가 둘을 비교한다).

**Tests (red 에 먼저):**

- `book.test.ts`: `NOR-196 AC-2: PUBLIC_BOOK_FIELDS 는 bookSchema 키와 같고 비공개 키를 담지 않는다`; `NOR-196 AC-4: isBookId 는 13자리 ISBN 과 bookSlug 를 받고 공백·경로 문자를 거부한다`; 옮겨 온 bookSchema 필드 검증 테스트.
- `layout.test.ts`: `NOR-196 AC-3: booksDir·bookCoversDir 가 실제 디렉터리를 가리킨다`(bookCoversDir 은 `.gitkeep` 으로 만든다).
- `books-corpus.test.ts`: `NOR-196 AC-4: 블로그의 모든 책이 strictBookSchema 를 통과하고 파일명이 책 id 다`.
- `contract-wiring.test.ts`: `NOR-196 AC-1: 블로그 bookSchema 는 계약의 것과 같은 객체다`.

**Verify:** 블로그 build 가 통과하고, 책장 페이지가 이름이 바뀐 파일로 똑같이 그려진다(`dist/books/index.html` 의 책 카드 수가 같다).

### Task 2: `bookquote` 태그 계약 (AC-5)

**Files:** Create `packages/content-contract/src/bookquote.ts`, `bookquote.test.ts`. Modify `index.ts`, `packages/content-contract/package.json`(devDependency `@markdoc/markdoc`: 블로그와 같은 catalog 버전).

**Produces:**

```ts
export interface BookquoteSource {
  book: string; // 책 id
  title: string;
  authors: string[]; // 1개 이상
  translators: string[];
  publisher?: string;
  year?: number;
  page?: number;
}
/** 펼친 태그의 속성 스키마. 블로그는 여기에 render 만 더해 등록한다. */
export const bookquoteTag: {
  attributes: Record<
    keyof BookquoteSource,
    { type: StringConstructor | NumberConstructor | ArrayConstructor; required?: boolean }
  >;
};
/** 펼친 태그 문자열. 끝에 줄바꿈 하나. */
export function renderBookquote(source: BookquoteSource, text: string): string;
```

- 출력 형식: `{% bookquote book="…" title="…" authors=["…"] translators=[…] publisher="…" year=2020 page=42 %}\n<본문>\n{% /bookquote %}\n`. 없는 선택 속성은 쓰지 않는다. 문자열 속성은 Markdoc 문자열 규칙대로 `"`·`\` 를 이스케이프한다.
- 본문은 구절 원문을 문단 단위로 옮긴다. Markdoc 태그 구문(`{%`)과 Markdown 서식 문자(`*`, `_`, `` ` ``, `[`, `<`, 줄 앞 `#`·`>`·`-`·숫자+`.`)가 해석되지 않게 이스케이프한다.

**Tests:**

- `NOR-196 AC-5: renderBookquote 결과는 bookquoteTag 로 Markdoc.validate 오류가 없다`
- `NOR-196 AC-5: 구절의 {% %} 와 Markdown 서식 문자가 그대로 글자로 남는다` (parse → 태그 자식의 텍스트를 이어 붙이면 원문과 같다. 문단 경계는 줄바꿈 두 개)
- `NOR-196 AC-5: 선택 속성이 없으면 쓰지 않고, 속성 값의 따옴표를 이스케이프한다`

### Task 3: 블로그 렌더링 (AC-6, AC-7, AC-8, AC-17)

**Files:** Create `apps/blog/src/components/markdoc/BookQuote.astro`, `apps/blog/src/lib/bookquote.ts`, `bookquote.test.ts`, `apps/blog/e2e/books.spec.ts`. Modify `apps/blog/markdoc.config.mjs`, `apps/blog/src/pages/books.astro`, `apps/blog/src/lib/routes.ts`(`booksPath(id?)` → `/books` 또는 `/books#<encodeURIComponent(id)>`), 스모크 글 `src/content/posts/custom-blocks-smoke-test.mdoc`(draft) 에 bookquote 예시 두 개(책장에 있는 책 / 없는 책).

**Produces:**

```ts
// lib/bookquote.ts
export interface BookquoteCaption {
  authors: string;
  title: string;
  translators?: string;
  publisher?: string;
  year?: string;
  page?: string;
  href?: string;
}
export function formatBookquoteCaption(
  source: BookquoteSource,
  shelfIds: ReadonlySet<string>,
): BookquoteCaption;
```

- `markdoc.config.mjs`: `bookquote: { ...bookquoteTag, render: component('./src/components/markdoc/BookQuote.astro') }`. 자식(구절)을 감싸는 태그다(`figure` 태그와 같은 방식).
- `BookQuote.astro`: `getCollection('books')` 로 책장 id 를 모아 `formatBookquoteCaption` 을 부르고 `<figure class="bookquote"><blockquote cite={href}><slot /></blockquote><figcaption>…</figcaption></figure>` 를 그린다. 저자 여럿은 `, `, 역자는 `… 옮김`, 제목은 `『…』`, 쪽수는 `p. 42`. 스타일은 기존 `media-figure`·인용 스타일 토큰을 쓴다.
- `books.astro`: `<li class="book-card" id={book.id}>`.

**Tests:**

- `NOR-196 AC-6: 블로그 bookquote 태그 속성은 계약의 bookquoteTag 와 같다` (`markdoc.config.mjs` 를 import 해 `tags.bookquote.attributes` 를 `toBe` 로 비교)
- `NOR-196 AC-7: …` `formatBookquoteCaption` 단위 테스트(저자 여럿, 역자 유무, 쪽수 유무, 책장에 있을 때만 href)
- `e2e/books.spec.ts`: `NOR-196 AC-8: 책장 항목은 책 id 앵커를 가진다`

**Verify (AC-17, manual):** `pnpm --filter @gze1206/blog build` 후 `dist/smoke/markdoc/index.html`(또는 스모크 글이 렌더링되는 페이지)에 `class="bookquote"`, `<figcaption>`, `/books#` 링크가 있는지 grep 한다. 공개 글(draft 아님) 산출물은 바뀌지 않아야 한다.

### Task 4: 구절 id 와 공개 표시 (AC-9)

**Files:** Create `apps/workbench/src/core/books/excerpts.ts`, `excerpts.test.ts`. Modify `apps/workbench/src/core/document/document.ts`(`excerptSchema` 에 `id`·`public`), `apps/workbench/src/server/routes/books.ts`(저장 경로마다 `ensureExcerptIds`, 수정은 `updateExcerpt`), `apps/workbench/src/web/api.ts`(타입), 관련 서버 테스트.

**Produces:**

```ts
export interface Excerpt {
  id?: string;
  page?: number;
  text: string;
  memo?: string;
  addedAt?: string;
  public?: boolean;
}
/** id 없는 구절에 createId() 를 채운다. 있는 id 는 건드리지 않는다. 입력을 바꾸지 않고 새 배열을 돌려준다. */
export function ensureExcerptIds(excerpts: readonly Excerpt[], createId: () => string): Excerpt[];
/** index 의 구절을 patch 로 고친다. id·addedAt 은 유지하고, patch 에 public 이 없으면 기존 값을 유지한다. */
export function updateExcerpt(
  excerpts: readonly Excerpt[],
  index: number,
  patch: { page?: number; text: string; memo?: string; public?: boolean },
): Excerpt[];
```

- id 형식은 불렛과 같은 ULID(`core/bullets/syntax.ts` 의 `createBulletId`·정규식). 서버는 이미 있는 `options.createId` 를 쓴다.
- 책 문서를 쓰는 모든 경로(책 전체 PUT, 구절 POST/PUT/DELETE, 메모 경로)에서 쓰기 직전에 `ensureExcerptIds` 를 부른다.
- 라우트의 구절 입력 스키마에 `public: z.boolean().optional()` 을 더한다.

**Tests:** `NOR-196 AC-9: id 없는 구절에만 id 를 채운다`, `NOR-196 AC-9: 다른 구절을 지우거나 순서를 바꿔도 id 가 유지된다`, `NOR-196 AC-9: 구절을 고쳐도 id 와 public 이 남는다`(core), 그리고 서버 라우트 테스트 하나(`PUT /api/books/:id/excerpts/:index` 후 문서의 id·public 유지).

### Task 5: 책 내보내기의 순수 변환 (AC-10, AC-15, AC-13 일부)

**Files:** Create `apps/workbench/src/core/books/publicBook.ts`, `imageSize.ts`, `bookImport.ts` 와 각 테스트. 바이너리 fixture 는 테스트 안에서 바이트 배열로 만든다(최소 PNG·JPEG(SOF0)·WebP(VP8/VP8L/VP8X) 헤더).

**Produces:**

```ts
// publicBook.ts
export function bookIdOf(record: { title: string; isbn13?: string }): string; // isbn13 ?? bookSlug(title), isBookId 통과
export interface PublicCover {
  src: string;
  width: number;
  height: number;
  source?: string;
}
export function toPublicBook(record: BookDocument, cover?: PublicCover): PublicBook; // strictBookSchema.parse 결과
export function serializePublicBook(book: PublicBook): string; // PUBLIC_BOOK_FIELDS 순서, 2칸 들여쓰기, 끝 줄바꿈
export type BookExportPlan =
  | { kind: 'write'; path: string; content: string; cover?: { from: string; to: string } }
  | { kind: 'delete'; path: string }
  | { kind: 'noop'; path: string };
export function planBookExport(input: {
  record: BookDocument;
  current: string | null;
  cover?: { workspacePath: string; info: PublicCover };
}): BookExportPlan;
// imageSize.ts
export function readImageSize(
  bytes: Uint8Array,
): { width: number; height: number; type: 'jpeg' | 'png' | 'webp' } | null;
// bookImport.ts
export function planBookImport(id: string, json: unknown): { path: string; document: BookDocument };
```

- `BookDocument` 는 `core/document/document.ts` 가 이미 내보내는 책 문서 타입을 쓴다(없으면 그 파일에서 타입을 export 한다).
- `toPublicBook` 은 허용 목록에서 출발해 값을 **골라 담는다**(스프레드 금지). `cover` 는 인자로만 받는다. 날짜는 `YYYY-MM-DD` 문자열 그대로.
- `planBookExport`: `visible === false` 면 `current` 가 있으면 `delete`, 없으면 `noop`. 아니면 직렬화 결과가 `current` 와 같으면 `noop`, 다르면 `write`. 경로는 `BLOG_LAYOUT.booksDir/<bookIdOf>.json`, 표지 대상은 `bookCoversDir/<bookIdOf>.<ext>` 이고 `src` 는 `bookCoverUrlPrefix/<encodeURIComponent(id)>.<ext>`.
- `planBookImport`: 블로그 책 JSON(`bookSchema`)을 책 문서로 바꾼다. 경로는 `books/<id>.md`, `kind: book`, `visible` 은 쓰지 않는다(기본 공개).

**Tests:** `NOR-196 AC-10: excerpts·memos·본문을 채워도 toPublicBook 출력에는 허용 목록 키만 있다`, `NOR-196 AC-10: 출력은 strictBookSchema 를 통과한다`, `NOR-196 AC-10: visible false 면 파일이 있으면 지우고 없으면 아무것도 하지 않는다`, `NOR-196 AC-13: readImageSize 는 PNG·JPEG·WebP 헤더에서 크기를 읽고 모르는 형식은 null`, `NOR-196 AC-15: 블로그 책을 가져와 다시 내보내면 표지를 빼고 같은 값이다`.

### Task 6: 글 발행의 구절 인용 (AC-11, AC-12)

**Files:** Create `apps/workbench/src/core/publishing/bookquote.ts`, `bookquote.test.ts`. Modify `core/publishing/transform.ts`·`validate.ts`(변환에 책 조회를 받는다), `server/adapters/publicBlog.ts`(작업 공간 책 문서를 읽는 조회 함수를 만들어 넘기고, review 응답에 `quotes`·`warnings` 를 더한다), `server/routes/publish.ts`, `web/` 의 발행 검토 화면(경고 표시).

**Produces:**

```ts
export type BookLookup = (bookId: string) => BookDocument | undefined;
export interface ExpandedQuote {
  book: string;
  excerpt: string;
  length: number;
  bookPublicTotal: number;
}
export function expandBookquotes(
  body: string,
  lookup: BookLookup,
): { body: string; quotes: ExpandedQuote[] };
export const QUOTE_LIMITS = { single: 500, bookTotal: 2000 } as const;
export function quoteWarnings(quotes: readonly ExpandedQuote[]): string[];
```

- 원본 태그 형식은 `{% bookquote book="<책 id>" excerpt="<구절 id>" /%}` 하나다. 다른 속성이 있거나 닫는 형식이 다르면 거부한다(`PublicDraftValidationError`). 펼친 문자열은 계약의 `renderBookquote` 로 만든다. 출처는 책 문서의 `title`·`authors`·`translators`·`publisher`·`publishedYear`, 구절의 `page`.
- 길이는 공백을 포함한 문자 수(`[...text].length`). `bookPublicTotal` 은 그 책에서 `public: true` 인 구절 전체 길이의 합.
- 순서: 펼치기 → 기존 누출 검사(`assertNoLeaks`)는 **펼친 결과**에 돈다 → 자산 → 직렬화. 펼친 본문이 diff 와 커밋 대상이다.
- 인용이 없는 글은 지금과 바이트 단위로 같은 결과를 낸다(기존 발행 테스트가 그대로 통과).

**Tests:** `NOR-196 AC-11: 공개 구절을 원문과 출처로 펼친다`, `NOR-196 AC-11: 없는 책·없는 구절·비공개 구절 인용을 거부한다`(세 경우), `NOR-196 AC-11: 저자가 없는 책의 인용을 거부한다`, `NOR-196 AC-12: 500자 초과 인용과 책 누적 2000자 초과에 경고를 낸다`, 서버 테스트 `NOR-196 AC-12: 발행 검토 응답에 인용 길이와 경고가 있다`.

### Task 7: 책 내보내기 게이트와 outbox (AC-13, AC-14)

**Files:** Modify `server/adapters/publicBlog.ts`(`reviewBook(bookId)`, `publishBook(bookId, confirm)`), `server/adapters/publishOutbox.ts`(`slugFromTargetPath` → `targetKeyFromPath`), `server/routes/publish.ts`(`POST /api/publish/books/:id/review`, `POST /api/publish/books/:id/confirm`), 서버 테스트.

- 글 발행과 같은 세션·fingerprint·확정 흐름을 쓴다. 공통 부분은 함수로 뽑되 글 발행의 동작은 바꾸지 않는다.
- 검토는 임시 clone 의 현재 책 파일을 읽어 `planBookExport` 로 계획을 세우고 unified diff 를 돌려준다(표지는 "추가/교체" 한 줄로 요약). `noop` 이면 확정을 거부한다.
- 확정은 `content/book-<safeKey(id)>` 브랜치에 커밋한다. 메시지 `📚 docs(content): 책 <id> 를 내보낸다`(삭제면 `… 를 책장에서 뺀다`). 파일은 0644, symlink 조상 검사는 글과 같은 함수.
- 표지는 작업 공간 `cover` 경로의 파일을 읽어 `readImageSize` 로 크기를 얻는다. 형식을 모르면 거부한다.
- `targetKeyFromPath`: `postsDir/<slug>.mdoc` → `post:<slug>`, `booksDir/<id>.json` → `book:<id>`(isBookId 통과). 그 밖은 `invalid publish target path`.

**Tests:** `NOR-196 AC-13: 책 내보내기 검토는 diff 를 돌려주고 확정하면 책 JSON 과 표지를 커밋한다`(기존 `httpsGitServer` fixture 사용), `NOR-196 AC-13: 바뀐 것이 없으면 확정을 거부한다`, `NOR-196 AC-14: outbox 는 글·책 경로만 받는다`.

### Task 8: 워크벤치 화면 (AC-16)

**Files:** `apps/workbench/src/web/**` 의 책 상세 화면, `e2e/workbench.spec.ts`.

- 구절 목록에 "공개" 토글(`public`)을 둔다. 끄면 키를 지운다(`public: false` 를 쓰지 않는다).
- 책 상세에 "책장으로 내보내기" 버튼: 검토(diff, 표지 요약) → 확정. `visible: false` 면 버튼 문구가 "책장에서 빼기" 다.
- 글 발행 검토 화면에 인용 목록(책, 구절 앞부분, 길이, 누적)과 경고를 보여 준다.
- e2e 에 시나리오 하나: 구절을 공개로 바꾸고, 그 구절을 인용한 초안의 발행 검토에서 펼친 diff 가 보인다.

### Task 9: 마무리

- [ ] `docs/spec/workbench/NOR-189-book-management.md` 에 "구절 공개와 책장 내보내기는 NOR-196" 한 줄, `docs/spec/README.md` 에 contract 절과 NOR-196, ADR 0018 의 D5(계약) 서술에 책 계약을 더한다.
- [ ] `pnpm verify && pnpm e2e && pnpm tdd:evidence --base v4`
- [ ] Claude·Codex 병렬 보안 검수(읽기 전용). 중점: 비공개 필드·구절 누출 경로, 경로 탈출(책 id·표지 확장자), 이미지 파서의 경계 검사, Markdoc 이스케이프.
- [ ] push, PR(base `v4`), CI 통과 후 병합, Linear NOR-196 Done.
