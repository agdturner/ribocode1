/**
 * Test suite for ChainSelectionTable component.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-07-28
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ChainSelectionTable from './ChainSelectionTable';

describe('ChainSelectionTable', () => {
  it('filters rows by search text and selects chain on row click', () => {
    const onSelectChainId = vi.fn();
    const chainLabels = new Map<string, string>([
      ['CU', 'eL22 | P35268 | ZB [auth CU] | Ribosomal protein L22-like protein'],
      ['AA', 'eS1 | P61247 | LA [auth AA] | 40S ribosomal protein S3a'],
    ]);

    render(
      <ChainSelectionTable
        chainLabels={chainLabels}
        selectedChainId=""
        onSelectChainId={onSelectChainId}
        idPrefix="viewer-column-A"
      />
    );

    const search = screen.getByTestId('viewer-column-A-chain-table-search');
    fireEvent.change(search, { target: { value: 'L22-like' } });

    expect(screen.getByText('CU')).toBeInTheDocument();
    expect(screen.queryByText('AA')).not.toBeInTheDocument();

    const row = screen.getByTestId('viewer-column-A-chain-table-row-CU');
    fireEvent.click(row);

    expect(onSelectChainId).toHaveBeenCalledWith('CU');
  });

  it('supports controlled query state', () => {
    const onSelectChainId = vi.fn();
    const onQueryChange = vi.fn();
    const chainLabels = new Map<string, string>([
      ['CU', 'Chain CU'],
      ['AA', 'Chain AA'],
    ]);

    render(
      <ChainSelectionTable
        chainLabels={chainLabels}
        selectedChainId=""
        onSelectChainId={onSelectChainId}
        idPrefix="viewer-column-B"
        query="CU"
        onQueryChange={onQueryChange}
      />
    );

    const search = screen.getByTestId('viewer-column-B-chain-table-search') as HTMLInputElement;
    expect(search.value).toBe('CU');
    fireEvent.change(search, { target: { value: 'AA' } });
    expect(onQueryChange).toHaveBeenCalledWith('AA');
  });
});
