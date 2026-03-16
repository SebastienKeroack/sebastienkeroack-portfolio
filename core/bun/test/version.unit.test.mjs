/**
 * Provides unit tests for version management utilities and the Version class.
 * Ensures correct parsing, updating, and formatting of version information
 * from version.txt and package.json.
 *
 * @author
 * Sébastien Kéroack <code@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { describe, expect, test } from 'bun:test';
import {
  replaceFieldVersionJson,
  replaceVersionText,
  Version,
} from '../src/internal/version.mjs';

describe('replaceFieldVersionJson', () => {
  test('Updates version field in package.json', () => {
    const ans = replaceFieldVersionJson(
      `{
      "name": "test-package",
      "version": "1.2.3-456+abcdef1",
      "description": "A test package"
      }`,
      '999.999.999-999999999+FFFFF9',
    );
    expect(typeof ans).toBe('string');
    expect(ans).toContain('"version": "999.999.999-999999999+FFFFF9"');
  });
});

describe('replaceVersionText', () => {
  test('Replaces the first non-comment line and preserves the rest', () => {
    const ans = replaceVersionText(
      `0.3.0-6+2eb9e8f\n\n## Also at:\n## - package.toml\n`,
      '0.4.0',
    );

    expect(typeof ans).toBe('string');
    expect(ans).toBe(`0.4.0\n\n## Also at:\n## - package.toml\n`);
  });

  test('Creates a normalized file when no version line exists', () => {
    const ans = replaceVersionText('## version managed elsewhere\n', '1.2.3');

    expect(typeof ans).toBe('string');
    expect(ans).toBe('1.2.3\n');
  });
});

describe('Version.extract', () => {
  test('Extracts the first non-comment version line', () => {
    const ans = Version.extract(`
      # Generated from release tooling

      1.2.3

      ## Also at:
      ## - package.json
    `);

    expect(typeof ans).toBe('string');
    expect(ans).toBe('1.2.3');
  });

  test('Normalizes surrounding whitespace', () => {
    const ans = Version.extract('   2.3.4-beta.1+build.9   \n');

    expect(typeof ans).toBe('string');
    expect(ans).toBe('2.3.4-beta.1+build.9');
  });

  test('Throws when the file does not contain a version', () => {
    expect(() => Version.extract('# only comments\n\n')).toThrow(
      'Missing version string',
    );
  });

  test('Throws when the version is invalid', () => {
    expect(() => Version.extract('version: 1.2.3\n')).toThrow(
      'Invalid version string: version: 1.2.3',
    );
  });
});

describe('Version.toString', () => {
  test('Returns the normalized version string', () => {
    const ans = new Version('1.2.3-beta.1+build.5').toString();

    expect(typeof ans).toBe('string');
    expect(ans).toBe('1.2.3-beta.1+build.5');
  });
});
