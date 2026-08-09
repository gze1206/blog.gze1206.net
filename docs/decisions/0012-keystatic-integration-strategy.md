---
number: '0012'
title: Keystatic 통합 전략 — 정적 출력 유지와 series/portfolio 매핑
status: partially superseded by 0015
date: 2026-07-22
related: [NOR-19]
---

# 0012. Keystatic 통합 전략 — 정적 출력 유지와 series/portfolio 매핑

> 2026-08-09: 정적 출력·series/portfolio 매핑 결정은 유지한다. 원격 Keystatic 런타임의 dev 전용
> 제한은 [ADR 0015](./0015-cms-publishing-runtime-and-workflow.md)로 대체됐다.

## 맥락 (Context)

NOR-19에서 Keystatic(CMS)을 도입한다. 그런데 Keystatic의 Astro 통합은 이 저장소의 두 가지 전제와
정면으로 부딪힌다.

**(1) 정적 출력.** 이 블로그는 `output`을 지정하지 않는 **완전 정적** 사이트이고 Cloudflare Pages에
정적 배포한다(NOR-6). 반면 `@keystatic/astro`는 `astro:config:setup`에서 두 라우트를
`prerender: false`로 주입한다 (`node_modules/@keystatic/astro/dist/keystatic-astro.js` 확인).

```js
injectRoute({ pattern: '/keystatic/[...params]', prerender: false });
injectRoute({ pattern: '/api/keystatic/[...params]', prerender: false });
```

정적 출력에 온디맨드 라우트가 하나라도 섞이면 Astro는 어댑터를 요구한다. 공식 템플릿이
`output: 'server'` + node 어댑터를 쓰는 이유다. **그대로 따라가면 이 블로그는 정적 사이트가 아니게
된다.** 게다가 로컬 모드 API는 파일시스템에 직접 쓰므로 배포본에 딸려 나가서도 안 된다.

**(2) 컬렉션 모델.** Keystatic의 `collection`은 **엔트리 하나 = 파일 하나**를 전제한다
(`path: 'src/content/series/*'` → `src/content/series/<slug>.json`). 그런데 이 저장소의
series·portfolio는 **배열이 통째로 든 JSON 파일 하나**를 `file()` 로더로 읽고 있었다.

부수적으로, zod 스키마(`src/content/schemas.ts`)가 진실의 원천이라는 제약도 있다. Keystatic이
만든 파일이 zod를 통과하지 못하면 그 다음 빌드가 깨진다.

## 검토한 대안 (Options)

### (1) 정적 출력을 지키는 방법

- **A안: 공식 템플릿대로 `output: 'server'` + 어댑터** — 장점: 설정이 단순, 문서 그대로. 단점:
  **프로젝트 전제를 뒤집는다.** 정적 배포가 아니게 되고, 어드민이 배포본에 노출된다. 탈락.
- **B안: 어댑터를 쓰되 프로덕션 빌드에서 admin 라우트만 제외** — 장점: 한 설정으로 dev/prod 공용.
  단점: 라우트를 걷어내도 `output: 'server'`인 이상 산출물 구조가 정적과 달라진다. 제외 로직이
  Keystatic 내부 라우트 이름에 의존해 깨지기 쉽다.
- **C안: 통합 자체를 dev 에서만 등록** — 장점: 프로덕션 설정이 **지금과 완전히 동일**하다. 어댑터도,
  온디맨드 라우트도, React 런타임도 애초에 존재하지 않는다. 단점: 어드민이 `astro dev`에서만 뜬다
  (로컬 모드는 어차피 로컬 파일시스템에 쓰므로 실질 제약이 아니다). GitHub 모드(NOR-20)로 갈 때
  이 결정을 다시 봐야 한다.

### (2) series / portfolio 매핑

- **D안: Keystatic `singleton` + `fields.array`** — 파일 하나를 그대로 편집. 장점: 데이터 이동 없음.
  단점: singleton의 스키마는 객체라서 파일이 `{ "items": [...] }`로 감싸진다. 지금의 `file()` 로더는
  배열/객체맵을 기대하므로 `parser` 옵션이 추가로 필요하고, **파일 포맷이 어차피 바뀐다.** 게다가
  항목 추가/삭제가 배열 편집 UI 안으로 들어가 컬렉션 UI(목록·생성·삭제)를 못 쓴다.
- **E안: 엔트리별 파일로 옮기고 로더를 `glob()`으로 교체** — 장점: Keystatic의 모델과 그대로 맞는다.
  단점: 데이터 파일 이동. 조회 코드 영향 여부를 확인해야 한다.

### (3) 글 파일 확장자 (Keystatic 컬렉션은 확장자 하나만 소유한다)

- **F안: `.mdoc`** — 커스텀 블럭(ADR 0008)이 사는 포맷. NOR-20의 삽입 UI가 향할 곳. 단, 기존 `.md`
  글은 어드민 목록에 뜨지 않는다.
- **G안: `.md`** — 기존 `.md` 글을 편집할 수 있다. 단, 어드민에서 만든 글은 커스텀 블럭을 쓸 수 없고
  (`.md`는 Markdoc 파이프라인을 타지 않는다), NOR-20에서 다시 뒤집어야 한다.

