import { useState } from 'react';

import type { TemplateSummary } from './api.js';

interface Props {
  readonly templates: readonly TemplateSummary[];
  readonly busy: boolean;
  readonly onCreate: (templateId: string, title: string, period?: string) => Promise<void>;
}

export function TemplateGallery({ templates, busy, onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState('');
  const [periodError, setPeriodError] = useState<string | null>(null);

  return (
    <section aria-labelledby="templates-title" className="border-b border-border pb-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          id="templates-title"
          className="text-xs font-semibold tracking-[0.18em] text-muted uppercase"
        >
          Templates
        </h2>
        <span className="text-xs text-muted">{templates.length}</span>
      </div>
      <div className="mb-3 grid gap-2">
        <input
          aria-label="새 문서 제목"
          className="field"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="새 문서 제목"
          value={title}
        />
        <input
          aria-label="회고 기간"
          className="field"
          onChange={(event) => {
            setPeriod(event.target.value);
            setPeriodError(null);
          }}
          placeholder="회고 기간 (예: 2026-W45, 2026-11)"
          title="주간 YYYY-Www 또는 월간 YYYY-MM"
          value={period}
        />
        {periodError ? (
          <p className="text-xs text-danger" role="alert">
            {periodError}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        {templates.map((template) => (
          <button
            className="group rounded-lg border border-border bg-surface px-3 py-2.5 text-left transition hover:border-muted disabled:opacity-50"
            disabled={busy}
            key={template.id}
            onClick={() => {
              const normalizedPeriod = period.trim();
              const error = reviewPeriodError(template.kind, normalizedPeriod);
              setPeriodError(error);
              if (error) return;
              void onCreate(
                template.id,
                title.trim() || template.title,
                normalizedPeriod || undefined,
              );
            }}
            type="button"
          >
            <span className="block text-sm font-medium text-foreground">{template.title}</span>
            <span className="mt-0.5 block font-mono text-[11px] text-muted group-hover:text-muted-strong">
              {template.kind}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function reviewPeriodError(kind: string, period: string): string | null {
  if (kind === 'weekly-review' && !/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/u.test(period)) {
    return '주간 회고 기간을 YYYY-Www 형식(W01-W53)으로 입력하세요.';
  }
  if (kind === 'monthly-review' && !/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(period)) {
    return '월간 회고 기간을 YYYY-MM 형식(01-12)으로 입력하세요.';
  }
  return null;
}
