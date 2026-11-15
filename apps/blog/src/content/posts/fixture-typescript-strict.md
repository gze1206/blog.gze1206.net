---
title: 'TypeScript strict 모드에서 자주 걸리는 것들'
description: 'strict 를 켜면 처음에 쏟아지는 오류들을 유형별로 정리합니다.'
slug: 'typescript-strict-tips'
category: 'dev'
tags: ['typescript']
publishedAt: 2026-05-02
updatedAt: 2026-05-02
draft: true
---

## exactOptionalPropertyTypes

선택 속성에 `undefined` 를 명시적으로 넣는 코드가 전부 오류가 된다.
타입에 `| undefined` 를 붙일지, 아예 속성을 빼둘지 정해야 한다.

> 이 글의 파일명은 `fixture-typescript-strict.md` 지만 URL 은 프론트매터 slug 를 따른다.