## 결정 (Decision)

**C안 + E안 + F안**을 선택한다.

- 어드민은 `command === 'dev'`일 때만 등록한다 (`src/integrations/keystatic-dev.ts`).
- series·portfolio를 **엔트리별 파일**로 옮기고 로더를 `glob()`으로 바꾼다.
- posts 컬렉션은 `.mdoc`을 쓴다. 기존 `.md` 글은 손으로 쓰는 글로 남는다.

## 근거 (Rationale)

**C안** — 프로덕션 빌드 경로에서 Keystatic을 **존재하지 않게** 만드는 것이 "정적 산출물이어야 한다"를
지키는 가장 확실한 방법이다. 라우트를 걷어내는 방식(B안)은 "무엇을 제외했는가"를 계속 증명해야 하지만,
등록 자체를 막으면 증명할 것이 없다. 실제로 `pnpm build` 산출물이 도입 전과 **완전히 동일**하다
(49페이지, JS 파일 목록 동일, `dist/keystatic`·`dist/api` 없음, React 런타임 없음).

React 통합도 같이 dev 전용이다. 그래서 `@keystatic/*`·`@astrojs/react`·`react`·`react-dom`은
`devDependencies`에 둔다 — 프로덕션 코드가 이들을 참조하지 않는다는 사실을 관례가 아니라 구조로
남기기 위해서다. NOR-25에서 첫 React 아일랜드가 들어오면 그때 `dependencies`로 승격한다.

**E안** — 엔트리 id가 그대로 유지되는 것이 결정적이었다. Astro의 `glob()` 로더는 데이터에 `slug`가
있으면 그것을, 없으면 파일명을 id로 쓴다. series는 `slug`(=파일명), portfolio는 파일명이 곧 기존
id와 같아서 `posts.series`가 가리키던 값도, `getSeriesById()`도, 시리즈 페이지·시리즈 내비게이션도
건드릴 필요가 없었다. D안은 "파일을 안 옮긴다"는 장점이 실제로는 성립하지 않는다(어차피 포맷이 바뀐다).

**F안** — 이 CMS가 향하는 곳은 커스텀 블럭을 넣는 글쓰기(NOR-20)다. `.md`를 고르면 그 방향에서 반드시
뒤집힌다. ADR 0003의 "`.md`와 `.mdoc` 병행"은 그대로 유효하다 — 단순한 글은 여전히 `.md`로 손으로
쓸 수 있고, CMS는 `.mdoc`만 관리한다.

**zod 정합** — 슬러그 정규식은 `src/content/slug-pattern.ts` 한 곳에 두고 zod와 Keystatic이 함께
쓴다. Keystatic의 slug 필드는 `name`을 데이터에, `slug`를 파일명에 쓰는데, 기본 동작인 "제목을
슬러그화"는 한글 제목에서 무엇이 나올지 알 수 없으므로 쓰지 않는다. 대신 **슬러그 자체를 입력받고**
(`pattern` 검증) `generate`를 항등 함수로 두어 프론트매터 `slug`와 파일명을 같은 값으로 묶었다.

## 영향 (Consequences)

- 긍정: 프로덕션 산출물이 도입 전과 동일하다. 어드민·로컬 모드 API가 배포본에 존재할 수 없다.
  series·portfolio가 Keystatic 컬렉션 UI로 편집된다. 기존 페이지·조회 코드는 무변경.
- 부정/비용:
  - 어드민은 `pnpm dev`에서만 뜬다. `pnpm preview`에는 없다.
  - `astro.config.mjs`가 dev 전용 통합을 **정적으로** import 하므로(훅 안에서 `await import`를 하면
    Vite 모듈 러너가 이미 닫혀 있어 터진다) **빌드에도 전체 설치가 필요하다** —
    `pnpm install --prod` 후의 `pnpm build`는 실패한다. 배포(NOR-6)는 전체 설치를 전제로 한다.
  - 기존 `.md` 글 20편은 어드민 목록에 뜨지 않는다(대부분 픽스처다). 필요해지면 `.md` 전용 컬렉션을
    하나 더 두거나 `.mdoc`으로 옮기면 된다.
  - `@keystatic/core`가 `@keystar/ui`·`react-aria`·`react-stately`를 dependencies와
    peerDependencies에 **동시에** 선언해 pnpm이 설치를 건너뛴다. 세 패키지를 이 저장소가 직접
    명시해야 어드민이 뜬다(빠지면 `Could not resolve "@keystar/ui/layout"`).
  - Keystatic은 **필드 간 제약**(series↔seriesOrder 동반 필수, portfolio 링크 항목당 URL 최소 1개)을
    표현하지 못한다. 어긋난 저장을 막지 못하고 다음 빌드의 zod에서 걸린다. 자세한 내용과 완화책은
    [`docs/spec/NOR-19-keystatic.md`](../spec/NOR-19-keystatic.md).
- 후속 작업: NOR-20 — GitHub 모드/웹 에디터, 커스텀 블럭 삽입 UI(`fields.markdoc`의 `components`),
  이미지 업로드 경로. GitHub 모드는 배포된 사이트에서 어드민이 떠야 하므로 **이 ADR의 C안을 다시
  검토**해야 한다(별도 어드민 배포 등).
