import { chmod, mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { BLOG_LAYOUT } from '@gze1206/content-contract';

import { loadConfig } from './config.js';

/** 유효한 최소 환경. 각 테스트는 여기서 한 항목만 흔들어 본다. */
async function environment(overrides: Record<string, string | undefined> = {}) {
  const parent = await mkdtemp(path.join(tmpdir(), 'workbench-config-'));
  const workspace = path.join(parent, 'workspace');
  const workBase = path.join(parent, 'run-publish');
  await mkdir(workspace);
  await mkdir(workBase);
  // ② 는 개인 저장소다. outbox 무시 여부를 볼 수 있게 git 저장소로 만든다.
  execFileSync('git', ['init', '--quiet'], { cwd: workspace });
  await writeFile(path.join(workspace, '.gitignore'), '.workbench/\n');

  return {
    parent,
    workspace,
    workBase,
    env: {
      WORKSPACE_ROOT: workspace,
      APP_TIME_ZONE: 'Asia/Seoul',
      PUBLIC_BLOG_REMOTE: 'https://github.com/gze1206/blog.gze1206.net',
      PUBLISH_WORK_BASE: workBase,
      PUBLISH_GIT_AUTHOR_NAME: '김명식',
      PUBLISH_GIT_AUTHOR_EMAIL: 'gze1206@kakao.com',
      ...overrides,
    } satisfies Record<string, string | undefined>,
  };
}

describe('loadConfig', () => {
  it('공개 블로그의 상시 clone 경로를 더 이상 요구하지 않는다', async () => {
    const { env } = await environment();

    // 발행은 임시 clone 으로 한다(NOR-148). ③ 상시 clone 설정은 사라졌다.
    expect(loadConfig(env)).not.toHaveProperty('publicBlogRoot');
    expect(() => loadConfig({ ...env, PUBLIC_BLOG_ROOT: undefined })).not.toThrow();
  });

  it('필수 설정이 빠지면 부팅을 거부한다', async () => {
    const { env } = await environment();

    expect(() => loadConfig({})).toThrow('WORKSPACE_ROOT');
    expect(() => loadConfig({ ...env, PUBLIC_BLOG_REMOTE: undefined })).toThrow(
      'PUBLIC_BLOG_REMOTE',
    );
    expect(() => loadConfig({ ...env, PUBLISH_WORK_BASE: undefined })).toThrow('PUBLISH_WORK_BASE');
  });

  it('공개 블로그 remote 는 https 로만, 허용한 호스트와 경로만 받는다', async () => {
    const { env } = await environment();
    const rejected = [
      'git@github.com:gze1206/blog.gze1206.net.git',
      'ssh://git@github.com/gze1206/blog.gze1206.net',
      'git://github.com/gze1206/blog.gze1206.net',
      'file:///tmp/blog',
      'http://github.com/gze1206/blog.gze1206.net',
      'https://github.com:8443/gze1206/blog.gze1206.net',
      'https://user:pass@github.com/gze1206/blog.gze1206.net',
      'https://github.com/gze1206/blog.gze1206.net?token=1',
      'https://github.com/gze1206/blog.gze1206.net#frag',
      'https://gitlab.com/gze1206/blog.gze1206.net',
      'https://github.com/gze1206',
      'https://github.com/gze1206/blog/extra',
      'not-a-url',
    ];

    for (const remote of rejected) {
      expect(() => loadConfig({ ...env, PUBLIC_BLOG_REMOTE: remote }), remote).toThrow(
        'PUBLIC_BLOG_REMOTE',
      );
    }

    expect(loadConfig({ ...env, PUBLIC_BLOG_REMOTE: 'https://github.com/a/b.git' })).toMatchObject({
      publicBlogRemote: 'https://github.com/a/b.git',
    });
  });

  it('NOR-195 AC-7: 발행 대상 브랜치의 기본값은 v4 다', async () => {
    const { env } = await environment();

    expect(loadConfig(env).publicBlogBranch).toBe(BLOG_LAYOUT.publishBranch);
    expect(loadConfig({ ...env, PUBLISH_BRANCH: 'x' }).publicBlogBranch).toBe(
      BLOG_LAYOUT.publishBranch,
    );
    expect(loadConfig({ ...env, PUBLIC_BLOG_BRANCH: 'release' }).publicBlogBranch).toBe('release');
  });

  it('발행 identity 가 없으면 거부한다 — 사용자@호스트를 추론하지 않는다', async () => {
    const { env } = await environment();

    expect(() => loadConfig({ ...env, PUBLISH_GIT_AUTHOR_NAME: undefined })).toThrow(
      'PUBLISH_GIT_AUTHOR_NAME',
    );
    expect(() => loadConfig({ ...env, PUBLISH_GIT_AUTHOR_NAME: '   ' })).toThrow(
      'PUBLISH_GIT_AUTHOR_NAME',
    );
    expect(() => loadConfig({ ...env, PUBLISH_GIT_AUTHOR_EMAIL: 'not-an-email' })).toThrow(
      'PUBLISH_GIT_AUTHOR_EMAIL',
    );
  });

  it('작업 공간과 outbox 는 서로 겹치지 않고, outbox 는 개인 저장소 안에 있다', async () => {
    const { env, workspace, workBase } = await environment();

    // 기본 outbox 는 ② 안이다.
    expect(loadConfig(env).publishOutboxRoot).toBe(
      path.join(await realpath(workspace), '.workbench/publish-outbox'),
    );
    // 작업 공간(tmpfs)은 ② 밖이어야 한다.
    expect(() => loadConfig({ ...env, PUBLISH_WORK_BASE: workspace })).toThrow('must not overlap');
    // outbox 를 ② 밖에 두면 거부한다.
    expect(() => loadConfig({ ...env, PUBLISH_OUTBOX_ROOT: workBase })).toThrow(
      'PUBLISH_OUTBOX_ROOT must be inside WORKSPACE_ROOT',
    );
  });

  it('outbox 가 개인 저장소에서 무시되지 않으면 거부하고, .gitignore 를 고치지 않는다', async () => {
    const { env, workspace } = await environment({});
    const gitignore = path.join(workspace, '.gitignore');
    await writeFile(gitignore, '# 아무것도 무시하지 않는다\n');

    expect(() => loadConfig(env)).toThrow('must be ignored');
    // 앱은 사용자의 무시 규칙을 대신 고치지 않는다.
    const { readFile } = await import('node:fs/promises');
    expect(await readFile(gitignore, 'utf8')).toBe('# 아무것도 무시하지 않는다\n');
  });

  it('저장소인데 무시 여부를 확인할 수 없으면 부팅을 거부한다', async () => {
    const { env, workspace } = await environment();
    // git 이 명령을 거부하는 상황(예: dubious ownership)을 흉내 낸다. 저장소로 보이지만
    // 확인이 안 되면 조용히 통과시켜서는 안 된다.
    await writeFile(path.join(workspace, '.git', 'config'), 'not a valid git config\n[\n');

    expect(() => loadConfig(env)).toThrow('could not be verified');
  });

  it('git 저장소가 아니면 무시 검사를 건너뛴다', async () => {
    const { env, workspace } = await environment();
    const { rm } = await import('node:fs/promises');
    await rm(path.join(workspace, '.git'), { recursive: true, force: true });

    expect(() => loadConfig(env)).not.toThrow();
  });

  it('outbox 권한이 0700 보다 느슨하면 조인다', async () => {
    const { env, workspace } = await environment();
    const outbox = path.join(workspace, '.workbench/publish-outbox');
    await mkdir(outbox, { recursive: true });
    await chmod(outbox, 0o755);

    const config = loadConfig(env);
    const { stat } = await import('node:fs/promises');
    expect((await stat(config.publishOutboxRoot)).mode & 0o777).toBe(0o700);
  });

  it('유효한 설정을 정규화해 돌려준다', async () => {
    const { env, workspace, workBase } = await environment();

    expect(loadConfig(env)).toEqual({
      workspaceRoot: await realpath(workspace),
      appTimeZone: 'Asia/Seoul',
      publicBlogRemote: 'https://github.com/gze1206/blog.gze1206.net',
      publicBlogBranch: BLOG_LAYOUT.publishBranch,
      publishWorkBase: await realpath(workBase),
      publishOutboxRoot: path.join(await realpath(workspace), '.workbench/publish-outbox'),
      publishAuthorName: '김명식',
      publishAuthorEmail: 'gze1206@kakao.com',
    });
  });

  it('시간대는 명시적이고 유효한 IANA 값이어야 한다', async () => {
    const { env } = await environment();

    expect(() => loadConfig({ ...env, APP_TIME_ZONE: undefined })).toThrow('APP_TIME_ZONE');
    expect(() => loadConfig({ ...env, APP_TIME_ZONE: 'not/a-timezone' })).toThrow('APP_TIME_ZONE');
  });

  it('없는 경로·파일·읽기 불가 경로를 거부한다', async () => {
    const { env, parent } = await environment();
    const file = path.join(parent, 'root.txt');
    await writeFile(file, 'not-a-directory');

    expect(() => loadConfig({ ...env, WORKSPACE_ROOT: path.join(parent, 'missing') })).toThrow(
      'must exist',
    );
    expect(() => loadConfig({ ...env, WORKSPACE_ROOT: file })).toThrow('must be a directory');
  });

  it('심볼릭 링크를 풀어 본 뒤에도 겹치면 거부한다', async () => {
    const { env, workspace, parent } = await environment();
    const alias = path.join(parent, 'workspace-alias');
    await symlink(workspace, alias);

    expect(() => loadConfig({ ...env, PUBLISH_WORK_BASE: alias })).toThrow('must not overlap');
  });
});
