import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  atomicWriteFile,
  createDirectoryDurably,
  type AtomicWriteStep,
  type DirectoryCreateStep,
} from './atomicWrite.js';

describe('atomicWriteFile', () => {
  it('fsyncs a same-directory temporary file, renames it, and syncs the directory', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'workbench-atomic-'));
    const target = path.join(directory, 'document.md');
    const steps: AtomicWriteStep[] = [];
    await writeFile(target, 'old');

    await atomicWriteFile(target, 'new', (step) => steps.push(step));

    expect(await readFile(target, 'utf8')).toBe('new');
    expect(await readdir(directory)).toEqual(['document.md']);
    expect(steps.map(({ name }) => name)).toEqual([
      'temporary-opened',
      'file-synced',
      'renamed',
      'directory-synced',
    ]);
    expect(path.dirname(steps[0]?.temporaryPath ?? '')).toBe(directory);
  });

  it('preserves the original and cleans the temporary file when rename fails', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'workbench-atomic-'));
    const target = path.join(directory, 'document.md');
    await writeFile(target, 'old');

    await expect(
      atomicWriteFile(target, 'new', (step) => {
        if (step.name === 'file-synced') throw new Error('simulated interruption');
      }),
    ).rejects.toThrow('simulated interruption');

    expect(await readFile(target, 'utf8')).toBe('old');
    expect(await readdir(directory)).toEqual(['document.md']);
  });

  it('fsyncs each newly created directory and its parent in durability order', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'workbench-directory-'));
    const target = path.join(root, 'reviews', 'weekly');
    const steps: DirectoryCreateStep[] = [];

    await createDirectoryDurably(target, (step) => steps.push(step));

    expect(steps.map(({ name, directory }) => [name, path.relative(root, directory)])).toEqual([
      ['directory-created', 'reviews'],
      ['directory-synced', 'reviews'],
      ['parent-directory-synced', ''],
      ['directory-created', 'reviews/weekly'],
      ['directory-synced', 'reviews/weekly'],
      ['parent-directory-synced', 'reviews'],
    ]);
  });
});
