import { describe, expect, test } from 'bun:test';
import { extname } from 'node:path';

// The origin of a running runtime-static image: http://127.0.0.1:18271, say.
const base = process.env.PORTFOLIO_STATIC_URL;

const refresh = 'content="0; url=';
const php = '<?php';
const en404 = '404 - Page can not be found!';
const fr404 = '404 - Page introuvable!';
const form = '/en/contact/contact-form-submit';
const canonical = (path) => `href="https://sebastienkeroack.com${path}"`;
const enAbout = [canonical('/en/about'), 'SOFTWARE DEVELOPER'];
const frAbout = [canonical('/fr/about'), 'DÉVELOPPEUR LOGICIEL'];
const enError = [
  en404,
  'Sorry, the page you are looking for could not be found!',
];
const frError = [fr404, 'Désolé, la page que vous recherchez est introuvable!'];
const assetTypes = {
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.jpeg': 'image/jpeg',
};
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
// the required body marker (optionally paired with a heading), the substrings
// the body lacks, the request options.
const rows = [
  ['/', 200, undefined, 'content="0; url=/en"'],
  ['/en/about', 200, null, enAbout, [refresh]],
  ['/fr/about', 200, null, frAbout, [refresh]],
  [
    '/en/experience/',
    200,
    null,
    [canonical('/en/experience'), 'Professional experience'],
    [refresh],
  ],
  [
    '/fr/experience/',
    200,
    null,
    [canonical('/fr/experience'), 'Expérience professionnelle'],
    [refresh],
  ],
  [
    '/en/projects/',
    200,
    null,
    [canonical('/en/projects'), 'Personal projects'],
    [refresh],
  ],
  [
    '/fr/projects/',
    200,
    null,
    [canonical('/fr/projects'), 'Projets personnels'],
    [refresh],
  ],
  ['/en/', 200, undefined, enAbout, [refresh]],
  ['/fr/', 200, undefined, frAbout, [refresh]],
  ['/en/about.html', 308, '/en/about'],
  ['/fr/about.html', 308, '/fr/about'],
  ['/en/experience/experience.html', 308, '/en/experience/'],
  ['/fr/projects/projects', 308, '/fr/projects/'],
  ['/en/no-such-page', 404, null, enError, [refresh]],
  ['/fr/no-such-page', 404, null, frError],
  ['/no-such-page', 404, null, 'content="0; url=/en/404"'],
  ['/en/404.html', 404, null, enError, [refresh]],
  ['/fr/404.html', 404, null, frError],
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
  for (const [path, status, location, content, lacks = [], init] of rows)
    test(`${init?.method ?? 'GET'} ${path}`, async () => {
      const response = await fetch(new URL(path, base), {
        ...init,
        redirect: followed.has(path) ? 'follow' : 'manual',
      });
      expect(response.status).toBe(status);
      if (location !== undefined)
        expect(response.headers.get('location')).toBe(location);
      const text = await response.text();
      const [contains, heading] = [content].flat();
      if (contains) expect(text).toContain(contains);
      for (const absent of lacks) expect(text).not.toContain(absent);
      if (heading) {
        let lang;
        let headingText = '';
        const headings = [];
        new globalThis.HTMLRewriter()
          .on('html', {
            element(html) {
              lang = html.getAttribute('lang');
            },
          })
          .on('main h1, main h2', {
            element(element) {
              element.onEndTag(() => {
                headings.push(headingText.trim());
                headingText = '';
              });
            },
            text(chunk) {
              headingText += chunk.text;
            },
          })
          .transform(text);
        expect(lang).toBe(path.split('/')[1]);
        expect(headings).toContain(heading);
      }
    });

  for (const path of ['/en/about', '/fr/about'])
    test(`serves every asset of ${path} as immutable`, async () => {
      const page = await fetch(new URL(path, base), {
        redirect: 'manual',
      });
      // The hashed names the build wrote.
      const assets = [
        ...(await page.text()).matchAll(
          /(?:href|src)="(\/[^"]+\.(?:css|js|jpeg|png|svg|ico))"/g,
        ),
      ].map((match) => match[1]);
      expect(assets.map(extname)).toEqual(
        expect.arrayContaining(Object.keys(assetTypes)),
      );
      for (const asset of assets) {
        const response = await fetch(new URL(asset, base), {
          redirect: 'manual',
        });
        expect(response.status, asset).toBe(200);
        expect(response.headers.get('cache-control'), asset).toContain(
          'immutable',
        );

        const extension = extname(asset);
        const type = assetTypes[extension];
        if (!type) continue;
        expect(response.headers.get('content-type')?.split(';')[0], asset).toBe(
          type,
        );
        if (extension === '.jpeg') {
          const bytes = new Uint8Array(await response.arrayBuffer());
          expect(bytes.length, asset).toBeGreaterThan(4);
          expect([...bytes.subarray(0, 3)], asset).toEqual([0xff, 0xd8, 0xff]);
          expect([...bytes.subarray(-2)], asset).toEqual([0xff, 0xd9]);
        } else {
          expect((await response.text()).trim(), asset).toMatch(/^[^<]/);
        }
      }
    });
});
