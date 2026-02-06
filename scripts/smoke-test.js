// SPDX-FileCopyrightText: 2025-2026 Magic Lane International B.V. <info@magiclane.com>
// SPDX-License-Identifier: Apache-2.0
//
// Smoke test script for all examples
// Usage: node smoke-test.js [--only=example1,example2] [--exclude=example1] [--selector=#custom] [--visible[=seconds]]

import { spawn } from 'child_process';
import { readdir, readFile, stat, access } from 'fs/promises';
import { writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Configuration
const DEFAULT_SELECTOR = '#map-container';
const PAGE_LOAD_TIMEOUT = 10000;
const SELECTOR_TIMEOUT = 10000;
const BUILD_RESULTS_FILE = join(__dirname, 'build-results.json');
const SMOKE_RESULTS_FILE = join(__dirname, 'smoke-results.json');
const EXCLUDED_DIRS = ['shared', 'scripts', 'node_modules', '.git', 'dist'];

// Track all spawned processes for cleanup
const spawnedProcesses = [];

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
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
    selector: DEFAULT_SELECTOR,
    visible: false,
    visibleTime: 5000, // default 5 seconds
  };

  for (const arg of args) {
    if (arg.startsWith('--only=')) {
      options.only = arg.slice(7).split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--exclude=')) {
      options.exclude = arg.slice(10).split(',').map(s => s.trim()).filter(Boolean);
    } else if (arg.startsWith('--selector=')) {
      options.selector = arg.slice(11).trim();
    } else if (arg === '--visible') {
      options.visible = true;
    } else if (arg.startsWith('--visible=')) {
      options.visible = true;
      options.visibleTime = parseInt(arg.slice(10), 10) * 1000;
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

// Load build results to skip failed builds
async function loadBuildResults() {
  try {
    const content = await readFile(BUILD_RESULTS_FILE, 'utf-8');
    const data = JSON.parse(content);
    const failedBuilds = new Set();
    for (const result of data.results) {
      if (!result.success) {
        failedBuilds.add(result.name);
      }
    }
    return failedBuilds;
  } catch {
    return new Set();
  }
}

// Discover all example directories with dist/ folder
async function discoverExamples() {
  const entries = await readdir(ROOT_DIR, { withFileTypes: true });
  const examples = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (EXCLUDED_DIRS.includes(entry.name)) continue;

    const distPath = join(ROOT_DIR, entry.name, 'dist');
    if (await dirExists(distPath)) {
      examples.push(entry.name);
    }
  }

  return examples.sort();
}

// Start serve for an example and return port
function startServer(exampleDir) {
  return new Promise((resolve, reject) => {
    const distPath = join(exampleDir, 'dist');

    // Use serve with random port (0) and SPA fallback (--single)
    const proc = spawn('npx', ['serve', distPath, '-l', '0', '--single', '--no-clipboard'], {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    spawnedProcesses.push(proc);

    let output = '';
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Server start timeout'));
      }
    }, 15000);

    proc.stdout.on('data', (data) => {
      output += data.toString();
      // Look for the port in the output
      // serve outputs: "Accepting connections at http://localhost:PORT"
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ proc, port: parseInt(match[1], 10) });
      }
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
    });

    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    proc.on('close', (code) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(new Error(`Server exited with code ${code}: ${output}`));
      }
    });
  });
}

// Kill a server process
function killServer(proc) {
  if (proc && !proc.killed) {
    try {
      // On Windows, we need to kill the process tree
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', proc.pid.toString(), '/f', '/t'], { shell: true });
      } else {
        proc.kill('SIGTERM');
      }
    } catch {
      // Ignore errors when killing
    }
  }
}

