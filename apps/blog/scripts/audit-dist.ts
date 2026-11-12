import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { collectPosts } from '../src/lib/draft-list.ts';
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

const posts = await collectPosts('src/content/posts');
const drafts = posts.filter((post) => post.draft);
const publicTitles = new Set(
  posts.filter((post) => !post.draft).map((post) => post.title.toLowerCase()),
);
const draftTitles = drafts
  .map((post) => post.title)
  .filter((title) => {
    if (!publicTitles.has(title.toLowerCase())) return true;
    console.warn(`draft title matches public post; skipping title audit: ${title}`);
    return false;
  });
const files: DistFile[] = [];
const assets: { path: string; content: string | null }[] = [];
for (const path of await walk('dist')) {
  const name = relative('dist', path).replaceAll('\\', '/');
  if (name.endsWith('.html')) files.push({ path: name, html: await readFile(path, 'utf8') });
  else
    assets.push({
      path: name,
      content: /\.(?:html|xml|json|js|css|txt|svg|webmanifest)$/i.test(name)
        ? await readFile(path, 'utf8')
        : /^pagefind\/.*\.pf_[^/]+$/.test(name)
          ? gunzipSync(await readFile(path)).toString('utf8')
          : null,
    });
}
const findings = auditDist({
  files,
  assets,
  draftSlugs: drafts.map((post) => post.slug),
  draftTitles,
  smoke: isSmokeEnabled({ BLOG_SMOKE: process.env.BLOG_SMOKE }),
});
if (findings.length) {
  for (const finding of findings)
    console.error(`${finding.rule}: ${finding.path}: ${finding.detail}`);
  process.exitCode = 1;
} else console.log('dist audit: passed');
