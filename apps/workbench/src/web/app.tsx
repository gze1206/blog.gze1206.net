import { useCallback, useEffect, useRef, useState } from 'react';

import {
  confirmPublish,
  createDocument,
  createTranslation,
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
import { SchedulePage } from './schedule/SchedulePage.js';
import { PublishToasts } from './publish/PublishToasts.js';
import { trackPublish } from './publish/trackPublish.js';

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
  // 상태를 아직 모르는 동안 배지 자리에 "확인 중" 을 둔다(NOR-228). 실패하면 자리를 거둔다.
  const [publishStatusLoading, setPublishStatusLoading] = useState(true);
  const refreshPublishStatus = () => {
    setPublishStatusLoading(true);
    void loadPublishStatus()
      .then(setPublishStatus)
      .catch(() => undefined)
      .finally(() => setPublishStatusLoading(false));
  };
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
  /** 앱이 알려 준 오늘. 지난 날을 보다가 "오늘의 로그" 로 돌아올 때 쓴다(NOR-240). */
  const [today, setToday] = useState<string | null>(null);
  /** 일정 화면에서 고른 날. null 이면 일정 화면을 닫았다(NOR-243). */
  const [scheduleDate, setScheduleDate] = useState<string | null>(null);
  const [publishReview, setPublishReview] = useState<PublishReviewData | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [publishAssets, setPublishAssets] = useState<PublicAssetCandidate[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [reviewSuggestion, setReviewSuggestion] = useState<ReviewSuggestion | null>(null);
  /** 좁은 화면에서 사이드바 서랍이 열렸는지(NOR-233). 넓은 화면에서는 쓰지 않는다. */
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

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
    refreshPublishStatus();
  }, []);

  useEffect(() => {
    // 휴지통은 처음 화면에 필요하지 않다. 못 읽어도 다른 화면은 그대로 쓴다.
    void listTrash()
      .then(setTrash)
      .catch(() => undefined);
  }, []);

  /** 휴지통으로 옮긴다(NOR-205). 발행한 글은 블로그에서 따로 내려야 한다. */
  /** 한국어 공개 초안에서 영어판 초안을 만들고 연다(NOR-252). */
  const translate = async (id: string) => {
    if (
      source !== selected?.source &&
      !window.confirm('저장하지 않은 수정이 있습니다. 저장된 내용으로 영어판을 만들까요?')
    )
      return;
    setBusy(true);
    try {
      const created = await createTranslation(id);
      await refresh();
      await selectDocument(created.id);
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      setBusy(false);
    }
  };

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
        setToday(reviewContext.today);
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
      const result = await confirmPublish(selected.id, publishReview.reviewId, selectedAssetIds);
      setPublishResult(result);
      trackPublish(result.outboxRef, selected.title);
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
    <div className="flex h-dvh flex-col bg-background text-foreground md:min-h-[38rem] md:flex-row">
      {/* 좁은 화면에서만 보이는 위쪽 막대. 사이드바는 서랍으로 접는다(NOR-233). */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface-sunken px-2 md:hidden">
        <button
          aria-controls="sidebar"
          aria-expanded={menuOpen}
          aria-label="메뉴 열기"
          className="flex size-10 items-center justify-center rounded-md text-muted-strong hover:text-foreground"
          onClick={() => setMenuOpen((open) => !open)}
          ref={menuButtonRef}
          type="button"
        >
          <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 20 20">
            <path
              d="M3 5h14M3 10h14M3 15h14"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.6"
            />
          </svg>
        </button>
        <span className="font-bold tracking-[-0.02em]">Workbench</span>
      </div>
      {menuOpen ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-scrim md:hidden"
          data-testid="sidebar-scrim"
          onClick={closeMenu}
        />
      ) : null}
      {importing ? (
        <ImportDialog onClose={() => setImporting(false)} onImported={() => void refresh()} />
      ) : null}
      {addingBook ? (
        <BookDialog onClose={() => setAddingBook(false)} onCreated={() => void refresh()} />
      ) : null}
      <aside
        aria-label="사이드바"
        className={`${
          menuOpen ? 'fixed inset-y-0 left-0 z-40 block w-[min(20rem,85vw)] shadow-xl' : 'hidden'
        } shrink-0 overflow-y-auto border-r border-border bg-surface-sunken p-5 md:static md:z-auto md:block md:w-80 md:shadow-none`}
        id="sidebar"
      >
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
              setScheduleDate(null);
              if (today !== null) setDay(today);
              closeMenu();
            }}
            type="button"
          >
            오늘의 로그
          </button>
          <button
            className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-sm disabled:opacity-50"
            // 오늘 날짜를 받기 전에는 열 날짜가 없다.
            disabled={(day ?? today) === null}
            onClick={() => {
              setSelected(null);
              setSiteOpen(false);
              setScheduleDate(day ?? today);
              closeMenu();
            }}
            type="button"
          >
            일정
          </button>
          <button
            className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-sm"
            onClick={() => {
              setImporting(true);
              closeMenu();
            }}
            type="button"
          >
            블로그에서 가져오기
          </button>
          <button
            className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-sm"
            onClick={() => {
              setAddingBook(true);
              closeMenu();
            }}
            type="button"
          >
            책 등록
          </button>
          <button
            className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-2 text-left text-sm"
            onClick={() => {
              setSelected(null);
              setScheduleDate(null);
              setSiteOpen(true);
              closeMenu();
            }}
            type="button"
          >
            사이트 콘텐츠
          </button>
        </header>
        <TemplateGallery
          busy={busy}
          onCreate={(templateId, title, period) => {
            closeMenu();
            return create(templateId, title, period);
          }}
          templates={templates}
        />
        <DocumentList
          blogOnly={publishStatus?.blogOnly.length ?? 0}
          onImport={() => {
            setImporting(true);
            closeMenu();
          }}
          statusesLoading={publishStatusLoading && publishStatus === null}
          statuses={Object.fromEntries(
            (publishStatus?.documents ?? []).map((item) => [item.documentId, item.status]),
          )}
          documents={documents}
          onSelect={(id) => {
            setSiteOpen(false);
            setScheduleDate(null);
            closeMenu();
            // 일지는 불렛을 다루는 일일 로그 화면으로 연다. 원본은 그 화면에서 연다(NOR-240).
            const journalDate = journalDateOf(documents.find((document) => document.id === id));
            if (journalDate !== null) {
              setSelected(null);
              setDay(journalDate);
              return;
            }
            void selectDocument(id);
          }}
          problems={documentProblems}
          selectedId={selected?.id ?? null}
        />
        {trash.length > 0 ? (
          <TrashList items={trash} onChanged={() => void refresh()} onError={setError} />
        ) : null}
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
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
                    ...(isEnglishDraft(selected.source)
                      ? {}
                      : { onCreateTranslation: () => void translate(selected.id) }),
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
        ) : scheduleDate !== null ? (
          <SchedulePage
            // 다른 날짜로 열면 그 날짜에서 새로 시작한다.
            key={scheduleDate}
            initialDate={scheduleDate}
            onError={setError}
            today={today ?? scheduleDate}
          />
        ) : day ? (
          <DayPage
            date={day}
            isToday={day === today}
            onOpenSchedule={(date) => setScheduleDate(date)}
            onEditSource={
              journalIdOf(documents, day) === null
                ? undefined
                : () => {
                    const id = journalIdOf(documents, day);
                    if (id !== null) void selectDocument(id);
                  }
            }
            onCreateReview={createSuggestedReview}
            onDismissReviewSuggestion={() => setReviewSuggestion(null)}
            onError={setError}
            reviewSuggestion={reviewSuggestion}
          />
        ) : (
          <p className="p-8 text-sm text-muted">앱 달력을 불러오는 중입니다.</p>
        )}
      </main>
      <PublishToasts onMerged={refreshPublishStatus} />
    </div>
  );
}

/** 일지 문서의 날짜. 일지가 아니거나 제목이 날짜가 아니면 null. 일지의 제목은 그 날짜다. */
/** 공개 초안이 이미 영어면 영어판을 또 만들지 않는다. */
function isEnglishDraft(source: string): boolean {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(source)?.[1] ?? '';
  return /^lang:[ \t]*['"]?en['"]?[ \t]*$/mu.test(frontmatter);
}

function journalDateOf(document: DocumentSummary | undefined): string | null {
  if (document?.kind !== 'journal') return null;
  return /^\d{4}-\d{2}-\d{2}$/u.test(document.title) ? document.title : null;
}

function journalIdOf(documents: readonly DocumentSummary[], date: string): string | null {
  return documents.find((document) => journalDateOf(document) === date)?.id ?? null;
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
