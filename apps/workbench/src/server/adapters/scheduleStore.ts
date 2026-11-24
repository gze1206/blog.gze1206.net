/** 일정 파일 저장소(NOR-242). 작업 공간 `schedule/<ULID>.md` 에 일정 하나씩 둔다. */
import { readFile, readdir, unlink } from 'node:fs/promises';

import {
  assertScheduleId,
  parseEvent,
  serializeEvent,
  type ScheduleEvent,
} from '../../core/schedule/index.js';
import { atomicWriteFile, createDirectoryDurably } from './atomicWrite.js';
import { acquireWorkspaceLock } from './journalStore.js';
import { resolveWorkspacePath } from './paths.js';

export interface ScheduleProblem {
  readonly relativePath: string;
  readonly message: string;
}

export interface ScheduleTransaction {
  read(id: string): Promise<ScheduleEvent | null>;
  write(event: ScheduleEvent): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface ScheduleStore {
  list(): Promise<{ events: ScheduleEvent[]; problems: ScheduleProblem[] }>;
  read(id: string): Promise<ScheduleEvent | null>;
  runExclusive<T>(task: (transaction: ScheduleTransaction) => Promise<T>): Promise<T>;
}

export class ServerScheduleStore implements ScheduleStore {
  private queue: Promise<unknown> = Promise.resolve();

  public constructor(private readonly root: string) {}

  /** 읽지 못한 파일은 문제로 돌려준다. 하나가 깨졌다고 일정 전체를 못 보면 안 된다. */
  public async list(): Promise<{ events: ScheduleEvent[]; problems: ScheduleProblem[] }> {
    const directory = await resolveWorkspacePath(this.root, 'schedule');
    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return { events: [], problems: [] };
      throw error;
    }
    const events: ScheduleEvent[] = [];
    const problems: ScheduleProblem[] = [];
    for (const name of names.filter((entry) => entry.endsWith('.md')).sort()) {
      const id = name.slice(0, -3);
      try {
        const event = await this.read(id);
        if (event !== null) events.push(event);
      } catch (error) {
        problems.push({
          relativePath: `schedule/${name}`,
          message: error instanceof Error ? error.message : 'invalid schedule file',
        });
      }
    }
    return { events, problems };
  }

  public async read(id: string): Promise<ScheduleEvent | null> {
    const target = await this.resolve(id);
    try {
      return parseEvent(id, await readFile(target, 'utf8'));
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  public async runExclusive<T>(task: (transaction: ScheduleTransaction) => Promise<T>): Promise<T> {
    const current = this.queue
      .catch(() => undefined)
      .then(async () => {
        const lockPath = await resolveWorkspacePath(this.root, '.workbench.lock');
        const lock = await acquireWorkspaceLock(lockPath);
        try {
          return await task({
            read: (id) => this.read(id),
            write: (event) => this.write(event),
            remove: (id) => this.remove(id),
          });
        } finally {
          await lock.close().catch(() => undefined);
          await unlink(lockPath).catch(() => undefined);
        }
      });
    this.queue = current;
    return current;
  }

  private async write(event: ScheduleEvent): Promise<void> {
    const source = serializeEvent(event);
    // 다시 읽어 같은 값이 되는지 확인한 뒤에만 쓴다.
    parseEvent(event.id, source);
    await createDirectoryDurably(await resolveWorkspacePath(this.root, 'schedule'));
    await atomicWriteFile(await this.resolve(event.id), source);
  }

  private async remove(id: string): Promise<void> {
    await unlink(await this.resolve(id));
  }

  private resolve(id: string): Promise<string> {
    assertScheduleId(id);
    return resolveWorkspacePath(this.root, `schedule/${id}.md`);
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
