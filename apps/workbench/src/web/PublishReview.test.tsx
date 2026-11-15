import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PublishReview } from './PublishReview.js';

const review = {
  reviewId: 'a'.repeat(43),
  baseHead: 'a'.repeat(40),
  branch: 'content/safe-publish',
  targetPath: 'src/content/posts/safe-publish.mdoc',
  metadata: {
    title: 'Publish safely',
    description: 'Review',
    slug: 'safe-publish',
    category: 'engineering',
    tags: ['git'],
    publishedAt: '2026-08-13',
    updatedAt: '2026-08-13',
    draft: false,
  },
  assets: [],
  diff: 'diff',
};

describe('PublishReview', () => {
  it('NOR-210 AC-8: 확정 결과는 자동 전달을 알리고 손으로 칠 git 명령을 보여 주지 않는다', () => {
    const html = renderToStaticMarkup(
      <PublishReview
        review={review}
        publishing={false}
        result={{
          outboxRef: 'safe-publish-20260813.json',
          exportRef: 'safe-publish-20260813.patch',
          exportFormat: 'format-patch',
          baseSha: 'a'.repeat(40),
          branch: 'content/safe-publish',
          commit: 'b'.repeat(40),
          targetPath: 'src/content/posts/safe-publish.mdoc',
        }}
        onClose={() => undefined}
        onConfirm={() => undefined}
      />,
    );

    expect(html).toContain('safe-publish-20260813.patch');
    expect(html).toContain('PR');
    expect(html).toContain('자동으로 병합');
    expect(html).not.toContain('git am');
    expect(html).not.toContain('merge-base --is-ancestor');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('/run/publish');
  });
});
