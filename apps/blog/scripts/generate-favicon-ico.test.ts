import { expect, it } from 'vitest';
import { buildIco, ICO_SIZES } from './generate-favicon-ico.mjs';

/** PNG 시그니처만 맞춘 더미. ICO 컨테이너는 내용물을 해석하지 않는다. */
function fakePng(byte: number, length: number): Buffer {
  const png = Buffer.alloc(length, byte);
  Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(png, 0);
  return png;
}

it('ICO 헤더는 아이콘 개수를 그대로 알린다', () => {
  const ico = buildIco([
    { size: 16, png: fakePng(1, 40) },
    { size: 32, png: fakePng(2, 60) },
  ]);

  expect(ico.readUInt16LE(0)).toBe(0); // reserved
  expect(ico.readUInt16LE(2)).toBe(1); // type: icon
  expect(ico.readUInt16LE(4)).toBe(2);
});

it('각 디렉터리 항목의 offset·length 가 실제 PNG 위치를 가리킨다', () => {
  const small = fakePng(1, 40);
  const large = fakePng(2, 60);

  const ico = buildIco([
    { size: 16, png: small },
    { size: 32, png: large },
  ]);

  const entries = [0, 1].map((index) => {
    const base = 6 + 16 * index;
    return {
      width: ico.readUInt8(base),
      height: ico.readUInt8(base + 1),
      length: ico.readUInt32LE(base + 8),
      offset: ico.readUInt32LE(base + 12),
    };
  });

  expect(entries[0]).toEqual({ width: 16, height: 16, length: 40, offset: 38 });
  expect(entries[1]).toEqual({ width: 32, height: 32, length: 60, offset: 78 });
  expect(ico.subarray(38, 78)).toEqual(small);
  expect(ico.subarray(78, 138)).toEqual(large);
  expect(ico.length).toBe(138);
});

it('256px 는 1바이트 필드에 0 으로 적는다', () => {
  const ico = buildIco([{ size: 256, png: fakePng(3, 10) }]);

  expect(ico.readUInt8(6)).toBe(0);
  expect(ico.readUInt8(7)).toBe(0);
});

it('빈 목록과 표현할 수 없는 크기는 거부한다', () => {
  expect(() => buildIco([])).toThrow(/최소 하나/);
  expect(() => buildIco([{ size: 512, png: fakePng(4, 10) }])).toThrow(/1~256/);
});

it('굽는 크기는 탭과 북마크 두 가지다', () => {
  expect(ICO_SIZES).toEqual([16, 32]);
});
