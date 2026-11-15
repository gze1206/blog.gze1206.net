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
