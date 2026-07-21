// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import markdoc from '@astrojs/markdoc';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import cilGrammar from './src/shiki/langs/cil.tmLanguage.json';
import { codeBlockTransformers } from './src/shiki/transformers/index.ts';

// https://astro.build/config
export default defineConfig({
  integrations: [markdoc()],
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
      langs: [cilGrammar],
      transformers: codeBlockTransformers,
    },
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
