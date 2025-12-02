// @see https://eslint.org/docs/latest/use/configure/configuration-files
const { includeIgnoreFile } = require('@eslint/compat');
const { defineConfig } = require('eslint/config');
const js = require('@eslint/js');
const globals = require('globals');
const path = require('node:path');

const ignorePath = path.resolve(__dirname, '.prettierignore');

module.exports = defineConfig([
  includeIgnoreFile(ignorePath),
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, Bun: false },
    },
    plugins: { js },
    extends: ['js/recommended'],
  },
]);
