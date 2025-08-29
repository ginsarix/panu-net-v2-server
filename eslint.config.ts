import * as eslint from '@eslint/js';
import pluginImport from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    ignores: ['**/dist/**', 'eslint.config.ts', 'wwwroot'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      import: pluginImport,
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      'import/extensions': [
        'error',
        'always',
        {
          js: 'always',
          ignorePackages: true,
        },
      ],
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      parserOptions: {
        project: undefined,
      },
    },
  },
);
