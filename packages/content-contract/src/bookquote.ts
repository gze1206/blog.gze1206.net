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
export function renderBookquote(source: BookquoteSource, text: string): string {
  if (
    text.includes('\0') ||
    Object.values(source).some((value) => JSON.stringify(value)?.includes('\\u0000'))
  ) {
    throw new Error('NUL is not supported');
  }
  const attributes = Object.entries(source)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  const escaped = text
    .replace(/\\/g, '\\\\')
    .replace(/\{%/g, '\\{%')
    .replace(/([&*_`[<])/g, '\\$1')
    .replace(/^(\s*)([#>-])/gm, '$1\\$2')
    .replace(/^(\s*\d+)\./gm, '$1\\.');
  return `{% bookquote ${attributes} %}\n${escaped}\n{% /bookquote %}\n`;
}
