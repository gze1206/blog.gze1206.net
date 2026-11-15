---
issue: NOR-21
title: About 정적 정보구조 + SEO 텍스트 레이어
status: done
---

# NOR-21 — About 정적 정보구조 + SEO 텍스트 레이어

홈을 경력 서사와 최근 글을 담는 정적 HTML로 구성했다. 공개 범위는 프로젝트 지침에 제공된
경력·역할·기술뿐이며 실명, 연락처, SNS, 구체적인 재직 기간은 포함하지 않는다.

## 검증

- 홈 산출물에 경력·MMORPG·주요 기술·최근 글 텍스트와 단일 `h1` 존재 확인
- `pnpm lint`, `pnpm build`, `pnpm format:check` 통과
- 구현 커밋: `a9e6edf`
