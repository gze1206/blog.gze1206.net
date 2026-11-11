import { orderedFields, parseFrontmatter, serializeFrontmatter } from '../document/frontmatter.js';
import { parsePublishedPost, type PublicPost } from './contract.js';
import { rewriteAssetReferences } from './references.js';
import {
  validatePublicDraft,
  type PublicAssetInput,
  type PublicDraftValidationInput,
} from './validate.js';

const postFieldOrder = [
  'title',
  'description',
  'slug',
  'category',
  'tags',
  'series',
  'seriesOrder',
  'publishedAt',
  'updatedAt',
  'draft',
] as const;

export interface PublicAssetCopy {
  readonly privatePath: string;
  readonly publicPath: string;
}

export interface TransformedPublicPost {
  readonly metadata: PublicPost;
  readonly source: string;
  readonly assets: readonly PublicAssetCopy[];
}

export interface TransformPublicDraftInput extends PublicDraftValidationInput {
  readonly source: string;
}

export function transformPublicDraft(input: TransformPublicDraftInput): TransformedPublicPost {
  const validated = validatePublicDraft(input.source, input);
  const content = rewriteApprovedAssets(validated.content, validated.assets);
  const source = serializeFrontmatter(
    orderedFields(validated.metadata as unknown as Record<string, unknown>, postFieldOrder, {}),
    content,
  );
  const parsed = parseFrontmatter(source);
  const metadata = parsePublishedPost(parsed.data);
  return {
    metadata,
    source,
    assets: validated.assets.map(({ privatePath, publicPath }) => ({ privatePath, publicPath })),
  };
}

function rewriteApprovedAssets(content: string, assets: readonly PublicAssetInput[]): string {
  return rewriteAssetReferences(
    content,
    new Map(assets.map((asset) => [asset.draftReference, `/${asset.publicPath}`])),
  );
}
