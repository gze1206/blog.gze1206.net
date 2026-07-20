---
issue: NOR-9
title: Content Collections 스키마 정의 (posts·series·portfolio)
status: in-progress
---

# NOR-9 — Content Collections 스키마 정의 (posts·series·portfolio)

> Linear: https://linear.app/noru-kim/issue/NOR-9

## 목표

Astro Content Collections + zod로 posts·series·portfolio 세 컬렉션의 스키마를 정의하고, `getCollection` 호출 시 타입 안전을 확보한다. 스모크용 예시 콘텐츠를 넣어 빌드가 스키마를 실제로 검증하도록 한다.

## 입력 / 출력

- 입력: Markdown 프론트매터(posts·portfolio) 및 JSON/YAML 데이터(series)
- 출력:
  - `src/content/schemas.ts` — zod 스키마 객체 export (단위 테스트 가능)
  - `src/content.config.ts` — Astro Content Collections 등록 (schemas.ts 재사용)
  - 예시 콘텐츠 파일 (posts 2건 이상, series 1건, portfolio 1건)
  - 타입 안전한 `getCollection('posts')` 등 호출 가능

## 동작 / 상태 전이

1. Astro 빌드 시 `content.config.ts`의 컬렉션 정의를 읽는다.
2. glob/file 로더가 콘텐츠 파일을 수집한다.
3. zod 스키마로 프론트매터/데이터를 검증한다 — 실패 시 빌드 에러.
4. 통과하면 타입이 추론된 컬렉션 데이터가 `getCollection()`으로 접근 가능.

## 성공 / 실패 조건

- 성공:
  - `pnpm build` 통과, 스키마 검증 실행됨
  - `getCollection('posts')`, `getCollection('series')`, `getCollection('portfolio')` 타입 안전
  - 예시 콘텐츠가 스키마 통과
  - `pnpm lint`, `pnpm format:check` 통과
  - `pnpm test` 통과 (스키마 단위 테스트)
- 실패:
  - 프론트매터 필드 누락/타입 불일치 → 빌드 에러 (의도된 동작)
  - `draft` 기본값 미설정 → 기존 글 깨짐

## 엣지 케이스

- posts에 series 없이 seriesOrder만 있는 경우 → 검증 실패해야 함
- posts에 seriesOrder 없이 series만 있는 경우 → 검증 실패해야 함
- tags가 빈 배열인 경우 → 최소 1개 필요(검증 실패)
- portfolio links 객체에 키가 하나도 없는 경우 → 최소 1개 필요
- slug에 한글/특수문자 포함 → 영문 kebab-case만 허용
- publishedAt > updatedAt → 논리적으로 불가하나, 실용적으로 허용(초기 작성 후 수정 없음 시 같은 날짜)
- draft 미지정 시 기본값 false

## 검증 방법 (= TDD 테스트 목록)

### posts 스키마

- [ ] 모든 필수 필드가 있으면 파싱 성공
- [ ] title 누락 시 파싱 실패
- [ ] description 누락 시 파싱 실패
- [ ] slug가 영문 kebab-case면 성공
- [ ] slug에 한글 포함 시 실패
- [ ] slug에 대문자 포함 시 실패
- [ ] slug에 공백 포함 시 실패
- [ ] category 누락 시 실패
- [ ] tags가 빈 배열이면 실패 (최소 1개)
- [ ] tags에 1개 이상이면 성공
- [ ] series와 seriesOrder 둘 다 있으면 성공
- [ ] series만 있고 seriesOrder 없으면 실패
- [ ] seriesOrder만 있고 series 없으면 실패
- [ ] series와 seriesOrder 둘 다 없으면 성공
- [ ] publishedAt이 Date로 강제 변환되면 성공
- [ ] updatedAt이 Date로 강제 변환되면 성공
- [ ] draft 미지정 시 기본값 false
- [ ] draft: true 설정 가능

### series 스키마

- [ ] name, slug, description 모두 있으면 성공
- [ ] name 누락 시 실패
- [ ] slug가 영문 kebab-case면 성공
- [ ] slug에 한글 포함 시 실패
- [ ] description 누락 시 실패

### portfolio 스키마

- [ ] 모든 필수 필드가 있으면 파싱 성공
- [ ] title 누락 시 실패
- [ ] summary 누락 시 실패
- [ ] stack이 빈 배열이면 실패 (최소 1개)
- [ ] links가 빈 배열이면 실패 (최소 1개)
- [ ] links 항목에 유효한 URL만 허용
- [ ] links 항목에 repo, demo, video, article 키 중 최소 1개 필수
- [ ] thumbnail은 선택적

## 구현 계획 (plan)

1. **vitest 설정**: devDependency 추가, `pnpm test` 스크립트 등록
2. **스키마 정의** (`src/content/schemas.ts`): posts·series·portfolio zod 스키마를 export
3. **TDD Red**: 검증 목록을 실패 테스트로 작성
4. **TDD Green**: 스키마 구현으로 테스트 통과
5. **TDD Refactor**: 정리
6. **content.config.ts**: 스키마를 import하여 Astro Content Collections 등록
7. **예시 콘텐츠**: posts 2건(1 정상 + 1 draft), series 1건, portfolio 1건
8. **검증**: `pnpm build` + `pnpm lint` + `pnpm format:check` + `pnpm test` 통과
9. **ADR**: 스키마 모듈 분리 결정 기록
10. **셀프 리뷰 루프**: diff 점검 → 수정 → 재검증 반복
11. **PR 생성**: v4 base

## 완료 조건 (일감)

- [ ] posts: title, description, 영문 slug, category, tags[], series?, seriesOrder?, publishedAt, updatedAt, draft(기본 false)
- [ ] series: name, slug, description
- [ ] portfolio: title, summary, stack[], links[]{repo?,demo?,video?,article?}, thumbnail
- [ ] Astro Content Collections로 정의 (content.config.ts)
- [ ] getCollection 타입 안전 확인
- [ ] 스모크용 예시 콘텐츠 최소 1건씩 (draft 포함)
- [ ] pnpm build / lint / format:check / test 통과
