// @ts-check
// 저장소 공통 ESLint 베이스. 앱은 이것을 펼친 뒤 자기 플러그인을 덧붙인다.
import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export const base = [
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];

/** 포맷 규칙을 끈다. 항상 배열의 마지막에 둔다. */
export const prettierLast = prettier;
