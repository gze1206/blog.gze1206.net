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
  it('shows only the patch outbox file and the format-patch human push procedure', () => {
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
    expect(html).toContain('git am');
    expect(html).toContain('merge-base --is-ancestor');
    expect(html).not.toContain('https://');
    expect(html).not.toContain('/run/publish');
  });
});
