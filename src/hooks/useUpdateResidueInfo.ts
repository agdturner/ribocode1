/**
 * Custom hook to update residue info for a Mol* structure and selected chain.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-06-22
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { useEffect, useRef } from 'react';
import { ResidueLabelInfo } from '../utils/residue';

/**
 * Custom hook to update residue info for a Mol* structure and selected chain.
 *
 * Whenever `selectedChainId` changes the residue list is refreshed.  If the
 * previously selected residue ID no longer exists in the new chain, the
 * selection is automatically reset to the first residue of the new chain.
 *
 * @param viewerRef - Ref to the Mol* plugin UI context.
 * @param structureRef - Structure reference string.
 * @param molstar - Molstar viewer instance.
 * @param selectedChainId - Selected chain ID.
 * @param setResidueInfo - Setter for residue info state.
 * @param selectedResidueIds - Currently selected residue IDs (read-only, via ref).
 * @param setSelectedResidueIds - Setter for selected residue IDs.
 * @param label - Optional label for logging/debugging.
 */
export function useUpdateResidueInfo(
  viewerRef: React.RefObject<any>,
  structureRef: string | null,
  molstar: any,
  selectedChainId: string,
  setResidueInfo: React.Dispatch<React.SetStateAction<{ residueLabels: Map<string, ResidueLabelInfo>; residueToAtomIds: Record<string, string[]> }>>,
    selectedResidueIds: string[],
    setSelectedResidueIds: (ids: string[]) => void,
  label?: string
) {
  // Use a ref so we can read the latest selectedResidueIds inside the effect
  // without adding it to the dependency array (which would cause infinite loops).
  const selectedResidueIdsRef = useRef(selectedResidueIds);
  selectedResidueIdsRef.current = selectedResidueIds;

  useEffect(() => {
    if (!viewerRef.current || !structureRef || !selectedChainId) return;
    try {
      // Get structure object from plugin
      const structureObj = viewerRef.current.managers.structure.hierarchy.current.structures.find(
        (s: any) => s.cell.transform.ref === structureRef
      )?.cell.obj?.data;
      if (!structureObj) return;
      // Get residue info from molstar utility
      const { residueLabels, residueToAtomIds } = molstar.getResidueInfo(structureObj, selectedChainId);
      setResidueInfo(prev => {
        const prevLabels = prev.residueLabels;
        const nextLabels = residueLabels;

        let labelsChanged = prevLabels.size !== nextLabels.size;
        if (!labelsChanged) {
          for (const [id, info] of nextLabels.entries()) {
            const prevInfo = prevLabels.get(id);
            if (!prevInfo) {
              labelsChanged = true;
              break;
            }
            if (
              prevInfo.id !== info.id
              || prevInfo.name !== info.name
              || prevInfo.compId !== info.compId
              || prevInfo.seqNumber !== info.seqNumber
              || prevInfo.insCode !== info.insCode
            ) {
              labelsChanged = true;
              break;
            }
          }
        }

        const prevResidueKeys = Object.keys(prev.residueToAtomIds);
        const nextResidueKeys = Object.keys(residueToAtomIds);
        let atomMapChanged = prevResidueKeys.length !== nextResidueKeys.length;
        if (!atomMapChanged) {
          for (const key of nextResidueKeys) {
            const prevAtoms = prev.residueToAtomIds[key] || [];
            const nextAtoms = residueToAtomIds[key] || [];
            if (prevAtoms.length !== nextAtoms.length) {
              atomMapChanged = true;
              break;
            }
            for (let i = 0; i < nextAtoms.length; i++) {
              if (prevAtoms[i] !== nextAtoms[i]) {
                atomMapChanged = true;
                break;
              }
            }
            if (atomMapChanged) break;
          }
        }

        if (!labelsChanged && !atomMapChanged) return prev;
        return { residueLabels, residueToAtomIds };
      });
      // Reset selection when the current residue ID is not in the new chain.
      // Also auto-select the first residue when nothing is selected.
      const currentIds = selectedResidueIdsRef.current;
      const validIds = currentIds.filter(id => residueLabels.has(id));
      if (validIds.length !== currentIds.length) {
        if (validIds.length > 0) {
          setSelectedResidueIds(validIds);
        } else if (residueLabels.size > 0) {
          setSelectedResidueIds([Array.from(residueLabels.keys())[0] as string]);
        } else {
          setSelectedResidueIds([]);
        }
      } else if (validIds.length === 0 && residueLabels.size > 0) {
        setSelectedResidueIds([Array.from(residueLabels.keys())[0] as string]);
      }
      // Debug logging disabled to avoid console spam; uncomment if needed:
      // if (label) console.log(`[useUpdateResidueInfo][${label}] residueLabels:`, residueLabels);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[useUpdateResidueInfo][${label}] failed:`, err);
    }
  // selectedResidueIds intentionally omitted — accessed via ref to avoid loops
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerRef, structureRef, molstar, selectedChainId, setResidueInfo, setSelectedResidueIds, label]);
}
