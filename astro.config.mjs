// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import markdoc from '@astrojs/markdoc';
import cilGrammar from './src/shiki/langs/cil.tmLanguage.json';

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
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
