import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { postSchema } from '@gze1206/content-contract';
import { auditDist, isSmokeEnabled, type DistFile } from '../src/lib/dist-audit.ts';

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : Promise.resolve([path]);
    }),
  );
  return paths.flat();
}

const posts = await walk('src/content/posts');
const drafts = [];
for (const path of posts.filter((path) => /\.(?:md|mdoc)$/.test(path))) {
  const text = await readFile(path, 'utf8');
  const frontmatter = text.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
  if (!frontmatter) throw new Error(`Missing frontmatter: ${path}`);
  const post = postSchema.parse(parse(frontmatter[1]));
  if (post.draft) drafts.push(post);
}
const files: DistFile[] = [];
const assets: { path: string; content: string | null }[] = [];
for (const path of await walk('dist')) {
  const name = relative('dist', path).replaceAll('\\', '/');
  if (name.endsWith('.html')) files.push({ path: name, html: await readFile(path, 'utf8') });
  else
    assets.push({
      path: name,
      content: /\.(?:js|css)$/.test(name) ? await readFile(path, 'utf8') : null,
    });
}
const findings = auditDist({
  files,
  assets,
  draftSlugs: drafts.map((post) => post.slug),
  draftTitles: drafts.map((post) => post.title),
  smoke: isSmokeEnabled({ BLOG_SMOKE: process.env.BLOG_SMOKE }),
});
if (findings.length) {
  for (const finding of findings)
    console.error(`${finding.rule}: ${finding.path}: ${finding.detail}`);
  process.exitCode = 1;
} else console.log('dist audit: passed');
