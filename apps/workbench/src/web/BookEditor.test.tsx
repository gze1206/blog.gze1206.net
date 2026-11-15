import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BookDialog } from './BookDialog.js';
import { BookEditor } from './BookEditor.js';

const document = {
  id: 'doc',
  label: 'books/니체의-초월자.md',
  title: '니체의 초월자',
  kind: 'book',
  updatedAt: '2026-11-15',
  source: '',
  book: {
    title: '니체의 초월자',
    authors: ['저자'],
    translators: ['옮긴이 하나', '옮긴이 둘'],
    status: 'finished' as const,
    format: 'paper' as const,
    source: 'purchase' as const,
    visible: true,
    content: '',
  },
};

describe('책 편집 화면', () => {
  it('NOR-204 AC-4: 역자 입력 칸과 표지 바꾸기 동작을 보여 준다', () => {
    const html = renderToStaticMarkup(
      <BookEditor
        document={document}
        onChanged={() => undefined}
        onEditSource={() => undefined}
        onError={() => undefined}
      />,
    );
    expect(html).toContain('역자');
    expect(html).toContain('value="옮긴이 하나, 옮긴이 둘"');
    expect(html).toContain('파일로 바꾸기');
    expect(html).toContain('ISBN 으로 찾기');
    expect(html).toContain('표지 지우기');
  });

  it('NOR-204 AC-5: 책 등록 대화상자에 역자 입력 칸이 있다', () => {
    const html = renderToStaticMarkup(
      <BookDialog onClose={() => undefined} onCreated={() => undefined} />,
    );
    expect(html).toContain('역자');
  });
});

it('NOR-212 AC-2: 책 편집 화면은 파일 이름을 내보내기 id 로 쓴다', async () => {
  const mod = await import('./bookExportId.js');
  expect(mod).toHaveProperty('bookExportId');
  expect(
    mod.bookExportId({
      label: '니체의-초월자',
      book: { isbn13: '9791192559100', title: '바뀐 제목' },
    }),
  ).toBe('니체의-초월자');
});

it('NOR-215 AC-5: 책 편집 화면은 공개 구절 목록과 누적 글자 수를 보여 준다', () => {
  const html = renderToStaticMarkup(
    <BookEditor
      document={{
        ...document,
        excerpts: [
          { id: '01J00000000000000000000001', text: '공개한 문장', public: true, page: 3 },
          { id: '01J00000000000000000000002', text: '숨긴 문장', public: false },
        ],
      }}
      onChanged={() => undefined}
      onEditSource={() => undefined}
      onError={() => undefined}
    />,
  );
  expect(html).toContain('공개 구절');
  expect(html).toContain('6 / 2,000자');
  expect(html).toContain('p. 3');
});

it('NOR-206 AC-5: 문서 편집기는 편집·나란히·미리보기 전환을 둔다', async () => {
  const { Editor } = await import('./Editor.js');
  const html = renderToStaticMarkup(
    <Editor
      dirty={false}
      onChange={() => undefined}
      onSave={() => undefined}
      saving={false}
      source="# 제목"
      title="글"
    />,
  );
  for (const label of ['편집', '나란히', '미리보기']) expect(html).toContain(`>${label}</button>`);
});

it('NOR-206 AC-9: 문서 편집기에는 서식 도구 막대가 있다', async () => {
  const { Editor } = await import('./Editor.js');
  const html = renderToStaticMarkup(
    <Editor
      dirty={false}
      onChange={() => undefined}
      onSave={() => undefined}
      saving={false}
      source="# 제목"
      title="글"
    />,
  );
  expect(html).toContain('aria-label="서식"');
  for (const label of ['굵게', '기울임', '제목', '목록', '인용', '코드', '링크'])
    expect(html).toContain(`aria-label="${label}"`);
});

