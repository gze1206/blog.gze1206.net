export interface LegacyPostMetadata {
  title: string;
  slug: string;
  date: string;
  category: string;
  tags: string[];
}

/** Convert Nuxt-only body markers to Markdown/Markdoc-compatible syntax. */
export function normalizeLegacyPostBody(body: string): string {
  return body
    .replaceAll('<!--more-->', '')
    .replaceAll(/^:br[ \t]*$/gm, '')
    .replaceAll(/^```([^\n\x5b]+)\[([^\n\x5d]+)]/gm, '```$1 title="$2"')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

export function legacyDateToPostDates(date: string): {
  publishedAt: string;
  updatedAt: string;
} {
  return { publishedAt: date, updatedAt: date };
}

export function assertLegacyPostMetadata(metadata: LegacyPostMetadata): void {
  const values = metadata as unknown as Record<string, unknown>;

  for (const field of ['title', 'slug', 'date', 'category']) {
    if (typeof values[field] !== 'string' || values[field].trim() === '') {
      throw new Error(`Legacy post metadata requires ${field}`);
    }
  }

  if (!Array.isArray(values.tags) || values.tags.length === 0) {
    throw new Error('Legacy post metadata requires tags');
  }
}
