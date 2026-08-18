---
title: '시리즈 내비게이션 픽스처 1편 — 첫 편'
description: '시리즈의 첫 편입니다. 이전 편이 없고, 다음 편은 draft 인 2편을 건너뛰어 3편이 되어야 합니다.'
slug: 'fixture-series-nav-1'
category: 'dev'
tags: ['test', 'series']
series: 'series-nav-fixture'
seriesOrder: 1
publishedAt: 2026-07-22
updatedAt: 2026-07-22
draft: true
---

시리즈 내비게이션(NOR-18)의 draft 처리를 **빌드 산출물에서 직접 확인**하기 위한 픽스처입니다.

이 시리즈는 세 편으로 이루어져 있고, 그중 2편이 `draft: true` 입니다. 프로덕션 빌드에는
2편의 페이지가 아예 만들어지지 않으므로, 1편의 "다음 편"을 `seriesOrder + 1` 로 구하면
없는 페이지를 가리키게 됩니다. 아래 시리즈 내비게이션의 "다음 편"이 **3편**을 가리키고
진행도가 **1 / 2** 로 나오면 의도대로 동작하는 것입니다.

개발 서버(`pnpm dev`)에서는 draft 가 보이므로 같은 자리에 2편이 나오고 진행도는 `1 / 3` 입니다.
입력이 다르기 때문이며, 한 페이지 안에서 목록·이전/다음·진행도는 언제나 같은 기준을 씁니다.
