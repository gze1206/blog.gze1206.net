import { copyFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

import { resolveWorkspacePath } from './adapters/paths.js';

export interface SeedTemplatesInput {
  readonly workspaceRoot: string;
  /** 이미지 안에 들어 있는 기본 템플릿 위치. */
  readonly seedRoot: string;
}

/**
 * 빈 작업 공간에 기본 템플릿을 깔아 준다 (NOR-191).
 *
 * 새 작업 공간에는 `templates/` 가 없어서 화면에 만들 수 있는 것이 하나도 안 보인다. 손으로
 * 다섯 개를 만들어 넣으라고 할 일이 아니다.
 *
 * **이미 있는 파일은 건드리지 않는다.** 템플릿은 고쳐 쓰라고 있는 것이고, 고쳐 둔 것을 부팅할
 * 때마다 원본으로 되돌리면 도구가 사람의 손을 물리는 셈이 된다. 지운 템플릿이 되살아나는 것도
 * 같은 이유로 곤란하지만, 그 구분은 "무엇을 지웠는지"를 따로 기억해야 알 수 있다 — 다섯 개
 * 중 하나를 지우는 일보다 새 공간이 비어 있는 일이 훨씬 흔하므로 지금은 파일 유무만 본다.
 */
export async function seedWorkspaceTemplates(input: SeedTemplatesInput): Promise<string[]> {
  let seeds;
  try {
    seeds = (await readdir(input.seedRoot)).filter((name) => name.endsWith('.md')).sort();
  } catch {
    // 이미지에 기본 템플릿이 없으면 그냥 넘어간다. 원본은 언제나 작업 공간이다.
    return [];
  }

  const templatesRoot = await resolveWorkspacePath(input.workspaceRoot, 'templates');
  await mkdir(templatesRoot, { recursive: true });
  const existing = new Set(await readdir(templatesRoot).catch(() => []));

  const added: string[] = [];
  for (const name of seeds) {
    if (existing.has(name)) continue;
    await copyFile(path.join(input.seedRoot, name), path.join(templatesRoot, name));
    added.push(name);
  }
  return added;
}
