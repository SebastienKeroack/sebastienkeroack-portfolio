/**
 * Integration test for the version bumping workflow with mocked dependencies.
 * This file verifies that incrementVersion correctly updates version.yaml and
 * package.json using a fixed commit hash and system time for deterministic
 * and isolated test results.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { exists, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as versionModule from "./version.mjs";

describe("Version", async () => {
  const tempDir = join(globalThis.pathTemp.root, "version");

  beforeAll(async () => {
    if (!(await exists(tempDir))) await mkdir(tempDir);
  });

  beforeEach(() => {
    spyOn(versionModule, "execGetLastCommitHash").mockImplementationOnce(
      () => "1fedcba",
    );
  });

  test("Bump version.yaml and package.json", async () => {
    const versionPath = join(tempDir, "version.yaml");
    const packagePath = join(tempDir, "package.json");

    await Promise.all([
      Bun.write(
        versionPath,
        `
        major: 1
        minor: 0
        build: 25152
        revision: 199
        commitHash: 1fedcba
      `,
      ),
      Bun.write(
        packagePath,
        `{
        "name": "test-package",
        "version": "1.0.25152-199+1fedcba",
        "description": "A test package"
      }`,
      ),
    ]);

    const version = await versionModule.Version.load(versionPath);
    await version.bump(new Date("2025-06-01T12:00:00Z"));
    await version.write(versionPath, packagePath);

    const [yaml, json] = await Promise.all([
      Bun.file(versionPath).text(),
      Bun.file(packagePath).text().then(JSON.parse),
    ]);

    expect(yaml).toContain("major: 1");
    expect(yaml).toContain("minor: 0");
    expect(yaml).toContain("build: 25152");
    expect(yaml).toContain("revision: 200");
    expect(yaml).toContain("commitHash: 1fedcba");

    expect(json.version).toBe("1.0.25152-200+1fedcba");
  });
});
