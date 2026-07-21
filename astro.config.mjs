// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import markdoc from '@astrojs/markdoc';
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
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
