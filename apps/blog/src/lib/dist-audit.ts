import { decodeHTML } from 'entities';

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
  return findings;
}
