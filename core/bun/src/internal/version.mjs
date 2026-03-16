/**
 * Provides version management utilities for the project, using version.txt as
 * the source of truth and package.json as a synced consumer of that version.
 *
 * @author
 * Sébastien Kéroack <code@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

const VERSION_PATTERN =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function normalizeVersion(version) {
  const normalizedVersion = String(version).trim();

  if (!normalizedVersion) throw new Error('Missing version string');
  if (!VERSION_PATTERN.test(normalizedVersion))
    throw new Error(`Invalid version string: ${normalizedVersion}`);

  return normalizedVersion;
}

function getFirstVersionLine(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;
    return normalizeVersion(trimmedLine);
  }

  throw new Error('Missing version string');
}

/**
 * Replaces the "version" field in a JSON string with a new version value.
 *
 * @param {string} json - The JSON string to update.
 * @param {string} version - The new version string to insert.
 * @returns {string} The updated JSON string with the new version.
 */
export function replaceFieldVersionJson(json, version) {
  return json.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
}

/**
 * Replaces the first non-empty, non-comment line of version.txt.
 *
 * @param {string} text - The current version.txt contents.
 * @param {string} version - The normalized version string to write.
 * @returns {string} Updated version.txt contents with trailing newline.
 */
export function replaceVersionText(text, version) {
  const normalizedVersion = normalizeVersion(version);
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const versionLineIndex = lines.findIndex((line) => {
    const trimmedLine = line.trim();
    return trimmedLine && !trimmedLine.startsWith('#');
  });

  if (versionLineIndex === -1) return `${normalizedVersion}\n`;

  lines[versionLineIndex] = normalizedVersion;
  return `${lines.join('\n').replace(/\n*$/, '')}\n`;
}

/**
 * Represents a project version loaded from version.txt.
 */
export class Version {
  #value = '';

  /**
   * Constructs a Version instance with the provided version string.
   *
   * @param {string} version - Version string.
   */
  constructor(version) {
    this.#value = normalizeVersion(version);
  }

  /**
   * Loads version information from a version.txt file at the given path.
   *
   * @param {string} path - Path to the version.txt file.
   * @returns {Promise<Version>} A Version instance with the loaded version.
   */
  static async load(path) {
    return Bun.file(path)
      .text()
      .then((text) => new Version(Version.extract(text)));
  }

  /**
   * Extracts the version string from version.txt contents.
   *
   * @param {string} text - version.txt contents.
   * @returns {string} The normalized version string.
   */
  static extract(text) {
    return getFirstVersionLine(text);
  }

  /**
   * Normalizes a version string.
   *
   * @param {string} version - Version string.
   * @returns {string} The normalized version string.
   */
  static normalize(version) {
    return normalizeVersion(version);
  }

  /**
   * Returns the version as a string.
   *
   * @returns {string} The version string.
   */
  toString() {
    return this.#value;
  }

  /**
   * Writes the version to version.txt and package.json.
   *
   * @param {string} versionPath - Path to the version.txt file.
   * @param {string} packagePath - Path to the package.json file.
   * @returns {Promise<void>} Resolves when both files are written.
   */
  async write(versionPath, packagePath) {
    const [versionText, packageText] = await Promise.all([
      Bun.file(versionPath).text(),
      Bun.file(packagePath).text(),
    ]);

    await Promise.all([
      Bun.write(versionPath, replaceVersionText(versionText, this.#value)),
      Bun.write(packagePath, replaceFieldVersionJson(packageText, this.#value)),
    ]);
  }
}
