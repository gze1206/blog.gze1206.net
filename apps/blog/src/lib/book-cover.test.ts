import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { coverImage } from './book-cover';

const cover = { src: '/assets/books/니체의-초월자.jpg', width: 680, height: 1024 };

describe('책 표지 반응형 이미지 (NOR-225)', () => {
  it('NOR-225 AC-1: 표지 폴더의 이미지는 세 너비의 WebP srcset 을 준다', () => {
    const image = coverImage(cover, '10rem', true);
    expect(image.src).toBe('/assets/books/_w/니체의-초월자.480.webp');
    expect(image.srcset).toBe(
      [120, 240, 480].map((w) => `/assets/books/_w/니체의-초월자.${w}.webp ${w}w`).join(', '),
    );
    expect(image.sizes).toBe('10rem');
    expect(image).toMatchObject({ width: 680, height: 1024 });
  });

  it('NOR-225 AC-1: 다른 경로나 개발 모드에서는 원본만 쓴다', () => {
    expect(coverImage({ ...cover, src: '/img/books/a.webp' }, '10rem', true)).toEqual({
      src: '/img/books/a.webp',
      width: 680,
      height: 1024,
    });
    expect(coverImage(cover, '10rem', false)).toEqual(cover);
  });

  it('NOR-225 AC-3: 책장·책 상세·소개 페이지의 표지는 coverImage 를 쓴다', async () => {
    for (const page of [
      '../pages/books/index.astro',
      '../pages/books/[id].astro',
      '../pages/about.astro',
    ]) {
      const source = await readFile(new URL(page, import.meta.url), 'utf8');
      expect(source, page).toContain('coverImage(');
      expect(source, page).not.toMatch(/src=\{[^}]*cover\.src\}/u);
    }
  });
});
