/**
 * Test suite for release notes extraction in Ribocode.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('release notes', () => {
  const root = process.cwd();
  const script = path.join(root, 'scripts', 'release.cjs');
  const { version } = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };
  const tag = `v${version}`;

  it('extracts the matching section from the authored changelog', () => {
    const lines = readFileSync(path.join(root, 'documentation', 'CHANGELOG.md'), 'utf8').split(/\r?\n/);
    const start = lines.findIndex(line => line === `## [${tag}]` || line.startsWith(`## [${tag}] - `));
    expect(start).toBeGreaterThanOrEqual(0);
    const end = lines.findIndex((line, index) => index > start && line.startsWith('## '));
    const expected = lines.slice(start + 1, end === -1 ? lines.length : end).join('\n').trim();
    expect(expected).not.toBe('');

    const result = spawnSync(process.execPath, [script, 'notes', tag], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(expected);
  });

  it('rejects a tag that does not match the package version', () => {
    const result = spawnSync(process.execPath, [script, 'notes', 'not-the-current-tag'], { cwd: root, encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(`Expected tag ${tag}`);
  });
});
