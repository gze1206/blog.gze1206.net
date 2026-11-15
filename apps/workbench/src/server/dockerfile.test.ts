import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

/**
 * 이미지 빌드는 PR CI 에서 돌지 않는다. 워크벤치가 새 작업 공간 패키지에 기대면 Dockerfile 과 이미지
 * 워크플로 경로에도 넣어야 하는데, 빠뜨리면 main 에 병합된 뒤에야 게시가 실패한다(NOR-203 에서 실제로 났다).
 */
it('NOR-203 AC-2: 워크벤치가 쓰는 작업 공간 패키지는 Dockerfile 과 이미지 워크플로에 모두 있다', () => {
  const manifest = JSON.parse(read('../../package.json')) as Record<
    string,
    Record<string, string> | undefined
  >;
  const workspaceDeps = Object.entries({
    ...manifest['dependencies'],
    ...manifest['devDependencies'],
  })
    .filter(([, version]) => version.startsWith('workspace:'))
    .map(([name]) => name.replace('@gze1206/', ''));
  expect(workspaceDeps.length).toBeGreaterThan(0);
  const dockerfile = read('../../Dockerfile');
  const workflow = read('../../../../.github/workflows/workbench-image.yml');
  const missing = workspaceDeps.flatMap((name) => [
    ...(dockerfile.includes(`COPY packages/${name}/package.json packages/${name}/`)
      ? []
      : [`Dockerfile manifest ${name}`]),
    ...(dockerfile.includes(`COPY packages/${name} packages/${name}`)
      ? []
      : [`Dockerfile source ${name}`]),
    ...(workflow.includes(`- 'packages/${name}/**'`) ? [] : [`workflow paths ${name}`]),
  ]);
  expect(missing).toEqual([]);
});
