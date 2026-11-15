# 개인 워크벤치 M1 구현 계획

> **에이전트 워커용:** 이 계획은 태스크 단위 TDD로 실행한다. 각 스텝은 실패 테스트 → 구현 → 통과 → 커밋 순서다. 체크박스(`- [ ]`)로 진행을 추적한다.
> 근거 스펙: [`docs/specs/2026-08-12-personal-workbench-architecture.md`](../../spec/workbench/2026-08-12-personal-workbench-architecture.md)

**목표:** Tailnet 전용 1인 서비스에서 Markdown 불렛 노트·템플릿·회고·안전한 public Markdoc 발행을 제공한다. 원본은 Markdown, Git은 이력, 앱은 얇은 뷰.

**아키텍처:** 세 저장소 경계(앱 코드 ① / 콘텐츠 `WORKSPACE_ROOT` ② / 공개 블로그 읽기전용 clone `PUBLIC_BLOG_ROOT` ③). `src/core`(순수 도메인) ← `src/server`(어댑터+HTTP) ← `src/web`(React). Vite + React 19 + Hono(Node), TypeScript strict, Zod, gray-matter, Vitest, Playwright.

## 전역 제약

- 콘텐츠 저장소(②)는 앱 저장소(①)의 서브모듈이 아니며 공개 블로그와 절대 같은 저장소에 두지 않는다.
- 저장은 같은 디렉터리 임시 파일 → `fsync` → 원자적 `rename`. 원본을 DB로 복제하지 않는다.
- 자동 이월·자동 회고 문서 생성·자동 커밋·자동 push/배포를 만들지 않는다.
- 모든 경로는 설정 루트 안으로 `realpath` 해석 후 밖이면 거부한다.
- 공개 변환은 private 링크/자산을 거부하고, ③ 워크트리가 깨끗하며 사용자가 확정할 때만 커밋한다. push 없음.
- **이 계획은 공개 블로그 저장소를 수정하지 않는다.**

## 의존 순서

```
NOR-143 (기반: 저장소·파일 계약·템플릿·원자적 저장·경로 안전)
   ├──▶ NOR-144 (불렛·이월)        ─┐
   ├──▶ NOR-146 (공개 발행)          │ 143 이후 병렬 가능
   └──▶ NOR-145 (회고)  ← 144의 불렛 링크에 약하게 의존(코어는 143만 필요)
                    └──▶ NOR-147 (Tailnet 운영 경계: 위 전부 + health/config)
```

- **143은 모든 것의 선행 조건.** 완료 전 다른 태스크를 시작하지 않는다.
- 143 이후 **144와 146은 병렬** 가능(서로 다른 도메인/디렉터리).
- 145의 도메인 코어(기간 계산·제안)는 143만 필요하나, "불렛/초안 링크 삽입" UI는 144 완료 시 완성된다 → 145는 144 뒤에 배치.
- 147은 마지막. health·config 검증이 전 계층 경계를 확인한다.

---

### Task 1 — 저장소·파일 계약·템플릿 코어 (NOR-143)

**Files:** `src/core/document/**`, `src/core/template/**`, `src/server/adapters/{fileStore,paths}.ts`, `src/server/routes/documents.ts`, `src/server/config.ts`, `src/web/{app,DocumentList,TemplateGallery,Editor}.tsx`, `workspace-seed/templates/*.md`, 대응 `*.test.ts`.

- [ ] **Step 1: private 앱 저장소를 strict TS·테스트 스크립트로 스캐폴드**
  - 이 저장소에 Vite+React+Hono, TypeScript strict, Tailwind v4, Vitest, Playwright, ESLint/Prettier 구성. `test`, `lint`, `format:check`, `build`, `e2e` 스크립트 추가.
  - `src/server/config.ts`: `WORKSPACE_ROOT`, `PUBLIC_BLOG_ROOT` 를 **서버 전용** 환경 변수로 로드하고 Zod 검증. 루트 미설정/동일/겹침을 거부.
  - 계층 스켈레톤(`core`/`server`/`web`)과 포트 인터페이스(`FileStore`, `GitRepo`, `PublicBlog`) 정의.

- [ ] **Step 2: 템플릿 frontmatter 파서 실패 테스트 작성**

  ```ts
  expect(parseTemplate(src)).toMatchObject({
    kind: 'weekly-review',
    defaultPath: 'reviews/weekly',
    publicEligible: false,
  });
  expect(() => parseTemplate('---\nkind: nope\n---')).toThrow('unsupported template kind');
  // 미해석 필드 라운드트립 보존
  expect(serialize(parse(src))).toContain('customField: keep-me');
  ```

