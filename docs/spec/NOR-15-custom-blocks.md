---
issue: NOR-15
title: 커스텀 블럭 — URL 북마크 · GitHub 카드 · 콜아웃
status: done
---

# NOR-15 — 커스텀 블럭: URL 북마크 · GitHub 카드 · 콜아웃

> Linear: https://linear.app/noru-kim/issue/NOR-15
> 데이터 취득 전략 결정: [ADR 0008](../decisions/0008-custom-block-data-strategy.md)

## 목표

Markdoc 본문에서 `{% bookmark %}` · `{% github %}` · `{% callout %}` 세 커스텀 블럭을 쓸 수 있게 하고,
북마크/GitHub 카드의 메타데이터는 **빌드타임에 fetch** 해 정적 HTML로 굽는다. 외부 요청이 실패해도
빌드는 성공하며 최소 형태로 폴백한다. 콜아웃은 WCAG AA를 만족하는 6종 타입을 제공한다.

## 입력 / 출력

- 입력: `.mdoc` 콘텐츠의 Markdoc 태그 + (bookmark/github) 외부 HTTP 응답
- 출력: 클라이언트 JS 없이 완결된 정적 HTML 카드 / 콜아웃

---

## 태그 스키마 (NOR-20 Keystatic 매핑의 단일 참조점)

NOR-19/NOR-20이 Keystatic 삽입 UI를 만들 때 **이 표를 그대로 필드로 옮긴다.**
`markdoc.config.mjs` 의 `tags` 정의가 실제 구현이며, 이 문서는 그 의미를 설명한다.

### `{% bookmark /%}` — self-closing

URL 프리뷰 카드. `url` 외 속성은 모두 **작성자 오버라이드**이며 fetch 결과보다 우선한다.

| 속성          | 타입   | 필수 | 기본값 | 의미                                                                      |
| ------------- | ------ | ---- | ------ | ------------------------------------------------------------------------- |
| `url`         | String | ✅   | —      | 북마크 대상 절대 URL. `http`/`https` 만 허용                              |
| `title`       | String | ❌   | fetch  | 카드 제목. **명시하면 fetch를 통째로 건너뛴다**(오프라인/사설 URL 탈출구) |
| `description` | String | ❌   | fetch  | 카드 설명(2줄 클램프)                                                     |
| `image`       | String | ❌   | fetch  | 대표 이미지 URL(og:image). 빈 문자열이면 이미지 영역 자체를 생략          |
| `siteName`    | String | ❌   | fetch  | 사이트 이름. 없으면 URL 호스트명                                          |

- Keystatic 힌트: `url` = `fields.url`, 나머지 = 선택 `fields.text`. 편집기에서는 비워두는 것이 기본이고, 채우면 fetch를 끈다는 안내가 필요하다.

### `{% github /%}` — self-closing

GitHub 레포 카드. `description` 을 명시하면 fetch를 건너뛴다.

| 속성          | 타입   | 필수 | 기본값 | 의미                                                    |
| ------------- | ------ | ---- | ------ | ------------------------------------------------------- |
| `repo`        | String | ✅   | —      | `owner/name` 형식. 그 외 형식은 폴백 렌더               |
| `description` | String | ❌   | fetch  | 레포 설명. **명시하면 fetch를 건너뛴다**                |
| `stars`       | Number | ❌   | fetch  | 스타 수. 오프라인에서 카드를 완성하고 싶을 때 직접 지정 |
| `language`    | String | ❌   | fetch  | 주 언어 배지                                            |

- Keystatic 힌트: `repo` = `fields.text` + `owner/name` 검증, `stars` = `fields.integer`.

### `{% callout %} … {% /callout %}` — children 있음

| 속성     | 타입   | 필수 | 기본값    | 의미                                                                     |
| -------- | ------ | ---- | --------- | ------------------------------------------------------------------------ |
| `type`   | String | ❌   | `note`    | `matches: ['note','info','tip','success','warning','danger']` 중 하나    |
| `title`  | String | ❌   | 타입 라벨 | 헤더 제목. 없으면 타입 기본 라벨(참고/정보/팁/성공/주의/위험)이 노출된다 |
| children | —      | —    | —         | 콜아웃 본문. 문단·리스트·코드블럭 등 임의의 Markdoc 블록                 |

