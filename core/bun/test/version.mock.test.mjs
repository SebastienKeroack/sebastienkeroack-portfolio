/**
 * Integration test for the version bumping workflow with mocked dependencies.
 * Verifies that the Version class correctly updates version.yaml and
 * package.json using a fixed commit hash, ensuring deterministic and isolated
 * test results for version management logic.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
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

  test('Bump version.yaml and package.json', async () => {
    const versionPath = join(tempDir, 'version.yaml');
    const packagePath = join(tempDir, 'package.json');

    await Promise.all([
      Bun.write(
        versionPath,
        `
        major: 1
        minor: 2
        patch: 3
        revision: 455
        commitID: abcdef1
      `,
      ),
      Bun.write(
        packagePath,
        `{
        "name": "test-package",
        "version": "1.2.3-455+abcdef1",
        "description": "A test package"
      }`,
      ),
    ]);

    const version = await Version.load(versionPath);
    await version.bump('abcdef1');
    await version.write(versionPath, packagePath);

    const [yaml, json] = await Promise.all([
      Bun.file(versionPath).text(),
      Bun.file(packagePath).text().then(JSON.parse),
    ]);

    expect(yaml).toContain('major: 1');
    expect(yaml).toContain('minor: 2');
    expect(yaml).toContain('patch: 3');
    expect(yaml).toContain('revision: 456');
    expect(yaml).toContain('commitID: abcdef1');

    expect(json.version).toBe('1.2.3-456+abcdef1');
  });
});
