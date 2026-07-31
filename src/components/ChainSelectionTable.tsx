/**
 * Searchable chain-selection table displayed below a viewer column.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-07-28
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React, { useMemo, useState } from 'react';

export interface ChainSelectionTableProps {
  chainLabels: Map<string, string>;
  selectedChainId: string;
  onSelectChainId: (chainId: string) => void;
  title?: string;
  idPrefix: string;
  query?: string;
  onQueryChange?: (query: string) => void;
}

const ChainSelectionTable: React.FC<ChainSelectionTableProps> = ({
  chainLabels,
  selectedChainId,
  onSelectChainId,
  title = 'Chain Finder',
  idPrefix,
  query,
  onQueryChange,
}) => {
  const [internalQuery, setInternalQuery] = useState('');
  const activeQuery = query ?? internalQuery;
  const setActiveQuery = onQueryChange ?? setInternalQuery;

  const rows = useMemo(() => {
    const q = activeQuery.trim().toLowerCase();
    return Array.from(chainLabels.entries())
      .sort((a, b) => {
        const byLabel = a[1].localeCompare(b[1], undefined, { numeric: true, sensitivity: 'base' });
        if (byLabel !== 0) return byLabel;
        return a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' });
      })
      .filter(([chainId, label]) => {
        if (!q) return true;
        return chainId.toLowerCase().includes(q) || label.toLowerCase().includes(q);
      });
  }, [chainLabels, activeQuery]);

  if (!chainLabels || chainLabels.size === 0) {
    return null;
  }

  return (
    <div className="chain-selection-table-container" id={`${idPrefix}-chain-table-container`}>
      <div className="chain-selection-table-header">
        <strong>{title}</strong>
      </div>
      <input
        id={`${idPrefix}-chain-table-search`}
        data-testid={`${idPrefix}-chain-table-search`}
        className="chain-selection-table-search"
        type="text"
        value={activeQuery}
        onChange={e => setActiveQuery(e.target.value)}
        placeholder="Search chain, auth, UniProt, molecule..."
        aria-label={`${title} search`}
      />
      <div className="chain-selection-table-scroll">
        <table className="chain-selection-table" id={`${idPrefix}-chain-table`}>
          <thead>
            <tr>
              <th>Chain</th>
              <th>Label</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([chainId, label]) => (
              <tr
                key={chainId}
                className={selectedChainId === chainId ? 'selected' : ''}
                onClick={() => onSelectChainId(chainId)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectChainId(chainId);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-label={`Select chain ${chainId}`}
                data-testid={`${idPrefix}-chain-table-row-${chainId}`}
              >
                <td>{chainId}</td>
                <td>{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ChainSelectionTable;
