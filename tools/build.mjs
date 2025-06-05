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

import { exists } from "node:fs/promises";
import { basename, join } from "node:path";
import { Version } from "./version.mjs";
import { pack } from "./packer.mjs";

// Log build start time for debugging and monitoring purposes
console.log(`Build started at: ${new Date().toLocaleString()}`);

// Check if the source directory exists before proceeding
if (!(await exists(globalThis.path.srcDir)))
  throw new Error(
    `Source directory "${globalThis.path.srcDir}" does not exist.`,
  );

// Increment version numbers and update version.yaml and package.json
const version = await Version.load(globalThis.path.versionPath);
await version.bump();
await version.write(globalThis.path.versionPath, globalThis.path.packagePath);
console.log("Version updated to", version.toString());

// Check if the build should be forced based on CLI arguments
const force = process.argv.includes("--force");

// Run the packer to process assets and generate the build output
const srcPublicDir = globalThis.path.srcDir;
const outPublicDir = join(globalThis.path.outDir, basename(srcPublicDir));
await pack(srcPublicDir, outPublicDir, version, force);
