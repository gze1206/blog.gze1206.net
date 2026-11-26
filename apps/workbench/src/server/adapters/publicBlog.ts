import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { BLOG_LAYOUT, SITE_COLLECTIONS, isBookId } from '@gze1206/content-contract';

import { parseDocument, type BookDocument } from '../../core/document/document.js';
import { parseFrontmatter } from '../../core/document/frontmatter.js';
import { planBookExport, type BookExportPlan } from '../../core/books/publicBook.js';
import { findImageMetadata, readImageSize } from '../../core/books/imageSize.js';
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
import { unifiedDiff } from '../../core/publishing/diff.js';
import { publishRefKey } from '../../core/publishing/refKey.js';
import { preservePublishedFormat } from '../../core/publishing/preserve.js';
import { parseAssetReferences } from '../../core/publishing/references.js';
import { PublicDraftValidationError, isSafeSitePath } from '../../core/publishing/validate.js';
import {
  SITE_COLLECTION_NAMES,
  planSiteChange,
  sitePath,
  unknownKeyIssues,
  validateSiteChange,
  type SiteChange,
  type SiteEntry,
  type SitePlan,
} from '../../core/site/siteContent.js';

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
  readonly warnings: readonly string[];
}
export interface BookConfirm {
  readonly confirmPublish: boolean;
  readonly reviewId: string;
}

export interface SiteReview {
  readonly warnings?: readonly string[];
  readonly reviewId: string;
  readonly baseHead: string;
  readonly branch: string;
  readonly targetPath: string;
  readonly diff: string;
  readonly kind: SitePlan['kind'];
}

/** 사이트 콘텐츠 검토를 거절하는 이유. 라우트가 400(입력)·409(main 이 바뀜)으로 돌려준다. */
export class SiteReviewError extends Error {
  public constructor(
    message: string,
    public readonly status: 400 | 409,
    public readonly issues: readonly { readonly path: string; readonly message: string }[] = [],
  ) {
    super(message);
  }
}

/** 올린 포트폴리오 이미지 (NOR-219). `src` 는 블로그에서 쓸 사이트 경로다. */
export interface SiteImage {
  readonly src: string;
  readonly width: number;
  readonly height: number;
}

/** 포트폴리오 이미지를 두는 자리(작업 공간)와 블로그 주소. */
const SITE_IMAGE_DIRECTORY = 'assets/site/portfolio';
const SITE_IMAGE_PREFIX = '/img/portfolio/';
const SITE_IMAGE_NAME = /^[a-z0-9][a-z0-9-]*\.(?:png|jpg|webp)$/u;
const SITE_IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};
const MAX_SITE_IMAGE_BYTES = 5 * 1024 * 1024;

export interface SiteListing {
  readonly commit: string;
  readonly entries: readonly (SiteEntry & { readonly hash: string })[];
  readonly problems: readonly { readonly path: string; readonly message: string }[];
}

/** `draft` 는 `draft: true` 인 글이 블로그와 같거나 블로그에 없을 때다(NOR-227). 블로그에 보이지 않는다. */
export type PublishState = 'published' | 'differs' | 'unpublished' | 'invalid' | 'draft';

export interface PublishStatusReport {
  readonly documents: readonly {
    readonly documentId: string;
    readonly slug: string | null;
    readonly status: PublishState;
  }[];
  readonly blogOnly: readonly {
    readonly slug: string;
    readonly title: string;
    readonly repoPath: string;
  }[];
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
  publishStatus?(
    drafts: readonly { readonly documentId: string; readonly source: string }[],
  ): Promise<PublishStatusReport>;
  listSite?(): Promise<SiteListing>;
  saveSiteImage?(bytes: Uint8Array, originalName: string): Promise<SiteImage>;
  savePublicAsset?(
    documentId: string,
    bytes: Uint8Array,
    originalName: string,
  ): Promise<{ readonly id: string; readonly reference: string; readonly size: number }>;
  readSiteImage?(
    name: string,
  ): Promise<{ readonly bytes: Buffer; readonly contentType: string } | null>;
  reviewSite?(change: SiteChange): Promise<SiteReview>;
  publishSite?(change: SiteChange, confirm: BookConfirm): Promise<PublishResult>;
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

/** 글이 놓일 자리와 브랜치. 영어 글은 `posts/en/<slug>.mdoc`·`content/en-<slug>` 다(NOR-252). */
function postTarget(metadata: { readonly slug: string; readonly lang?: string | undefined }) {
  const english = metadata.lang === 'en';
  return {
    path: `${POSTS_DIRECTORY}/${english ? 'en/' : ''}${metadata.slug}.mdoc`,
    branch: `content/${english ? 'en-' : ''}${metadata.slug}`,
  };
}

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
  private readonly sitePublishing = new Set<string>();
  private readonly statusInFlight = new Map<string, Promise<PublishStatusReport>>();

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