- Keystatic 힌트: `type` = `fields.select`(6 옵션), `title` = 선택 `fields.text`, children = `fields.child`.

### 타입별 라벨·아이콘·의미

| type      | 라벨 | 아이콘    | 용도                            |
| --------- | ---- | --------- | ------------------------------- |
| `note`    | 참고 | 메모      | 부가 정보(기본값)               |
| `info`    | 정보 | ⓘ         | 알아두면 좋은 사실              |
| `tip`     | 팁   | 전구      | 권장 사항·요령                  |
| `success` | 성공 | 체크      | 잘 된 상태·권장 결과            |
| `warning` | 주의 | 삼각 경고 | 주의하지 않으면 문제가 됨       |
| `danger`  | 위험 | 금지      | 데이터 손실·보안 등 파괴적 결과 |

> `error` 타입은 `danger` 로 통합했다(같은 의미의 중복 어휘).

---

## 동작 / 상태 전이

### bookmark

```
title 명시?  ── 예 ─→ [explicit]  fetch 없음, 명시값으로 렌더
     │ 아니오
     ▼
디스크 캐시 히트(TTL 내)? ── 예 ─→ 캐시값 사용
     │ 아니오
     ▼
fetch(5s 타임아웃, HTML 512KB 상한) ─ 성공 ─→ OG 파싱 → 캐시 기록 → [fetched]
     │ 실패/타임아웃/비HTML/4xx·5xx
     ▼
경고 로그 + 실패 캐시(1h) → [fallback]  URL 문자열만으로 링크 렌더
```

`url` 이 http(s) 가 아니면 fetch 하지 않고, **`<a>` 대신 `<div>` 로 렌더해 `href` 자체를 내보내지 않는다**
(`javascript:` URL 이 그대로 링크가 되는 것을 막는다).

명시 속성은 마지막에 fetch 결과 위에 다시 덮어쓴다(필드 단위 우선).

### github

```
repo 형식이 owner/name 인가? ── 아니오 ─→ [fallback] repo 문자열만 (링크 없음)
     │ 예
     ▼
description 명시? ── 예 ─→ [explicit]
     │ 아니오
     ▼
캐시 → api.github.com/repos/{owner}/{name}
      (GITHUB_TOKEN 있으면 Bearer 헤더, 5s 타임아웃)
      성공 → [fetched] / 404·rate limit·네트워크 오류 → 경고 로그 → [fallback]
```

### callout

순수 정적. 상태 없음.

## 성공 / 실패 조건

- 성공: 세 블럭이 정적 HTML로 렌더되고, 카드에 클라이언트 JS가 붙지 않는다.
- 성공: 도달 불가 URL·존재하지 않는 repo가 콘텐츠에 있어도 `pnpm build` 가 **성공**한다.
- 실패: 외부 요청 실패가 예외로 전파되어 빌드를 깨뜨리는 것.
- 실패: 카드 내용이 런타임에 채워지는 것(정적 우선 위배).

## 엣지 케이스

- `url` 이 `javascript:` 등 비 http(s) 스킴 → fetch 하지 않고, `href` 없는 `<div>` 카드로 폴백.
- 응답이 HTML이 아님(PDF/이미지) → 파싱하지 않고 폴백.
- OG 메타가 전혀 없음 → `<title>` → `meta[name=description]` 순으로 대체, 그래도 없으면 폴백.
- `og:image` 가 상대 경로 → 최종 응답 URL 기준으로 절대화.
- 리디렉션 → `response.url`(최종 URL)을 기준 URL로 사용.
- 거대한 HTML → 512KB까지만 읽고 스트림을 끊는다.
- HTML 엔티티(`&amp;`, `&#39;`)가 포함된 메타 → 디코드.
- `repo` 에 `owner/name/extra` 나 공백 → 형식 위반. 목적지를 지어내지 않고 `href` 없는 `<div>` 카드로 폴백.
- GitHub rate limit(403) → 폴백 + 경고.
- 아카이브된/포크 레포 → 정상 fetch(별도 처리 없음).
- 동시 빌드에서 같은 캐시 파일 기록 → 임시 파일 + `rename` 원자적 교체.
- 캐시 디렉토리 쓰기 불가(읽기 전용 FS) → 조용히 무시(캐시 없이 동작).

