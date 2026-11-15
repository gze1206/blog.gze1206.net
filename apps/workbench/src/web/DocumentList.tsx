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
  // draft: true 인 글. 블로그에 올라가 있어도 보이지 않는다(NOR-227).
  draft: { text: '비공개 초안', className: 'text-muted' },
};

/** 문서 종류의 읽는 이름(NOR-221). */
const KIND_LABEL: Record<string, string> = {
  capture: '빠른 메모',
  journal: '일지',
  note: '노트',
  'private-post': '비공개 글',
  'public-draft': '공개 글',
  'weekly-review': '주간 회고',
  'monthly-review': '월간 회고',
  book: '책',
};

/** 문서 유형 묶음(NOR-221 AC-2). 블로그 글은 그 안에서 카테고리별로 다시 묶는다. */
const TYPE_GROUPS: readonly { key: string; label: string; kinds: readonly string[] }[] = [
  { key: 'blog', label: '블로그 글', kinds: ['public-draft'] },
  { key: 'private', label: '비공개 글', kinds: ['private-post'] },
  { key: 'memo', label: '메모', kinds: ['capture', 'note'] },
  { key: 'review', label: '회고', kinds: ['weekly-review', 'monthly-review'] },
  { key: 'journal', label: '일지', kinds: ['journal'] },
  { key: 'book', label: '책', kinds: ['book'] },
];

const NO_CATEGORY = '카테고리 없음';

/** 블로그 글을 카테고리별로 나눈다. 이름 순이고, 카테고리 없음은 맨 끝이다. */
function byCategory(documents: readonly DocumentSummary[]): [string, DocumentSummary[]][] {
  const map = new Map<string, DocumentSummary[]>();
  for (const document of documents) {
    const key = document.category?.trim() || NO_CATEGORY;
    map.set(key, [...(map.get(key) ?? []), document]);
  }
  return [...map].sort(([left], [right]) =>
    left === NO_CATEGORY ? 1 : right === NO_CATEGORY ? -1 : left.localeCompare(right),
  );
}

/** 접고 펼 수 있는 묶음. 처음에는 펼쳐 둔다. */
function Group({
  label,
  count,
  nested = false,
  children,
}: {
  readonly label: string;
  readonly count: number;
  readonly nested?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <details
      aria-label={`${label} ${count}개`}
      className={`group ${nested ? 'ml-2' : ''}`}
      open
      role="group"
    >
      <summary
        className={`flex cursor-pointer items-baseline justify-between rounded px-2 py-1 hover:bg-surface-sunken ${
          nested ? 'text-[11px] text-muted' : 'text-xs font-semibold text-muted-strong'
        }`}
      >
        <span>
          <span
            aria-hidden="true"
            className="mr-1 inline-block -rotate-90 transition-transform group-open:rotate-0"
          >
            ▾
          </span>
          {label}
        </span>
        <span className="font-normal text-muted">{count}</span>
      </summary>
      <div className="mt-1 grid gap-1">{children}</div>
    </details>
  );
}

/** 블로그에 나가 있는(발행됨·블로그와 다름) 공개 글인가. */
function isPublished(state: PublishState | undefined): boolean {
  return state === 'published' || state === 'differs';
}

/** 목록에 보일 종류 이름. 공개 글은 블로그와 비교한 상태로 부른다. */
function kindLabel(document: DocumentSummary, state: PublishState | undefined): string {
  if (document.kind === 'public-draft' && state !== undefined)
    return isPublished(state) ? '발행된 글' : '공개 초안';
  return KIND_LABEL[document.kind] ?? document.kind;
}

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
  // 문서 유형별로 묶고, 블로그 글은 카테고리별로 한 번 더 묶는다(NOR-221 AC-2).
  const groups = TYPE_GROUPS.map((group) => ({
    ...group,
    items: documents.filter((document) => group.kinds.includes(document.kind)),
  }))
    .concat([
      {
        key: 'other',
        label: '기타',
        kinds: [],
        items: documents.filter(
          (document) => !TYPE_GROUPS.some((group) => group.kinds.includes(document.kind)),
        ),
      },
    ])
    .filter((group) => group.items.length > 0);
  const row = (document: DocumentSummary) => (
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
        <span className="block text-[11px] text-muted">
          {kindLabel(document, statuses[document.id])}
          <StateBadge state={statuses[document.id]} />
        </span>
      </span>
    </button>
  );

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
      {documents.length === 0 ? (
        <p className="py-3 text-sm text-muted">아직 문서가 없습니다.</p>
      ) : (
        <div className="grid gap-2">
          {groups.map((group) => (
            <Group key={group.key} label={group.label} count={group.items.length}>
              {group.key === 'blog'
                ? byCategory(group.items).map(([category, items]) => (
                    <Group count={items.length} key={category} label={category} nested>
                      {items.map(row)}
                    </Group>
                  ))
                : group.items.map(row)}
            </Group>
          ))}
        </div>
      )}
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
