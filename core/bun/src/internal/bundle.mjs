/**
 * Processes and bundles project assets and pages for deployment.
 * Scans source files, minifies and hashes assets, resolves dependencies,
 * generates output files and a manifest, and cleans up unused files to
 * ensure the output directory contains only the latest build artifacts.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { basename, dirname, extname, join, relative } from 'node:path';
import { exists, mkdir, readdir, rmdir, stat } from 'node:fs/promises';
import * as esbuild from 'esbuild';
import { minify as minifyHTML } from 'html-minifier-terser';
import { Version } from './version.mjs';

// Regular expression to match all asset tags in HTML content.
// Captures image tags, stylesheets, scripts, ES module imports,
// SSI include tags, and Open Graph image meta tags.
const REGEX_ALL_TAGS = new RegExp(
  [
    `<img\\s+[^>]*src=["'](\\/[^"']+\\.(?:ico|jpeg|png|svg))["'][^>]*>`,
    `<link\\s+[^>]*rel=["']stylesheet["'][^>]*href=["'](\\/[^"']+\\.css)["'][^>]*>`,
    `<script\\s+[^>]*src=["'](\\/[^"']+\\.(?:m?js))["'][^>]*><\\/script>`,
    `import\\s+[^'"]+\\s+from\\s+['"](\\/[^'"]+\\.mjs)['"]`,
    `<!--#include\\s+virtual=["']([^"']+)["']\\s*-->`,
    `<meta\\s+[^>]*property=["']og:image["'][^>]*content=["'](?:https?:\\/\\/)[^"']*?(\\/[^"']+\\.(?:ico|jpeg|png|svg))["'][^>]*>`,
  ].join('|'),
  'gi',
);

/**
 * Minifies JavaScript code using esbuild.
 *
 * @param {string} input - The JavaScript code to minify
 * @returns {Promise<string>} The minified JavaScript code
 */
async function minifyJS(input) {
  const { code } = await esbuild.transform(input, {
    loader: 'js',
    minify: true,
    target: 'esnext',
  });
  return code;
}

/**
 * Minifies CSS code using esbuild.
 *
 * @param {string} input - The CSS code to minify
 * @returns {Promise<string>} The minified CSS code
 */
async function minifyCSS(input) {
  const { code } = await esbuild.transform(input, {
    loader: 'css',
    minify: true,
  });
  return code;
}

/**
 * Converts Windows-style path to POSIX-style path.
 * Replaces backslashes with forward slashes for cross-platform compatibility.
 *
 * @param {string} path - The path to convert
 * @returns {string} The converted POSIX-style path
 */
export function posixPath(path) {
  return path.replace(/\\/g, '/');
}

/**
 * Generates a SHA256 hash of the given content.
 * Uses first 8 characters to create short unique identifiers for cache-busting.
 *
 * @param {string|ArrayBuffer} content - The content to hash
 * @returns {string} The first 8 characters of the SHA256 hash
 */
export function hash(content) {
  return new Bun.CryptoHasher('sha256')
    .update(content)
    .digest('hex')
    .slice(0, 8);
}

/**
 * Represents an asset file with build capabilities and change tracking.
 * Handles asset processing, minification, hashing, and output generation.
 */
class Asset {
  #pathname = ''; // Original asset path
  #mtime = 0; // Last modification time
  #hasChange = false; // Whether asset has changed since last build
  #outname = ''; // Generated output filename
  #outPathname = ''; // Full output path

  /**
   * Creates a new Asset instance.
   *
   * @param {string} pathname - The pathname of the asset
   * @param {number} [mtime=0] - The modification time of the asset
   * @param {string} [outname=""] - The output filename
   */
  constructor(pathname, mtime = 0, outname = '') {
    this.#pathname = pathname;
    this.#mtime = mtime;
    this.#setOutname(outname);
  }

  /**
   * Gets the pathname of the asset.
   *
   * @returns {string} The asset pathname
   */
  get pathname() {
    return this.#pathname;
  }

