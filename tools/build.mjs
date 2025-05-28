/**
 * This script orchestrates the build process for the project. It increments
 * version numbers, validates source directories, and invokes the packer to
 * generate the output distribution and manifest files for deployment.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { incrementVersion } from "./bump-version.mjs";
import { pack } from "./packer.mjs";

console.log(`Build started at: ${new Date().toLocaleString()}`);

const root = resolve(fileURLToPath(import.meta.url), "../..");
const srcDir = "public_html";
const outDir = "dist";
const versionPath = "version.yaml";
const packagePath = "package.json";
const manifestPath = join(outDir, "manifest.json");

const paths = {
  root,
  srcDir,
  outDir,
  versionPath,
  packagePath,
  manifestPath,
};

if (!existsSync(paths.srcDir))
  throw new Error(`Source directory "${paths.srcDir}" does not exist.`);

const version = await incrementVersion(paths.versionPath, paths.packagePath);

const force = process.argv.includes("--force");
await pack(paths, version, force);
