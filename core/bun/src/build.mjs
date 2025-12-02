/**
 * Runs the build process for the project by bundling source files.
 * This script invokes the internal bundler, optionally forcing a rebuild
 * if the '--force' flag is provided. It outputs build status and timing.
 *
 * @author
 * Sébastien Kéroack <dev@sebastienkeroack.com>
 * @copyright
 * 2025 Sébastien Kéroack. All rights reserved.
 * @license
 * https://github.com/SebastienKeroack/skportfolio/blob/main/LICENSE
 * Apache License
 */

import { bundle } from './internal/bundle.mjs';

const force = process.argv.includes('--force');

console.log(`Build started at: ${new Date().toLocaleString()}`);
await bundle(globalThis.path.srcDir, globalThis.path.outDir, force);
