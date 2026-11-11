import { createHash } from 'node:crypto';

import { assertWorkspaceRelativePath } from './adapters/paths.js';

const documentIdPattern = /^[A-Za-z0-9_-]{43}$/u;

export function encodeDocumentId(relativePath: string): string {
  assertWorkspaceRelativePath(relativePath);
  return createHash('sha256').update(relativePath, 'utf8').digest('base64url');
}

export function isDocumentId(id: string): boolean {
  return documentIdPattern.test(id);
}
