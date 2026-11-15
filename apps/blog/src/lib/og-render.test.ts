import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, type OgCardInput } from './og-card';

/**
 * 렌더 파이프라인이 **실제로 도는지** 확인한다 — 폰트 파일이 자리에 있고, Satori 가 트리를
 * 받아들이고, sharp 가 규격대로 PNG 를 뽑는지. 이 셋 중 하나만 어긋나도 OG 이미지는 조용히
 * 기본 이미지로 대체되므로(그게 설계다) 테스트가 없으면 알아채기 어렵다.
 *
 * 한글이 **두부(□)가 아닌지**는 픽셀을 봐야 알 수 있어 여기서 검사하지 않는다.
 * 생성된 PNG 를 직접 열어 확인한다 (spec NOR-28 의 검증 항목).
 */

const CARD: OgCardInput = {
  kind: 'post',
  title: '한글 제목이 두부 없이 렌더되는지 확인한다',
  eyebrow: '시리즈 · Astro 가이드',
  brand: 'gze1206.net',
};

let cacheDir: string;

beforeAll(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), 'og-render-'));
  process.env.OG_CACHE_DIR = cacheDir;
});

afterAll(async () => {
  delete process.env.OG_CACHE_DIR;
  await rm(cacheDir, { recursive: true, force: true });
});

describe('renderOgImage', () => {
  it('1200×630 PNG 를 만든다', async () => {
    const { renderOgImage } = await import('./og-render');
    const png = await renderOgImage(CARD);

    expect(
      png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe(true);
    const meta = await sharp(png).metadata();
    expect(meta.width).toBe(OG_IMAGE_WIDTH);
    expect(meta.height).toBe(OG_IMAGE_HEIGHT);
    expect(meta.format).toBe('png');
  }, 30_000);

  it('제목이 다르면 다른 이미지가 나온다 (캐시가 글을 뒤섞지 않는다)', async () => {
    const { renderOgImage } = await import('./og-render');
    const a = await renderOgImage(CARD);
    const b = await renderOgImage({ ...CARD, title: '다른 제목' });
    expect(a.equals(b)).toBe(false);
    // 같은 입력은 같은 바이트 (캐시 히트)
    expect((await renderOgImage(CARD)).equals(a)).toBe(true);
  }, 30_000);
});

describe('renderOgImageOrFallback', () => {
  it('렌더가 실패하면 던지지 않고 기본 이미지를 돌려준다', async () => {
    vi.resetModules();
    vi.doMock('satori', () => ({
      default: () => {
        throw new Error('의도적 실패');
      },
    }));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { renderOgImageOrFallback } = await import('./og-render');
    const png = await renderOgImageOrFallback({ ...CARD, title: '실패해도 빌드는 계속된다' });

    const fallback = await readFile(join(process.cwd(), 'public', 'og-default.png'));
    expect(png.equals(fallback)).toBe(true);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
    vi.doUnmock('satori');
    vi.resetModules();
  }, 30_000);
});
