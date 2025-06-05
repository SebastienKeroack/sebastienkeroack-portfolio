/**
 * Contains unit tests for version management utilities, ensuring correct
 * parsing, updating, and retrieval of version information and commit hashes.
 * Validates the behavior of versioning functions and the Version class.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { describe, expect, test } from "bun:test";
import {
  execGetLastCommitHash,
  replaceFieldVersionJson,
  Version,
} from "./version.mjs";

describe("execGetLastCommitHash", async () => {
  test("Returns a short hash string", async () => {
    const ans = await execGetLastCommitHash();
    expect(typeof ans).toBe("string");
    expect(ans).toMatch(/^[a-f\d]{7,}$/i);
  });
});

describe("replaceFieldVersionJson", () => {
  test("Updates version field in package.json", () => {
    const ans = replaceFieldVersionJson(
      `{
      "name": "test-package",
      "version": "1.0.25001-0+abcdef1",
      "description": "A test package"
    }`,
      "9.9.9-99+ZZZ999",
    );
    expect(typeof ans).toBe("string");
    expect(ans).toContain('"version": "9.9.9-99+ZZZ999"');
  });
});

describe("Version::getFields", () => {
  test("Extracts all fields from valid YAML", () => {
    const ans = Version.getFields(`
      major: 2
      minor: 5
      build: 12345
      revision: 7
      commitHash: abcdef1
    `);
    expect(typeof ans).toBe("object");
    expect(ans).toEqual({
      major: 2,
      minor: 5,
      build: 12345,
      revision: 7,
      commitHash: "abcdef1",
    });
  });

  test.each(["major", "minor", "build", "revision", "commitHash"])(
    "Throws if %s field is missing",
    (field) => {
      const yaml = `
        major: 1
        minor: 2
        build: 3
        revision: 4
        commitHash: abcdef1
      `.replace(new RegExp(`${field}: [a-f\\d]+`), "");
      expect(yaml).not.toContain(field);
      expect(() => Version.getFields(yaml)).toThrow(
        `Missing required field: ${field}`,
      );
    },
  );

  test("Ignores extra whitespace and order", () => {
    const ans = Version.getFields(`
      minor:   1
      build:  42
      revision:  0
      major:  9
      commitHash: abcdef1
    `);
    expect(typeof ans).toBe("object");
    expect(ans).toEqual({
      major: 9,
      minor: 1,
      build: 42,
      revision: 0,
      commitHash: "abcdef1",
    });
  });

  test("Parses fields with extra text between them", () => {
    const ans = Version.getFields(`
      major: 1
      # comment
      minor: 2

      build: 3
      # another comment
      revision: 4
      commitHash: abcdef1
    `);
    expect(typeof ans).toBe("object");
    expect(ans).toEqual({
      major: 1,
      minor: 2,
      build: 3,
      revision: 4,
      commitHash: "abcdef1",
    });
  });
});

describe("Version.computeNextBuildRevNumber", () => {
  test("Returns next build and resets revision to 0 when build changes (new day)", () => {
    const ans = new Version({
      major: 0,
      minor: 0,
      build: 0,
      revision: 1,
      commitHash: "",
    }).computeNextBuildRevNumber(new Date("2025-06-01T12:00:00Z"));
    expect(typeof ans).toBe("object");
    expect(ans.nextBuild).toBe(25152);
    expect(ans.nextRevision).toBe(0);
  });

  test("Increments revision if build number does not change (same day)", () => {
    const ans = new Version({
      major: 0,
      minor: 0,
      build: 25152,
      revision: 2,
      commitHash: "",
    }).computeNextBuildRevNumber(new Date("2025-06-01T12:00:00Z"));
    expect(typeof ans).toBe("object");
    expect(ans.nextBuild).toBe(25152);
    expect(ans.nextRevision).toBe(3);
  });
});

describe("Version.toString", () => {
  test("Returns version string with commit hash when present", () => {
    const ans = new Version({
      major: 1,
      minor: 2,
      build: 3,
      revision: 4,
      commitHash: "abcdef1",
    }).toString();
    expect(typeof ans).toBe("string");
    expect(ans).toBe("1.2.3-4+abcdef1");
  });

  test("Returns version string without commit hash when empty", () => {
    const ans = new Version({
      major: 1,
      minor: 2,
      build: 3,
      revision: 4,
      commitHash: "",
    }).toString();
    expect(typeof ans).toBe("string");
    expect(ans).toBe("1.2.3-4");
  });
});
