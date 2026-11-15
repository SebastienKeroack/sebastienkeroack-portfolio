import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = globalThis.root;
const exists = (path) => existsSync(join(root, path));
const read = (path) => readFileSync(join(root, path), 'utf8');

// The Docker build omits source-control metadata and the recipe itself.
describe.skipIf(!existsSync(join(root, '.git')))('the static image', () => {
  test('pins the bases of the static target by digest', () => {
    const dockerfile = read('ci/Dockerfile');
    for (const name of ['BUN_IMAGE', 'NGINX_IMAGE'])
      expect(
        dockerfile.match(new RegExp(`^ARG ${name}=(.*)$`, 'm'))[1],
      ).toMatch(/@sha256:[0-9a-f]{64}$/);
  });

  test('declares one image that the publisher sends to the Sites project', () => {
    expect(exists('.keroack/images.json')).toBe(true);
    const descriptor = JSON.parse(read('.keroack/images.json'));
    expect(Object.keys(descriptor).sort()).toEqual([
      'bake_file',
      'images',
      'schema',
    ]);
    expect(descriptor.schema).toBe(1);
    expect(Object.keys(descriptor.images)).toEqual(['static']);
    const image = descriptor.images.static;
    expect(Object.keys(image).sort()).toEqual(['build_paths', 'repository']);
    expect(image.repository).toBe(
      'registry.mgmt.yqb1.keroack.internal:18443/sites/portfolio-static',
    );
    expect(image.build_paths.filter((path) => !exists(path))).toEqual([]);
    expect(exists(descriptor.bake_file)).toBe(true);
    const { dockerfile } = JSON.parse(read(descriptor.bake_file)).target.static;
    expect(image.build_paths).toContain(dockerfile);
    expect(image.build_paths).not.toContain('.keroack/images.json');
    expect(image.build_paths).not.toContain(descriptor.bake_file);
  });

  test("builds that image from the recipe's static stage", () => {
    expect(exists('.keroack/images.json')).toBe(true);
    const { bake_file } = JSON.parse(read('.keroack/images.json'));
    expect(exists(bake_file)).toBe(true);
    const bake = JSON.parse(read(bake_file));
    expect(Object.keys(bake)).toEqual(['target']);
    expect(bake.target.static).toEqual({
      context: '.',
      dockerfile: 'ci/Dockerfile',
      target: 'runtime-static',
    });
    expect(read('ci/Dockerfile')).toMatch(/^FROM \S+ AS runtime-static$/m);
  });

  test("runs only as the estate's runners admit it", () => {
    const path = '.github/workflows/build-image.yaml';
    expect(exists(path)).toBe(true);
    const text = read(path);
    // Bun's YAML 1.2 core schema keeps `on` a string key.
    const workflow = Bun.YAML.parse(text);
    expect(Object.keys(workflow.on).sort()).toEqual([
      'push',
      'workflow_dispatch',
    ]);
    expect(workflow.on.push).toEqual({ branches: ['main'] });
    expect(workflow.permissions).toEqual({ contents: 'read' });

    const jobs = Object.values(workflow.jobs);
    expect(jobs).toHaveLength(1);
    const [job] = jobs;
    expect(job.if).toBe("vars.KEROACK_RUNNERS != ''");
    expect(job['runs-on']).toBe('${{ vars.KEROACK_RUNNERS }}');
    expect(job.services).toBeUndefined();
    expect(job.container.image).toMatch(
      /^ghcr\.io\/actions\/actions-runner:2\.338\.2@sha256:[0-9a-f]{64}$/,
    );
    // Pinned remote actions only: no local action, no docker:// image, no tag.
    for (const { uses } of job.steps)
      if (uses !== undefined)
        expect(uses).toMatch(/^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/);
    expect(text).not.toMatch(/secrets\./);
    expect(text).not.toMatch(/github\.token/);

    const step = (action) =>
      job.steps.find(({ uses }) => uses?.startsWith(`${action}@`));
    expect(step('actions/checkout').with['persist-credentials']).toBe(false);
    expect(step('actions/upload-artifact').with).toEqual({
      path: '${{ steps.image.outputs.archive }}',
      archive: false,
      'retention-days': 1,
      'if-no-files-found': 'error',
    });
  });
});
