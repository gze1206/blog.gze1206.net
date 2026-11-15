import path from 'node:path';

/**
 * 포트폴리오 카드의 대표 이미지 (NOR-222 AC-3).
 *
 * 썸네일은 스키마가 경로만 담는다. 크기를 모르면 이미지가 도착할 때 레이아웃이 밀리므로, 빌드할 때
 * 파일에서 읽는다. 파일이 없거나 읽지 못하면 그리지 않는다 — 깨진 이미지보다 없는 편이 낫다.
 */
interface PortfolioCover {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

type ReadSize = (src: string) => Promise<{ width: number; height: number } | null>;

export async function portfolioCover(
  entry: { readonly title: string; readonly thumbnail?: string | undefined },
  readSize: ReadSize = readPublicImageSize,
): Promise<PortfolioCover | null> {
  if (!entry.thumbnail) return null;
  const size = await readSize(entry.thumbnail);
  if (!size) return null;
  return { src: entry.thumbnail, alt: `${entry.title} 대표 이미지`, ...size };
}

/** `public/` 아래 이미지의 크기. 사이트 안 경로만 받는다. */
async function readPublicImageSize(src: string): Promise<{ width: number; height: number } | null> {
  if (!/^\/(?!\/)[A-Za-z0-9._~/-]+$/u.test(src) || src.split('/').includes('..')) return null;
  try {
    const { default: sharp } = await import('sharp');
    const meta = await sharp(path.join(process.cwd(), 'public', src)).metadata();
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
  } catch {
    return null;
  }
}
