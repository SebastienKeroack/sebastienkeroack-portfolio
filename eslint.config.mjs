import { includeIgnoreFile } from "@eslint/compat";
import { defineConfig } from "eslint/config";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import globals from "globals";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ignorePath = path.resolve(__dirname, ".prettierignore");

/**
 * @see https://eslint.org/docs/latest/use/configure/configuration-files
 * @type {import("eslint").Config}
 */
export default defineConfig([
  includeIgnoreFile(ignorePath),
  { files: ["**/*.{js,mjs}"], languageOptions: { globals: globals.browser } },
  { files: ["**/*.{js,mjs}"], plugins: { js }, extends: ["js/recommended"] },
]);
