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
    // 커스텀 블럭(NOR-15). 속성 스키마는 NOR-20(Keystatic 삽입 UI)이 그대로 매핑한다.
    // 의미·동작은 docs/spec/NOR-15-custom-blocks.md, 데이터 취득 전략은 ADR 0008 참고.
    bookmark: {
      render: component('./src/components/markdoc/Bookmark.astro'),
      selfClosing: true,
      attributes: {
        // 북마크 대상 절대 URL(http/https). 그 외 스킴은 폴백 렌더.
        url: { type: String, required: true },
        // 아래 4개는 작성자 오버라이드. title 을 명시하면 빌드타임 fetch 를 건너뛴다.
        title: { type: String, required: false },
        description: { type: String, required: false },
        image: { type: String, required: false },
        siteName: { type: String, required: false },
      },
    },
    github: {
      render: component('./src/components/markdoc/GitHub.astro'),
      selfClosing: true,
      attributes: {
        // `owner/name` 또는 GitHub URL. 형식 위반은 폴백 렌더.
        repo: { type: String, required: true },
        // 아래 3개는 작성자 오버라이드. description 을 명시하면 fetch 를 건너뛴다.
        description: { type: String, required: false },
        stars: { type: Number, required: false },
        language: { type: String, required: false },
      },
    },
    callout: {
      render: component('./src/components/markdoc/Callout.astro'),
      selfClosing: false,
      attributes: {
        type: {
          type: String,
          required: false,
          default: 'note',
          matches: ['note', 'info', 'tip', 'success', 'warning', 'danger'],
        },
        // 없으면 타입 기본 라벨(참고/정보/팁/성공/주의/위험)이 헤더에 노출된다.
        title: { type: String, required: false },
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