it('NOR-209 AC-4: 문서 목록은 공개 초안의 발행 상태와 블로그에만 있는 글을 알린다', async () => {
  const { DocumentList } = await import('./DocumentList.js');
  const documents = [
    {
      id: 'a',
      relativePath: 'drafts/a.md',
      label: 'a',
      title: '발행한 글',
      kind: 'public-draft',
      updatedAt: '2026-08-12',
    },
    {
      id: 'b',
      relativePath: 'drafts/b.md',
      label: 'b',
      title: '고친 글',
      kind: 'public-draft',
      updatedAt: '2026-08-12',
    },
  ] as const;
  const html = renderToStaticMarkup(
    <DocumentList
      blogOnly={2}
      documents={documents as never}
      onImport={() => undefined}
      onSelect={() => undefined}
      problems={[]}
      selectedId={null}
      statuses={{ a: 'published', b: 'differs' }}
    />,
  );
  expect(html).toContain('발행됨');
  expect(html).toContain('블로그와 다름');
  expect(html).toContain('블로그에만 있는 글 2개');
});

const listDocs = [
  {
    id: 'p',
    relativePath: 'drafts/p.md',
    category: 'Programming',
    label: 'p',
    title: '발행한 글',
    kind: 'public-draft',
    updatedAt: '2026-08-12',
  },
  {
    id: 'd',
    relativePath: 'drafts/d.md',
    label: 'd',
    title: '쓰는 중',
    kind: 'public-draft',
    updatedAt: '2026-08-12',
  },
  {
    id: 'm',
    relativePath: 'inbox/m.md',
    label: 'm',
    title: '메모',
    kind: 'capture',
    updatedAt: '2026-08-12',
  },
] as const;

it('NOR-221 AC-1: 종류를 읽는 이름으로, 공개 초안은 발행 상태로 부른다', async () => {
  const { DocumentList } = await import('./DocumentList.js');
  const html = renderToStaticMarkup(
    <DocumentList
      documents={listDocs as never}
      onSelect={() => undefined}
      problems={[]}
      selectedId={null}
      statuses={{ p: 'published', d: 'unpublished' }}
    />,
  );
  expect(html).toContain('발행된 글');
  expect(html).toContain('공개 초안');
  expect(html).toContain('빠른 메모');
  expect(html).not.toContain('>public-draft<');
  const unknown = renderToStaticMarkup(
    <DocumentList
      documents={listDocs as never}
      onSelect={() => undefined}
      problems={[]}
      selectedId={null}
    />,
  );
  expect(unknown).toContain('공개 글');
});

it('NOR-221 AC-2: 문서 유형별로 묶고 블로그 글은 카테고리별로 한 번 더 묶는다', async () => {
  const { DocumentList } = await import('./DocumentList.js');
  const html = renderToStaticMarkup(
    <DocumentList
      documents={listDocs as never}
      onSelect={() => undefined}
      problems={[]}
      selectedId={null}
      statuses={{ p: 'published', d: 'unpublished' }}
    />,
  );
  expect(html).toContain('aria-label="블로그 글 2개"');
  expect(html).toContain('aria-label="Programming 1개"');
  expect(html).toContain('aria-label="카테고리 없음 1개"');
  expect(html).toContain('aria-label="메모 1개"');
  expect(html).not.toContain('aria-label="책');
  expect(html.indexOf('블로그 글')).toBeLessThan(html.indexOf('aria-label="메모'));
});

it('NOR-221 AC-3: 발행된 글의 편집기 머리는 발행 상태와 다시 발행 검토를 보인다', async () => {
  const { Editor } = await import('./Editor.js');
  const html = renderToStaticMarkup(
    <Editor
      dirty={false}
      onChange={() => undefined}
      onReviewPublish={() => undefined}
      onSave={() => undefined}
      publishState="published"
      saving={false}
      source="# 제목"
      title="글"
    />,
  );
  expect(html).toContain('블로그에 발행된 글');
  expect(html).toContain('다시 발행 검토');
});
