import type { Definition, Html, Image, ImageReference, Nodes, Parent, Root, Text } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toMarkdown } from 'mdast-util-to-markdown';

export interface AssetReferenceOccurrence {
  readonly reference: string;
  readonly start: number;
  readonly end: number;
  readonly render: (publicUrl: string) => string;
}

export function parseAssetReferences(content: string): readonly AssetReferenceOccurrence[] {
  const tree = fromMarkdown(content);
  const definitions = new Map<string, Definition>();
  const images: Image[] = [];
  const imageReferences: ImageReference[] = [];
  const textNodes: Text[] = [];
  const htmlNodes: Html[] = [];
  visit(tree, (node) => {
    if (node.type === 'definition' && !definitions.has(normalizeIdentifier(node.identifier))) {
      definitions.set(normalizeIdentifier(node.identifier), node);
    }
    if (node.type === 'image') images.push(node);
    if (node.type === 'imageReference') imageReferences.push(node);
    if (node.type === 'text') textNodes.push(node);
    if (node.type === 'html') htmlNodes.push(node);
  });

  const occurrences: AssetReferenceOccurrence[] = images
    .filter(({ url }) => isLocalReference(url))
    .map((node) =>
      nodeOccurrence(node, node.url, (publicUrl) => serializeNode({ ...node, url: publicUrl })),
    );

  const usedDefinitions = new Set<string>();
  for (const imageReference of imageReferences) {
    const identifier = normalizeIdentifier(imageReference.identifier);
    const definition = definitions.get(identifier);
    if (!definition) {
      occurrences.push({
        reference: `missing-definition:${identifier}`,
        start: -1,
        end: -1,
        render: () => '',
      });
    } else if (!usedDefinitions.has(identifier) && isLocalReference(definition.url)) {
      usedDefinitions.add(identifier);
      occurrences.push(
        nodeOccurrence(definition, definition.url, (publicUrl) =>
          serializeNode({ ...definition, url: publicUrl }),
        ),
      );
    }
  }

  for (const textNode of textNodes) {
    const rawText = sourceSlice(content, textNode);
    for (const match of rawText.matchAll(/(?<!\\)!\[([^\]]*)\]\[([^\]]*)\]/gu)) {
      const identifier = normalizeIdentifier(match[2] || match[1] || '');
      if (identifier && !definitions.has(identifier)) addMissingDefinition(occurrences, identifier);
    }
    for (const match of rawText.matchAll(/(?<!\\)!\[([^\]]+)\](?![[(])/gu)) {
      const identifier = normalizeIdentifier(match[1] ?? '');
      if (identifier && !definitions.has(identifier)) addMissingDefinition(occurrences, identifier);
    }
  }

  occurrences.push(...parseAttributeReferences(content, htmlNodes, textNodes));
  return deduplicate(occurrences);
}

function sourceSlice(content: string, node: Text | Html): string {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  return start === undefined || end === undefined ? node.value : content.slice(start, end);
}

function addMissingDefinition(occurrences: AssetReferenceOccurrence[], identifier: string): void {
  occurrences.push({
    reference: `missing-definition:${identifier}`,
    start: -1,
    end: -1,
    render: () => '',
  });
}

export function rewriteAssetReferences(
  content: string,
  replacements: ReadonlyMap<string, string>,
): string {
  const occurrences = parseAssetReferences(content)
    .filter(({ reference, start }) => start >= 0 && replacements.has(reference))
    .sort((left, right) => right.start - left.start);
  let result = content;
  for (const occurrence of occurrences) {
    const publicUrl = replacements.get(occurrence.reference);
    if (!publicUrl) continue;
    result = `${result.slice(0, occurrence.start)}${occurrence.render(publicUrl)}${result.slice(occurrence.end)}`;
  }
  return result;
}

function parseAttributeReferences(
  content: string,
  htmlNodes: readonly Html[],
  textNodes: readonly Text[],
): readonly AssetReferenceOccurrence[] {
  const occurrences: AssetReferenceOccurrence[] = [];
  for (const htmlNode of htmlNodes) {
    const nodeStart = htmlNode.position?.start.offset;
    if (nodeStart === undefined) continue;
    const rawHtml = sourceSlice(content, htmlNode);
    for (const tag of findHtmlTags(rawHtml)) {
      parseAttributes(tag.value, nodeStart + tag.start, false, occurrences);
    }
  }
  for (const textNode of textNodes) {
    const nodeStart = textNode.position?.start.offset;
    if (nodeStart === undefined) continue;
    const rawText = sourceSlice(content, textNode);
    for (const tag of findHtmlTags(rawText)) {
      parseAttributes(tag.value, nodeStart + tag.start, false, occurrences);
    }
    for (const match of rawText.matchAll(/(?<!\\)\{%[\s\S]*?%\}/gu)) {
      parseAttributes(match[0], nodeStart + (match.index ?? 0), true, occurrences);
    }
  }
  return occurrences;
}

