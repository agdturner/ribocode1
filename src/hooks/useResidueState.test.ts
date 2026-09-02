/**
 * Test suite for useResidueState hook.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useResidueState } from './useResidueState';
import { ResidueLabelInfo } from '../utils/residue';

describe('useResidueState', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useResidueState());
    expect(result.current.residueInfo.residueLabels.size).toBe(0);
    expect(Object.keys(result.current.residueInfo.residueToAtomIds).length).toBe(0);
    expect(result.current.selectedResidueIds).toEqual([]);
    expect(result.current.selectedResidueId).toBe('');
  });

  it('should update residueInfo and selectedResidueIds', () => {
    const { result } = renderHook(() => useResidueState());
    const label: ResidueLabelInfo = {
      id: '1',
      name: 'ALA 1',
      compId: 'ALA',
      seqNumber: 1,
      insCode: ''
    };
    act(() => {
      result.current.setResidueInfo({
        residueLabels: new Map([['1', label]]),
        residueToAtomIds: { '1': ['a1', 'a2'] },
      });
      result.current.setSelectedResidueIds(['1']);
    });
    expect(result.current.residueInfo.residueLabels.get('1')).toEqual(label);
    expect(result.current.residueInfo.residueToAtomIds['1']).toEqual(['a1', 'a2']);
    expect(result.current.selectedResidueIds).toEqual(['1']);
    expect(result.current.selectedResidueId).toBe('1');
  });
});
