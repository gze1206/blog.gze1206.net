# 브랜치·PR 전략

**일감(NOR) 단위**로 브랜치와 PR을 만듭니다.

## 브랜치 모델

```
master ──────────────────────────────●  (런칭 시 v4 병합)
             ▲
v4 (통합) ───┴──●──●──●───────────────   (재구축 통합 브랜치)
                ▲  ▲
                │  └ feat/nor-16-blog-list
                └ feat/nor-9-content-schema
```

- **`master`** — 운영 기본 브랜치. 재구축이 끝나면(NOR-36) `v4`를 여기로 병합.
- **`v4`** — 이번 재구축의 **통합 브랜치**. 일감 브랜치는 여기서 따고 여기로 병합.
- **일감 브랜치** — NOR 일감 하나당 하나. `v4`에서 분기 → `v4`로 PR.

> 즉, 개별 일감 PR의 **base 브랜치는 `v4`** 입니다. `master`로 직접 PR하지 않습니다(런칭 병합만 예외).

## 브랜치 네이밍

```
<type>/nor-<번호>-<짧은-영문-슬러그>
```

- `type`: `feat` / `fix` / `chore` / `docs` (커밋 type과 동일 어휘).
- 예: `feat/nor-16-blog-list`, `feat/nor-11-cil-highlight`, `chore/nor-8-lint-setup`.
- Linear가 제공하는 `branchName`이 있으면 그대로 써도 됩니다 (`orca linear issue NOR-N --json` 의 `branchName`).

## PR 규칙

- **PR은 [리뷰-피드백 루프](./workflow.md#리뷰-피드백-루프-pr-전-필수)를 통과한 뒤에 연다.** 셀프 리뷰 → 사용자 피드백 반영 → 승인이 전제.
- **1 일감 = 1 PR.** 제목은 커밋 규약을 따르고 끝에 일감 ID를 포함:
  `✨ feat(blog): 목록/상세 + 카테고리·태그·시리즈 페이지 (NOR-16)`
- PR 본문 권장 항목(한국어):
  - **관련 일감**: `NOR-16` (Linear 링크)
  - **변경 요약**: 무엇을 왜.
  - **완료 조건 체크**: 해당 일감의 완료 조건을 체크리스트로.
  - **검증**: `npm run build` / 린트 통과 여부, 확인한 화면·경로.
  - **의존/후속**: 선행 일감, 남긴 TODO.
- PR 에이전트 본문 하단:

  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  ```

## 병합

- **Squash merge** 권장(일감 단위로 히스토리를 깔끔하게).
- 병합 전 조건: 빌드·린트 통과, 일감 완료 조건 충족, 리뷰 확인.
- 병합 후 일감 브랜치는 삭제.

## Linear 연동

- 착수/완료 시 상태 이동, PR 링크 첨부는 `orca linear` CLI를 사용합니다. 자세한 흐름은 [workflow.md](./workflow.md) 참고.

## 관련 문서

- 커밋 메시지: [commits.md](./commits.md)
- 작업 흐름(PRD/ADR/spec/plan/TDD): [workflow.md](./workflow.md)
