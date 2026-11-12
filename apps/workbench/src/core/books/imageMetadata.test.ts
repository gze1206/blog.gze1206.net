import { expect, it } from 'vitest';
import { findImageMetadata } from './imageSize.js';

it('NOR-196 AC-13: JPEG·PNG·WebP 메타데이터를 찾고 잘린 데이터를 안전하게 처리한다', () => {
  const jpeg = Buffer.concat([
    Buffer.from([255, 216, 255, 225, 0, 8]),
    Buffer.from('Exif\0\0'),
    Buffer.from([255, 217]),
  ]);
  const png = Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    Buffer.from('000000007445587400000000000000006558496600000000', 'hex'),
  ]);
  const webp = Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.from([12, 0, 0, 0]),
    Buffer.from('WEBPEXIF', 'ascii'),
    Buffer.alloc(4),
  ]);
  expect(typeof findImageMetadata).toBe('function');
  expect(findImageMetadata(jpeg)).toEqual(['Exif']);
  expect(findImageMetadata(png)).toEqual(['tEXt', 'eXIf']);
  expect(findImageMetadata(webp)).toEqual(['EXIF']);
  expect(findImageMetadata(png.subarray(0, 14))).toEqual([]);
});
