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
import { focusLociOnChain, focusLociOnResidue } from '../utils/structure';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';

// Helper for fog setters
export function makeFogSetters(setFog: React.Dispatch<React.SetStateAction<{ enabled: boolean; near: number; far: number }>>) {
    return {
        setEnabled: (val: boolean) => setFog(fog => ({ ...fog, enabled: val })),
        setNear: (val: number) => setFog(fog => ({ ...fog, near: val })),
        setFar: (val: number) => setFog(fog => ({ ...fog, far: val })),
    };
}

// Helper for camera setters
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
    property: 'entity-test' | 'chain-test' | 'residue-test' | 'atom-test' | 'group-by',
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
    zoomMinRadius?: number
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
            } else if (property === 'residue-test') {
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
    zoomExtraRadius,
    zoomMinRadius
}: {
    pluginRef: React.RefObject<PluginUIContext | null>,
    structureRef: string | null,
    property: 'entity-test' | 'chain-test' | 'residue-test' | 'atom-test' | 'group-by',
    chainId: string,
    sync: boolean,
    syncPluginRef?: React.RefObject<PluginUIContext | null>,
    residueId?: string,
    insCode?: string,
    syncStructureRef?: string | null,
    syncChainId?: string,
    syncResidueId?: string,
    syncInsCode?: string,
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
        zoomMinRadius
    );
}