import { describe, expect, it } from 'vitest';
import { POST_FIELD_ORDER, postObject, postSchema, strictPostSchema } from './index.ts';

const valid = {
  title: '글',
  description: '설명',
  slug: 'hello-world',
  category: 'dev',
  tags: ['astro'],
  publishedAt: '2026-11-12',
  updatedAt: '2026-11-12',
};

describe('postSchema', () => {
  it('NOR-195 AC-4: toc 는 auto·inline·floating·false 만 받고 기본값은 auto 다', () => {
    expect(postSchema.parse(valid).toc).toBe('auto');
    for (const toc of ['auto', 'inline', 'floating', false] as const) {
      expect(postSchema.parse({ ...valid, toc }).toc).toBe(toc);
    }
    expect(postSchema.safeParse({ ...valid, toc: 'sidebar' }).success).toBe(false);
    expect(postSchema.safeParse({ ...valid, toc: true }).success).toBe(false);
  });

  it('NOR-195 AC-4: series 와 seriesOrder 는 함께 있어야 한다 (두 변형 모두)', () => {
    for (const schema of [postSchema, strictPostSchema]) {
      expect(schema.safeParse({ ...valid, series: 's' }).success).toBe(false);
      expect(schema.safeParse({ ...valid, seriesOrder: 1 }).success).toBe(false);
      expect(schema.safeParse({ ...valid, series: 's', seriesOrder: 1 }).success).toBe(true);
    }
  });

  it('NOR-195 AC-4: 빈 제목과 대문자 slug 를 거부한다', () => {
    expect(postSchema.safeParse({ ...valid, title: '  ' }).success).toBe(false);
    expect(postSchema.safeParse({ ...valid, slug: 'Hello' }).success).toBe(false);
    expect(postSchema.safeParse({ ...valid, tags: [] }).success).toBe(false);
  });

  it('NOR-195 AC-4: strict 변형만 모르는 키를 거부한다', () => {
    expect(postSchema.safeParse({ ...valid, extra: 1 }).success).toBe(true);
    expect(strictPostSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
  });

  it('NOR-195 AC-4: 날짜는 Date 로 강제 변환하고 draft 기본값은 false 다', () => {
    const post = postSchema.parse(valid);
    expect(post.publishedAt).toBeInstanceOf(Date);
    expect(post.draft).toBe(false);
  });

  it('NOR-195 AC-4: POST_FIELD_ORDER 는 스키마의 모든 키를 정확히 한 번씩 담는다', () => {
    expect(new Set(POST_FIELD_ORDER).size).toBe(POST_FIELD_ORDER.length);
    expect([...POST_FIELD_ORDER].sort()).toEqual(Object.keys(postObject.shape).sort());
  });
});
