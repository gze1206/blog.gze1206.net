import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BLOG_LAYOUT, isBookId } from '@gze1206/content-contract';

import { parseDocument, type BookDocument } from '../../core/document/document.js';
import { parseFrontmatter } from '../../core/document/frontmatter.js';
import { bookIdOf, planBookExport, type BookExportPlan } from '../../core/books/publicBook.js';
import { readImageSize } from '../../core/books/imageSize.js';
import { resolveWorkspacePath } from './paths.js';
import type { BlogPost } from '../../core/import/blogImport.js';
import type { PublicPost } from '../../core/publishing/contract.js';
import { quoteWarnings, type ExpandedQuote } from '../../core/publishing/bookquote.js';
import {
  transformPublicDraft,
  type TransformPublicDraftInput,
  type TransformedPublicPost,
} from '../../core/publishing/transform.js';
import { EphemeralCloneManager, type EphemeralClone } from './ephemeralClone.js';
import { PublishOutbox, type PublishExportFormat } from './publishOutbox.js';
import type { RemotePolicy } from './remotePolicy.js';
import { PublishSessionRegistry } from './sessionRegistry.js';

export interface PublishDraftInput {
  readonly documentId: string;
  readonly source: string;
  readonly assetIds: readonly string[];
}

export interface ConfirmPublishInput extends PublishDraftInput {
  readonly confirmPublish: boolean;
  readonly reviewId: string;
}

export interface PublishReview {
  readonly reviewId: string;
  readonly baseHead: string;
  readonly branch: string;
  readonly targetPath: string;
  readonly metadata: PublicPost;
  readonly assets: readonly string[];
  readonly diff: string;
  readonly quotes?: readonly ExpandedQuote[];
  readonly warnings?: readonly string[];
}

export interface BookReview {
  readonly reviewId: string;
  readonly baseHead: string;
  readonly branch: string;
  readonly targetPath: string;
  readonly diff: string;
  readonly kind: BookExportPlan['kind'];
}
export interface BookConfirm {
  readonly confirmPublish: boolean;
  readonly reviewId: string;
}

export interface PublicAssetCandidate {
  readonly id: string;
  readonly reference: string;
  readonly size: number;
}

export interface PublishResult {
  readonly outboxRef: string;
  readonly exportRef: string;
  readonly exportFormat: PublishExportFormat;
  readonly baseSha: string;
  readonly branch: string;
  readonly commit: string;
  readonly targetPath: string;
}

export interface PublicBlogPublisher {
  listAssets(documentId: string): Promise<readonly PublicAssetCandidate[]>;
  review(input: PublishDraftInput): Promise<PublishReview>;
  publish(input: ConfirmPublishInput): Promise<PublishResult>;
  reviewBook?(id: string): Promise<BookReview>;
  publishBook?(id: string, confirm: BookConfirm): Promise<PublishResult>;
}

export interface PublicBlogAdapterOptions {
  readonly privateRoot: string;
  readonly remote: string;
  readonly branch: string;
  readonly workBase: string;
  readonly outboxRoot: string;
  readonly author: { readonly name: string; readonly email: string };
  readonly remotePolicy: RemotePolicy;
  readonly forceExportFormat?: PublishExportFormat;
  readonly sessionLeaseMs?: number;
  readonly now?: () => Date;
}

/** 블로그 저장소에서 글이 사는 자리. 발행과 가져오기가 같은 값을 본다. */
const POSTS_DIRECTORY = BLOG_LAYOUT.postsDir;

/**
 * 블로그 글 파일에서 목록에 필요한 것만 뽑는다.
 *
 * 프론트매터가 깨진 파일이라도 **목록에서 빼지 않는다** — 가져오기 화면에서 그 글이 통째로
 * 사라지면 사용자는 블로그에 없는 글로 오해한다. 파일 이름에서 slug 를 대신 얻는다.
 */
