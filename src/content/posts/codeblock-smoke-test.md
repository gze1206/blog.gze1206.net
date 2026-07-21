---
title: '코드블럭 강화 스모크 테스트 (Markdown)'
description: '복사 버튼·파일명·라인 하이라이트·diff가 .md 파일에서 정상 동작하는지 확인합니다.'
slug: 'codeblock-smoke-test'
category: 'dev'
tags: ['codeblock', 'shiki', 'test']
publishedAt: 2026-07-21
updatedAt: 2026-07-21
draft: true
---

# 코드블럭 강화 테스트

## 파일명 라벨

```ts title="src/utils/greet.ts"
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

## 라인 하이라이트

```typescript
function fibonacci(n: number): number {
  if (n <= 1) return n; // [!code highlight]
  return fibonacci(n - 1) + fibonacci(n - 2); // [!code highlight]
}
```

## Diff 표기

```typescript
function createUser(name: string) {
  return {
    name,
    role: 'viewer', // [!code --]
    role: 'editor', // [!code ++]
    createdAt: new Date(), // [!code ++]
  };
}
```

## 파일명 + 하이라이트 + Diff 조합

```ts title="src/config.ts"
export const config = {
  apiUrl: 'https://api.example.com', // [!code --]
  apiUrl: 'https://api.v2.example.com', // [!code ++]
  timeout: 5000,
  retries: 3, // [!code highlight]
};
```

## 복사 버튼 (모든 코드블럭에 표시)

```bash
pnpm build && pnpm preview
```

## CIL 코드 (커스텀 언어에서도 동작 확인)

```cil title="hello.il"
.assembly extern mscorlib {}
.assembly Hello {}

.method public hidebysig static void Main() cil managed
{
  .entrypoint
  .maxstack 1
  ldstr "Hello from CIL!" // [!code highlight]
  call void [mscorlib]System.Console::WriteLine(string)
  ret
}
```
