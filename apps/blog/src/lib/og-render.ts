/**
 * OG 이미지 렌더 파이프라인 — Satori(SVG) → sharp(PNG) (NOR-28).
 *
 * **빌드타임 전용**이다. 프로덕션은 완전 정적이므로(ADR 0012) 이 코드는 `astro build` 가
 * 정적 파일을 뽑는 동안에만 돌고, 배포된 사이트에는 남지 않는다.
 *
 * 세 가지 원칙:
 *
 * 1. **네트워크를 타지 않는다.** 폰트는 저장소에 들어 있는 파일을 읽는다. 빌드가 외부
 *    가용성에 의존하면 재현성이 깨지고 오프라인 빌드가 막힌다.
 * 2. **던지지 않는다.** {@link renderOgImageOrFallback} 는 어떤 실패에도 경고만 남기고
 *    기본 이미지를 돌려준다. OG 이미지 한 장 때문에 블로그 배포가 막히면 안 된다.
 * 3. **다시 그리지 않는다.** 같은 입력이면 온디스크 캐시에서 바로 꺼낸다.
 *
 * 왜 sharp 인가: 저장소가 이미 `sharp` 에 의존한다(Astro 이미지 최적화). Satori 는
 * `embedFont` 기본값대로 글리프를 `<path>` 로 심어 SVG 를 내보내므로, 래스터라이저 쪽에
 * 폰트가 없어도 한글이 그대로 나온다. 네이티브 의존성을 하나 더 늘릴 이유가 없다.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import satori, { type SatoriOptions } from 'satori';
import sharp from 'sharp';
import {
  buildOgCard,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_THEME,
  type OgCardInput,
} from './og-card';
import { withBinaryCache } from './og-cache';

/**
 * 템플릿 **구조**를 바꿨을 때 올린다. 색·간격 같은 토큰 값은 {@link OG_THEME} 자체가
 * 캐시 키에 들어가므로 따로 올리지 않아도 캐시가 자동으로 무효화된다.
 */
const RENDERER_VERSION = 'v1';

/** 저장소에 커밋된 폰트. 출처·라이선스는 `src/assets/fonts/README.md`, 근거는 ADR 0014. */
const FONT_SOURCES = [
  { file: 'Pretendard-Regular.otf', weight: 400 },
  { file: 'Pretendard-Bold.otf', weight: 700 },
] as const;

const FONT_DIR = join('src', 'assets', 'fonts');
/** 생성 실패 시 대신 내보내는 정적 이미지 (NOR-27 이 두고 간 것). */
const FALLBACK_IMAGE = join('public', 'og-default.png');

/** 경로는 프로젝트 루트 기준이다 — `astro dev`/`astro build` 모두 루트에서 실행된다. */
function projectPath(...segments: string[]): string {
  return join(process.cwd(), ...segments);
}

let fontsPromise: Promise<SatoriOptions['fonts']> | null = null;

/** 폰트를 한 번만 읽어 재사용한다. 빌드 한 번에 파일을 수십 번 읽을 이유가 없다. */
async function loadFonts(): Promise<SatoriOptions['fonts']> {
  fontsPromise ??= Promise.all(
    FONT_SOURCES.map(async ({ file, weight }) => ({
      name: OG_THEME.fontFamily,
      data: await readFile(projectPath(FONT_DIR, file)),
      weight,
      style: 'normal' as const,
    })),
  );
  return fontsPromise;
}

let fallbackPromise: Promise<Buffer> | null = null;

/** 폴백 이미지. 정적 파일도 못 읽으면 단색 PNG 라도 만들어 낸다(참조가 깨지는 것보다 낫다). */
async function loadFallbackImage(): Promise<Buffer> {
  fallbackPromise ??= readFile(projectPath(FALLBACK_IMAGE)).catch(() =>
    sharp({
      create: {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        channels: 3,
        background: OG_THEME.background,
      },
    })
      .png()
      .toBuffer(),
  );
  return fallbackPromise;
}

function cacheKey(input: OgCardInput): string {
  // 테마 토큰까지 키에 넣어, 색을 바꾸면 캐시가 저절로 무효화되게 한다.
  return JSON.stringify({
    version: RENDERER_VERSION,
    size: [OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT],
    theme: OG_THEME,
    input,
  });
}

/** 카드 한 장을 PNG 로 만든다. 실패하면 던진다 — 폴백은 호출부가 아니라 아래 함수가 맡는다. */
export async function renderOgImage(input: OgCardInput): Promise<Buffer> {
  return withBinaryCache({ namespace: 'card', key: cacheKey(input) }, async () => {
    const svg = await satori(
      // Satori 는 React 요소를 받지만 실제로는 `{type, props}` 구조만 본다. React 를
      // 끌어들이지 않으려고 plain object 를 넘기고 여기서만 타입을 맞춘다.
      buildOgCard(input) as unknown as Parameters<typeof satori>[0],
      {
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        fonts: await loadFonts(),
      },
    );
    return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
  });
}

/**
 * 카드 한 장을 PNG 로 만들되, **무슨 일이 있어도 유효한 PNG 를 돌려준다.**
 *
 * 그래서 `og:image` 가 가리키는 URL 은 항상 실재한다 — 생성이 실패한 글도 기본 이미지가
 * 같은 URL 로 나가므로 SNS 쪽에서 보면 깨진 참조가 아니다.
 */
export async function renderOgImageOrFallback(input: OgCardInput): Promise<Buffer> {
  try {
    return await renderOgImage(input);
  } catch (error) {
    console.warn(
      `[og-image] "${input.title}" 카드 생성 실패 — 기본 이미지로 대체합니다:`,
      error instanceof Error ? error.message : error,
    );
    return loadFallbackImage();
  }
}
