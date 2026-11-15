import { z } from 'zod';

import {
  orderedFields,
  parseFrontmatter,
  serializeFrontmatter,
  splitKnownFields,
} from '../document/frontmatter.js';
import { assertSupportedKind, type DocumentKind } from '../document/document.js';

export const templateKinds = [
  'capture',
  'private-post',
  'public-draft',
  'weekly-review',
  'monthly-review',
] as const;

export type TemplateKind = (typeof templateKinds)[number];

const templateSchema = z.object({
  title: z.string().min(1),
  kind: z.enum(templateKinds),
  defaultPath: z.string().min(1),
  publicEligible: z.boolean(),
});

const knownKeys = ['title', 'kind', 'defaultPath', 'publicEligible'] as const;

export interface Template {
  readonly title: string;
  readonly kind: TemplateKind;
  readonly defaultPath: string;
  readonly publicEligible: boolean;
  readonly content: string;
  readonly extra: Record<string, unknown>;
}

export function parseTemplate(source: string): Template {
  const { data, content } = parseFrontmatter(source);
  assertSupportedKind(data.kind, templateKinds, 'template');
  const recognized = templateSchema.parse(data);
  assertSafeDefaultPath(recognized.defaultPath);
  return { ...recognized, content, extra: splitKnownFields(data, knownKeys) };
}

export function serializeTemplate(template: Template): string {
  return serializeFrontmatter(
    orderedFields(template as unknown as Record<string, unknown>, knownKeys, template.extra),
    template.content,
  );
}

export function isTemplateKind(value: DocumentKind): value is TemplateKind {
  return templateKinds.includes(value as TemplateKind);
}

function assertSafeDefaultPath(value: string): void {
  if (
    value.startsWith('/') ||
    /^[A-Za-z]:[\\/]/u.test(value) ||
    value.includes('\\') ||
    value.split('/').some((segment) => segment === '..' || segment === '.' || segment === '')
  ) {
    throw new Error('template defaultPath must be a safe workspace-relative path');
  }
}