function describePost(repoPath: string, fileName: string, source: string): BlogPost {
  const fallbackSlug = fileName.replace(/\.(?:md|mdoc)$/u, '');
  try {
    const { data } = parseFrontmatter(source);
    return {
      repoPath,
      slug: typeof data.slug === 'string' ? data.slug : fallbackSlug,
      title: typeof data.title === 'string' ? data.title : fallbackSlug,
      draft: data.draft === true,
      updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
      source,
    };
  } catch {
    return {
      repoPath,
      slug: fallbackSlug,
      title: fallbackSlug,
      draft: false,
      updatedAt: '',
      source,
    };
  }
}

export class PublicBlogAdapter implements PublicBlogPublisher {
  private readonly cloneManager: EphemeralCloneManager;
  private readonly outbox: PublishOutbox;
  private readonly sessions: PublishSessionRegistry;

  public constructor(private readonly options: PublicBlogAdapterOptions) {
    this.cloneManager = new EphemeralCloneManager({
      workBase: options.workBase,
      remote: options.remote,
      branch: options.branch,
      remotePolicy: options.remotePolicy,
    });
    this.outbox = new PublishOutbox(options.outboxRoot);
    this.sessions = new PublishSessionRegistry({
      ...(options.sessionLeaseMs === undefined ? {} : { leaseMs: options.sessionLeaseMs }),
      ...(options.now === undefined ? {} : { now: options.now }),
      removeClone: (sessionDir) => this.cloneManager.remove(sessionDir),
    });
  }

  public async listAssets(documentId: string): Promise<readonly PublicAssetCandidate[]> {
    return (await this.inspectAssets(documentId)).map(({ id, reference, size }) => ({
      id,
      reference,
      size,
    }));
  }

  /**
   * 공개 블로그의 글 목록을 읽어 온다 (NOR-187).
   *
   * 읽기 전용이다. 발행과 같은 임시 clone 을 쓰되 커밋도 push 도 하지 않고, 읽고 나면 바로
   * 지운다 — 세션으로 남겨 둘 이유가 없다. 함께 돌려주는 커밋 해시는 가져온 글의 출처가
   * 되어, 나중에 다시 발행할 때 그 사이 블로그가 앞서 나갔는지 판정하는 기준이 된다.
   */
  public async listImportablePosts(): Promise<{
    readonly commit: string;
    readonly posts: readonly BlogPost[];
  }> {
    const clone = await this.cloneManager.create();
    try {
      const commit = await this.cloneManager.git(clone, ['rev-parse', 'HEAD']);
      const postsDirectory = path.join(clone.repositoryRoot, POSTS_DIRECTORY);
      const entries = await readdir(postsDirectory, { withFileTypes: true }).catch(() => []);
      const posts: BlogPost[] = [];

      for (const entry of entries) {
        if (!entry.isFile() || !/\.(?:md|mdoc)$/u.test(entry.name)) continue;
        const repoPath = `${POSTS_DIRECTORY}/${entry.name}`;
        const source = await readFile(path.join(postsDirectory, entry.name), 'utf8');
        posts.push(describePost(repoPath, entry.name, source));
      }

      return {
        commit,
        posts: posts.sort((left, right) => left.slug.localeCompare(right.slug)),
      };
    } finally {
      await this.cloneManager.remove(clone.sessionDir);
    }
  }

  public async review(input: PublishDraftInput): Promise<PublishReview> {
    const prepared = await this.prepare(input);
    const clone = await this.cloneManager.create();
    try {
      const reviewState = await this.createReview(prepared, clone);
      const session = this.sessions.register({
        cloneDir: clone.sessionDir,
        baseSha: reviewState.review.baseHead,
        fingerprint: fingerprint(prepared, reviewState),
      });
      return { ...reviewState.review, reviewId: session.reviewId };
    } catch (error) {
      await this.cloneManager.remove(clone.sessionDir);
      throw error;
    }
  }

