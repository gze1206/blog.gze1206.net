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
