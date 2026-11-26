/**
 * Tests for ordered per-dataset chain and residue selection state.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT.
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-26
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChainSelections } from './useChainSelections';

describe('useChainSelections', () => {
  it('keeps each chain and its residue IDs in one ordered selection', () => {
    const { result } = renderHook(() => useChainSelections());
    act(() => {
      result.current.setChain(0, 'A');
      result.current.setResidues(0, ['194:A', '194:B']);
      result.current.setChain(1, 'B');
      result.current.setResidues(1, []);
      result.current.setChain(2, 'C');
      result.current.setResidues(2, ['3']);
      result.current.setAdditionalChains(['D', 'E']);
      result.current.setResidues(3, ['7']);
      result.current.setResidues(4, []);
    });
    expect(result.current.slots).toEqual([
      { chainId: 'A', residueIds: ['194:A', '194:B'] },
      { chainId: 'B', residueIds: [] },
      { chainId: 'C', residueIds: ['3'] },
      { chainId: 'D', residueIds: ['7'] },
      { chainId: 'E', residueIds: [] },
    ]);
  });

  it('retains existing extra selections on append and discards removed selections', () => {
    const { result } = renderHook(() => useChainSelections());
    act(() => {
      result.current.setAdditionalChains(['D']);
      result.current.setResidues(3, ['4']);
      result.current.setAdditionalChains(['D', 'E']);
      result.current.setResidues(4, []);
    });
    expect(result.current.slots.slice(3)).toEqual([
      { chainId: 'D', residueIds: ['4'] },
      { chainId: 'E', residueIds: [] },
    ]);
    act(() => result.current.setAdditionalChains([]));
    act(() => result.current.setAdditionalChains(['D']));
    expect(result.current.slots[3]).toEqual({ chainId: 'D', residueIds: null });
  });

  it('keeps datasets independent and distinguishes an empty selection from the default', () => {
    const { result } = renderHook(() => [useChainSelections(), useChainSelections()] as const);
    act(() => {
      result.current[0].setAdditionalChains(['A']);
      result.current[1].setAdditionalChains(['A']);
      result.current[0].setResidues(3, []);
    });

    expect(result.current[0].slots[3].residueIds).toEqual([]);
    expect(result.current[1].slots[3].residueIds).toBeNull();
  });

  it('initializes a replacement chain without carrying the old residue selection', () => {
    const { result } = renderHook(() => useChainSelections());
    act(() => {
      result.current.setChain(0, 'A');
      result.current.setResidues(0, ['194:A']);
      result.current.setChain(0, 'B');
    });
    expect(result.current.slots[0]).toEqual({ chainId: 'B', residueIds: null });
  });
});