  public async publish(input: ConfirmPublishInput): Promise<PublishResult> {
    if (input.confirmPublish !== true) throw new Error('publishing requires confirmPublish: true');
    const preliminary = await this.sessions.lookup(input.reviewId).catch(() => undefined);
    if (!preliminary) throw new Error('publish review is stale');
    const clone: EphemeralClone = {
      sessionDir: preliminary.cloneDir,
      repositoryRoot: path.join(preliminary.cloneDir, 'repository'),
    };
    try {
      const prepared = await this.prepare(input);
      const reviewState = await this.createReview(prepared, clone);
      const { review } = reviewState;
      const contentFingerprint = fingerprint(prepared, reviewState);
      await this.sessions.get(input.reviewId, contentFingerprint, review.baseHead);
      await this.beginPublish(clone, review.branch);
      await this.writeOutput(clone.repositoryRoot, review.targetPath, prepared.transformed.source);
      for (const asset of prepared.assets) {
        await this.writeApprovedAsset(
          clone.repositoryRoot,
          asset.bytes,
          `${BLOG_LAYOUT.publicDir}/assets/posts/${prepared.transformed.metadata.slug}/${asset.reference}`,
        );
      }
      await this.cloneManager.git(clone, ['add', '--', review.targetPath, ...review.assets]);
      const commitMessage = `✨ feat(content): ${prepared.transformed.metadata.slug} 게시`;
      await this.cloneManager.git(clone, [
        '-c',
        'user.useConfigOnly=true',
        '-c',
        `user.name=${this.options.author.name}`,
        '-c',
        `user.email=${this.options.author.email}`,
        'commit',
        '-m',
        commitMessage,
      ]);
      const commit = await this.cloneManager.git(clone, ['rev-parse', 'HEAD']);
      const exportResult = await this.outbox.write({
        cloneDir: clone.repositoryRoot,
        baseSha: review.baseHead,
        branch: review.branch,
        commit,
        commitMessage,
        targetPath: review.targetPath,
        source: prepared.transformed.source,
        diff: review.diff,
        author: `${this.options.author.name} <${this.options.author.email}>`,
        assets: prepared.assets.map((asset) => ({
          reference: `${BLOG_LAYOUT.publicDir}/assets/posts/${prepared.transformed.metadata.slug}/${asset.reference}`,
          bytes: asset.bytes,
        })),
        exporter: {
          bundle: (baseSha, branch) => this.cloneManager.createBundle(clone, baseSha, branch),
          formatPatch: (baseSha, branch) =>
            this.cloneManager.gitBytes(clone, [
              'format-patch',
              '--binary',
              '--stdout',
              `${baseSha}..${branch}`,
            ]),
        },
        ...(this.options.forceExportFormat === undefined
          ? {}
          : { forceFormat: this.options.forceExportFormat }),
      });
      await this.sessions.consume(input.reviewId, contentFingerprint, review.baseHead);
      return {
        ...exportResult,
        baseSha: review.baseHead,
        branch: review.branch,
        commit,
        targetPath: review.targetPath,
      };
    } catch (error) {
      await this.sessions.discard(input.reviewId);
      throw error;
    }
  }

  public async reviewBook(id: string): Promise<BookReview> {
    const clone = await this.cloneManager.create();
    try {
      const state = await this.createBookReview(id, clone);
      const session = this.sessions.register({
        cloneDir: clone.sessionDir,
        baseSha: state.review.baseHead,
        fingerprint: state.fingerprint,
      });
      return { ...state.review, reviewId: session.reviewId };
    } catch (error) {
      await this.cloneManager.remove(clone.sessionDir);
      throw error;
    }
  }

