/**
 * Keystatic 어드민을 **개발 서버에서만** 붙이는 래퍼 통합 (NOR-19, ADR 0012).
 *
 * `@keystatic/astro` 는 `/keystatic/[...params]` 와 `/api/keystatic/[...params]` 를
 * `prerender: false` 로 주입한다. 정적 출력(`output` 미지정)에 온디맨드 라우트가 하나라도
 * 섞이면 Astro 는 어댑터를 요구하고, 어댑터를 붙이는 순간 이 블로그는 정적 사이트가 아니게
 * 된다. 그래서 통합 자체를 `command === 'dev'` 일 때만 등록한다.
 *
 * - `astro dev` — 어드민이 붙는다. 로컬 모드라 파일시스템에 바로 쓴다.
 * - `astro build` / `preview` / `sync` — 통합이 아예 로드되지 않는다. 따라서 dist 에
 *   keystatic 라우트도, React 런타임도 들어가지 않는다.
 *
 * `updateConfig({ integrations })` 로 통합을 추가하면 Astro 가 그 통합의 `astro:config:setup`
 * 까지 이어서 실행한다(설정 배열을 순회하는 도중 길이가 늘어나는 것을 그대로 따라간다).
 * React 통합은 Keystatic 어드민(React) 을 띄우기 위한 것이며, 같은 이유로 dev 에서만 붙는다.
 *
 * import 는 **정적**이어야 한다. 설정 파일은 Vite 모듈 러너로 읽히는데, 훅이 실행될 즈음엔
 * 그 러너가 이미 닫혀 있어서 훅 안에서 `await import(...)` 를 하면 터진다. 단순히 모듈을
 * 불러오는 것만으로는 아무 일도 일어나지 않는다 — 라우트를 주입하는 것은 `keystatic()` 을
 * **호출**하는 쪽이고, 그 호출이 dev 로 막혀 있다.
 */

import react from '@astrojs/react';
import keystatic from '@keystatic/astro';
import type { AstroIntegration } from 'astro';

export function keystaticDev(): AstroIntegration {
  return {
    name: 'keystatic-dev-only',
    hooks: {
      'astro:config:setup': ({ command, updateConfig, logger }) => {
        if (command !== 'dev') return;

        updateConfig({ integrations: [react(), keystatic()] });
        logger.info('어드민 UI: /keystatic (개발 서버 전용)');
      },
    },
  };
}
