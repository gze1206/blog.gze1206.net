import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { atomicWriteFile, createDirectoryDurably } from './atomicWrite.js';
import { resolveWorkspacePath } from './paths.js';

/**
 * 표지 이미지를 작업 공간에 저장한다 (NOR-189).
 *
 * 링크로 걸지 않고 **받아서 둔다**. 남의 서버가 죽어도 목록이 깨지지 않고, 그 서버가 내
 * 방문자를 추적하지도 않는다. 받는 일은 책을 등록하는 순간 한 번뿐이다.
 *
 * 표지는 남의 서버에서 받아 오기도 하고(`saveCover`) 사람이 직접 올리기도 한다
 * (`saveCoverBytes`). 국내서는 제공처가 표지를 모르는 일이 흔하므로 올리는 쪽이 오히려 주다.
 */
const COVER_DIRECTORY = 'assets/books';
/** 표지 한 장이 이보다 크면 무언가 잘못된 것이다. */
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

export interface BookAssetStoreOptions {
  readonly workspaceRoot: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly timeoutMs?: number;
}

export class BookAssetStore {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  public constructor(private readonly options: BookAssetStoreOptions) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  /**
   * 표지를 받아 저장하고 작업 공간 기준 경로를 돌려준다.
   *
   * 실패하면 `null` 이다 — 표지가 없다고 책을 등록하지 못하게 만들지 않는다.
   */
  public async saveCover(key: string, url: string): Promise<string | null> {
    if (!/^https:\/\//u.test(url)) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal });
      if (!response.ok) return null;

      const bytes = Buffer.from(await response.arrayBuffer());
      return await this.saveCoverBytes(key, bytes, response.headers.get('content-type') ?? '');
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 저장해 둔 표지를 읽는다.
   *
   * 목록에 표지를 보이려면 브라우저가 파일을 볼 수 있어야 하는데, 작업 공간은 정적으로
   * 열어 두지 않는다. **이 디렉터리의 파일 하나**만 내주는 좁은 문으로 남긴다.
   */
  public async readCover(name: string): Promise<{ bytes: Buffer; contentType: string } | null> {
    const extension = path.extname(name).toLowerCase();
    const contentType = [...ALLOWED_TYPES].find(([, value]) => value === extension)?.[0];
    // 이름에 경로가 섞이면 `resolveWorkspacePath` 가 막지만, 그 전에 모양부터 거른다.
    if (contentType === undefined || name.includes('/') || name.includes('\\')) return null;

    try {
      const target = await resolveWorkspacePath(
        this.options.workspaceRoot,
        `${COVER_DIRECTORY}/${name}`,
      );
      return { bytes: await readFile(target), contentType };
    } catch {
      return null;
    }
  }

  /**
   * 사람이 직접 고른 표지 파일을 저장한다.
   *
   * 받아 온 것과 같은 검사를 거친다 — 종류와 크기를 여기 한 곳에서만 판단해야 두 경로가
   * 어긋나지 않는다.
   */
  public async saveCoverBytes(
    key: string,
    bytes: Uint8Array,
    contentType: string,
  ): Promise<string | null> {
    const extension = ALLOWED_TYPES.get(contentType.split(';')[0]?.trim() ?? '');
    if (extension === undefined) return null;
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_COVER_BYTES) return null;

    const relativePath = `${COVER_DIRECTORY}/${safeKey(key)}${extension}`;
    const target = await resolveWorkspacePath(this.options.workspaceRoot, relativePath);
    await createDirectoryDurably(path.dirname(target));
    await atomicWriteFile(target, bytes);
    return relativePath;
  }
}

/**
 * 파일 이름이 될 수 있는 글자만 남긴다. 경로가 밖으로 빠져나갈 여지를 없앤다.
 *
 * 한글을 남기는 것이 중요하다 — ASCII 만 남기면 ISBN 없는 국내서의 열쇠가 전부 빈 문자열이
 * 되어 서로의 표지를 덮어쓴다.
 */
function safeKey(key: string): string {
  const cleaned = key
    .normalize('NFC')
    .trim()
    // 띄어쓰기는 지우지 말고 이어 붙인다 — 책 문서 이름과 같은 모양이 되어 짝을 알아보기 쉽다.
    .replace(/\s+/gu, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '');
  return cleaned === '' ? 'cover' : cleaned.slice(0, 64);
}