  public async publishBook(id: string, confirm: BookConfirm): Promise<PublishResult> {
    if (confirm.confirmPublish !== true)
      throw new Error('publishing requires confirmPublish: true');
    const session = await this.sessions.lookup(confirm.reviewId);
    const clone = {
      sessionDir: session.cloneDir,
      repositoryRoot: path.join(session.cloneDir, 'repository'),
    };
    try {
      const state = await this.createBookReview(id, clone);
      const { review, plan, coverBytes, coverStates } = state;
      await this.sessions.get(confirm.reviewId, state.fingerprint, review.baseHead);
      if (plan.kind === 'noop') throw new Error('book export has no changes');
      await this.beginPublish(clone, review.branch);
      const changed = [review.targetPath];
      for (const coverState of coverStates) {
        if (
          coverState.exists &&
          (plan.kind === 'delete' || coverState.relativePath !== plan.cover?.to)
        ) {
          await assertNoSymlinkAncestors(clone.repositoryRoot, coverState.relativePath);
          await rm(path.join(clone.repositoryRoot, coverState.relativePath));
          changed.push(coverState.relativePath);
        }
      }
      if (plan.kind === 'delete') {
        await assertNoSymlinkAncestors(clone.repositoryRoot, plan.path);
        await rm(path.join(clone.repositoryRoot, plan.path));
      } else {
        await this.writeOutput(clone.repositoryRoot, plan.path, plan.content);
        await chmod(path.join(clone.repositoryRoot, plan.path), 0o644);
        if (plan.cover && coverBytes) {
          await this.writeApprovedAsset(clone.repositoryRoot, coverBytes, plan.cover.to);
          await chmod(path.join(clone.repositoryRoot, plan.cover.to), 0o644);
          changed.push(plan.cover.to);
        }
      }
      await this.cloneManager.git(clone, ['add', '-A', '--', ...changed]);
      const message =
        plan.kind === 'delete'
          ? `📚 docs(content): 책 ${id} 를 책장에서 뺀다`
          : `📚 docs(content): 책 ${id} 를 내보낸다`;
      await this.cloneManager.git(clone, [
        '-c',
        'user.useConfigOnly=true',
        '-c',
        `user.name=${this.options.author.name}`,
        '-c',
        `user.email=${this.options.author.email}`,
        'commit',
        '-m',
        message,
      ]);
      const commit = await this.cloneManager.git(clone, ['rev-parse', 'HEAD']);
      const exportResult = await this.outbox.write({
        cloneDir: clone.repositoryRoot,
        baseSha: review.baseHead,
        branch: review.branch,
        commit,
        commitMessage: message,
        targetPath: review.targetPath,
        source: plan.kind === 'write' ? plan.content : '',
        diff: review.diff,
        author: `${this.options.author.name} <${this.options.author.email}>`,
        assets:
          plan.kind === 'write' && plan.cover && coverBytes
            ? [{ reference: plan.cover.to, bytes: coverBytes }]
            : [],
        exporter: {
          bundle: (baseSha, branch) => this.cloneManager.createBundle(clone, baseSha, branch),
          formatPatch: (baseSha, branch) =>
            this.cloneManager.gitBytes(clone, [
              'format-patch',
              '--binary',
              '--stdout',
              `${baseSha}..${branch}`,
            ]),
        },
        ...(this.options.forceExportFormat === undefined
          ? {}
          : { forceFormat: this.options.forceExportFormat }),
      });
      await this.sessions.consume(confirm.reviewId, state.fingerprint, review.baseHead);
      return {
        ...exportResult,
        baseSha: review.baseHead,
        branch: review.branch,
        commit,
        targetPath: review.targetPath,
      };
    } catch (error) {
      await this.sessions.discard(confirm.reviewId);
      throw error;
    }
  }

