/**
 * Test suite for useUpdateResidueInfo hook.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { renderHook } from '@testing-library/react';
import { vi } from 'vitest';
import { useUpdateResidueInfo } from './useUpdateResidueInfo';
import { ResidueLabelInfo } from '../utils/residue';

describe('useUpdateResidueInfo', () => {
  it('updates residue info when structure and chain are present', () => {
    // Mock residue info
    const mockResidueLabels = new Map<string, ResidueLabelInfo>([
      ['1', { id: '1', compId: 'ALA', seqNumber: 1, name: 'ALA', insCode: '' }],
      ['2', { id: '2', compId: 'GLY', seqNumber: 2, name: 'GLY', insCode: '' }],
    ]);
    const mockResidueToAtomIds = { '1': ['a1', 'a2'], '2': ['b1', 'b2'] };
    const mockStructureObj = {
      units: [
        { chainId: 'A', residues: [{ id: '1' }, { id: '2' }] },
      ],
    };
    const viewerRef = { current: {
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
    const molstar = {
      getResidueInfo: vi.fn(() => ({ residueLabels: mockResidueLabels, residueToAtomIds: mockResidueToAtomIds })),
    };
    const setResidueInfo = vi.fn();
    const setSelectedResidueIds = vi.fn();
    renderHook(() =>
      useUpdateResidueInfo(
        viewerRef as any,
        'ref1',
        molstar,
        'A',
        setResidueInfo,
        [],
        setSelectedResidueIds,
        'TestLabel'
      )
    );
    expect(molstar.getResidueInfo).toHaveBeenCalledWith(mockStructureObj, 'A');
    expect(setResidueInfo).toHaveBeenCalled();
    const updater = setResidueInfo.mock.calls[0][0];
    const result = updater({ residueLabels: new Map(), residueToAtomIds: {} });
    expect(result).toEqual({ residueLabels: mockResidueLabels, residueToAtomIds: mockResidueToAtomIds });
    expect(setSelectedResidueIds).toHaveBeenCalledWith(['1']);
  });

  it('does nothing if viewerRef.current is null', () => {
    const setResidueInfo = vi.fn();
    const setSelectedResidueIds = vi.fn();
    renderHook(() =>
      useUpdateResidueInfo(
        { current: null } as any,
        'ref1',
        {},
        'A',
        setResidueInfo,
        [],
        setSelectedResidueIds,
        'TestLabel'
      )
    );
    expect(setResidueInfo).not.toHaveBeenCalled();
    expect(setSelectedResidueIds).not.toHaveBeenCalled();
  });
});
