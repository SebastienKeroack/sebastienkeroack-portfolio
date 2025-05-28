/**
 * This module processes and bundles project assets and pages for deployment.
 * It scans source files, minifies and hashes assets, resolves dependencies,
 * and generates output files and a manifest. Unused files are cleaned up to
 * ensure the output directory contains only the latest build artifacts.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/sebastienkeroack-portfolio/blob/main/LICENSE
 * Apache License
 */

import { basename, dirname, extname, join, relative } from "node:path";
import { exists, mkdir, readdir, rmdir, stat } from "node:fs/promises";
import * as esbuild from "esbuild";
import { minify as minifyHTML } from "html-minifier-terser";

const REGEX_ALL_TAGS = new RegExp(
  [
    // Image tag
    `<img\\s+[^>]*src=["'](\\/[^"']+\\.(?:ico|jpeg|png|svg))["'][^>]*>`,
    // Style tag
    `<link\\s+[^>]*rel=["']stylesheet["'][^>]*href=["'](\\/[^"']+\\.css)["'][^>]*>`,
    // Script tag
    `<script\\s+[^>]*src=["'](\\/[^"']+\\.(?:m?js))["'][^>]*><\\/script>`,
    // ES module import
    `import\\s+[^'"]+\\s+from\\s+['"](\\/[^'"]+\\.mjs)['"]`,
    // SSI include tag
    `<!--#include\\s+virtual=["']([^"']+)["']\\s*-->`,
    // Meta og:image tag
    `<meta\\s+[^>]*property=["']og:image["'][^>]*content=["'](?:https?:\\/\\/)[^"']*?(\\/[^"']+\\.(?:ico|jpeg|png|svg))["'][^>]*>`,
  ].join("|"),
  "gi",
);

async function minifyJS(input) {
  const { code } = await esbuild.transform(input, {
    loader: "js",
    minify: true,
    target: "esnext",
  });
  return code;
}

async function minifyCSS(input) {
  const { code } = await esbuild.transform(input, {
    loader: "css",
    minify: true,
  });
  return code;
}

function posixPath(path) {
  return path.replace(/\\/g, "/");
}

function hash(content) {
  return new Bun.CryptoHasher("sha256")
    .update(content)
    .digest("hex")
    .slice(0, 8);
}

class Asset {
  #pathname = null;
  #mtime = 0;
  #hasChange = false;
  #outname = null;
  #outPathname = null;

  constructor(pathname, mtime = 0, outname = null) {
    this.#pathname = pathname;
    this.#mtime = mtime;
    this.#setOutname(outname);
  }

  get pathname() {
    return this.#pathname;
  }

  get hasChange() {
    return this.#hasChange;
  }

  get outPathname() {
    return this.#outPathname;
  }