  private async createBookReview(id: string, clone: EphemeralClone) {
    if (!isBookId(id)) throw new Error('invalid book id');
    const documentPath = `books/${id}.md`;
    await assertNoSymlinkAncestors(this.options.privateRoot, documentPath);
    const documentFile = await resolveWorkspacePath(this.options.privateRoot, documentPath);
    await assertRegularFile(documentFile);
    const record = parseDocument(await readFile(documentFile, 'utf8'));
    if (record.kind !== 'book' || bookIdOf(record) !== id)
      throw new Error('book id does not match document');
    const targetPath = `${BLOG_LAYOUT.booksDir}/${id}.json`;
    const [current, baseHead, coverStates] = await Promise.all([
      this.readOutput(clone.repositoryRoot, targetPath),
      this.cloneManager.git(clone, ['rev-parse', 'HEAD']),
      Promise.all(
        ['jpg', 'jpeg', 'png', 'webp'].map((ext) =>
          this.readPublicAssetState(
            clone.repositoryRoot,
            `${BLOG_LAYOUT.bookCoversDir}/${id}.${ext}`,
          ),
        ),
      ),
    ]);
    let coverBytes: Buffer | undefined;
    let cover:
      | {
          workspacePath: string;
          info: { src: string; width: number; height: number; source?: string };
        }
      | undefined;
    if (record.visible !== false && record.cover !== undefined) {
      if (!/^assets\/books\/[^/]+\.(?:jpe?g|png|webp)$/iu.test(record.cover))
        throw new Error('invalid book cover path');
      await assertNoSymlinkAncestors(this.options.privateRoot, record.cover);
      const coverFile = await resolveWorkspacePath(this.options.privateRoot, record.cover);
      const coverStat = await assertRegularFile(coverFile);
      if (coverStat.size > 5 * 1024 * 1024) throw new Error('book cover is too large');
      coverBytes = await readFile(coverFile);
      const size = readImageSize(coverBytes);
      if (!size) throw new Error('unsupported book cover image');
      const ext = path.extname(record.cover).toLowerCase();
      if (
        (size.type === 'jpeg' && !['.jpg', '.jpeg'].includes(ext)) ||
        (size.type !== 'jpeg' && ext !== `.${size.type}`)
      )
        throw new Error('book cover extension does not match image');
      cover = {
        workspacePath: record.cover,
        info: {
          src: '',
          width: size.width,
          height: size.height,
          ...(record.coverSource === undefined ? {} : { source: record.coverSource }),
        },
      };
    }
    let plan = planBookExport({ record, current, ...(cover === undefined ? {} : { cover }) });
    // 책 JSON 이 같아도 표지 파일이 다르거나(같은 확장자·크기의 새 이미지) 옛 표지가 남아 있으면 내보낸다.
    if (plan.kind === 'noop' && record.visible !== false && current !== null) {
      const desiredCover =
        cover === undefined
          ? undefined
          : `${BLOG_LAYOUT.bookCoversDir}/${id}${path.extname(cover.workspacePath).toLowerCase()}`;
      const desiredHash =
        coverBytes === undefined ? null : createHash('sha256').update(coverBytes).digest('hex');
      const coverChanged =
        desiredCover !== undefined &&
        coverStates.find((state) => state.relativePath === desiredCover)?.contentHash !==
          desiredHash;
      const staleCover = coverStates.some(
        (state) => state.exists && state.relativePath !== desiredCover,
      );
      if (coverChanged || staleCover)
        plan = {
          kind: 'write',
          path: targetPath,
          content: current,
          ...(desiredCover === undefined || cover === undefined
            ? {}
            : { cover: { from: cover.workspacePath, to: desiredCover } }),
        };
    }
    let diff =
      plan.kind === 'noop'
        ? ''
        : plan.kind === 'delete'
          ? unifiedDeleteDiff(targetPath, current ?? '')
          : unifiedDiff(targetPath, current, plan.content);
    if (plan.kind === 'write' && plan.cover) diff += `표지 추가/교체: ${plan.cover.to}\n`;
    if (
      plan.kind !== 'noop' &&
      coverStates.some(
        (state) =>
          state.exists && (plan.kind === 'delete' || state.relativePath !== plan.cover?.to),
      )
    )
      diff += '기존 표지 삭제\n';
    const branchKey =
      id
        .normalize('NFC')
        .replace(/[^\p{L}\p{N}_-]/gu, '')
        .slice(0, 64) || 'book';
    const review = {
      baseHead,
      branch: `content/book-${branchKey}`,
      targetPath,
      diff,
      kind: plan.kind,
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ id, plan, review, coverStates }))
      .update(coverBytes ?? Buffer.alloc(0))
      .digest('hex');
    return { review, plan, coverBytes, coverStates, fingerprint };
  }

  private async beginPublish(clone: EphemeralClone, branch: string): Promise<void> {
    this.assertAuthorConfigured();
    await this.assertRepositoryRoot(clone);
    const dirtyFiles = await this.cloneManager.git(clone, [
      'status',
      '--porcelain',
      '--untracked-files=all',
    ]);
    if (dirtyFiles !== '')
      throw new Error(`publishing requires a clean public blog worktree: ${dirtyFiles}`);
    if ((await this.cloneManager.git(clone, ['branch', '--list', branch])) !== '')
      throw new Error(`publish branch already exists: ${branch}`);
    await this.cloneManager.git(clone, ['switch', '-c', branch]);
  }

  private assertAuthorConfigured(): void {
    if (this.options.author.name.trim() === '' || this.options.author.email.trim() === '') {
      throw new Error('publishing requires explicit author identity');
    }
  }

  private async prepare(input: PublishDraftInput): Promise<PreparedPublish> {
    const inspected = await this.inspectAssets(input.documentId);
    const byId = new Map(inspected.map((asset) => [asset.id, asset]));
    const selected = input.assetIds.map((id) => byId.get(id));
    if (
      new Set(input.assetIds).size !== input.assetIds.length ||
      selected.some((asset) => !asset)
    ) {
      throw new Error('invalid or unavailable public asset id');
    }
    const assets = selected.filter((asset): asset is InspectedPublicAsset => asset !== undefined);
    const books = new Map<string, BookDocument>();
    for (const match of input.source.matchAll(/\{%\s*bookquote\s+book="([^"\r\n]+)"/gu)) {
      const id = match[1];
      if (!id || !isBookId(id) || books.has(id)) continue;
      const relativePath = `books/${id}.md`;
      await assertNoSymlinkAncestors(this.options.privateRoot, relativePath);
      try {
        const bookFile = await resolveWorkspacePath(this.options.privateRoot, relativePath);
        await assertRegularFile(bookFile);
        books.set(id, parseDocument(await readFile(bookFile, 'utf8')));
      } catch (error) {
        if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
      }
    }
    const transformInput: TransformPublicDraftInput = {
      lookupBook: (id) => books.get(id),
      source: input.source,
      assets: assets.map(({ reference, privatePath }) => ({
        draftReference: reference,
        privatePath,
        publicPath: `assets/posts/${draftSlug(input.source)}/${reference}`,
      })),
      privateRoot: this.options.privateRoot,
    };
    return { transformed: transformPublicDraft(transformInput), assets };
  }

  private async createReview(
    prepared: PreparedPublish,
    clone: EphemeralClone,
  ): Promise<ReviewState> {
    const targetPath = `${POSTS_DIRECTORY}/${prepared.transformed.metadata.slug}.mdoc`;
    const [existing, baseHead, destinationStates] = await Promise.all([
      this.readOutput(clone.repositoryRoot, targetPath),
      this.cloneManager.git(clone, ['rev-parse', 'HEAD']),
      Promise.all(
        prepared.transformed.assets.map(({ publicPath }) =>
          this.readPublicAssetState(clone.repositoryRoot, `${BLOG_LAYOUT.publicDir}/${publicPath}`),
        ),
      ),
    ]);
    const diff = unifiedDiff(targetPath, existing, prepared.transformed.source);
    return {
      review: {
        baseHead,
        branch: `content/${prepared.transformed.metadata.slug}`,
        targetPath,
        metadata: prepared.transformed.metadata,
        assets: prepared.transformed.assets.map(
          ({ publicPath }) => `${BLOG_LAYOUT.publicDir}/${publicPath}`,
        ),
        diff,
        quotes: prepared.transformed.quotes,
        warnings: quoteWarnings(prepared.transformed.quotes),
      },
      destinationStates,
    };
  }

  private async inspectAssets(documentId: string): Promise<readonly InspectedPublicAsset[]> {
    if (!/^[A-Za-z0-9_-]{43}$/u.test(documentId))
      throw new Error('invalid document id for public assets');
    const relativeRoot = `assets/public/${documentId}`;
    await assertNoSymlinkAncestors(this.options.privateRoot, relativeRoot);
    const assetRoot = path.join(this.options.privateRoot, relativeRoot);
    let canonicalAssetRoot: string;
    try {
      canonicalAssetRoot = await realpath(assetRoot);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return [];
      throw error;
    }
    const canonicalPrivateRoot = await realpath(this.options.privateRoot);
    assertDescendant(canonicalAssetRoot, canonicalPrivateRoot, 'public asset root');
    const assets: InspectedPublicAsset[] = [];
    await this.scanAssetDirectory(assetRoot, '', canonicalAssetRoot, assets, documentId);
    return assets.sort((left, right) => left.reference.localeCompare(right.reference));
  }

  private async scanAssetDirectory(
    directory: string,
    relativeDirectory: string,
    canonicalRoot: string,
    assets: InspectedPublicAsset[],
    documentId: string,
  ): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const reference = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const candidate = path.join(directory, entry.name);
      if (entry.isSymbolicLink())
        throw new Error(`public asset must not be a symbolic link: ${reference}`);
      if (entry.isDirectory()) {
        await this.scanAssetDirectory(candidate, reference, canonicalRoot, assets, documentId);
        continue;
      }
      const candidateStat = await lstat(candidate);
      if (!entry.isFile() || !candidateStat.isFile())
        throw new Error(`public asset must be a regular file: ${reference}`);
      const canonical = await realpath(candidate);
      assertDescendant(canonical, canonicalRoot, 'public asset');
      const bytes = await readFile(canonical);
      assets.push({
        id: assetId(documentId, reference),
        reference,
        size: bytes.byteLength,
        privatePath: candidate,
        contentHash: createHash('sha256').update(bytes).digest('hex'),
        bytes,
      });
    }
  }

  private async assertRepositoryRoot(clone: EphemeralClone): Promise<void> {
    const [configuredRoot, repositoryRoot] = await Promise.all([
      realpath(clone.repositoryRoot),
      this.cloneManager
        .git(clone, ['rev-parse', '--show-toplevel'])
        .then((value) => realpath(value)),
    ]);
    if (configuredRoot !== repositoryRoot)
      throw new Error('ephemeral public blog root must be the Git worktree root');
  }

  private async readPublicAssetState(
    root: string,
    relativePath: string,
  ): Promise<PublicAssetDestinationState> {
    await assertNoSymlinkAncestors(root, relativePath);
    try {
      const target = path.join(root, relativePath);
      const targetStat = await lstat(target);
      if (!targetStat.isFile() || targetStat.isSymbolicLink())
        throw new Error(`public asset destination must be a regular file: ${relativePath}`);
      return {
        relativePath,
        exists: true,
        contentHash: createHash('sha256')
          .update(await readFile(target))
          .digest('hex'),
      };
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT')
        return { relativePath, exists: false, contentHash: null };
      throw error;
    }
  }

  private async readOutput(root: string, relativePath: string): Promise<string | null> {
    await assertNoSymlinkAncestors(root, relativePath);
    try {
      const target = path.join(root, relativePath);
      const targetStat = await lstat(target);
      if (!targetStat.isFile() || targetStat.isSymbolicLink())
        throw new Error(`public output must be a regular file: ${relativePath}`);
      return await readFile(target, 'utf8');
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return null;
      throw error;
    }
  }

  private async writeOutput(root: string, relativePath: string, source: string): Promise<void> {
    await assertNoSymlinkAncestors(root, relativePath);
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await assertNoSymlinkAncestors(root, relativePath);
    await writeFile(target, source, { encoding: 'utf8', mode: 0o644 });
  }

  private async writeApprovedAsset(
    root: string,
    bytes: Buffer,
    relativePath: string,
  ): Promise<void> {
    await assertNoSymlinkAncestors(root, relativePath);
    const target = path.join(root, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await assertNoSymlinkAncestors(root, relativePath);
    await writeFile(target, bytes, { mode: 0o644 });
  }
}