- [ ] **Step 3: `Template`·`Document`·원자적 파일 저장소 경계 구현**
  - `src/core`: 문서/템플릿 파싱·직렬화(정규형, 닫힌 필드 집합, 미해석 필드 보존), 토큰 치환(`{{date}}`,`{{isoDate}}`,`{{period}}`,`{{id}}`).
  - `src/server/adapters/fileStore`: `listTemplates()`, `createFromTemplate(input)`, `readDocument(path)`, `writeDocument(path, source)`. **같은 디렉터리 임시 파일 → fsync → rename**, DB 없음.
  - `paths.ts`: `realpath` 루트 검증, `..`/심볼릭/절대경로 탈출 거부.
  - `workspace-seed/templates/`: 합의된 5종(capture, private-post, public-draft, weekly-review, monthly-review).

- [ ] **Step 4: 차분한 문서 UI 추가**
  - 템플릿 갤러리, 문서 목록, Markdown 에디터. UI는 `/api/documents` 만 호출하고 **서버가 검증하지 않은 원시 파일시스템 경로를 받지 않는다.**

- [ ] **Step 5: 검증 후 커밋**
  - `pnpm test src/core src/server && pnpm lint && pnpm build`.
  - 커밋: `✨ feat(workbench): 파일 기반 템플릿과 문서 코어 추가 (NOR-143)`

---

### Task 2 — 일일 불렛·의도적 이월 (NOR-144)

선행: NOR-143. **NOR-146과 병렬 가능.**

**Files:** `src/core/bullets/{syntax,parse,serialize,migrate}.ts` + 테스트, `src/server/routes/bullets.ts`, `src/web/day/[date].tsx`, `src/web/{QuickCapture,MigrateDialog,ReviewPanel}.tsx`.

- [ ] **Step 1: Git 친화적 불렛 문법을 실패 테스트로 고정**

  ```md
  - □ 공개 글 초안 정리 <!-- wb:id=01HX -->
  - • 배포 메모 <!-- wb:id=01HY -->
  ```
  - 날짜 변경이 **암묵적 복제를 만들지 않음**을 단언. 이월은 **명시적 행동 후에만** `<!-- wb:migrated-from=01HX -->` 를 만든다. 글리프(`•`/`–`/`○`/`□`)·상태(`□`/`▣`/`⨯`)·안정 ULID 파싱/정규 직렬화.

- [ ] **Step 2: 파서·상태 전이·두 이월 정책 구현**
  - `migrateBullet({ sourceId, targetDate, mode: 'quick' | 'intentional', confirmation })`: 의식적 모드에서 확인 문구 누락 시 거부. 항상 대상에 새 줄, 원본에 불변 이력(`migrated-to`) + 새 항목에 `migrated-from`.
  - 완료·취소·노트화·비공개 글 승격은 명시적 행동으로만.

- [ ] **Step 3: 키보드 우선 일일 UI 구현**
  - 기본값 오늘. `•`·`–`·`○`·`□` 단축 삽입, 상태 토글·유형 순환 단축키. 지난 미완료 항목은 **검토 패널에만** 노출.
  - 간편 이월 = 선택 → 날짜 → 확인. 의식적 이월 = 설정된 확인 문구 추가 요구.

- [ ] **Step 4: 검증 후 커밋**
  - 파싱/이월 단위 테스트 + Playwright(자동 이월 없음, 두 다이얼로그).
  - 커밋: `✨ feat(workbench): 의도적 불렛 이월 흐름 추가 (NOR-144)`

---

### Task 3 — 회고 템플릿과 제안 (NOR-145)

선행: NOR-143(코어), NOR-144(불렛 링크 UI).

**Files:** `src/core/reviews/{period,suggestion}.ts` + 테스트, `src/server/routes/reviews.ts`, `src/web/ReviewPrompt.tsx`.

- [ ] **Step 1: 기간 계산과 "앱 열 때만" 제안 테스트**
  - `getReviewSuggestion(now, documents)`: 기간이 끝났고 해당 회고 파일이 없을 때만 주간/월간 후보 **하나**를 반환. **파일을 쓰지 않는다.** 경계(주 `YYYY-Www`, 월 `YYYY-MM`) 케이스 포함.

- [ ] **Step 2: 작성/나중에/건너뛰기 영속화 구현**
  - `작성`은 `createFromTemplate` 호출. `나중에`는 로컬 선호 저장. `건너뛰기`는 해당 기간만 억제. 수동 생성은 지난 기간도 허용.

