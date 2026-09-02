/**
 * Custom React hook for managing residue state, including residue labels and selected residue ID.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { useState } from 'react';
import { ResidueLabelInfo } from '../utils/residue';

// Define the shape of the residue information state
export interface ResidueInfo {
  residueLabels: Map<string, ResidueLabelInfo>;
  residueToAtomIds: Record<string, string[]>;
}

/**
 * Custom React hook for managing residue state.
 * @param initialSelected The initial selected residue ID, default is an empty string.
 * @returns Residue info plus multi-selection and convenience first-selected accessors.
 */
export function useResidueState(initialSelected: string = '') {
  const [residueInfo, setResidueInfo] = useState<ResidueInfo>({ residueLabels: new Map(), residueToAtomIds: {} });
  const [selectedResidueIds, setSelectedResidueIds] = useState<string[]>(initialSelected ? [initialSelected] : []);
  const selectedResidueId = selectedResidueIds[0] ?? '';
  const setSelectedResidueId = (id: string) => setSelectedResidueIds(id ? [id] : []);
  return {
    residueInfo,
    setResidueInfo,
    selectedResidueIds,
    setSelectedResidueIds,
    selectedResidueId,
    setSelectedResidueId,
  };
}
