import path from 'node:path';

/** 워크스페이스 패키지. `dir` 은 저장소 기준 POSIX 경로다. */
export interface WorkspacePackage {
  readonly name: string;
  readonly dir: string;
}

export interface ImportSite {
  readonly file: string;
  readonly specifier: string;
}

export interface BoundaryViolation {
  readonly file: string;
  readonly specifier: string;
  readonly reason: string;
}

const IMPORT_PATTERN =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/gu;

export function extractImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2];
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}

function isInside(dir: string, target: string): boolean {
  return target === dir || target.startsWith(`${dir}/`);
}

export function findBoundaryViolations(
  sites: readonly ImportSite[],
  packages: readonly WorkspacePackage[],
): BoundaryViolation[] {
  const apps = packages.filter((pkg) => pkg.dir.startsWith('apps/'));
  const violations: BoundaryViolation[] = [];
  for (const site of sites) {
    const owner = packages.find((pkg) => isInside(pkg.dir, site.file));
    if (owner === undefined) continue;
    if (site.specifier.startsWith('.')) {
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(site.file), site.specifier),
      );
      if (!isInside(owner.dir, resolved)) {
        violations.push({ ...site, reason: `relative import leaves ${owner.dir}` });
      }
      continue;
    }
    const app = apps.find(
      (pkg) => site.specifier === pkg.name || site.specifier.startsWith(`${pkg.name}/`),
    );
    if (app !== undefined && app !== owner) {
      violations.push({ ...site, reason: `apps must not be imported: ${app.name}` });
    }
  }
  return violations;
}
