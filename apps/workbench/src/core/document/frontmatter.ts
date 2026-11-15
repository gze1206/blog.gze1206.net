import matter from 'gray-matter';
import { Document, Scalar, parse, visit } from 'yaml';

export interface ParsedFrontmatter {
  readonly data: Record<string, unknown>;
  readonly content: string;
}

export function parseFrontmatter(source: string): ParsedFrontmatter {
  if (!matter.test(source)) {
    throw new Error('Markdown document must contain YAML frontmatter');
  }

  const parsedMatter = matter(source, {
    engines: {
      yaml: (value: string) => parse(value) as object,
    },
  });

  if (!isRecord(parsedMatter.data)) {
    throw new Error('YAML frontmatter must be an object');
  }

  return { data: parsedMatter.data, content: parsedMatter.content };
}

export function serializeFrontmatter(
  orderedData: Record<string, unknown>,
  content: string,
): string {
  const yamlDocument = new Document(orderedData);
  visit(yamlDocument, {
    Seq(_key, node) {
      if (node.items.every((item) => item instanceof Scalar && typeof item.value === 'string')) {
        node.flow = true;
        for (const item of node.items) {
          if (item instanceof Scalar) item.type = Scalar.QUOTE_SINGLE;
        }
      }
    },
  });

  const yamlSource = yamlDocument
    .toString({ flowCollectionPadding: false, indent: 2, lineWidth: 0 })
    .trimEnd();
  return `---\n${yamlSource}\n---\n${content.replace(/^\n/, '')}`;
}

export function splitKnownFields(
  data: Record<string, unknown>,
  knownKeys: readonly string[],
): Record<string, unknown> {
  const known = new Set(knownKeys);
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => !known.has(key))
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function orderedFields(
  value: Record<string, unknown>,
  keys: readonly string[],
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const entries: Array<[string, unknown]> = [];
  const emitted = new Set<string>();
  for (const key of keys) {
    if (value[key] !== undefined) {
      entries.push([key, value[key]]);
      emitted.add(key);
    }
  }
  return Object.fromEntries([
    ...entries,
    ...Object.entries(extra)
      .filter(([key]) => !emitted.has(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  ]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
