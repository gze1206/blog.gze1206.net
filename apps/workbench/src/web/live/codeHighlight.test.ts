import { highlightingFor, ensureSyntaxTree, LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { EditorState } from '@codemirror/state';
import { tags } from '@lezer/highlight';
import { describe, expect, it } from 'vitest';

import { highlightSegments } from './codeHighlight.js';
import { livePreview, markdownLanguage } from './livePreview.js';

describe('코드 구문 강조 (NOR-229)', () => {
  it('NOR-229 AC-1: 편집기는 코드 블록 언어를 파싱하고 tok-* 강조 클래스를 붙인다', async () => {
    await LanguageDescription.matchLanguageName(languages, 'ts', true)?.load();
    const doc = '# 제목\n\n```ts\nconst answer = 42;\n```\n';
    const state = EditorState.create({ doc, extensions: [markdownLanguage(), livePreview()] });
    const tree = ensureSyntaxTree(state, doc.length, 5000);
    // 코드 블록의 언어 트리는 overlay 로 붙으므로 iterate 가 아니라 resolveInner 로 들어간다.
    expect(tree?.resolveInner(doc.indexOf('answer') + 1, 1).name).toBe('VariableDefinition');
    expect(highlightingFor(state, [tags.keyword])).toBe('tok-keyword');
  });

  it('NOR-229 AC-2: 알려진 언어는 강조 구간으로 나누고 모르는 언어는 null 이다', async () => {
    const code = 'const answer = "42"; // 답';
    const segments = await highlightSegments(code, 'ts');
    expect(segments).not.toBeNull();
    expect(segments?.map((segment) => segment.text).join('')).toBe(code);
    expect(segments).toContainEqual({ text: 'const', className: 'tok-keyword' });
    expect(segments?.some((segment) => segment.className.includes('tok-string'))).toBe(true);
    const csharp = await highlightSegments('public class A {}', 'csharp');
    expect(csharp).toContainEqual({ text: 'class', className: 'tok-keyword' });
    const ruby = await highlightSegments('puts 1', 'rb');
    expect(ruby).not.toBeNull();
    await expect(highlightSegments('x', 'no-such-language')).resolves.toBeNull();
    await expect(highlightSegments('x', '')).resolves.toBeNull();
  });
});
