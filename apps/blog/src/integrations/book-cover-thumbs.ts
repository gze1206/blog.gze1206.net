/**
 * 책 표지 썸네일을 빌드 끝에 만드는 통합 (NOR-225).
 *
 * `public/assets/books` 의 표지마다 `COVER_WIDTHS` 너비의 WebP 를 `dist/assets/books/_w/` 에 쓴다.
 * 페이지는 `coverImage` 로 이 주소를 가리키므로, 표지를 읽지 못하면 빌드를 멈춘다 — 없는 파일을
 * 가리키는 HTML 을 배포하느니 배포를 막는 편이 낫다.
 */
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import sharp from 'sharp';
import { COVER_EXTENSIONS, COVER_WIDTHS, coverThumbName } from '../lib/book-cover';

/** 만든 표지 수를 돌려준다. 폴더가 없으면 0 이다. */
export async function writeCoverThumbs(sourceDir: string, outDir: string): Promise<number> {
  let names: string[];
  try {
    names = (await readdir(sourceDir)).filter((name) => COVER_EXTENSIONS.test(name));
  } catch {
    return 0;
  }
  await mkdir(outDir, { recursive: true });
  for (const name of names) {
    try {
      for (const width of COVER_WIDTHS)
        await sharp(join(sourceDir, name))
          .rotate()
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toFile(join(outDir, coverThumbName(name, width)));
    } catch (error) {
      throw new Error(`[book-cover-thumbs] 표지를 읽지 못했습니다: ${name}`, { cause: error });
    }
  }
  return names.length;
}

export function bookCoverThumbs(): AstroIntegration {
  let publicDir: URL;
  return {
    name: 'book-cover-thumbs',
    hooks: {
      'astro:config:done': ({ config }) => {
        publicDir = config.publicDir;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const count = await writeCoverThumbs(
          fileURLToPath(new URL('assets/books/', publicDir)),
          fileURLToPath(new URL('assets/books/_w/', dir)),
        );
        logger.info(`책 표지 ${count}개의 썸네일을 만들었습니다.`);
      },
    },
  };
}
