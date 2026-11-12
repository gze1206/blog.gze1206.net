/**
 * 빌드 산출물의 `og:image` 참조가 **실제 파일을 가리키는지** 검사하는 통합 (NOR-28).
 *
 * 메타는 경로 규칙으로 이미지 URL 을 만들고(`site-meta.ts`), 이미지는 별도 목록으로
 * 생성된다(`og-targets.ts`). 규칙과 목록이 어긋나면 SNS 에서만 조용히 깨진다 —
 * HTML 만 봐서는 알 수 없다. 그래서 빌드 끝에 dist 를 직접 훑어 대조한다.
 *
 * **경고만 한다.** 여기서 빌드를 세우면 OG 이미지 한 장 때문에 배포가 막힌다.
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';

const OG_IMAGE_META = /<meta\s+property="og:image"\s+content="([^"]*)"/g;

async function listHtmlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return listHtmlFiles(full);
      return entry.name.endsWith('.html') ? [full] : [];
    }),
  );
  return files.flat();
}

/** `https://site/og/x.png` → dist 안의 파일 경로. 사이트 밖 URL 이면 `null`. */
function toDistPath(distDir: string, site: URL, imageUrl: string): string | null {
  let resolved: URL;
  try {
    resolved = new URL(imageUrl, site);
  } catch {
    return null;
  }
  if (resolved.origin !== site.origin) return null;
  const relative = decodeURIComponent(resolved.pathname).replace(/^\/+/, '');
  return join(distDir, relative);
}

export function ogImageAudit(): AstroIntegration {
  let site: URL | undefined;

  return {
    name: 'og-image-audit',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site === undefined ? undefined : new URL(config.site);
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (site === undefined) {
          logger.warn('site 가 설정돼 있지 않아 og:image 참조를 검사하지 못했습니다.');
          return;
        }
        const distDir = fileURLToPath(dir);
        const htmlFiles = await listHtmlFiles(distDir);

        const missing = new Map<string, string[]>();
        let checked = 0;

        for (const file of htmlFiles) {
          const html = await readFile(file, 'utf8');
          for (const match of html.matchAll(OG_IMAGE_META)) {
            const url = match[1] ?? '';
            const path = toDistPath(distDir, site, url);
            if (path === null) continue; // 외부 호스트 이미지는 검사 대상이 아니다.
            checked++;
            if (existsSync(path)) continue;
            const pages = missing.get(url) ?? [];
            pages.push(file.slice(distDir.length));
            missing.set(url, pages);
          }
        }

        if (missing.size === 0) {
          logger.info(`og:image 참조 ${checked}건 — 깨진 참조 없음`);
          return;
        }
        logger.warn(`og:image 참조 ${checked}건 중 ${missing.size}개가 실재하지 않습니다:`);
        for (const [url, pages] of missing) {
          logger.warn(`  ${url} ← ${pages.slice(0, 3).join(', ')}${pages.length > 3 ? ' 외' : ''}`);
        }
      },
    },
  };
}
