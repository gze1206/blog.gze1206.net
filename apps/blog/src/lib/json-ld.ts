interface ArticleJsonLdInput {
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

/**
 * `<script type="application/ld+json">` 안에 넣을 문자열 (NOR-210 AC-9).
 *
 * 그대로 `JSON.stringify` 하면 frontmatter 의 `</script>` 가 태그를 닫는다. 글은 워크벤치에서 자동으로
 * 병합되므로, `<`·`>`·`&` 와 줄 구분 문자를 유니코드 이스케이프로 바꾼다. JSON 으로는 같은 값이다.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</gu, '\\u003c')
    .replace(/>/gu, '\\u003e')
    .replace(/&/gu, '\\u0026')
    .replace(/\u2028/gu, '\\u2028')
    .replace(/\u2029/gu, '\\u2029');
}
