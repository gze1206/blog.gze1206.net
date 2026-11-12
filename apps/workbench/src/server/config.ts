import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  realpathSync,
  statSync,
} from 'node:fs';

import { z } from 'zod';
import { BLOG_LAYOUT } from '@gze1206/content-contract';

import { isValidTimeZone } from '../core/reviews/calendar.js';

/**
 * 서버 설정과 그 검증 (NOR-143, NOR-148).
 *
 * 설정이 틀렸을 때 **부팅에서 멈추는 것**이 이 모듈의 일이다. 발행 경로는 남의 저장소에
 * 쓰는 일이라, 잘못된 값으로 일단 뜬 뒤 런타임에 실패하면 무엇이 어디까지 갔는지 알기 어렵다.
 *
 * ③ 공개 블로그의 상시 clone 은 더 이상 없다(NOR-148). remote 주소만 알고, 발행할 때마다
 * 임시로 clone 한다. 그래서 여기서 검증하는 것은 경로가 아니라 **주소의 모양**이다.
 */

/** 발행을 허용하는 호스트. 다른 호스트로는 clone 하지 않는다. */
const ALLOWED_REMOTE_HOST = 'github.com';
/** `/<owner>/<repo>` 또는 `/<owner>/<repo>.git` 만 받는다. */
const REMOTE_PATH_PATTERN = /^\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const DEFAULT_BRANCH = BLOG_LAYOUT.publishBranch;
const DEFAULT_WORK_BASE = '/run/publish';
const OUTBOX_RELATIVE_PATH = '.workbench/publish-outbox';
/** outbox 는 사람만 열어 보는 자리다. 그룹·타인 권한을 남기지 않는다. */
const OUTBOX_MODE = 0o700;

const environmentSchema = z.object({
  WORKSPACE_ROOT: z.string().trim().min(1),
  APP_TIME_ZONE: z.string().trim().min(1).refine(isValidTimeZone, 'APP_TIME_ZONE must be valid'),
  PUBLIC_BLOG_REMOTE: z.string().trim().min(1),
  PUBLIC_BLOG_BRANCH: z.string().trim().min(1).default(DEFAULT_BRANCH),
  PUBLISH_WORK_BASE: z.string().trim().min(1).default(DEFAULT_WORK_BASE),
  PUBLISH_OUTBOX_ROOT: z.string().trim().min(1).optional(),
  PUBLISH_GIT_AUTHOR_NAME: z.string().trim().min(1, 'PUBLISH_GIT_AUTHOR_NAME must be configured'),
  PUBLISH_GIT_AUTHOR_EMAIL: z
    .string()
    .trim()
    .min(1, 'PUBLISH_GIT_AUTHOR_EMAIL must be configured')
    .email('PUBLISH_GIT_AUTHOR_EMAIL must be an email address'),
});

export interface ServerConfig {
  readonly workspaceRoot: string;
  readonly appTimeZone: string;
  /** 공개 블로그 remote. 발행 세션마다 여기서 임시로 clone 한다. */
  readonly publicBlogRemote: string;
  readonly publicBlogBranch: string;
  /** 임시 clone 이 사는 자리. 컨테이너에서는 tmpfs 이며 ② 밖이다. */
  readonly publishWorkBase: string;
  /** 확정한 커밋을 사람이 가져갈 수 있게 내려놓는 자리. ② 안이고 git 이 무시한다. */
  readonly publishOutboxRoot: string;
  readonly publishAuthorName: string;
  readonly publishAuthorEmail: string;
}

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
): ServerConfig {
  const parsed = parseEnvironment(environment);
  const workspaceRoot = canonicalDirectory(parsed.WORKSPACE_ROOT, 'WORKSPACE_ROOT');
  const publishWorkBase = canonicalDirectory(parsed.PUBLISH_WORK_BASE, 'PUBLISH_WORK_BASE');

  if (pathsOverlap(workspaceRoot, publishWorkBase)) {
    throw new Error('WORKSPACE_ROOT and PUBLISH_WORK_BASE must not overlap');
  }

  const publishOutboxRoot = prepareOutbox(
    parsed.PUBLISH_OUTBOX_ROOT ?? path.join(workspaceRoot, OUTBOX_RELATIVE_PATH),
    workspaceRoot,
    publishWorkBase,
  );

  return {
    workspaceRoot,
    appTimeZone: parsed.APP_TIME_ZONE,
    publicBlogRemote: assertRemote(parsed.PUBLIC_BLOG_REMOTE),
    publicBlogBranch: parsed.PUBLIC_BLOG_BRANCH,
    publishWorkBase,
    publishOutboxRoot,
    publishAuthorName: parsed.PUBLISH_GIT_AUTHOR_NAME,
    publishAuthorEmail: parsed.PUBLISH_GIT_AUTHOR_EMAIL,
  };
}