- [ ] **Step 3: 절제된 프롬프트와 회고 링크 추가**
  - 일일 로그 로드 후 **비모달 프롬프트 하나**. 푸시 알림·반복 블로킹 모달 금지. 선택 불렛·초안으로의 링크 삽입 허용.

- [ ] **Step 4: 검증 후 커밋**
  - 도메인/API/UI 테스트. 커밋: `✨ feat(workbench): 템플릿 기반 주월 회고 추가 (NOR-145)`

---

### Task 4 — 안전한 public Markdoc 발행 (NOR-146)

선행: NOR-143. **NOR-144와 병렬 가능.**

**Files:** `src/core/publishing/{validate,transform,contract}.ts` + 테스트, `src/server/adapters/publicBlog.ts`(임시 Git 저장소 테스트), `src/server/routes/publish.ts`, `src/web/publish/[path].tsx`, `src/web/PublishReview.tsx`.

- [ ] **Step 1: 누출 탐지와 드라이런 우선 테스트**
  - `file://`, `workspace/`, `assets/private/`, 설정 private 루트, 내부 위키 링크(`[[...]]`), 미해결 자산 참조를 거부. slug 정규식·tags≥1·series/seriesOrder 동반 규칙 검증.
  - 드라이런은 **통합 diff를 반환하고 ③ 워크트리·Git 상태를 바꾸지 않음**을 단언.

- [ ] **Step 2: 결정적 Markdoc 변환 구현**
  - 승인 frontmatter → 블로그 `postSchema`(`title/description/slug/category/tags/series?/seriesOrder?/publishedAt/updatedAt/draft`) 형태 `.mdoc`. 허용 목록 자산만 public 스테이징으로 복사. Git 작업 전 생성 `.mdoc` 재검증.

- [ ] **Step 3: 검토 후 명시적 커밋 구현**
  - ③ 워크트리가 깨끗할 때만 진행. title/slug/category/tags/date/자산/diff 표시 후 `confirmPublish: true` 요구. `content/<slug>` 브랜치 생성·커밋. **push 하지 않는다.**

- [ ] **Step 4: 검증 후 커밋**
  - 임시 Git 저장소로 더러운 워크트리·누출 거부·드라이런·확정 브랜치 커밋 테스트.
  - 커밋: `✨ feat(workbench): 검토형 Markdoc 발행 추가 (NOR-146)`

---

### Task 5 — Tailnet 운영 경계 (NOR-147)

선행: NOR-143~146 전부.

**Files:** `docs/operations/tailnet-workbench.md`, `.env.example`, `Dockerfile`, `docker-compose.yml`, `src/server/routes/health.ts` + 테스트, config 검증 테스트.

- [ ] **Step 1: 호스트 변경 전에 비공개 배포를 문서화**
  - 전용 비루트 서비스 계정, ②에 대한 read/write 키, ③에 대한 **발행 경로 제외 읽기 전용** clone 자격, 백업/복구 명령(②·③는 Git 백업), Tailscale Serve tailnet 한정. 공개 인터넷/`0.0.0.0` 바인딩 금지.

- [ ] **Step 2: 컨테이너 health 엔드포인트와 설정 검증 제공**
  - `GET /api/health`는 **비밀 값·경로를 노출하지 않는다.** 시작 시 루트 미설정, private/public 동일, 설정 루트 밖 쓰기 가능 디렉터리, ②·③ 겹침을 거부.

- [ ] **Step 3: 로컬 검증 후 커밋**
  - 컨테이너 빌드, health 체크, 단위/e2e 스위트.
  - 커밋: `🔒 docs(workbench): Tailnet 전용 운영 경계 기록 (NOR-147)`
  - **사용자의 외부 작업 최종 승인 없이 Serve/ACL 적용·개인 서버 배포를 하지 않는다.**

---

## 최종 검증

- [ ] 앱 저장소(①)에 공개 배포 비밀이 없고, 공개 블로그(③)에 private 원본·자산 경로가 없다.
- [ ] `pnpm test && pnpm lint && pnpm format:check && pnpm build && pnpm e2e` 통과.
- [ ] 수동 키보드 캡처, 두 이월 모드, 놓친 월간 회고, 누출 거부, 드라이런 수용, push 없는 발행 확정 흐름 통과.
- [ ] 자동 이월·자동 회고 생성·자동 커밋·자동 push가 어디에도 없음을 확인.
