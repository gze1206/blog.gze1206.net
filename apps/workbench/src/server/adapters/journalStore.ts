import { open, readFile, readdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import { assertCalendarDate } from '../../core/bullets/date.js';
import { parseDocument } from '../../core/document/document.js';
import { atomicWriteFile, createDirectoryDurably } from './atomicWrite.js';
import { resolveWorkspacePath } from './paths.js';

export interface JournalEntry {
  readonly date: string;
  readonly source: string;
}

export interface JournalStore {
  read(date: string): Promise<string | null>;
  listBefore(date: string): Promise<readonly JournalEntry[]>;
  runExclusive<T>(task: (transaction: JournalTransaction) => Promise<T>): Promise<T>;
}

export interface JournalTransaction {
  read(date: string): Promise<string | null>;
  write(date: string, source: string): Promise<void>;
  writeMigration(
    sourceDate: string,
    source: string,
    targetDate: string,
    target: string,
  ): Promise<void>;
}

export class ServerJournalStore implements JournalStore {
  private queue: Promise<unknown> = Promise.resolve();

  public constructor(private readonly root: string) {}

  public async read(date: string): Promise<string | null> {
    const target = await this.resolve(date);
    try {
      return await readFile(target, 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  public async listBefore(date: string): Promise<readonly JournalEntry[]> {
    assertDate(date);
    const journalRoot = await resolveWorkspacePath(this.root, 'journal');
    let entries;
    try {
      entries = await readdir(journalRoot, { recursive: true, withFileTypes: true });
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return [];
      throw error;
    }
    const result: JournalEntry[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || !/^\d{4}-\d{2}-\d{2}\.md$/u.test(entry.name)) continue;
      const entryDate = entry.name.slice(0, -3);
      if (entryDate >= date) continue;
      const source = await this.read(entryDate);
      if (source !== null) result.push({ date: entryDate, source });
    }
    return result.sort((left, right) => right.date.localeCompare(left.date));
  }

  public async runExclusive<T>(task: (transaction: JournalTransaction) => Promise<T>): Promise<T> {
    return this.runSerialized(async () =>
      this.withWorkspaceLock(async () =>
        task({
          read: (date) => this.read(date),
          write: (date, source) => this.writeUnlockedValidated(date, source),
          writeMigration: (sourceDate, source, targetDate, target) =>
            this.writeMigrationUnlocked(sourceDate, source, targetDate, target),
        }),
      ),
    );
  }

  private async writeMigrationUnlocked(
    sourceDate: string,
    source: string,
    targetDate: string,
    target: string,
  ): Promise<void> {
    parseDocument(source);
    parseDocument(target);
    if (sourceDate === targetDate) throw new Error('migration dates must differ');
    const originalSource = await this.read(sourceDate);
    const originalTarget = await this.read(targetDate);
    if (originalSource === null) throw new Error('source journal not found');
    try {
      await this.writeUnlocked(targetDate, target);
      await this.writeUnlocked(sourceDate, source);
    } catch (error) {
      if (originalTarget === null) {
        await unlink(await this.resolve(targetDate)).catch(() => undefined);
      } else {
        await this.writeUnlocked(targetDate, originalTarget).catch(() => undefined);
      }
      await this.writeUnlocked(sourceDate, originalSource).catch(() => undefined);
      throw error;
    }
  }

  private async writeUnlockedValidated(date: string, source: string): Promise<void> {
    parseDocument(source);
    await this.writeUnlocked(date, source);
  }

  private async writeUnlocked(date: string, source: string): Promise<void> {
    const target = await this.resolve(date);
    await createDirectoryDurably(path.dirname(target));
    const targetStat = await stat(path.dirname(target));
    if (!targetStat.isDirectory()) throw new Error('journal parent must be a directory');
    await atomicWriteFile(target, source);
  }

  private resolve(date: string): Promise<string> {
    assertDate(date);
    return resolveWorkspacePath(
      this.root,
      `journal/${date.slice(0, 4)}/${date.slice(5, 7)}/${date}.md`,
    );
  }

  private async runSerialized<T>(task: () => Promise<T>): Promise<T> {
    const current = this.queue.catch(() => undefined).then(task);
    this.queue = current;
    return current;
  }

  private async withWorkspaceLock<T>(task: () => Promise<T>): Promise<T> {
    const lockPath = await resolveWorkspacePath(this.root, '.workbench.lock');
    const lock = await acquireWorkspaceLock(lockPath);
    try {
      return await task();
    } finally {
      await lock.close().catch(() => undefined);
      await unlink(lockPath).catch(() => undefined);
    }
  }
}

async function acquireWorkspaceLock(lockPath: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    let lock;
    try {
      lock = await open(lockPath, 'wx', 0o600);
      try {
        await lock.writeFile(`${process.pid}\n`, 'utf8');
        await lock.sync();
        return lock;
      } catch (error) {
        await lock.close().catch(() => undefined);
        await unlink(lockPath).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST' || attempt === 79) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error('unable to acquire workspace lock');
}

function assertDate(date: string): void {
  assertCalendarDate(date);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
