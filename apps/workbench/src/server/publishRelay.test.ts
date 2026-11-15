import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('../../deploy/oci/publish-relay.sh', import.meta.url));
const PATHS = fileURLToPath(new URL('../../deploy/oci/content-paths.regex', import.meta.url));
const IDENTITY = {
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};

const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, env: { ...process.env, ...IDENTITY } })
    .toString()
    .trim();

/** origin(bare) 에 main 한 커밋, 작성자 clone 에 그 위의 content 브랜치를 만든다. */
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'publish-relay-'));
  const origin = path.join(root, 'origin.git');
  const author = path.join(root, 'author');
  const outbox = path.join(root, 'outbox');
  const state = path.join(root, 'state');
  await mkdir(outbox);
  await mkdir(state);
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(root, 'clone', '-q', origin, author);
  await mkdir(path.join(author, 'apps/blog/src/content/posts'), { recursive: true });
  await writeFile(path.join(author, 'apps/blog/src/content/posts/old.mdoc'), 'old\n');
  git(author, 'add', '.');
  git(author, 'commit', '-q', '-m', 'base');
  git(author, 'push', '-q', 'origin', 'HEAD:main');
  const base = git(author, 'rev-parse', 'HEAD');

  /** base 위에 파일을 바꾼 커밋을 만들고 outbox 에 산출물과 매니페스트를 둔다. */
  const publish = async (
    name: string,
    files: Record<string, string>,
    options: { format?: 'bundle' | 'format-patch'; base?: string; link?: string } = {},
  ) => {
    const from = options.base ?? base;
    git(author, 'checkout', '-q', '-B', `content/${name}`, from);
    for (const [file, content] of Object.entries(files)) {
      await mkdir(path.dirname(path.join(author, file)), { recursive: true });
      await writeFile(path.join(author, file), content);
    }
    if (options.link) {
      await mkdir(path.dirname(path.join(author, options.link)), { recursive: true });
      await symlink('/etc/passwd', path.join(author, options.link));
    }
    git(author, 'add', '.');
    git(author, 'commit', '-q', '-m', `publish ${name}`);
    const commit = git(author, 'rev-parse', 'HEAD');
    const format = options.format ?? 'bundle';
    const exportRef = `${name}.${format === 'bundle' ? 'bundle' : 'patch'}`;
    if (format === 'bundle') {
      git(
        author,
        'bundle',
        'create',
        '-q',
        path.join(outbox, exportRef),
        `${from}..content/${name}`,
      );
    } else {
      await writeFile(
        path.join(outbox, exportRef),
        execFileSync('git', ['format-patch', '--stdout', `${from}..content/${name}`], {
          cwd: author,
        }),
      );
    }
    await writeFile(
      path.join(outbox, `${name}.json`),
      JSON.stringify({
        baseSha: from,
        branch: `content/${name}`,
        commit,
        exportFormat: format,
        exportRef,
        targetPath: Object.keys(files)[0],
      }),
    );
    git(author, 'checkout', '-q', '--detach', base);
    return commit;
  };

  const run = () =>
    spawnSync('bash', [SCRIPT], {
      env: {
        ...process.env,
        ...IDENTITY,
        RELAY_OUTBOX: outbox,
        RELAY_STATE: state,
        RELAY_REMOTE: origin,
        RELAY_PATHS: PATHS,
      },
      encoding: 'utf8',
    });
  const remoteRef = (branch: string) => {
    try {
      return git(root, '--git-dir', origin, 'rev-parse', `refs/heads/${branch}`);
    } catch {
      return null;
    }
  };
  const ledger = async () =>
    existsSync(path.join(state, 'ledger'))
      ? (await readFile(path.join(state, 'ledger'), 'utf8')).trim().split('\n')
      : [];
  return { root, origin, author, state, base, publish, run, remoteRef, ledger };
}

