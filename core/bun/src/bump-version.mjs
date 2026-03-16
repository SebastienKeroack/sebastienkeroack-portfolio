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

import { Version } from './internal/version.mjs';

const version = await Version.load(globalThis.path.versionPath);
await version.write(globalThis.path.versionPath, globalThis.path.packagePath);
console.log('Version synced to', version.toString());
