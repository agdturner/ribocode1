/**
 * Helper functions for viewer interactions, such as creating setters for fog and camera properties, and handlers for zooming to specific selections in the structure.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { focusLociOnChain, focusLociOnResidue, focusLociOnResidues, focusLociOnSubunit, highlightLociOnChain, highlightLociOnResidues, highlightLociOnSubunit, inspectLociOnChain, inspectLociOnResidues, inspectLociOnSubunit, unhighlightLociOnChain, unhighlightLociOnResidues, unhighlightLociOnSubunit } from '../utils/structure';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';

// Helper for fog setters
export function makeFogSetters(setFog: React.Dispatch<React.SetStateAction<{ enabled: boolean; near: number; far: number }>>) {
    return {
        setEnabled: (val: boolean) => setFog(fog => ({ ...fog, enabled: val })),
        setNear: (val: number) => setFog(fog => ({ ...fog, near: val })),
        setFar: (val: number) => setFog(fog => ({ ...fog, far: val })),
    };
}

// Helper for clipping setters (Mol* cameraClipping: minNear + clipRadius)
export function makeClippingSetters(
    setClipping: React.Dispatch<React.SetStateAction<{ minNear: number; clipRadius: number }>>
) {
    return {
        setMinNear: (val: number) => setClipping(clipping => ({ ...clipping, minNear: val })),
        setClipRadius: (val: number) => setClipping(clipping => ({ ...clipping, clipRadius: val })),
    };
}

// Backward-compatible alias for older camera naming.
export function makeCameraSetters(setCamera: React.Dispatch<React.SetStateAction<{ near: number; far: number }>>) {
    return {
        setNear: (val: number) => setCamera(camera => ({ ...camera, near: val })),
        setFar: (val: number) => setCamera(camera => ({ ...camera, far: val })),
    };
}

// Handler to zoom to a selection
export function createZoomHandler(
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    property: 'entity-test' | 'chain-test' | 'residue-test' | 'subunit-test' | 'atom-test' | 'group-by',
    chainId: string,
    sync: boolean = false,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    residueId?: string,
    insCode?: string,
    syncStructureRef?: string | null,
    syncChainId?: string,
    syncResidueId?: string,
    syncInsCode?: string,
    zoomExtraRadius?: number,
    zoomMinRadius?: number,
    chainIds?: string[],
    syncChainIds?: string[],
    residueIds?: string[],
    syncResidueIds?: string[],
    residueInsCodes?: Record<string, string | undefined>,
    syncResidueInsCodes?: Record<string, string | undefined>
) {
    return {
        handleButtonClick: async () => {
            const plugin = pluginRef.current;
            if (!plugin || !structureRef) return;
            if (property === 'chain-test') {
                focusLociOnChain(
                    plugin,
                    structureRef,
                    chainId,
                    sync && syncPluginRef?.current ? syncPluginRef.current : undefined,
                    undefined,        // use default getChainLociFn
                    zoomExtraRadius,
                    zoomMinRadius,
                    syncStructureRef ?? undefined,
                    syncChainId
                );
            } else if (property === 'subunit-test') {
                focusLociOnSubunit(
                    plugin,
                    structureRef,
                    chainIds ?? [],
                    sync && syncPluginRef?.current ? syncPluginRef.current : undefined,
                    zoomExtraRadius,
                    zoomMinRadius,
                    syncStructureRef ?? undefined,
                    syncChainIds
                );
            } else if (property === 'residue-test') {
                const selectedResidueIds = (residueIds ?? []).filter(Boolean);
                if (selectedResidueIds.length > 0) {
                    focusLociOnResidues(
                        plugin,
                        structureRef,
                        chainId,
                        selectedResidueIds,
                        residueInsCodes,
                        sync && syncPluginRef?.current ? syncPluginRef.current : undefined,
                        zoomExtraRadius,
                        zoomMinRadius,
                        syncStructureRef ?? undefined,
                        syncChainId,
                        syncResidueIds,
                        syncResidueInsCodes
                    );
                } else {
                    focusLociOnResidue(
                        plugin,
                        structureRef,
                        chainId,
                        residueId ?? '',
                        insCode,
                        sync && syncPluginRef?.current ? syncPluginRef.current : undefined,
                        zoomExtraRadius,
                        zoomMinRadius,
                        undefined,
                        syncStructureRef ?? undefined,
                        syncChainId,
                        syncResidueId,
                        syncInsCode
                    );
                }
            } else {
                // fallback: use chain loci for other property types for now
                focusLociOnChain(
                    plugin,
                    structureRef,
                    chainId
                );
            }
        }
    };
}

// Helper to create zoom handlers for chain or residue
export function makeZoomHandler({
    pluginRef,
    structureRef,
    property,
    chainId,
    sync,
    syncPluginRef,
    residueId,
    insCode,
    syncStructureRef,
    syncChainId,
    syncResidueId,
    syncInsCode,
    chainIds,
    syncChainIds,
    residueIds,
    syncResidueIds,
    residueInsCodes,
    syncResidueInsCodes,
    zoomExtraRadius,
    zoomMinRadius
}: {
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    property: 'entity-test' | 'chain-test' | 'residue-test' | 'subunit-test' | 'atom-test' | 'group-by',
    chainId: string,
    sync: boolean,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    residueId?: string,
    insCode?: string,
    syncStructureRef?: string | null,
    syncChainId?: string,
    syncResidueId?: string,
    syncInsCode?: string,
    chainIds?: string[],
    syncChainIds?: string[],
    residueIds?: string[],
    syncResidueIds?: string[],
    residueInsCodes?: Record<string, string | undefined>,
    syncResidueInsCodes?: Record<string, string | undefined>,
    zoomExtraRadius?: number,
    zoomMinRadius?: number
}) {
    return createZoomHandler(
        pluginRef,
        structureRef,
        property,
        chainId,
        sync,
        syncPluginRef,
        residueId,
        insCode,
        syncStructureRef,
        syncChainId,
        syncResidueId,
        syncInsCode,
        zoomExtraRadius,
        zoomMinRadius,
        chainIds,
        syncChainIds,
        residueIds,
        syncResidueIds,
        residueInsCodes,
        syncResidueInsCodes
    );
}

// Handler to highlight a selected chain.
export function createChainHighlightHandler(
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainId: string,
    sync: boolean = false,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainId?: string
) {
    return {
        handleButtonClick: async () => {
            const plugin = pluginRef.current;
            if (!plugin || !structureRef || !chainId) return;
            highlightLociOnChain(
                plugin,
                structureRef,
                chainId,
                sync && syncPluginRef?.current ? syncPluginRef.current : undefined,
                undefined,
                syncStructureRef ?? undefined,
                syncChainId
            );
        }
    };
}

export function makeChainHighlightHandler({
    pluginRef,
    structureRef,
    chainId,
    sync,
    syncPluginRef,
    syncStructureRef,
    syncChainId,
}: {
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainId: string,
    sync: boolean,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainId?: string,
}) {
    return createChainHighlightHandler(
        pluginRef,
        structureRef,
        chainId,
        sync,
        syncPluginRef,
        syncStructureRef,
        syncChainId
    );
}

function clearStructureFocus(plugin: PluginUIContext | null | undefined) {
    if (!plugin) return;
    plugin.managers.structure?.focus?.clear?.();
}

export function createChainHighlightToggleHandler(
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainId: string,
    isHighlighted: boolean,
    setIsHighlighted: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean = false,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainId?: string
) {
    return {
        handleButtonClick: async () => {
            const plugin = pluginRef.current;
            const syncPlugin = sync && syncPluginRef?.current ? syncPluginRef.current : undefined;

            if (isHighlighted) {
                if (plugin && structureRef && chainId) {
                    unhighlightLociOnChain(
                        plugin,
                        structureRef,
                        chainId,
                        syncPlugin,
                        undefined,
                        syncStructureRef ?? undefined,
                        syncChainId
                    );
                }
                setIsHighlighted(false);
                return;
            }

            if (!plugin || !structureRef || !chainId) return;

            highlightLociOnChain(
                plugin,
                structureRef,
                chainId,
                syncPlugin,
                undefined,
                syncStructureRef ?? undefined,
                syncChainId
            );
            setIsHighlighted(true);
        }
    };
}

export function makeChainHighlightToggleHandler({
    pluginRef,
    structureRef,
    chainId,
    isHighlighted,
    setIsHighlighted,
    sync,
    syncPluginRef,
    syncStructureRef,
    syncChainId,
}: {
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainId: string,
    isHighlighted: boolean,
    setIsHighlighted: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainId?: string,
}) {
    return createChainHighlightToggleHandler(
        pluginRef,
        structureRef,
        chainId,
        isHighlighted,
        setIsHighlighted,
        sync,
        syncPluginRef,
        syncStructureRef,
        syncChainId
    );
}

export function createResidueHighlightToggleHandler(
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainId: string,
    residueIds: string[],
    residueInsCodes: Record<string, string | undefined> | undefined,
    isHighlighted: boolean,
    setIsHighlighted: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean = false,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainId?: string,
    syncResidueIds?: string[],
    syncResidueInsCodes?: Record<string, string | undefined>
) {
    return {
        handleButtonClick: async () => {
            const plugin = pluginRef.current;
            const syncPlugin = sync && syncPluginRef?.current ? syncPluginRef.current : undefined;

            if (isHighlighted) {
                if (plugin && structureRef && chainId && residueIds.length > 0) {
                    unhighlightLociOnResidues(
                        plugin,
                        structureRef,
                        chainId,
                        residueIds,
                        residueInsCodes,
                        syncPlugin,
                        syncStructureRef ?? undefined,
                        syncChainId,
                        syncResidueIds,
                        syncResidueInsCodes
                    );
                }
                setIsHighlighted(false);
                return;
            }

            if (!plugin || !structureRef || !chainId || residueIds.length === 0) return;

            highlightLociOnResidues(
                plugin,
                structureRef,
                chainId,
                residueIds,
                residueInsCodes,
                syncPlugin,
                syncStructureRef ?? undefined,
                syncChainId,
                syncResidueIds,
                syncResidueInsCodes
            );
            setIsHighlighted(true);
        }
    };
}

export function makeResidueHighlightToggleHandler({
    pluginRef,
    structureRef,
    chainId,
    residueIds,
    residueInsCodes,
    isHighlighted,
    setIsHighlighted,
    sync,
    syncPluginRef,
    syncStructureRef,
    syncChainId,
    syncResidueIds,
    syncResidueInsCodes,
}: {
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainId: string,
    residueIds: string[],
    residueInsCodes?: Record<string, string | undefined>,
    isHighlighted: boolean,
    setIsHighlighted: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainId?: string,
    syncResidueIds?: string[],
    syncResidueInsCodes?: Record<string, string | undefined>,
}) {
    return createResidueHighlightToggleHandler(
        pluginRef,
        structureRef,
        chainId,
        residueIds,
        residueInsCodes,
        isHighlighted,
        setIsHighlighted,
        sync,
        syncPluginRef,
        syncStructureRef,
        syncChainId,
        syncResidueIds,
        syncResidueInsCodes
    );
}

export function createSubunitHighlightToggleHandler(
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainIds: string[],
    isHighlighted: boolean,
    setIsHighlighted: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean = false,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainIds?: string[]
) {
    return {
        handleButtonClick: async () => {
            const plugin = pluginRef.current;
            const syncPlugin = sync && syncPluginRef?.current ? syncPluginRef.current : undefined;

            if (isHighlighted) {
                if (plugin && structureRef && chainIds.length > 0) {
                    unhighlightLociOnSubunit(
                        plugin,
                        structureRef,
                        chainIds,
                        syncPlugin,
                        syncStructureRef ?? undefined,
                        syncChainIds
                    );
                }
                setIsHighlighted(false);
                return;
            }

            if (!plugin || !structureRef || chainIds.length === 0) return;

            highlightLociOnSubunit(
                plugin,
                structureRef,
                chainIds,
                syncPlugin,
                syncStructureRef ?? undefined,
                syncChainIds
            );
            setIsHighlighted(true);
        }
    };
}

export function createChainInspectToggleHandler(
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainId: string,
    isInspecting: boolean,
    setIsInspecting: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean = false,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainId?: string
) {
    return {
        handleButtonClick: async () => {
            const plugin = pluginRef.current;
            const syncPlugin = sync && syncPluginRef?.current ? syncPluginRef.current : undefined;

            if (isInspecting) {
                clearStructureFocus(plugin);
                clearStructureFocus(syncPlugin);
                setIsInspecting(false);
                return;
            }

            if (!plugin || !structureRef || !chainId) return;

            inspectLociOnChain(
                plugin,
                structureRef,
                chainId,
                syncPlugin,
                undefined,
                syncStructureRef ?? undefined,
                syncChainId
            );
            setIsInspecting(true);
        }
    };
}

export function makeChainInspectToggleHandler({
    pluginRef,
    structureRef,
    chainId,
    isInspecting,
    setIsInspecting,
    sync,
    syncPluginRef,
    syncStructureRef,
    syncChainId,
}: {
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainId: string,
    isInspecting: boolean,
    setIsInspecting: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainId?: string,
}) {
    return createChainInspectToggleHandler(
        pluginRef,
        structureRef,
        chainId,
        isInspecting,
        setIsInspecting,
        sync,
        syncPluginRef,
        syncStructureRef,
        syncChainId
    );
}

export function createResidueInspectToggleHandler(
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainId: string,
    residueIds: string[],
    residueInsCodes: Record<string, string | undefined> | undefined,
    isInspecting: boolean,
    setIsInspecting: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean = false,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainId?: string,
    syncResidueIds?: string[],
    syncResidueInsCodes?: Record<string, string | undefined>
) {
    return {
        handleButtonClick: async () => {
            const plugin = pluginRef.current;
            const syncPlugin = sync && syncPluginRef?.current ? syncPluginRef.current : undefined;

            if (isInspecting) {
                clearStructureFocus(plugin);
                clearStructureFocus(syncPlugin);
                setIsInspecting(false);
                return;
            }

            if (!plugin || !structureRef || !chainId || residueIds.length === 0) return;

            inspectLociOnResidues(
                plugin,
                structureRef,
                chainId,
                residueIds,
                residueInsCodes,
                syncPlugin,
                syncStructureRef ?? undefined,
                syncChainId,
                syncResidueIds,
                syncResidueInsCodes
            );
            setIsInspecting(true);
        }
    };
}

export function makeResidueInspectToggleHandler({
    pluginRef,
    structureRef,
    chainId,
    residueIds,
    residueInsCodes,
    isInspecting,
    setIsInspecting,
    sync,
    syncPluginRef,
    syncStructureRef,
    syncChainId,
    syncResidueIds,
    syncResidueInsCodes,
}: {
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainId: string,
    residueIds: string[],
    residueInsCodes?: Record<string, string | undefined>,
    isInspecting: boolean,
    setIsInspecting: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainId?: string,
    syncResidueIds?: string[],
    syncResidueInsCodes?: Record<string, string | undefined>,
}) {
    return createResidueInspectToggleHandler(
        pluginRef,
        structureRef,
        chainId,
        residueIds,
        residueInsCodes,
        isInspecting,
        setIsInspecting,
        sync,
        syncPluginRef,
        syncStructureRef,
        syncChainId,
        syncResidueIds,
        syncResidueInsCodes
    );
}

export function createSubunitInspectToggleHandler(
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainIds: string[],
    isInspecting: boolean,
    setIsInspecting: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean = false,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainIds?: string[]
) {
    return {
        handleButtonClick: async () => {
            const plugin = pluginRef.current;
            const syncPlugin = sync && syncPluginRef?.current ? syncPluginRef.current : undefined;

            if (isInspecting) {
                clearStructureFocus(plugin);
                clearStructureFocus(syncPlugin);
                setIsInspecting(false);
                return;
            }

            if (!plugin || !structureRef || chainIds.length === 0) return;

            inspectLociOnSubunit(
                plugin,
                structureRef,
                chainIds,
                syncPlugin,
                syncStructureRef ?? undefined,
                syncChainIds
            );
            setIsInspecting(true);
        }
    };
}

export function makeSubunitInspectToggleHandler({
    pluginRef,
    structureRef,
    chainIds,
    isInspecting,
    setIsInspecting,
    sync,
    syncPluginRef,
    syncStructureRef,
    syncChainIds,
}: {
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainIds: string[],
    isInspecting: boolean,
    setIsInspecting: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainIds?: string[],
}) {
    return createSubunitInspectToggleHandler(
        pluginRef,
        structureRef,
        chainIds,
        isInspecting,
        setIsInspecting,
        sync,
        syncPluginRef,
        syncStructureRef,
        syncChainIds
    );
}

export function makeSubunitHighlightToggleHandler({
    pluginRef,
    structureRef,
    chainIds,
    isHighlighted,
    setIsHighlighted,
    sync,
    syncPluginRef,
    syncStructureRef,
    syncChainIds,
}: {
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    chainIds: string[],
    isHighlighted: boolean,
    setIsHighlighted: React.Dispatch<React.SetStateAction<boolean>>,
    sync: boolean,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    syncStructureRef?: string | null,
    syncChainIds?: string[],
}) {
    return createSubunitHighlightToggleHandler(
        pluginRef,
        structureRef,
        chainIds,
        isHighlighted,
        setIsHighlighted,
        sync,
        syncPluginRef,
        syncStructureRef,
        syncChainIds
    );
}