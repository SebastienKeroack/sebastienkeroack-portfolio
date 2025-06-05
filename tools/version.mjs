/**
 * Provides version management utilities for the project, including reading,
 * updating, and writing version information, as well as generating build
 * numbers and retrieving the latest Git commit hash. Designed to automate
 * versioning tasks for release and deployment workflows.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { $ } from "bun";

/**
 * Executes a Git command to retrieve the latest commit hash in short format.
 *
 * @returns {Promise<string>} The latest Git commit hash (short form).
 */
export async function execGetLastCommitHash() {
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
  // Use a regular expression to find and replace the version field.
  // This preserves the original formatting of the JSON.
  return json.replace(/("version"\s*:\s*")[^"]+(")/, `$1${version}$2`);
}

/**
 * Represents a semantic version with build and commit hash metadata.
 * Provides methods for loading, updating, and serializing version info.
 */
export class Version {
  #build = 0;
  #major = 0;
  #minor = 0;
  #revision = 0;
  #commitHash = "";

  /**
   * Constructs a Version instance with the provided fields.
   *
   * @param {Object} fields - Object containing version fields.
   * @param {number} fields.major - Major version number.
   * @param {number} fields.minor - Minor version number.
   * @param {number} fields.build - Build number.
   * @param {number} fields.revision - Revision number.
   * @param {string} fields.commitHash - Git commit hash.
   */
  constructor({ major, minor, build, revision, commitHash }) {
    this.#major = major;
    this.#minor = minor;
    this.#build = build;
    this.#revision = revision;
    this.#commitHash = commitHash;
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
   * Computes a build number based on the current date (YYDDD format).
   *
   * @param {Date} now - The current date.
   * @returns {number} The computed build number.
   */
  static computeBuildNumber(now) {
    // Get the full year (e.g., 2025).
    const fullYear = now.getFullYear();

    // Calculate the day of the year (1-366).
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(fullYear, 0, 0).getTime()) / 86400000,
    )
      .toString()
      .padStart(3, "0"); // Pad to 3 digits (001-366)

    // Get last 2 digits of the year (e.g., 2025 -> 25).
    const year = (fullYear % 100).toString().padStart(2, "0");

    // Combine year and day for a unique build number (e.g., 25151).
    return parseInt(`${year}${dayOfYear}`, 10);
  }

  /**
   * Extracts version fields from a YAML string.
   *
   * @param {string} yaml - The YAML string to parse.
   * @returns {Object} An object with major, minor, build, revision, commitHash.
   * @throws {Error} If any required field is missing.
   */
  static getFields(yaml) {
    // Use regex to match all fields (order agnostic).
    const fields = {};
    const mmbrMatch = yaml.matchAll(
      /^\s*(major|minor|build|revision):\s*(\d+)/gm,
    );
    const commitHashMatch = yaml.match(/^\s*commitHash:\s*([a-f\d]{7,})/m);

    // Populate fields object with matched values.
    for (const [, key, value] of mmbrMatch) fields[key] = parseInt(value, 10);
    if (commitHashMatch) fields.commitHash = commitHashMatch[1];
    // Ensure all required fields are present.
    for (const key of ["major", "minor", "build", "revision", "commitHash"])
      if (fields[key] === undefined)
        throw new Error(`Missing required field: ${key}`);
    return fields;
  }

  /**
   * Bumps the version by updating build and revision numbers, and commit hash.
   *
   * @param {Date} [now=new Date()] - The current date (optional).
   * @returns {Promise<void>} Resolves when the bump is complete.
   */
  async bump(now = new Date()) {
    // Start fetching the latest commit hash asynchronously.
    const commitHashPromise = execGetLastCommitHash();

    // Compute the next build and revision numbers.
    const { nextBuild, nextRevision } = this.computeNextBuildRevNumber(now);

    // Update internal state with new build, revision, and commit hash.
    this.#build = nextBuild;
    this.#revision = nextRevision;
    this.#commitHash = await commitHashPromise;
  }

  /**
   * Computes the next build and revision numbers based on the current date.
   *
   * @param {Date} now - The current date.
   * @returns {Object} Object with nextBuild and nextRevision numbers.
   */
  computeNextBuildRevNumber(now) {
    // Compute today's build number.
    const nextBuild = Version.computeBuildNumber(now);

    // If build number changed, reset revision; else, increment revision.
    const nextRevision = this.#build !== nextBuild ? 0 : this.#revision + 1;

    return { nextBuild, nextRevision };
  }

  /**
   * Returns the version as a string (e.g., 1.2.3-4+abcdef1).
   *
   * @returns {string} The version string.
   */
  toString() {
    const commitHash = this.#commitHash ? `+${this.#commitHash}` : "";
    return `${this.#major}.${this.#minor}.${this.#build}-${this.#revision}${commitHash}`;
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
      `build: ${this.#build}`,
      `revision: ${this.#revision}`,
      `commitHash: ${this.#commitHash}`,
    ].join("\n");
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
