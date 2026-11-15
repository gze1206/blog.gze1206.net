import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { postSchema, type Post } from '@gze1206/content-contract';
import { parse } from 'yaml';
import { POST_EXTENSION } from './post-glob.ts';
import { normalizeAuditText } from './dist-audit.ts';

export async function collectPosts(dir: string): Promise<Post[]> {
  async function walk(base: string): Promise<Post[]> {
    const entries = await readdir(base, { withFileTypes: true });
    return (
      await Promise.all(
        entries.map(async (entry): Promise<Post[]> => {
          const name = path.join(base, entry.name);
          if (entry.isDirectory()) return walk(name);
          if (!entry.isFile() || !POST_EXTENSION.test(name)) return [];
          const text = await readFile(name, 'utf8');
          const frontmatter = text.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
          if (!frontmatter?.[1]) throw new Error(`Missing frontmatter: ${name}`);
          return [postSchema.parse(parse(frontmatter[1]))];
        }),
      )
    ).flat();
  }
  const posts = await walk(dir);
  if (!posts.length) throw new Error(`No posts found: ${dir}`);
  return posts;
}

export function selectDraftTitles(
  posts: readonly { title: string; draft: boolean }[],
  warn: (message: string) => void,
): string[] {
  const publicTitles = new Set(
    posts.filter((post) => !post.draft).map((post) => normalizeAuditText(post.title).trim()),
  );
  return posts
    .filter((post) => post.draft)
    .map((post) => post.title)
    .filter((title) => {
      if (!publicTitles.has(normalizeAuditText(title).trim())) return true;
      warn(`draft title matches public post; skipping title audit: ${title}`);
      return false;
    });
}
