export interface Excerpt {
  id?: string | undefined;
  page?: number | undefined;
  text: string;
  memo?: string | undefined;
  addedAt?: string | undefined;
  public?: boolean | undefined;
}

export function ensureExcerptIds(excerpts: readonly Excerpt[], createId: () => string): Excerpt[] {
  return excerpts.map((excerpt) => ({ ...excerpt, id: excerpt.id ?? createId() }));
}

export function updateExcerpt(
  excerpts: readonly Excerpt[],
  index: number,
  patch: { page?: number | undefined; text: string; memo?: string | undefined; public?: boolean },
): Excerpt[] {
  return excerpts.map((excerpt, i) =>
    i === index
      ? {
          ...patch,
          ...(excerpt.id === undefined ? {} : { id: excerpt.id }),
          ...(excerpt.addedAt === undefined ? {} : { addedAt: excerpt.addedAt }),
          ...(patch.public === undefined && excerpt.public !== undefined
            ? { public: excerpt.public }
            : {}),
        }
      : { ...excerpt },
  );
}
