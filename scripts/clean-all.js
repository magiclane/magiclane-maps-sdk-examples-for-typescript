// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Clean all examples: removes dist/ (and optionally node_modules/) in each
// example, plus the scripts' own caches and result files.
// Usage: node clean-all.js [--deep]
//   --deep  also remove node_modules/ in each example

import { readdir, rm, stat, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

const EXCLUDED_DIRS = ['shared', 'scripts', 'node_modules', '.git', 'dist'];

// Per-example artifacts to remove in the default pass.
const DEFAULT_TARGETS = ['dist', '.vite'];
// Plus these when --deep is requested.
const DEEP_TARGETS = ['node_modules'];
// Scripts-dir files / dirs to remove unconditionally.
const SCRIPTS_TARGETS = ['.build-cache.json', 'build-results.json', 'smoke-results.json'];

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function discoverExamples() {
  const entries = await readdir(ROOT_DIR, { withFileTypes: true });
  const examples = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (EXCLUDED_DIRS.includes(entry.name)) continue;
    if (await fileExists(join(ROOT_DIR, entry.name, 'package.json'))) {
      examples.push(entry.name);
    }
  }
  return examples.sort();
}

async function removePath(path) {
  try {
    const s = await stat(path);
    await rm(path, { recursive: true, force: true });
    return s.isDirectory() ? 'dir' : 'file';
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const deep = args.includes('--deep');
  const targets = deep ? [...DEFAULT_TARGETS, ...DEEP_TARGETS] : DEFAULT_TARGETS;

  console.log(`${colors.cyan}Cleaning examples${colors.reset} ${colors.dim}(targets: ${targets.join(', ')})${colors.reset}`);

  const examples = await discoverExamples();
  let removed = 0;

  for (const example of examples) {
    const exampleDir = join(ROOT_DIR, example);
    const removedHere = [];
    for (const target of targets) {
      const path = join(exampleDir, target);
      try {
        const kind = await removePath(path);
        if (kind) { removedHere.push(target); removed++; }
      } catch (err) {
        console.log(`  ${colors.red}✗${colors.reset} ${example}/${target}: ${err.message}`);
      }
    }
    if (removedHere.length) {
      console.log(`  ${colors.green}✓${colors.reset} ${example} ${colors.dim}(${removedHere.join(', ')})${colors.reset}`);
    }
  }

  // Scripts-dir caches / results
  for (const target of SCRIPTS_TARGETS) {
    const path = join(__dirname, target);
    try {
      const kind = await removePath(path);
      if (kind) {
        console.log(`  ${colors.green}✓${colors.reset} scripts/${target}`);
        removed++;
      }
    } catch (err) {
      console.log(`  ${colors.red}✗${colors.reset} scripts/${target}: ${err.message}`);
    }
  }

  console.log(`${colors.cyan}Done.${colors.reset} Removed ${removed} item(s) across ${examples.length} example(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
