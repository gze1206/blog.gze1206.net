import { useCallback, useEffect, useState } from 'react';

import {
  confirmPublish,
  createDocument,
  createReview,
  listDocuments,
  listPublishAssets,
  listTemplates,
  loadReviewContext,
  readDocument,
  reviewPublish,
  saveDocument,
  type DocumentEntry,
  type DocumentProblem,
  type DocumentSummary,
  type BulletReference,
  type PublishResult,
  type PublishReviewData,
  type PublicAssetCandidate,
  type ReviewSuggestion,
  type TemplateSummary,
} from './api.js';
import { DocumentList } from './DocumentList.js';
import { BookDialog } from './BookDialog.js';
import { BookEditor } from './BookEditor.js';
import { ImportDialog } from './ImportDialog.js';
import { Editor } from './Editor.js';
import { PublishReview } from './PublishReview.js';
import { readSkippedReviewPeriods } from './reviewPreferences.js';
import { TemplateGallery } from './TemplateGallery.js';
import { DayPage } from './day/[date].js';

export function App() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  /** 읽지 못한 파일. 목록에서 빠진 이유를 사용자가 알아야 고칠 수 있다(NOR-190). */
  const [documentProblems, setDocumentProblems] = useState<DocumentProblem[]>([]);
  const [importing, setImporting] = useState(false);
  const [addingBook, setAddingBook] = useState(false);
  /** 책은 폼으로 다루는 것이 기본이고, 원본 마크다운은 필요할 때 연다. */
  const [editingSource, setEditingSource] = useState(false);
  const [selected, setSelected] = useState<DocumentEntry | null>(null);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(() => dayFromLocation());
  const [publishReview, setPublishReview] = useState<PublishReviewData | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [publishAssets, setPublishAssets] = useState<PublicAssetCandidate[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [reviewSuggestion, setReviewSuggestion] = useState<ReviewSuggestion | null>(null);

  const refresh = useCallback(async () => {
    const [nextTemplates, nextDocuments] = await Promise.all([listTemplates(), listDocuments()]);
    setTemplates(nextTemplates);
    setDocuments(nextDocuments.documents);
    setDocumentProblems(nextDocuments.problems);
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      listTemplates(),
      listDocuments(),
      loadReviewContext(readSkippedReviewPeriods()),
    ])
      .then(([nextTemplates, nextDocuments, reviewContext]) => {
        if (!active) return;
        setTemplates(nextTemplates);
        setDocuments(nextDocuments.documents);
        setDocumentProblems(nextDocuments.problems);
        setReviewSuggestion(reviewContext.suggestion);
        setDay((current) => current ?? reviewContext.today);
      })
      .catch((caught: unknown) => {
        if (active) setError(toMessage(caught));
      });
    return () => {
      active = false;
    };
  }, []);

  const selectDocument = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const document = await readDocument(id);
      // 다른 문서를 열면 원본 보기는 닫는다. 한 번 연 것이 계속 따라다니면 안 된다.
      if (selected?.id !== id) setEditingSource(false);
      setSelected(document);
      setSource(document.source);
      setPublishReview(null);
      setPublishResult(null);
      setSelectedAssetIds([]);
      setPublishAssets([]);
      if (document.kind === 'public-draft') {
        setPublishAssets(await listPublishAssets(document.id));
      }
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const create = async (templateId: string, title: string, period?: string) => {
    setBusy(true);
    setError(null);
    try {
      const template = templates.find(({ id }) => id === templateId);
      const document =
        template &&
        (template.kind === 'weekly-review' || template.kind === 'monthly-review') &&
        period
          ? await createReview({ kind: template.kind, period, title })
          : await createDocument({ templateId, title, ...(period ? { period } : {}) });
      setSelected(document);
      setSource(document.source);
      setPublishReview(null);
      setPublishResult(null);
      setPublishAssets([]);
      setSelectedAssetIds([]);
      await refresh();
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const createSuggestedReview = async (
    suggestion: ReviewSuggestion,
    bulletReferences: readonly BulletReference[],
  ) => {
    setBusy(true);
    setError(null);
    try {
      const document = await createReview({
        kind: suggestion.kind,
        period: suggestion.period,
        ...(bulletReferences.length > 0 ? { bulletReferences } : {}),
      });
      setSelected(document);
      setSource(document.source);
      setReviewSuggestion(null);
      await refresh();
      return document;
    } finally {
      setBusy(false);
    }
  };

  const review = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      setPublishReview(await reviewPublish(selected.id, selectedAssetIds));
      setPublishResult(null);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!selected || !publishReview) return;
    setBusy(true);
    setError(null);
    try {
      setPublishResult(await confirmPublish(selected.id, publishReview.reviewId, selectedAssetIds));
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const document = await saveDocument(selected.id, source);
      setSelected(document);
      setSource(document.source);
      await refresh();
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen min-h-[38rem] bg-[#f4f1e8] text-stone-900">
      {importing ? (
        <ImportDialog onClose={() => setImporting(false)} onImported={() => void refresh()} />
      ) : null}
      {addingBook ? (
        <BookDialog onClose={() => setAddingBook(false)} onCreated={() => void refresh()} />
      ) : null}
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-stone-200 bg-[#f8f6ef] p-5">
        <header className="mb-8">
          <p className="font-mono text-[11px] tracking-[0.22em] text-emerald-700 uppercase">
            Private
          </p>
          <h1 className="mt-1 font-serif text-2xl">Workbench</h1>
          <button
            className="mt-4 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-sm"
            onClick={() => setSelected(null)}
            type="button"
          >
            오늘의 로그
          </button>
          <button
            className="mt-2 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-sm"
            onClick={() => setImporting(true)}
            type="button"
          >
            블로그에서 가져오기
          </button>
          <button
            className="mt-2 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-sm"
            onClick={() => setAddingBook(true)}
            type="button"
          >
            책 등록
          </button>
        </header>
        <TemplateGallery busy={busy} onCreate={create} templates={templates} />
        <DocumentList
          documents={documents}
          onSelect={(id) => void selectDocument(id)}
          problems={documentProblems}
          selectedId={selected?.id ?? null}
        />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-[#fbfaf6]">
        {error ? (
          <div
            className="border-b border-red-200 bg-red-50 px-6 py-3 text-sm text-red-700"
            role="alert"
          >
            {error}
          </div>
        ) : null}
        {selected && publishReview ? (
          <PublishReview
            key={`${selected.id}:${publishReview.metadata.slug}`}
            onClose={() => {
              setPublishReview(null);
              setPublishResult(null);
            }}
            onConfirm={() => void publish()}
            publishing={busy}
            result={publishResult}
            review={publishReview}
          />
        ) : selected && selected.kind === 'book' && !editingSource ? (
          <BookEditor
            document={selected}
            key={selected.id}
            onChanged={() => void selectDocument(selected.id)}
            onEditSource={() => setEditingSource(true)}
            onError={setError}
          />
        ) : selected ? (
          <>
            {selected.kind === 'book' ? (
              <p className="border-b border-stone-200 bg-stone-50 px-6 py-2 text-xs text-stone-600">
                원본을 직접 고치는 중입니다.{' '}
                <button
                  className="text-emerald-700 underline"
                  onClick={() => setEditingSource(false)}
                  type="button"
                >
                  폼으로 돌아가기
                </button>
              </p>
            ) : null}
            <Editor
              dirty={source !== selected.source}
              onChange={setSource}
              onSave={() => void save()}
              {...(selected.kind === 'public-draft'
                ? { onReviewPublish: () => void review() }
                : {})}
              onToggleAsset={(id) =>
                setSelectedAssetIds((current) =>
                  current.includes(id)
                    ? current.filter((candidate) => candidate !== id)
                    : [...current, id],
                )
              }
              publishAssets={publishAssets}
              selectedAssetIds={selectedAssetIds}
              saving={busy}
              source={source}
              title={selected.title}
            />
          </>
        ) : day ? (
          <DayPage
            date={day}
            onCreateReview={createSuggestedReview}
            onDismissReviewSuggestion={() => setReviewSuggestion(null)}
            onError={setError}
            reviewSuggestion={reviewSuggestion}
          />
        ) : (
          <p className="p-8 text-sm text-stone-500">앱 달력을 불러오는 중입니다.</p>
        )}
      </main>
    </div>
  );
}

function dayFromLocation(): string | null {
  const routeDate = /^\/day\/(?<date>\d{4}-\d{2}-\d{2})\/?$/u.exec(window.location.pathname)?.groups
    ?.date;
  if (routeDate) return routeDate;
  return null;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
}
