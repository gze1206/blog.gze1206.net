import { useCallback, useEffect, useRef, useState } from 'react';

import {
  confirmPublish,
  createDocument,
  deleteDocument,
  listTrash,
  loadPublishStatus,
  type PublishStatusData,
  createReview,
  listDocuments,
  listPublishAssets,
  uploadPublicAsset,
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
  type TrashItem,
} from './api.js';
import { DocumentList } from './DocumentList.js';
import { BookDialog } from './BookDialog.js';
import { BookEditor } from './BookEditor.js';
import { ImportDialog } from './ImportDialog.js';
import { Editor } from './Editor.js';
import { PublishReview } from './PublishReview.js';
import { readSkippedReviewPeriods } from './reviewPreferences.js';
import { TemplateGallery } from './TemplateGallery.js';
import { ThemeToggle } from './ThemeToggle.js';
import { TrashList } from './TrashList.js';
import { SiteContent } from './site/SiteContent.js';
import { DayPage } from './day/[date].js';

export function App() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  /** 읽지 못한 파일. 목록에서 빠진 이유를 사용자가 알아야 고칠 수 있다(NOR-190). */
  const [documentProblems, setDocumentProblems] = useState<DocumentProblem[]>([]);
  const [trash, setTrash] = useState<readonly TrashItem[]>([]);
  const [importing, setImporting] = useState(false);
  const [addingBook, setAddingBook] = useState(false);
  /** 사이트 콘텐츠 화면(NOR-208). 문서를 고르면 문서가 앞선다. */
  const [siteOpen, setSiteOpen] = useState(false);
  /** 지금 열린 문서 id. 늦게 끝난 올리기가 다른 문서의 상태를 바꾸지 않게 본다. */
  const selectedIdRef = useRef<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<PublishStatusData | null>(null);
  /** 책은 폼으로 다루는 것이 기본이고, 원본 마크다운은 필요할 때 연다. */
  const [editingSource, setEditingSource] = useState(false);
  const [selected, setSelected] = useState<DocumentEntry | null>(null);
  useEffect(() => {
    selectedIdRef.current = selected?.id ?? null;
  }, [selected]);
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
    const [nextTemplates, nextDocuments, nextTrash] = await Promise.all([
      listTemplates(),
      listDocuments(),
      listTrash().catch(() => [] as readonly TrashItem[]),
    ]);
    setTemplates(nextTemplates);
    setDocuments(nextDocuments.documents);
    setDocumentProblems(nextDocuments.problems);
    setTrash(nextTrash);
    // 발행 상태는 블로그를 새로 받아 비교하므로 느리다. 목록을 막지 않고 따로 채운다(NOR-209).
    void loadPublishStatus()
      .then(setPublishStatus)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    // 휴지통은 처음 화면에 필요하지 않다. 못 읽어도 다른 화면은 그대로 쓴다.
    void listTrash()
      .then(setTrash)
      .catch(() => undefined);
  }, []);

  /** 휴지통으로 옮긴다(NOR-205). 발행한 글은 블로그에서 따로 내려야 한다. */
  const removeSelected = async () => {
    if (selected === null) return;
    const message =
      selected.kind === 'public-draft' || selected.kind === 'book'
        ? `"${selected.title}" 을 휴지통으로 옮길까요? 이미 블로그에 내보낸 내용은 블로그에서 따로 내려야 합니다.`
        : `"${selected.title}" 을 휴지통으로 옮길까요? 휴지통에서 되돌릴 수 있습니다.`;
    if (!window.confirm(message)) return;
    setBusy(true);
    try {
      await deleteDocument(selected.id);
      setSelected(null);
      await refresh();
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

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

  const selectedPublishState = publishStatus?.documents.find(
    (item) => item.documentId === selected?.id,
  )?.status;

  return (
    <div className="flex h-screen min-h-[38rem] bg-background text-foreground">
      {importing ? (
        <ImportDialog onClose={() => setImporting(false)} onImported={() => void refresh()} />
      ) : null}
      {addingBook ? (
        <BookDialog onClose={() => setAddingBook(false)} onCreated={() => void refresh()} />
      ) : null}
      <aside className="w-80 shrink-0 overflow-y-auto border-r border-border bg-surface-sunken p-5">
        <header className="mb-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-accent font-mono text-[11px] tracking-[0.22em] uppercase">
                Private
              </p>
              <h1 className="text-foreground mt-1 font-bold tracking-[-0.02em] text-2xl">
                Workbench
              </h1>
            </div>
            <ThemeToggle />
          </div>
          <button
            className="mt-4 w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-sm"
            onClick={() => {
              setSelected(null);
              setSiteOpen(false);
            }}
            type="button"
          >
            오늘의 로그
          </button>
          <button
            className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-sm"
            onClick={() => setImporting(true)}
            type="button"
          >
            블로그에서 가져오기
          </button>
          <button
            className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-sm"
            onClick={() => setAddingBook(true)}
            type="button"
          >
            책 등록
          </button>
          <button
            className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-sm"
            onClick={() => {
              setSelected(null);
              setSiteOpen(true);
            }}
            type="button"
          >
            사이트 콘텐츠
          </button>
        </header>
        <TemplateGallery busy={busy} onCreate={create} templates={templates} />
        <DocumentList
          blogOnly={publishStatus?.blogOnly.length ?? 0}
          onImport={() => setImporting(true)}
          statuses={Object.fromEntries(
            (publishStatus?.documents ?? []).map((item) => [item.documentId, item.status]),
          )}
          documents={documents}
          onSelect={(id) => {
            setSiteOpen(false);
            void selectDocument(id);
          }}
          problems={documentProblems}
          selectedId={selected?.id ?? null}
        />
        {trash.length > 0 ? (
          <TrashList items={trash} onChanged={() => void refresh()} onError={setError} />
        ) : null}
      </aside>
      <main className="flex min-w-0 flex-1 flex-col bg-background">
        {error ? (
          <div
            className="border-b border-danger/30 bg-danger/10 px-6 py-3 text-sm text-danger"
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
            onDelete={() => void removeSelected()}
            onEditSource={() => setEditingSource(true)}
            onError={setError}
          />
        ) : selected ? (
          <>
            {selected.kind === 'book' ? (
              <p className="border-b border-border bg-surface-sunken px-6 py-2 text-xs text-muted-strong">
                원본을 직접 고치는 중입니다.{' '}
                <button
                  className="text-accent underline"
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
              onDelete={() => void removeSelected()}
              onSave={() => void save()}
              {...(selected.kind === 'public-draft'
                ? {
                    onReviewPublish: () => void review(),
                    onUploadImage: async (file: File) => {
                      const documentId = selected.id;
                      const uploaded = await uploadPublicAsset(documentId, file);
                      const assets = await listPublishAssets(documentId);
                      // 올리는 사이 다른 문서를 열었으면 그 문서의 자산 목록을 건드리지 않는다.
                      if (selectedIdRef.current === documentId) {
                        setPublishAssets(assets);
                        setSelectedAssetIds((current) =>
                          current.includes(uploaded.id) ? current : [...current, uploaded.id],
                        );
                      }
                      return uploaded.reference;
                    },
                    onError: setError,
                    ...(selectedPublishState ? { publishState: selectedPublishState } : {}),
                  }
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
        ) : siteOpen ? (
          <SiteContent />
        ) : day ? (
          <DayPage
            date={day}
            onCreateReview={createSuggestedReview}
            onDismissReviewSuggestion={() => setReviewSuggestion(null)}
            onError={setError}
            reviewSuggestion={reviewSuggestion}
          />
        ) : (
          <p className="p-8 text-sm text-muted">앱 달력을 불러오는 중입니다.</p>
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
