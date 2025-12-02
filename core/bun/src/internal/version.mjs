/**
 * Provides version management utilities for the project, including loading,
 * parsing, bumping, and serializing version information from YAML and JSON
 * files, as well as integrating Git commit hashes for build tracking.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { $ } from 'bun';

/**
 * Executes a Git command to retrieve the latest commit hash in short format.
 *
 * @returns {Promise<string>} The latest Git commit hash (short form).
 */
export async function execGetLastCommitID() {
  // Use Bun's $ template to run the Git command and get the commit hash.
  // The .trim() ensures no extra whitespace is included.
  return $`git rev-parse --short HEAD`.text().then((hash) => hash.trim());
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
 * Represents a project version, including major, minor, patch, revision,
 * and commitID fields. Provides methods for loading, bumping, serializing,
 * and writing version information.
 */
export class Version {
  #major = 0;
  #minor = 0;
  #patch = 0;
  #revision = 0;
  #commitID = '';

  /**
   * Constructs a Version instance with the provided fields.
   *
   * @param {Object} fields - Object containing version fields.
   * @param {number} fields.major - Major version number.
   * @param {number} fields.minor - Minor version number.
   * @param {number} fields.patch - Patch version number.
   * @param {number} fields.revision - Revision number.
   * @param {string} fields.commitID - Git commit hash.
   */
  constructor({ major, minor, patch, revision, commitID }) {
    this.#major = major;
    this.#minor = minor;
    this.#patch = patch;
    this.#revision = revision;
    this.#commitID = commitID;
  }

  /**
   * Loads version information from a YAML file at the given path.
   *
   * @param {string} path - Path to the YAML file.
   * @returns {Promise<Version>} A Version instance with loaded fields.
   */
  static async load(path) {
    // Read the file as text, then extract fields using getFields.
    return Bun.file(path)
      .text()
      .then((yaml) => new Version(Version.getFields(yaml)));
  }

  /**
   * Extracts version fields from a YAML string.
   *
   * @param {string} yaml - The YAML string to parse.
   * @returns {Object} An object with major, minor, patch, revision, commitID.
   * @throws {Error} If any required field is missing.
   */
  static getFields(yaml) {
    // Use regex to match all fields (order agnostic).
    const fields = {};
    const numFieldsMatch = yaml.matchAll(
      /^\s*(major|minor|patch|revision):\s*(\d+)/gm,
    );
    const commitIDMatch = yaml.match(/^\s*commitID:\s*([a-f\d]{7,})/m);

    // Populate fields object with matched values.
    for (const [, key, value] of numFieldsMatch)
      fields[key] = parseInt(value, 10);
    if (commitIDMatch) fields.commitID = commitIDMatch[1];
    // Ensure all required fields are present.
    for (const key of ['major', 'minor', 'patch', 'revision', 'commitID'])
      if (fields[key] === undefined)
        throw new Error(`Missing required field: ${key}`);
    return fields;
  }

  /**
   * Bumps the revision number and updates the commitID.
   *
   * @param {string|null} [nextCommitID=null] - The next commit hash.
   * @returns {Promise<void>} Resolves when the version is bumped.
   */
  async bump(nextCommitID = null) {
    nextCommitID ??= await execGetLastCommitID();
    this.#revision = this.computeNextRevisionNumber(nextCommitID);
    this.#commitID = nextCommitID;
  }

  /**
   * Computes the next revision number based on the commit hash.
   *
   * @param {string} nextCommitID - The next commit hash.
   * @returns {number} The next revision number.
   */
  computeNextRevisionNumber(nextCommitID) {
    const nextRevision =
      this.#commitID !== nextCommitID ? 0 : this.#revision + 1;
    return nextRevision;
  }

  /**
   * Returns the version as a string (e.g., 1.2.3-4+abcdef1).
   *
   * @returns {string} The version string.
   */
  toString() {
    const commitID = this.#commitID ? `+${this.#commitID}` : '';
    return `${this.#major}.${this.#minor}.${this.#patch}-${this.#revision}${commitID}`;
  }

  /**
   * Serializes the version fields to a YAML string.
   *
   * @returns {string} The YAML representation of the version.
   */
  toYAML() {
    return [
      `major: ${this.#major}`,
      `minor: ${this.#minor}`,
      `patch: ${this.#patch}`,
      `revision: ${this.#revision}`,
      `commitID: ${this.#commitID}`,
    ].join('\n');
  }

  /**
   * Writes the updated version information to YAML and JSON files.
   *
   * @param {string} versionPath - Path to the YAML version file.
   * @param {string} packagePath - Path to the JSON version file.
   * @returns {Promise<void>} Resolves when both files are written.
   */
  async write(versionPath, packagePath) {
    // Read package.json and update its version field.
    const newPackageJson = replaceFieldVersionJson(
      await Bun.file(packagePath).text(),
      this.toString(),
    );

    // Write both the YAML and updated JSON files in parallel.
    await Promise.all([
      Bun.write(versionPath, this.toYAML()),
      Bun.write(packagePath, newPackageJson),
    ]);
  }
}