  /**
   * 공개 초안마다 블로그와 비교한 발행 상태 (NOR-209 AC-3).
   *
   * 새로 받은 main 하나에서, 지금 발행하면 나올 파일(표기 보존까지 거친 것)을 블로그의 파일과 견준다.
   * 발행 검사를 통과하지 못하는 초안은 `invalid` 다. 어느 초안과도 slug 가 맞지 않는 블로그 글은 따로 돌려준다.
   */
  public async publishStatus(
    drafts: readonly { readonly documentId: string; readonly source: string }[],
  ): Promise<PublishStatusReport> {
    // 상태 조회는 clone 과 변환을 모두 한다. 같은 입력으로 동시에 오면 진행 중인 것을 함께 기다린다.
    const key = createHash('sha256').update(JSON.stringify(drafts)).digest('hex');
    const running = this.statusInFlight.get(key);
    if (running) return running;
    const task = this.computePublishStatus(drafts).finally(() => this.statusInFlight.delete(key));
    this.statusInFlight.set(key, task);
    return task;
  }

  private async computePublishStatus(
    drafts: readonly { readonly documentId: string; readonly source: string }[],
  ): Promise<PublishStatusReport> {
    const clone = await this.cloneManager.create();
    try {
      const documents: PublishStatusReport['documents'][number][] = [];
      const slugs = new Set<string>();
      for (const draft of drafts) {
        let slug: string | null = null;
        let hidden = false;
        let english = false;
        try {
          const parsed = parseDocument(draft.source);
          slug = parsed.slug ?? null;
          hidden = parsed.draft === true;
          english = parsed.lang === 'en';
        } catch {
          slug = null;
        }
        // 블로그에만 있는 글은 한국어 글(posts 바로 아래)과 견준다. 영어 초안은 같은 slug 라도 짝이 아니다.
        if (slug && !english) slugs.add(slug);
        let status: PublishState;
        try {
          const inspected = await this.inspectAssets(draft.documentId);
          const prepared = await this.prepare(
            {
              documentId: draft.documentId,
              source: draft.source,
              assetIds: inspected.map((asset) => asset.id),
            },
            await this.existingPublicAssets(clone.repositoryRoot, draft.source),
          );
          const targetPath = postTarget(prepared.transformed.metadata).path;
          const current = await this.readOutput(clone.repositoryRoot, targetPath);
          status =
            current === null
              ? 'unpublished'
              : preservePublishedFormat(current, prepared.transformed.source) === current
                ? 'published'
                : 'differs';
        } catch {
          status = 'invalid';
        }
        // draft 글은 블로그와 같아도 공개된 것이 아니다. 다르면 다시 발행할 거리가 있으므로 그대로 둔다.
        if (hidden && (status === 'published' || status === 'unpublished')) status = 'draft';
        documents.push({ documentId: draft.documentId, slug, status });
      }
      const postsDirectory = path.join(clone.repositoryRoot, POSTS_DIRECTORY);
      const blogOnly: { slug: string; title: string; repoPath: string }[] = [];
      for (const entry of await readdir(postsDirectory, { withFileTypes: true }).catch(() => [])) {
        if (!entry.isFile() || !/\.(?:md|mdoc)$/u.test(entry.name)) continue;
        const repoPath = `${POSTS_DIRECTORY}/${entry.name}`;
        const post = describePost(
          repoPath,
          entry.name,
          await readFile(path.join(postsDirectory, entry.name), 'utf8'),
        );
        // draft 글(스모크 테스트·픽스처)은 공개되지 않으므로 알리지 않는다.
        if (!post.draft && !slugs.has(post.slug))
          blogOnly.push({ slug: post.slug, title: post.title, repoPath });
      }
      blogOnly.sort((left, right) => left.slug.localeCompare(right.slug));
      return { documents, blogOnly };
    } finally {
      await this.cloneManager.remove(clone.sessionDir);
    }
  }

