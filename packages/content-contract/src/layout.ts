/**
 * 워크벤치가 블로그에 쓰는 자리. 저장소 루트 기준 경로다.
 * `publishBranch` 는 Cloudflare Pages 의 프로덕션 브랜치다(NOR-199).
 */
export const BLOG_LAYOUT = {
  booksDir: 'apps/blog/src/content/books',
  bookCoversDir: 'apps/blog/public/assets/books',
  bookCoverUrlPrefix: '/assets/books',
  postsDir: 'apps/blog/src/content/posts',
  publicDir: 'apps/blog/public',
  publishBranch: 'main',
} as const;
