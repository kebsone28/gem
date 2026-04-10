module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'eslint-local-rules.cjs', '*config.js', '*.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', 'local-rules'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // Custom Local Rules via eslint-plugin-local-rules
    'local-rules/no-tiny-text': 'error',
    'local-rules/flex-child-min-w-0': 'warn',
    'local-rules/icon-button-aria-label': 'warn',
    'local-rules/no-typos-jsx': 'error',
  },
};
