import { describe, expect, it } from 'vitest';

import { parsePublishedPost } from './contract.js';
import { transformPublicDraft } from './transform.js';
import { PublicDraftValidationError, validatePublicDraft } from './validate.js';

const validDraft = `---
title: 공개 글
kind: public-draft
createdAt: 2026-08-10
updatedAt: 2026-08-12
publicEligible: true
description: 안전한 발행 흐름
slug: safe-publish
category: engineering
tags: ['git', 'markdoc']
publishedAt: 2026-08-12
---
# 공개 글

본문입니다.
`;

describe('public post contract', () => {
  it.each([
    ['uppercase slug', { slug: 'Unsafe-Slug' }],
    ['empty tags', { tags: [] }],
    ['series without order', { series: 'Workbench' }],
    ['order without series', { seriesOrder: 1 }],
    ['non-positive series order', { series: 'Workbench', seriesOrder: 0 }],
    ['invalid date input', { publishedAt: 'not-a-date' }],
  ])('rejects %s', (_name, override) => {
    expect(() =>
      parsePublishedPost({
        title: '공개 글',
        description: '설명',
        slug: 'safe-publish',
        category: 'engineering',
        tags: ['git'],
        publishedAt: '2026-08-12',
        updatedAt: '2026-08-12',
        draft: false,
        ...override,
      }),
    ).toThrow();
  });

  it('coerces Blog v4 timestamp date inputs to deterministic UTC calendar dates', () => {
    expect(
      parsePublishedPost({
        title: '공개 글',
        description: '설명',
        slug: 'safe-publish',
        category: 'engineering',
        tags: ['git'],
        publishedAt: '2026-08-12T23:30:00-04:00',
        updatedAt: '2026-08-12T09:00:00.000Z',
        draft: false,
      }),
    ).toMatchObject({ publishedAt: '2026-08-13', updatedAt: '2026-08-12' });
  });
});

describe('validatePublicDraft', () => {
  it.each([
    ['file URL', 'file:///Users/private/secret.txt'],
    ['workspace path', 'workspace/notes/secret.md'],
    ['private asset directory', 'assets/private/token.png'],
    ['configured private root', '/srv/private-workbench/drafts/secret.md'],
    ['internal wiki link', '관련 문서 [[Internal Runbook]]'],
  ])('rejects a %s leak before publishing', (_name, leakedContent) => {
    expect(() =>
      validatePublicDraft(`${validDraft}\n${leakedContent}\n`, {
        privateRoot: '/srv/private-workbench',
        assets: [],
      }),
    ).toThrow(PublicDraftValidationError);
  });

  it('rejects local asset references that are not explicitly approved', () => {
    expect(() =>
      validatePublicDraft(`${validDraft}\n![private](images/private.png)\n`, {
        privateRoot: '/srv/private-workbench',
        assets: [],
      }),
    ).toThrow(/unresolved asset reference.*images\/private\.png/u);
  });

  it.each([
    ['reference-style image', '![diagram][flow]\n\n[flow]: images/flow.png'],
    ['missing reference-style definition', '![diagram][missing]'],
    ['shortcut reference image', '![flow]\n\n[flow]: images/flow.png'],
    ['unquoted HTML src', '<img src=images/flow.png alt=diagram>'],
    ['quoted HTML srcset', '<img srcset="images/flow.png 1x, images/flow@2x.png 2x">'],
    ['unquoted HTML srcset', '<img srcset=images/flow.png>'],
    ['Markdoc src', '{% image src: "images/flow.png" /%}'],
    ['nested-parenthesis title', '![secret](images/secret.png (caption))'],
    [
      'angle-bracket destination with whitespace and title',
      '![secret](<images/secret file.png> "caption")',
    ],
  ])('rejects an unresolved %s', (_name, markup) => {
    expect(() =>
      validatePublicDraft(`${validDraft}\n${markup}\n`, {
        privateRoot: '/srv/private-workbench',
        assets: [],
      }),
    ).toThrow(/unresolved asset reference/u);
  });

  it('accepts only an approved private-root asset with a slug-scoped public path', () => {
    const source = `${validDraft}\n![diagram](images/flow.png)\n`;
    expect(
      validatePublicDraft(source, {
        privateRoot: '/srv/private-workbench',
        assets: [
          {
            draftReference: 'images/flow.png',
            privatePath: '/srv/private-workbench/assets/flow.png',
            publicPath: 'assets/posts/safe-publish/flow.png',
          },
        ],
      }),
    ).toMatchObject({
      metadata: { slug: 'safe-publish' },
      content: expect.stringContaining('flow'),
    });
  });

  it.each([
    ['fenced code', '```md\n![example](images/not-an-asset.png)\n```'],
    ['escaped literal', '\\![example][missing]'],
  ])('does not treat %s as a rendered asset', (_name, markup) => {
    expect(() =>
      validatePublicDraft(`${validDraft}\n${markup}\n`, {
        privateRoot: '/srv/private-workbench',
        assets: [],
      }),
    ).not.toThrow();
  });

  it.each([
    ['fenced HTML', '```html\n<img src=images/not-an-asset.png>\n```'],
    ['inline HTML code', '`<img src=images/not-an-asset.png>`'],
    ['escaped HTML literal', '\\<img src=images/not-an-asset.png>'],
    ['escaped Markdoc literal', '\\{% image src: "images/not-an-asset.png" /%}'],
    ['data URI srcset', '<img srcset="data:image/png;base64,aGVsbG8= 1x">'],
  ])('ignores non-rendered or non-local %s', (_name, markup) => {
    expect(() =>
      validatePublicDraft(`${validDraft}\n${markup}\n`, {
        privateRoot: '/srv/private-workbench',
        assets: [],
      }),
    ).not.toThrow();
  });

  it('uses the first CommonMark definition when duplicate labels disagree', () => {
    const source = `${validDraft}\n![diagram][asset]\n\n[asset]: images/local.png\n[asset]: https://example.com/remote.png\n`;
    expect(() =>
      validatePublicDraft(source, { privateRoot: '/srv/private-workbench', assets: [] }),
    ).toThrow(/unresolved asset reference: images\/local\.png/u);
  });
});

