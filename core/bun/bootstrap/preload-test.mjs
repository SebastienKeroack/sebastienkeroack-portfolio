/**
 * Bootstraps the test environment by configuring temporary project paths and
 * ensuring required directories exist before running tests. This setup enables
 * isolated and consistent test execution.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { beforeAll } from 'bun:test';
import { accessSync, constants, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PathManager } from './path-manager.mjs';

globalThis.pathTemp = new PathManager(
  join(globalThis.root, '.cache', 'bun', 'test'),
);

beforeAll(() => {
  const rootTemp = globalThis.pathTemp.root;
  accessSync(globalThis.root, constants.R_OK | constants.W_OK);
  if (!existsSync(rootTemp)) mkdirSync(rootTemp, { recursive: true });
});
