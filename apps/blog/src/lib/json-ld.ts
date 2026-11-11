export interface ArticleJsonLdInput {
  readonly title: string;
  readonly description: string;
  readonly url: string;
  readonly published: string;
  readonly modified: string;
}

export function buildArticleJsonLd(input: ArticleJsonLdInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    datePublished: input.published,
    dateModified: input.modified,
    author: { '@type': 'Person', name: 'gze1206' },
  };
}

export function buildPersonJsonLd(url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'gze1206',
    url,
    jobTitle: '소프트웨어 개발자',
    description: '게임 개발과 웹·서버 개발을 기록하는 소프트웨어 개발자',
  };
}

export function buildBreadcrumbJsonLd(
  items: readonly { readonly name: string; readonly url: string }[],
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
