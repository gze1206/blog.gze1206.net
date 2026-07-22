---
title: 'Cloudflare Pages에 정적 사이트 배포하기'
description: '빌드 산출물을 Cloudflare Pages로 올리고 커스텀 도메인을 붙이는 과정을 정리합니다.'
slug: 'astro-deploy-cloudflare'
category: 'dev'
tags: ['astro', 'cloudflare']
series: 'astro-guide'
seriesOrder: 3
publishedAt: 2026-06-08
updatedAt: 2026-06-08
---

## 빌드 설정

빌드 명령은 `pnpm build`, 출력 디렉터리는 `dist` 다.

## 도메인 연결

DNS 를 Cloudflare 로 옮겨두면 도메인 연결이 클릭 몇 번으로 끝난다.
