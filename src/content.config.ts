import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import {
  experienceSchema,
  portfolioSchema,
  postSchema,
  profileSchema,
  seriesSchema,
} from './content/schemas';

const posts = defineCollection({
  loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx,mdoc}' }),
  schema: postSchema,
});

/*
 * series·portfolio 는 **엔트리 하나당 파일 하나**다 (NOR-19, ADR 0012).
 *
 * 예전에는 배열이 통째로 든 `index.json` 하나를 `file()` 로 읽었지만, Keystatic 의 컬렉션은
 * 파일 하나 = 엔트리 하나를 전제한다. 엔트리 id 는 그대로 유지된다 — glob 로더는 데이터에
 * `slug` 가 있으면 그걸 id 로 쓰고(series), 없으면 파일명을 쓴다(portfolio). 두 경우 모두
 * 파일명과 같은 값이라서 `posts.series` 가 가리키던 id 도 그대로다.
 */
const series = defineCollection({
  loader: glob({ base: './src/content/series', pattern: '**/*.json' }),
  schema: seriesSchema,
});

const portfolio = defineCollection({
  loader: glob({ base: './src/content/portfolio', pattern: '**/*.json' }),
  schema: portfolioSchema,
});

// file loader는 최상위 키를 entry id로 쓴다. Keystatic singleton은 평면 JSON을 저장하므로
// loader 경계에서만 `profile` id를 부여해 CMS 파일 형식을 그대로 유지한다.
const profile = defineCollection({
  loader: file('src/content/profile.json', {
    parser: (text) => ({ profile: JSON.parse(text) }),
  }),
  schema: profileSchema,
});

const experience = defineCollection({
  loader: glob({ base: './src/content/experience', pattern: '**/*.json' }),
  schema: experienceSchema,
});

export const collections = { posts, series, portfolio, profile, experience };
