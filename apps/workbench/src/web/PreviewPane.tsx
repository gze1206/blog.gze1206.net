import { useEffect, useRef, useState } from 'react';

import { previewDocument } from './api.js';
import { highlightPreview } from './live/codeHighlight.js';

interface Props {
  readonly source: string;
  readonly className?: string;
}

/**
 * 문서 미리보기 (NOR-206). 서버가 블로그와 같은 Markdoc 문법으로 렌더한 HTML 을 보여 준다.
 * 입력이 멈추면(400ms) 다시 그린다. HTML 은 Markdoc 이 이스케이프하고 주소는 서버가 거른다.
 */
export function PreviewPane({ source, className = '' }: Props) {
  const [html, setHtml] = useState('');
  const [warnings, setWarnings] = useState<readonly string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);

  // 서버 HTML 의 코드 블록에 편집기와 같은 강조를 입힌다(NOR-229).
  useEffect(() => {
    if (body.current) void highlightPreview(body.current);
  }, [html]);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      previewDocument(source)
        .then((result) => {
          if (!active) return;
          setHtml(result.html);
          setWarnings(result.warnings);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (active)
            setError(caught instanceof Error ? caught.message : '미리보기를 만들지 못했습니다.');
        });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [source]);

  return (
    <section
      aria-label="미리보기"
      className={`min-h-0 overflow-y-auto bg-surface px-4 py-6 md:px-8 ${className}`}
    >
      {error ? (
        <p className="text-danger text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="border-notice-foreground/30 bg-notice text-notice-foreground mb-4 rounded-md border px-4 py-2 text-xs">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <div className="preview" dangerouslySetInnerHTML={{ __html: html }} ref={body} />
    </section>
  );
}
