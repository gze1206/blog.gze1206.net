import { fields } from '@keystatic/core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

type CheckboxArguments = Parameters<typeof fields.checkbox>[0];
type TextArguments = Parameters<typeof fields.text>[0];

const captured = vi.hoisted(() => ({
  checkboxArguments: [] as CheckboxArguments[],
  textArguments: [] as TextArguments[],
}));

vi.mock('@keystatic/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@keystatic/core')>();

  return {
    ...actual,
    fields: {
      ...actual.fields,
      checkbox: (arguments_: CheckboxArguments) => {
        captured.checkboxArguments.push(arguments_);
        return actual.fields.checkbox(arguments_);
      },
      text: (arguments_: TextArguments) => {
        captured.textArguments.push(arguments_);
        return actual.fields.text(arguments_);
      },
    },
  };
});

let cmsConfig: typeof import('./keystatic.config').default;

beforeAll(async () => {
  ({ default: cmsConfig } = await import('./keystatic.config'));
});

describe('Keystatic profile and experience configuration', () => {
  it('소개 singleton과 JSON 경력 컬렉션을 제공한다', () => {
    expect(cmsConfig.singletons?.profile).toMatchObject({
      label: '소개',
      path: 'src/content/profile',
      format: { data: 'json' },
    });
    expect(cmsConfig.collections?.experience).toMatchObject({
      label: '경력',
      path: 'src/content/experience/*',
      format: { data: 'json' },
    });
  });

  it('새 경력은 비공개를 기본값으로 저장한다', () => {
    expect(captured.checkboxArguments).toContainEqual(
      expect.objectContaining({ label: '공개', defaultValue: false }),
    );
  });

  it('소개 기술 항목은 빈 값으로 저장할 수 없다', () => {
    expect(captured.textArguments).toContainEqual(
      expect.objectContaining({ label: '기술', validation: { isRequired: true } }),
    );
  });
});
