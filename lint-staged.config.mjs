/**
 * @see https://github.com/lint-staged/lint-staged#configuration
 * @type {import("lint-staged").Config}
 */
export default {
  "*.{html,shtml}": ["html-validator --ignore-config=.w3c-ignore"],
  "*.{json,md}": ["prettier --write"],
  "*.{js,mjs}": ["eslint --fix", "prettier --write"],
  "*.css": ["stylelint --fix", "prettier --write"],
  "*.php": [
    "./include/sebastienkeroack/vendor/bin/phpcbf",
    "./include/sebastienkeroack/vendor/bin/phpcs",
  ],
};
