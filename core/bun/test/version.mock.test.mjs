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

import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { Version } from '../src/internal/version.mjs';

describe('Version', () => {
  const versionText = '  1.2.3  \r\n\r\n## Also at:\r\n## - package.json\r\n';
  let tempDir;
  let versionPath;
  let packagePath;

  beforeEach(async () => {
    const scratch = join(globalThis.root, '.cache', 'd141');
    mkdirSync(scratch, { recursive: true });
    tempDir = mkdtempSync(join(scratch, 'version-write-'));
    versionPath = join(tempDir, 'version.txt');
    packagePath = join(tempDir, 'package.json');
    await Bun.write(versionPath, versionText);
  });

  afterEach(() => rmSync(tempDir, { recursive: true, force: true }));

  test('Sync version.txt and the root package version, preserving metadata order', async () => {
    const metadata = {
      nested: { version: 'nested', keep: [true, { version: 'deeper' }] },
      name: 'test-package',
      version: '0.0.1',
      description: 'A test package',
    };
    await Bun.write(packagePath, JSON.stringify(metadata));
    const version = await Version.load(versionPath);
    await version.write(versionPath, packagePath);

    const [text, json] = await Promise.all([
      Bun.file(versionPath).text(),
      Bun.file(packagePath).text(),
    ]);

    expect(text).toBe(`1.2.3\n\n## Also at:\n## - package.json\n`);
    expect(JSON.parse(json)).toEqual({ ...metadata, version: '1.2.3' });
    expect(json).toBe(
      `${JSON.stringify({ ...metadata, version: '1.2.3' }, null, 2)}\n`,
    );
  });

  for (const [name, json, error] of [
    ['malformed JSON', '{"version":"0.0.1"', SyntaxError],
    ['null', 'null', 'package.json must be a JSON object'],
    ['an array', '[{"version":"0.0.1"}]', 'package.json must be a JSON object'],
    ['a string', '"0.0.1"', 'package.json must be a JSON object'],
    ['a number', '42', 'package.json must be a JSON object'],
    ['a boolean', 'true', 'package.json must be a JSON object'],
    [
      'a missing root version',
      '{"nested":{"version":"nested"}}',
      'package.json must have a root version',
    ],
  ]) {
    test(`Refuse ${name} without writing either file`, async () => {
      await Bun.write(packagePath, json);
      const version = await Version.load(versionPath);

      await expect(version.write(versionPath, packagePath)).rejects.toThrow(
        error,
      );
      expect(await Bun.file(packagePath).text()).toBe(json);
      expect(await Bun.file(versionPath).text()).toBe(versionText);
    });
  }

  test('Propagate Version.write failure through the command', async () => {
    const json = '{"version":"0.0.1"}';
    await Bun.write(packagePath, json);
    const result = Bun.spawnSync([
      process.execPath,
      '--eval',
      `import { Version } from ${JSON.stringify(new URL('../src/internal/version.mjs', import.meta.url).href)};
globalThis.path = ${JSON.stringify({ versionPath, packagePath })};
Version.prototype.write = () => { throw new Error('fixture Version.write failure'); };
await import(${JSON.stringify(new URL('../src/bump-version.mjs', import.meta.url).href)});
`,
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('fixture Version.write failure');
    expect(result.stdout.toString()).not.toContain('Version synced');
    expect(await Bun.file(packagePath).text()).toBe(json);
    expect(await Bun.file(versionPath).text()).toBe(versionText);
  });
});
