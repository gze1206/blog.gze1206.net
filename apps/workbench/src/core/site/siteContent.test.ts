import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const BLOG_CONTENT = fileURLToPath(new URL('../../../../blog/src/content', import.meta.url));

async function site() {
  const mod = await import('./siteContent.js');
  expect(mod).toHaveProperty('planSiteChange');
  return mod;
}

describe('사이트 콘텐츠 계획', () => {
  it('NOR-208 AC-4: 자리는 컬렉션과 slug 로 정해지고, 프로필의 id 는 profile 뿐이다', async () => {
    const { sitePath } = await site();
    expect(sitePath('profile', 'profile')).toBe('apps/blog/src/content/profile.json');
    expect(sitePath('series', 'astro-guide')).toBe('apps/blog/src/content/series/astro-guide.json');
    for (const [collection, id] of [
      ['profile', 'other'],
      ['series', 'Upper'],
      ['portfolio', '../x'],
      ['experience', ''],
      ['posts', 'a'],
    ] as const)
      expect(() => sitePath(collection as never, id), `${collection}/${id}`).toThrow();
  });

  it('NOR-208 AC-4: 스키마에 맞지 않으면 필드별 오류를 돌려준다', async () => {
    const { validateSiteChange } = await site();
    const issues = validateSiteChange({
      collection: 'experience',
      id: 'company',
      data: { organization: '회사', period: '2020', highlights: [], visible: true },
    });
    expect(issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(['role', 'highlights']),
    );
    expect(
      validateSiteChange({ collection: 'profile', id: 'profile', delete: true }).map(
        (issue) => issue.path,
      ),
    ).toEqual(['']);
  });

  it('NOR-208 AC-4: 저장소의 사이트 콘텐츠 파일을 그대로 다시 쓰면 바뀌는 것이 없다(Prettier 형식)', async () => {
    const { formatSiteJson } = await site();
    const files = [
      path.join(BLOG_CONTENT, 'profile.json'),
      ...['experience', 'portfolio', 'series'].flatMap((dir) =>
        readdirSync(path.join(BLOG_CONTENT, dir))
          .filter((name) => name.endsWith('.json'))
          .map((name) => path.join(BLOG_CONTENT, dir, name)),
      ),
    ];
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(formatSiteJson(JSON.parse(source)), file).toBe(source);
    }
  });

  it('NOR-208 AC-4: 쓰기·삭제·변화 없음을 구분한다', async () => {
    const { planSiteChange } = await site();
    const current = '{\n  "name": "시리즈",\n  "slug": "a",\n  "description": "설명"\n}\n';
    const data = { name: '시리즈', slug: 'a', description: '설명' };
    expect(planSiteChange({ collection: 'series', id: 'a', data }, current).kind).toBe('noop');
    const write = planSiteChange(
      { collection: 'series', id: 'a', data: { ...data, description: '새 설명' } },
      current,
    );
    expect(write).toEqual({
      kind: 'write',
      path: 'apps/blog/src/content/series/a.json',
      content: '{\n  "name": "시리즈",\n  "slug": "a",\n  "description": "새 설명"\n}\n',
    });
    expect(planSiteChange({ collection: 'series', id: 'a', delete: true }, current)).toEqual({
      kind: 'delete',
      path: 'apps/blog/src/content/series/a.json',
    });
    expect(planSiteChange({ collection: 'series', id: 'a', delete: true }, null).kind).toBe('noop');
  });
});

describe('사이트 콘텐츠 검수 반영', () => {
  it('NOR-208 AC-8: 시리즈의 slug 는 파일 이름과 같아야 한다', async () => {
    const { validateSiteChange } = await site();
    const issues = validateSiteChange({
      collection: 'series',
      id: 'a',
      data: { name: 'n', slug: 'b', description: 'd' },
    });
    expect(issues.map((issue) => issue.path)).toEqual(['slug']);
  });

  it('NOR-208 AC-9: main 에 없던 스키마 밖 최상위 키는 받지 않는다', async () => {
    const mod = await site();
    expect(mod).toHaveProperty('unknownKeyIssues');
    const unknownKeyIssues = Reflect.get(mod, 'unknownKeyIssues') as (
      collection: string,
      data: Record<string, unknown>,
      current: string | null,
    ) => { path: string }[];
    const data = { title: 't', summary: 's', stack: ['a'], id: 'x', secret: 'memo' };
    expect(
      unknownKeyIssues('portfolio', data, '{"title":"t","id":"x"}').map((i) => i.path),
    ).toEqual(['secret']);
    expect(unknownKeyIssues('portfolio', data, null).map((i) => i.path)).toEqual(['id', 'secret']);
  });
});

describe('이름 바꾸기', () => {
  it('NOR-220 AC-1: 경력·포트폴리오만, 다른 slug 로만 이름을 바꾼다', async () => {
    const { validateSiteChange } = await site();
    const data = { title: 't', summary: 's', stack: ['a'] };
    const issues = (change: Record<string, unknown>) =>
      validateSiteChange(change as never).map((issue) => issue.path);
    expect(
      issues({ collection: 'portfolio', id: 'boss-toss', renameFrom: 'blog-v4', data }),
    ).toEqual([]);
    expect(
      issues({
        collection: 'series',
        id: 'b',
        renameFrom: 'a',
        data: { name: 'n', slug: 'b', description: 'd' },
      }),
    ).toEqual(['renameFrom']);
    expect(issues({ collection: 'portfolio', id: 'a', renameFrom: 'a', data })).toEqual([
      'renameFrom',
    ]);
    expect(issues({ collection: 'portfolio', id: 'a', renameFrom: 'Bad Name', data })).toEqual([
      'renameFrom',
    ]);
    expect(issues({ collection: 'portfolio', id: 'a', renameFrom: 'b', delete: true })).toEqual([
      'renameFrom',
    ]);
  });
});
