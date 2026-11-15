export interface BookquoteSource {
  book: string;
  title: string;
  authors: string[];
  translators: string[];
  publisher?: string;
  year?: number;
  page?: number;
}
export const bookquoteTag = {
  attributes: {
    book: { type: String, required: true },
    title: { type: String, required: true },
    authors: { type: Array, required: true },
    translators: { type: Array, required: true },
    publisher: { type: String },
    year: { type: Number },
    page: { type: Number },
  },
};
/** 펼친 태그의 속성 순서. 같은 출처는 언제나 같은 문자열이 된다. */
const BOOKQUOTE_ATTRIBUTE_ORDER = [
  'book',
  'title',
  'authors',
  'translators',
  'publisher',
  'year',
  'page',
] as const satisfies readonly (keyof BookquoteSource)[];

export function renderBookquote(source: BookquoteSource, text: string): string {
  const hasControl = (value: unknown): boolean =>
    typeof value === 'string'
      ? /\p{Cc}/u.test(value)
      : Array.isArray(value) && value.some(hasControl);
  if (
    [...text].some(
      (character) => character !== '\n' && character !== '\t' && /\p{Cc}/u.test(character),
    ) ||
    Object.values(source).some(hasControl)
  ) {
    throw new Error('control character is not supported');
  }
  const attributes = BOOKQUOTE_ATTRIBUTE_ORDER.filter((key) => source[key] !== undefined)
    .map((key) => `${key}=${JSON.stringify(source[key])}`)
    .join(' ');
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/\{%/g, '\\{%')
    .replace(/([&*_`[<~|])/g, '\\$1')
    .replace(/^(\s*)([#>+=-])/gm, '$1\\$2')
    .replace(/^(\s*\d+)([.)])/gm, '$1\\$2');
  return `{% bookquote ${attributes} %}\n${escaped}\n{% /bookquote %}\n`;
}
