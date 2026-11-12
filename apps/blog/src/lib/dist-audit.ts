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
  return findings;
}
