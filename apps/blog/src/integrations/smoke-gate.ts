import { rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { isSmokeEnabled } from '../lib/dist-audit.ts';

/**
 * smoke 페이지는 getStaticPaths 로 빠지지만 `public/smoke/` 의 정적 자산은 Astro 가 그대로 복사한다.
 * smoke 가 꺼진 빌드(프로덕션)에서는 빌드가 끝난 뒤 `dist/smoke` 를 통째로 지운다 (NOR-197 AC-1).
 */
export async function removeSmokeOutput(distDir: string, smoke: boolean): Promise<void> {
  if (smoke) return;
  await rm(path.join(distDir, 'smoke'), { recursive: true, force: true });
}

export function smokeGate(): AstroIntegration {
  return {
    name: 'smoke-gate',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        await removeSmokeOutput(
          fileURLToPath(dir),
          isSmokeEnabled({ DEV: false, BLOG_SMOKE: process.env.BLOG_SMOKE }),
        );
      },
    },
  };
}
