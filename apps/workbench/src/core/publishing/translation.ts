/**
 * 한국어 공개 초안에서 영어판 초안을 만드는 계획 (NOR-252).
 *
 * 파일을 읽고 쓰는 일은 부르는 쪽이 한다. 여기서는 무엇을 어디에 쓸지만 정한다.
 */
import { parseDocument, serializeDocument } from '../document/document.js';

export interface TranslationPlan {
  /** 새 영어 초안의 작업 공간 경로. */
  readonly relativePath: string;
  /** 새 영어 초안 원문. */
  readonly source: string;
  /** 원본 키가 없거나 slug 와 다르면 키를 slug 로 적은 원본 원문. 같으면 null(고치지 않는다). */
  readonly originalSource: string | null;
}

export class TranslationPlanError extends Error {
  public override readonly name = 'TranslationPlanError';
}

/**
 * 영어 초안은 원본의 메타와 본문을 그대로 복사한다. 번역 전에 공개되지 않도록 `draft: true` 로 두고,
 * 번역할 거리임이 보이도록 제목 앞에 `[EN] ` 을 붙인다(원본과 이름이 겹치지 않는다).
 */
export function planTranslationDraft(source: string, today: string): TranslationPlan {
  const original = parseDocument(source);
  if (original.kind !== 'public-draft' || original.publicEligible !== true)
    throw new TranslationPlanError('only public drafts can be translated');
  if (original.lang === 'en') throw new TranslationPlanError('the draft is already in English');
  if (!original.slug) throw new TranslationPlanError('the draft needs a slug before translation');
  // 키는 한국어판의 slug 다(NOR-254). 번역판 댓글 묶음이 이 값으로 한국어판 경로를 정한다.
  const key = original.slug;
  const english = {
    ...original,
    title: `[EN] ${original.title}`,
    createdAt: today,
    updatedAt: today,
    lang: 'en',
    translationKey: key,
    draft: true,
    // 가져온 글의 출처는 원본의 것이다. 새 영어 초안은 블로그에 없던 글이다.
    extra: Object.fromEntries(
      Object.entries(original.extra).filter(([name]) => name !== 'importedFrom'),
    ),
  };
  return {
    relativePath: `drafts/${original.slug}.en.md`,
    source: serializeDocument(english),
    originalSource:
      original.translationKey === key
        ? null
        : serializeDocument({ ...original, translationKey: key }),
  };
}
