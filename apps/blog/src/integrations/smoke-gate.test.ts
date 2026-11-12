import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { removeSmokeOutput } from './smoke-gate.ts';

it('NOR-197 AC-1: smoke 가 꺼진 빌드는 dist/smoke 를 지우고 켜진 빌드는 남긴다', async () => {
  for (const smoke of [false, true]) {
    const dist = await mkdtemp(path.join(tmpdir(), 'smoke-gate-'));
    await mkdir(path.join(dist, 'smoke'));
    await writeFile(path.join(dist, 'smoke', 'placeholder.svg'), '<svg/>');
    await removeSmokeOutput(dist, smoke);
    expect((await readdir(dist)).includes('smoke')).toBe(smoke);
  }
});
