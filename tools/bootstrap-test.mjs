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
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { beforeAll } from "bun:test";
import { exists, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PathManager } from "./path-manager.mjs";
import "./bootstrap.mjs";

globalThis.pathTemp = new PathManager(join(globalThis.path.root, "temp"));

beforeAll(async () => {
  const rootTemp = globalThis.pathTemp.root;
  if (!(await exists(rootTemp))) await mkdir(rootTemp);
});
