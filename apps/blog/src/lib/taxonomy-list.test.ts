import { expect, it } from 'vitest';
import { buildTaxonomyDetails } from './taxonomy-list';

it('NOR-197 AC-10: 분류별 게시물 수와 최대 세 개의 링크를 만든다', () => {
  const post = {
    data: { title: '글', slug: 'post', category: '개발', publishedAt: new Date('2024-01-01') },
  };
  const result = buildTaxonomyDetails(
    [{ slug: 'dev', label: '개발', posts: [post, post, post, post] }],
    [],
  );
  expect(result['category:dev']).toMatchObject({
    label: '개발',
    postCount: 4,
    href: '/category/dev/',
  });
  expect(result['category:dev']?.articles).toHaveLength(3);
});
