## Project TODOs

- **Set up a CI/CD pipeline**  
  Automate the build, distribution, and publishing process to WHC.

- **Inline the "theme-quick-init.js" script**  
  Use SSI (Server Side Includes) to inline this script for better performance.

- **Migrate JavaScript files in "core/bun" to TypeScript**  
  Convert existing JavaScript files in the `core/bun` directory to TypeScript for improved type safety and maintainability.

- **Refactor CSS for \<main\>**  
  Move the CSS rules that target the `<main>` element from each imported stylesheet into an inlined CSS block inside the `<head>` of the page that imports it.

- **Obfuscate CSS**  
  Make the CSS harder to read to help protect your styles.

- **Create a CSS sprite**  
  Combine multiple small images into a single CSS sprite to reduce HTTP requests and improve loading performance.

- **Add more unit tests for JavaScript and PHP**  
  Increase test coverage by writing additional unit tests for both JavaScript and PHP code.

- **Create a benchmark for page loading time post build**  
  Measure and record the loading time of pages post build to monitor and improve performance.

- **Generate web documentation from source code comments**  
  Use appropriate npm and PHP packages to automatically generate web-based documentation.

- **Add an offline html validator**  
  Use appropriate npm packages to validate html file without relying on online tools.

- **Redact sensitive parameters in PHP stack traces**  
  Use the `#[SensitiveParameter]` attribute for parameters like `SMTP_PASSWORD`, `RECAPTCHA_SECRET_KEY`, and `PHPMAILER_LANG_DIR`.

- **Enable multi-root workspace in VSCode**  
  Move `node_modules`, `jsconfig.json`, `package.json`, and `bunfig.toml` inside the bun workspace.

- **Replace .husky with native Git hooks**  
  Remove the `.husky` npm package and use PowerShell and Bash scripts for Git hooks.

- **Expose a version variable**  
  Make a `version` variable accessible from both `php/bootstrap/init.php` and `public_html/assets/scripts/core.mjs`.

- **Reset revision on version change**  
  Reset the revision when the major, minor, or patch number changes by checking the version string.

- **Protect `.env` secret variables with OpenSSL**  
  When building the project, if the `.env` file is missing, use `.env.example` to generate a protected `.env` file. Prompt the user in the command line to fill in each variable.