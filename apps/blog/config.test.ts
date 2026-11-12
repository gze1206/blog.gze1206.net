import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

describe('blog TypeScript configuration', () => {
  it('NOR-197 AC-8: 블로그 tsconfig 는 저장소 기준의 엄격 옵션을 켜고 baseUrl 이 없다', () => {
    const text = readFileSync(new URL('./tsconfig.json', import.meta.url), 'utf8');
    const parsed = ts.parseConfigFileTextToJson('tsconfig.json', text);
    expect(parsed.error).toBeUndefined();
    expect(parsed.config.compilerOptions).toMatchObject({
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
    });
    expect(parsed.config.compilerOptions).not.toHaveProperty('baseUrl');
  });
});
