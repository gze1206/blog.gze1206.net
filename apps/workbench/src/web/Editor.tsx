import type { PublicAssetCandidate } from './api.js';

interface Props {
  readonly source: string;
  readonly title: string;
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly onChange: (source: string) => void;
  readonly onSave: () => void;
  readonly onReviewPublish?: () => void;
  readonly publishAssets?: readonly PublicAssetCandidate[];
  readonly selectedAssetIds?: readonly string[];
  readonly onToggleAsset?: (id: string) => void;
}

export function Editor({
  source,
  title,
  dirty,
  saving,
  onChange,
  onSave,
  onReviewPublish,
  publishAssets = [],
  selectedAssetIds = [],
  onToggleAsset,
}: Props) {
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="문서 편집기">
      <header className="flex h-16 items-center justify-between border-b border-stone-200 px-6">
        <div>
          <h2 className="text-sm font-medium text-stone-900">{title}</h2>
          <p className="text-xs text-stone-400">Markdown + YAML frontmatter</p>
        </div>
        <div className="flex gap-2">
          {onReviewPublish ? (
            <button
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm text-stone-800 disabled:text-stone-400"
              disabled={dirty || saving}
              onClick={onReviewPublish}
              type="button"
            >
              발행 검토
            </button>
          ) : null}
          <button
            className="rounded-md bg-stone-900 px-4 py-2 text-sm text-white disabled:bg-stone-300"
            disabled={!dirty || saving}
            onClick={onSave}
            type="button"
          >
            {saving ? '저장 중…' : dirty ? '저장' : '저장됨'}
          </button>
        </div>
      </header>
      {onReviewPublish ? (
        <fieldset className="border-b border-stone-200 px-6 py-3">
          <legend className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            발행 자산
          </legend>
          {publishAssets.length === 0 ? (
            <p className="mt-1 text-xs text-stone-400">
              이 초안에 귀속된 공개 가능 자산이 없습니다.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-3">
              {publishAssets.map((asset) => (
                <label className="flex items-center gap-2 text-sm" key={asset.id}>
                  <input
                    checked={selectedAssetIds.includes(asset.id)}
                    onChange={() => onToggleAsset?.(asset.id)}
                    type="checkbox"
                  />
                  {asset.reference} ({asset.size} B)
                </label>
              ))}
            </div>
          )}
        </fieldset>
      ) : null}
      <textarea
        aria-label="Markdown 문서"
        className="min-h-0 flex-1 resize-none bg-[#fbfaf6] p-6 font-mono text-sm leading-7 text-stone-800 outline-none"
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        value={source}
      />
    </section>
  );
}
