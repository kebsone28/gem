// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([globalIgnores([
  'dist',
  'src/components/map/**',
  'src/pages/MapDemo.tsx',
  'src/services/cache/**',
  'src/services/cluster/**',
  'src/services/households/useHouseholdSync.ts',
]), {
  linterOptions: {
    reportUnusedDisableDirectives: false,
  },
  files: ['**/*.{ts,tsx}'],
  extends: [
    js.configs.recommended,
    tseslint.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    ecmaVersion: 2020,
    globals: globals.browser,
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'no-inline-styles': 'off',
    'jsx-a11y/aria-proptypes': 'off',
    'react/no-unknown-property': 'off',
    'react-inline-styles/no-inline-styles': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/set-state-in-effect': 'off',
    // provide fallbacks for project-specific custom rules that may not be installed
    'no-inline-styles/no-inline-styles': 'off',
    'react-refresh/only-export-components': 'off',
  },
}, ...storybook.configs["flat/recommended"]])