interface InspectedPublicAsset extends PublicAssetCandidate {
  readonly privatePath: string;
  readonly contentHash: string;
  readonly bytes: Buffer;
}
interface PreparedPublish {
  readonly transformed: TransformedPublicPost;
  readonly assets: readonly InspectedPublicAsset[];
}
interface PublicAssetDestinationState {
  readonly relativePath: string;
  readonly exists: boolean;
  readonly contentHash: string | null;
}
interface ReviewState {
  readonly review: Omit<PublishReview, 'reviewId'>;
  readonly destinationStates: readonly PublicAssetDestinationState[];
}

function fingerprint(prepared: PreparedPublish, state: ReviewState): string {
  const { review } = state;
  return createHash('sha256')
    .update(prepared.transformed.source)
    .update('\0')
    .update(JSON.stringify(prepared.transformed.assets))
    .update('\0')
    .update(
      JSON.stringify(
        prepared.assets.map(({ id, reference, size, contentHash }) => ({
          id,
          reference,
          size,
          contentHash,
        })),
      ),
    )
    .update('\0')
    .update(review.diff)
    .update('\0')
    .update(review.baseHead)
    .update('\0')
    .update(JSON.stringify(state.destinationStates))
    .digest('hex');
}

function assetId(documentId: string, reference: string): string {
  return createHash('sha256').update(documentId).update('\0').update(reference).digest('base64url');
}
function draftSlug(source: string): string {
  const slug = parseDocument(source).slug;
  if (!slug) throw new Error('public draft requires slug before selecting assets');
  return slug;
}

