import { mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveWorkspacePath } from './paths.js';

describe('resolveWorkspacePath', () => {
  it('resolves safe existing and not-yet-created paths under the real root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-paths-'));
    const canonicalRoot = await realpath(root);
    await mkdir(path.join(root, 'drafts'));
    await writeFile(path.join(root, 'drafts', 'existing.md'), 'ok');

    await expect(resolveWorkspacePath(root, 'drafts/existing.md')).resolves.toBe(
      path.join(canonicalRoot, 'drafts', 'existing.md'),
    );
    await expect(resolveWorkspacePath(root, 'drafts/new/deep.md')).resolves.toBe(
      path.join(canonicalRoot, 'drafts', 'new', 'deep.md'),
    );
  });

  it.each(['/tmp/escape.md', '../escape.md', 'drafts/../../escape.md', 'C:\\escape.md'])(
    'rejects absolute and traversal input: %s',
    async (unsafePath) => {
      const root = await mkdtemp(path.join(tmpdir(), 'workbench-paths-'));
      await expect(resolveWorkspacePath(root, unsafePath)).rejects.toThrow(
        'workspace-relative path',
      );
    },
  );

  it('rejects a symlink that escapes the workspace root', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-root-'));
    const outside = await mkdtemp(path.join(tmpdir(), 'workbench-outside-'));
    await writeFile(path.join(outside, 'secret.md'), 'secret');
    await symlink(outside, path.join(root, 'escaped'));

    await expect(resolveWorkspacePath(root, 'escaped/secret.md')).rejects.toThrow(
      'escapes workspace root',
    );
  });
});
