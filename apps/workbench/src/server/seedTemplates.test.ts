import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseTemplate, templateKinds } from '../core/template/index.js';
import { seedWorkspaceTemplates } from './seedTemplates.js';

describe('workspace seed templates', () => {
  it('contains exactly one valid template for each of the five agreed kinds', async () => {
    const directory = path.resolve('workspace-seed/templates');
    const filenames = (await readdir(directory)).sort();
    const parsed = await Promise.all(
      filenames.map(async (filename) =>
        parseTemplate(await readFile(path.join(directory, filename), 'utf8')),
      ),
    );

    expect(filenames).toEqual([
      'capture.md',
      'monthly-review.md',
      'private-post.md',
      'public-draft.md',
      'weekly-review.md',
    ]);
    expect(parsed.map(({ kind }) => kind).sort()).toEqual([...templateKinds].sort());
  });
});

describe('seedWorkspaceTemplates', () => {
  const seedRoot = path.resolve('workspace-seed/templates');

  it('빈 작업 공간에 다섯 개를 깔아 준다', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'workbench-seed-'));

    const added = await seedWorkspaceTemplates({ workspaceRoot, seedRoot });

    expect(added).toEqual([
      'capture.md',
      'monthly-review.md',
      'private-post.md',
      'public-draft.md',
      'weekly-review.md',
    ]);
    expect((await readdir(path.join(workspaceRoot, 'templates'))).sort()).toEqual(added);
  });

  it('고쳐 둔 템플릿을 되돌리지 않는다', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'workbench-seed-'));
    await mkdir(path.join(workspaceRoot, 'templates'), { recursive: true });
    await writeFile(path.join(workspaceRoot, 'templates', 'capture.md'), '내가 고친 것');

    const added = await seedWorkspaceTemplates({ workspaceRoot, seedRoot });

    expect(added).not.toContain('capture.md');
    expect(await readFile(path.join(workspaceRoot, 'templates', 'capture.md'), 'utf8')).toBe(
      '내가 고친 것',
    );
  });

  it('두 번 부팅해도 한 번만 깐다', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'workbench-seed-'));

    await seedWorkspaceTemplates({ workspaceRoot, seedRoot });
    const second = await seedWorkspaceTemplates({ workspaceRoot, seedRoot });

    expect(second).toEqual([]);
  });

  it('이미지에 기본 템플릿이 없으면 조용히 넘어간다', async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'workbench-seed-'));

    const added = await seedWorkspaceTemplates({
      workspaceRoot,
      seedRoot: path.join(workspaceRoot, 'nowhere'),
    });

    expect(added).toEqual([]);
  });
});
