/**
 * Increments the project version number and updates version files accordingly.
 * Loads the current version, bumps it and writes changes.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { Version } from './internal/version.mjs';

const version = await Version.load(globalThis.path.versionPath);
await version.bump();
await version.write(globalThis.path.versionPath, globalThis.path.packagePath);
console.log('Version bumped to', version.toString());
