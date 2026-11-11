---
issue: NOR-136
title: CMS 기반 소개·커리어 콘텐츠 관리
status: draft
---

# NOR-136 — CMS 기반 소개·커리어 콘텐츠 관리

> Linear: https://linear.app/noru-kim/issue/NOR-136

## 목표

홈페이지 소개와 경력·기술 정보를 코드에서 분리해 CMS로 편집하고, 공개 여부가 명시된 콘텐츠만
정적 사이트에 렌더한다.

## 입력 / 출력

- 입력: Keystatic의 profile singleton과 experience 컬렉션에 입력한 소개, 기술, 경력 항목.
- 출력: `src/content/profile.json`, `src/content/experience/<id>.json` 및 이를 읽어 렌더한 홈페이지/소개.

## 동작 / 상태 전이

```
Keystatic 저장 → GitHub content/* 브랜치의 JSON 변경 → Worker 미리보기
  → v4 병합 → visible: true 항목만 정적 홈페이지/소개에 렌더
```

- `visible: false`인 경력은 목록·JSON-LD·검색·정적 산출물 어디에도 나타나지 않는다.
- 기간과 회사명은 작성자가 공개용으로 입력한 값만 사용한다. 기존 운영 블로그의 상세 경력은 자동 이관하지 않는다.

## 성공 / 실패 조건

- 성공: 소개, 기술, 공개 경력 항목을 브라우저 CMS에서 만들고 수정할 수 있다.
- 성공: 누락된 필수 필드와 잘못된 URL은 zod가 빌드 전에 차단한다.
- 실패: 숨긴 항목이 HTML 또는 구조화 데이터에 노출되면 실패다.

## 검증 방법 (= TDD 테스트 목록)

- [ ] profile/experience 스키마가 공개 제어와 필수 값을 검증한다.
- [ ] `getVisibleExperiences()`가 `visible: false` 항목을 제외하고 기간 역순으로 정렬한다.
- [ ] 홈페이지 렌더 결과에 공개 항목만 존재한다.
- [ ] Keystatic 설정이 profile singleton과 experience 컬렉션을 노출한다.

## 구현 계획 (plan)

1. profile·experience zod 스키마와 Astro loader를 추가한다.
2. 콘텐츠 조회 모듈과 단위 테스트로 공개 필터·정렬을 고정한다.
3. 홈페이지의 하드코드 소개를 콘텐츠 조회 결과로 바꾼다.
4. Keystatic singleton·collection 스키마를 추가하고 CMS에서 왕복 검증한다.

## 완료 조건 (일감)

- [ ] profile singleton과 경력 항목 컬렉션을 Content Collections(zod)로 정의
- [ ] Keystatic에서 소개·기술·경력 항목을 편집
- [ ] 공개 여부를 항목별로 제어하고, 비공개/초안 정보는 정적 산출물에 포함하지 않음
- [ ] 홈 또는 소개 페이지가 해당 콘텐츠를 정적으로 렌더
