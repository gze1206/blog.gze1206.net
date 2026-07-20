---
number: '0004'
title: CIL 하이라이팅 — grammar 출처 및 테마 전략
status: accepted
date: 2026-07-21
related: [NOR-11]
---

# 0004. CIL 하이라이팅 — grammar 출처 및 테마 전략

## 맥락 (Context)

NOR-11은 .NET CIL(Common Intermediate Language) 코드의 구문 하이라이팅을 구현해야 한다. 핵심 결정 두 가지:

1. **CIL TextMate grammar를 어디서 가져올 것인가** — 기존 공개 grammar 채택 vs 자체 작성
2. **다크/라이트 테마를 어떻게 대응할 것인가** — Shiki 듀얼 테마(CSS 변수) vs 단일 테마

## 검토한 대안 (Options)

### Grammar 출처

- **A안: mg0x7BE/il-assembly-grammar 채택** — GitHub Linguist가 사용하는 grammar. Unlicense(퍼블릭 도메인). 293줄, 지시어·opcode·주석·문자열·숫자·라벨·어셈블리 참조 등 포괄적. `.tmLanguage.json` 형식으로 Shiki에 직접 로드 가능. / 단점: 외부 의존(업스트림 변경 시 수동 동기화)
- **B안: wk-j/vscode-cil-complete 채택** — VS Code 확장. 89줄, 최소한의 커버리지(~12 opcode만). / 단점: 라이선스 미명시, 품질 부족
- **C안: 자체 작성** — 프로젝트 요구에 맞게 처음부터 작성. / 단점: 개발·유지보수 비용 높음, 기존 고품질 grammar가 있는데 재발명할 이유 없음

### 테마 전략

- **A안: Shiki 듀얼 테마 (themes: { light, dark }) + CSS 변수** — `defaultColor: false`로 CSS 변수 출력, `prefers-color-scheme` 미디어 쿼리로 전환. Astro 공식 문서 권장 방식. / 단점: CSS 추가 필요
- **B안: 단일 테마** — 라이트 또는 다크 하나만. / 단점: 테마 전환 불가, NOR-25(다크모드 토글)와의 정합 불가

## 결정 (Decision)

1. **mg0x7BE/il-assembly-grammar (Unlicense)를 채택**하여 `src/shiki/langs/` 디렉토리에 배치한다.
2. **Shiki 듀얼 테마 + CSS 변수 방식**을 사용한다. 테마는 `github-light` / `github-dark`를 기본으로 하되, NOR-24(베이스 테마 채택) 시 변경 가능.

## 근거 (Rationale)

- **Grammar**: A안은 품질(GitHub Linguist 채택), 라이선스(퍼블릭 도메인 — 제약 없음), 포맷(Shiki 직접 호환) 세 기준 모두 최선. 자체 작성은 비용 대비 이점 없음.
- **테마**: 듀얼 테마는 Astro/Shiki 공식 권장이며, NOR-25(다크모드 토글)와 자연스럽게 연동. `defaultColor: false`로 CSS 변수만 출력하면 향후 테마 교체도 CSS만으로 가능.

## 영향 (Consequences)

- 긍정: CIL 하이라이팅 즉시 사용 가능, 라이선스 리스크 없음, 라이트/다크 전환이 JS 없이 CSS만으로 동작
- 부정/비용: grammar 업스트림 변경 시 수동 동기화 필요(빈도 낮음, 안정된 언어 사양)
- 후속 작업: NOR-24(테마 채택)에서 Shiki 테마를 브랜딩에 맞게 교체 가능, NOR-25(다크모드 토글)에서 `data-theme` 속성 연동 추가
