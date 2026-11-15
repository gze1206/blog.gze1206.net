import {
  bookCoverUrl,
  type DocumentProblem,
  type DocumentSummary,
  type PublishState,
} from './api.js';

/** 공개 초안의 발행 상태 표시(NOR-209 AC-4). */
const STATE_LABEL: Record<PublishState, { text: string; className: string }> = {
  published: { text: '발행됨', className: 'text-accent' },
  differs: { text: '블로그와 다름', className: 'text-notice-foreground' },
  unpublished: { text: '미발행', className: 'text-muted' },
  invalid: { text: '검사 실패', className: 'text-danger' },
};

interface Props {
  /** 문서 id 별 발행 상태. 아직 모르면 비어 있다. */
  readonly statuses?: Readonly<Record<string, PublishState>>;
  /** 블로그에만 있는 글의 수. */
  readonly blogOnly?: number;
  readonly onImport?: () => void;
  readonly documents: readonly DocumentSummary[];
  /** 읽지 못한 파일. 비어 있으면 아무것도 그리지 않는다. */
  readonly problems: readonly DocumentProblem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}

export function DocumentList({
  documents,
  problems,
  selectedId,
  onSelect,
  statuses = {},
  blogOnly = 0,
  onImport,
}: Props) {
  /*
    책이 하나도 없으면 표지 자리를 만들지 않는다. 책이 섞여 있을 때만 모든 줄이 같은 자리에서
    시작하도록 빈 자리를 둔다 — 책 줄만 밀려 있으면 목록의 왼쪽이 들쭉날쭉해 보인다.
  */
  const hasBooks = documents.some((document) => document.kind === 'book');

  return (
    <section aria-labelledby="documents-title" className="pt-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          id="documents-title"
          className="text-xs font-semibold tracking-[0.18em] text-muted uppercase"
        >
          Documents
        </h2>
        <span className="text-xs text-muted">{documents.length}</span>
      </div>
      {blogOnly > 0 ? (
        <p className="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-muted-strong">
          블로그에만 있는 글 {blogOnly}개{' '}
          {onImport ? (
            <button className="text-accent underline" onClick={onImport} type="button">
              가져오기
            </button>
          ) : null}
        </p>
      ) : null}
      <div className="grid gap-1">
        {documents.length === 0 ? (
          <p className="py-3 text-sm text-muted">아직 문서가 없습니다.</p>
        ) : null}
        {documents.map((document) => (
          <button
            aria-pressed={selectedId === document.id}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left hover:bg-surface-sunken aria-pressed:bg-border"
            key={document.id}
            onClick={() => onSelect(document.id)}
            type="button"
          >
            {hasBooks ? <Cover document={document} /> : null}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">{document.title}</span>
              <span className="block font-mono text-[11px] text-muted">
                {document.kind}
                <StateBadge state={statuses[document.id]} />
              </span>
            </span>
          </button>
        ))}
      </div>
      {problems.length > 0 ? (
        /*
         * 읽지 못한 파일을 조용히 감추지 않는다. 감추면 사용자는 파일이 사라진 줄 알고,
         * 목록에 없는 글을 다시 쓰기 시작한다(NOR-190).
         */
        <div className="mt-4 rounded-md border border-notice-foreground/30 bg-notice px-3 py-2">
          <p className="text-xs font-semibold text-notice-foreground">
            읽지 못한 파일 {problems.length}개
          </p>
          <ul className="mt-1 grid gap-1">
            {problems.map((problem) => (
              <li className="text-[11px] text-notice-foreground" key={problem.relativePath}>
                <span className="block font-mono break-all">{problem.relativePath}</span>
                <span className="block">{problem.message}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-notice-foreground">
            파일을 직접 고치면 다시 목록에 나타납니다.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function StateBadge({ state }: { readonly state: PublishState | undefined }) {
  if (state === undefined) return null;
  const label = STATE_LABEL[state];
  return <span className={`ml-2 font-sans ${label.className}`}>{label.text}</span>;
}

/**
 * 책 표지 (NOR-189).
 *
 * 표지를 못 구한 책이 흔하므로 빈 자리도 같은 크기로 남긴다 — 있는 줄과 없는 줄의 글자가
 * 어긋나면 목록이 들쭉날쭉해 보인다.
 */
function Cover({ document }: { readonly document: DocumentSummary }) {
  if (document.kind !== 'book') return <span className="h-9 w-6 flex-none" />;

  const url = document.cover === undefined ? null : bookCoverUrl(document.cover);
  if (url === null) {
    return (
      <span className="flex h-9 w-6 flex-none items-center justify-center rounded-[2px] border border-border bg-surface-sunken text-[9px] text-muted">
        {[...document.title][0] ?? '책'}
      </span>
    );
  }
  return (
    <img
      alt=""
      className="h-9 w-6 flex-none rounded-[2px] border border-border object-cover"
      src={url}
    />
  );
}
