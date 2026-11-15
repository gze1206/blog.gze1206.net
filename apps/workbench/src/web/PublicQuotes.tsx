import { BOOK_QUOTE_TOTAL_LIMIT } from '@gze1206/content-contract';

interface Quote {
  readonly id?: string | undefined;
  readonly text: string;
  readonly page?: number | undefined;
  readonly public?: boolean | undefined;
}

interface Props {
  readonly excerpts: readonly Quote[];
  readonly title: string;
  readonly authors: readonly string[];
}

/**
 * 공개 구절 (NOR-215). 블로그 /books 에 이 모양으로 나간다. 누적 상한을 넘으면 내보내기가 거부되므로
 * 남은 분량을 함께 보여 준다. 저장하지 않은 공개 여부 변경은 문서를 다시 읽은 뒤 반영된다.
 */
export function PublicQuotes({ excerpts, title, authors }: Props) {
  const quotes = excerpts.filter((excerpt) => excerpt.public === true);
  const total = quotes.reduce((sum, quote) => sum + quote.text.length, 0);
  const over = total > BOOK_QUOTE_TOTAL_LIMIT;
  return (
    <section aria-labelledby="public-quotes-title" className="border-border mt-5 border-t pt-5">
      <div className="flex items-baseline justify-between">
        <h3 id="public-quotes-title" className="text-foreground text-sm font-semibold">
          {`공개 구절 ${quotes.length}`}
        </h3>
        <span className={over ? 'text-danger text-xs' : 'text-muted text-xs'}>
          {`${total.toLocaleString('ko-KR')} / ${BOOK_QUOTE_TOTAL_LIMIT.toLocaleString('ko-KR')}자${over ? ' — 상한을 넘어 내보낼 수 없습니다' : ''}`}
        </span>
      </div>
      {quotes.length === 0 ? (
        <p className="text-muted mt-2 text-sm">
          구절의 "공개" 를 켜면 블로그 읽은 책 페이지에 이렇게 보이고, 글에서 인용할 수 있습니다.
        </p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {quotes.map((quote, index) => (
            <li
              className="border-accent bg-surface-sunken rounded-r border-l-2 px-4 py-3"
              key={quote.id ?? index}
            >
              <blockquote className="text-body text-sm whitespace-pre-wrap">
                {quote.text}
              </blockquote>
              <p className="text-muted mt-1 text-xs">
                {`${quote.page === undefined ? '' : `p. ${quote.page} · `}${authors.join(', ')}, 『${title}』`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
