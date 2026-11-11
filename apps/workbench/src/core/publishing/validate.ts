import { parseDocument } from '../document/document.js';
import { parsePublishedPost, type PublicPost } from './contract.js';
import { parseAssetReferences } from './references.js';

export interface PublicAssetInput {
  readonly draftReference: string;
  readonly privatePath: string;
  readonly publicPath: string;
}

export interface PublicDraftValidationInput {
  readonly privateRoot: string;
  readonly assets: readonly PublicAssetInput[];
}

export interface ValidatedPublicDraft {
  readonly metadata: PublicPost;
  readonly content: string;
  readonly assets: readonly PublicAssetInput[];
}

export class PublicDraftValidationError extends Error {
  public override readonly name = 'PublicDraftValidationError';
}

export function validatePublicDraft(
  source: string,
  input: PublicDraftValidationInput,
): ValidatedPublicDraft {
  try {
    const document = parseDocument(source);
    if (document.kind !== 'public-draft' || document.publicEligible !== true) {
      throw new Error('only publicEligible public-draft documents can be published');
    }

    assertNoLeaks(source, input.privateRoot);
    const metadata = parsePublishedPost({
      title: document.title,
      description: document.description,
      slug: document.slug,
      category: document.category,
      tags: document.tags,
      series: document.series,
      seriesOrder: document.seriesOrder,
      publishedAt: document.publishedAt,
      updatedAt: document.updatedAt,
      draft: document.draft ?? false,
    });
    const assets = validateAssets(input.assets, input.privateRoot, metadata.slug);
    assertAllAssetReferencesResolved(document.content, assets);
    return { metadata, content: document.content, assets };
  } catch (error) {
    if (error instanceof PublicDraftValidationError) throw error;
    throw new PublicDraftValidationError(
      error instanceof Error ? error.message : 'invalid public draft',
      { cause: error },
    );
  }
}

function assertNoLeaks(source: string, privateRoot: string): void {
  const normalizedSource = source.replaceAll('\\', '/');
  const normalizedPrivateRoot = normalizeAbsolutePath(privateRoot);
  const checks: readonly [RegExp | string, string][] = [
    [/file:\/\//iu, 'file URL'],
    [/(?:^|[\s('"=])workspace\//imu, 'workspace path'],
    [/assets\/private\//iu, 'private asset directory'],
    [/\[\[[^\]]+\]\]/u, 'internal wiki link'],
    [normalizedPrivateRoot, 'configured private root'],
  ];
  for (const [needle, label] of checks) {
    if (
      (typeof needle === 'string' && needle !== '' && normalizedSource.includes(needle)) ||
      (needle instanceof RegExp && needle.test(normalizedSource))
    ) {
      throw new PublicDraftValidationError(`private leak detected: ${label}`);
    }
  }
}

function validateAssets(
  assets: readonly PublicAssetInput[],
  privateRoot: string,
  slug: string,
): readonly PublicAssetInput[] {
  const seenReferences = new Set<string>();
  const seenPublicPaths = new Set<string>();
  return [...assets]
    .map((asset) => {
      if (!isSafeRelativePath(asset.draftReference)) {
        throw new Error(`invalid asset reference: ${asset.draftReference}`);
      }
      const privatePath = normalizeAbsolutePath(asset.privatePath);
      if (!isDescendant(privatePath, normalizeAbsolutePath(privateRoot))) {
        throw new Error(`asset is outside the configured private root: ${asset.draftReference}`);
      }
      const publicPath = asset.publicPath.replaceAll('\\', '/');
      if (
        !isSafeRelativePath(publicPath) ||
        !publicPath.startsWith(`assets/posts/${slug}/`) ||
        publicPath.endsWith('/')
      ) {
        throw new Error(`asset public path must be scoped to slug ${slug}`);
      }
      if (seenReferences.has(asset.draftReference) || seenPublicPaths.has(publicPath)) {
        throw new Error(`duplicate approved asset: ${asset.draftReference}`);
      }
      seenReferences.add(asset.draftReference);
      seenPublicPaths.add(publicPath);
      return { ...asset, privatePath, publicPath };
    })
    .sort((left, right) => left.publicPath.localeCompare(right.publicPath));
}

function assertAllAssetReferencesResolved(
  content: string,
  assets: readonly PublicAssetInput[],
): void {
  const approved = new Set(assets.map(({ draftReference }) => draftReference));
  for (const { reference } of parseAssetReferences(content)) {
    if (!approved.has(reference)) {
      throw new PublicDraftValidationError(`unresolved asset reference: ${reference}`);
    }
  }
}

function isSafeRelativePath(value: string): boolean {
  const normalized = value.replaceAll('\\', '/');
  return (
    normalized.length > 0 &&
    !normalized.startsWith('/') &&
    !normalized.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  );
}

function isDescendant(candidate: string, root: string): boolean {
  return candidate !== root && candidate.startsWith(`${root}/`);
}

function normalizeAbsolutePath(value: string): string {
  const source = value.replaceAll('\\', '/');
  const drive = source.match(/^[A-Za-z]:/u)?.[0]?.toLowerCase() ?? '';
  if (!source.startsWith('/') && drive === '')
    throw new Error(`expected an absolute path: ${value}`);
  const remainder = drive === '' ? source : source.slice(drive.length);
  const segments: string[] = [];
  for (const segment of remainder.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return `${drive}/${segments.join('/')}`.replace(/\/$/u, '') || '/';
}
