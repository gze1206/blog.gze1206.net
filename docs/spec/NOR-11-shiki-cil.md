---
issue: NOR-11
title: Shiki + CIL(.NET) 커스텀 하이라이팅
status: in-progress
---

# NOR-11 — Shiki + CIL(.NET) 커스텀 하이라이팅

> Linear: https://linear.app/noru-kim/issue/NOR-11

## 목표

Astro 내장 Shiki를 구성하고, .NET CIL/MSIL용 TextMate grammar를 로드하여 \`\`\`cil 코드펜스가 라이트/다크 테마 모두에서 정상 하이라이팅되도록 한다. .md와 .mdoc(Markdoc) 양쪽 렌더 경로에서 동작해야 한다.

## 입력 / 출력

- 입력: \`\`\`cil 코드펜스가 포함된 .md 또는 .mdoc 파일
- 출력: Shiki가 CIL 문법을 인식하여 토큰별 색상이 적용된 `<pre><code>` HTML. 라이트/다크 테마 전환이 CSS 변수로 제어됨.

## 동작 / 상태 전이

1. **빌드타임**: Astro가 .md/.mdoc 파일의 코드펜스를 처리할 때, Shiki가 커스텀 CIL grammar를 사용해 토큰화
2. **렌더타임**: `themes: { light, dark }` + `defaultColor: false` 설정으로 CSS 변수 기반 듀얼 테마 출력
3. **브라우저**: `prefers-color-scheme` 미디어 쿼리 또는 data-theme 속성에 따라 라이트/다크 전환

## 성공 / 실패 조건

- 성공:
  - \`\`\`cil 코드펜스가 .md, .mdoc 양쪽에서 하이라이팅됨
  - CIL 지시어(.method/.class/.maxstack), 주요 opcode(ldarg/ldc/call/ret), 주석, 문자열, 숫자가 구분됨
  - 라이트/다크 테마 전환이 CSS 변수로 동작
  - `pnpm build` 성공, `pnpm lint` 통과
- 실패·예외:
  - 알 수 없는 언어로 폴백(하이라이팅 없음)
  - 빌드 에러
  - 한쪽 렌더 경로(.md 또는 .mdoc)에서만 동작

## 엣지 케이스

- 빈 코드블럭 (\`\`\`cil + 빈 내용)
- CIL이 아닌 일반 코드펜스(`ts, `js 등)가 영향받지 않아야 함
- grammar에 없는 opcode/지시어 → 일반 텍스트로 폴백(에러 아님)

## 검증 방법 (= TDD 테스트 목록)

- [ ] CIL grammar JSON이 Shiki langs에 정상 로드됨 (빌드 성공)
- [ ] .md 파일의 \`\`\`cil 코드펜스가 하이라이팅됨
- [ ] .mdoc 파일의 \`\`\`cil 코드펜스가 하이라이팅됨
- [ ] 기존 언어(ts, js 등) 코드펜스가 정상 동작
- [ ] 라이트/다크 테마 CSS 변수가 출력에 포함됨
- [ ] `pnpm build` 성공
- [ ] `pnpm lint` 통과

## 구현 계획 (plan)

1. ADR 0004 작성 — CIL grammar 출처(mg0x7BE/il-assembly-grammar, Unlicense) 및 듀얼 테마 방식 결정
2. CIL grammar JSON을 `src/shiki/` 디렉토리에 배치, 필요 시 Shiki 호환 조정(scopeName, name, aliases 추가)
3. `astro.config.mjs` — `markdown.shikiConfig` 설정: themes(light/dark), defaultColor: false, langs에 CIL grammar 로드
4. `markdoc.config.mjs` — `shiki()` 확장에 동일 설정 적용 (themes, langs, defaultColor)
5. `src/styles/global.css` — 다크모드 CSS 변수 전환 스타일 추가
6. 스모크 테스트용 콘텐츠 작성 — .md와 .mdoc에 \`\`\`cil 예시 포함
7. 빌드·린트 검증
8. 셀프 리뷰 루프

## 완료 조건 (일감)

- [ ] Astro Shiki 통합 구성 (markdown.shikiConfig)
- [ ] .NET CIL/MSIL용 TextMate grammar 확보 및 Shiki에 로드
- [ ] \`\`\`cil 코드펜스가 .md와 .mdoc 양쪽에서 정상 하이라이팅
- [ ] 라이트/다크 테마 대응 (듀얼 테마 + CSS 변수)
- [ ] 스모크: CIL 예시 포함 글/페이지로 하이라이팅·테마 전환 확인
- [ ] pnpm lint/build 통과
