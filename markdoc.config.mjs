import { defineMarkdocConfig, component, nodes } from '@astrojs/markdoc/config';
import { createHighlighter } from 'shiki';
import Markdoc from '@markdoc/markdoc';
import { unescapeHTML } from 'astro/runtime/server/index.js';
import cilGrammar from './src/shiki/langs/cil.tmLanguage.json';
import { codeBlockTransformers } from './src/shiki/transformers/index.ts';
import { createHeadingIdFactory } from './src/lib/heading-id.ts';
import { HEADING_ANCHOR_CLASS, headingAnchorLabel } from './src/lib/heading-anchor.ts';
import { collectMdocFenceLanguages } from './src/shiki/fence-languages.ts';

const themes = { light: 'github-light', dark: 'github-dark' };

/**
 * `.mdoc` 본문이 실제로 쓰는 코드블럭 언어를 **미리** 로드한다 (NOR-17).
 *
 * 그래야 아래 `fence` 트랜스폼을 **동기**로 유지할 수 있다. 트랜스폼이 하나라도 Promise 를
 * 돌려주면 `Markdoc.transform()` 전체가 Promise 가 되고, `@astrojs/markdoc` 의 헤딩 수집기가
 * 그 결과를 동기로 훑다가 아무것도 못 찾는다 → **코드블럭이 있는 `.mdoc` 글의 목차가 통째로
 * 사라진다.** 왜 이런 구조인지는 `src/shiki/fence-languages.ts` 주석에 자세히 적어 두었다.
 */
const contentLangs = await collectMdocFenceLanguages();

const highlighter = await createHighlighter({
  themes: Object.values(themes),
  langs: ['plaintext', cilGrammar],
});

for (const lang of contentLangs) {
  if (highlighter.getLoadedLanguages().includes(lang)) continue;
  try {
    await highlighter.loadLanguage(lang);
  } catch {
    // shiki 가 모르는 언어. 트랜스폼이 plaintext 로 처리한다(기존 동작과 같다).
  }
}

/** Markdoc 트리에서 사람이 읽는 텍스트만 모은다(속성값은 본문이 아니다). */
function textContentOf(children) {
  let text = '';
  for (const child of children) {
    if (typeof child === 'string' || typeof child === 'number') text += child;
    else if (Markdoc.Tag.isTag(child)) text += textContentOf(child.children);
  }
  return text;
}

/**
 * 문서 하나 몫의 헤딩 id 발급기를 `config.ctx` 에 달아 둔다.
 *
 * `@astrojs/markdoc` 은 렌더할 때마다, 그리고 `headings` 를 모을 때마다 config 를 새로
 * 조립한다(`ctx` 도 매번 새 객체다). 그래서 여기에 붙이면 **문서 단위**로 상태가 격리되고,
 * 같은 문서의 렌더 결과와 `headings` 는 같은 id 를 본다.
 */
function headingIdFactoryOf(config) {
  const ctx = (config.ctx ??= {});
  ctx.headingIdFactory ??= createHeadingIdFactory();
  return ctx.headingIdFactory;
}

export default defineMarkdocConfig({
  nodes: {
    /**
     * 헤딩 id + 앵커 링크 (NOR-17, ADR 0010).
     *
     * `@astrojs/markdoc` 의 기본 heading 노드는 github-slugger 로 id 를 만든다. 그러면
     * `.md`(rehype) 와 규칙이 갈라지고, 카테고리·태그 슬러그(`src/lib/slug.ts`)와도 어긋난다.
     * 헤딩 id 는 공유되는 영구 주소라 그런 분기를 남겨둘 수 없어서 통째로 갈아끼운다.
     *
     * 앵커는 자식이 없는 `<a>` 다 — 텍스트를 넣으면 `headings`(= TOC 입력) 의 text 가 오염된다.
     */
    heading: {
      children: ['inline'],
      attributes: {
        // Markdoc 은 `## 제목 {% #custom-id %}` 로 id 를 직접 지정할 수 있다. 그건 존중한다.
        id: { type: String },
        level: { type: Number, required: true, default: 1 },
      },
      transform(node, config) {
        const { level, ...attributes } = node.transformAttributes(config);
        const children = node.transformChildren(config);
        const text = textContentOf(children);
        const id =
          typeof attributes.id === 'string' && attributes.id.length > 0
            ? attributes.id
            : headingIdFactoryOf(config)(text);

        const anchor = new Markdoc.Tag(
          'a',
          { class: HEADING_ANCHOR_CLASS, href: `#${id}`, 'aria-label': headingAnchorLabel(text) },
          [],
        );

        return new Markdoc.Tag(`h${level}`, { ...attributes, id }, [...children, anchor]);
      },
    },
    image: {
      ...nodes.image,
      render: component('./src/components/markdoc/MarkdocImage.astro'),
    },
    fence: {
      attributes: Markdoc.nodes.fence.attributes,
      /**
       * **동기 트랜스폼이어야 한다** (NOR-17). async 로 되돌리면 이 글의 목차가 조용히 사라진다.
       * 이유는 파일 위쪽 `collectMdocFenceLanguages` 주석 참고.
       */
      transform({ attributes }) {
        const raw = typeof attributes.language === 'string' ? attributes.language : '';
        let lang = raw;
        let meta = '';

        const titleMatch = raw.match(/\btitle="([^"]+)"/);
        if (titleMatch) {
          meta = titleMatch[0];
          lang = raw.replace(titleMatch[0], '').trim();
        }

        if (!lang) lang = 'plaintext';

        // 쓰이는 언어는 위에서 전부 미리 로드했다. 그래도 없으면(콘텐츠 스캔 이후에 추가된
        // 언어 등) 조용히 죽지 않고 plaintext 로 떨어뜨린다.
        if (!highlighter.getLoadedLanguages().includes(lang)) {
          console.warn(
            `[NOR-17] Markdoc 코드블럭 언어 '${lang}' 가 로드돼 있지 않아 plaintext 로 렌더합니다. ` +
              `개발 서버라면 재시작하면 반영됩니다.`,
          );
          lang = 'plaintext';
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
