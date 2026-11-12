---
issue: NOR-13
title: KaTeX 수식 + Mermaid 다이어그램
status: in-progress
---

# NOR-13 — KaTeX 수식 + Mermaid 다이어그램

> Linear: https://linear.app/noru-kim/issue/NOR-13

## 목표

markdown/markdoc 렌더 파이프라인 위에 수학 수식(KaTeX)과 다이어그램(Mermaid)을 얹어, 인라인/블록 수식 및 플로차트·시퀀스 다이어그램 등을 렌더링한다.

## 입력 / 출력

- 입력: `$...$` 인라인 수식, `$$...$$` 블록 수식, ` ```mermaid ` 코드 블럭
- 출력: KaTeX HTML로 렌더된 수식, Mermaid SVG 다이어그램

## 동작

### 수식 (.md 경로)

1. `remark-math`가 `$`/`$$` 구문을 math AST 노드로 파싱
2. `rehype-katex`가 math 노드를 KaTeX HTML로 변환
3. KaTeX CSS가 `<head>`에 로드되어 스타일 적용

### 수식 (.mdoc 경로)

- Markdoc은 remark/rehype 파이프라인을 거치지 않으므로, `{% math %}` 인라인 태그와 `{% mathblock %}` 블록 태그로 KaTeX 렌더링을 지원

### Mermaid (.md / .mdoc 공통)

- 클라이언트 아일랜드(`client:visible`)로 Mermaid 렌더링
- `<pre class="mermaid">` 또는 `<code class="language-mermaid">` 블럭을 감지하여 SVG로 변환
- CLS 방지를 위한 자리 예약(min-height) 적용

## 성공 / 실패 조건

- 성공: 인라인/블록 수식, Mermaid 다이어그램이 라이트/다크 모두에서 정상 렌더
- 실패: CLS 발생, 다크모드 미대응, 빌드 실패

## 엣지 케이스

- 수식 없는 페이지에서 KaTeX CSS 불필요 로드 (현 단계에서는 전역 로드 허용)
- Mermaid JS 미로드 시 원문 코드 블럭이 폴백으로 노출
- `prefers-reduced-motion` 시 Mermaid 애니메이션 비활성화

## 구현 계획 (plan)

1. ADR 작성 (0006 — Mermaid 렌더링 전략: 클라이언트 아일랜드)
2. 의존성 설치: `@astrojs/markdown-remark`, `remark-math`, `rehype-katex`, `katex`, `mermaid`
3. Astro 설정에 `unified()` 프로세서 + remark-math + rehype-katex 추가
4. BaseLayout에 KaTeX CSS 추가
5. KaTeX 다크모드 CSS 추가
6. Markdoc math/mathblock 태그 등록 + 컴포넌트
7. Mermaid 클라이언트 아일랜드 컴포넌트 작성 (islands/)
8. Mermaid용 Markdoc fence 처리 (language-mermaid 클래스 보존)
9. CLS 방지 스타일 추가
10. 스모크 테스트 페이지 작성
11. 빌드/린트 검증

## 완료 조건 (일감)

- [ ] 인라인/블록 수식 렌더 (remark-math + rehype-katex)
- [ ] KaTeX CSS 로드
- [ ] Mermaid 다이어그램 렌더
- [ ] 라이트/다크 테마 대응
- [ ] CLS 없이 안정 렌더
- [ ] .md 경로 지원
- [ ] .mdoc 경로 지원 (또는 한계 명시)
- [ ] 스모크 테스트 페이지