  public async review(input: PublishDraftInput): Promise<PublishReview> {
    const clone = await this.cloneManager.create();
    try {
      const prepared = await this.prepare(
        input,
        await this.existingPublicAssets(clone.repositoryRoot, input.source),
      );
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
      const prepared = await this.prepare(
        input,
        await this.existingPublicAssets(clone.repositoryRoot, input.source),
      );
      const reviewState = await this.createReview(prepared, clone);
      const { review } = reviewState;
      const contentFingerprint = fingerprint(prepared, reviewState);
      await this.sessions.get(input.reviewId, contentFingerprint, review.baseHead);
      await this.beginPublish(clone, review.branch);
      await this.writeOutput(clone.repositoryRoot, review.targetPath, reviewState.source);
      for (const asset of prepared.assets) {
        await this.writeApprovedAsset(
          clone.repositoryRoot,
          asset.bytes,
          `${BLOG_LAYOUT.publicDir}/assets/posts/${prepared.transformed.metadata.slug}/${asset.reference}`,
        );
      }
      await this.cloneManager.git(clone, ['add', '--', review.targetPath, ...review.assets]);
      const { slug: postSlug, lang: postLang } = prepared.transformed.metadata;
      const commitMessage = `✨ feat(content): ${postLang === 'en' ? 'en/' : ''}${postSlug} 게시`;
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
        source: reviewState.source,
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

  /**
   * 사이트 콘텐츠(프로필·경력·포트폴리오·시리즈)를 새로 받은 main 에서 읽는다 (NOR-208).
   * 읽기만 하고 clone 은 바로 지운다. 읽지 못한 파일은 빼지 않고 문제로 돌려준다.
   */
  public async listSite(): Promise<SiteListing> {
    const clone = await this.cloneManager.create();
    try {
      const commit = await this.cloneManager.git(clone, ['rev-parse', 'HEAD']);
      const entries: (SiteEntry & { hash: string })[] = [];
      const problems: { path: string; message: string }[] = [];
      for (const collection of SITE_COLLECTION_NAMES) {
        const target = SITE_COLLECTIONS[collection];
        const ids = target.single
          ? [collection]
          : (await readdir(path.join(clone.repositoryRoot, target.path)).catch(() => []))
              .filter((name) => name.endsWith('.json'))
              .map((name) => name.slice(0, -5))
              .sort();
        for (const id of ids) {
          let relativePath = `${target.path}/${id}.json`;
          try {
            relativePath = sitePath(collection, id);
            const source = await this.readOutput(clone.repositoryRoot, relativePath);
            if (source === null) continue;
            entries.push({
              collection,
              id,
              data: JSON.parse(source) as unknown,
              hash: sha256(source),
            });
          } catch (error) {
            problems.push({ path: relativePath, message: (error as Error).message });
          }
        }
      }
      return { commit, entries, problems };
    } finally {
      await this.cloneManager.remove(clone.sessionDir);
    }
  }

  public async reviewSite(change: SiteChange): Promise<SiteReview> {
    const clone = await this.cloneManager.create();
    try {
      const state = await this.createSiteReview(change, clone);
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

  public async publishSite(change: SiteChange, confirm: BookConfirm): Promise<PublishResult> {
    if (confirm.confirmPublish !== true)
      throw new Error('publishing requires confirmPublish: true');
    // 같은 검토를 동시에 두 번 확정하면, 실패한 쪽이 세션을 지우며 진행 중인 clone 까지 지운다.
    if (this.sitePublishing.has(confirm.reviewId))
      throw new SiteReviewError('site publish is already in progress', 409);
    this.sitePublishing.add(confirm.reviewId);
    try {
      return await this.publishSiteOnce(change, confirm);
    } finally {
      this.sitePublishing.delete(confirm.reviewId);
    }
  }

  private async publishSiteOnce(change: SiteChange, confirm: BookConfirm): Promise<PublishResult> {
    const session = await this.sessions.lookup(confirm.reviewId);
    const clone = {
      sessionDir: session.cloneDir,
      repositoryRoot: path.join(session.cloneDir, 'repository'),
    };
    try {
      const {
        review,
        plan,
        fingerprint: contentFingerprint,
        assets,
        removePath,
      } = await this.createSiteReview(change, clone);
      // 검토한 입력·base 와 다르면 여기서 멈춘다.
      await this.sessions.get(confirm.reviewId, contentFingerprint, review.baseHead);
      if (plan.kind === 'noop') throw new Error('site content has no changes');
      await this.beginPublish(clone, review.branch);
      if (plan.kind === 'delete') {
        await assertNoSymlinkAncestors(clone.repositoryRoot, plan.path);
        await rm(path.join(clone.repositoryRoot, plan.path));
      } else {
        await this.writeOutput(clone.repositoryRoot, plan.path, plan.content);
        await chmod(path.join(clone.repositoryRoot, plan.path), 0o644);
      }
      if (removePath !== null) {
        await assertNoSymlinkAncestors(clone.repositoryRoot, removePath);
        await rm(path.join(clone.repositoryRoot, removePath));
      }
      for (const asset of assets) {
        await this.writeApprovedAsset(clone.repositoryRoot, asset.bytes, asset.relativePath);
        await chmod(path.join(clone.repositoryRoot, asset.relativePath), 0o644);
      }
      await this.cloneManager.git(clone, [
        'add',
        '-A',
        '--',
        plan.path,
        ...(removePath === null ? [] : [removePath]),
        ...assets.map((asset) => asset.relativePath),
      ]);
      const message =
        plan.kind === 'delete'
          ? `📝 docs(content): ${change.collection} ${change.id} 를 지운다`
          : `📝 docs(content): ${change.collection} ${change.id} 를 고친다`;
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
        assets: assets.map((asset) => ({ reference: asset.relativePath, bytes: asset.bytes })),
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
      await this.sessions.consume(confirm.reviewId, contentFingerprint, review.baseHead);
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

  /**
   * 포트폴리오 이미지를 작업 공간에 둔다 (NOR-219 AC-2). 형식은 내용으로 판별하고, 이름에 내용 해시를
   * 붙여 같은 이미지는 같은 이름이 되게 한다. 블로그로는 발행할 때 함께 나간다.
   */
  public async saveSiteImage(bytes: Uint8Array, originalName: string): Promise<SiteImage> {
    const image = await optimizeImage(bytes, originalName, PORTFOLIO_IMAGE_WIDTH);
    const { name } = image;
    const relativePath = `${SITE_IMAGE_DIRECTORY}/${name}`;
    await assertNoSymlinkAncestors(this.options.privateRoot, relativePath);
    const target = await resolveWorkspacePath(this.options.privateRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await assertNoSymlinkAncestors(this.options.privateRoot, relativePath);
    await writeHashedFile(target, image.bytes);
    return { src: `${SITE_IMAGE_PREFIX}${name}`, width: image.width, height: image.height };
  }

  /**
   * 공개 초안 본문 이미지를 그 초안의 자산 자리에 둔다 (NOR-219 AC-6). 발행 자산은 파일 이름 하나로
   * 나가므로(`assets/posts/<slug>/<이름>`) 하위 디렉터리 없이 둔다.
   */
  public async savePublicAsset(
    documentId: string,
    bytes: Uint8Array,
    originalName: string,
  ): Promise<{ readonly id: string; readonly reference: string; readonly size: number }> {
    if (!/^[A-Za-z0-9_-]{43}$/u.test(documentId))
      throw new Error('invalid document id for public assets');
    const image = await optimizeImage(bytes, originalName, POST_IMAGE_WIDTH);
    const { name } = image;
    const relativePath = `assets/public/${documentId}/${name}`;
    await assertNoSymlinkAncestors(this.options.privateRoot, relativePath);
    const target = await resolveWorkspacePath(this.options.privateRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await assertNoSymlinkAncestors(this.options.privateRoot, relativePath);
    await writeHashedFile(target, image.bytes);
    return { id: assetId(documentId, name), reference: name, size: image.bytes.length };
  }

  /** 올려 둔 포트폴리오 이미지를 읽는다(미리보기). 이 디렉터리의 파일 하나만 내준다. */
  public async readSiteImage(
    name: string,
  ): Promise<{ readonly bytes: Buffer; readonly contentType: string } | null> {
    if (!SITE_IMAGE_NAME.test(name)) return null;
    const relativePath = `${SITE_IMAGE_DIRECTORY}/${name}`;
    try {
      await assertNoSymlinkAncestors(this.options.privateRoot, relativePath);
      const target = await resolveWorkspacePath(this.options.privateRoot, relativePath);
      await assertRegularFile(target);
      return {
        bytes: await readFile(target),
        contentType: SITE_IMAGE_TYPES[name.split('.').pop() ?? ''] ?? 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  /**
   * 포트폴리오가 참조하는 이미지를 확인한다 (NOR-219 AC-3). 작업 공간에 올린 이미지는 블로그에 없거나
   * 다르면 함께 내보낼 목록에 넣는다. 작업 공간에도 블로그 public/ 에도 없는 경로는 문제로 돌려준다.
   */
  private async siteImages(
    change: SiteChange,
    repositoryRoot: string,
  ): Promise<{
    assets: { relativePath: string; bytes: Buffer; width: number; height: number }[];
    issues: { path: string; message: string }[];
    warnings: string[];
  }> {
    const assets: { relativePath: string; bytes: Buffer; width: number; height: number }[] = [];
    const issues: { path: string; message: string }[] = [];
    const warnings: string[] = [];
    if (change.collection !== 'portfolio' || 'delete' in change)
      return { assets, issues, warnings };
    const references: { field: string; src: string }[] = [];
    const media = change.data['media'];
    if (Array.isArray(media))
      media.forEach((item: unknown, index) => {
        const src = (item as Record<string, unknown> | null)?.['src'];
        if (typeof src === 'string') references.push({ field: `media.${index}.src`, src });
      });
    const thumbnail = change.data['thumbnail'];
    if (typeof thumbnail === 'string') references.push({ field: 'thumbnail', src: thumbnail });
    const seen = new Set<string>();
    for (const { field, src } of references) {
      const blogPath = `${BLOG_LAYOUT.publicDir}${src}`;
      const name = src.startsWith(SITE_IMAGE_PREFIX) ? src.slice(SITE_IMAGE_PREFIX.length) : null;
      const staged = name === null ? null : await this.readSiteImage(name);
      if (staged) {
        if (seen.has(src)) continue;
        seen.add(src);
        const blog = await this.readPublicAssetState(repositoryRoot, blogPath);
        const hash = createHash('sha256').update(staged.bytes).digest('hex');
        if (!blog.exists || blog.contentHash !== hash) {
          const size = readImageSize(staged.bytes);
          assets.push({
            relativePath: blogPath,
            bytes: staged.bytes,
            width: size?.width ?? 0,
            height: size?.height ?? 0,
          });
          const metadata = findImageMetadata(staged.bytes);
          if (metadata.length > 0)
            warnings.push(`${src} 에 메타데이터(EXIF 등)가 있습니다: ${metadata.join(', ')}`);
        }
        continue;
      }
      const exists =
        isSafeSitePath(src) && (await this.readPublicAssetState(repositoryRoot, blogPath)).exists;
      if (!exists) issues.push({ path: field, message: `이미지를 찾지 못했습니다: ${src}` });
    }
    return { assets, issues, warnings };
  }

  /** main 사본의 글 frontmatter. 읽지 못한 글은 건너뛴다. 그런 글은 블로그 빌드가 따로 잡는다. */
  private async mainPosts(
    repositoryRoot: string,
  ): Promise<{ readonly path: string; readonly data: Record<string, unknown> }[]> {
    let names: string[];
    try {
      names = await readdir(path.join(repositoryRoot, BLOG_LAYOUT.postsDir));
    } catch {
      return [];
    }
    const posts: { path: string; data: Record<string, unknown> }[] = [];
    for (const name of names.filter((entry) => /\.(?:md|mdoc)$/u.test(entry)).sort()) {
      const relativePath = `${BLOG_LAYOUT.postsDir}/${name}`;
      const source = await this.readOutput(repositoryRoot, relativePath);
      if (source === null) continue;
      try {
        posts.push({ path: relativePath, data: parseFrontmatter(source).data });
      } catch {
        // frontmatter 가 깨진 글은 건너뛴다.
      }
    }
    return posts;
  }

  /** main 사본에서 시리즈 `seriesId` 를 가리키는 글의 저장소 상대 경로(NOR-235). */
  private async postsInSeries(repositoryRoot: string, seriesId: string): Promise<string[]> {
    return (await this.mainPosts(repositoryRoot))
      .filter((post) => post.data['series'] === seriesId)
      .map((post) => post.path);
  }

  /**
   * 글의 참조와 분류를 main 과 견준다(NOR-237). 없는 시리즈는 빌드를 멈추므로 거절하고,
   * 새 카테고리·태그는 오타일 수 있으므로 경고한다. main 에 공개 글이 없으면 견주지 않는다.
   */
  private async checkPostAgainstMain(
    repositoryRoot: string,
    metadata: PublicPost,
  ): Promise<string[]> {
    if (
      metadata.series !== undefined &&
      (await this.readOutput(repositoryRoot, sitePath('series', metadata.series))) === null
    )
      throw new PublicDraftValidationError(
        `post series '${metadata.series}' does not exist on main`,
      );
    const published = (await this.mainPosts(repositoryRoot)).filter(
      (post) => post.data['draft'] !== true && post.data['slug'] !== metadata.slug,
    );
    if (published.length === 0) return [];
    const categories = new Set(published.map((post) => post.data['category']));
    const tags = new Set(
      published.flatMap((post) => {
        const value = post.data['tags'];
        return Array.isArray(value) ? value.filter((tag) => typeof tag === 'string') : [];
      }),
    );
    const warnings: string[] = [];
    if (!categories.has(metadata.category))
      warnings.push(`새 카테고리 '${metadata.category}' 를 만듭니다. 오타가 아닌지 확인하세요.`);
    for (const tag of metadata.tags) {
      if (tags.has(tag)) continue;
      const similar = [...tags].find((known) => known.toLowerCase() === tag.toLowerCase());
      warnings.push(
        similar === undefined
          ? `새 태그 '${tag}' 를 만듭니다. 오타가 아닌지 확인하세요.`
          : `태그 '${tag}' 는 기존 태그 '${similar}' 와 대소문자만 다릅니다.`,
      );
    }
    return warnings;
  }

  /** 책의 관련 글은 main 의 공개 글이어야 한다(NOR-237). 아니면 공개 페이지에 깨진 링크가 생긴다. */
  private async assertRelatedPost(repositoryRoot: string, slug: string): Promise<void> {
    const post = (await this.mainPosts(repositoryRoot)).find(
      (entry) => entry.data['slug'] === slug,
    );
    if (post === undefined) throw new Error(`relatedPost '${slug}' does not exist on main`);
    if (post.data['draft'] === true) throw new Error(`relatedPost '${slug}' is a draft on main`);
  }

  private async createSiteReview(requested: SiteChange, clone: EphemeralClone) {
    const issues = validateSiteChange(requested);
    if (issues.length > 0) throw new SiteReviewError('invalid site content', 400, issues);
    const targetPath = sitePath(requested.collection, requested.id);
    // 이름을 바꾸면(NOR-220) 옛 파일이 원본이다. 기준 해시도 옛 파일과 견준다.
    const sourcePath =
      requested.renameFrom === undefined
        ? targetPath
        : sitePath(requested.collection, requested.renameFrom);
    const [current, baseHead] = await Promise.all([
      this.readOutput(clone.repositoryRoot, sourcePath),
      this.cloneManager.git(clone, ['rev-parse', 'HEAD']),
    ]);
    // 편집을 시작한 뒤 main 이 바뀌었으면 그 변경을 되돌리는 diff 가 되므로 거절한다(새 항목은 파일이 없어야 한다).
    if (
      requested.baseHash !== undefined &&
      (current === null ? null : sha256(current)) !== requested.baseHash
    )
      throw new SiteReviewError('site content changed on main; reload and edit again', 409);
    let change = requested;
    let removePath: string | null = null;
    if (requested.renameFrom !== undefined && !('delete' in requested)) {
      if (current === null)
        throw new SiteReviewError('site content to rename was not found on main', 409);
      if ((await this.readOutput(clone.repositoryRoot, targetPath)) !== null)
        throw new SiteReviewError(`site content already exists: ${requested.id}`, 409);
      removePath = sourcePath;
      // JSON 안의 id 가 옛 이름이면 새 이름으로 맞춘다.
      if (requested.data['id'] === requested.renameFrom)
        change = { ...requested, data: { ...requested.data, id: requested.id } };
    }
    if (!('delete' in change)) {
      const unknown = unknownKeyIssues(change.collection, change.data, current);
      if (unknown.length > 0) throw new SiteReviewError('invalid site content', 400, unknown);
    } else if (change.collection === 'series' && current !== null) {
      // 블로그 빌드는 없는 시리즈를 가리키는 글(draft 포함)이 있으면 멈춘다(NOR-235).
      const users = await this.postsInSeries(clone.repositoryRoot, change.id);
      if (users.length > 0)
        throw new SiteReviewError(
          'series is still used by posts',
          400,
          users.map((postPath) => ({
            path: postPath,
            message: `이 글이 아직 시리즈 '${change.id}' 를 가리킵니다. 글에서 시리즈를 먼저 빼 주세요.`,
          })),
        );
    }
    const images = await this.siteImages(change, clone.repositoryRoot);
    if (images.issues.length > 0)
      throw new SiteReviewError('invalid site content', 400, images.issues);
    let plan = planSiteChange(change, removePath === null ? current : null);
    // JSON 이 같아도 이미지가 새로 들어가면 내보낸다.
    if (plan.kind === 'noop' && images.assets.length > 0 && current !== null)
      plan = { kind: 'write', path: plan.path, content: current };
    let diff =
      removePath !== null && plan.kind === 'write'
        ? unifiedDiff(removePath, current, null) + unifiedDiff(targetPath, null, plan.content)
        : plan.kind === 'noop' || current === (plan.kind === 'write' ? plan.content : null)
          ? ''
          : unifiedDiff(targetPath, current, plan.kind === 'write' ? plan.content : null);
    for (const asset of images.assets)
      diff += `이미지 추가/교체: ${asset.relativePath} (${asset.width}×${asset.height}, ${Math.ceil(asset.bytes.length / 1024)} KB)\n`;
    const review = {
      warnings: images.warnings,
      baseHead,
      branch: `content/site-${change.collection}-${publishRefKey(change.id)}`,
      targetPath,
      diff,
      kind: plan.kind,
    };
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ change, plan, review, removePath }))
      .update(
        images.assets
          .map((asset) => createHash('sha256').update(asset.bytes).digest('hex'))
          .join(','),
      )
      .digest('hex');
    return { review, plan, fingerprint, assets: images.assets, removePath };
  }

  private async createBookReview(id: string, clone: EphemeralClone) {
    if (!isBookId(id)) throw new Error('invalid book id');
    const documentPath = `books/${id}.md`;
    await assertNoSymlinkAncestors(this.options.privateRoot, documentPath);
    const documentFile = await resolveWorkspacePath(this.options.privateRoot, documentPath);
    await assertRegularFile(documentFile);
    const record = parseDocument(await readFile(documentFile, 'utf8'));
    // 책 id 는 파일 이름이다(NOR-212). 등록 뒤 ISBN·제목을 고쳐도 바뀌지 않는다.
    if (record.kind !== 'book') throw new Error('not a book document');
    if (record.visible !== false && record.relatedPost !== undefined)
      await this.assertRelatedPost(clone.repositoryRoot, record.relatedPost);
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
    let plan = planBookExport({ id, record, current, ...(cover === undefined ? {} : { cover }) });
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
          ? unifiedDiff(targetPath, current ?? '', null)
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
    // 브랜치 이름은 ASCII 로 만든다. 릴레이가 영문·숫자 이름만 받는다(NOR-214).
    const branchKey = publishRefKey(id);
    const metadata = coverBytes ? findImageMetadata(coverBytes) : [];
    const warnings = metadata.length
      ? [`표지에 메타데이터(EXIF 등)가 있습니다: ${metadata.join(', ')}`]
      : [];
    const review = {
      warnings,
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

  /**
   * 초안이 참조하는 사이트 경로 중 새로 받은 main 의 `public/` 에 일반 파일로 있는 것 (NOR-218).
   * 심볼릭 링크로 된 파일이나 상위 디렉터리는 받지 않는다.
   */
  private async existingPublicAssets(repositoryRoot: string, source: string): Promise<Set<string>> {
    const found = new Set<string>();
    let content: string;
    try {
      content = parseFrontmatter(source).content;
    } catch {
      return found;
    }
    for (const { reference } of parseAssetReferences(content)) {
      if (found.has(reference) || !isSafeSitePath(reference)) continue;
      const relativePath = `${BLOG_LAYOUT.publicDir}${reference}`;
      try {
        await assertNoSymlinkAncestors(repositoryRoot, relativePath);
        const fileStat = await lstat(path.join(repositoryRoot, relativePath));
        if (fileStat.isFile() && !fileStat.isSymbolicLink()) found.add(reference);
      } catch {
        // 없거나 읽을 수 없으면 허용하지 않는다. 검사가 거절한다.
      }
    }
    return found;
  }

  private async prepare(
    input: PublishDraftInput,
    existingPublicAssets: ReadonlySet<string> = new Set(),
  ): Promise<PreparedPublish> {
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
      existingPublicAssets,
    };
    return { transformed: transformPublicDraft(transformInput), assets };
  }

  private async createReview(
    prepared: PreparedPublish,
    clone: EphemeralClone,
  ): Promise<ReviewState> {
    const target = postTarget(prepared.transformed.metadata);
    const targetPath = target.path;
    const [existing, baseHead, destinationStates] = await Promise.all([
      this.readOutput(clone.repositoryRoot, targetPath),
      this.cloneManager.git(clone, ['rev-parse', 'HEAD']),
      Promise.all(
        prepared.transformed.assets.map(({ publicPath }) =>
          this.readPublicAssetState(clone.repositoryRoot, `${BLOG_LAYOUT.publicDir}/${publicPath}`),
        ),
      ),
    ]);
    const classificationWarnings = await this.checkPostAgainstMain(
      clone.repositoryRoot,
      prepared.transformed.metadata,
    );
    const source = preservePublishedFormat(existing, prepared.transformed.source);
    const diff = existing === source ? '' : unifiedDiff(targetPath, existing, source);
    return {
      source,
      review: {
        baseHead,
        branch: target.branch,
        targetPath,
        metadata: prepared.transformed.metadata,
        assets: prepared.transformed.assets.map(
          ({ publicPath }) => `${BLOG_LAYOUT.publicDir}/${publicPath}`,
        ),
        diff,
        quotes: prepared.transformed.quotes,
        warnings: [...quoteWarnings(prepared.transformed.quotes), ...classificationWarnings],
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
  /** 실제로 쓸 파일 내용. 블로그에 있는 글이면 원래 표기를 지킨 것이다(NOR-209 AC-2). */
  readonly source: string;
  readonly destinationStates: readonly PublicAssetDestinationState[];
}

function fingerprint(prepared: PreparedPublish, state: ReviewState): string {
  const { review } = state;
  return createHash('sha256')
    .update(state.source)
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

/** 포트폴리오 이미지·썸네일과 글 본문 이미지의 최대 가로 크기(NOR-222). */
const PORTFOLIO_IMAGE_WIDTH = 1200;
const POST_IMAGE_WIDTH = 1600;

/**
 * 올린 이미지를 블로그에 맞게 바꾼다 (NOR-219, NOR-222). 형식을 먼저 내용으로 거른 뒤 sharp 로 끝까지
 * 디코딩하고, EXIF 방향을 적용해 `maxWidth` 이하로 줄인 WebP 로 쓴다. 메타데이터는 남기지 않는다.
 * 이름은 원래 이름의 영문·숫자 조각에 결과 내용의 해시 16자를 붙인다.
 */
async function optimizeImage(
  bytes: Uint8Array,
  originalName: string,
  maxWidth: number,
): Promise<{ name: string; bytes: Buffer; width: number; height: number }> {
  const rejected = new SiteReviewError('JPEG·PNG·WebP 이미지만 5MB 까지 올릴 수 있습니다.', 400);
  const size =
    bytes.length > 0 && bytes.length <= MAX_SITE_IMAGE_BYTES ? readImageSize(bytes) : null;
  if (!size || !isCompleteImage(bytes, size.type)) throw rejected;
  let output: { data: Buffer; info: { width: number; height: number } };
  try {
    output = await sharp(bytes, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw rejected;
  }
  const base =
    path
      .parse(originalName)
      .name.normalize('NFC')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 40) || 'image';
  const hash = createHash('sha256').update(output.data).digest('hex').slice(0, 16);
  return {
    name: `${base}-${hash}.webp`,
    bytes: output.data,
    width: output.info.width,
    height: output.info.height,
  };
}

/** 형식의 끝까지 갖춘 파일인지 본다(PNG IEND·JPEG EOI·WebP RIFF 길이). 잘린 파일이 공개되지 않게 한다. */
function isCompleteImage(bytes: Uint8Array, type: 'jpeg' | 'png' | 'webp'): boolean {
  const length = bytes.length;
  if (type === 'png')
    return (
      length >= 12 &&
      Buffer.from(bytes.subarray(length - 8, length - 4)).toString('latin1') === 'IEND'
    );
  if (type === 'jpeg')
    return length >= 4 && bytes[length - 2] === 0xff && bytes[length - 1] === 0xd9;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return length >= 12 && view.getUint32(4, true) + 8 === length;
}

/**
 * 해시 이름의 파일을 쓴다. 같은 이름이 이미 있으면 내용이 같을 때만 그대로 두고, 다르면 거절한다
 * (드문 해시 충돌로 이미 쓰는 이미지가 바뀌지 않게).
 */
async function writeHashedFile(target: string, bytes: Uint8Array): Promise<void> {
  const existing = await readFile(target).catch((error: unknown) => {
    if (isNodeError(error) && error.code === 'ENOENT') return null;
    throw error;
  });
  if (existing !== null) {
    if (Buffer.compare(existing, Buffer.from(bytes)) === 0) return;
    throw new SiteReviewError('같은 이름의 다른 이미지가 이미 있습니다.', 409);
  }
  await writeFile(target, bytes, { mode: 0o644, flag: 'wx' });
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
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
