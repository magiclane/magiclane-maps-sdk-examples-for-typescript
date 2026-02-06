// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Build all examples script
// Usage: node build-all.js [--only=example1,example2] [--exclude=example1] [--no-cache]

import { spawn } from 'child_process';
import { readdir, readFile, writeFile, stat, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Configuration
const CONCURRENCY = 4;
const EXCLUDED_DIRS = ['shared', 'scripts', 'node_modules', '.git', 'dist'];
const CACHE_FILE = join(__dirname, '.build-cache.json');
const RESULTS_FILE = join(__dirname, 'build-results.json');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    only: [],
    exclude: [],
    noCache: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--only=')) {
      options.only = arg.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--exclude=')) {
      options.exclude = arg.slice(10).split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg === '--no-cache') {
      options.noCache = true;
    }
  }

  return options;
}

// Check if directory exists
async function dirExists(path) {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// Check if file exists
async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Get MD5 hash of a file
async function getFileHash(filePath) {
  try {
    const content = await readFile(filePath);
    return createHash('md5').update(content).digest('hex');
  } catch {
    return null;
  }
}

// Load build cache
async function loadCache() {
  try {
    const content = await readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

// Save build cache
async function saveCache(cache) {
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Discover all example directories
async function discoverExamples() {
  const entries = await readdir(ROOT_DIR, { withFileTypes: true });
  const examples = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (EXCLUDED_DIRS.includes(entry.name)) continue;

    const packagePath = join(ROOT_DIR, entry.name, 'package.json');
    if (await fileExists(packagePath)) {
      examples.push(entry.name);
    }
  }

  return examples.sort();
}

// Run a command in a directory
function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, stdout, stderr });
      } else {
        resolve({ success: false, stdout, stderr, code });
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Build a single example
async function buildExample(name, cache, options) {
  const exampleDir = join(ROOT_DIR, name);
  const packageLockPath = join(exampleDir, 'package-lock.json');
  const nodeModulesPath = join(exampleDir, 'node_modules');
  const startTime = Date.now();

  const result = {
    name,
    success: false,
    duration: 0,
    error: null,
    skippedInstall: false,
  };

  try {
    // Check if we need to run npm install
    let needsInstall = true;
    const currentHash = await getFileHash(packageLockPath);

    if (!options.noCache && currentHash) {
      const cachedHash = cache[name];
      const hasNodeModules = await dirExists(nodeModulesPath);

      if (cachedHash === currentHash && hasNodeModules) {
        needsInstall = false;
        result.skippedInstall = true;
      }
    }

    // Run npm install if needed
    if (needsInstall) {
      const isCI = process.env.CI === 'true' || process.env.CI === '1';
      const installCmd = isCI ? 'ci' : 'install';

      console.log(`  ${colors.cyan}[${name}]${colors.reset} Running npm ${installCmd}...`);
      const installResult = await runCommand('npm', [installCmd], exampleDir);

      if (!installResult.success) {
        result.error = `npm ${installCmd} failed: ${installResult.stderr || installResult.stdout}`;
        result.duration = Date.now() - startTime;
        return result;
      }

      // Update cache with new hash
      if (currentHash) {
        cache[name] = currentHash;
      }
    } else {
      console.log(`  ${colors.cyan}[${name}]${colors.reset} Skipping install (cached)`);
    }

    // Run npm build with production mode
    console.log(`  ${colors.cyan}[${name}]${colors.reset} Building...`);
    const buildResult = await runCommand('npm', ['run', 'build', '--', '--mode=production'], exampleDir);

    if (!buildResult.success) {
      result.error = buildResult.stderr || buildResult.stdout;
      result.duration = Date.now() - startTime;
      return result;
    }

    result.success = true;
    result.duration = Date.now() - startTime;
    return result;

  } catch (err) {
    result.error = err.message;
    result.duration = Date.now() - startTime;
    return result;
  }
}

// Process examples with concurrency limit
async function processExamples(examples, cache, options) {
  const results = [];
  const queue = [...examples];
  const running = new Map();

  const processNext = async () => {
    if (queue.length === 0) return;

    const name = queue.shift();
    const promise = buildExample(name, cache, options);
    running.set(name, promise);

    const result = await promise;
    running.delete(name);
    results.push(result);

    // Print result
    if (result.success) {
      const skipNote = result.skippedInstall ? ' (install cached)' : '';
      console.log(`${colors.green}  [PASS]${colors.reset} ${name} (${(result.duration / 1000).toFixed(1)}s)${skipNote}`);
    } else {
      console.log(`${colors.red}  [FAIL]${colors.reset} ${name}`);
      if (result.error) {
        const errorLines = result.error.split('\n').slice(0, 5).join('\n');
        console.log(`${colors.red}         ${errorLines}${colors.reset}`);
      }
    }

    // Process next item
    await processNext();
  };

  // Start initial batch
  const initialBatch = Math.min(CONCURRENCY, queue.length);
  const promises = [];
  for (let i = 0; i < initialBatch; i++) {
    promises.push(processNext());
  }

  await Promise.all(promises);

  return results;
}

// Print summary table
function printSummary(results) {
  const total = results.length;
  const passed = results.filter(r => r.success).length;
  const failed = total - passed;

  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}BUILD SUMMARY${colors.reset}`);
  console.log('='.repeat(60));
  console.log(`Total:  ${total}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  if (failed > 0) {
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
    console.log('\nFailed examples:');
    for (const r of results.filter(r => !r.success)) {
      console.log(`  - ${r.name}`);
    }
  }
  console.log('='.repeat(60));
}

// Save results to JSON
async function saveResults(results) {
  const output = {
    timestamp: new Date().toISOString(),
    total: results.length,
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results: results.map(r => ({
      name: r.name,
      success: r.success,
      duration: r.duration,
      ...(r.error && { error: r.error.slice(0, 500) }),
    })),
  };

  await writeFile(RESULTS_FILE, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${RESULTS_FILE}`);
}

// Main function
async function main() {
  console.log(`${colors.bright}${colors.blue}`);
  console.log('='.repeat(60));
  console.log('  Maps SDK Examples - Build All');
  console.log('='.repeat(60));
  console.log(`${colors.reset}\n`);

  const options = parseArgs();

  // Load cache
  const cache = await loadCache();

  // Discover examples
  let examples = await discoverExamples();
  console.log(`Found ${examples.length} examples\n`);

  // Apply filters
  if (options.only.length > 0) {
    examples = examples.filter(e => options.only.includes(e));
    console.log(`Filtered to ${examples.length} examples (--only)\n`);
  }

  if (options.exclude.length > 0) {
    examples = examples.filter(e => !options.exclude.includes(e));
    console.log(`Filtered to ${examples.length} examples (--exclude)\n`);
  }

  if (examples.length === 0) {
    console.log('No examples to build.');
    return;
  }

  // Build examples
  console.log(`Building with ${CONCURRENCY} parallel workers...\n`);
  const results = await processExamples(examples, cache, options);

  // Save cache
  await saveCache(cache);

  // Print summary and save results
  printSummary(results);
  await saveResults(results);

  // Exit with error code if any failed
  const failed = results.filter(r => !r.success).length;
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
