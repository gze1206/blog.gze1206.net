import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchOpenGraph, isFetchableUrl, parseOpenGraph } from './open-graph';

const BASE = 'https://example.com/post';

function htmlPage(head: string): string {
  return `<!doctype html><html><head>${head}</head><body>본문</body></html>`;
}

function htmlResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isFetchableUrl', () => {
  it('http/https 절대 URL 만 허용한다', () => {
    expect(isFetchableUrl('https://example.com')).toBe(true);
    expect(isFetchableUrl('http://example.com/a?b=1')).toBe(true);
  });

  it('비 http(s) 스킴과 상대 경로를 거부한다', () => {
    expect(isFetchableUrl('javascript:alert(1)')).toBe(false);
    expect(isFetchableUrl('file:///etc/passwd')).toBe(false);
    expect(isFetchableUrl('/relative/path')).toBe(false);
    expect(isFetchableUrl('')).toBe(false);
  });
});

describe('parseOpenGraph', () => {
  it('og:* 메타를 추출한다', () => {
    const html = htmlPage(`
      <meta property="og:title" content="제목" />
      <meta property="og:description" content="설명" />
      <meta property="og:image" content="https://cdn.example.com/a.png" />
      <meta property="og:site_name" content="예시 사이트" />
    `);
    expect(parseOpenGraph(html, BASE)).toEqual({
      title: '제목',
      description: '설명',
      image: 'https://cdn.example.com/a.png',
      siteName: '예시 사이트',
    });
  });

  it('og 가 없으면 title 태그와 meta[name=description] 로 폴백한다', () => {
    const html = htmlPage(`
      <title>  타이틀 태그  </title>
      <meta name="description" content="일반 설명" />
    `);
    const meta = parseOpenGraph(html, BASE);
    expect(meta?.title).toBe('타이틀 태그');
    expect(meta?.description).toBe('일반 설명');
    expect(meta?.image).toBeUndefined();
  });

  it('twitter:* 메타도 폴백으로 인정한다', () => {
    const html = htmlPage(`
      <meta name="twitter:title" content="트위터 제목" />
      <meta name="twitter:image" content="https://cdn.example.com/t.png" />
    `);
    const meta = parseOpenGraph(html, BASE);
    expect(meta?.title).toBe('트위터 제목');
    expect(meta?.image).toBe('https://cdn.example.com/t.png');
  });

  it('속성 순서가 뒤바뀌거나 작은따옴표/대문자여도 파싱한다', () => {
    const html = htmlPage(`
      <META CONTENT='역순 제목' PROPERTY='OG:TITLE'>
      <meta content="역순 설명" property=og:description>
    `);
    const meta = parseOpenGraph(html, BASE);
    expect(meta?.title).toBe('역순 제목');
    expect(meta?.description).toBe('역순 설명');
  });

  it('HTML 엔티티를 디코드한다', () => {
    const html = htmlPage(
      `<meta property="og:title" content="A &amp; B &quot;인용&quot; &#39;작은&#39; &lt;태그&gt; &#x41;">`,
    );
    expect(parseOpenGraph(html, BASE)?.title).toBe(`A & B "인용" '작은' <태그> A`);
  });

  it('상대 og:image 를 기준 URL 로 절대화한다', () => {
    const html = htmlPage(`<meta property="og:image" content="/img/cover.png">`);
    expect(parseOpenGraph(html, 'https://example.com/blog/post')?.image).toBe(
      'https://example.com/img/cover.png',
    );
  });

  it('http(s) 가 아닌 이미지는 버린다', () => {
    const html = htmlPage(`
      <meta property="og:title" content="제목">
      <meta property="og:image" content="data:image/png;base64,AAAA">
    `);
    expect(parseOpenGraph(html, BASE)?.image).toBeUndefined();
  });

  it('쓸 수 있는 메타가 하나도 없으면 null 을 반환한다', () => {
    expect(parseOpenGraph(htmlPage('<meta charset="utf-8">'), BASE)).toBeNull();
    expect(parseOpenGraph('', BASE)).toBeNull();
  });

  it('빈 content 는 값으로 치지 않는다', () => {
    const html = htmlPage(`
      <meta property="og:title" content="   ">
      <meta property="og:description" content="설명만 있다">
    `);
    const meta = parseOpenGraph(html, BASE);
    expect(meta?.title).toBeUndefined();
    expect(meta?.description).toBe('설명만 있다');
  });
});

describe('fetchOpenGraph', () => {
  it('정상 응답을 파싱한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse(htmlPage(`<meta property="og:title" content="원격 제목">`))),
    );
    await expect(fetchOpenGraph(BASE)).resolves.toEqual({
      title: '원격 제목',
      description: undefined,
      image: undefined,
      siteName: undefined,
    });
  });

  it('타임아웃을 위한 AbortSignal 을 붙인다', async () => {
    const spy = vi.fn(async () => htmlResponse(htmlPage(`<title>x</title>`)));
    vi.stubGlobal('fetch', spy);
    await fetchOpenGraph(BASE);
    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('네트워크 오류에서 예외 없이 null 을 반환한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('ECONNREFUSED');
      }),
    );
    await expect(fetchOpenGraph('https://unreachable.invalid')).resolves.toBeNull();
  });

  it('4xx/5xx 응답에서 null 을 반환한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse('nope', { status: 404 })),
    );
    await expect(fetchOpenGraph(BASE)).resolves.toBeNull();
  });

  it('HTML 이 아닌 응답에서 null 을 반환한다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('%PDF-1.7', { status: 200, headers: { 'content-type': 'application/pdf' } }),
      ),
    );
    await expect(fetchOpenGraph(BASE)).resolves.toBeNull();
  });

  it('fetch 할 수 없는 URL 은 요청조차 하지 않는다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    await expect(fetchOpenGraph('javascript:alert(1)')).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('거대한 HTML 은 상한까지만 읽는다', async () => {
    const filler = '<!--' + 'x'.repeat(2 * 1024 * 1024) + '-->';
    const html = htmlPage(`<meta property="og:title" content="앞쪽 제목">`) + filler;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => htmlResponse(html)),
    );
    const meta = await fetchOpenGraph(BASE);
    expect(meta?.title).toBe('앞쪽 제목');
  });
});
