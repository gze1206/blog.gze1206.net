---
issue: NOR-23
title: 포트폴리오 항목 데이터화 + 외부 링크
status: done
---

# NOR-23 — 포트폴리오 항목 데이터화 + 외부 링크

홈이 portfolio 컬렉션의 제목·요약·스택을 정적 카드로 렌더한다. 링크 객체의 URL은 실제 앵커로
출력하며 외부 대상은 `target="_blank"`와 `rel="noopener noreferrer"`를 가진다.

## 검증

- 홈 산출물에서 블로그 v4 카드·GitHub 링크·보안 속성 확인
- `pnpm lint`, `pnpm build`, `pnpm format:check` 통과
- 구현 커밋: `b1761d8`
