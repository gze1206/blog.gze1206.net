/**
 * Astro 7에서 Keystatic UI 라우트만 주입한다.
 *
 * `@keystatic/astro`의 기본 API 라우트는 제거된 `Astro.locals.runtime.env`를 읽는다.
 * API는 `src/pages/api/keystatic/[...params].ts`가 Cloudflare Worker 환경에서 직접 제공한다.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import type { AstroIntegration } from 'astro';

export function keystaticWorker(): AstroIntegration {
  return {
    name: 'keystatic-worker',
    hooks: {
      'astro:config:setup': ({ config, injectRoute, updateConfig }) => {
        updateConfig({
          server: config.server.host ? {} : { host: '127.0.0.1' },
          vite: {
            plugins: [
              {
                name: 'keystatic-config',
                resolveId(id) {
                  return id === 'virtual:keystatic-config'
                    ? this.resolve('./keystatic.config', './a')
                    : null;
                },
              },
            ],
            optimizeDeps: { entries: ['keystatic.config.*', '.astro/keystatic-imports.js'] },
          },
        });

        const dotAstroDir = new URL('./.astro/', config.root);
        mkdirSync(dotAstroDir, { recursive: true });
        writeFileSync(
          new URL('keystatic-imports.js', dotAstroDir),
          'import "@keystatic/astro/ui";\nimport "@keystatic/core/ui";\n',
        );

        injectRoute({
          entrypoint: '@keystatic/astro/internal/keystatic-astro-page.astro',
          pattern: '/keystatic/[...params]',
          prerender: false,
        });
      },
    },
  };
}
