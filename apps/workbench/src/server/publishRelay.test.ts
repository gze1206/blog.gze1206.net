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
  it('NOR-210 AC-1: 최종 트리만으로 base 위에 커밋 하나를 만들어 content 브랜치로 push 한다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    const commit = await f.publish('hello-1', {
      'apps/blog/src/content/posts/hello.mdoc': 'hello\n',
      'apps/blog/public/assets/posts/hello/a.png': 'png',
    });
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    const pushed = f.remoteRef('content/hello-1');
    expect(pushed).not.toBeNull();
    const at = (ref: string, format: string) =>
      git(f.root, '--git-dir', f.origin, 'log', '-1', `--format=${format}`, ref);
    expect(at(pushed ?? '', '%P')).toBe(f.base);
    expect(at(pushed ?? '', '%T')).toBe(git(f.author, 'rev-parse', `${commit}^{tree}`));
    expect(at(pushed ?? '', '%B')).not.toMatch(/TDD:/u);
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
    // 경로는 허용 목록 안이지만 심볼릭 링크(120000)라서 거절한다.
    expect(ledger).toContainEqual(expect.stringMatching(/^link-1\.json rejected mode$/u));
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

  it('NOR-210 AC-1: 중간 커밋에 넣었다 지운 파일은 GitHub 에 가지 않는다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    git(f.author, 'checkout', '-q', '-B', 'content/sneaky-1', f.base);
    await mkdir(path.join(f.author, '.github/workflows'), { recursive: true });
    await writeFile(path.join(f.author, '.github/workflows/evil.yml'), 'on: push\n');
    git(f.author, 'add', '.');
    git(f.author, 'commit', '-q', '-m', 'evil\n\nTDD: red');
    git(f.author, 'rm', '-q', '.github/workflows/evil.yml');
    await writeFile(path.join(f.author, 'apps/blog/src/content/posts/s.mdoc'), 's\n');
    git(f.author, 'add', '.');
    git(f.author, 'commit', '-q', '-m', 'cover');
    const tip = git(f.author, 'rev-parse', 'HEAD');
    const outbox = path.join(f.root, 'outbox');
    git(
      f.author,
      'bundle',
      'create',
      '-q',
      path.join(outbox, 'sneaky-1.bundle'),
      `${f.base}..content/sneaky-1`,
    );
    await writeFile(
      path.join(outbox, 'sneaky-1.json'),
      JSON.stringify({
        baseSha: f.base,
        branch: 'content/sneaky-1',
        commit: tip,
        exportFormat: 'bundle',
        exportRef: 'sneaky-1.bundle',
      }),
    );
    expect(f.run().status).toBe(0);
    const pushed = f.remoteRef('content/sneaky-1');
    expect(pushed).not.toBeNull();
    const history = git(
      f.root,
      '--git-dir',
      f.origin,
      'log',
      '--format=%H',
      `${f.base}..${pushed ?? ''}`,
    );
    expect(history.split('\n')).toHaveLength(1);
    expect(git(f.root, '--git-dir', f.origin, 'log', '--all', '--format=%B')).not.toMatch(/TDD:/u);
  });

  it('NOR-210 AC-3: .md 글과 SVG·JS 자산은 받지 않는다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    await f.publish('md-1', { 'apps/blog/src/content/posts/raw.md': '<script>x</script>\n' });
    await f.publish('svg-1', { 'apps/blog/public/assets/posts/a/x.svg': '<svg/>' });
    await f.publish('js-1', { 'apps/blog/public/assets/posts/a/x.js': 'alert(1)' });
    expect(f.run().status).toBe(0);
    for (const name of ['md-1', 'svg-1', 'js-1']) expect(f.remoteRef(`content/${name}`)).toBeNull();
    const ledger = await f.ledger();
    for (const name of ['md-1', 'svg-1', 'js-1'])
      expect(ledger).toContainEqual(
        expect.stringMatching(new RegExp(`^${name}\\.json rejected`, 'u')),
      );
  });

  it('NOR-210 AC-4: 잘못된 매니페스트는 거절로 남기고 다음 발행을 처리한다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    const outbox = path.join(f.root, 'outbox');
    await writeFile(path.join(outbox, 'aaa-bad.json'), '{not json');
    await writeFile(path.join(outbox, 'aab-array.json'), '[]');
    await symlink('/etc/hosts', path.join(outbox, 'aac-link.json'));
    await f.publish('zzz-good', { 'apps/blog/src/content/posts/g.mdoc': 'g\n' });
    const result = f.run();
    expect(result.status, result.stderr).toBe(0);
    expect(f.remoteRef('content/zzz-good')).not.toBeNull();
    const ledger = await f.ledger();
    expect(ledger).toContainEqual(expect.stringMatching(/^aaa-bad\.json rejected/u));
    expect(ledger).toContainEqual(expect.stringMatching(/^aab-array\.json rejected/u));
    expect(ledger).toContainEqual(expect.stringMatching(/^aac-link\.json rejected/u));
  });

  it('NOR-210 AC-4: 거절 사유는 고정된 코드라 경로에 개행을 넣어 ledger 를 위조할 수 없다', async () => {
    const f = await fixture();
    expect(existsSync(SCRIPT)).toBe(true);
    await f.publish('forge-1', {
      'apps/blog/src/content/posts/x.mdoc\nvictim-1.json ok content/victim-1': 'x\n',
    });
    await f.publish('victim-1', { 'apps/blog/src/content/posts/v.mdoc': 'v\n' });
    expect(f.run().status).toBe(0);
    const ledger = await f.ledger();
    expect(
      ledger.every((line) =>
        /^[A-Za-z0-9._-]+\.json (ok content\/[a-z0-9._-]+|stale [a-z-]+|rejected [a-z-]+)$/u.test(
          line,
        ),
      ),
    ).toBe(true);
    expect(f.remoteRef('content/victim-1')).not.toBeNull();
  });
});
