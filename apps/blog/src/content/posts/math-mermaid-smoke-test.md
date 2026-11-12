---
title: '수식·다이어그램 스모크 테스트 (Markdown)'
description: 'KaTeX 수식과 Mermaid 다이어그램이 .md 파일에서 정상 동작하는지 확인합니다.'
slug: 'math-mermaid-smoke-test'
category: 'dev'
tags: ['katex', 'mermaid', 'test']
publishedAt: 2026-07-21
updatedAt: 2026-07-21
draft: true
---

# 수식 테스트

## 인라인 수식

아인슈타인의 유명한 공식 $E = mc^2$ 은 질량-에너지 등가를 나타낸다.

이차방정식의 근의 공식은 $x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$ 이다.

## 블록 수식

오일러 항등식:

$$
e^{i\pi} + 1 = 0
$$

가우스 적분:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

행렬 표현:

$$
\begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
\begin{pmatrix}
x \\
y
\end{pmatrix}
=
\begin{pmatrix}
ax + by \\
cx + dy
\end{pmatrix}
$$

# 다이어그램 테스트

## 플로차트

```mermaid
flowchart TD
    A[시작] --> B{조건 확인}
    B -->|참| C[처리 A]
    B -->|거짓| D[처리 B]
    C --> E[종료]
    D --> E
```

## 시퀀스 다이어그램

```mermaid
sequenceDiagram
    participant U as 사용자
    participant B as 브라우저
    participant S as 서버
    U->>B: 페이지 요청
    B->>S: HTTP GET
    S-->>B: HTML 응답
    B-->>U: 렌더링 완료
```

# 혼합 테스트

수식 $f(x) = \sum_{n=0}^{\infty} \frac{f^{(n)}(a)}{n!}(x-a)^n$ 과 다이어그램이 같은 페이지에서 공존하는지 확인한다.
