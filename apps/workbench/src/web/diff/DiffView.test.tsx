import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

it('NOR-217 AC-3: 인라인 보기는 줄 종류별 색과 줄 번호, 보기 전환 버튼을 보인다', async () => {
  const mod = await import('./DiffView.js');
  expect(mod).toHaveProperty('DiffView');
  const html = renderToStaticMarkup(
    <mod.DiffView diff={'--- a/x\n+++ b/x\n@@ -1,2 +1,2 @@\n 같음\n-옛\n+새'} label="통합 diff" />,
  );
  expect(html).toContain('aria-label="통합 diff"');
  expect(html).toContain('diff-add');
  expect(html).toContain('diff-del');
  expect(html).toContain('diff-hunk');
  expect(html).toContain('>인라인</button>');
  expect(html).toContain('>나란히</button>');
  expect(html).toContain('+새');
});

it('NOR-217 AC-3: 글·책·사이트 콘텐츠 발행 검토가 DiffView 를 쓴다', async () => {
  const { readFile } = await import('node:fs/promises');
  for (const file of [
    '../PublishReview.tsx',
    '../BookPublishReview.tsx',
    '../site/SiteContent.tsx',
  ]) {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');
    expect(source, file).toContain('<DiffView');
  }
});
