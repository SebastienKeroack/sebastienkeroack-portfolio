/**
 * Provides a centralized class for managing and resolving important project
 * directory and file paths. Ensures consistent access to source, output, and
 * configuration locations throughout the build and development process.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { join, relative } from "node:path";

/**
 * Centralizes path configuration for maintainability and consistency.
 */
export class PathManager {
  #root;
  #srcDir;
  #outDir;
  #versionPath;
  #packagePath;

  /**
   * @param {string} root - Project root directory path
   */
  constructor(root) {
    const relRoot = relative(globalThis.root, root);

    this.#root = relRoot;
    this.#srcDir = join(relRoot, "public_html");
    this.#outDir = join(relRoot, "dist");
    this.#versionPath = join(relRoot, "version.yaml");
    this.#packagePath = join(relRoot, "package.json");
  }

  /** @returns {string} Project root directory path */
  get root() {
    return this.#root;
  }

  /** @returns {string} Web root directory */
  get srcDir() {
    return this.#srcDir;
  }

  /** @returns {string} Output directory for built files */
  get outDir() {
    return this.#outDir;
  }

  /** @returns {string} Path to version.yaml file */
  get versionPath() {
    return this.#versionPath;
  }

  /** @returns {string} Path to package.json file */
  get packagePath() {
    return this.#packagePath;
  }
}
