import { describe, expect, test } from 'bun:test';

// The origin of a running runtime-static image: http://127.0.0.1:18271, say.
const base = process.env.PORTFOLIO_STATIC_URL;

const refresh = 'content="0; url=';
const php = '<?php';
const en404 = '404 - Page can not be found!';
const fr404 = '404 - Page introuvable!';
const form = '/en/contact/contact-form-submit';
const canonical = (path) => `href="https://sebastienkeroack.com${path}"`;
const post = {
  method: 'POST',
  body: new URLSearchParams({
    name: 'a',
    email: 'a@example.invalid',
    message: 'b',
  }),
};

// Only these paths follow redirects; their rows assert the final status and
// body alone.
const followed = new Set(['/', '/en/', '/fr/']);

// Each row: path, status, location (null: absent; undefined: not asserted),
// a substring the body contains, the substrings it lacks, the request options.
const rows = [
  ['/', 200, undefined, 'content="0; url=/en"'],
  ['/en/about', 200, null, canonical('/en/about'), [refresh]],
  ['/fr/about', 200, null, canonical('/fr/about'), [refresh]],
  ['/en/experience/', 200, null, canonical('/en/experience'), [refresh]],
  ['/fr/experience/', 200, null, canonical('/fr/experience'), [refresh]],
  ['/en/projects/', 200, null, canonical('/en/projects'), [refresh]],
  ['/fr/projects/', 200, null, canonical('/fr/projects'), [refresh]],
  ['/en/', 200, undefined, canonical('/en/about'), [refresh]],
  ['/fr/', 200, undefined, canonical('/fr/about'), [refresh]],
  ['/en/about.html', 308, '/en/about'],
  ['/fr/about.html', 308, '/fr/about'],
  ['/en/experience/experience.html', 308, '/en/experience/'],
  ['/fr/projects/projects', 308, '/fr/projects/'],
  ['/en/no-such-page', 404, null, en404, [refresh]],
  ['/fr/no-such-page', 404, null, fr404],
  ['/no-such-page', 404, null, 'content="0; url=/en/404"'],
  ['/en/404.html', 404, null, en404, [refresh]],
  ['/fr/404.html', 404, null, fr404],
  ['/.htaccess', 403],
  ['/en/.htaccess', 403],
  ['/.git/config', 403],
  [`${form}.php`, 404, null, en404, [php, refresh]],
  ['/fr/contact/contact-form-submit.php', 404, null, fr404, [php]],
  [`${form}.PHP`, 404, null, en404, [php, refresh]],
  [`${form}.php/`, 404, null, en404, [php, refresh]],
  [`${form}.php/index`, 404, null, en404, [php, refresh]],
  [form, 404, null, en404, [php, refresh]],
  [`${form}.php`, 404, null, en404, [php, refresh], post],
];

// Without a URL there is no server to ask.
describe.skipIf(!base)('the static profile', () => {
  for (const [path, status, location, contains, lacks = [], init] of rows)
    test(`${init?.method ?? 'GET'} ${path}`, async () => {
      const response = await fetch(new URL(path, base), {
        ...init,
        redirect: followed.has(path) ? 'follow' : 'manual',
      });
      expect(response.status).toBe(status);
      if (location !== undefined)
        expect(response.headers.get('location')).toBe(location);
      const text = await response.text();
      if (contains) expect(text).toContain(contains);
      for (const absent of lacks) expect(text).not.toContain(absent);
    });

  test('serves every asset of /en/about as immutable', async () => {
    const page = await fetch(new URL('/en/about', base), {
      redirect: 'manual',
    });
    // The hashed names the build wrote.
    const assets = [
      ...(await page.text()).matchAll(
        /(?:href|src)="(\/[^"]+\.(?:css|js|jpeg|png|svg|ico))"/g,
      ),
    ].map((match) => match[1]);
    expect(assets.some((asset) => asset.endsWith('.css'))).toBe(true);
    expect(assets.some((asset) => asset.endsWith('.js'))).toBe(true);
    for (const asset of assets) {
      const response = await fetch(new URL(asset, base), {
        redirect: 'manual',
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toContain('immutable');
    }
  });
});
