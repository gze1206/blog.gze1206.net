import { expect, it } from 'vitest';
import { readImageSize } from './imageSize.js';

it('NOR-196 AC-13: readImageSize 는 PNG·JPEG·WebP 헤더에서 크기를 읽고 모르는 형식은 null', () => {
  const png = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 10, 0, 0, 0, 20,
  ]);
  const jpeg = Uint8Array.from([255, 216, 255, 192, 0, 11, 8, 0, 20, 0, 10, 1, 1, 17, 0, 255, 217]);
  const riff = [82, 73, 70, 70, 30, 0, 0, 0, 87, 69, 66, 80];
  const vp8 = Uint8Array.from([
    ...riff,
    86,
    80,
    56,
    32,
    10,
    0,
    0,
    0,
    0,
    0,
    0,
    157,
    1,
    42,
    10,
    0,
    20,
    0,
  ]);
  const vp8l = Uint8Array.from([...riff, 86, 80, 56, 76, 5, 0, 0, 0, 47, 9, 192, 4, 0]);
  const vp8x = Uint8Array.from([
    ...riff,
    86,
    80,
    56,
    88,
    10,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    9,
    0,
    0,
    19,
    0,
    0,
  ]);
  for (const [bytes, type] of [
    [png, 'png'],
    [jpeg, 'jpeg'],
    [vp8, 'webp'],
    [vp8l, 'webp'],
    [vp8x, 'webp'],
  ] as const) {
    expect(readImageSize(bytes)).toEqual({ width: 10, height: 20, type });
    expect(readImageSize(bytes.subarray(0, 10))).toBeNull();
  }
  expect(readImageSize(Uint8Array.from([1, 2, 3]))).toBeNull();
});

it('NOR-196 AC-13: 표지의 가로 또는 세로가 10000px을 넘으면 거부한다', () => {
  const bytes = Buffer.from('89504e470d0a1a0a0000000d494844520000271100000001', 'hex');
  expect(readImageSize(bytes)).toBeNull();
  bytes.writeUInt32BE(10000, 16);
  bytes.writeUInt32BE(10001, 20);
  expect(readImageSize(bytes)).toBeNull();
  bytes.writeUInt32BE(10000, 20);
  expect(readImageSize(bytes)).toEqual({ width: 10000, height: 10000, type: 'png' });
});
