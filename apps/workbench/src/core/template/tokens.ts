export interface TemplateTokens {
  readonly date: string;
  readonly isoDate: string;
  readonly period: string;
  readonly id: string;
}

const tokenPattern = /\{\{(date|isoDate|period|id)\}\}/gu;

export function substituteTemplateTokens(source: string, tokens: TemplateTokens): string {
  return source.replace(tokenPattern, (_match, name: keyof TemplateTokens) => tokens[name]);
}
