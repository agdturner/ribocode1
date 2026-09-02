/**
 * Custom React hook for managing Mol* viewer state and representations.
 * Encapsulates all logic for structure and representation tracking, robustly updating
 * UI state in sync with Mol*'s internal state. Designed for use in dual-viewer
 * ribosome alignment/visualization apps.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getChainInfo } from '../utils/chain';
import { getResidueInfo, ResidueLabelInfo } from '../utils/residue';
import { AlignedTo, Aligned } from '../constants/ribocode';
import { AllowedRepresentationType } from '../types/ribocode';
import { StructureComponentRef } from 'molstar/lib/mol-plugin-state/manager/structure/hierarchy-state';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';

/**
 * State and helper functions for managing a Mol* viewer instance.
 * @param pluginRef Reference to the Mol* PluginUIContext instance.
 * @param structureRefs Mapping of structure keys to their references.
 * @param setStructureRef Function to set a structure reference by key.
 * @param representationRefs Mapping of structure keys to arrays of representation references.
 * @param setRepresentationRefs Function to set representation references by structure key.
 * @param lastAddedRepresentationRef Mapping of structure keys to the last added representation reference.
 * @param setLastAddedRepresentationRef Function to set the last added representation reference by structure key.
 * @param refreshRepresentationRefs Function to refresh representation references for a given structure key.
 * @param addRepresentation Function to add a new representation to a structure.
 * @param getChainIds Function to retrieve chain IDs from a structure reference.
 * @param repIdMap Mapping of structure keys to representation ID-to-reference mappings.
 * @param setRepIdMap Function to set the representation ID-to-reference mapping for a structure key.
 * @param getResidueIds Function to retrieve residue IDs for a given chain in a structure reference.
 * @return An object containing the Mol* viewer state and helper functions.
 */
export interface MolstarViewerState {
    pluginRef: React.RefObject<PluginUIContext | null>;
    structureRefs: Record<string, string | null>;
    setStructureRef: (key: string, ref: string | null) => void;
    representationRefs: Record<string, string[]>;
    setRepresentationRefs: (key: string, refs: string[]) => void;
    lastAddedRepresentationRef: Record<string, string | null>;
    setLastAddedRepresentationRef: (key: string, ref: string | null) => void;
    refreshRepresentationRefs: (key: string, structureRef: string) => void;
    addRepresentation: (
        key: string,
        structureRef: string,
        type: AllowedRepresentationType,
        colorTheme: { name: string; params?: Record<string, unknown> },
        repId?: string,
        visible?: boolean
    ) => Promise<string>;
    getChainInfo: (structure: any) => { 
        chainLabels: Map<string, string>;};
    repIdMap: Record<string, Record<string, string>>;
    repIdMapRef: React.RefObject<Record<string, Record<string, string>>>;
    setRepIdMap: (key: string, map: Record<string, string>) => void;
    getResidueInfo: (molecule: any, chainId: string) => {
        residueLabels: Map<string, ResidueLabelInfo>;
        residueToAtomIds: Record<string, string[]>;
    };
}

/**
 * Custom hook to manage Mol* viewer state and helper functions.
 * @returns An object containing the Mol* viewer state and helper functions.
 */
