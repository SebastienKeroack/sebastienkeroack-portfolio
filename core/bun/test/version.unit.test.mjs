/**
 * Provides unit tests for version management utilities and the Version class.
 * Ensures correct parsing, updating, and formatting of version information,
 * as well as validation of commit hash retrieval and JSON version updates.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { describe, expect, test } from 'bun:test';
import {
  execGetLastCommitID,
  replaceFieldVersionJson,
  Version,
} from '../src/internal/version.mjs';

describe('execGetLastCommitID', async () => {
  test('Returns a short hash string', async () => {
    const ans = await execGetLastCommitID();
    expect(typeof ans).toBe('string');
    expect(ans).toMatch(/^[a-f\d]{7,}$/i);
  });
});

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

describe('Version::getFields', () => {
  test('Extracts all fields from valid YAML', () => {
    const ans = Version.getFields(`
      major: 1
      minor: 2
      patch: 3
      revision: 456
      commitID: abcdef1
    `);
    expect(typeof ans).toBe('object');
    expect(ans).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      revision: 456,
      commitID: 'abcdef1',
    });
  });

  test.each(['major', 'minor', 'patch', 'revision', 'commitID'])(
    'Throws if %s field is missing',
    (field) => {
      const yaml = `
        major: 1
        minor: 2
        patch: 3
        revision: 456
        commitID: abcdef1
      `.replace(new RegExp(`${field}: [a-f\\d]+`), '');
      expect(yaml).not.toContain(field);
      expect(() => Version.getFields(yaml)).toThrow(
        `Missing required field: ${field}`,
      );
    },
  );

  test('Ignores extra whitespace and order', () => {
    const ans = Version.getFields(`
      minor:   2
      patch:  3
      revision:  456
      major:  1
      commitID: abcdef1
    `);
    expect(typeof ans).toBe('object');
    expect(ans).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      revision: 456,
      commitID: 'abcdef1',
    });
  });

  test('Parses fields with extra text between them', () => {
    const ans = Version.getFields(`
      major: 1
      # comment
      minor: 2

      patch: 3
      # another comment
      revision: 456
      commitID: abcdef1
    `);
    expect(typeof ans).toBe('object');
    expect(ans).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      revision: 456,
      commitID: 'abcdef1',
    });
  });
});

describe('Version.computeNextRevisionNumber', () => {
  test('Resets revision to 0 if commitID changes', () => {
    const nextRevision = new Version({
      major: 0,
      minor: 0,
      patch: 0,
      revision: 1,
      commitID: 'abcdef1',
    }).computeNextRevisionNumber('abcdef2');
    expect(typeof nextRevision).toBe('number');
    expect(nextRevision).toBe(0);
  });

  test('Increments revision if commit ID does not change', () => {
    const nextRevision = new Version({
      major: 0,
      minor: 0,
      patch: 0,
      revision: 1,
      commitID: 'abcdef1',
    }).computeNextRevisionNumber('abcdef1');
    expect(typeof nextRevision).toBe('number');
    expect(nextRevision).toBe(2);
  });
});

describe('Version.toString', () => {
  test('Returns version string with commit ID when present', () => {
    const ans = new Version({
      major: 1,
      minor: 2,
      patch: 3,
      revision: 456,
      commitID: 'abcdef1',
    }).toString();
    expect(typeof ans).toBe('string');
    expect(ans).toBe('1.2.3-456+abcdef1');
  });

  test('Returns version string without commit ID when empty', () => {
    const ans = new Version({
      major: 1,
      minor: 2,
      patch: 3,
      revision: 456,
      commitID: '',
    }).toString();
    expect(typeof ans).toBe('string');
    expect(ans).toBe('1.2.3-456');
  });
});
