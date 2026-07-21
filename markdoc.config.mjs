import { defineMarkdocConfig, component, nodes } from '@astrojs/markdoc/config';
import { createHighlighter } from 'shiki';
import Markdoc from '@markdoc/markdoc';
import { unescapeHTML } from 'astro/runtime/server/index.js';
import cilGrammar from './src/shiki/langs/cil.tmLanguage.json';
import { codeBlockTransformers } from './src/shiki/transformers/index.ts';

const themes = { light: 'github-light', dark: 'github-dark' };

const highlighter = await createHighlighter({
  themes: Object.values(themes),
  langs: ['plaintext', cilGrammar],
});

export default defineMarkdocConfig({
  nodes: {
    image: {
      ...nodes.image,
      render: component('./src/components/markdoc/MarkdocImage.astro'),
    },
    fence: {
      attributes: Markdoc.nodes.fence.attributes,
      async transform({ attributes }) {
        const raw = typeof attributes.language === 'string' ? attributes.language : '';
        let lang = raw;
        let meta = '';

        const titleMatch = raw.match(/\btitle="([^"]+)"/);
        if (titleMatch) {
          meta = titleMatch[0];
          lang = raw.replace(titleMatch[0], '').trim();
        }

        if (!lang) lang = 'plaintext';

        const loadedLangs = highlighter.getLoadedLanguages();
        if (!loadedLangs.includes(lang)) {
          try {
            await highlighter.loadLanguage(lang);
          } catch {
            lang = 'plaintext';
          }
        }

        const code = attributes.content.replace(/(?:\r\n|\r|\n)$/, '');
        const html = highlighter.codeToHtml(code, {
          lang,
          themes,
          defaultColor: false,
          meta: meta ? { __raw: meta } : undefined,
          transformers: [
            {
              pre(node) {
                const cls = node.properties.class;
                const classValue = Array.isArray(cls) ? cls.join(' ') : String(cls || '');
                node.properties.class = classValue.replace(/shiki/g, 'astro-code');
                node.properties.dataLanguage = lang;
                const style = node.properties.style;
                const styleValue = Array.isArray(style) ? style.join(';') : String(style || '');
                node.properties.style = styleValue + '; overflow-x: auto;';
              },
            },
            ...codeBlockTransformers,
          ],
        });
        return unescapeHTML(html);
      },
    },
  },
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
    math: {
      render: component('./src/components/markdoc/Math.astro'),
      attributes: {
        formula: { type: String, required: true },
      },
      selfClosing: true,
    },
    mathblock: {
      render: component('./src/components/markdoc/MathBlock.astro'),
      attributes: {
        formula: { type: String, required: true },
      },
      selfClosing: true,
    },
    youtube: {
      render: component('./src/islands/YouTubeEmbed.astro'),
      attributes: {
        id: { type: String, required: true },
        title: { type: String },
      },
      selfClosing: true,
    },
    video: {
      render: component('./src/components/markdoc/Video.astro'),
      attributes: {
        src: { type: String, required: true },
        title: { type: String },
        poster: { type: String },
      },
      selfClosing: true,
    },
    figure: {
      render: component('./src/components/markdoc/Figure.astro'),
      attributes: {
        caption: { type: String },
      },
    },
  },
});
