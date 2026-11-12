# NOR-196 — 책 공개와 구절 인용 (하위 프로젝트 1b)

- 설계: [../../superpowers/specs/2026-11-12-monorepo-foundation-design.md](../../superpowers/specs/2026-11-12-monorepo-foundation-design.md) §2 "책 공개", "글 안의 구절 인용"
- 계획: [../../superpowers/plans/2026-11-12-books-and-bookquote-1b.md](../../superpowers/plans/2026-11-12-books-and-bookquote-1b.md)

## 설계에서 바뀐 점

| 설계                                          | 1b                                                                                                    | 이유                                                                                                                                            |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookCoversDir: 'apps/blog/src/assets/books'` | `bookCoversDir: 'apps/blog/public/assets/books'`, 표지 URL 은 `/assets/books/<파일명>`                | 블로그는 표지를 `<img src>` 문자열로 그린다(`books.astro`). `src/assets` 는 URL 로 서빙되지 않는다. 글 자산과 같은 `public/assets/` 아래에 둔다 |
| 펼친 태그 `{% bookquote cite="…" page=42 %}`  | 출처를 필드별 속성으로 펼친다: `book`, `title`, `authors`, `translators`, `publisher`, `year`, `page` | figcaption 을 블로그가 일관된 형식으로 조합하려면 필드가 나뉘어 있어야 한다. 출처 문자열 조합 규칙이 두 앱에 흩어지지 않는다                    |
| `postAssetsDir(slug)`                         | 1a 의 `publicDir` 유지                                                                                | 1a 계획에서 이미 바꿨다                                                                                                                         |

- `coverSource`(표지 이미지 조회처 이름, 예: Open Library)는 최상위 공개 필드가 아니라 `cover.source` 로만 나간다. 표지 이미지의 출처 표기이므로 공개 대상이다.
- 표지 이미지의 가로와 세로는 각각 10000px 이하여야 한다.
- 표지 파일은 5 MiB 이하여야 한다.
- 책 ID는 제어 문자와 서식 문자를 거부하고, 인용 속성은 제어 문자 전체를, 본문은 줄바꿈과 탭을 제외한 제어 문자를 거부한다.
- 인용 태그 이름의 대소문자나 서식 문자를 바꾼 변형은 거부한다.
- 표지 이미지에 메타데이터가 있으면 검토 화면에 경고하되 발행을 막지 않는다.

## 수용 기준

### 계약 (`packages/content-contract`)

- **AC-1** `bookSchema` 는 블로그 책 항목의 단일 정의다. 블로그의 `bookSchema` 는 계약의 것과 같은 객체다.
- **AC-2** `PUBLIC_BOOK_FIELDS` 는 `bookSchema` 의 키와 정확히 같고, `excerpts`·`memos`·`body`·`visible`·`coverSource`·`createdAt`·`updatedAt` 을 담지 않는다.
- **AC-3** `BLOG_LAYOUT.booksDir`·`bookCoversDir` 는 실제 블로그 디렉터리를 가리킨다.
- **AC-4** 블로그의 모든 책 파일이 `bookSchema.strict()` 를 통과하고, 파일명(확장자 제외)이 책 id 규칙(13자리 ISBN 또는 bookSlug)을 따른다.
- **AC-5** `bookquoteTag` 는 펼친 태그의 속성 스키마다. `renderBookquote(source, text)` 가 만든 문자열은 `bookquoteTag` 만 등록한 Markdoc 설정으로 `Markdoc.validate` 했을 때 오류가 없다. 구절 원문에 `{%`·`%}` 가 있어도 태그가 깨지지 않는다.

### 블로그 (`apps/blog`)

- **AC-6** 블로그 Markdoc 설정의 `bookquote` 태그 속성은 계약의 `bookquoteTag` 에서 온다.
- **AC-7** `bookquote` 는 `<figure class="bookquote"><blockquote>…</blockquote><figcaption>…</figcaption></figure>` 로 렌더링된다. figcaption 은 저자, 『제목』, 역자(있으면 "옮김"), 출판사, 연도, 쪽수(있으면) 순서다. `book` 이 책장에 있는 책이면 제목이 `/books#<책 id>` 로 연결되고 `blockquote` 의 `cite` 가 그 URL 이다.
- **AC-8** 책장(`/books`)의 각 책 항목은 `id="<책 id>"` 앵커를 가진다.

### 워크벤치 (`apps/workbench`)

- **AC-9** 책 문서의 구절은 `id`(ULID)와 `public`(boolean, 선택) 키를 받는다. id 가 없는 구절은 책 문서를 저장할 때 채워지고, 한 번 채운 id 는 다른 구절의 추가·수정·삭제·순서 변경에도 바뀌지 않는다. 구절 수정 API 는 `id` 와 `public` 을 보존한다.
- **AC-10** `toPublicBook(record, cover)` 는 `PUBLIC_BOOK_FIELDS` 밖의 키를 내보내지 않는다. `excerpts`·`memos`·본문을 채운 입력에서도 그렇다. 출력은 `bookSchema.strict()` 를 통과한다. `visible: false` 인 책은 내보내기 계획에서 "파일 없음"(이미 있으면 삭제)이 된다.
- **AC-11** `expandBookquotes(body, lookup)` 은 글 본문의 `{% bookquote book="…" excerpt="…" /%}` 를 구절 원문과 출처로 펼친다. 책이 없거나, 구절이 없거나, 구절의 `public` 이 `true` 가 아니면 거부한다. 출처의 저자·제목은 비어 있을 수 없다.
- **AC-12** 글 발행 미리보기는 `bookquote` 를 펼친 결과로 diff 를 만들고, 인용마다 길이와 같은 책의 `public: true` 구절 누적 길이를 보여 준다. 인용 하나가 500자를 넘거나 누적이 2,000자를 넘으면 경고를 띄운다(발행을 막지는 않는다).
- **AC-13** 책 내보내기는 글 발행과 같은 게이트를 거친다: 검토(diff 미리보기)와 명시적 확정. 확정하면 `BLOG_LAYOUT.booksDir/<책 id>.json` 과 표지를 `bookCoversDir` 에 쓰고 `content/book-<키>` 브랜치에 커밋한다. 표지의 너비·높이는 이미지 헤더에서 읽는다(JPEG·PNG·WebP).
- **AC-14** 발행 outbox 는 글 경로와 책 경로를 모두 받고, 그 밖의 경로는 거부한다.
- **AC-15** 블로그 책 파일을 워크벤치 책 문서로 가져오는 계획(`planBookImport`)은 필드를 잃지 않는다. 가져온 문서를 다시 `toPublicBook` 하면 표지를 제외하고 같은 값이 된다.
- **AC-16** (manual) 워크벤치 화면에서 구절의 공개 여부를 켜고 끌 수 있고, 책 상세 화면에서 내보내기 검토와 확정을 할 수 있다.
- **AC-17** (manual) 스모크 글의 `bookquote` 가 블로그 빌드 결과에서 figure·figcaption·책장 링크로 렌더링된다.
