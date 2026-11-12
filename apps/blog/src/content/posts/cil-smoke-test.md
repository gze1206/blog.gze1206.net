---
title: 'CIL 하이라이팅 스모크 테스트 (Markdown)'
description: 'Shiki + CIL 커스텀 하이라이팅이 .md 파일에서 정상 동작하는지 확인합니다.'
slug: 'cil-smoke-test'
category: 'dev'
tags: ['cil', 'shiki', 'test']
publishedAt: 2026-07-21
updatedAt: 2026-07-21
draft: true
---

# CIL 하이라이팅 테스트

## Hello World (CIL)

```cil
.assembly extern mscorlib {}
.assembly HelloWorld {}
.module HelloWorld.exe

.class public auto ansi beforefieldinit Program
  extends [mscorlib]System.Object
{
  .method public hidebysig static void Main(string[] args) cil managed
  {
    .entrypoint
    .maxstack 1

    // 콘솔에 "Hello, World!" 출력
    ldstr "Hello, World!"
    call void [mscorlib]System.Console::WriteLine(string)
    ret
  }
}
```

## 산술 연산 예제

```cil
.method public hidebysig static int32 Add(int32 a, int32 b) cil managed
{
  .maxstack 2

  ldarg.0       // a 로드
  ldarg.1       // b 로드
  add           // a + b
  ret
}
```

## 제어 흐름

```cil
.method public hidebysig static bool IsPositive(int32 x) cil managed
{
  .maxstack 2
  .locals init (bool result)

  ldarg.0
  ldc.i4.0
  bgt.s POSITIVE

  ldc.i4.0
  stloc.0
  br.s END

POSITIVE:
  ldc.i4.1
  stloc.0

END:
  ldloc.0
  ret
}
```

## 일반 TypeScript (영향받지 않아야 함)

```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```
