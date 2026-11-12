import { realpath } from 'node:fs/promises';
import path from 'node:path';

export async function resolveWorkspacePath(root: string, relativePath: string): Promise<string> {
  assertWorkspaceRelativePath(relativePath);

  const realRoot = await realpath(root);
  const lexicalTarget = path.resolve(realRoot, relativePath);
  if (!isWithin(realRoot, lexicalTarget)) {
    throw new Error('path escapes workspace root');
  }

  const missingSegments: string[] = [];
  let existingAncestor = lexicalTarget;
  let realAncestor: string;

  for (;;) {
    try {
      realAncestor = await realpath(existingAncestor);
      break;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT' || existingAncestor === realRoot) {
        throw error;
      }
      missingSegments.unshift(path.basename(existingAncestor));
      existingAncestor = path.dirname(existingAncestor);
    }
  }

  if (!isWithin(realRoot, realAncestor)) {
    throw new Error('path escapes workspace root through a symbolic link');
  }

  const resolved = path.join(realAncestor, ...missingSegments);
  if (!isWithin(realRoot, resolved)) {
    throw new Error('path escapes workspace root');
  }
  return resolved;
}

export function assertWorkspaceRelativePath(relativePath: string): void {
  const segments = relativePath.split(/[\\/]/u);
  if (
    relativePath.length === 0 ||
    relativePath.includes('\0') ||
    path.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath) ||
    relativePath.includes('\\') ||
    segments.some((segment) => segment === '..' || segment === '' || segment === '.')
  ) {
    throw new Error('expected a normalized workspace-relative path');
  }
}

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