/** zod 의 오류 메시지에 어떤 키가 문제인지 항상 남긴다 — 부팅 로그만 보고 고칠 수 있어야 한다. */
function parseEnvironment(environment: Record<string, string | undefined>) {
  const result = environmentSchema.safeParse(environment);
  if (result.success) return result.data;

  const [issue] = result.error.issues;
  const key = issue?.path.join('.') ?? 'configuration';
  throw new Error(`${key}: ${issue?.message ?? 'is invalid'}`);
}

/**
 * remote 주소를 **정확히** 검증한다.
 *
 * 여기서 통과시키는 모양이 곧 clone 이 닿을 수 있는 범위다. 스킴·호스트·포트만 보고 넘기면
 * `https://github.com/owner/repo?token=…` 처럼 자격 증명이 섞인 주소나 다른 경로가 지나간다.
 */
function assertRemote(value: string): string {
  const invalid = (): never => {
    throw new Error(
      `PUBLIC_BLOG_REMOTE must be https://${ALLOWED_REMOTE_HOST}/<owner>/<repo>[.git]`,
    );
  };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return invalid();
  }

  const pathname = parsed.pathname.replace(/\.git$/, '');
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname.toLowerCase() !== ALLOWED_REMOTE_HOST ||
    (parsed.port !== '' && parsed.port !== '443') ||
    parsed.username !== '' ||
    parsed.password !== '' ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    !REMOTE_PATH_PATTERN.test(pathname)
  ) {
    return invalid();
  }

  return value;
}

/**
 * outbox 를 쓸 수 있는 상태로 만든다.
 *
 * 자리는 앱이 만들어도 되지만(② 안의 자기 디렉터리다), **무시 규칙은 사람 것이다** —
 * `.gitignore` 를 대신 고치지 않고, 무시되지 않으면 부팅을 거부한다. 발행 산출물이 개인
 * 저장소의 커밋에 섞여 들어가는 사고를 앱이 조용히 만들지 않기 위해서다.
 */
function prepareOutbox(candidate: string, workspaceRoot: string, publishWorkBase: string): string {
  const resolved = path.resolve(candidate);
  mkdirSync(resolved, { recursive: true, mode: OUTBOX_MODE });
  const canonical = canonicalDirectory(resolved, 'PUBLISH_OUTBOX_ROOT');

  if (!isSameOrDescendant(canonical, workspaceRoot) || canonical === workspaceRoot) {
    throw new Error('PUBLISH_OUTBOX_ROOT must be inside WORKSPACE_ROOT');
  }
  if (pathsOverlap(canonical, publishWorkBase)) {
    throw new Error('PUBLISH_OUTBOX_ROOT and PUBLISH_WORK_BASE must not overlap');
  }

  const mode = statSync(canonical).mode & 0o777;
  if ((mode & ~OUTBOX_MODE) !== 0) chmodSync(canonical, OUTBOX_MODE);

  assertGitIgnored(canonical, workspaceRoot);
  return canonical;
}

/**
 * outbox 가 ② 의 git 에서 무시되는지 확인한다.
 *
 * 판단 기준은 **`.git` 의 존재**다. `git` 명령의 성공 여부로 "저장소인가"를 판단하면,
 * dubious ownership 처럼 저장소인데도 명령이 실패하는 상황에서 검사를 조용히 건너뛴다.
 * 그러면 발행 산출물이 개인 저장소 커밋에 섞일 수 있고, 그것이 이 검사가 막으려던 일이다.
 * 그래서 저장소로 보이는데 확인할 수 없으면 **부팅을 거부**한다.
 */
function assertGitIgnored(outbox: string, workspaceRoot: string): void {
  if (!existsSync(path.join(workspaceRoot, '.git'))) return;

  try {
    execFileSync('git', ['-C', workspaceRoot, 'check-ignore', '--quiet', outbox], {
      stdio: 'ignore',
    });
  } catch (error) {
    // git 은 "무시되지 않음"을 종료 코드 1 로, 그 밖의 실패를 128 등으로 알린다.
    const status = (error as { status?: number }).status;
    if (status === 1) {
      throw new Error(
        'PUBLISH_OUTBOX_ROOT must be ignored by WORKSPACE_ROOT git — add it to .gitignore yourself',
        { cause: error },
      );
    }
    throw new Error(
      `PUBLISH_OUTBOX_ROOT ignore state could not be verified in WORKSPACE_ROOT (git exited ${String(status)})`,
      { cause: error },
    );
  }
}

function canonicalDirectory(value: string, name: string): string {
  const resolved = path.resolve(value);
  let canonical: string;
  try {
    canonical = realpathSync.native(resolved);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(`${name} must exist`, { cause: error });
    }
    throw error;
  }
  if (!statSync(canonical).isDirectory()) throw new Error(`${name} must be a directory`);
  try {
    accessSync(canonical, constants.R_OK | constants.W_OK);
  } catch (error) {
    throw new Error(`${name} must be readable and writable`, { cause: error });
  }
  return canonical;
}

function pathsOverlap(left: string, right: string): boolean {
  return isSameOrDescendant(left, right) || isSameOrDescendant(right, left);
}

function isSameOrDescendant(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
