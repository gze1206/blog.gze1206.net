export interface DistFile {
  path: string;
  html: string;
}
export interface AuditInput {
  files: readonly DistFile[];
  assets: readonly { path: string; content: string | null }[];
  draftSlugs: readonly string[];
  draftTitles: readonly string[];
  smoke: boolean;
}
export interface AuditFinding {
  rule: string;
  path: string;
  detail: string;
}
export function isSmokeEnabled(env: { DEV?: boolean; BLOG_SMOKE?: string }): boolean {
  return env.DEV === true || env.BLOG_SMOKE === '1';
}
export const SMOKE_ENABLED = isSmokeEnabled({
  DEV: import.meta.env?.DEV,
  BLOG_SMOKE: process.env.BLOG_SMOKE,
});
export function auditDist(input: AuditInput): AuditFinding[] {
  const findings: AuditFinding[] = [];
  if (!input.smoke) {
    for (const file of input.files) {
      if (file.path.startsWith('smoke/'))
        findings.push({ rule: 'smoke-in-production', path: file.path, detail: 'smoke page' });
      for (const slug of input.draftSlugs) {
        if (file.html.includes(`/blog/${slug}`))
          findings.push({ rule: 'draft-leak', path: file.path, detail: slug });
      }
      for (const title of input.draftTitles) {
        if (file.html.includes(title))
          findings.push({ rule: 'draft-leak', path: file.path, detail: title });
      }
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
        const url = new URL(match[1], 'https://gze1206.net');
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
  return findings;
}
