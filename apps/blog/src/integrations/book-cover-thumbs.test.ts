import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { writeCoverThumbs } from './book-cover-thumbs';

async function image(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#336699' } })
    .jpeg()
    .toBuffer();
}

describe('표지 썸네일 생성 (NOR-225)', () => {
  it('NOR-225 AC-2: 표지마다 세 너비의 WebP 를 만들고 원본보다 키우지 않는다', async () => {
    const source = await mkdtemp(join(tmpdir(), 'covers-'));
    const out = await mkdtemp(join(tmpdir(), 'thumbs-'));
    await writeFile(join(source, '큰-책.jpg'), await image(680, 1024));
    await writeFile(join(source, 'small.png'), await image(200, 300));
    await writeFile(join(source, 'notes.txt'), 'not an image');

    await expect(writeCoverThumbs(source, out)).resolves.toBe(2);

    const files = (await readdir(out)).sort();
    expect(files).toEqual(
      [
        'small.120.webp',
        'small.240.webp',
        'small.480.webp',
        '큰-책.120.webp',
        '큰-책.240.webp',
        '큰-책.480.webp',
      ].sort(),
    );
    const big = await sharp(join(out, '큰-책.240.webp')).metadata();
    expect(big).toMatchObject({ format: 'webp', width: 240 });
    const small = await sharp(join(out, 'small.480.webp')).metadata();
    expect(small.width).toBe(200);
  });

  it('NOR-225 AC-2: 읽지 못하는 표지가 있으면 실패한다', async () => {
    const source = await mkdtemp(join(tmpdir(), 'covers-'));
    await writeFile(join(source, 'broken.jpg'), 'not a jpeg');
    await expect(
      writeCoverThumbs(source, await mkdtemp(join(tmpdir(), 'thumbs-'))),
    ).rejects.toThrow('broken.jpg');
  });

  it('NOR-225 AC-2: 표지 폴더가 없으면 아무것도 만들지 않는다', async () => {
    await expect(writeCoverThumbs(join(tmpdir(), 'no-such-dir-nor-225'), tmpdir())).resolves.toBe(
      0,
    );
  });
});