  /**
   * Checks if the asset has changed.
   *
   * @returns {boolean} True if the asset has changed
   */
  get hasChange() {
    return this.#hasChange;
  }

  /**
   * Gets the output pathname of the asset.
   *
   * @returns {string} The output pathname
   */
  get outPathname() {
    return this.#outPathname;
  }

  /**
   * Sets the output filename and pathname.
   * Combines the original directory with the new filename to create full path.
   *
   * @param {string} outname - The output filename
   */
  #setOutname(outname) {
    if (!outname) return;
    this.#outname = outname;
    this.#outPathname = posixPath(join(dirname(this.#pathname), outname));
  }

  /**
   * Builds the asset, processing and writing it to the output directory.
   * Handles minification, hashing, and cache-busting filename generation.
   *
   * @param {string} srcDir - The source directory
   * @param {string} outDir - The output directory
   * @returns {Promise<void>}
   */
  async build(srcDir, outDir) {
    const src = join(srcDir, this.#pathname);

    // Check if file exists and has been modified since last build
    try {
      const stats = await stat(src);
      if (this.#mtime >= stats.mtimeMs) return;
      this.#mtime = stats.mtimeMs;
      this.#hasChange = true;
    } catch (error) {
      // File doesn't exist, skip processing
      if (error.code === 'ENOENT') return;
      throw error;
    }

    // Skip HTML and PHP files - they're handled by PageBuilder
    if (/\.(s?html|php)$/.test(src)) return;

    let content = '';
    let outname = '';

    // Process JavaScript and CSS files with bundling and minification
    if (/\.(m?js|css)$/.test(src)) {
      // Use Bun's bundler to process the file
      const result = await Bun.build({
        entrypoints: [src],
        naming: '[dir]/[hash].min.[ext]',
        root: srcDir,
        sourcemap: 'none',
        target: 'browser',
        minify: false,
        splitting: false,
      });

      const artifact = result.outputs[0];
      content = await artifact.text();

      // Apply additional minification using esbuild
      try {
        if (src.endsWith('.css')) content = await minifyCSS(content);
        else content = await minifyJS(content);
      } catch (error) {
        console.error('Error minifying:', src);
        throw error;
      }

      outname = basename(artifact.path);
    } else {
      // Handle other file types (images, configs, etc.)
      if (/\.(ico|jpeg|png|svg)$/.test(src))
        content = await Bun.file(src).arrayBuffer(); // Binary files
      else content = await Bun.file(src).text(); // Text files

      // Special handling for Apache config and favicon files
      if (/(\.htaccess|favicon.*)$/.test(src)) {
        // Convert .shtml extensions to .html in Apache config
        if (src.endsWith('.htaccess'))
          content = content.replace(/\.shtml/g, '.html');
        outname = basename(src); // Keep original filename
      } else {
        // Generate hash-based filename for cache-busting
        outname = hash(content) + extname(src);
      }
    }

    // Update output filename and write to disk
    this.#setOutname(outname);
    await Bun.write(join(outDir, this.#outPathname), content);
  }

  /**
   * Gets the configuration object for the asset.
   * Used for manifest generation and build state tracking.
   *
   * @returns {{mtime: number, outname: string}} The asset configuration:
   *   - mtime: The modification time
   *   - outname: The output filename
   */
  getConfig() {
    return {
      mtime: this.#mtime,
      outname: this.#outname,
    };
  }
}

/**
 * Represents a page file with build capabilities and asset dependency tracking.
 * Handles HTML/PHP processing, SSI includes, asset reference updates, and
 * minification.
 */
class PageBuilder {
  #code = ''; // Page HTML content
  #assets = []; // List of assets referenced by this page

  #pathname = ''; // Original page path
  #mtime = 0; // Last modification time
  #hasChange = false; // Whether page has changed since last build
  #outPathname = ''; // Output path (converts .shtml to .html)

  /**
   * Creates a new PageBuilder instance.
   *
   * @param {string} pathname - The pathname of the page
   * @param {number} [mtime=0] - The modification time of the page
   * @param {Array} [assets=[]] - The assets used by the page
   */
  constructor(pathname, mtime = 0, assets = []) {
    this.#pathname = pathname;
    this.#mtime = mtime;
    this.#assets = assets;

    // Convert .shtml files to .html in output
    const ext = pathname.endsWith('.shtml') ? '.html' : extname(pathname);
    const outname = basename(pathname, extname(pathname)) + ext;
    this.#outPathname = posixPath(join(dirname(pathname), outname));
  }

  /**
   * Gets the code content of the page.
   *
   * @returns {string} The page code
   */
  get code() {
    return this.#code;
  }

  /**
   * Gets the assets used by the page.
   *
   * @returns {Array} The page assets
   */
  get assets() {
    return this.#assets;
  }

  /**
   * Checks if the page is a private file (starts with underscore).
   * Private files are not written to output directory.
   *
   * @returns {boolean} True if the page is private
   */
  get isPrivateFile() {
    return basename(this.#pathname).startsWith('_');
  }

  /**
   * Gets the pathname of the page.
   *
   * @returns {string} The page pathname
   */
  get pathname() {
    return this.#pathname;
  }

  /**
   * Checks if the page has changed.
   *
   * @returns {boolean} True if the page has changed
   */
  get hasChange() {
    return this.#hasChange;
  }

  /**
   * Gets the output pathname of the page.
   *
   * @returns {string} The output pathname
   */
  get outPathname() {
    return this.#outPathname;
  }

  /**
   * Processes Server Side Includes (SSI) in the page content.
   * Recursively builds included pages and replaces SSI tags with content.
   *
   * @param {string} srcDir - The source directory
   * @param {Object} manifest - The build manifest
   * @param {Object} allAssets - All assets in the project
   * @returns {Promise<void>}
   */
  async #preprocessSSI(srcDir, manifest, allAssets) {
    // Find all HTML/PHP includes in the current page
    const includes = this.#assets.filter((a) =>
      /\.(s?html|php)$/.test(a.pathname),
    );
    if (includes.length === 0) return;

    // Process each include by building it as a separate page
    const replacements = await Promise.all(
      includes.map(async ({ pathname, match }) => {
        // Get cached info from manifest or use defaults
        const { mtime: mtime_ = 0, assets: assets_ = [] } =
          manifest.pages[pathname] || {};
        const includePage = new PageBuilder(pathname, mtime_, assets_);
        await includePage.populate(srcDir);
        // Build include without writing to disk (outDir = "")
        await includePage.build(srcDir, '', manifest, allAssets);
        return { match, code: includePage.code };
      }),
    );

    // Replace SSI tags with the processed content
    for (const { match, code } of replacements)
      this.#code = this.#code.replace(match, code);
  }

  /**
   * Checks if any of the page's assets have changed.
   * Used to determine if page needs rebuilding even if unchanged.
   *
   * @param {Object} allAssets - All assets in the project
   * @returns {Promise<boolean>} True if any asset has changed
   */
  async #anyAssetsChanged(allAssets) {
    for (const { pathname } of this.#assets)
      if (allAssets[pathname].hasChange) return true;
    return false;
  }

  /**
   * Populates the page with content and extracts asset dependencies.
   * Scans page content for asset references using regex pattern matching.
   *
   * @param {string} srcDir - The source directory
   * @returns {Promise<void>}
   */
  async populate(srcDir) {
    const src = join(srcDir, this.#pathname);
    const stats = await stat(src);
    // Skip if file hasn't been modified
    if (this.#mtime >= stats.mtimeMs) return;
    this.#mtime = stats.mtimeMs;
    this.#hasChange = true;

    // Read page content and extract asset dependencies
    this.#code = await Bun.file(src).text();
    this.#assets = [];
    // Use regex to find all asset references in the HTML
    for (const match of this.#code.matchAll(REGEX_ALL_TAGS)) {
      // Extract the first non-empty capture group (the asset path)
      const pathname = match.slice(1).find(Boolean);
      this.#assets.push({ pathname, match: match[0] });
    }
  }

  /**
   * Builds the page, processing SSI and asset references.
   * Updates asset paths to use hashed filenames and minifies HTML.
   *
   * @param {string} srcDir - The source directory
   * @param {string} outDir - The output directory
   * @param {Object} manifest - The build manifest
   * @param {Object} allAssets - All assets in the project
   * @returns {Promise<void>}
   */
  async build(srcDir, outDir, manifest, allAssets) {
    const src = join(srcDir, this.#pathname);

    // Check if rebuild is needed due to asset changes
    if (outDir && !this.#hasChange) {
      this.#hasChange = await this.#anyAssetsChanged(allAssets);
      if (!this.#hasChange) return;
    }

    // Load content if not already loaded
    if (!this.#code) this.#code = await Bun.file(src).text();

    // Process Server Side Includes for .shtml files
    if (src.endsWith('.shtml'))
      await this.#preprocessSSI(srcDir, manifest, allAssets);

    // Update asset references to use processed filenames
    for (const { pathname, match } of this.#assets) {
      // Skip HTML/PHP assets as they're handled by SSI processing
      if (/\.(s?html|php)$/.test(pathname)) continue;
      // Replace original path with hashed output path
      this.#code = this.#code.replaceAll(
        match,
        match.replace(pathname, allAssets[pathname].outPathname),
      );
    }

    // Skip writing to disk if no output directory or private file
    if (!outDir || this.isPrivateFile) return;

    // Minify HTML content for production
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

    // Write processed page to output directory
    const outPath = join(outDir, this.#outPathname);
    console.log(`Writing HTML to ${outPath}`);
    await Bun.write(outPath, this.#code);
  }

  /**
   * Gets the configuration object for the page.
   * Used for manifest generation and build state tracking.
   *
   * @returns {{mtime: number, assets: Array}} The page configuration object:
   *   - mtime: The modification time
   *   - assets: The page assets
   */
  getConfig() {
    return {
      mtime: this.#mtime,
      assets: this.#assets,
    };
  }
}

/**
 * Removes unused files from the output directory.
 * Compares current build artifacts with existing files and removes orphans.
 *
 * @param {string} outDir - The output directory
 * @param {Array} pages - All pages in the project
 * @param {Object} allAssets - All assets in the project
 * @returns {Promise<void>}
 */
export async function cleanup(outDir, pages, allAssets) {
  // Build set of files that should be kept
  const keepFiles = new Set();

  // Add all asset output files to keep set
  for (const asset of Object.values(allAssets))
    if (asset.outPathname) keepFiles.add(join(outDir, asset.outPathname));

  // Add all page output files to keep set
  for (const page of pages) keepFiles.add(join(outDir, page.outPathname));

  /**
   * Recursively prunes directories and removes unused files.
   * Returns list of files to remove and count of files to keep.
   *
   * @param {string} dir - The directory to prune
   * @returns {Promise<{removeFiles: Array, keepCount: number}>} Pruning results
   */
  async function pruneDir(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    let keepCount = 0;
    let removeFiles = [];

    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Recursively process subdirectories
        const { removeFiles: subRemoveFiles, keepCount: subKeepCount } =
          await pruneDir(path);

        if (!subKeepCount) {
          // Remove empty directories
          await rmdir(path);
        } else {
          keepCount += subKeepCount;
          removeFiles.push(...subRemoveFiles);
        }
      } else if (!keepFiles.has(path)) {
        // Mark unused files for removal
        removeFiles.push(path);
      } else {
        // Count files that should be kept
        ++keepCount;
      }
    }

    return { removeFiles, keepCount };
  }

  // Execute cleanup and remove unused files
  const { removeFiles } = await pruneDir(outDir);
  await Promise.all(removeFiles.map((path) => Bun.file(path).delete()));
}

/**
 * Loads the build manifest from the specified path.
 * Returns cached build state or creates new manifest if file doesn't exist.
 *
 * @param {string} manifestPath - The path to the manifest file
 * @returns {Promise<{version: string, pages: Object, assets: Object}>}
 *   The manifest object with version, pages, and assets
 */
async function loadManifest(manifestPath) {
  return Bun.file(manifestPath)
    .text()
    .then(JSON.parse)
    .catch(() => {
      // If parsing fails, return empty manifest
      return { version: '', pages: {}, assets: {} };
    });
}

/**
 * Bundles and processes all assets and pages in the source directory.
 * Writes output files, updates the manifest, and cleans up unused files.
 *
 * @param {string} srcDir - The source directory
 * @param {string} outDir - The output directory
 * @param {boolean} [force=false] - If true, forces a full rebuild
 * @returns {Promise<void>}
 */
export async function bundle(srcDir, outDir, force = false) {
  const basenameDir = basename(srcDir);
  const dstDir = join(outDir, basenameDir);
  if (!(await exists(outDir))) await mkdir(outDir);
  if (!(await exists(dstDir))) await mkdir(dstDir);

  // Load previous build state for incremental builds
  const manifestPath = join(outDir, '.cache', `${basenameDir}.manifest.json`);
  const manifest = await loadManifest(force ? '' : manifestPath);

  /**
   * Recursively finds all pages and files in the source directory.
   * Separates HTML/PHP pages from other asset files for different processing.
   *
   * @param {string} dir - The directory to search
   * @returns {Promise<[Array<PageBuilder>, Array<string>]>}
   *   Array containing [pages, files]
   */
  async function findPagesAndFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    let pages = [];
    let files = [];

    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const [subPages, subFiles] = await findPagesAndFiles(path);
        pages.push(...subPages);
        files.push(...subFiles);
        continue;
      }

      // Convert file path to web-relative pathname
      const pathname = `/${posixPath(relative(srcDir, path))}`;
      if (/\.(s?html|php)$/.test(entry.name)) {
        // Create PageBuilder for HTML/PHP files
        const { mtime: mtime_ = 0, assets: assets_ = [] } =
          manifest.pages[pathname] || {};
        pages.push(new PageBuilder(pathname, mtime_, assets_));
      } else if (
        /(\.htaccess|favicon.*\.(?:ico|jpeg|png|svg))$/.test(entry.name)
      ) {
        // Track special files that need processing
        files.push(pathname);
      }
    }

    return [pages, files];
  }

  // Discover all pages and special files in source directory
  const [pages, files] = await findPagesAndFiles(srcDir);
  // Populate all pages with content and extract dependencies
  await Promise.all(pages.map((page) => page.populate(srcDir)));

  // Initialize new manifest for this build
  const version = await Version.load(globalThis.path.versionPath);
  const newManifest = { version: version.toString(), pages: {}, assets: {} };

  // Collect all unique asset pathnames from pages and special files
  const allAssetPathnames = new Set(files);
  for (const page of pages)
    for (const asset of page.assets) allAssetPathnames.add(asset.pathname);

  // Process all assets in parallel
  const allAssets = {};
  await Promise.all(
    allAssetPathnames.values().map(async (pathname) => {
      // Get cached asset info from previous build
      const { mtime: mtime_ = 0, outname: outfile_ = '' } =
        manifest.assets[pathname] || {};
      const asset = new Asset(pathname, mtime_, outfile_);
      // Build asset (minify, hash, write to output)
      await asset.build(srcDir, dstDir);
      // Store asset config in new manifest
      newManifest.assets[pathname] = asset.getConfig();
      allAssets[pathname] = asset;
    }),
  );

  // Build all pages in parallel (process SSI, update references, minify)
  await Promise.all(
    pages.map((page) => {
      // Store page config in new manifest
      newManifest.pages[page.pathname] = page.getConfig();
      return page.build(srcDir, dstDir, manifest, allAssets);
    }),
  );

  // Clean up unused files and update manifest if any pages changed
  if (pages.some((page) => page.hasChange)) {
    console.log('Cleaning up unused files...');
    await cleanup(dstDir, pages, allAssets);

    // Write updated manifest to track build state
    console.log(`Writing manifest to ${manifestPath}`);
    await Bun.write(manifestPath, JSON.stringify(newManifest, null, 2));
    console.log('Manifest updated.');
  }
}
