import { defineMarkdocConfig, component } from '@astrojs/markdoc/config';
import shiki from '@astrojs/markdoc/shiki';
import cilGrammar from './src/shiki/langs/cil.tmLanguage.json';

export default defineMarkdocConfig({
  extends: [
    await shiki({
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      defaultColor: false,
      langs: [cilGrammar],
    }),
  ],
  tags: {
    bookmark: {
      render: component('./src/components/markdoc/Bookmark.astro'),
      attributes: {
        url: { type: String, required: true },
        title: { type: String },
        description: { type: String },
        image: { type: String },
      },
    },
    github: {
      render: component('./src/components/markdoc/GitHub.astro'),
      attributes: {
        repo: { type: String, required: true },
        description: { type: String },
      },
    },
    callout: {
      render: component('./src/components/markdoc/Callout.astro'),
      attributes: {
        type: {
          type: String,
          default: 'note',
          matches: ['note', 'warning', 'error', 'info', 'tip'],
        },
        title: { type: String },
      },
    },
  },
});
