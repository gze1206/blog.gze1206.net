import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** Markdoc로 유지하는 실제 글의 파일명. 스모크·라우팅 픽스처는 의도적으로 제외한다. */
export const AUTHOR_EDITABLE_POSTS = [
  '2025-retrospective',
  'astro-content-collections',
  'astro-deploy-cloudflare',
  'astro-markdoc-workflow',
  'baekjoon-15663-n-and-m-9-ruby',
  'baekjoon-solved-50-and-class-5',
  'blog-v4-plan',
  'bundle-budget-note',
  'c-9-0-record-type',
  'core-web-vitals-note',
  'csharp-span-memory',
  'dotnet-cil-basics',
  'hello-world',
  'image-optimization-note',
  'new-things-on-this-blog',
];

export function findUnmigratedPosts(postsDirectory) {
  return AUTHOR_EDITABLE_POSTS.filter((slug) => {
    const markdownPath = resolve(postsDirectory, `${slug}.md`);
    const markdocPath = resolve(postsDirectory, `${slug}.mdoc`);
    return existsSync(markdownPath) || !existsSync(markdocPath);
  });
}
