/**
 * 문서 미리보기 (NOR-206). 블로그와 같은 Markdoc 문법으로 렌더한다(원시 HTML 없음).
 *
 * 블로그의 Astro 컴포넌트는 쓸 수 없으므로 블로그 태그는 비슷한 모양(링크·자리 표시)으로 그린다.
 * 정확한 모양은 발행 뒤 블로그에서 본다. `bookquote` 는 작업 공간의 책 문서로 실제 구절을 펼친다.
 */
import Markdoc, { type Config, type Node, type RenderableTreeNode } from '@markdoc/markdoc';
import { bookquoteTag } from '@gze1206/content-contract';

import { expandBookquotes, type BookLookup } from '../publishing/bookquote.js';

// @markdoc/markdoc 은 CommonJS 라 Node ESM 에서는 이름 있는 값 import(Tag)가 되지 않는다. 기본값에서 꺼낸다.
const { Tag } = Markdoc;
type Tag = InstanceType<typeof Tag>;

export interface PreviewResult {
  readonly html: string;
  readonly warnings: string[];
}

/** http(s)·mailto·상대 경로만 둔다. 나머지(javascript: 등)는 버린다. */
function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (/^(https?:|mailto:)/iu.test(trimmed)) return trimmed;
  if (!/^[a-z][a-z0-9+.-]*:/iu.test(trimmed) && !trimmed.startsWith('//')) return trimmed;
  return undefined;
}

function link(href: unknown, text: string): Tag {
  const url = safeUrl(href);
  return url === undefined ? new Tag('span', {}, [text]) : new Tag('a', { href: url }, [text]);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

const config: Config = {
  nodes: {
    link: {
      render: 'a',
      attributes: { href: { type: String }, title: { type: String } },
      transform(node: Node, cfg: Config) {
        const href = safeUrl(node.attributes['href']);
        const children = node.transformChildren(cfg);
        return href === undefined
          ? new Tag('span', {}, children)
          : new Tag('a', { href }, children);
      },
    },
    image: {
      render: 'img',
      attributes: { src: { type: String }, alt: { type: String }, title: { type: String } },
      transform(node: Node) {
        const src = safeUrl(node.attributes['src']);
        const alt = str(node.attributes['alt']) ?? '';
        return src === undefined
          ? new Tag('span', {}, [`[이미지: ${alt}]`])
          : new Tag('img', { src, alt });
      },
    },
  },
  tags: {
    bookquote: {
      ...bookquoteTag,
      transform(node: Node, cfg: Config) {
        const a = node.attributes as Record<string, unknown>;
        const caption = [
          Array.isArray(a['authors']) ? a['authors'].join(', ') : undefined,
          str(a['title']) === undefined ? undefined : `『${String(a['title'])}』`,
          Array.isArray(a['translators']) && a['translators'].length > 0
            ? `${a['translators'].join(', ')} 옮김`
            : undefined,
          str(a['publisher']),
          a['year'] === undefined ? undefined : String(a['year']),
          a['page'] === undefined ? undefined : `p. ${String(a['page'])}`,
        ].filter((part): part is string => part !== undefined);
        return new Tag('figure', { class: 'bookquote' }, [
          new Tag('blockquote', {}, node.transformChildren(cfg)),
          new Tag('figcaption', {}, [caption.join(', ')]),
        ]);
      },
    },
    callout: {
      attributes: { type: { type: String, default: 'note' }, title: { type: String } },
      transform(node: Node, cfg: Config) {
        const type = str(node.attributes['type']) ?? 'note';
        const title = str(node.attributes['title']);
        return new Tag('aside', { class: `callout callout--${type.replace(/[^a-z]/gu, '')}` }, [
          ...(title === undefined ? [] : [new Tag('p', { class: 'callout__title' }, [title])]),
          ...node.transformChildren(cfg),
        ]);
      },
    },
    bookmark: {
      selfClosing: true,
      attributes: {
        url: { type: String, required: true },
        title: { type: String },
        description: { type: String },
        image: { type: String },
        siteName: { type: String },
      },
      transform(node: Node) {
        const url = node.attributes['url'] as string;
        return new Tag('p', { class: 'embed' }, [
          '🔖 ',
          link(url, str(node.attributes['title']) ?? url),
        ]);
      },
    },
    github: {
      selfClosing: true,
      attributes: {
        repo: { type: String, required: true },
        description: { type: String },
        stars: { type: Number },
        language: { type: String },
      },
      transform(node: Node) {
        const repo = node.attributes['repo'] as string;
        return new Tag('p', { class: 'embed' }, ['⌥ ', link(`https://github.com/${repo}`, repo)]);
      },
    },
    math: {
      selfClosing: true,
      attributes: { formula: { type: String, required: true } },
      transform: (node: Node) =>
        new Tag('code', { class: 'math' }, [String(node.attributes['formula'])]),
    },
    mathblock: {
      selfClosing: true,
      attributes: { formula: { type: String, required: true } },
      transform: (node: Node) =>
        new Tag('pre', { class: 'math' }, [String(node.attributes['formula'])]),
    },
    youtube: {
      selfClosing: true,
      attributes: { id: { type: String, required: true }, title: { type: String } },
      transform(node: Node) {
        const id = String(node.attributes['id']);
        return new Tag('p', { class: 'embed' }, [
          '▶ ',
          link(
            `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
            str(node.attributes['title']) ?? `YouTube ${id}`,
          ),
        ]);
      },
    },
    video: {
      selfClosing: true,
      attributes: {
        src: { type: String, required: true },
        title: { type: String },
        poster: { type: String },
      },
      transform(node: Node) {
        return new Tag('p', { class: 'embed' }, [
          '🎞 ',
          link(node.attributes['src'], str(node.attributes['title']) ?? '영상'),
        ]);
      },
    },
    figure: {
      attributes: { caption: { type: String } },
      transform(node: Node, cfg: Config) {
        const caption = str(node.attributes['caption']);
        return new Tag('figure', {}, [
          ...node.transformChildren(cfg),
          ...(caption === undefined ? [] : [new Tag('figcaption', {}, [caption])]),
        ]);
      },
    },
  },
};

/** 맨 앞의 YAML frontmatter(`---` … `---`)를 뗀다. */
function body(source: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/u.exec(source);
  return match ? source.slice(match[0].length) : source;
}

export function renderPreview(
  source: string,
  options: { lookupBook?: BookLookup } = {},
): PreviewResult {
  const warnings: string[] = [];
  let text = body(source);
  if (/\{%\s*bookquote\b/u.test(text)) {
    try {
      text = expandBookquotes(text, options.lookupBook ?? (() => undefined)).body;
    } catch (error) {
      warnings.push(
        `인용(bookquote)을 펼치지 못했습니다: ${error instanceof Error ? error.message : String(error)}. 책 id·구절 id·공개 여부를 확인하세요.`,
      );
      text = text.replace(/\{%\s*bookquote\b[\s\S]*?%\}/gu, '`[인용을 펼칠 수 없음]`');
    }
  }
  const ast = Markdoc.parse(text);
  for (const error of Markdoc.validate(ast, config)) {
    if (error.error.level === 'error' || error.error.level === 'critical')
      warnings.push(
        `${error.lines.length > 0 ? `${error.lines[0] ?? 0}행: ` : ''}${error.error.message}`,
      );
  }
  const tree: RenderableTreeNode = Markdoc.transform(ast, config);
  return { html: Markdoc.renderers.html(tree), warnings };
}
