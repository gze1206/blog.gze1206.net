import { useState } from 'react';

import type { PublicAssetCandidate, PublishState } from './api.js';
import { LiveEditor } from './live/LiveEditor.js';
import { PreviewPane } from './PreviewPane.js';

type EditorMode = 'edit' | 'split' | 'preview';
const MODES: readonly { id: EditorMode; label: string }[] = [
  { id: 'edit', label: '편집' },
  { id: 'split', label: '나란히' },
  { id: 'preview', label: '미리보기' },
];

interface Props {
  readonly source: string;
  readonly title: string;
  readonly dirty: boolean;
  readonly saving: boolean;
  readonly onChange: (source: string) => void;
  readonly onSave: () => void;
  readonly onReviewPublish?: () => void;
  /** 휴지통으로 옮긴다(NOR-205). */
  readonly onDelete?: () => void;
  /** 한국어 공개 초안이면 영어판 초안을 만든다(NOR-252). */
  readonly onCreateTranslation?: () => void;
  readonly publishAssets?: readonly PublicAssetCandidate[];
  readonly selectedAssetIds?: readonly string[];
  readonly onToggleAsset?: (id: string) => void;
  /** 공개 초안 본문 이미지를 올린다(NOR-219 AC-6). */
  readonly onUploadImage?: (file: File) => Promise<string>;
  /** 공개 글의 발행 상태(NOR-221). 블로그에 나가 있으면 머리에 알린다. */
  readonly publishState?: PublishState;
  readonly onError?: (message: string) => void;
}

export function Editor({
  source,
  title,
  dirty,
  saving,
  onChange,
  onSave,
  onDelete,
  onCreateTranslation,
  onReviewPublish,
  publishAssets = [],
  selectedAssetIds = [],
  onToggleAsset,
  onUploadImage,
  onError,
  publishState,
}: Props) {
  const published = publishState === 'published' || publishState === 'differs';
  const [mode, setMode] = useState<EditorMode>('edit');
  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label="문서 편집기">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border px-4 py-2 md:px-6">
        <div className="min-w-0">
          <h2 className="text-sm font-medium break-words text-foreground">{title}</h2>
          <p className="text-xs text-muted">
            {published
              ? `블로그에 발행된 글 · ${publishState === 'published' ? '블로그와 같음' : '블로그와 다름'}`
              : publishState === 'draft'
                ? '블로그에 보이지 않는 초안(draft)'
                : 'Markdown + YAML frontmatter'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div
            aria-label="보기"
            className="border-border flex rounded-md border p-0.5"
            role="group"
          >
            {MODES.map((item) => (
              <button
                aria-pressed={mode === item.id}
                className="text-muted aria-pressed:bg-surface-sunken aria-pressed:text-foreground rounded px-2.5 py-1.5 text-xs"
                key={item.id}
                onClick={() => setMode(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
          {onDelete ? (
            <button
              className="text-muted hover:text-danger rounded-md px-3 py-2 text-sm disabled:opacity-40"
              disabled={saving}
              onClick={onDelete}
              type="button"
            >
              삭제
            </button>
          ) : null}
          {onCreateTranslation ? (
            <button
              className="text-muted hover:text-foreground rounded-md px-3 py-2 text-sm disabled:opacity-40"
              disabled={saving}
              onClick={onCreateTranslation}
              type="button"
            >
              영어판 만들기
            </button>
          ) : null}
          {onReviewPublish ? (
            <button
              className="rounded-md border border-border-strong bg-surface px-4 py-2 text-sm text-foreground disabled:text-muted"
              disabled={dirty || saving}
              onClick={onReviewPublish}
              type="button"
            >
              {published ? '다시 발행 검토' : '발행 검토'}
            </button>
          ) : null}
          <button
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background disabled:bg-border-strong"
            disabled={!dirty || saving}
            onClick={onSave}
            type="button"
          >
            {saving ? '저장 중…' : dirty ? '저장' : '저장됨'}
          </button>
        </div>
      </header>
      {onReviewPublish ? (
        <fieldset className="border-b border-border px-4 py-3 md:px-6">
          <legend className="text-xs font-semibold tracking-wide text-muted uppercase">
            발행 자산
          </legend>
          {publishAssets.length === 0 ? (
            <p className="mt-1 text-xs text-muted">이 초안에 귀속된 공개 가능 자산이 없습니다.</p>
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
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {mode !== 'preview' ? (
          <LiveEditor
            className="flex-1"
            onChange={onChange}
            source={source}
            {...(onUploadImage ? { onUploadImage } : {})}
            {...(onError ? { onError } : {})}
          />
        ) : null}
        {mode !== 'edit' ? (
          <PreviewPane
            className={
              mode === 'split'
                ? 'border-border flex-1 border-t md:w-1/2 md:flex-none md:border-t-0 md:border-l'
                : 'flex-1'
            }
            source={source}
          />
        ) : null}
      </div>
    </section>
  );
}
