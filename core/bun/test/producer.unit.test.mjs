import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

const root = globalThis.root;
const { scripts } = await Bun.file(join(root, 'package.json')).json();

describe('native producer inputs', () => {
  // The Docker build omits source-control metadata and the recipe itself.
  test.skipIf(!existsSync(join(root, '.git')))(
    'admits the Bun lock to source and the Docker build',
    () => {
      expect(existsSync(join(root, 'bun.lock'))).toBe(true);
      expect(
        Bun.spawnSync(
          ['git', 'check-ignore', '--no-index', '--quiet', 'bun.lock'],
          {
            cwd: root,
          },
        ).exitCode,
      ).toBe(1);

      const dockerfile = readFileSync(join(root, 'ci/Dockerfile'), 'utf8');
      expect(dockerfile).toMatch(/^COPY .*\bbun\.lock\b.*$/m);
      expect(dockerfile).toMatch(/^RUN bun install --frozen-lockfile$/m);
    },
  );

  test('names the native Bun test obligation', () => {
    expect(scripts['test:bun']).toBe('bun test');
  });
});

describe('native aggregates', () => {
  let fixture;

  beforeEach(() => {
    const scratch = join(root, '.cache', 'd141');
    mkdirSync(scratch, { recursive: true });
    fixture = mkdtempSync(join(scratch, 'aggregate-'));
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'));
    writeFileSync(
      join(fixture, 'bunfig.toml'),
      '[install]\nauto = "disable"\n',
    );
  });

  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  for (const [aggregate, parts] of [
    ['test:all', ['test:bun', 'test:php']],
    [
      'lint:all',
      ['lint:eslint', 'lint:prettier', 'lint:phpcs', 'lint:stylelint'],
    ],
  ]) {
    for (let failures = 0; failures < 2 ** parts.length; failures++) {
      const statuses = parts.map((_, index) => (failures >> index) & 1);

      test(`${aggregate} with exits ${statuses.join(', ')}`, () => {
        writeFileSync(
          join(fixture, 'package.json'),
          JSON.stringify({
            scripts: {
              [aggregate]: scripts[aggregate],
              ...Object.fromEntries(
                parts.map((part, index) => [
                  part,
                  `echo ${part} >> executed; exit ${statuses[index]}`,
                ]),
              ),
              'lint:html-validator': 'echo lint:html-validator >> executed',
            },
          }),
        );
        // The old test:all invokes bun test directly instead of test:bun.
        writeFileSync(
          join(fixture, 'part.test.mjs'),
          `import { appendFileSync } from 'node:fs';
appendFileSync('executed', 'test:bun\\n');
process.exit(${statuses[0]});
`,
        );

        const result = Bun.spawnSync([process.execPath, 'run', aggregate], {
          cwd: fixture,
        });
        if (failures === 0) expect(result.exitCode).toBe(0);
        else expect(result.exitCode).not.toBe(0);

        const executed = readFileSync(join(fixture, 'executed'), 'utf8')
          .trim()
          .split('\n');
        if (aggregate === 'test:all') expect(executed).toEqual(parts);
        else expect(executed.sort()).toEqual([...parts].sort());
      });
    }
  }
});
