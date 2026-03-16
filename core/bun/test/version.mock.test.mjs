/**
 * Integration test for the version syncing workflow.
 * Verifies that the Version class correctly updates version.txt and
 * package.json using version.txt as the source of truth.
 *
 * @author
 * Sébastien Kéroack <code@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, test } from 'bun:test';
import { Version } from '../src/internal/version.mjs';

describe('Version', async () => {
  const tempDir = join(globalThis.pathTemp.root, 'version');

  beforeAll(async () => {
    if (!existsSync(tempDir)) mkdirSync(tempDir);
  });

  test('Sync version.txt and package.json', async () => {
    const versionPath = join(tempDir, 'version.txt');
    const packagePath = join(tempDir, 'package.json');

    await Promise.all([
      Bun.write(
        versionPath,
        `1.2.3

## Also at:
## - package.json
`,
      ),
      Bun.write(
        packagePath,
        `{
        "name": "test-package",
        "version": "0.0.1",
        "description": "A test package"
      }`,
      ),
    ]);

    const version = await Version.load(versionPath);
    await version.write(versionPath, packagePath);

    const [text, json] = await Promise.all([
      Bun.file(versionPath).text(),
      Bun.file(packagePath).text().then(JSON.parse),
    ]);

    expect(text).toBe(`1.2.3\n\n## Also at:\n## - package.json\n`);
    expect(json.version).toBe('1.2.3');
  });
});