describe('transformPublicDraft', () => {
  it('rewrites only rendered HTML and Markdoc spans, not code or escaped literals', () => {
    const source = `${validDraft}\n\`<img src=a.png>\`\n\\<img src=a.png>\n<img src=a.png>\n{% image src: "a.png" /%}\n`;
    const transformed = transformPublicDraft({
      source,
      privateRoot: '/srv/private-workbench',
      assets: [
        {
          draftReference: 'a.png',
          privatePath: '/srv/private-workbench/assets/a.png',
          publicPath: 'assets/posts/safe-publish/a.png',
        },
      ],
    }).source;

    expect(transformed).toContain('`<img src=a.png>`');
    expect(transformed).toContain('\\<img src=a.png>');
    expect(transformed).toContain('<img src=/assets/posts/safe-publish/a.png>');
    expect(transformed).toContain('{% image src: "/assets/posts/safe-publish/a.png" /%}');
  });

  it('rewrites only the first duplicate CommonMark definition', () => {
    const source = `${validDraft}\n![diagram][asset]\n\n[asset]: images/local.png\n[asset]: https://example.com/remote.png\n`;
    const transformed = transformPublicDraft({
      source,
      privateRoot: '/srv/private-workbench',
      assets: [
        {
          draftReference: 'images/local.png',
          privatePath: '/srv/private-workbench/assets/local.png',
          publicPath: 'assets/posts/safe-publish/local.png',
        },
      ],
    }).source;

    expect(transformed).toContain('[asset]: /assets/posts/safe-publish/local.png');
    expect(transformed).toContain('[asset]: https://example.com/remote.png');
  });

  it('rewrites parsed image nodes with titles and whitespace destinations', () => {
    const source = `${validDraft}\n![captioned](images/caption.png (caption))\n![spaced](<images/secret file.png> "secret title")\n`;
    const transformed = transformPublicDraft({
      source,
      privateRoot: '/srv/private-workbench',
      assets: [
        {
          draftReference: 'images/caption.png',
          privatePath: '/srv/private-workbench/assets/caption.png',
          publicPath: 'assets/posts/safe-publish/caption.png',
        },
        {
          draftReference: 'images/secret file.png',
          privatePath: '/srv/private-workbench/assets/secret file.png',
          publicPath: 'assets/posts/safe-publish/secret file.png',
        },
      ],
    });

    expect(transformed.source).toContain(
      '![captioned](/assets/posts/safe-publish/caption.png "caption")',
    );
    expect(transformed.source).toContain(
      '![spaced](</assets/posts/safe-publish/secret file.png> "secret title")',
    );
  });

  it('rewrites each parsed image destination exactly when paths share a suffix', () => {
    const source = `${validDraft}\n![root](a.png)\n![nested](dir/a.png)\n`;
    const transformed = transformPublicDraft({
      source,
      privateRoot: '/srv/private-workbench',
      assets: [
        {
          draftReference: 'a.png',
          privatePath: '/srv/private-workbench/assets/a.png',
          publicPath: 'assets/posts/safe-publish/a.png',
        },
        {
          draftReference: 'dir/a.png',
          privatePath: '/srv/private-workbench/assets/dir/a.png',
          publicPath: 'assets/posts/safe-publish/dir/a.png',
        },
      ],
    });

    expect(transformed.source).toContain('![root](/assets/posts/safe-publish/a.png)');
    expect(transformed.source).toContain('![nested](/assets/posts/safe-publish/dir/a.png)');
    expect(transformed.source).not.toContain('dir//assets');
  });

  it('accepts timestamp frontmatter and emits canonical date-only values', () => {
    const source = validDraft
      .replace('updatedAt: 2026-08-12', 'updatedAt: 2026-08-12T09:00:00.000Z')
      .replace('publishedAt: 2026-08-12', 'publishedAt: 2026-08-12T23:30:00-04:00');

    expect(
      transformPublicDraft({ source, privateRoot: '/srv/private-workbench', assets: [] }).source,
    ).toContain('publishedAt: 2026-08-13\nupdatedAt: 2026-08-12');
  });

  it('deterministically emits the exact public post schema and rewrites approved assets', () => {
    const input = {
      source: `${validDraft}\n![diagram](images/flow.png)\n`,
      privateRoot: '/srv/private-workbench',
      assets: [
        {
          draftReference: 'images/flow.png',
          privatePath: '/srv/private-workbench/assets/flow.png',
          publicPath: 'assets/posts/safe-publish/flow.png',
        },
      ],
    };

    const first = transformPublicDraft(input);
    const second = transformPublicDraft(input);

    expect(second).toEqual(first);
    expect(first.source).toBe(`---
title: 공개 글
description: 안전한 발행 흐름
slug: safe-publish
category: engineering
tags: ['git', 'markdoc']
publishedAt: 2026-08-12
updatedAt: 2026-08-12
draft: false
---
# 공개 글

본문입니다.

![diagram](/assets/posts/safe-publish/flow.png)
`);
    expect(first.assets).toEqual([
      {
        privatePath: '/srv/private-workbench/assets/flow.png',
        publicPath: 'assets/posts/safe-publish/flow.png',
      },
    ]);
  });
});
