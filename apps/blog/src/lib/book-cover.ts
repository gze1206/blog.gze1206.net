/**
 * 책 표지의 반응형 이미지 (NOR-225).
 *
 * 표지는 원본(예: 680×1024 JPEG, 268KB)으로 올라오지만 화면에는 많아야 176px 너비로 보인다. 빌드가
 * `bookCoverThumbs` 로 세 너비의 WebP 를 만들어 두고, 여기서는 그 주소로 `srcset` 을 짠다.
 * 썸네일이 없는 경우(표지 폴더 밖의 경로, 개발 서버)에는 원본을 그대로 쓴다.
 */
export const COVER_WIDTHS = [120, 240, 480] as const;

/** 썸네일을 만드는 표지 폴더와 확장자. 빌드 통합과 같은 규칙이다. */
const COVER_DIR = '/assets/books/';
export const COVER_EXTENSIONS = /\.(?:jpe?g|png|webp)$/iu;

interface Cover {
  readonly src: string;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

interface CoverImage {
  readonly src: string;
  readonly srcset?: string;
  readonly sizes?: string;
  readonly width?: number | undefined;
  readonly height?: number | undefined;
}

/** 썸네일 파일 이름. 원본 이름에서 확장자를 떼고 너비를 붙인다. */
export function coverThumbName(fileName: string, width: number): string {
  return `${fileName.replace(COVER_EXTENSIONS, '')}.${width}.webp`;
}

export function coverImage(
  cover: Cover,
  sizes: string,
  enabled: boolean = !import.meta.env.DEV,
): CoverImage {
  const original = { src: cover.src, width: cover.width, height: cover.height };
  if (!enabled || !cover.src.startsWith(COVER_DIR)) return original;
  const fileName = cover.src.slice(COVER_DIR.length);
  if (fileName.includes('/') || !COVER_EXTENSIONS.test(fileName)) return original;
  const url = (width: number) => `${COVER_DIR}_w/${coverThumbName(fileName, width)}`;
  return {
    ...original,
    src: url(COVER_WIDTHS[2]),
    srcset: COVER_WIDTHS.map((width) => `${url(width)} ${width}w`).join(', '),
    sizes,
  };
}
