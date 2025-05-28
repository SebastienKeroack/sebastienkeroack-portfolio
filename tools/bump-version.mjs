/**
 * This script automatically increments the build and revision numbers in
 * version.yaml and updates the version field in package.json. It generates
 * a new build number based on the current date and appends the latest Git
 * commit hash, ensuring version consistency across project files.
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

export async function incrementVersion(versionPath, packagePath) {
  const versionFile = Bun.file(versionPath).text();
  const packageFile = Bun.file(packagePath).text();

  // Get the new build number
  const now = new Date();
  const fullYear = now.getFullYear();
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(fullYear, 0, 0).getTime()) / 86400000,
  )
    .toString()
    .padStart(3, "0");
  const year = (fullYear % 100).toString().padStart(2, "0");
  const newBuild = parseInt(`${year}${dayOfYear}`, 10);

  // Wait for both file reads to complete
  let versionText, packageText;
  try {
    [versionText, packageText] = await Promise.all([versionFile, packageFile]);
  } catch (error) {
    console.error("Error reading version or package file:\n", error);
    throw error;
  }

  const getField = (field) => {
    const match = versionText.match(new RegExp(`${field}:\\s*(\\d+)`));
    if (!match) throw new Error(`Missing '${field}' in ${versionPath}`);
    return parseInt(match[1], 10);
  };
  const major = getField("major");
  const minor = getField("minor");
  const build = getField("build");
  const revision = getField("revision");
  const commitHash = (await $`git rev-parse --short HEAD"`.text()).trim();

  // Increment the revision if the build number has changed
  const newRevision = build !== newBuild ? 0 : revision + 1;

  // Update the version.yaml file
  versionText =
    [
      `major: ${major}`,
      `minor: ${minor}`,
      `build: ${newBuild}`,
      `revision: ${newRevision}`,
      `commitHash: ${commitHash}`,
    ].join("\n") + "\n";
  const versionNewFile = Bun.write(versionPath, versionText);

  // Update the package.json file
  const newVersion = `${major}.${minor}.${newBuild}-${newRevision}+${commitHash}`;
  packageText = packageText.replace(
    /("version"\s*:\s*")[^"]+(")/,
    `$1${newVersion}$2`,
  );
  const packageNewFile = Bun.write(packagePath, packageText);

  // Wait for both file writes to complete
  try {
    await Promise.all([versionNewFile, packageNewFile]);
  } catch (error) {
    console.error("Error writing version or package file:\n", error);
    throw error;
  }

  console.log("Version updated to", newVersion);
  return newVersion;
}
