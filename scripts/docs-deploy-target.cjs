#!/usr/bin/env node

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const dotenv = require('dotenv');

const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env');
const envProdPath = path.join(repoRoot, '.env.production');

// Load .env first, then allow .env.production to override for deployment defaults.
dotenv.config({ path: envPath, quiet: true });
dotenv.config({ path: envProdPath, override: true, quiet: true });

const targetRepo = process.env.DOCS_GH_PAGES_REPO;
if (!targetRepo) {
  console.error('Missing DOCS_GH_PAGES_REPO in .env or .env.production');
  console.error('Example: DOCS_GH_PAGES_REPO=https://github.com/<username>/ribocode1.git');
  process.exit(1);
}

const isDryRun = process.argv.includes('--dry-run');
const args = [
  'gh-pages',
  '-d',
  'docs',
  '-e',
  'docs',
  '-a',
  '-m',
  'Docs: update API documentation',
  '--repo',
  targetRepo,
];

if (isDryRun) {
  args.splice(6, 0, '--no-push');
}

const result = spawnSync('npx', args, {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
