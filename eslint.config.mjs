// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginAstro from 'eslint-plugin-astro';
export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  ...eslintPluginAstro.configs.recommended,
  ...eslintPluginAstro.configs['jsx-a11y-recommended'],
  {
    // 루트 설정 파일(.mjs)은 빌드 중 Node 에서 실행된다. Node 전역을 인정해 준다.
    files: ['*.mjs'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly' },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: ['dist/', '.astro/', 'node_modules/', 'public/pagefind/'],
  },
);
