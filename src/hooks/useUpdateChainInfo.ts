/**
 * Custom hook to update chain info and subunit-to-chain mapping for a Mol* structure.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-07-23
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { useEffect, useRef } from 'react';
import { getChainInfo } from '../utils/chain';
import { RpNameLookupBySpecies } from '../utils/rpNameTable';
import { getSubunitToChainIds } from '../utils/subunit';

/**
 * Custom hook to update chain info and subunit-to-chain mapping for a Mol* structure.
 *
 * @param pluginRef - Ref to the Mol* plugin UI context.
 * @param structureRef - Structure reference string.
 * @param molstar - Molstar viewer instance.
 * @param setChainInfo - Setter for chain info state.
 * @param setSubunitToChainIds - Setter for subunit-to-chain mapping state.
 * @param label - Optional label for logging/debugging.
 * @param rpNameLookup - Optional Map<uniprotCode, familyName> from parseRpNameTable() to
 *   enrich chain labels with gene family names (e.g. "uS2 [AA]" instead of "AA [auth A]").
 */
export function useUpdateChainInfo(
  pluginRef: React.RefObject<any>,
  structureRef: string | null,
  molstar: any,
  setChainInfo: React.Dispatch<React.SetStateAction<{ chainLabels: Map<string, string> }>>,
  setSubunitToChainIds: React.Dispatch<React.SetStateAction<Map<string, Set<string>>>>,
  label?: string,
  rpNameLookup?: Map<string, string> | RpNameLookupBySpecies,
  geneNameLookup?: Record<string, string | null>,
  onUniprotAccessionsDiscovered?: (accessions: Iterable<string>) => void,
  showUniprotAccessionInChainLabels = true,
  chainToUniprotOverride?: Map<string, string>,
  chainToMoleculeNameOverride?: Map<string, string>
) {
  const lastLoggedSummaryRef = useRef<string>('');
  const lastDiscoveredAccessionsKeyRef = useRef<string>('');

  useEffect(() => {
    if (!pluginRef.current || !structureRef) return;
    // Guard: pluginRef.current.managers must exist
    if (!pluginRef.current.managers || !pluginRef.current.managers.structure || !pluginRef.current.managers.structure.hierarchy || !pluginRef.current.managers.structure.hierarchy.current) return;
    try {
      // Get structure object from plugin
      const structureObj = pluginRef.current.managers.structure.hierarchy.current.structures.find(
        (s: any) => s.cell.transform.ref === structureRef
      )?.cell.obj?.data;
      if (!structureObj) return;

      // Use getChainInfo to extract auth-based chain labels (with optional family name enrichment)
      const { chainLabels, chainToUniprot, uniprotAccessions } = getChainInfo(
        structureObj,
        rpNameLookup,
        geneNameLookup,
        showUniprotAccessionInChainLabels,
        chainToUniprotOverride,
        chainToMoleculeNameOverride
      );

      if (onUniprotAccessionsDiscovered && uniprotAccessions.size > 0) {
        const accessionsKey = Array.from(uniprotAccessions).sort().join('|');
        if (accessionsKey !== lastDiscoveredAccessionsKeyRef.current) {
          lastDiscoveredAccessionsKeyRef.current = accessionsKey;
          onUniprotAccessionsDiscovered(uniprotAccessions);
        }
      }

      // Build subunit-to-chain mapping from structure chain IDs and keep it aligned
      // with the currently available chain labels.
      const inferred = getSubunitToChainIds(structureObj).subunitToChainIds;
      const subunitToChainIds = new Map<string, Set<string>>([
        ['All', new Set<string>()],
        ['Large', new Set<string>()],
        ['Small', new Set<string>()],
        ['Other', new Set<string>()],
      ]);

      for (const chainId of chainLabels.keys()) {
        subunitToChainIds.get('All')!.add(chainId);
      }

      for (const subunit of ['Large', 'Small', 'Other'] as const) {
        const ids = inferred.get(subunit);
        if (!ids) continue;
        for (const chainId of ids) {
          if (chainLabels.has(chainId)) subunitToChainIds.get(subunit)!.add(chainId);
        }
      }

      // Ensure every labeled chain is assigned to at least one specific subunit bucket.
      for (const chainId of chainLabels.keys()) {
        if (!subunitToChainIds.get('Large')!.has(chainId) && !subunitToChainIds.get('Small')!.has(chainId)) {
          subunitToChainIds.get('Other')!.add(chainId);
        }
      }

      if (chainLabels.size === 0) {
        // eslint-disable-next-line no-console
        console.warn(`[useUpdateChainInfo][${label}] No valid chains found in structure. State not updated.`);
        return;
      }
      // Only update state if changed (deep equality)
      setChainInfo(prev => {
        const prevLabels = prev.chainLabels;
        let changed = chainLabels.size !== prevLabels.size;
        if (!changed) {
          for (const [k, v] of chainLabels) {
            if (!prevLabels.has(k) || prevLabels.get(k) !== v) {
              changed = true;
              break;
            }
          }
        }
        if (changed) return { chainLabels };
        return prev;
      });
      setSubunitToChainIds(prev => {
        let changed = subunitToChainIds.size !== prev.size;
        if (!changed) {
          for (const [k, v] of subunitToChainIds) {
            const prevSet = prev.get(k);
            if (!prevSet || prevSet.size !== v.size) {
              changed = true;
              break;
            }
            for (const val of v) {
              if (!prevSet.has(val)) {
                changed = true;
                break;
              }
            }
            if (changed) break;
          }
        }
        if (changed) return subunitToChainIds;
        return prev;
      });

      if (process.env.NODE_ENV !== 'test') {
        const mappedAccessions = chainToUniprot.size;
        const labelsWithAccession = mappedAccessions > 0
          ? Array.from(chainToUniprot.entries()).filter(([chainId, accession]) => {
              const labelText = chainLabels.get(chainId) ?? '';
              return labelText.includes(accession);
            }).length
          : 0;
        const summary = `${label}|${showUniprotAccessionInChainLabels ? 'on' : 'off'}|${chainLabels.size}|${mappedAccessions}|${labelsWithAccession}`;
        if (summary !== lastLoggedSummaryRef.current) {
          lastLoggedSummaryRef.current = summary;
          console.info(
            `[useUpdateChainInfo][${label}] toggle=${showUniprotAccessionInChainLabels ? 'on' : 'off'} ` +
            `chains=${chainLabels.size} mappedAccessions=${mappedAccessions} labelsWithAccession=${labelsWithAccession}`
          );
        }
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[useUpdateChainInfo][${label}] failed:`, err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginRef, structureRef, molstar, setChainInfo, setSubunitToChainIds, label, rpNameLookup, geneNameLookup, onUniprotAccessionsDiscovered, showUniprotAccessionInChainLabels, chainToUniprotOverride, chainToMoleculeNameOverride]);
}
