import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const PATHS = fileURLToPath(new URL('../../deploy/oci/content-paths.regex', import.meta.url));
const patterns = readFileSync(PATHS, 'utf8')
  .split('\n')
  .filter((line) => line.trim() !== '')
  .map((line) => new RegExp(line, 'u'));
const allowed = (path: string) => patterns.some((pattern) => pattern.test(path));

describe('릴레이 허용 경로', () => {
  it('NOR-208 AC-2: 사이트 콘텐츠 JSON 을 받는다', () => {
    for (const path of [
      'apps/blog/src/content/profile.json',
      'apps/blog/src/content/experience/krafton-squall.json',
      'apps/blog/src/content/portfolio/blog-v4.json',
      'apps/blog/src/content/series/astro-guide.json',
    ])
      expect(allowed(path), path).toBe(true);
  });

  it('NOR-208 AC-2: 사이트 콘텐츠 자리의 다른 파일은 받지 않는다', () => {
    for (const path of [
      'apps/blog/src/content.config.ts',
      'apps/blog/src/content/schemas.ts',
      'apps/blog/src/content/profile.ts',
      'apps/blog/src/content/experience/nested/a.json',
      'apps/blog/src/content/portfolio/Upper.json',
      'apps/blog/src/content/series/.hidden.json',
      'apps/blog/src/content/series/a.json.ts',
      'apps/blog/src/content/experience/a.ts',
    ])
      expect(allowed(path), path).toBe(false);
  });
});
