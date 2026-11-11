/**
 * 공개 블로그의 글을 작업 공간으로 가져오기 (NOR-187).
 *
 * 발행은 단방향이었다. 그래서 이미 올라간 글의 오타 하나를 고치려 해도 블로그 저장소를 직접
 * 열어야 했고, 그러면 워크벤치를 쓸 이유가 절반 사라진다.
 *
 * 이 모듈은 **판단만** 한다 — 파일을 읽지도 쓰지도 않는다. 무엇을 어디에 쓸지 정하는 일과
 * 실제로 쓰는 일을 갈라 두어야, 충돌 처리 규칙을 파일 시스템 없이 시험할 수 있다.
 */
import { parseFrontmatter, serializeFrontmatter } from '../document/frontmatter.js';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** 블로그 저장소에서 읽어 온 글 하나. */
export interface BlogPost {
  /** 저장소 기준 경로. 같은 글을 다시 가져올 때의 식별자다. */
  readonly repoPath: string;
  readonly slug: string;
  readonly title: string;
  readonly draft: boolean;
  readonly updatedAt: string;
  /** 파일 원문(프론트매터 포함). */
  readonly source: string;
}

/** 같은 slug 가 이미 작업 공간에 있을 때 사람이 고르는 것. */
export type ConflictResolution = 'rename' | 'overwrite' | 'skip' | 'cancel';

export interface ImportSelection {
  readonly repoPath: string;
  readonly resolution?: ConflictResolution;
  /** `rename` 일 때 쓸 새 slug. */
  readonly slug?: string;
}

export interface ImportAction {
  readonly repoPath: string;
  /** 작업 공간에 쓸 경로. */
  readonly relativePath: string;
  readonly slug: string;
  readonly source: string;
  /** 이미 있는 문서를 덮어쓰는가. */
  readonly overwrite: boolean;
}

export interface ImportPlan {
  readonly actions: readonly ImportAction[];
  readonly skipped: readonly { readonly repoPath: string; readonly reason: string }[];
  /** 전체 취소. 이 경우 `actions` 는 비어 있다. */
  readonly cancelled: boolean;
}

export class ImportPlanError extends Error {
  public override readonly name = 'ImportPlanError';
}

/** 가져온 글이 놓이는 자리. 공개 대상 초안이므로 `drafts` 다. */
const IMPORT_DIRECTORY = 'drafts';

/**
 * 블로그 글을 워크벤치 문서로 옮긴다.
 *
 * 출처 커밋을 함께 남긴다. 이 값이 없으면 나중에 다시 발행할 때 그 사이 블로그가 앞서
 * 나갔는지 알 수 없고, 그러면 남의(=다른 기기에서 한 내) 수정을 조용히 덮어쓰게 된다.
 */
export function blogPostToDocument(post: BlogPost, commit: string, slug = post.slug): string {
  const { data, content } = parseFrontmatter(post.source);
  const publishedAt = typeof data.publishedAt === 'string' ? data.publishedAt : undefined;

  const fields: Record<string, unknown> = {
    title: data.title ?? post.title,
    kind: 'public-draft',
    createdAt: toDateOnly(publishedAt) ?? toDateOnly(post.updatedAt) ?? post.updatedAt,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : post.updatedAt,
    publicEligible: true,
    slug,
    ...pick(data, ['description', 'category', 'tags', 'series', 'seriesOrder', 'publishedAt']),
    // 가져온 글은 이미 블로그에 있다. 그 상태를 그대로 들고 온다.
    draft: data.draft === true,
    importedFrom: { commit, path: post.repoPath },
  };

  return serializeFrontmatter(fields, content);
}

/**
 * 고른 글과 충돌 결정으로 실제 작업 목록을 만든다.
 *
 * `cancel` 은 그 항목 하나가 아니라 **가져오기 전체**를 되돌린다 — 충돌을 보고 마음이 바뀌는
 * 자리이므로, 반쯤 들어온 상태로 끝나지 않게 한다. 한 항목만 빼려면 `skip` 이다.
 */
export function planImport(input: {
  readonly posts: readonly BlogPost[];
  readonly selections: readonly ImportSelection[];
  /** 작업 공간에 이미 있는 slug → 문서 경로. */
  readonly existing: Readonly<Record<string, string>>;
  readonly commit: string;
}): ImportPlan {
  const actions: ImportAction[] = [];
  const skipped: { repoPath: string; reason: string }[] = [];
  const byPath = new Map(input.posts.map((post) => [post.repoPath, post]));
  const claimed = new Map<string, string>(Object.entries(input.existing));

  for (const selection of input.selections) {
    const post = byPath.get(selection.repoPath);
    if (post === undefined) throw new ImportPlanError(`unknown post: ${selection.repoPath}`);

    const conflict = claimed.has(post.slug);
    if (!conflict) {
      actions.push(buildAction(post, post.slug, input.commit, false));
      claimed.set(post.slug, actionPath(post.slug));
      continue;
    }

    switch (selection.resolution) {
      case 'cancel':
        return { actions: [], skipped: [], cancelled: true };
      case 'skip':
        skipped.push({ repoPath: post.repoPath, reason: 'slug already exists' });
        break;
      case 'overwrite': {
        const target = claimed.get(post.slug);
        if (target === undefined) throw new ImportPlanError('missing conflict target');
        actions.push({ ...buildAction(post, post.slug, input.commit, true), relativePath: target });
        break;
      }
      case 'rename': {
        const slug = selection.slug;
        if (slug === undefined || !slugPattern.test(slug)) {
          throw new ImportPlanError(`invalid replacement slug for ${post.repoPath}`);
        }
        if (claimed.has(slug)) {
          throw new ImportPlanError(`replacement slug already exists: ${slug}`);
        }
        actions.push(buildAction(post, slug, input.commit, false));
        claimed.set(slug, actionPath(slug));
        break;
      }
      default:
        throw new ImportPlanError(`slug conflict needs a decision: ${post.slug}`);
    }
  }

  return { actions, skipped, cancelled: false };
}

function buildAction(
  post: BlogPost,
  slug: string,
  commit: string,
  overwrite: boolean,
): ImportAction {
  return {
    repoPath: post.repoPath,
    relativePath: actionPath(slug),
    slug,
    source: blogPostToDocument(post, commit, slug),
    overwrite,
  };
}

function actionPath(slug: string): string {
  return `${IMPORT_DIRECTORY}/${slug}.md`;
}

function pick(data: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => key in data).map((key) => [key, data[key]]));
}

/** 프론트매터의 날짜는 ISO 타임스탬프일 수 있다. `createdAt` 은 날짜만 받는다. */
function toDateOnly(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match?.[1];
}
