import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

it('NOR-208 AC-6: 사이트 콘텐츠 목록은 컬렉션별로 묶고 새 항목을 만들 수 있다', async () => {
  const mod = await import('./SiteContent.js');
  expect(mod).toHaveProperty('SiteList');
  const html = renderToStaticMarkup(
    <mod.SiteList
      entries={[
        { collection: 'profile', id: 'profile', data: { name: '이름' } },
        { collection: 'series', id: 'a', data: { name: '시리즈 A' } },
      ]}
      onCreate={() => undefined}
      onSelect={() => undefined}
      selected={null}
    />,
  );
  for (const heading of ['프로필', '경력', '포트폴리오', '시리즈']) expect(html).toContain(heading);
  expect(html).toContain('시리즈 A');
  expect(html).toContain('aria-label="새 경력"');
  expect(html).not.toContain('aria-label="새 프로필"');
});

it('NOR-208 AC-7: 항목 폼은 칸과 검토 버튼을 보인다', async () => {
  const mod = await import('./SiteContent.js');
  expect(mod).toHaveProperty('SiteForm');
  const html = renderToStaticMarkup(
    <mod.SiteForm
      collection="profile"
      data={{ name: '이름', headline: '직함', introduction: '소개', skills: ['C#'], links: [] }}
      onChange={() => undefined}
    />,
  );
  for (const label of ['이름', '직함', '소개', '기술', '링크']) expect(html).toContain(label);
  expect(html).toContain('C#');
});

it('NOR-219 AC-1: 칸은 입력한 글(빈 줄·끝 공백)을 그대로 보인다', async () => {
  const mod = await import('./SiteContent.js');
  const html = renderToStaticMarkup(
    <mod.SiteForm
      collection="profile"
      data={{ name: '이름 ', headline: '직함', introduction: '소개', skills: ['C#'], links: [] }}
      drafts={{ name: '이름 ', skills: 'C#\n\n', about: '첫 문단\n\n' }}
      onChange={() => undefined}
    />,
  );
  expect(html).toContain('value="이름 "');
  expect(html).toContain('>C#\n\n</textarea>');
  expect(html).toContain('>첫 문단\n\n</textarea>');
});

it('NOR-219 AC-5: 포트폴리오 폼은 이미지 행과 썸네일에 올리기와 미리보기를 둔다', async () => {
  const mod = await import('./SiteContent.js');
  const html = renderToStaticMarkup(
    <mod.SiteForm
      collection="portfolio"
      data={{
        title: '작업',
        summary: '요약',
        stack: ['C#'],
        media: [{ src: '/img/portfolio/a-12345678.png', alt: '화면', width: 2, height: 3 }],
        thumbnail: '/img/portfolio/a-12345678.png',
      }}
      onChange={() => undefined}
    />,
  );
  expect(html).toContain('aria-label="이미지 1 파일"');
  expect(html).toContain('aria-label="썸네일 파일"');
  expect(html).toContain('alt="이미지 1 미리보기"');
  expect(html).toContain('src="/api/site/images/a-12345678.png"');
});

it('NOR-220 AC-3: 경력·포트폴리오는 기존 항목도 파일 이름을 고치고, 시리즈는 새 항목만 고친다', async () => {
  const mod = await import('./SiteContent.js');
  expect(mod).toHaveProperty('FileNameField');
  const FileNameField = Reflect.get(mod, 'FileNameField') as (props: {
    collection: string;
    isNew: boolean;
    value: string;
    onChange: (value: string) => void;
  }) => React.ReactElement | null;
  const render = (collection: string, isNew: boolean) =>
    renderToStaticMarkup(
      <FileNameField collection={collection} isNew={isNew} onChange={() => undefined} value="a" />,
    );
  expect(render('portfolio', false)).toContain('파일 이름');
  expect(render('experience', false)).toContain('파일 이름');
  expect(render('series', false)).toBe('');
  expect(render('series', true)).toContain('파일 이름');
  expect(render('profile', false)).toBe('');
});
