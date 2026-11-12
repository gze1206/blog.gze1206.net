/**
 * 워크벤치가 블로그에 쓰는 자리. 저장소 루트 기준 경로다.
 * `publishBranch` 는 하위 프로젝트 4 에서 배포 방식을 정할 때까지 통합 브랜치다.
 */
export const BLOG_LAYOUT = {
  booksDir: 'apps/blog/src/content/books',
  bookCoversDir: 'apps/blog/public/assets/books',
  bookCoverUrlPrefix: '/assets/books',
  postsDir: 'apps/blog/src/content/posts',
  publicDir: 'apps/blog/public',
  publishBranch: 'v4',
} as const;