// Test a single example
async function testExample(name, browser, options, failedBuilds) {
  const exampleDir = join(ROOT_DIR, name);
  const startTime = Date.now();

  const result = {
    name,
    status: 'failed',
    duration: 0,
    errors: [],
    warnings: [],
    reason: null,
  };

  // Check if build failed
  if (failedBuilds.has(name)) {
    result.status = 'skipped';
    result.reason = 'build failed';
    result.duration = Date.now() - startTime;
    return result;
  }

  let serverProc = null;
  let page = null;

  try {
    // Start server
    console.log(`  ${colors.cyan}[${name}]${colors.reset} Starting server...`);
    const { proc, port } = await startServer(exampleDir);
    serverProc = proc;

    // Create new page (reuse browser)
    page = await browser.newPage();

    // Collect errors and warnings
    const fatalErrors = [];
    const consoleWarnings = [];

    // Listen for page errors (uncaught exceptions) - FATAL
    page.on('pageerror', (error) => {
      fatalErrors.push(error.message);
    });

    // Listen for console errors - WARNING only
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleWarnings.push(msg.text());
      }
    });

    // Navigate to the page
    console.log(`  ${colors.cyan}[${name}]${colors.reset} Loading http://localhost:${port}...`);
    await page.goto(`http://localhost:${port}`, {
      timeout: PAGE_LOAD_TIMEOUT,
      waitUntil: 'domcontentloaded',
    });

    // Wait for container selector
    console.log(`  ${colors.cyan}[${name}]${colors.reset} Waiting for ${options.selector}...`);
    let selectorFound = false;
    try {
      await page.waitForSelector(options.selector, { timeout: SELECTOR_TIMEOUT });
      selectorFound = true;
    } catch {
      // Selector not found
    }

    // Determine result
    result.errors = fatalErrors;
    result.warnings = consoleWarnings;

    if (fatalErrors.length > 0) {
      // Fatal errors = FAIL
      result.status = 'failed';
    } else if (!selectorFound) {
      // No selector but no fatal errors = PASS with warning
      result.status = 'passed';
      result.warnings.push(`Container selector "${options.selector}" not found`);
    } else {
      // Everything good = PASS
      result.status = 'passed';
    }

    // If visible mode, wait before closing
    if (options.visible && result.status === 'passed') {
      console.log(`  ${colors.cyan}[${name}]${colors.reset} Visible for ${options.visibleTime / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, options.visibleTime));
    }

    result.duration = Date.now() - startTime;

  } catch (err) {
    result.status = 'failed';
    result.errors.push(err.message);
    result.duration = Date.now() - startTime;
  } finally {
    // Always close page
    if (page) {
      try {
        await page.close();
      } catch {
        // Ignore
      }
    }

    // Always kill server
    if (serverProc) {
      killServer(serverProc);
    }
  }

  return result;
}

// Print result for an example
function printResult(result) {
  const duration = `(${(result.duration / 1000).toFixed(1)}s)`;

  if (result.status === 'passed') {
    const warningNote = result.warnings.length > 0 ? ` ${colors.yellow}(${result.warnings.length} warnings)${colors.reset}` : '';
    console.log(`${colors.green}  [PASS]${colors.reset} ${result.name} ${duration}${warningNote}`);
  } else if (result.status === 'skipped') {
    console.log(`${colors.yellow}  [SKIP]${colors.reset} ${result.name} - ${result.reason}`);
  } else {
    console.log(`${colors.red}  [FAIL]${colors.reset} ${result.name} ${duration}`);
    for (const err of result.errors.slice(0, 3)) {
      console.log(`${colors.red}         ${err.slice(0, 100)}${colors.reset}`);
    }
  }
}

// Print summary
function printSummary(results) {
  const total = results.length;
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}SMOKE TEST SUMMARY${colors.reset}`);
  console.log('='.repeat(60));
  console.log(`Total:   ${total}`);
  console.log(`${colors.green}Passed:  ${passed}${colors.reset}`);
  if (failed > 0) {
    console.log(`${colors.red}Failed:  ${failed}${colors.reset}`);
  }
  if (skipped > 0) {
    console.log(`${colors.yellow}Skipped: ${skipped}${colors.reset}`);
  }

  if (failed > 0) {
    console.log('\nFailed examples:');
    for (const r of results.filter(r => r.status === 'failed')) {
      console.log(`  - ${r.name}`);
    }
  }

  // Count warnings
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);
  if (totalWarnings > 0) {
    console.log(`\n${colors.yellow}Total warnings: ${totalWarnings}${colors.reset}`);
  }

  console.log('='.repeat(60));
}

// Save results to JSON
async function saveResults(results) {
  const output = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    failed: results.filter(r => r.status === 'failed').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    results: results.map(r => ({
      name: r.name,
      status: r.status,
      duration: r.duration,
      ...(r.reason && { reason: r.reason }),
      ...(r.errors.length > 0 && { errors: r.errors.slice(0, 5) }),
      ...(r.warnings.length > 0 && { warnings: r.warnings.length }),
    })),
  };

  await writeFile(SMOKE_RESULTS_FILE, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to: ${SMOKE_RESULTS_FILE}`);
}

// Cleanup all spawned processes
function cleanupAll() {
  for (const proc of spawnedProcesses) {
    killServer(proc);
  }
}

// Main function
async function main() {
  // Setup cleanup handlers
  process.on('SIGINT', () => {
    console.log('\n\nInterrupted! Cleaning up...');
    cleanupAll();
    process.exit(1);
  });

  process.on('SIGTERM', () => {
    cleanupAll();
    process.exit(1);
  });

  process.on('uncaughtException', (err) => {
    console.error(`Uncaught exception: ${err.message}`);
    cleanupAll();
    process.exit(1);
  });

  console.log(`${colors.bright}${colors.blue}`);
  console.log('='.repeat(60));
  console.log('  Maps SDK Examples - Smoke Test');
  console.log('='.repeat(60));
  console.log(`${colors.reset}\n`);

  const options = parseArgs();

  // Load failed builds to skip them
  const failedBuilds = await loadBuildResults();
  if (failedBuilds.size > 0) {
    console.log(`${colors.yellow}Note: ${failedBuilds.size} examples failed to build and will be skipped${colors.reset}\n`);
  }

  // Discover examples with dist/ folder
  let examples = await discoverExamples();
  console.log(`Found ${examples.length} built examples\n`);

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
    console.log('No examples to test.');
    return;
  }

  // Launch browser once
  const headless = !options.visible;
  console.log(`Launching browser${options.visible ? ' (visible mode)' : ''}...\n`);
  const browser = await chromium.launch({ headless });

  const results = [];

  try {
    // Test each example sequentially (to avoid port conflicts with serve)
    for (const name of examples) {
      const result = await testExample(name, browser, options, failedBuilds);
      results.push(result);
      printResult(result);
    }
  } finally {
    // Always close browser
    await browser.close();
    // Cleanup any remaining processes
    cleanupAll();
  }

  // Print summary and save results
  printSummary(results);
  await saveResults(results);

  // Exit with appropriate code
  const failed = results.filter(r => r.status === 'failed').length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  cleanupAll();
  process.exit(1);
});
