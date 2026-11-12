import type { WorkbenchDocument } from '../document/document.js';
import type { Template } from './template.js';
import { substituteTemplateTokens, type TemplateTokens } from './tokens.js';

export function instantiateTemplate(
  template: Template,
  title: string,
  tokens: TemplateTokens,
): WorkbenchDocument {
  const generatedFields = new Set(['title', 'kind', 'createdAt', 'updatedAt', 'date', 'period']);
  const kindFields =
    template.kind === 'public-draft'
      ? { publicEligible: true as const }
      : template.kind === 'weekly-review' || template.kind === 'monthly-review'
        ? { period: tokens.period }
        : {};

  return {
    title,
    kind: template.kind,
    createdAt: tokens.date,
    updatedAt: tokens.date,
    ...kindFields,
    content: substituteTemplateTokens(template.content, tokens),
    extra: Object.fromEntries(
      Object.entries(template.extra).filter(([key]) => !generatedFields.has(key)),
    ),
  };
}
