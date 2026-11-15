import { readFileSync } from 'node:fs';
import { BLOG_LAYOUT } from '@gze1206/content-contract';
import { expect, it } from 'vitest';

const read = (file: string) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');

it('NOR-199 AC-3: 배포 형상의 발행 브랜치 기본값은 main 이다', () => {
  expect(read('docker-compose.yml')).toContain("PUBLIC_BLOG_BRANCH: '${PUBLIC_BLOG_BRANCH:-main}'");
  expect(read('.env.example')).toMatch(/^PUBLIC_BLOG_BRANCH=main$/m);
  const fixture = read('e2e/fixture-server.ts');
  expect(fixture).not.toMatch(/'v4'/);
  expect(fixture).toContain('BLOG_LAYOUT.publishBranch');
  expect(BLOG_LAYOUT.publishBranch).toBe('main');
});
