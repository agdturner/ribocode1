const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const repository = 'ribocode-slola/ribocode1';
const tagPattern = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

function git(args, allowedStatuses = [0]) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(`git ${args[0]} failed: ${result.stderr.trim() || result.signal || result.status}`);
  }
  return { status: result.status, output: result.stdout.trim() };
}

function readRelease() {
  const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const tag = `v${version}`;
  if (!tagPattern.test(tag)) throw new Error('package.json must have a stable X.Y.Z version.');

  const lines = readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8').split(/\r?\n/);
  const heading = `## [${tag}]`;
  const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} - `));
  if (start === -1) throw new Error(`Add a ${heading} entry to CHANGELOG.md.`);
  const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
  const notes = lines.slice(start + 1, end === -1 ? lines.length : end).join('\n').trim();
  if (!notes) throw new Error(`The ${heading} entry in CHANGELOG.md is empty.`);
  return { tag, notes };
}

function checkRelease(tag, deployedCommit) {
  if (git(['status', '--porcelain', '--untracked-files=all', '--ignore-submodules=none']).output) {
    throw new Error('The working tree must be clean, including submodules.');
  }
  const commit = git(['rev-parse', 'HEAD']).output;
  if (deployedCommit !== undefined && deployedCommit !== commit) {
    throw new Error('The specified deployed commit must match the full checkout commit SHA.');
  }

  const { status, output: destination } = git(['remote', 'get-url', '--push', '--all', 'upstream'], [0, 2]);
  const upstreamPattern = /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)ribocode-slola\/ribocode1(?:\.git)?$/;
  if (status !== 0 || !upstreamPattern.test(destination)) {
    throw new Error(`Configure upstream with a single push URL for github.com/${repository}.`);
  }

  git(['fetch', '--no-tags', destination, 'refs/heads/main']);
  if (git(['merge-base', '--is-ancestor', commit, 'FETCH_HEAD'], [0, 1]).status !== 0) {
    throw new Error('The checkout commit must be in upstream main history.');
  }
  const ref = `refs/tags/${tag}`;
  if (git(['ls-remote', '--tags', destination, ref]).output) {
    throw new Error(`${tag} already exists upstream.`);
  }

  const localTagExists = git(['show-ref', '--verify', '--quiet', ref], [0, 1]).status === 0;
  if (localTagExists && (
    git(['cat-file', '-t', ref]).output !== 'tag' ||
    git(['rev-parse', `${ref}^{commit}`]).output !== commit
  )) {
    throw new Error(`Local ${tag} is not an annotated tag for this commit; inspect it before proceeding.`);
  }

  console.log(`Release: ${tag}\nCommit:  ${commit}\nTarget:  ${destination}`);
  return { commit, destination, localTagExists, ref };
}

function main([command, value, ...extra]) {
  if (extra.length || !(
    (command === 'check' && value === undefined) ||
    (command === 'tag' && value) ||
    (command === 'notes' && value)
  )) {
    throw new Error('Usage: npm run release:check or npm run release:tag -- <deployed-commit-sha>');
  }
  const { tag, notes } = readRelease();
  if (command === 'notes') {
    if (value !== tag) throw new Error(`Expected tag ${tag}, received ${value}.`);
    console.log(notes);
    return;
  }

  const { commit, destination, localTagExists, ref } = checkRelease(tag, value);
  if (command === 'check') return;

  if (!localTagExists) git(['tag', '-a', tag, commit, '-m', `Ribocode ${tag}`]);
  git(['push', '--no-follow-tags', '--recurse-submodules=no', destination, `${ref}:${ref}`]);
  console.log(`Pushed ${tag}. Verify the GitHub Release at https://github.com/${repository}/releases.`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(`Release error: ${error.message}`);
  process.exitCode = 1;
}
