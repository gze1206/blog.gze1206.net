import { link, open, readFile, readdir, realpath, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import { parseDocument, serializeDocument } from '../../core/document/document.js';
import type {
  CreateFromTemplateInput,
  DocumentEntry,
  DocumentList,
  DocumentProblem,
  DocumentSummary,
  DocumentTrash,
  FileStore,
  TemplateSummary,
  TrashEntry,
} from '../../core/ports.js';
import { TrashConflictError } from '../../core/ports.js';
import { instantiateTemplate, parseTemplate } from '../../core/template/index.js';
import { atomicWriteFile, createDirectoryDurably } from './atomicWrite.js';
import { assertWorkspaceRelativePath, resolveWorkspacePath } from './paths.js';

const templateIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const idPattern = /^[A-Za-z0-9_-]+$/u;
// `books` 는 읽은 책 한 권이 문서 하나로 사는 자리다 (NOR-189).
const supportedDocumentRoots = ['inbox', 'journal', 'notes', 'drafts', 'reviews', 'books'] as const;
const documentRoots = new Set<string>(supportedDocumentRoots);
const reservedDirectoryNames = new Set(['assets', 'templates']);
/** 휴지통. `.workbench/` 는 git 백업에서 빠지고 문서 목록도 점으로 시작하는 곳을 읽지 않는다. */
const trashDirectory = '.workbench/trash';
/** `<UTC 시각>--<원래 경로 base64url>.md`. 시각이 앞이라 이름 순이 지운 순서다. */
const trashIdPattern = /^(\d{8}T\d{6}\d{3}Z)--([A-Za-z0-9_-]+)\.md$/u;

export class ServerFileStore implements FileStore, DocumentTrash {
  private readonly writeQueues = new Map<string, Promise<unknown>>();

  public constructor(private readonly root: string) {}

  public async listTemplates(): Promise<readonly TemplateSummary[]> {
    const templatesDirectory = await resolveWorkspacePath(this.root, 'templates');
    let entries;
    try {
      entries = await readdir(templatesDirectory, { withFileTypes: true });
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return [];
      throw error;
    }

    const templates = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
        .sort((left, right) => left.name.localeCompare(right.name))
        .map(async (entry): Promise<TemplateSummary> => {
          const id = entry.name.slice(0, -3);
          const source = await readFile(
            await resolveWorkspacePath(this.root, `templates/${entry.name}`),
            'utf8',
          );
          const template = parseTemplate(source);
          return {
            id,
            title: template.title,
            kind: template.kind,
            publicEligible: template.publicEligible,
          };
        }),
    );
    return templates;
  }

  public async listDocuments(): Promise<DocumentList> {
    const documents: DocumentSummary[] = [];
    const problems: DocumentProblem[] = [];
    for (const documentRoot of supportedDocumentRoots) {
      try {
        await this.scanDocuments(documentRoot, documents, problems);
      } catch (error) {
        if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
      }
    }
    return {
      documents: documents.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      problems: problems.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    };
  }

  public async createFromTemplate(input: CreateFromTemplateInput): Promise<DocumentEntry> {
    if (!templateIdPattern.test(input.templateId)) throw new Error('invalid template id');
    if (!idPattern.test(input.tokens.id)) throw new Error('invalid document token id');

    const templatePath = await resolveWorkspacePath(this.root, `templates/${input.templateId}.md`);
    const template = parseTemplate(await readFile(templatePath, 'utf8'));
    const document = instantiateTemplate(template, input.title, input.tokens);
    const source = serializeDocument(document);
    parseDocument(source);

    const relativePath = `${template.defaultPath}/${documentFilename(template.kind, input)}`;
    return this.runSerialized(relativePath, async () =>
      this.withWorkspaceLock(async () => {
        const target = await this.prepareWriteTarget(relativePath);
        try {
          await stat(target);
          throw Object.assign(new Error('document already exists'), { code: 'EEXIST' });
        } catch (error) {
          if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
        }
        await atomicWriteFile(target, source);
        return { relativePath, source, document };
      }),
    );
  }

  public async importDocument(input: {
    readonly relativePath: string;
    readonly source: string;
    readonly overwrite: boolean;
  }): Promise<DocumentEntry> {
    // 디스크를 건드리기 전에 문서로 성립하는지 본다. 깨진 파일을 만들어 두고 실패하지 않는다.
    const document = parseDocument(input.source);
    const source = serializeDocument(document);

    return this.runSerialized(input.relativePath, async () =>
      this.withWorkspaceLock(async () => {
        const target = await this.prepareWriteTarget(input.relativePath);
        const exists = await stat(target).then(
          () => true,
          (error: unknown) => {
            if (isNodeError(error) && error.code === 'ENOENT') return false;
            throw error;
          },
        );
        if (exists && !input.overwrite) {
          throw Object.assign(new Error('document already exists'), { code: 'EEXIST' });
        }
        await atomicWriteFile(target, source);
        return { relativePath: input.relativePath, source, document };
      }),
    );
  }

  public async readDocument(relativePath: string): Promise<DocumentEntry> {
    const target = await this.resolveDocumentPath(relativePath);
    const targetStat = await stat(target);
    if (!targetStat.isFile()) throw new Error('document target must be a regular file');
    const source = await readFile(target, 'utf8');
    try {
      return { relativePath, source, document: parseDocument(source) };
    } catch (error) {
      // 어느 파일이 왜 안 되는지 모르면 고칠 수가 없다.
      throw new Error(`${relativePath}: ${describeProblem(error)}`, { cause: error });
    }
  }

  public async writeDocument(relativePath: string, source: string): Promise<DocumentEntry> {
    const target = await this.resolveDocumentPath(relativePath);
    const targetStat = await stat(target);
    if (!targetStat.isFile()) throw new Error('document target must be an existing file');
    const document = parseDocument(source);
    const canonicalSource = serializeDocument(document);
    return this.runSerialized(relativePath, async () =>
      this.withWorkspaceLock(async () => {
        const validatedTarget = await this.resolveDocumentPath(relativePath);
        await atomicWriteFile(validatedTarget, canonicalSource);
        return { relativePath, source: canonicalSource, document };
      }),
    );
  }

  public async trashDocument(relativePath: string): Promise<TrashEntry> {
    const target = await this.resolveDocumentPath(relativePath);
    const { document } = await this.readDocument(relativePath);
    const deletedAt = new Date();
    const id = `${deletedAt.toISOString().replace(/[-:.]/gu, '')}--${Buffer.from(relativePath, 'utf8').toString('base64url')}.md`;
    return this.runSerialized(relativePath, async () =>
      this.withWorkspaceLock(async () => {
        const directory = await resolveWorkspacePath(this.root, trashDirectory);
        await createDirectoryDurably(directory);
        await rename(target, path.join(directory, id));
        return { id, relativePath, title: document.title, deletedAt: deletedAt.toISOString() };
      }),
    );
  }

  public async listTrash(): Promise<readonly TrashEntry[]> {
    const directory = await resolveWorkspacePath(this.root, trashDirectory);
    const names = await readdir(directory).catch(() => [] as string[]);
    const entries: TrashEntry[] = [];
    for (const name of names.sort().reverse()) {
      const parsed = parseTrashId(name);
      if (parsed === null) continue;
      let title = path.posix.basename(parsed.relativePath, '.md');
      try {
        title = parseDocument(await readFile(path.join(directory, name), 'utf8')).title;
      } catch {
        // 읽지 못해도 휴지통에서는 보이게 한다. 지우거나 되돌릴 수 있어야 한다.
      }
      entries.push({
        id: name,
        relativePath: parsed.relativePath,
        title,
        deletedAt: parsed.deletedAt,
      });
    }
    return entries;
  }

  public async restoreTrash(id: string): Promise<string> {
    const parsed = parseTrashId(id);
    if (parsed === null) throw new Error('invalid trash id');
    return this.runSerialized(parsed.relativePath, async () =>
      this.withWorkspaceLock(async () => {
        const source = path.join(await resolveWorkspacePath(this.root, trashDirectory), id);
        const target = await this.prepareWriteTarget(parsed.relativePath);
        // link 는 대상이 있으면 실패한다. 확인과 옮기기 사이에 끼어들 틈이 없다.
        try {
          await link(source, target);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
            throw new TrashConflictError(`${parsed.relativePath} 에 이미 문서가 있습니다.`);
          }
          throw error;
        }
        await unlink(source);
        return parsed.relativePath;
      }),
    );
  }

  public async purgeTrash(id: string): Promise<void> {
    if (parseTrashId(id) === null) throw new Error('invalid trash id');
    await this.withWorkspaceLock(async () => {
      await unlink(path.join(await resolveWorkspacePath(this.root, trashDirectory), id));
    });
  }

  private async prepareWriteTarget(relativePath: string): Promise<string> {
    const initialTarget = await this.resolveDocumentPath(relativePath);
    await createDirectoryDurably(path.dirname(initialTarget));
    return this.resolveDocumentPath(relativePath);
  }

  private async resolveDocumentPath(relativePath: string): Promise<string> {
    assertDocumentRelativePath(relativePath);
    const target = await resolveWorkspacePath(this.root, relativePath);
    const canonicalRoot = await realpath(this.root);
    const canonicalRelativePath = path.relative(canonicalRoot, target).split(path.sep).join('/');
    assertDocumentRelativePath(canonicalRelativePath);
    return target;
  }

  private async scanDocuments(
    relativeDirectory: string,
    documents: DocumentSummary[],
    problems: DocumentProblem[],
  ): Promise<void> {
    const directory = relativeDirectory
      ? await resolveWorkspacePath(this.root, relativeDirectory)
      : await realpath(this.root);
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (reservedDirectoryNames.has(entry.name)) continue;
        await this.scanDocuments(relativePath, documents, problems);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // 파일 하나가 읽히지 않아도 나머지는 계속 읽는다. 실패는 결과에 실어 보낸다(NOR-190).
        try {
          const document = await this.readDocument(relativePath);
          documents.push({
            relativePath,
            label: path.basename(entry.name, '.md'),
            title: document.document.title,
            kind: document.document.kind,
            updatedAt: document.document.updatedAt,
            // 목록에서 표지를 보이려면 여기서 실어 보내야 한다. 파일을 다시 열게 하지 않는다.
            ...(document.document.cover === undefined ? {} : { cover: document.document.cover }),
            // 블로그 글은 목록에서 카테고리별로 묶는다(NOR-221).
            ...(typeof document.document.category === 'string' && document.document.category !== ''
              ? { category: document.document.category }
              : {}),
          });
        } catch (error) {
          problems.push({ relativePath, message: describeProblem(error) });
        }
      }
    }
  }

  private async runSerialized<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.writeQueues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    this.writeQueues.set(key, current);
    try {
      return await current;
    } finally {
      if (this.writeQueues.get(key) === current) this.writeQueues.delete(key);
    }
  }

  private async withWorkspaceLock<T>(task: () => Promise<T>): Promise<T> {
    const lockPath = await resolveWorkspacePath(this.root, '.workbench.lock');
    const lock = await acquireLock(lockPath);
    try {
      return await task();
    } finally {
      await lock.close().catch(() => undefined);
      await unlink(lockPath).catch(() => undefined);
    }
  }
}

