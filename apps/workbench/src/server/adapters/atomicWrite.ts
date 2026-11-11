import { mkdir, open, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type AtomicWriteStepName =
  'temporary-opened' | 'file-synced' | 'renamed' | 'directory-synced';

export interface AtomicWriteStep {
  readonly name: AtomicWriteStepName;
  readonly temporaryPath: string;
  readonly targetPath: string;
}

export type DirectoryCreateStepName =
  'directory-created' | 'directory-synced' | 'parent-directory-synced';

export interface DirectoryCreateStep {
  readonly name: DirectoryCreateStepName;
  readonly directory: string;
}

export async function createDirectoryDurably(
  directory: string,
  onStep?: (step: DirectoryCreateStep) => void,
): Promise<void> {
  const missingDirectories: string[] = [];
  let ancestor = path.resolve(directory);

  for (;;) {
    try {
      const ancestorStat = await stat(ancestor);
      if (!ancestorStat.isDirectory())
        throw new Error(`directory path is not a directory: ${ancestor}`);
      break;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
      missingDirectories.unshift(ancestor);
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      ancestor = parent;
    }
  }

  for (const missingDirectory of missingDirectories) {
    try {
      await mkdir(missingDirectory);
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') throw error;
      const existing = await stat(missingDirectory);
      if (!existing.isDirectory()) throw error;
      continue;
    }
    onStep?.({ name: 'directory-created', directory: missingDirectory });
    await syncDirectory(missingDirectory);
    onStep?.({ name: 'directory-synced', directory: missingDirectory });
    const parent = path.dirname(missingDirectory);
    await syncDirectory(parent);
    onStep?.({ name: 'parent-directory-synced', directory: parent });
  }
}

/**
 * 임시 파일 → fsync → rename → 디렉터리 sync 로 원자적으로 쓴다.
 *
 * 표지 이미지도 같은 보장이 필요해 바이트열을 함께 받는다 (NOR-189). 반쯤 쓰인 이미지가
 * 남으면 목록이 깨진 그림을 그린다.
 */
export async function atomicWriteFile(
  targetPath: string,
  source: string | Uint8Array,
  onStep?: (step: AtomicWriteStep) => void,
): Promise<void> {
  const directory = path.dirname(targetPath);
  const temporaryPath = path.join(directory, `.${path.basename(targetPath)}.${randomUUID()}.tmp`);
  const step = (name: AtomicWriteStepName): void => onStep?.({ name, targetPath, temporaryPath });

  let temporaryHandle;
  let renamed = false;
  try {
    temporaryHandle = await open(temporaryPath, 'wx', 0o600);
    step('temporary-opened');
    await (typeof source === 'string'
      ? temporaryHandle.writeFile(source, 'utf8')
      : temporaryHandle.writeFile(source));
    await temporaryHandle.sync();
    step('file-synced');
    await temporaryHandle.close();
    temporaryHandle = undefined;

    await rename(temporaryPath, targetPath);
    renamed = true;
    step('renamed');
    await syncDirectory(directory);
    step('directory-synced');
  } catch (error) {
    await temporaryHandle?.close().catch(() => undefined);
    if (!renamed) await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function syncDirectory(directory: string): Promise<void> {
  let handle;
  try {
    handle = await open(directory, 'r');
    await handle.sync();
  } catch (error) {
    if (!isPermittedDirectorySyncError(error)) throw error;
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

function isPermittedDirectorySyncError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) return false;
  return ['EINVAL', 'ENOTSUP', 'EBADF', 'EISDIR', 'EPERM'].includes(
    String((error as NodeJS.ErrnoException).code),
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
