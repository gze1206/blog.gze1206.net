---
number: '0001'
title: ESLint flat config 채택
status: accepted
date: 2026-07-20
related: [NOR-8]
---

# 0001. ESLint flat config 채택

## 맥락 (Context)

NOR-8에서 ESLint를 도입한다. ESLint 9부터 flat config(`eslint.config.*`)가 기본이 되었고, legacy `.eslintrc` 는 ESLint 10에서 제거 예정이다. 이 프로젝트는 신규 세팅이므로 두 형식 중 하나를 골라야 한다.

## 검토한 대안 (Options)

- **A안: flat config (`eslint.config.mjs`)** — ESLint 9+ 기본. 명시적 import·export, 타입 지원. `eslint-plugin-astro` 및 `typescript-eslint` 모두 flat config를 공식 지원.
- **B안: legacy (`.eslintrc.*`)** — ESLint 8 이하 형식. 친숙하지만 ESLint 10에서 제거 예정. 새 프로젝트에서 채택하면 조만간 마이그레이션 필요.

## 결정 (Decision)

**A안: flat config**를 채택한다.

## 근거 (Rationale)

- 신규 프로젝트이므로 레거시 호환 부담 없음.
- `eslint-plugin-astro`, `typescript-eslint` 모두 flat config 전용 헬퍼를 제공.
- ESLint 10에서 legacy 제거가 예고되어, legacy를 선택하면 재마이그레이션 비용이 발생.

## 영향 (Consequences)

- 긍정: 향후 ESLint 메이저 업그레이드 시 마이그레이션 불필요.
- 부정/비용: 팀원이 flat config에 익숙하지 않을 수 있으나, 신규 세팅이므로 학습 비용 미미.
- 후속 작업: 없음.