  #setOutname(outname) {
    if (!outname) return null;
    this.#outname = outname;
    this.#outPathname = posixPath(join(dirname(this.#pathname), outname));
  }

  async build(srcDir, outDir) {
    const src = join(srcDir, this.#pathname);

    try {
      const stats = await stat(src);
      if (this.#mtime >= stats.mtimeMs) return;
      this.#mtime = stats.mtimeMs;
      this.#hasChange = true;
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }

    if (/\.(s?html|php)$/.test(src)) return;

    let content = null;
    let outname = null;

    if (/\.(m?js|css)$/.test(src)) {
      const result = await Bun.build({
        entrypoints: [src],
        naming: "[dir]/[hash].min.[ext]",
        root: basename(srcDir),
        sourcemap: "none",
        target: "browser",
        minify: false,
        splitting: false,
      });

      const artifact = result.outputs[0];
      content = await artifact.text();

      try {
        if (src.endsWith(".css")) content = await minifyCSS(content);
        else content = await minifyJS(content);
      } catch (error) {
        console.error("Error minifying:", src);
        throw error;
      }

      outname = basename(artifact.path);
    } else {
      if (/\.(ico|jpeg|png|svg)$/.test(src))
        content = await Bun.file(src).arrayBuffer();
      else content = await Bun.file(src).text();

      if (/(\.htaccess|favicon.*)$/.test(src)) {
        if (src.endsWith(".htaccess"))
          content = content.replace(/\.shtml/g, ".html");
        outname = basename(src);
      } else {
        outname = hash(content) + extname(src);
      }
    }

    this.#setOutname(outname);
    const ext = extname(outname).slice(1) || outname;
    const outPath = join(outDir, this.#outPathname);
    console.log(`Writing ${ext} to ${outPath}`);
    await Bun.write(outPath, content);
  }

  getConfig() {
    return {
      mtime: this.#mtime,
      outname: this.#outname,
    };
  }
}

class PageBuilder {
  #code = null;
  #assets = [];

  #pathname = null;
  #mtime = 0;
  #hasChange = false;
  #outPathname = null;

  constructor(pathname, mtime = 0, assets = []) {
    this.#pathname = pathname;
    this.#mtime = mtime;
    this.#assets = assets;

    const ext = pathname.endsWith(".shtml") ? ".html" : extname(pathname);
    const outname = basename(pathname, extname(pathname)) + ext;
    this.#outPathname = posixPath(join(dirname(pathname), outname));
  }

  get code() {
    return this.#code;
  }

  get assets() {
    return this.#assets;
  }

  get isPrivateFile() {
    return basename(this.#pathname).startsWith("_");
  }

  get pathname() {
    return this.#pathname;
  }

  get hasChange() {
    return this.#hasChange;
  }

  get outPathname() {
    return this.#outPathname;
  }

  async #preprocessSSI(srcDir, manifest, allAssets) {
    const includes = this.#assets.filter((a) =>
      /\.(s?html|php)$/.test(a.pathname),
    );
    if (includes.length === 0) return;

    const replacements = await Promise.all(
      includes.map(async ({ pathname, match }) => {
        const { mtime: mtime_ = 0, assets: assets_ = [] } =
          manifest.pages[pathname] || {};
        const includePage = new PageBuilder(pathname, mtime_, assets_);
        await includePage.populate(srcDir);
        await includePage.build(srcDir, null, manifest, allAssets);
        return { match, code: includePage.code };
      }),
    );

    for (const { match, code } of replacements)
      this.#code = this.#code.replace(match, code);
  }

  async #anyAssetsChanged(allAssets) {
    for (const { pathname } of this.#assets)
      if (allAssets[pathname].hasChange) return true;
    return false;
  }

  async populate(srcDir) {
    const src = join(srcDir, this.#pathname);
    const stats = await stat(src);
    if (this.#mtime >= stats.mtimeMs) return;
    this.#mtime = stats.mtimeMs;
    this.#hasChange = true;

    this.#code = await Bun.file(src).text();
    this.#assets = [];
    for (const match of this.#code.matchAll(REGEX_ALL_TAGS)) {
      const pathname = match.slice(1).find(Boolean);
      this.#assets.push({ pathname, match: match[0] });
    }
  }

  async build(srcDir, outDir, manifest, allAssets) {
    const src = join(srcDir, this.#pathname);

    if (outDir && !this.#hasChange) {
      this.#hasChange = await this.#anyAssetsChanged(allAssets);
      if (!this.#hasChange) return;
    }

    if (!this.#code) this.#code = await Bun.file(src).text();

    if (src.endsWith(".shtml"))
      await this.#preprocessSSI(srcDir, manifest, allAssets);

    for (const { pathname, match } of this.#assets) {
      if (/\.(s?html|php)$/.test(pathname)) continue;
      this.#code = this.#code.replaceAll(
        match,
        match.replace(pathname, allAssets[pathname].outPathname),
      );
    }

    if (!outDir || this.isPrivateFile) return;

    try {
      this.#code = await minifyHTML(this.#code, {
        collapseWhitespace: true,
        minifyJS: minifyJS,
        minifyCSS: minifyCSS,
        html5: true,
        removeComments: true,
        useShortDoctype: true,
        sortAttributes: true,
        sortClassName: true,
      });
    } catch (error) {
      console.error(`Error minifying: ${src}`);
      throw error;
    }

    const outPath = join(outDir, this.#outPathname);
    console.log(`Writing HTML to ${outPath}`);
    await Bun.write(outPath, this.#code);
  }

  getConfig() {
    return {
      mtime: this.#mtime,
      assets: this.#assets,
    };
  }
}

async function cleanup(outDir, pages, allAssets) {
  const keepFiles = new Set();

  for (const asset of Object.values(allAssets))
    if (asset.outPathname) keepFiles.add(join(outDir, asset.outPathname));

  for (const page of pages) keepFiles.add(join(outDir, page.outPathname));

  async function pruneDir(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    let keepCount = 0;
    let removeFiles = [];

    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const { removeFiles: subRemoveFiles, keepCount: subKeepCount } =
          await pruneDir(path);

        if (!subKeepCount) {
          await rmdir(path);
        } else {
          keepCount += subKeepCount;
          removeFiles.push(...subRemoveFiles);
        }
      } else if (!keepFiles.has(path)) {
        removeFiles.push(path);
      } else {
        ++keepCount;
      }
    }

    return { removeFiles, keepCount };
  }

  const { removeFiles } = await pruneDir(outDir);
  await Promise.all(removeFiles.map((path) => Bun.file(path).delete()));
}

async function loadManifest(manifestPath) {
  try {
    return JSON.parse(await Bun.file(manifestPath).text());
  } catch {
    return { version: null, pages: {}, assets: {} };
  }
}

export async function pack(paths, version, force = false) {
  if (!(await exists(paths.outDir))) await mkdir(paths.outDir);

  const srcPublicDir = paths.srcDir;
  const outPublicDir = join(paths.outDir, basename(srcPublicDir));

  const manifest = await loadManifest(force ? null : paths.manifestPath);

  async function findPagesAndFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    let pages = [];
    let files = [];

    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        const [subPages, subFiles] = await findPagesAndFiles(path);
        pages.push(...subPages);
        files.push(...subFiles);
        continue;
      }

      const pathname = `/${posixPath(relative(srcPublicDir, path))}`;
      if (/\.(s?html|php)$/.test(entry.name)) {
        const { mtime: mtime_ = 0, assets: assets_ = [] } =
          manifest.pages[pathname] || {};
        pages.push(new PageBuilder(pathname, mtime_, assets_));
      } else if (/(\.htaccess|favicon.*)$/.test(entry.name)) {
        files.push(pathname);
      }
    }

    return [pages, files];
  }

  const [pages, files] = await findPagesAndFiles(srcPublicDir);
  await Promise.all(pages.map((page) => page.populate(srcPublicDir)));

  const newManifest = { version: version, pages: {}, assets: {} };
  const allAssetPathnames = new Set(files);
  for (const page of pages)
    for (const asset of page.assets) allAssetPathnames.add(asset.pathname);

  const allAssets = {};
  await Promise.all(
    allAssetPathnames.values().map(async (pathname) => {
      const { mtime: mtime_ = 0, outname: outfile_ = null } =
        manifest.assets[pathname] || {};
      const asset = new Asset(pathname, mtime_, outfile_);
      await asset.build(srcPublicDir, outPublicDir);
      newManifest.assets[pathname] = asset.getConfig();
      allAssets[pathname] = asset;
    }),
  );

  await Promise.all(
    pages.map((page) => {
      newManifest.pages[page.pathname] = page.getConfig();
      return page.build(srcPublicDir, outPublicDir, manifest, allAssets);
    }),
  );

  if (pages.some((page) => page.hasChange)) {
    console.log("Cleaning up unused files...");
    await cleanup(outPublicDir, pages, allAssets);

    console.log(`Writing manifest to ${paths.manifestPath}`);
    await Bun.write(paths.manifestPath, JSON.stringify(newManifest, null, 2));
    console.log("Manifest updated.");
  }
}
