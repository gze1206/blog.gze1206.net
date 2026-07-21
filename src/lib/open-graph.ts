/**
 * URL 북마크 카드(`{% bookmark %}`)용 Open Graph 메타 취득.
 *
 * **빌드타임 전용**이다. 런타임 클라이언트 fetch 는 하지 않는다(ADR 0008).
 * 어떤 실패도 예외로 전파하지 않고 `null` 을 반환한다 — 호출부는 폴백 렌더로 받는다.
 */

/** 외부 요청 타임아웃. 무한 대기는 CI 를 잡아먹는 가장 흔한 실패 모드다. */
const TIMEOUT_MS = 5_000;
/** 메타는 `<head>` 에 있다. 본문까지 다 받을 이유가 없어 상한을 둔다. */
const MAX_HTML_BYTES = 512 * 1024;
const USER_AGENT = 'blog.gze1206.net bookmark-card (+https://gze1206.net)';

export interface OpenGraphMeta {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

/** http(s) 절대 URL 인지. `javascript:` 등 다른 스킴과 상대 경로를 걸러낸다. */
export function isFetchableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith('#x') || entity.startsWith('#X')) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    if (entity.startsWith('#')) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function clean(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim();
  return text.length > 0 ? text : undefined;
}

const META_TAG_RE = /<meta\b[^>]*>/gi;
const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/g;

/** `<meta>` 태그를 훑어 `property`/`name` → `content` 맵을 만든다(키는 소문자). */
function collectMeta(html: string): Map<string, string> {
  const result = new Map<string, string>();

  for (const [tag] of html.matchAll(META_TAG_RE)) {
    let key: string | undefined;
    let content: string | undefined;

    for (const attr of tag.matchAll(ATTR_RE)) {
      const name = (attr[1] ?? '').toLowerCase();
      const value = attr[2] ?? attr[3] ?? attr[4] ?? '';
      if (name === 'property' || name === 'name') key = value.toLowerCase();
      else if (name === 'content') content = value;
    }

    // 같은 키가 여러 번 나오면 첫 번째를 신뢰한다(og:image 다중 선언 등).
    if (key !== undefined && content !== undefined && !result.has(key)) {
      result.set(key, content);
    }
  }

  return result;
}

function pick(meta: Map<string, string>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = clean(meta.get(key));
    if (value !== undefined) return value;
  }
  return undefined;
}

function titleTag(html: string): string | undefined {
  return clean(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]);
}

function absoluteImage(value: string | undefined, baseUrl: string): string | undefined {
  if (value === undefined) return undefined;
  try {
    const resolved = new URL(value, baseUrl).href;
    return isFetchableUrl(resolved) ? resolved : undefined;
  } catch {
    return undefined;
  }
}

/**
 * HTML 문자열에서 카드에 쓸 메타를 뽑는다. 쓸 값이 하나도 없으면 `null`.
 *
 * `baseUrl` 은 상대 `og:image` 절대화 기준(리디렉션 후 최종 URL).
 */
export function parseOpenGraph(html: string, baseUrl: string): OpenGraphMeta | null {
  const meta = collectMeta(html);

  const title = pick(meta, ['og:title', 'twitter:title']) ?? titleTag(html);
  const description = pick(meta, ['og:description', 'twitter:description', 'description']);
  const image = absoluteImage(
    pick(meta, [
      'og:image',
      'og:image:secure_url',
      'og:image:url',
      'twitter:image',
      'twitter:image:src',
    ]),
    baseUrl,
  );
  const siteName = pick(meta, ['og:site_name', 'application-name']);

  if (!title && !description && !image && !siteName) return null;
  return { title, description, image, siteName };
}

/** 응답 본문을 최대 `maxBytes` 까지만 읽고 스트림을 끊는다. */
async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const body = response.body;
  if (!body) return (await response.text()).slice(0, maxBytes);

  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let read = 0;
  let text = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      read += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (read >= maxBytes) break;
    }
    text += decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }

  return text;
}

function warn(url: string, reason: string): void {
  console.warn(`[blocks] bookmark 메타 취득 실패 — ${reason} (${url}). 폴백으로 렌더합니다.`);
}

/**
 * URL 의 Open Graph 메타를 가져온다. 실패 시 경고만 남기고 `null`.
 *
 * 캐싱은 하지 않는다 — 호출부가 `withCache` 로 감싼다(관심사 분리).
 */
export async function fetchOpenGraph(url: string): Promise<OpenGraphMeta | null> {
  if (!isFetchableUrl(url)) {
    warn(url, 'http(s) 절대 URL 이 아님');
    return null;
  }

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      warn(url, `HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      warn(url, `HTML 응답이 아님 (${contentType || 'content-type 없음'})`);
      return null;
    }

    return parseOpenGraph(await readCapped(response, MAX_HTML_BYTES), response.url || url);
  } catch (error) {
    warn(url, error instanceof Error ? error.message : String(error));
    return null;
  }
}
