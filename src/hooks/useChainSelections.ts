/**
 * Ordered chain and residue selection state for one dataset.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT.
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-26
 */
import { useCallback, useMemo, useState } from 'react';

export interface ChainSelection {
  chainId: string;
  residueIds: string[] | null;
}

const emptySlot = (): ChainSelection => ({ chainId: '', residueIds: [] });
const equalIds = (a: string[] | null, b: string[] | null) =>
  a === b || (a !== null && b !== null && a.length === b.length && a.every((id, i) => id === b[i]));

export function useChainSelections() {
  const [slots, setSlots] = useState<ChainSelection[]>(() => [emptySlot(), emptySlot(), emptySlot()]);

  const setChain = useCallback((index: number, chainId: string) => {
    setSlots(current => {
      if (current[index].chainId === chainId) return current;
      const next = current.slice();
      next[index] = { chainId, residueIds: null };
      return next;
    });
  }, []);

  const setResidues = useCallback((index: number, residueIds: string[] | null) => {
    setSlots(current => {
      if (equalIds(current[index].residueIds, residueIds)) return current;
      const next = current.slice();
      next[index] = { ...current[index], residueIds };
      return next;
    });
  }, []);

  const setAdditionalChains = useCallback((chainIds: string[]) => {
    setSlots(current => {
      const previous = current.slice(3);
      if (previous.length === chainIds.length && previous.every((slot, i) => slot.chainId === chainIds[i])) return current;
      return [
        ...current.slice(0, 3),
        ...chainIds.map(chainId => previous.find(slot => slot.chainId === chainId) ?? { chainId, residueIds: null }),
      ];
    });
  }, []);

  const setAdditionalResidues = useCallback((update: React.SetStateAction<Map<string, string[]>>) => {
    setSlots(current => {
      const previous = new Map(current.slice(3).flatMap(slot =>
        slot.residueIds === null ? [] : [[slot.chainId, slot.residueIds] as const]));
      const nextMap = typeof update === 'function' ? update(previous) : update;
      let changed = false;
      const next = current.map((slot, i) => {
        if (i < 3) return slot;
        const residueIds = nextMap.get(slot.chainId) ?? null;
        if (equalIds(slot.residueIds, residueIds)) return slot;
        changed = true;
        return { ...slot, residueIds };
      });
      return changed ? next : current;
    });
  }, []);

  const fixedSetters = useMemo(() => [0, 1, 2].map(index => ({
    setChain: (chainId: string) => setChain(index, chainId),
    setResidues: (ids: string[]) => setResidues(index, ids),
    resetResidues: () => setResidues(index, null),
    setResidue: (id: string) => setResidues(index, id ? [id] : []),
  })), [setChain, setResidues]);
  // Keep the chain list stable when only residue selections change.
  const extraChainKey = JSON.stringify(slots.slice(3).map(slot => slot.chainId));
  const additionalChains = useMemo(() => JSON.parse(extraChainKey) as string[], [extraChainKey]);
  const additionalResidues = useMemo(() => new Map(slots.slice(3).flatMap(slot =>
    slot.residueIds === null ? [] : [[slot.chainId, slot.residueIds] as const])), [slots]);

  return { slots, setChain, setResidues, fixedSetters, setAdditionalChains, additionalChains, additionalResidues, setAdditionalResidues };
}
