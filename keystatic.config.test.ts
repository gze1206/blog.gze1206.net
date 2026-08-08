import { fields } from '@keystatic/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

type MarkdocArguments = Parameters<typeof fields.markdoc>[0];

const captured = vi.hoisted(() => ({
  markdocArguments: undefined as MarkdocArguments | undefined,
}));

vi.mock('@keystatic/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@keystatic/core')>();

  return {
    ...actual,
    fields: {
      ...actual.fields,
      markdoc: (arguments_: MarkdocArguments) => {
        captured.markdocArguments = arguments_;
        return actual.fields.markdoc(arguments_);
      },
    },
  };
});

beforeAll(async () => {
  await import('./keystatic.config');
});

describe('Keystatic posts content configuration', () => {
  it('provides the custom Markdoc blocks and public upload image paths', () => {
    expect(captured.markdocArguments).toBeDefined();

    if (captured.markdocArguments === undefined) {
      throw new Error('posts content field was not configured with fields.markdoc');
    }

    const content = captured.markdocArguments;
    expect(content.options?.image).toEqual({
      directory: 'public/uploads',
      publicPath: '/uploads/',
    });

    expect(content.components).toMatchObject({
      bookmark: {
        kind: 'block',
        schema: {
          url: expect.any(Object),
          title: expect.any(Object),
          description: expect.any(Object),
          image: expect.any(Object),
          siteName: expect.any(Object),
        },
      },
      github: {
        kind: 'block',
        schema: {
          repo: expect.any(Object),
          description: expect.any(Object),
          stars: expect.any(Object),
          language: expect.any(Object),
        },
      },
      callout: {
        kind: 'wrapper',
        schema: {
          type: {
            options: [
              { label: '참고', value: 'note' },
              { label: '정보', value: 'info' },
              { label: '팁', value: 'tip' },
              { label: '성공', value: 'success' },
              { label: '주의', value: 'warning' },
              { label: '위험', value: 'danger' },
            ],
          },
          title: expect.any(Object),
          children: { kind: 'child' },
        },
      },
    });
  });
});
