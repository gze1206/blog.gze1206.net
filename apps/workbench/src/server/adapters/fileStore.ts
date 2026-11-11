import { open, readFile, readdir, realpath, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

import { parseDocument, serializeDocument } from '../../core/document/document.js';
import type {
  CreateFromTemplateInput,
  DocumentEntry,
  DocumentList,
  DocumentProblem,
  DocumentSummary,
  FileStore,
  TemplateSummary,
} from '../../core/ports.js';
import { instantiateTemplate, parseTemplate } from '../../core/template/index.js';
import { atomicWriteFile, createDirectoryDurably } from './atomicWrite.js';
import { assertWorkspaceRelativePath, resolveWorkspacePath } from './paths.js';

const templateIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const idPattern = /^[A-Za-z0-9_-]+$/u;
// `books` 는 읽은 책 한 권이 문서 하나로 사는 자리다 (NOR-189).
const supportedDocumentRoots = ['inbox', 'journal', 'notes', 'drafts', 'reviews', 'books'] as const;
const documentRoots = new Set<string>(supportedDocumentRoots);
const reservedDirectoryNames = new Set(['assets', 'templates']);

export class ServerFileStore implements FileStore {
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
