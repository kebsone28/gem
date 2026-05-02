module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: ['eslint:recommended'],
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['node_modules/**', 'dist/**'],
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    'no-console': 'off',
    'no-empty': 'warn',
    'no-useless-escape': 'warn',
    'no-useless-catch': 'warn',
    'no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_|^err$|^error$',
      },
    ],
  },
};
