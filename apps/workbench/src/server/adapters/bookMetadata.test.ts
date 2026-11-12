import { describe, expect, it, vi } from 'vitest';

import { HttpBookMetadataProvider } from './bookMetadata.js';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as unknown as Response;
}

describe('HttpBookMetadataProvider', () => {
  const isbn = '9788901234567';

  it('Open Library 를 먼저 보고 거기서 찾으면 Google Books 는 부르지 않는다', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ [`ISBN:${isbn}`]: { title: '니체의 초월자' } }),
    );
    const provider = new HttpBookMetadataProvider({ fetch: fetchImpl as never });

    const result = await provider.lookup(isbn);

    expect(result?.title).toBe('니체의 초월자');
    expect(result?.source).toBe('Open Library');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('Open Library 가 비면 Google Books 로 넘어간다', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ items: [{ volumeInfo: { title: '두 번째 기회' } }] }));
    const provider = new HttpBookMetadataProvider({ fetch: fetchImpl as never });

    const result = await provider.lookup(isbn);

    expect(result?.title).toBe('두 번째 기회');
    expect(result?.source).toBe('Google Books');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('제공처가 죽어도 예외를 던지지 않는다 — 조회 실패가 등록을 막아서는 안 된다', async () => {
    const provider = new HttpBookMetadataProvider({
      fetch: vi.fn(async () => {
        throw new Error('network down');
      }) as never,
    });

    await expect(provider.lookup(isbn)).resolves.toBeNull();
  });

  it('ISBN 이 아니면 부르지도 않는다', async () => {
    const fetchImpl = vi.fn();
    const provider = new HttpBookMetadataProvider({ fetch: fetchImpl as never });

    await expect(provider.lookup('책 제목')).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
