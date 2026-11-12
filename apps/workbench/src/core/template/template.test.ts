import { describe, expect, it } from 'vitest';

import { parseTemplate, serializeTemplate } from './template.js';
import { substituteTemplateTokens } from './tokens.js';

const source = `---
title: 주간 회고
kind: weekly-review
defaultPath: reviews/weekly
publicEligible: false
customField: keep-me
---
# {{period}} 회고
`;

describe('template frontmatter', () => {
  it('parses the closed recognized contract and preserves unknown fields', () => {
    const template = parseTemplate(source);

    expect(template).toMatchObject({
      title: '주간 회고',
      kind: 'weekly-review',
      defaultPath: 'reviews/weekly',
      publicEligible: false,
      extra: { customField: 'keep-me' },
    });
    expect(serializeTemplate(template)).toContain('customField: keep-me');
  });

  it('rejects unsupported template kinds', () => {
    expect(() =>
      parseTemplate(
        `---\ntitle: nope\nkind: nope\ndefaultPath: drafts\npublicEligible: false\n---\n`,
      ),
    ).toThrow('unsupported template kind');
  });
});

describe('substituteTemplateTokens', () => {
  it('replaces all four supported tokens and leaves other expressions inert', () => {
    expect(
      substituteTemplateTokens('{{date}} {{isoDate}} {{period}} {{id}} {{unknown}} {{date}}', {
        date: '2026-08-12',
        isoDate: '2026-08-12T11:30:00.000Z',
        period: '2026-W33',
        id: 'doc-01',
      }),
    ).toBe('2026-08-12 2026-08-12T11:30:00.000Z 2026-W33 doc-01 {{unknown}} 2026-08-12');
  });
});
