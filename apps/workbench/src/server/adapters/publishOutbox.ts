import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, mkdir, open, readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  BLOG_LAYOUT,
  SITE_COLLECTIONS,
  isBookId,
  type SiteCollection,
} from '@gze1206/content-contract';
import { publishRefKey } from '../../core/publishing/refKey.js';
import { SITE_COLLECTION_NAMES, sitePath } from '../../core/site/siteContent.js';

const run = promisify(execFile);

export type PublishExportFormat = 'bundle' | 'format-patch';

export interface PublishOutboxInput {
  readonly cloneDir: string;
  readonly baseSha: string;
  readonly branch: string;
  readonly commit: string;
  readonly commitMessage: string;
  readonly targetPath: string;
  readonly source: string;
  readonly diff: string;
  readonly author: string;
  readonly assets: readonly { reference: string; bytes: Buffer }[];
  readonly forceFormat?: PublishExportFormat;
  readonly exporter?: {
    bundle(baseSha: string, branch: string): Promise<Buffer>;
    formatPatch(baseSha: string, branch: string): Promise<Buffer>;
  };
}

export interface PublishOutboxResult {
  readonly outboxRef: string;
  readonly exportRef: string;
  readonly exportFormat: PublishExportFormat;
}

export class PublishOutbox {
  public constructor(private readonly root: string) {}

  public async write(input: PublishOutboxInput): Promise<PublishOutboxResult> {
    const root = await this.prepareRoot();
    const key = targetKeyFromPath(input.targetPath);
    const slug = key.startsWith('post:')
      ? key.slice(5)
      : key.startsWith('site:')
        ? `site-${key.slice(5).replace(':', '-')}`
        : `book-${publishRefKey(key.slice(5))}`;
    const prefix = `${slug}-${new Date().toISOString().replace(/[-:.]/gu, '')}`;
    const bundleRef = `${prefix}.bundle`;
    const patchRef = `${prefix}.patch`;
    const diffRef = `${prefix}.diff`;
    const sourceRef = `${prefix}.mdoc`;
    const outboxRef = `${prefix}.json`;
    const exportArtifact = await this.createExport(input, root, bundleRef, patchRef);

    await writeAtomically(path.join(root, exportArtifact.ref), exportArtifact.bytes);
    await writeAtomically(path.join(root, diffRef), Buffer.from(input.diff, 'utf8'));
    await writeAtomically(path.join(root, sourceRef), Buffer.from(input.source, 'utf8'));
    await writeAtomically(
      path.join(root, outboxRef),
      Buffer.from(
        `${JSON.stringify(
          {
            baseSha: input.baseSha,
            branch: input.branch,
            targetPath: input.targetPath,
            commitMessage: input.commitMessage,
            exportFormat: exportArtifact.format,
            exportRef: exportArtifact.ref,
            commit: input.commit,
            author: input.author,
            assets: input.assets.map((asset) => ({
              reference: asset.reference,
              sha256: createHash('sha256').update(asset.bytes).digest('hex'),
            })),
            createdAt: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
        'utf8',
      ),
    );
    return {
      outboxRef,
      exportRef: exportArtifact.ref,
      exportFormat: exportArtifact.format,
    };
  }

  private async prepareRoot(): Promise<string> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    await chmod(this.root, 0o700);
    const root = await realpath(this.root);
    if (!(await stat(root)).isDirectory()) throw new Error('publish outbox must be a directory');
    return root;
  }

  private async createExport(
    input: PublishOutboxInput,
    root: string,
    bundleRef: string,
    patchRef: string,
  ): Promise<{ format: PublishExportFormat; ref: string; bytes: Buffer }> {
    if (input.forceFormat !== 'format-patch') {
      if (input.exporter) {
        try {
          return {
            format: 'bundle',
            ref: assertArtifactRef(root, bundleRef),
            bytes: await input.exporter.bundle(input.baseSha, input.branch),
          };
        } catch (error) {
          if (input.forceFormat === 'bundle') throw error;
        }
      }
      const temporary = path.join(input.cloneDir, `.workbench-${randomUUID()}.bundle`);
      try {
        await run(
          'git',
          [
            '-C',
            input.cloneDir,
            'bundle',
            'create',
            temporary,
            `${input.baseSha}..${input.branch}`,
          ],
          { encoding: 'buffer', maxBuffer: 20_000_000 },
        );
        const bytes = await readFile(temporary);
        return { format: 'bundle', ref: assertArtifactRef(root, bundleRef), bytes };
      } catch (error) {
        if (input.forceFormat === 'bundle') throw error;
      } finally {
        await rm(temporary, { force: true }).catch(() => undefined);
      }
    }
    if (input.exporter) {
      return {
        format: 'format-patch',
        ref: assertArtifactRef(root, patchRef),
        bytes: await input.exporter.formatPatch(input.baseSha, input.branch),
      };
    }
    const { stdout } = await run(
      'git',
      [
        '-C',
        input.cloneDir,
        'format-patch',
        '--binary',
        '--stdout',
        `${input.baseSha}..${input.branch}`,
      ],
      { encoding: 'buffer', maxBuffer: 20_000_000 },
    );
    return {
      format: 'format-patch',
      ref: assertArtifactRef(root, patchRef),
      bytes: Buffer.from(stdout),
    };
  }
}

export function targetKeyFromPath(targetPath: string): string {
  const posts = `${BLOG_LAYOUT.postsDir}/`;
  if (targetPath.startsWith(posts)) {
    const match = /^([a-z0-9-]+)\.mdoc$/u.exec(targetPath.slice(posts.length));
    if (match?.[1]) return `post:${match[1]}`;
  }
  const books = `${BLOG_LAYOUT.booksDir}/`;
  if (targetPath.startsWith(books) && targetPath.endsWith('.json')) {
    const id = targetPath.slice(books.length, -5);
    if (isBookId(id)) return `book:${id}`;
  }
  for (const collection of SITE_COLLECTION_NAMES) {
    for (const id of siteIdCandidates(collection, targetPath)) {
      if (sitePathOrNull(collection, id) === targetPath) return `site:${collection}:${id}`;
    }
  }
  throw new Error('invalid publish target path');
}

function siteIdCandidates(collection: SiteCollection, targetPath: string): string[] {
  const target = SITE_COLLECTIONS[collection];
  if (target.single) return [collection];
  const prefix = `${target.path}/`;
  return targetPath.startsWith(prefix) && targetPath.endsWith('.json')
    ? [targetPath.slice(prefix.length, -5)]
    : [];
}

function sitePathOrNull(collection: SiteCollection, id: string): string | null {
  try {
    return sitePath(collection, id);
  } catch {
    return null;
  }
}

function assertArtifactRef(root: string, reference: string): string {
  if (
    path.isAbsolute(reference) ||
    reference.includes('..') ||
    path.basename(reference) !== reference
  ) {
    throw new Error('publish outbox reference escapes root');
  }
  const target = path.resolve(root, reference);
  if (path.dirname(target) !== root) throw new Error('publish outbox reference escapes root');
  return reference;
}

async function writeAtomically(target: string, bytes: Buffer): Promise<void> {
  const directory = path.dirname(target);
  const temporary = path.join(directory, `.${path.basename(target)}.${randomUUID()}.tmp`);
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, target);
    await chmod(target, 0o600);
    await syncDirectory(directory);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function syncDirectory(directory: string): Promise<void> {
  const handle = await open(directory, 'r');
  try {
    await handle.sync();
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      !['EINVAL', 'EPERM'].includes(String(error.code))
    ) {
      throw error;
    }
  } finally {
    await handle.close();
  }
}
