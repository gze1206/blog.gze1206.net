/** RSS 항목으로 내보낼 공개 글의 최소 계약 (NOR-30). */
interface FeedPost {
  readonly data: {
    readonly title: string;
    readonly description: string;
    readonly slug: string;
    readonly category: string;
    readonly tags: readonly string[];
    readonly publishedAt: Date;
    readonly draft: boolean;
  };
}

interface FeedItem {
  readonly title: string;
  readonly description: string;
  readonly link: string;
  readonly pubDate: Date;
  readonly customData: string;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    };
    return entities[character] ?? character;
  });
}

/** 호출자가 공개 글을 골라 전달하며, Markdoc 본문 대신 검증된 프론트매터 설명을 RSS 요약으로 제공한다. */
export function toRssItems(posts: readonly FeedPost[], site: URL | string): FeedItem[] {
  const base = new URL(site).origin;

  return posts.map((post) => {
    const categories = [...new Set([post.data.category, ...post.data.tags])]
      .map((category) => `<category>${escapeXml(category)}</category>`)
      .join('');

    return {
      title: post.data.title,
      description: post.data.description,
      link: new URL(`/blog/${encodeURIComponent(post.data.slug)}`, base).href,
      pubDate: post.data.publishedAt,
      customData: categories,
    };
  });
}
