/**
 * `public/favicon.svg` 로부터 `public/favicon.ico` 를 만든다 (NOR-149).
 *
 * SVG 파비콘을 못 읽는 환경(구형 브라우저·일부 피드 리더·크롤러)이 남아 있어 `.ico` 를
 * 함께 둔다. ICO 컨테이너 안에 PNG 를 그대로 넣는 형식이며, Windows Vista 이후의 모든
 * 브라우저가 읽는다 — BMP 로 굽지 않아 파일이 작다.
 *
 * 마크를 고칠 때마다 손으로 다시 그리지 말고 이 스크립트를 돌린다:
 *   node scripts/generate-favicon-ico.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'public/favicon.svg';
const TARGET = 'public/favicon.ico';
/** 탭(16)과 북마크·바로가기(32). 그 이상 해상도는 SVG 가 담당한다. */
export const ICO_SIZES = [16, 32];

/**
 * PNG 들을 ICO 컨테이너 하나로 묶는다.
 *
 * @param {readonly {size: number, png: Buffer}[]} images 크기 오름차순 이미지
 * @returns {Buffer} ICO 파일 바이트
 */
export function buildIco(images) {
  if (images.length === 0) throw new Error('ICO 에는 이미지가 최소 하나 필요하다');

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  // 첫 이미지 데이터는 헤더와 디렉터리 전체 뒤에서 시작한다.
  let offset = header.length + 16 * images.length;

  for (const { size, png } of images) {
    if (size < 1 || size > 256) throw new Error(`ICO 크기는 1~256 이어야 한다: ${size}`);
    const entry = Buffer.alloc(16);
    // 256 은 0 으로 적는다 — 이 필드는 1바이트다.
    entry.writeUInt8(size === 256 ? 0 : size, 0); // width
    entry.writeUInt8(size === 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // palette colors
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

/** CLI 진입점. 테스트에서 import 할 때는 실행되지 않는다. */
async function main() {
  // sharp 는 무겁고 네이티브라, 실제로 파일을 구울 때만 불러온다.
  const { default: sharp } = await import('sharp');
  const svg = readFileSync(SOURCE);

  const images = [];
  for (const size of ICO_SIZES) {
    // density 를 올려 두지 않으면 sharp 가 SVG 를 96dpi 로 먼저 래스터화해 가장자리가 뭉갠다.
    const png = await sharp(svg, { density: 384 })
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer();
    images.push({ size, png });
  }

  const ico = buildIco(images);
  writeFileSync(TARGET, ico);
  console.log(`${TARGET} — ${ICO_SIZES.join('/')}px, ${ico.length} bytes`);
}

if (process.argv[1]?.endsWith('generate-favicon-ico.mjs')) {
  await main();
}
