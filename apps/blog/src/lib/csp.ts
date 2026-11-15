/**
 * 공개 블로그의 Content-Security-Policy (NOR-201).
 *
 * 정적 사이트라 서버 코드가 없다. 빌드 뒤 산출물 HTML 의 인라인 스크립트 해시를 모아 `dist/_headers` 를
 * 만들고, Cloudflare Pages 가 모든 경로에 붙인다. 인라인 스크립트(테마 초기화, Astro island 로더)는
 * 내용이 빌드마다 바뀔 수 있으므로 손으로 해시를 적지 않는다.
 */
import { createHash } from 'node:crypto';

/** 2026-11-15 실제 사이트 Report-Only 확인을 마치고 강제한다(AC-6). 출처를 더할 때는 Report-Only 로 먼저 본다. */
export const CSP_MODE: CspMode = 'enforce';
export type CspMode = 'report-only' | 'enforce';

const COMMENTS = 'https://comments.gze1206.net';
// Cloudflare Pages 가 모든 페이지에 넣는 Web Analytics 비컨.
const CF_BEACON = 'https://static.cloudflareinsights.com';
const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/giu;
const SRC = /\ssrc\s*=/iu;
const TYPE = /\stype\s*=\s*["']?([^"'\s>]+)/iu;

/** `src` 가 없는 실행 스크립트(type 없음·module)의 본문 sha256. JSON 등 데이터 스크립트는 뺀다. */
export function inlineScriptHashes(html: string): string[] {
  const hashes: string[] = [];
  for (const [, attrs = '', body = ''] of html.matchAll(SCRIPT)) {
    if (SRC.test(attrs)) continue;
    const type = TYPE.exec(attrs)?.[1]?.toLowerCase();
    if (type !== undefined && type !== 'module' && type !== 'text/javascript') continue;
    hashes.push(`'sha256-${createHash('sha256').update(body).digest('base64')}'`);
  }
  return hashes;
}

export function buildCsp(hashes: readonly string[]): string {
  const inline = [...new Set(hashes)].sort();
  const directives: [string, ...string[]][] = [
    ['default-src', "'self'"],
    // Pagefind 검색이 WebAssembly 를 쓴다. 문자열 eval 은 허용하지 않는다.
    ['script-src', "'self'", "'wasm-unsafe-eval'", COMMENTS, CF_BEACON, ...inline],
    // 스타일 속성이 많고 Mermaid·KaTeX·Comentario 가 스타일을 주입한다.
    ['style-src', "'self'", "'unsafe-inline'", COMMENTS],
    ['img-src', "'self'", 'data:', COMMENTS, 'https://i.ytimg.com'],
    // Comentario CSS 가 자기 서버의 폰트를 부른다(no-fonts 를 줘도).
    ['font-src', "'self'", 'data:', COMMENTS],
    [
      'connect-src',
      "'self'",
      COMMENTS,
      'wss://comments.gze1206.net',
      'https://cloudflareinsights.com',
    ],
    ['frame-src', 'https://www.youtube-nocookie.com'],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'none'"],
  ];
  return directives.map((directive) => directive.join(' ')).join('; ');
}

export function renderHeaders(policy: string, mode: CspMode): string {
  const name =
    mode === 'enforce' ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
  return `/*\n  ${name}: ${policy}\n`;
}
