/**
 * Initializes and configures global project paths for the application.
 * Sets up a centralized PathManager instance to ensure consistent
 * access to important directories and files throughout the project lifecycle.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PathManager } from './path-manager.mjs';

globalThis.root = resolve(fileURLToPath(import.meta.url), '../../../..');
globalThis.path = new PathManager(globalThis.root);
