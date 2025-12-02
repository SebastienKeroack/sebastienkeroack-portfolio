/**
 * Centralized path management for project directories and files.
 * Provides a class to resolve and access important paths such as
 * source, output, and configuration files, ensuring consistency
 * throughout the build and development process.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { isAbsolute, join, relative, resolve } from 'node:path';

/**
 * Checks if an absolute path is within the global project root.
 *
 * @param {string} absPath - The absolute path to check.
 * @returns {boolean} True if absPath is inside globalThis.root.
 * @throws {Error} If globalThis.root is not set or absPath is not absolute.
 */
function isRelativeToRoot(absPath) {
  if (!globalThis.root) throw new Error('globalThis.root is not set');
  if (!isAbsolute(absPath)) throw new Error('absPath must be absolute');
  const rel = relative(globalThis.root, absPath);
  return !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Manages and resolves important project paths for maintainability.
 */
export class PathManager {
  #root;
  #srcDir;
  #outDir;
  #versionPath;
  #packagePath;

  /**
   * Initializes the PathManager with the given absolute root path.
   *
   * @param {string} absPath - Absolute path to the project root.
   * @throws {Error} If absPath is not within globalThis.root.
   */
  constructor(absPath) {
    if (!isRelativeToRoot(absPath))
      throw new Error('absPath must be inside globalThis.root');
    const relRoot = resolve(relative(process.cwd(), absPath));
    this.#root = relRoot;
    this.#srcDir = join(relRoot, 'core', 'public_html');
    this.#outDir = join(relRoot, 'dist');
    this.#versionPath = join(relRoot, 'version.yaml');
    this.#packagePath = join(relRoot, 'package.json');
  }

  /**
   * Gets the project root directory path.
   *
   * @returns {string} Project root directory path.
   */
  get root() {
    return this.#root;
  }

  /**
   * Gets the web root directory path.
   *
   * @returns {string} Web root directory.
   */
  get srcDir() {
    return this.#srcDir;
  }

  /**
   * Gets the output directory for built files.
   *
   * @returns {string} Output directory path.
   */
  get outDir() {
    return this.#outDir;
  }

  /**
   * Gets the path to the version.yaml file.
   *
   * @returns {string} Path to version.yaml.
   */
  get versionPath() {
    return this.#versionPath;
  }

  /**
   * Gets the path to the package.json file.
   *
   * @returns {string} Path to package.json.
   */
  get packagePath() {
    return this.#packagePath;
  }
}
