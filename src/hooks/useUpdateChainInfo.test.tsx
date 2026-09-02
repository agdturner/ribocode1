/**
 * Test suite for useUpdateChainInfo hook.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-06-22
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUpdateChainInfo } from './useUpdateChainInfo';

describe('useUpdateChainInfo', () => {
  it('updates chain info using auth_asym_id labels from model hierarchy', () => {
    // Mock structure using model.atomicHierarchy.chains (as getChainInfo expects)
    const mockStructureObj = {
      units: [
        {
          kind: 0,
          model: {
            atomicHierarchy: {
              chains: {
                _rowCount: 2,
                auth_asym_id: { value: (i: number) => ['A', 'B'][i] },
                label_asym_id: { value: (i: number) => ['AA', 'BB'][i] },
              }
            }
          }
        }
      ],
    };
    const pluginRef = { current: {
      managers: {
        structure: {
          hierarchy: {
            current: {
              structures: [
                { cell: { transform: { ref: 'ref1' }, obj: { data: mockStructureObj } } },
              ],
            },
          },
        },
      },
    }};
    const setChainInfo = vi.fn();
    const setSubunitToChainIds = vi.fn();
    renderHook(() =>
      useUpdateChainInfo(
        pluginRef as any,
        'ref1',
        {},
        setChainInfo,
        setSubunitToChainIds,
        'TestLabel'
      )
    );
    // setChainInfo is called with a functional updater
    expect(setChainInfo).toHaveBeenCalled();
    const updater = setChainInfo.mock.calls[0][0];
    const result = updater({ chainLabels: new Map() });
    // Labels are now "labelId [auth authId]" format
    expect(result.chainLabels.get('A')).toBe('AA [auth A]');
    expect(result.chainLabels.get('B')).toBe('BB [auth B]');

    // Chains are mapped using standard subunit buckets.
    expect(setSubunitToChainIds).toHaveBeenCalled();
    const subunitUpdater = setSubunitToChainIds.mock.calls[0][0];
    const subunitResult = subunitUpdater(new Map());
    expect(subunitResult.get('All')).toEqual(new Set(['A', 'B']));
    expect(subunitResult.get('Large')).toEqual(expect.any(Set));
    expect(subunitResult.get('Small')).toEqual(expect.any(Set));
    expect(subunitResult.get('Other')).toEqual(expect.any(Set));
  });

  it('enriches labels with family names when rpNameLookup is provided', () => {
    const rpNameLookup = new Map([['P61247', 'eS1']]);
    const mockStructureObj = {
      units: [
        {
          kind: 0,
          model: {
            atomicHierarchy: {
              chains: {
                _rowCount: 1,
                auth_asym_id: { value: () => 'A' },
                label_asym_id: { value: () => 'AA' },
                label_entity_id: { value: () => '1' },
              }
            },
            sourceData: {
              data: {
                db: {
                  struct_ref: {
                    _rowCount: 1,
                    entity_id: { value: () => '1' },
                    pdbx_db_accession: { value: () => 'P61247' }
                  }
                }
              }
            }
          }
        }
      ],
    };
    const pluginRef = { current: {
      managers: {
        structure: {
          hierarchy: {
            current: {
              structures: [
                { cell: { transform: { ref: 'ref1' }, obj: { data: mockStructureObj } } },
              ],
            },
          },
        },
      },
    }};
    const setChainInfo = vi.fn();
    const setSubunitToChainIds = vi.fn();
    renderHook(() =>
      useUpdateChainInfo(
        pluginRef as any,
        'ref1',
        {},
        setChainInfo,
        setSubunitToChainIds,
        'TestLabel',
        rpNameLookup
      )
    );
    expect(setChainInfo).toHaveBeenCalled();
    const updater = setChainInfo.mock.calls[0][0];
    const result = updater({ chainLabels: new Map() });
    expect(result.chainLabels.get('A')).toBe('eS1 | P61247 | AA [auth A]');
  });

  it('does nothing if pluginRef.current is null', () => {
    const setChainInfo = vi.fn();
    const setSubunitToChainIds = vi.fn();
    renderHook(() =>
      useUpdateChainInfo(
        { current: null } as any,
        'ref1',
        {},
        setChainInfo,
        setSubunitToChainIds,
        'TestLabel'
      )
    );
    expect(setChainInfo).not.toHaveBeenCalled();
    expect(setSubunitToChainIds).not.toHaveBeenCalled();
  });
});
