/**
 * Syncs the project version from version.txt into other version consumers.
 * Loads the current version and writes normalized values back out.
 *
 * @author
 * Sébastien Kéroack <code@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { replaceVersionText, Version } from './internal/version.mjs';

const { versionPath, packagePath } = globalThis.path;
const version = await Version.load(versionPath);
const [versionText, packageJson] = await Promise.all([
  Bun.file(versionPath).text(),
  Bun.file(packagePath).json(),
]);

if (
  !packageJson ||
  typeof packageJson !== 'object' ||
  Array.isArray(packageJson)
)
  throw new Error('package.json must be a JSON object');
if (!Object.hasOwn(packageJson, 'version'))
  throw new Error('package.json must have a root version');

packageJson.version = version.toString();
await Promise.all([
  Bun.write(versionPath, replaceVersionText(versionText, version.toString())),
  Bun.write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`),
]);
console.log('Version synced to', version.toString());
