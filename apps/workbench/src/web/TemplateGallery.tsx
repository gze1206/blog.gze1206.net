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
    <section aria-labelledby="templates-title" className="border-b border-stone-200 pb-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          id="templates-title"
          className="text-xs font-semibold tracking-[0.18em] text-stone-500 uppercase"
        >
          Templates
        </h2>
        <span className="text-xs text-stone-400">{templates.length}</span>
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
          placeholder="회고 기간 (주간 YYYY-Www / 월간 YYYY-MM)"
          value={period}
        />
        {periodError ? (
          <p className="text-xs text-red-700" role="alert">
            {periodError}
          </p>
        ) : null}
      </div>
      <div className="grid gap-2">
        {templates.map((template) => (
          <button
            className="group rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-left transition hover:border-stone-400 disabled:opacity-50"
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
            <span className="block text-sm font-medium text-stone-800">{template.title}</span>
            <span className="mt-0.5 block font-mono text-[11px] text-stone-400 group-hover:text-stone-600">
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
