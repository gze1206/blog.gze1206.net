import { describe, expect, it } from 'vitest';

import { parseDocument } from '../document/document.js';
import { blogPostToDocument, ImportPlanError, planImport, type BlogPost } from './blogImport.js';

function post(overrides: Partial<BlogPost> & Pick<BlogPost, 'slug'>): BlogPost {
  const slug = overrides.slug;
  return {
    repoPath: `src/content/posts/${slug}.mdoc`,
    title: `제목 ${slug}`,
    draft: false,
    updatedAt: '2026-08-01',
    source: [
      '---',
      `title: 제목 ${slug}`,
      'description: 설명',
      `slug: ${slug}`,
      'category: Programming',
      'tags:',
      '  - astro',
      'publishedAt: 2021-10-06T22:00:56.653Z',
      'updatedAt: 2026-08-01',
      'draft: false',
      '---',
      '',
      '본문',
      '',
    ].join('\n'),
    ...overrides,
  };
}

describe('blogPostToDocument', () => {
  it('가져온 글은 공개 대상 초안이 되고 출처 커밋을 들고 온다', () => {
    const document = parseDocument(blogPostToDocument(post({ slug: 'hello' }), 'abc123'));

    expect(document.kind).toBe('public-draft');
    expect(document.publicEligible).toBe(true);
    expect(document.slug).toBe('hello');
    expect(document.category).toBe('Programming');
    expect(document.content.trim()).toBe('본문');
    // 이 값이 없으면 다시 발행할 때 그 사이 블로그가 앞서 나갔는지 알 수 없다.
    expect(document.extra['importedFrom']).toEqual({
      commit: 'abc123',
      path: 'src/content/posts/hello.mdoc',
    });
  });

  it('발행일이 ISO 타임스탬프여도 createdAt 은 날짜만 갖는다', () => {
    const document = parseDocument(blogPostToDocument(post({ slug: 'hello' }), 'abc123'));

    expect(document.createdAt).toBe('2021-10-06');
    expect(document.publishedAt).toBe('2021-10-06T22:00:56.653Z');
  });

  it('블로그의 draft 상태를 그대로 들고 온다', () => {
    const source = post({ slug: 'hidden' }).source.replace('draft: false', 'draft: true');
    const document = parseDocument(blogPostToDocument(post({ slug: 'hidden', source }), 'abc'));

    expect(document.draft).toBe(true);
  });
});

describe('planImport', () => {
  const commit = 'abc123';

  it('충돌이 없으면 고른 글을 그대로 가져온다', () => {
    const alpha = post({ slug: 'alpha' });
    const beta = post({ slug: 'beta' });
    const posts = [alpha, beta];

    const plan = planImport({
      posts,
      selections: [{ repoPath: alpha.repoPath }, { repoPath: beta.repoPath }],
      existing: {},
      commit,
    });

    expect(plan.cancelled).toBe(false);
    expect(plan.actions.map((action) => action.relativePath)).toEqual([
      'drafts/alpha.md',
      'drafts/beta.md',
    ]);
    expect(plan.actions.every((action) => !action.overwrite)).toBe(true);
  });

  it('결정 없이 충돌하면 계획을 세우지 않는다', () => {
    const alpha = post({ slug: 'alpha' });

    expect(() =>
      planImport({
        posts: [alpha],
        selections: [{ repoPath: alpha.repoPath }],
        existing: { alpha: 'drafts/alpha.md' },
        commit,
      }),
    ).toThrow(ImportPlanError);
  });

  it('건너뛰기는 그 항목만 뺀다', () => {
    const alpha = post({ slug: 'alpha' });
    const beta = post({ slug: 'beta' });

    const plan = planImport({
      posts: [alpha, beta],
      selections: [{ repoPath: alpha.repoPath, resolution: 'skip' }, { repoPath: beta.repoPath }],
      existing: { alpha: 'drafts/alpha.md' },
      commit,
    });

    expect(plan.skipped).toEqual([{ repoPath: alpha.repoPath, reason: 'slug already exists' }]);
    expect(plan.actions.map((action) => action.slug)).toEqual(['beta']);
  });

  it('덮어쓰기는 이미 있는 문서의 자리에 쓴다', () => {
    const alpha = post({ slug: 'alpha' });

    const plan = planImport({
      posts: [alpha],
      selections: [{ repoPath: alpha.repoPath, resolution: 'overwrite' }],
      existing: { alpha: 'notes/older-alpha.md' },
      commit,
    });

    expect(plan.actions).toEqual([
      expect.objectContaining({ relativePath: 'notes/older-alpha.md', overwrite: true }),
    ]);
  });

  it('대체 슬러그는 검사하고, 그것마저 겹치면 거부한다', () => {
    const alpha = post({ slug: 'alpha' });
    const base = {
      posts: [alpha],
      existing: { alpha: 'drafts/alpha.md', beta: 'drafts/beta.md' },
      commit,
    };

    const plan = planImport({
      ...base,
      selections: [{ repoPath: alpha.repoPath, resolution: 'rename', slug: 'alpha-2' }],
    });
    expect(plan.actions[0]?.slug).toBe('alpha-2');
    expect(plan.actions[0]?.relativePath).toBe('drafts/alpha-2.md');

    expect(() =>
      planImport({
        ...base,
        selections: [{ repoPath: alpha.repoPath, resolution: 'rename', slug: 'beta' }],
      }),
    ).toThrow('already exists');
    expect(() =>
      planImport({
        ...base,
        selections: [{ repoPath: alpha.repoPath, resolution: 'rename', slug: 'Not A Slug' }],
      }),
    ).toThrow('invalid replacement slug');
  });

  it('취소는 그 항목이 아니라 가져오기 전체를 되돌린다', () => {
    const alpha = post({ slug: 'alpha' });
    const beta = post({ slug: 'beta' });

    const plan = planImport({
      posts: [alpha, beta],
      selections: [{ repoPath: beta.repoPath }, { repoPath: alpha.repoPath, resolution: 'cancel' }],
      existing: { alpha: 'drafts/alpha.md' },
      commit,
    });

    // 반쯤 들어온 상태로 끝나지 않는다.
    expect(plan).toEqual({ actions: [], skipped: [], cancelled: true });
  });

  it('한 번에 가져오는 글끼리 slug 가 겹치는 것도 충돌로 본다', () => {
    const first = post({ slug: 'alpha' });
    const second = post({ slug: 'alpha', repoPath: 'src/content/posts/alpha-old.md' });

    expect(() =>
      planImport({
        posts: [first, second],
        selections: [{ repoPath: first.repoPath }, { repoPath: second.repoPath }],
        existing: {},
        commit,
      }),
    ).toThrow(ImportPlanError);
  });
});
