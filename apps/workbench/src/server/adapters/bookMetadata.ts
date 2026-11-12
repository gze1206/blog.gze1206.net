import {
  normalizeIsbn,
  parseGoogleBooks,
  parseOpenLibrary,
  type BookMetadata,
  type BookMetadataProvider,
} from '../../core/books/metadata.js';

/**
 * 키 없이 쓸 수 있는 서지정보 제공처 (NOR-189).
 *
 * Open Library 를 먼저 보고, 비면 Google Books 를 본다. 둘 다 키가 필요 없어 지금 바로 쓸 수
 * 있지만 국내서 커버리지가 들쭉날쭉하다. 그래서 **제공처를 갈아끼울 자리**를 포트로 남긴다 —
 * 네이버 책이나 국립중앙도서관으로 바꿀 때 이 파일 하나만 바꾸면 된다.
 *
 * 조회는 **등록하는 순간 한 번**이다. 화면을 그릴 때마다 남의 서버를 부르지 않는다.
 */
export interface HttpBookMetadataProviderOptions {
  /** 테스트가 갈아끼운다. 기본은 런타임의 `fetch`. */
  readonly fetch?: typeof globalThis.fetch;
  /** 남의 서버가 느릴 때 등록 화면이 함께 멈추지 않도록 자른다. */
  readonly timeoutMs?: number;
}

export class HttpBookMetadataProvider implements BookMetadataProvider {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  public constructor(options: HttpBookMetadataProviderOptions = {}) {
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  public async lookup(isbn: string): Promise<BookMetadata | null> {
    const isbn13 = normalizeIsbn(isbn);
    if (isbn13 === null) return null;

    const openLibrary = await this.read(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn13}&format=json&jscmd=data`,
    );
    const fromOpenLibrary = openLibrary === null ? null : parseOpenLibrary(openLibrary, isbn13);
    if (fromOpenLibrary !== null) return fromOpenLibrary;

    const google = await this.read(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn13}`);
    return google === null ? null : parseGoogleBooks(google, isbn13);
  }

  /** 조회 실패는 등록을 막지 않는다. 제목·저자만으로도 책 항목은 성립한다. */
  private async read(url: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
