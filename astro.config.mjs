// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import markdoc from '@astrojs/markdoc';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import cilGrammar from './src/shiki/langs/cil.tmLanguage.json';
import { codeBlockTransformers } from './src/shiki/transformers/index.ts';
import { rehypeHeadingAnchors } from './src/rehype/heading-anchors.ts';
import { ogImageAudit } from './src/integrations/og-image-audit.ts';
import { isSitemapPage } from './src/lib/sitemap.ts';
import { SHIKI_THEMES } from './src/shiki/themes.ts';

// https://astro.build/config
export default defineConfig({
  // canonical·sitemap·RSS·OG 절대 URL 이 전부 이 값을 전제로 한다 (NOR-27~30).
  site: 'https://gze1206.net',
  // trailing slash 없음이 이 사이트의 URL 정책이다 (ADR 0013). `src/lib/routes.ts` 가 만드는
  // 내부 링크(`/blog`, `/blog/2`)와 `src/lib/site-meta.ts` 가 만드는 canonical 이 같은 모양이라,
  // 여기까지 맞춰 두면 dev 서버·프로덕션·canonical 이 한 벌로 움직인다.
  trailingSlash: 'never',
  // `/career` 는 소개 페이지로 합쳐졌다(NOR-160). 이미 배포된 주소이므로 끊지 않고 넘긴다.
  redirects: {
    '/career': '/about',
  },
  // `ogImageAudit` 는 빌드 끝에 dist 의 og:image 참조가 실재하는지 확인만 한다(경고만, NOR-28).
  integrations: [sitemap({ filter: isSitemapPage }), markdoc(), react(), ogImageAudit()],
  markdown: {
    shikiConfig: {
      // 테마는 `src/shiki/themes.ts` 하나에서 온다 — `.mdoc` 경로도 같은 것을 쓴다.
      themes: SHIKI_THEMES,
      defaultColor: false,
      langs: [cilGrammar],
      transformers: codeBlockTransformers,
    },
    processor: unified({
      remarkPlugins: [remarkMath],
      // 헤딩 앵커(NOR-17)는 rehypeKatex 보다 **앞**이어야 한다. 뒤에 두면 수식이 MathML 로
      // 부풀어 오른 뒤라 헤딩 텍스트가 오염된 id 가 나온다. 자세한 순서 설명은 플러그인 주석 참고.
      // `.mdoc` 은 이 파이프라인을 타지 않는다 — markdoc.config.mjs 의 nodes.heading 이 짝이다.
      rehypePlugins: [rehypeHeadingAnchors, rehypeKatex],
    }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