function parseAttributes(
  source: string,
  absoluteStart: number,
  allowColon: boolean,
  occurrences: AssetReferenceOccurrence[],
): void {
  const separator = allowColon ? '(?:=|:)' : '=';
  const pattern = new RegExp(
    `\\b(srcset|src)\\s*${separator}\\s*(?:"([^"]+)"|'([^']+)'|([^\\s"'=<>\\x60]+))`,
    'giu',
  );
  for (const match of source.matchAll(pattern)) {
    const attribute = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (!attribute || !value) continue;
    const valueStart = absoluteStart + captureStart(match, value);
    if (attribute === 'srcset') addSourceSetOccurrences(value, valueStart, occurrences);
    else if (isLocalReference(value)) occurrences.push(spanOccurrence(value, valueStart));
  }
}

function captureStart(match: RegExpExecArray, value: string): number {
  return (match.index ?? 0) + match[0].lastIndexOf(value);
}

function addSourceSetOccurrences(
  sourceSet: string,
  absoluteStart: number,
  occurrences: AssetReferenceOccurrence[],
): void {
  let cursor = 0;
  while (cursor < sourceSet.length) {
    while (cursor < sourceSet.length && /[\s,]/u.test(sourceSet[cursor] ?? '')) cursor += 1;
    const referenceStart = cursor;
    while (cursor < sourceSet.length && !/[\s]/u.test(sourceSet[cursor] ?? '')) cursor += 1;
    const reference = sourceSet.slice(referenceStart, cursor).replace(/,+$/u, '');
    if (reference && isLocalReference(reference)) {
      occurrences.push(spanOccurrence(reference, absoluteStart + referenceStart));
    }
    while (cursor < sourceSet.length && sourceSet[cursor] !== ',') cursor += 1;
    if (cursor < sourceSet.length) cursor += 1;
  }
}

function findHtmlTags(
  source: string,
): readonly { readonly value: string; readonly start: number }[] {
  const tags: Array<{ value: string; start: number }> = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf('<', cursor);
    if (start < 0) break;
    if (start > 0 && source[start - 1] === '\\') {
      cursor = start + 1;
      continue;
    }
    if (source.startsWith('<!--', start)) {
      const commentEnd = source.indexOf('-->', start + 4);
      cursor = commentEnd < 0 ? source.length : commentEnd + 3;
      continue;
    }
    let quote = '';
    let end = start + 1;
    for (; end < source.length; end += 1) {
      const character = source[end] ?? '';
      if (quote) {
        if (character === quote) quote = '';
      } else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
    }
    if (end < source.length) tags.push({ value: source.slice(start, end + 1), start });
    cursor = end + 1;
  }
  return tags;
}

function spanOccurrence(reference: string, start: number): AssetReferenceOccurrence {
  return { reference, start, end: start + reference.length, render: (publicUrl) => publicUrl };
}

function nodeOccurrence(
  node: Image | Definition,
  reference: string,
  render: (publicUrl: string) => string,
): AssetReferenceOccurrence {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start === undefined || end === undefined)
    throw new Error('parsed asset node has no source offset');
  return { reference, start, end, render };
}

function serializeNode(node: Image | Definition): string {
  const root: Root = { type: 'root', children: [node] };
  return toMarkdown(root).trimEnd();
}

function visit(node: Nodes, visitor: (node: Nodes) => void): void {
  visitor(node);
  if ('children' in node) {
    for (const child of (node as Parent).children) visit(child, visitor);
  }
}

function normalizeIdentifier(identifier: string): string {
  return identifier.trim().replace(/\s+/gu, ' ').toLowerCase();
}

function isLocalReference(reference: string): boolean {
  return !/^(?:https?:|data:|#|\/\/)/iu.test(reference);
}

function deduplicate(
  occurrences: readonly AssetReferenceOccurrence[],
): readonly AssetReferenceOccurrence[] {
  const seen = new Set<string>();
  return occurrences.filter((occurrence) => {
    const key = `${occurrence.start}:${occurrence.end}:${occurrence.reference}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
