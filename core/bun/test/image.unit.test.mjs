import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = globalThis.root;

// The Docker build omits source-control metadata and the recipe itself.
describe.skipIf(!existsSync(join(root, '.git')))('the static image', () => {
  test('pins the bases of the static target by digest', () => {
    const dockerfile = readFileSync(join(root, 'ci/Dockerfile'), 'utf8');
    for (const name of ['BUN_IMAGE', 'NGINX_IMAGE'])
      expect(
        dockerfile.match(new RegExp(`^ARG ${name}=(.*)$`, 'm'))[1],
      ).toMatch(/@sha256:[0-9a-f]{64}$/);
  });
});
