'use strict';

const js = require('@eslint/js');
const globals = require('globals');
const prettier = require('eslint-config-prettier');

module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },

  js.configs.recommended,

  {
    // The library itself: a classic-script IIFE. `module` is declared so the
    // CommonJS export tail (added for Node testability) lints cleanly.
    files: ['gesture-lib/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        module: 'writable',
        require: 'readonly',
      },
    },
    rules: {
      // Gesture check callbacks share a fixed (lm, history) signature; not every
      // gesture uses both parameters, so unused arguments are allowed.
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },

  {
    // Demo app: consumes the library and MediaPipe symbols loaded via CDN.
    files: ['demo-app/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        Pose: 'readonly',
        Camera: 'readonly',
        GestureLibrary: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },

  {
    // Node-side JavaScript: this config, unit tests and the benchmark harness.
    files: ['eslint.config.js', 'test/**/*.js', 'bench/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  // Turn off stylistic rules that Prettier owns.
  prettier,
];