## 검증 방법 (= TDD 테스트 목록)

유닛(vitest):

- [x] `parseOpenGraph` — og:title/og:description/og:image/og:site_name 추출
- [x] `parseOpenGraph` — og 없으면 `<title>` / `meta[name=description]` / twitter:\* 폴백
- [x] `parseOpenGraph` — 속성 순서 역전(`content` 가 먼저), 작은따옴표, 대문자 속성명
- [x] `parseOpenGraph` — HTML 엔티티 디코드
- [x] `parseOpenGraph` — 상대 og:image 를 baseUrl 로 절대화
- [x] `parseOpenGraph` — 메타가 하나도 없으면 `null`
- [x] `parseRepoSlug` — `owner/name` 파싱, 잘못된 형식(`a`, `a/b/c`, 공백, 빈 문자열) 거부
- [x] `parseRepoSlug` — 전체 GitHub URL(`https://github.com/owner/name`)도 허용
- [x] `isFetchableUrl` — http/https 만 통과, `javascript:`/상대경로 거부
- [x] `fetchOpenGraph` — 타임아웃/네트워크 오류/비 HTML/4xx 에서 예외 없이 `null` 반환
- [x] `fetchGitHubRepo` — 404·rate limit 에서 예외 없이 `null` 반환
- [x] `fetchGitHubRepo` — `GITHUB_TOKEN` 있으면 Authorization 헤더 첨부
- [x] 디스크 캐시 — 쓰고 읽으면 같은 값, TTL 만료 시 miss, 손상된 JSON 은 miss
- [x] 디스크 캐시 — 쓰기 실패해도 예외를 던지지 않음

빌드/스모크:

- [x] `/smoke/blocks` 에서 세 블럭 전부 렌더
- [x] 도달 불가 URL·존재하지 않는 repo 를 포함한 스모크 글로 `pnpm build` 성공
- [x] `dist/` 산출물 grep 으로 `data-block-state="fetched"` 와 `"fallback"` 이 모두 존재
- [x] `dist/` 산출물에 콜아웃 6종의 아이콘 + 텍스트 라벨이 존재(색 단독 전달 아님)
- [x] `pnpm lint` / `pnpm format:check` / `pnpm build` 통과

## 구현 계획 (plan)

1. ADR 0008 — 데이터 취득 전략 결정 ✅
2. `src/lib/disk-cache.ts` — TTL 온디스크 캐시(원자적 쓰기, 실패 무해화)
3. `src/lib/open-graph.ts` — OG 파서 + 타임아웃/용량 상한 fetch
4. `src/lib/github-repo.ts` — repo slug 파서 + GitHub API fetch
5. 위 3개 모듈의 vitest 테스트 (TDD)
6. `Bookmark.astro` / `GitHub.astro` / `Callout.astro` 재작성
7. `markdoc.config.mjs` 태그 스키마 엄격화(type/required/matches/selfClosing)
8. `global.css` 블럭 스타일(라이트/다크, AA 대비)
9. 스모크 콘텐츠 `custom-blocks-smoke-test.mdoc` + 페이지 `/smoke/blocks`
10. 빌드·린트·dist grep 검증 → 셀프 리뷰 루프

## 완료 조건 (일감)

- [x] `{% bookmark url=... /%}` OG 메타 프리뷰 카드
- [x] `{% github repo=... /%}` 레포 카드(스타/설명)
- [x] `{% callout type=... %}` 콜아웃
- [x] Keystatic 에디터에서 삽입 가능하도록 태그 정의
