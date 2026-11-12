import { rm } from 'node:fs/promises';
import { collectPosts } from '../lib/draft-list.ts';
import { BLOG_LAYOUT } from '@gze1206/content-contract';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { isSmokeEnabled } from '../lib/dist-audit.ts';

/**
 * smoke 페이지는 getStaticPaths 로 빠지지만 `public/smoke/` 의 정적 자산은 Astro 가 그대로 복사한다.
 * smoke 가 꺼진 빌드(프로덕션)에서는 빌드가 끝난 뒤 `dist/smoke` 를 통째로 지운다 (NOR-197 AC-1).
 */
export async function removeSmokeOutput(
  distDir: string,
  smoke: boolean,
  draftSlugs: readonly string[] = [],
): Promise<void> {
  if (!smoke) await rm(path.join(distDir, 'smoke'), { recursive: true, force: true });
  for (const slug of draftSlugs) {
    await rm(path.join(distDir, 'assets/posts', slug), { recursive: true, force: true });
    await rm(path.join(distDir, 'og/blog', `${slug}.png`), { force: true });
  }
}

export function isProductionDeploy(env: {
  CF_PAGES?: string | undefined;
  CF_PAGES_BRANCH?: string | undefined;
}): boolean {
  return env.CF_PAGES === '1' && env.CF_PAGES_BRANCH === BLOG_LAYOUT.publishBranch;
}

export function smokeGate(): AstroIntegration {
  return {
    name: 'smoke-gate',
    hooks: {
      'astro:config:setup': () => {
        if (
          isProductionDeploy(process.env) &&
          isSmokeEnabled({ BLOG_SMOKE: process.env.BLOG_SMOKE })
        )
          throw new Error('BLOG_SMOKE is forbidden on production Cloudflare Pages deployments');
      },
      'astro:build:done': async ({ dir }) => {
        await removeSmokeOutput(
          fileURLToPath(dir),
          isSmokeEnabled({ DEV: false, BLOG_SMOKE: process.env.BLOG_SMOKE }),
          (await collectPosts('src/content/posts'))
            .filter((post) => post.draft)
            .map((post) => post.slug),
        );
      },
    },
  };
}
