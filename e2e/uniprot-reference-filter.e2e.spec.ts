/**
 * Verify UniProt lookups exclude non-UniProt CIF references.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT.
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-11-26
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { expect, test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test('mixed-reference structures only send UniProt accessions to UniProt', async ({ page }) => {
  test.setTimeout(180000);
  const queries: string[] = [];
  await page.route('https://rest.uniprot.org/uniprotkb/search?**', async route => {
    queries.push(new URL(route.request().url()).searchParams.get('query') ?? '');
    await route.fulfill({ status: 200, contentType: 'text/tab-separated-values', body: 'Entry\tGene Names (primary)\n' });
  });

  await page.goto('/');
  const mixedReferenceCif = fs.readFileSync(path.resolve(__dirname, '../data/input/6XU6.cif'), 'utf8')
    .replaceAll('NR_133545.1', 'P61247');
  await page.locator('#viewer-column-A-alignedto-file-input').setInputFiles({
    name: '6XU6.cif',
    mimeType: 'chemical/x-mmcif',
    buffer: Buffer.from(mixedReferenceCif),
  });
  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 90000 });
  await page.locator('#viewer-column-B-aligned-file-input')
    .setInputFiles(path.resolve(__dirname, '../data/input/6xu8.cif'));
  await expect(page.locator('#viewer-column-B').getByRole('button', { name: 'Hide 6XU8', exact: true }))
    .toBeVisible({ timeout: 90000 });

  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await expect(page.getByTestId('viewer-column-A-chain-table-row-A5')).not.toContainText('NR_133562.1');
  await expect.poll(() => queries.length, { timeout: 30000 }).toBeGreaterThan(0);
  await expect(page.locator('#viewer-column-A-alignedto-uniprot-status'))
    .toContainText(/0 pending, 0 in-flight/, { timeout: 90000 });

  const accessions = queries.flatMap(query => [...query.matchAll(/accession:([^ )]+)/g)].map(match => match[1]));
  expect(accessions).toContain('P38979');
  expect(accessions).not.toContain('NR_133545.1');
  expect(accessions).not.toContain('NR_133562.1');
  expect(accessions).not.toContain('174298');
  expect(accessions).not.toContain('158246');
  expect(accessions).not.toContain('P61247');
  for (const accession of accessions) {
    expect(accession).toMatch(/^(?:[OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9](?:[A-Z][A-Z0-9]{2}[0-9]){1,2})$/);
  }
});

test('AlphaFold singleton references enrich chain labels without querying unrelated text', async ({ page }) => {
  test.setTimeout(180000);
  const queries: string[] = [];
  await page.route('https://rest.uniprot.org/uniprotkb/search?**', async route => {
    queries.push(new URL(route.request().url()).searchParams.get('query') ?? '');
    await route.fulfill({ status: 200, contentType: 'text/tab-separated-values', body: 'Entry\tGene Names (primary)\nQ13895\tBYSL\n' });
  });
  const fixture = fs.readFileSync(path.resolve(__dirname, '../data/input/AF-Q13895-F1-model_v6.cif'), 'utf8');
  await page.goto('/');
  await page.locator('#viewer-column-A-alignedto-file-input').setInputFiles({
    name: 'alphafold-with-decoy.cif',
    mimeType: 'chemical/x-mmcif',
    buffer: Buffer.from(`${fixture}\n# Unrelated accession-like identifier P61247\n`),
  });
  await expect(page.locator('#viewer-column-B-aligned-load-btn')).toBeEnabled({ timeout: 90000 });
  await page.click('#viewer-column-A-select-zoom-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-chain-controls-toggle-btn');
  await page.click('#viewer-column-A-alignedto-select-chain-controls-toggle-btn');
  await expect(page.getByTestId('viewer-column-A-chain-table-row-A')).toContainText('BYSL', { timeout: 90000 });
  await expect(page.getByTestId('viewer-column-A-chain-table-row-A')).toContainText('Q13895');
  await expect(page.locator('#viewer-column-A-alignedto-uniprot-status'))
    .toContainText(/0 pending, 0 in-flight/, { timeout: 90000 });
  const accessions = queries.flatMap(query => [...query.matchAll(/accession:([^ )]+)/g)].map(match => match[1]));
  expect(accessions).toContain('Q13895');
  expect(accessions).not.toContain('P61247');
});
