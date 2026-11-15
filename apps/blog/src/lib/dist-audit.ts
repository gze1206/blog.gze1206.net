import { decodeHTML } from 'entities';
import { inlineScriptHashes } from './csp.ts';

export interface DistFile {
  path: string;
  html: string;
}
interface AuditInput {
  files: readonly DistFile[];
  assets: readonly { path: string; content: string | null }[];
  draftSlugs: readonly string[];
  draftTitles: readonly string[];
  smoke: boolean;
  /** 프로덕션 빌드는 `_headers` CSP 에 모든 인라인 스크립트 해시가 있어야 한다 (NOR-201 AC-4). */
  requireCsp?: boolean;
}
interface AuditFinding {
  rule: string;
  path: string;
  detail: string;
}
export function isSmokeEnabled(env: {
  DEV?: boolean | undefined;
  BLOG_SMOKE?: string | undefined;
}): boolean {
  return env.DEV === true || env.BLOG_SMOKE === '1';
}
export const SMOKE_ENABLED = isSmokeEnabled({
  DEV: import.meta.env?.DEV,
  BLOG_SMOKE: process.env.BLOG_SMOKE,
});
export function normalizeAuditText(value: string): string {
  try {
    value = decodeURIComponent(value);
  } catch {
    // 원문을 검사한다.
  }
  return decodeHTML(value).toLowerCase();
}
export function auditDist(input: AuditInput): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const item of [
    ...input.files.map((file) => ({ path: file.path, content: file.html })),
    ...input.assets,
  ]) {
    const smokePath = item.path.startsWith('smoke/');
    if (smokePath && !input.smoke)
      findings.push({ rule: 'smoke-in-production', path: item.path, detail: 'smoke output' });
    if (smokePath && input.smoke) continue;
    const boundaryMatch = (value: string, slug: string): boolean => {
      const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^a-z0-9-])${escaped}(?=$|[^a-z0-9-])`).test(value);
    };
    const normalizedPath = normalizeAuditText(item.path);
    const content = item.content === null ? null : normalizeAuditText(item.content);
    for (const slug of input.draftSlugs) {
      const normalizedSlug = normalizeAuditText(slug);
      if (boundaryMatch(normalizedPath, normalizedSlug))
        findings.push({ rule: 'draft-asset', path: item.path, detail: slug });
      if (content !== null && boundaryMatch(content, normalizedSlug))
        findings.push({ rule: 'draft-leak', path: item.path, detail: slug });
    }
    for (const title of input.draftTitles) {
      const normalizedTitle = normalizeAuditText(title).trim();
      if (normalizedTitle && content?.includes(normalizedTitle))
        findings.push({ rule: 'draft-leak', path: item.path, detail: title });
    }
  }
  const assetPaths = new Set(input.assets.map((asset) => asset.path));
  for (const file of input.files) {
    if (/<meta\b[^>]*http-equiv=["']refresh["']/i.test(file.html))
      findings.push({ rule: 'meta-refresh', path: file.path, detail: 'meta refresh' });
    for (const match of file.html.matchAll(
      /<meta\b[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/gi,
    )) {
      try {
        const value = match[1];
        if (value === undefined) continue;
        const url = new URL(value, 'https://gze1206.net');
        if (
          url.origin !== 'https://gze1206.net' ||
          !url.pathname.startsWith('/og/') ||
          !url.pathname.endsWith('.png')
        )
          continue;
        const path = decodeURIComponent(url.pathname).slice(1);
        if (!assetPaths.has(path))
          findings.push({ rule: 'missing-og-image', path: file.path, detail: path });
      } catch {
        /* 잘못된 URL 은 이미지 참조 검사 대상이 아니다. */
      }
    }
  }
  const katexAssets = new Set(
    input.assets
      .filter(
        (asset) =>
          asset.path.endsWith('.css') &&
          asset.content?.includes('.katex') &&
          asset.content.includes('KaTeX_'),
      )
      .map((asset) => asset.path),
  );
  const mermaidAssets = new Set(
    input.assets
      .filter(
        (asset) =>
          asset.path.endsWith('.js') &&
          (/(?:^|\/)(?:mermaid(?:-parser)?|cytoscape)[.-]/i.test(asset.path) ||
            (/chunk-/i.test(asset.path) && /langium|mermaid|cytoscape/i.test(asset.content ?? ''))),
      )
      .map((asset) => asset.path),
  );
  for (const file of input.files) {
    const refs = [
      ...file.html.matchAll(
        /<(?:script|link)\b[^>]*(?:src|href)=["']\/([^"'?#]+)[^"']*["'][^>]*>/gi,
      ),
    ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
    const hasMath = /class=["'][^"']*\bkatex\b[^"']*["']/i.test(file.html);
    const hasKatexCss = refs.some((ref) => katexAssets.has(ref));
    if (hasMath !== hasKatexCss)
      findings.push({
        rule: 'heavy-asset',
        path: file.path,
        detail: hasMath ? 'missing KaTeX CSS' : 'unneeded KaTeX CSS',
      });
    if (
      !/data-language=["']mermaid["']/i.test(file.html) &&
      refs.some((ref) => mermaidAssets.has(ref))
    )
      findings.push({ rule: 'heavy-asset', path: file.path, detail: 'unneeded Mermaid chunk' });
  }
  // 글 본문은 워크벤치에서 자동 병합된다(NOR-210). 빌드 뒤 CSP 가 인라인 해시를 모으므로, 본문에서 온
  // 스크립트와 이벤트 속성은 여기서 빌드를 실패시킨다(AC-10).
  for (const file of input.files) {
    const body = postBody(file.html);
    // 글 페이지인데 본문 경계를 못 찾으면 검사 범위가 어긋난 것이다. 조용히 넘기지 않는다.
    if (body === null && file.html.includes('<div class="article__after"')) {
      findings.push({ rule: 'content-script', path: file.path, detail: 'post body not found' });
      continue;
    }
    if (body !== null && (/<script\b/iu.test(body) || /<[a-z][^>]*\son[a-z]+\s*=/iu.test(body)))
      findings.push({ rule: 'content-script', path: file.path, detail: 'post body' });
  }
  if (input.requireCsp) {
    const headers = input.assets.find((asset) => asset.path === '_headers')?.content;
    if (headers == null) {
      findings.push({ rule: 'csp-missing-headers', path: '_headers', detail: 'missing' });
    } else {
      for (const file of input.files)
        for (const hash of inlineScriptHashes(file.html))
          if (!headers.includes(hash))
            findings.push({ rule: 'csp-missing-hash', path: file.path, detail: hash });
    }
  }
  return findings;
}

/** 글 상세의 본문 영역. 레이아웃이 `post-body` 와 `article__after` 사이에 본문을 둔다. */
function postBody(html: string): string | null {
  const start = html.search(/<div class="post-body\b/u);
  if (start === -1) return null;
  const end = html.indexOf('<div class="article__after"', start);
  return html.slice(start, end === -1 ? undefined : end);
}