function parseTrashId(id: string): { relativePath: string; deletedAt: string } | null {
  const match = trashIdPattern.exec(id);
  if (match === null) return null;
  const relativePath = Buffer.from(match[2] ?? '', 'base64url').toString('utf8');
  try {
    assertDocumentRelativePath(relativePath);
  } catch {
    return null;
  }
  const stamp = match[1] ?? '';
  const deletedAt = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(9, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}.${stamp.slice(15, 18)}Z`;
  return { relativePath, deletedAt };
}

function assertDocumentRelativePath(relativePath: string): void {
  assertWorkspaceRelativePath(relativePath);
  const segments = relativePath.split('/');
  if (
    !documentRoots.has(segments[0] ?? '') ||
    segments.some((segment) => segment.startsWith('.')) ||
    segments.slice(0, -1).some((segment) => reservedDirectoryNames.has(segment)) ||
    path.posix.extname(relativePath) !== '.md'
  ) {
    throw new Error('expected a supported document path');
  }
}

function documentFilename(kind: string, input: CreateFromTemplateInput): string {
  if (kind === 'weekly-review' || kind === 'monthly-review') return `${input.tokens.period}.md`;
  if (kind === 'capture') return `${input.tokens.date}-${input.tokens.id}.md`;
  const slug = input.title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '');
  return `${slug || input.tokens.id}.md`;
}

async function acquireLock(lockPath: string) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const handle = await open(lockPath, 'wx', 0o600);
      await handle.writeFile(`${process.pid}\n`, 'utf8');
      await handle.sync();
      return handle;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST' || attempt === 79) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error('unable to acquire workspace lock');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * 사람이 읽고 고칠 수 있는 한 줄로 줄인다.
 *
 * `readDocument` 는 오류 앞에 파일 경로를 붙인다(직접 열었을 때 어느 파일인지 알아야 하므로).
 * 목록의 문제 항목은 경로를 이미 따로 들고 있으니, 원인 메시지만 꺼내 중복을 없앤다.
 */
function describeProblem(error: unknown): string {
  if (error instanceof Error && error.cause instanceof Error) return error.cause.message;
  return error instanceof Error ? error.message : String(error);
}
