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
    // ── Local Design System Rules (warn only) ──
    'local-rules/no-tiny-text': 'warn',
    'local-rules/flex-child-min-w-0': 'warn',
    'local-rules/icon-button-aria-label': 'warn',
    'local-rules/no-typos-jsx': 'warn',

    // ── TypeScript: all downgraded to warn ──
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-unused-expressions': 'warn',
    '@typescript-eslint/no-empty-object-type': 'warn',
    '@typescript-eslint/no-unsafe-function-type': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-require-imports': 'warn',
    '@typescript-eslint/no-this-alias': 'warn',

    // ── Core ESLint: downgraded to warn ──
    'no-empty': 'warn',
    'no-useless-escape': 'warn',
    'no-useless-catch': 'warn',
    'no-prototype-builtins': 'warn',
    'no-undef': 'warn',
    'no-fallthrough': 'warn',
    'prefer-const': 'warn',
    'no-var': 'warn',

    // ── React Hooks ──
    'react-hooks/exhaustive-deps': 'warn',
    'react-hooks/preserve-manual-memoization': 'warn',

    // ── Other: off ──
    'react/no-unknown-property': 'off',
    'jsx-a11y/no-inline-styles': 'off',
    'no-inline-styles/no-inline-styles': 'off',
  },
};