describe('publish-relay.sh', () => {
  it('NOR-210 AC-1: bundle 산출물을 매니페스트의 커밋 그대로 content 브랜치로 push 한다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    const commit = await f.publish('hello-1', {
      'apps/blog/src/content/posts/hello.mdoc': 'hello\n',
      'apps/blog/public/assets/posts/hello/a.png': 'png',
    });
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    expect(f.remoteRef('content/hello-1')).toBe(commit);
    expect(await f.ledger()).toEqual([
      expect.stringMatching(/^hello-1\.json ok content\/hello-1$/u),
    ]);
  });

  it('NOR-210 AC-1: format-patch 산출물은 base 위에 적용해 push 한다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    await f.publish(
      'patched-1',
      { 'apps/blog/src/content/books/b.json': '{}\n' },
      { format: 'format-patch' },
    );
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    const pushed = f.remoteRef('content/patched-1');
    expect(pushed).not.toBeNull();
    expect(
      git(f.root, '--git-dir', f.origin, 'show', `${pushed}:apps/blog/src/content/books/b.json`),
    ).toBe('{}');
  });

  it('NOR-210 AC-2: base 가 main 의 조상이 아니면 push 하지 않고 stale 로 남긴다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    git(f.author, 'checkout', '-q', '-b', 'elsewhere', f.base);
    await writeFile(path.join(f.author, 'x.txt'), 'x');
    git(f.author, 'add', '.');
    git(f.author, 'commit', '-q', '-m', 'elsewhere');
    const elsewhere = git(f.author, 'rev-parse', 'HEAD');
    await f.publish(
      'stale-1',
      { 'apps/blog/src/content/posts/s.mdoc': 's\n' },
      { base: elsewhere },
    );
    expect(f.run().status).toBe(0);
    expect(f.remoteRef('content/stale-1')).toBeNull();
    expect(await f.ledger()).toEqual([expect.stringMatching(/^stale-1\.json stale/u)]);
  });

  it('NOR-210 AC-3: 콘텐츠 경로 밖이나 심볼릭 링크가 섞이면 push 하지 않는다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    await f.publish('evil-1', {
      'apps/blog/src/content/posts/ok.mdoc': 'ok\n',
      '.github/workflows/evil.yml': 'on: push\n',
    });
    await f.publish(
      'link-1',
      { 'apps/blog/src/content/posts/l.mdoc': 'l\n' },
      { link: 'apps/blog/public/assets/posts/l/l.png' },
    );
    expect(f.run().status).toBe(0);
    expect(f.remoteRef('content/evil-1')).toBeNull();
    expect(f.remoteRef('content/link-1')).toBeNull();
    const ledger = await f.ledger();
    expect(ledger).toContainEqual(expect.stringMatching(/^evil-1\.json rejected/u));
    // 경로는 허용 목록 안이지만 심볼릭 링크라서 거절한다.
    expect(ledger).toContainEqual(expect.stringMatching(/^link-1\.json rejected link:/u));
  });

  it('NOR-210 AC-4: 처리한 매니페스트는 다시 처리하지 않는다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    await f.publish('once-1', { 'apps/blog/src/content/posts/o.mdoc': 'o\n' });
    expect(f.run().status).toBe(0);
    git(f.root, '--git-dir', f.origin, 'update-ref', '-d', 'refs/heads/content/once-1');
    expect(f.run().status).toBe(0);
    expect(f.remoteRef('content/once-1')).toBeNull();
    expect(await f.ledger()).toHaveLength(1);
  });

  it('NOR-210 AC-5: 다른 실행이 잠금을 쥐고 있으면 아무것도 하지 않는다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    await f.publish('locked-1', { 'apps/blog/src/content/posts/k.mdoc': 'k\n' });
    // 다른 실행이 잡은 잠금(디렉터리)이 있다.
    await mkdir(path.join(f.state, '.lock'));
    const holder = f.run();
    expect(holder.status).not.toBe(0);
    expect(f.remoteRef('content/locked-1')).toBeNull();
  });
});
