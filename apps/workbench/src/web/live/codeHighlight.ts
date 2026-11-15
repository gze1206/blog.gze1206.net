/**
 * 코드 블록 구문 강조 (NOR-229).
 *
 * 편집기와 미리보기가 같은 파서(`@codemirror/language-data`, 필요할 때 불러옴)와 같은 클래스
 * (`classHighlighter` 의 `tok-*`)를 쓴다. 색은 styles.css 가 테마별로 정한다 — 인라인 스타일을
 * 만들지 않으므로 CSP 를 넓히지 않는다.
 */
import { LanguageDescription } from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { classHighlighter, highlightCode } from '@lezer/highlight';

/**
 * 코드 블록 정보 문자열에 맞는 언어. 별칭이 정확히 같을 때만 고른다 — 느슨하게 고르면 `text` 가
 * LaTeX 로 잡히는 식으로 엉뚱한 강조가 붙는다.
 */
export function codeLanguage(info: string): LanguageDescription | null {
  const name = info.trim().split(/\s/u)[0] ?? '';
  return name === '' ? null : LanguageDescription.matchLanguageName(languages, name, false);
}

export interface Segment {
  readonly text: string;
  /** 강조 클래스. 강조하지 않는 글자는 빈 문자열이다. */
  readonly className: string;
}

export async function highlightSegments(code: string, info: string): Promise<Segment[] | null> {
  const description = codeLanguage(info);
  if (!description) return null;
  const support = await description.load();
  const tree = support.language.parser.parse(code);
  const segments: Segment[] = [];
  highlightCode(
    code,
    tree,
    classHighlighter,
    (text, className) => segments.push({ text, className }),
    () => segments.push({ text: '\n', className: '' }),
  );
  return segments;
}

/** 미리보기의 `pre[data-language]` 를 강조 구간으로 다시 그린다. 글자는 textContent 로만 넣는다. */
export async function highlightPreview(root: HTMLElement): Promise<void> {
  for (const block of root.querySelectorAll<HTMLElement>('pre[data-language]')) {
    const code = block.textContent ?? '';
    const segments = await highlightSegments(code, block.dataset.language ?? '').catch(() => null);
    if (!segments || !block.isConnected || block.textContent !== code) continue;
    const fragment = document.createDocumentFragment();
    for (const segment of segments) {
      if (segment.className === '') {
        fragment.append(segment.text);
        continue;
      }
      const span = document.createElement('span');
      span.className = segment.className;
      span.textContent = segment.text;
      fragment.append(span);
    }
    block.replaceChildren(fragment);
  }
}