export function useMolstarViewer(pluginRef: React.RefObject<PluginUIContext | null>): MolstarViewerState {

    // --- HOOKS: All hooks must be at the top level ---

    // Generalized state for arbitrary structure keys (including realigned IDs)
    const [structureRefs, setStructureRefs] = useState<Record<string, string | null>>({});
    const setStructureRef = useCallback((key: string, ref: string | null) => {
        setStructureRefs(prev => ({ ...prev, [key]: ref }));
    }, []);

    const [representationRefs, setRepresentationRefsState] = useState<Record<string, string[]>>({});
    const setRepresentationRefs = useCallback((key: string, refs: string[]): void => {
        setRepresentationRefsState(prev => ({ ...prev, [key]: refs }));
    }, []);

    const [lastAddedRepresentationRef, setLastAddedRepresentationRefState] = useState<Record<string, string | null>>({});
    const setLastAddedRepresentationRef = useCallback((key: string, ref: string | null): void => {
        setLastAddedRepresentationRefState(prev => ({ ...prev, [key]: ref }));
    }, []);

    const [repIdMapState, setRepIdMapState] = useState<Record<string, Record<string, string>>>({});
    const repIdMapRef = useRef<Record<string, Record<string, string>>>({});
    const setRepIdMap = useCallback((key: string, map: Record<string, string>) => {
        repIdMapRef.current = { ...repIdMapRef.current, [key]: map };
        setRepIdMapState(prev => ({ ...prev, [key]: map }));
    }, []);

    /**
     * Debounce utility (not a hook).
     * Returns a debounced version of the given function.
     */
    function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        return (...args: Parameters<T>) => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), delay);
        };
    }

    // Debounced refresh for s_AlignedTo to avoid excessive state updates
    const debouncedRefreshAlignedTo = useRef<((key: string, structureRef: string) => void) | null>(null);

    // --- END HOOKS ---

    /**
     * Color theme definition for representations.
     */
    interface ColorTheme {
        name: string;
        params?: Record<string, unknown>;
    }

    /**
     * Adds a new representation to the specified structure/component in Mol*,
     * then updates the local state to reflect all current representations.
     * Uses a short delay after .commit() to ensure Mol* state is updated before reading.
     * @param key The structure key.
     * @param structureRef The structure reference.
     * @param type The representation type.
     * @param colorTheme The color theme for the representation.
     */
    const addRepresentation = useCallback(
        async (
            key: string,
            structureRef: string,
            type: AllowedRepresentationType,
            colorTheme: ColorTheme,
            repId?: string,
            visible: boolean = true
        ): Promise<string> => {
            if (!pluginRef.current) return '';
            const plugin = pluginRef.current;
            const psd = plugin.state.data;
            // Find the structure and first polymer component
            const structs = plugin.managers.structure.hierarchy.current.structures;
            const struct = structs.find((s: { cell: { transform: { ref: string } } }) => s.cell.transform.ref === structureRef);
            if (!struct) return '';
            let targetComponentRef: string | null = null;
            let foundPolymerComp;
            if (Array.isArray(struct.components) && struct.components.length > 0) {
                foundPolymerComp = struct.components.find((comp: StructureComponentRef) => typeof comp.key === 'string' && comp.key.includes('polymer'));
                if (foundPolymerComp) targetComponentRef = foundPolymerComp.cell.transform.ref;
                else targetComponentRef = struct.components[0].cell.transform.ref;
            } else {
                // Fallback: use the root structure ref
                targetComponentRef = structureRef;
            }
            if (!targetComponentRef) return '';
            // Generate a unique repId if not provided
            const newRepId = repId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
            // Add representation without custom property
            const builder = psd.build()
                .to(targetComponentRef)
                .apply(
                    StateTransforms.Representation.StructureRepresentation3D,
                    {
                        type: { name: type, params: {} },
                        colorTheme: { name: colorTheme.name, params: colorTheme.params ?? {} }
                    }
                )
            await builder.commit();
            
            // Use builder.selector.ref which is the exact ref of the transform we just created
            // This is more reliable than trying to infer which rep is "new" by position
            const potentialNewRepRef = builder.selector.ref;
            
            // Verify it exists in the state
            const cellExists = pluginRef.current?.state?.data?.cells?.get?.(potentialNewRepRef);
            if (!cellExists) {
                console.warn(`[addRepresentation] Failed to verify representation ref ${potentialNewRepRef} exists in state for ${key}`);
                return newRepId; // Return early but still return the repId
            }

            if (!visible) {
                const { PluginCommands } = await import('molstar/lib/mol-plugin/commands');
                await PluginCommands.State.ToggleVisibility.apply(plugin, [plugin, { state: plugin.state.data, ref: potentialNewRepRef }]);
            }
            
            // Scan for all reps to update the lists for UI toggles
            let allReps: string[] = [];
            const updatedStructs = plugin.managers.structure.hierarchy.current.structures;
            const updatedStruct = updatedStructs.find((s: { cell: { transform: { ref: string } } }) => s.cell.transform.ref === structureRef);
            
            if (updatedStruct && Array.isArray(updatedStruct.components) && updatedStruct.components.length > 0) {
                for (const comp of updatedStruct.components) {
                    for (const rep of comp.representations) {
                        if (rep.cell?.transform?.ref) {
                            allReps.push(rep.cell.transform.ref);
                        }
                    }
                }
            }

            // Make the new representation ref available immediately for visibility restore
            setRepIdMap(key, { ...(repIdMapRef.current[key] || {}), [newRepId]: potentialNewRepRef });
            setRepresentationRefs(key, allReps);
            setLastAddedRepresentationRef(key, potentialNewRepRef);
            
            console.log(`[addRepresentation] Added ${type} to ${key}, repRef=${potentialNewRepRef.substring(potentialNewRepRef.length - 6)}, allReps=${allReps.length}`);
            
            return newRepId;
        },
        [pluginRef, representationRefs, setRepresentationRefs, repIdMapState, repIdMapRef, setRepIdMap]
    );

    // --- waitForPluginReady removed (unused) ---

    /**
     * Traverses the Mol* state tree for a given structureRef, collecting all
     * representation refs. Updates local state only if the set of refs has changed.
     * Used to keep UI toggles in sync with Mol*'s actual state.
     */
    const _refreshRepresentationRefs = (key: string, structureRef: string): void => {
        if (!pluginRef.current || !pluginRef.current.managers) return;
        const plugin = pluginRef.current;
        const state = plugin.state.data;
        const structureCell = state.cells.get(structureRef);
        if (!structureCell) {
            setRepresentationRefs(key, []);
            setRepIdMap(key, {});
            return;
        }
        const reps: string[] = [];
        const rootChildren = state.tree.children.get(structureRef)?.toArray?.() || [];
        function traverse(ref: string, depth = 0): void {
            const children = state.tree.children.get(ref)?.toArray?.() || [];
            for (const childRef of children) {
                const childCell = state.cells.get(childRef);
                if (
                    childCell?.obj?.type?.name === 'Representation3D' ||
                    childCell?.obj?.type?.name === 'Structure 3D'
                ) {
                    reps.push(childCell.transform.ref);
                }
                traverse(childRef, depth + 1);
            }
        }
        traverse(structureRef);
        // Assign repIds to any untracked representations
        let idMap: Record<string, string> = { ...(repIdMapState[key] || {}) };
        reps.forEach((repRef, i) => {
            // For the first rep, always assign deterministic 'default' repId
            if (i === 0) {
                idMap['default'] = repRef;
            } else if (!Object.values(idMap).includes(repRef)) {
                // For others, assign random repId if not already tracked
                const newRepId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
                idMap[newRepId] = repRef;
            }
        });
        // Remove repIds for deleted reps
        for (const [repId, repRef] of Object.entries(idMap)) {
            if (!reps.includes(repRef)) {
                delete idMap[repId];
            }
        }
        setRepIdMap(key, idMap);
        // Defensive: Only update if reps is non-empty or there are no root children
        if (reps.length > 0 || rootChildren.length === 0) {
            setRepresentationRefs(key, reps);
        } else {
            // If reps is empty but structureCell has children, skip update (likely race)
            console.warn('[refreshRepresentationRefs] Skipped update for', key, 'due to empty reps but non-empty children:', rootChildren);
            return;
        }
    };

    // Set up the debounced function once, safely
    useEffect(() => {
        debouncedRefreshAlignedTo.current = debounce(_refreshRepresentationRefs, 100);
    }, []);

    /**
     * Main refresh function (hook-safe). Uses debounced refresh for s_AlignedTo,
     * direct refresh for other keys.
     */
    const refreshRepresentationRefs = useCallback((key: string, structureRef: string): void => {
        if (key === AlignedTo) {
            debouncedRefreshAlignedTo.current?.(key, structureRef);
        } else {
            _refreshRepresentationRefs(key, structureRef);
        }
    }, []);

    /**
     * Whenever a structureRef changes, refresh the list of representation refs.
     * Ensures UI toggles appear/disappear in sync with Mol*'s state.
     * Only runs when structureRefs or pluginRef changes.
     */
    useEffect(() => {
        Object.entries(structureRefs).forEach(([key, ref]) => {
            if (ref) {
                refreshRepresentationRefs(key, ref);
            }
        });
        // Only run when structureRefs or pluginRef changes
    }, [structureRefs, pluginRef, refreshRepresentationRefs]);

    return {
        pluginRef,
        structureRefs,
        setStructureRef,
        representationRefs,
        setRepresentationRefs,
        lastAddedRepresentationRef,
        setLastAddedRepresentationRef,
        refreshRepresentationRefs,
        addRepresentation,
        getChainInfo,
        repIdMap: repIdMapState,
        repIdMapRef,
        setRepIdMap,
        getResidueInfo
    };
}
