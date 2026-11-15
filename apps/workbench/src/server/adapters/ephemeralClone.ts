import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import type { RemotePolicy } from './remotePolicy.js';

const run = promisify(execFile);

export interface EphemeralCloneManagerOptions {
  readonly workBase: string;
  readonly remote: string;
  readonly branch: string;
  readonly remotePolicy: RemotePolicy;
  readonly orphanAgeMs?: number;
}

export interface EphemeralClone {
  readonly sessionDir: string;
  readonly repositoryRoot: string;
}

export class EphemeralCloneManager {
  private readonly orphanAgeMs: number;

  public constructor(private readonly options: EphemeralCloneManagerOptions) {
    this.orphanAgeMs = options.orphanAgeMs ?? 60 * 60 * 1000;
  }

  public async create(): Promise<EphemeralClone> {
    this.options.remotePolicy.assertAllowed(this.options.remote);
    await mkdir(this.options.workBase, { recursive: true, mode: 0o700 });
    await this.sweepOrphans();
    const sessionDir = await mkdtemp(path.join(this.options.workBase, 'publish-'));
    const repositoryRoot = path.join(sessionDir, 'repository');
    const home = path.join(sessionDir, 'home');
    const hooks = path.join(sessionDir, 'hooks');
    await Promise.all([mkdir(home, { mode: 0o700 }), mkdir(hooks, { mode: 0o700 })]);
    const remote = this.options.remotePolicy.cloneConfig(this.options.remote);
    try {
      await this.runGit(
        sessionDir,
        [
          ...remote.gitConfigArgs,
          `core.hooksPath=${hooks}`,
          'core.fsmonitor=false',
          'credential.helper=',
        ],
        [
          'clone',
          '--depth=1',
          '--single-branch',
          '--branch',
          this.options.branch,
          '--no-tags',
          '--no-recurse-submodules',
          remote.effectiveUrl,
          repositoryRoot,
        ],
        remote.extraEnv,
      );
      const origin = await this.git({ sessionDir, repositoryRoot }, [
        'remote',
        'get-url',
        'origin',
      ]);
      if (origin !== remote.effectiveUrl)
        throw new Error('cloned public blog remote does not match configuration');
      return { sessionDir, repositoryRoot };
    } catch (error) {
      await this.remove(sessionDir);
      throw error;
    }
  }

  public async git(clone: EphemeralClone, args: readonly string[]): Promise<string> {
    return (await this.gitBytes(clone, args)).toString('utf8').trim();
  }

  public async gitBytes(clone: EphemeralClone, args: readonly string[]): Promise<Buffer> {
    return this.runGitBytes(
      clone.sessionDir,
      [
        `core.hooksPath=${path.join(clone.sessionDir, 'hooks')}`,
        'core.fsmonitor=false',
        'credential.helper=',
      ],
      ['-C', clone.repositoryRoot, ...args],
    );
  }

  public async createBundle(
    clone: EphemeralClone,
    baseSha: string,
    branch: string,
  ): Promise<Buffer> {
    const temporary = path.join(clone.sessionDir, `.workbench-${randomUUID()}.bundle`);
    try {
      await this.git(clone, ['bundle', 'create', temporary, `${baseSha}..${branch}`]);
      return await readFile(temporary);
    } finally {
      await rm(temporary, { force: true }).catch(() => undefined);
    }
  }

  public async remove(sessionDir: string): Promise<void> {
    if (!isOwnedSessionDirectory(this.options.workBase, sessionDir)) {
      throw new Error('refusing to remove a clone outside the publish work base');
    }
    await rm(sessionDir, { recursive: true, force: true });
  }

  public async sweepOrphans(now = new Date()): Promise<void> {
    await mkdir(this.options.workBase, { recursive: true, mode: 0o700 });
    const entries = await readdir(this.options.workBase, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('publish-'))
        .map(async (entry) => {
          const candidate = path.join(this.options.workBase, entry.name);
          const modified = await stat(candidate);
          if (now.getTime() - modified.mtime.getTime() >= this.orphanAgeMs)
            await this.remove(candidate);
        }),
    );
  }

  private async runGit(
    sessionDir: string,
    configArgs: readonly string[],
    args: readonly string[],
    extraEnv: Readonly<Record<string, string>> = {},
  ): Promise<string> {
    const { stdout } = await run(
      'git',
      [...configArgs.flatMap((argument) => ['-c', argument]), ...args],
      {
        encoding: 'utf8',
        maxBuffer: 20_000_000,
        env: cleanGitEnvironment(sessionDir, extraEnv),
      },
    );
    return stdout.trim();
  }

  private async runGitBytes(
    sessionDir: string,
    configArgs: readonly string[],
    args: readonly string[],
    extraEnv: Readonly<Record<string, string>> = {},
  ): Promise<Buffer> {
    const { stdout } = await run(
      'git',
      [...configArgs.flatMap((argument) => ['-c', argument]), ...args],
      {
        encoding: 'buffer',
        maxBuffer: 20_000_000,
        env: cleanGitEnvironment(sessionDir, extraEnv),
      },
    );
    return Buffer.from(stdout);
  }
}

function cleanGitEnvironment(
  sessionDir: string,
  extraEnv: Readonly<Record<string, string>>,
): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH,
    LANG: process.env.LANG,
    LC_ALL: process.env.LC_ALL,
    HOME: path.join(sessionDir, 'home'),
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
    ...extraEnv,
  };
}

function isOwnedSessionDirectory(workBase: string, sessionDir: string): boolean {
  const relative = path.relative(path.resolve(workBase), path.resolve(sessionDir));
  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative) &&
    !relative.includes(path.sep) &&
    relative.startsWith('publish-')
  );
}
