import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

const root = globalThis.root;
const { scripts } = await Bun.file(join(root, 'package.json')).json();
const versionText = '  1.2.3  \r\n\r\n## Also at:\r\n## - package.json\r\n';
const normalizedVersionText = '1.2.3\n\n## Also at:\n## - package.json\n';

describe('build:version', () => {
  let fixture;
  let packagePath;
  let versionPath;

  beforeEach(() => {
    const scratch = join(root, '.cache', 'd141');
    mkdirSync(scratch, { recursive: true });
    fixture = mkdtempSync(join(scratch, 'version-'));
    packagePath = join(fixture, 'consumer', 'package.json');
    versionPath = join(fixture, 'version.txt');
    mkdirSync(dirname(packagePath));
    for (const source of [
      'core/bun/src/bump-version.mjs',
      'core/bun/src/internal/version.mjs',
    ]) {
      const destination = join(fixture, source);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(join(root, source), destination);
    }
    // A valid runner lets malformed consumer JSON reach the actual command.
    writeFileSync(
      join(fixture, 'package.json'),
      JSON.stringify({
        scripts: { 'build:version': scripts['build:version'] },
      }),
    );
    writeFileSync(
      join(fixture, 'bunfig.toml'),
      'preload = ["./paths.mjs"]\n[install]\nauto = "disable"\n',
    );
    writeFileSync(
      join(fixture, 'paths.mjs'),
      `import { join } from 'node:path';
globalThis.path = {
  versionPath: join(import.meta.dir, 'version.txt'),
  packagePath: join(import.meta.dir, 'consumer', 'package.json'),
};
`,
    );
    writeFileSync(versionPath, versionText);
  });

  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  function runVersion() {
    return Bun.spawnSync([process.execPath, 'run', 'build:version'], {
      cwd: fixture,
    });
  }

  for (const failedPath of ['packagePath', 'versionPath']) {
    test(`characterizes a ${failedPath} write failure`, () => {
      const originalPackage = '{"version":"0.0.1","keep":{"version":"nested"}}';
      writeFileSync(packagePath, originalPackage);
      appendFileSync(
        join(fixture, 'paths.mjs'),
        `const write = Bun.write.bind(Bun);
Bun.write = (path, content) => path === globalThis.path.${failedPath}
  ? Promise.reject(new Error('fixture write failure'))
  : write(path, content);
`,
      );

      const result = runVersion();
      const remainingVersion = readFileSync(versionPath, 'utf8');
      const remainingPackage = readFileSync(packagePath, 'utf8');
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain('fixture write failure');
      expect(result.stdout.toString()).not.toContain('Version synced');
      expect(remainingVersion).toBe(
        failedPath === 'versionPath' ? versionText : normalizedVersionText,
      );
      if (failedPath === 'packagePath')
        expect(remainingPackage).toBe(originalPackage);
      else
        expect(JSON.parse(remainingPackage)).toEqual({
          version: '1.2.3',
          keep: { version: 'nested' },
        });
    });
  }

  test('updates the root version when nested versions come first', () => {
    const metadata = {
      nested: { version: 'nested', keep: [true, { version: 'deeper' }] },
      name: 'fixture',
      version: '0.0.1',
      tail: { keep: null },
    };
    writeFileSync(packagePath, JSON.stringify(metadata));

    const result = runVersion();
    const updated = readFileSync(packagePath, 'utf8');
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(updated)).toEqual({ ...metadata, version: '1.2.3' });
    expect(updated).toBe(
      `${JSON.stringify({ ...metadata, version: '1.2.3' }, null, 2)}\n`,
    );
    expect(readFileSync(versionPath, 'utf8')).toBe(normalizedVersionText);
    expect(result.stdout.toString()).toContain('Version synced to 1.2.3');
  });

  for (const [name, json, message] of [
    ['malformed JSON', '{"version":"0.0.1"', 'SyntaxError'],
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
    test(`rejects ${name} without writing either file`, () => {
      writeFileSync(packagePath, json);

      const result = runVersion();
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr.toString()).toContain(message);
      expect(result.stdout.toString()).not.toContain('Version synced');
      expect(readFileSync(packagePath, 'utf8')).toBe(json);
      expect(readFileSync(versionPath, 'utf8')).toBe(versionText);
    });
  }
});
