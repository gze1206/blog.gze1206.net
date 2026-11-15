/**
 * 사이트 콘텐츠 폼의 칸 정의와 값 변환 (NOR-208 AC-7).
 *
 * 폼은 원본 JSON 의 사본을 고친다. 정의에 없는 필드는 건드리지 않으므로, 손으로 넣어 둔 값이 화면을
 * 거쳤다고 사라지지 않는다.
 */
import type { SiteCollection } from '../api.js';

export interface RowColumn {
  readonly key: string;
  readonly label: string;
  readonly optional?: boolean;
  readonly number?: boolean;
}

export type SiteField =
  | {
      readonly key: string;
      readonly label: string;
      readonly type: 'text' | 'textarea';
      readonly optional?: boolean;
    }
  | { readonly key: string; readonly label: string; readonly type: 'lines' | 'paragraphs' }
  | { readonly key: string; readonly label: string; readonly type: 'boolean' }
  | { readonly key: string; readonly label: string; readonly type: 'date' }
  | {
      readonly key: string;
      readonly label: string;
      readonly type: 'rows';
      readonly columns: readonly RowColumn[];
    };

export type Row = Record<string, string>;
export type FormValue = string | boolean | Row[];
type Data = Readonly<Record<string, unknown>>;

export const SITE_FIELDS: Record<SiteCollection, readonly SiteField[]> = {
  profile: [
    { key: 'name', label: '이름', type: 'text' },
    { key: 'headline', label: '직함', type: 'text' },
    { key: 'tagline', label: '홈 한 줄', type: 'text', optional: true },
    { key: 'introduction', label: '소개', type: 'textarea' },
    { key: 'skills', label: '기술(한 줄에 하나)', type: 'lines' },
    { key: 'about', label: '소개 페이지 문단(빈 줄로 구분)', type: 'paragraphs' },
    {
      key: 'links',
      label: '링크',
      type: 'rows',
      columns: [
        { key: 'label', label: '이름' },
        { key: 'url', label: '주소' },
        { key: 'handle', label: '계정', optional: true },
      ],
    },
  ],
  experience: [
    { key: 'organization', label: '회사', type: 'text' },
    { key: 'role', label: '역할', type: 'text' },
    { key: 'period', label: '기간', type: 'text' },
    { key: 'endDate', label: '끝난 날짜', type: 'date' },
    { key: 'highlights', label: '한 일(한 줄에 하나)', type: 'lines' },
    { key: 'visible', label: '공개', type: 'boolean' },
  ],
  portfolio: [
    { key: 'title', label: '제목', type: 'text' },
    { key: 'summary', label: '요약', type: 'textarea' },
    { key: 'role', label: '역할', type: 'text', optional: true },
    { key: 'period', label: '기간', type: 'text', optional: true },
    { key: 'stack', label: '기술(한 줄에 하나)', type: 'lines' },
    { key: 'highlights', label: '한 일(한 줄에 하나)', type: 'lines' },
    {
      key: 'links',
      label: '링크',
      type: 'rows',
      columns: [
        { key: 'repo', label: '저장소', optional: true },
        { key: 'demo', label: '데모', optional: true },
        { key: 'video', label: '영상', optional: true },
        { key: 'article', label: '글', optional: true },
      ],
    },
    {
      key: 'media',
      label: '이미지',
      type: 'rows',
      columns: [
        { key: 'src', label: '경로' },
        { key: 'alt', label: '대체 텍스트' },
        { key: 'width', label: '너비', number: true },
        { key: 'height', label: '높이', number: true },
        { key: 'caption', label: '설명', optional: true },
      ],
    },
    { key: 'thumbnail', label: '썸네일 경로', type: 'text', optional: true },
  ],
  series: [
    { key: 'name', label: '이름', type: 'text' },
    { key: 'slug', label: 'slug', type: 'text' },
    { key: 'description', label: '설명', type: 'textarea' },
  ],
};

const NEW_DATA: Record<SiteCollection, Data> = {
  profile: { name: '', headline: '', introduction: '', skills: [] },
  experience: { organization: '', role: '', period: '', highlights: [], visible: true },
  portfolio: { title: '', summary: '', stack: [] },
  series: { name: '', slug: '', description: '' },
};

export function newSiteData(collection: SiteCollection): Record<string, unknown> {
  return structuredClone(NEW_DATA[collection]) as Record<string, unknown>;
}

/** 데이터에서 칸에 보일 값을 꺼낸다. */
export function toFormValue(field: SiteField, data: Data): FormValue {
  const value = data[field.key];
  switch (field.type) {
    case 'boolean':
      return value === true;
    case 'lines':
      return Array.isArray(value) ? value.map(String).join('\n') : '';
    case 'paragraphs':
      return Array.isArray(value) ? value.map(String).join('\n\n') : '';
    case 'rows':
      return Array.isArray(value)
        ? value.map((item) => {
            const record = (item ?? {}) as Record<string, unknown>;
            // 원래 행을 함께 들고 다녀, 되돌려 쓸 때 화면에 없는 필드와 순서를 지킨다.
            const row: Row = { [ROW_SOURCE]: JSON.stringify(record) };
            for (const column of field.columns)
              row[column.key] = record[column.key] === undefined ? '' : String(record[column.key]);
            return row;
          })
        : [];
    default:
      return typeof value === 'string' ? value : '';
  }
}

/** 칸의 값을 데이터에 되돌려 쓴다. 비운 선택 칸은 키를 지운다. */
export function applyFormValue(
  data: Data,
  field: SiteField,
  value: FormValue,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data };
  switch (field.type) {
    case 'boolean':
      next[field.key] = value === true;
      return next;
    case 'lines':
      next[field.key] = String(value)
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '');
      return next;
    case 'paragraphs':
      next[field.key] = String(value)
        .split(/\n\s*\n/u)
        .map((paragraph) => paragraph.trim())
        .filter((paragraph) => paragraph !== '');
      return next;
    case 'rows': {
      const rows = Array.isArray(value) ? value : [];
      next[field.key] = rows.map((row) => {
        const item = parseRowSource(row[ROW_SOURCE]);
        for (const column of field.columns) {
          const cell = (row[column.key] ?? '').trim();
          if (cell === '' && column.optional) {
            Reflect.deleteProperty(item, column.key);
            continue;
          }
          item[column.key] = column.number && /^\d+$/u.test(cell) ? Number(cell) : cell;
        }
        return item;
      });
      return next;
    }
    case 'date': {
      const text = String(value).trim();
      if (text === '') next[field.key] = null;
      else next[field.key] = text;
      return next;
    }
    default: {
      const text = String(value);
      if (field.optional && text.trim() === '')
        return Object.fromEntries(Object.entries(next).filter(([key]) => key !== field.key));
      next[field.key] = text;
      return next;
    }
  }
}

/** 행에 원래 객체를 담아 두는 칸. 화면에는 보이지 않는다. */
const ROW_SOURCE = '\u0000source';

function parseRowSource(source: string | undefined): Record<string, unknown> {
  if (source === undefined) return {};
  try {
    const parsed: unknown = JSON.parse(source);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  } catch {
    return {};
  }
}

/** 행 목록에 넣을 빈 행. */
export function emptyRow(field: Extract<SiteField, { type: 'rows' }>): Row {
  return Object.fromEntries(field.columns.map((column) => [column.key, '']));
}
