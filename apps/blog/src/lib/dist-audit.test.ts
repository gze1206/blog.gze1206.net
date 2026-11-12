import { describe, expect, it } from 'vitest';
import { auditDist, isSmokeEnabled } from './dist-audit';

describe('산출물 감사', () => {
  it('NOR-197 AC-1: 프로덕션 감사는 smoke 경로와 draft slug·제목을 찾는다', () => {
    const input = {
      files: [{ path: 'smoke/test/index.html', html: '<a href="/blog/secret">비공개 제목</a>' }],
      assets: [],
      draftSlugs: ['secret'],
      draftTitles: ['비공개 제목'],
      smoke: false,
    };
    expect(auditDist(input).map((finding) => finding.rule)).toEqual([
      'smoke-in-production',
      'draft-leak',
      'draft-leak',
    ]);
    expect(auditDist({ ...input, smoke: true })).toEqual([]);
  });
  it('NOR-197 AC-2: isSmokeEnabled 는 DEV 또는 BLOG_SMOKE=1 일 때만 참이다', () => {
    expect(isSmokeEnabled({ DEV: true })).toBe(true);
    expect(isSmokeEnabled({ BLOG_SMOKE: '1' })).toBe(true);
    expect(isSmokeEnabled({ BLOG_SMOKE: 'true' })).toBe(false);
    expect(isSmokeEnabled({})).toBe(false);
  });
});

it('NOR-197 AC-5: 감사는 빠진 OG 이미지를 찾는다', () => {
  const input = {
    files: [
      {
        path: 'about/index.html',
        html: '<meta property="og:image" content="https://gze1206.net/og/about.png">',
      },
    ],
    assets: [],
    draftSlugs: [],
    draftTitles: [],
    smoke: false,
  };
  expect(auditDist(input)).toContainEqual(expect.objectContaining({ rule: 'missing-og-image' }));
  expect(auditDist({ ...input, assets: [{ path: 'og/about.png', content: null }] })).toEqual([]);
});
it('NOR-197 AC-6: 감사는 meta refresh 를 찾는다', () => {
  expect(
    auditDist({
      files: [
        { path: 'career/index.html', html: '<meta http-equiv="refresh" content="0;url=/about">' },
      ],
      assets: [],
      draftSlugs: [],
      draftTitles: [],
      smoke: false,
    }),
  ).toContainEqual(expect.objectContaining({ rule: 'meta-refresh' }));
});
