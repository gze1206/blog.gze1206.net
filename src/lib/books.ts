/**
 * 읽은 책 목록의 공개 경계와 정렬 (NOR-153).
 *
 * 화면은 여기서 나온 것을 그리기만 한다 — 무엇을 감추고 어떤 순서로 보일지는 한 곳에서만
 * 정한다. 상세 독서 메모는 이 저장소에 오지 않는다(워크벤치에 비공개로 남는다).
 */
import type { CollectionEntry } from 'astro:content';

export type BookStatus = 'reading' | 'finished' | 'abandoned' | 'want';

export interface BookLike {
  readonly id: string;
  readonly data: {
    readonly title: string;
    readonly status: BookStatus;
    readonly startedAt?: Date | undefined;
    readonly finishedAt?: Date | undefined;
    readonly visible: boolean;
  };
}

/** 목록에서 위에 놓을 순서. 읽는 중이 먼저, 그다음은 최근에 손을 뗀 것부터. */
const STATUS_ORDER: Record<BookStatus, number> = {
  reading: 0,
  finished: 1,
  abandoned: 2,
  want: 3,
};

/** 그 책을 어느 해의 기록으로 볼지. 다 읽은 해가 없으면 시작한 해로 센다. */
export function bookYear(book: BookLike): number | null {
  const date = book.data.finishedAt ?? book.data.startedAt;
  return date === undefined ? null : date.getFullYear();
}

/**
 * 공개할 책만 남기고 정렬한다.
 *
 * 같은 상태 안에서는 날짜 내림차순, 날짜가 없으면 제목순이다 — 날짜 없는 항목이 목록 위에서
 * 순서가 흔들리지 않게 한다.
 */
export function selectVisibleBooks<T extends BookLike>(books: readonly T[]): T[] {
  return books
    .filter((book) => book.data.visible)
    .sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.data.status] - STATUS_ORDER[b.data.status];
      if (statusDiff !== 0) return statusDiff;

      const aDate = (a.data.finishedAt ?? a.data.startedAt)?.getTime();
      const bDate = (b.data.finishedAt ?? b.data.startedAt)?.getTime();
      if (aDate !== bDate) {
        if (aDate === undefined) return 1;
        if (bDate === undefined) return -1;
        return bDate - aDate;
      }

      return a.data.title.localeCompare(b.data.title, 'ko');
    });
}

/** 연도별로 묶는다. 연도를 알 수 없는 책은 `null` 그룹으로 맨 뒤에 둔다. */
export function groupBooksByYear<T extends BookLike>(
  books: readonly T[],
): { readonly year: number | null; readonly books: readonly T[] }[] {
  const groups = new Map<number | null, T[]>();

  for (const book of selectVisibleBooks(books)) {
    const year = bookYear(book);
    const bucket = groups.get(year);
    if (bucket === undefined) groups.set(year, [book]);
    else bucket.push(book);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === null) return 1;
      if (right === null) return -1;
      return right - left;
    })
    .map(([year, entries]) => ({ year, books: entries }));
}

/** 정적 사이트에 공개할 책 목록. */
export async function getVisibleBooks(): Promise<CollectionEntry<'books'>[]> {
  const { getCollection } = await import('astro:content');
  return selectVisibleBooks(await getCollection('books'));
}