function assertDescendant(candidate: string, root: string, label: string): void {
  const relative = path.relative(root, candidate);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(`${label} is outside its configured root`);
}

function unifiedDiff(targetPath: string, before: string | null, after: string): string {
  const beforeLines = lines(before ?? '');
  const afterLines = lines(after);
  const oldRange = before === null ? '-0,0' : `-1,${beforeLines.length}`;
  return [
    `--- ${before === null ? '/dev/null' : `a/${targetPath}`}`,
    `+++ b/${targetPath}`,
    `@@ ${oldRange} +1,${afterLines.length} @@`,
    ...beforeLines.map((line) => `-${line}`),
    ...afterLines.map((line) => `+${line}`),
    '',
  ].join('\n');
}

function unifiedDeleteDiff(targetPath: string, before: string): string {
  const beforeLines = lines(before);
  return [
    `--- a/${targetPath}`,
    '+++ /dev/null',
    `@@ -1,${beforeLines.length} +0,0 @@`,
    ...beforeLines.map((line) => `-${line}`),
    '',
  ].join('\n');
}

function lines(source: string): readonly string[] {
  if (source === '') return [];
  return source.endsWith('\n') ? source.slice(0, -1).split('\n') : source.split('\n');
}

async function assertNoSymlinkAncestors(root: string, relativePath: string): Promise<void> {
  if (path.isAbsolute(relativePath) || relativePath.split('/').some((part) => part === '..'))
    throw new Error(`public output escapes repository: ${relativePath}`);
  let current = path.resolve(root);
  for (const segment of relativePath.split('/')) {
    current = path.join(current, segment);
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error(`public output traverses a symbolic link: ${relativePath}`);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') return;
      throw error;
    }
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

async function assertRegularFile(file: string) {
  const info = await lstat(file);
  if (!info.isFile()) throw new Error('not a regular file');
  return info;
}
