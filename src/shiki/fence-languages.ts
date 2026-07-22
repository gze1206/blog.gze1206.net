/**
 * `.mdoc` 본문이 쓰는 코드블럭 언어를 빌드 시작 전에 알아내기 위한 스캐너 (NOR-17).
 *
 * ### 왜 필요한가
 *
 * `markdoc.config.mjs` 의 `fence` 트랜스폼은 원래 `highlighter.loadLanguage(lang)` 를
 * **await** 했다. 그런데 Markdoc 은 자식 트랜스폼 중 하나라도 Promise 를 돌려주면
 * `Markdoc.transform()` **전체**가 Promise 가 된다(`@markdoc/markdoc` 의 `transformer.children`).
 *
 * `@astrojs/markdoc` 의 헤딩 수집기(`collectHeadings`)는 그 반환값을 **동기로** 훑는다.
 * 그래서 코드블럭이 하나라도 있는 `.mdoc` 글은 `render()` 의 `headings` 가 **조용히 빈 배열**이
 * 되고, 목차가 통째로 사라진다. (`.md` 는 rehype 경로라 이 문제가 없어서 더 눈에 안 띈다.)
 *
 * 그래서 언어를 **미리** 로드해 두고 트랜스폼을 동기로 유지한다. 어떤 언어를 미리 로드할지는
 * 콘텐츠가 알고 있으므로, 빌드마다 원본을 훑어서 그대로 쓴다.
 */

import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

/** 펜스 여닫는 줄. 여는 줄이면 정보 문자열(```ts title="a.ts")이 뒤에 붙는다. */
const FENCE_LINE = /^[ \t]*(`{3,}|~{3,})[ \t]*(.*)$/;

/** `markdoc.config.mjs` 의 fence 트랜스폼과 같은 방식으로 title 메타를 떼어낸다. */
const TITLE_META = /\btitle="[^"]+"/;

/**
 * 소스 한 편에서 쓰인 펜스 코드블럭 언어 이름을 **등장 순서대로, 중복 없이** 모은다.
 *
 * 언어가 없는 펜스(```)는 결과에 넣지 않는다 — 트랜스폼이 `plaintext` 로 처리하고,
 * `plaintext` 는 하이라이터 생성 시점에 이미 로드돼 있다.
 */
export function extractFenceLanguages(source: string): string[] {
  const found: string[] = [];
  let openFence: string | null = null;

  for (const line of source.split('\n')) {
    const match = FENCE_LINE.exec(line);
    if (match === null) continue;

    const fence = match[1] ?? '';
    const info = match[2] ?? '';

    if (openFence !== null) {
      // 닫는 펜스는 같은 문자·같은 길이 이상. 그 전까지는 전부 코드 내용이다.
      if (fence[0] === openFence[0] && fence.length >= openFence.length) openFence = null;
      continue;
    }

    openFence = fence;
    const lang = info.replace(TITLE_META, '').trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (lang.length > 0 && !found.includes(lang)) found.push(lang);
  }

  return found;
}

/** 디렉터리를 재귀로 훑어 확장자가 맞는 파일 경로를 모은다. 없는 디렉터리는 빈 목록. */
async function listFiles(dir: URL, extension: string): Promise<URL[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: URL[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...(await listFiles(new URL(`${entry.name}/`, dir), extension)));
    } else if (entry.name.endsWith(extension)) {
      files.push(new URL(entry.name, dir));
    }
  }

  return files;
}

/**
 * `.mdoc` 콘텐츠가 쓰는 코드블럭 언어 전체(정렬됨).
 *
 * draft 글도 포함한다 — 개발 서버에서도 같은 트랜스폼을 타기 때문이다.
 *
 * 경로를 `process.cwd()` 에 앵커한다. `markdoc.config.mjs` 는 빌드 중 **두 번** 로드되는데
 * (설정 로드 시 esbuild 번들로 한 번, SSR 번들 안에서 한 번) 두 번째 인스턴스에서는
 * `import.meta.url` 이 `dist/.prerender/chunks/...` 라 상대 경로가 어긋난다. 프로세스는 하나이므로
 * cwd 는 두 경우 모두 프로젝트 루트다. 어긋나면 조용히 틀리지 않고 트랜스폼이 경고를 남긴다.
 *
 * @param contentDir 콘텐츠 루트. 기본값은 `<cwd>/src/content/`.
 */
export async function collectMdocFenceLanguages(
  contentDir: URL = new URL('src/content/', pathToFileURL(`${process.cwd()}/`)),
): Promise<string[]> {
  const files = await listFiles(contentDir, '.mdoc');
  const sources = await Promise.all(files.map((file) => readFile(file, 'utf-8')));
  return [...new Set(sources.flatMap(extractFenceLanguages))].sort();
}
