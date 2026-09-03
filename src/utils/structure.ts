/**
 * Utility functions for working with molecular structures in the Mol* plugin, including camera focus on specific loci, and retrieval of structure representations for session management.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { StructureElement, StructureSelection } from 'molstar/lib/mol-model/structure';
import { QueryContext } from 'molstar/lib/mol-model/structure/query/context';
import { MolScriptBuilder } from 'molstar/lib/mol-script/language/builder';
import { compile } from 'molstar/lib/mol-script/runtime/query/base';

/**
 * Focus the camera on a residue loci, with optional sync to another plugin.
 * Accepts zoom options for extraRadius and minRadius.
 */
export function focusLociOnResidue(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    residueId: string,
    insCode?: string,
    syncPlugin?: PluginUIContext,
    zoomExtraRadius?: number,
    zoomMinRadius?: number,
    getResidueLociFn: (plugin: PluginUIContext, structureRef: string, chainId: string, residueId: string, insCode?: string) => any = getResidueLoci,
    syncStructureRef?: string,
    syncChainId?: string,
    syncResidueId?: string,
    syncInsCode?: string
) {
    const loci = getResidueLociFn(plugin, structureRef, chainId, residueId, insCode);
    if (!loci) return;
    const focusOptions = (zoomExtraRadius !== undefined && zoomMinRadius !== undefined)
        ? { extraRadius: zoomExtraRadius, minRadius: zoomMinRadius }
        : undefined;
    plugin.managers.camera.focusLoci(loci, focusOptions);
    if (syncPlugin) {
        const resolvedSyncStructureRef = syncStructureRef ?? structureRef;
        const resolvedSyncChainId = syncChainId ?? chainId;
        const resolvedSyncResidueId = syncResidueId ?? residueId;
        const syncLoci = getResidueLociFn(
            syncPlugin,
            resolvedSyncStructureRef,
            resolvedSyncChainId,
            resolvedSyncResidueId,
            syncInsCode ?? insCode
        );
        if (syncLoci) {
            syncPlugin.managers.camera.focusLoci(syncLoci, focusOptions);
        }
    }
}

/**
 * Computes the loci for a given chain in a structure using Mol* APIs.
 */
export function getChainLoci(plugin: PluginUIContext, structureRef: string, chainId: string) {
    const structureObj = plugin.managers.structure.hierarchy.current.structures.find(
        s => s.cell.transform.ref === structureRef
    )?.cell.obj?.data;
    if (!structureObj) return null;
    const qb = MolScriptBuilder.struct.generator.atomGroups({
        'chain-test': MolScriptBuilder.core.rel.eq([
            MolScriptBuilder.struct.atomProperty.macromolecular.auth_asym_id(),
            chainId
        ])
    });
    const compiled = compile(qb);
    const ctx = new QueryContext(structureObj);
    const selection = compiled(ctx);
    return StructureSelection.toLociWithSourceUnits(selection);
}

/**
 * Highlight/select a chain loci in Mol* so the chosen chain is visually emphasized.
 * Uses selectOnly when available to mirror Mol* selection tool behavior.
 */
export function highlightLociOnChain(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    syncPlugin?: PluginUIContext,
    getChainLociFn: (plugin: PluginUIContext, structureRef: string, chainId: string) => any = getChainLoci,
    syncStructureRef?: string,
    syncChainId?: string
) {
    const applyHighlight = (targetPlugin: PluginUIContext, targetStructureRef: string, targetChainId: string) => {
        const loci = getChainLociFn(targetPlugin, targetStructureRef, targetChainId);
        if (!loci) return;
        const lociSelects = targetPlugin.managers.interactivity?.lociSelects;
        if (lociSelects?.selectOnly) {
            lociSelects.selectOnly({ loci }, false);
            return;
        }
        targetPlugin.managers.interactivity?.lociHighlights?.highlightOnly?.({ loci }, false);
    };

    applyHighlight(plugin, structureRef, chainId);
    if (syncPlugin) {
        applyHighlight(syncPlugin, syncStructureRef ?? structureRef, syncChainId ?? chainId);
    }
}

/**
 * Focus the camera on a chain loci, with optional sync to another plugin.
 * Accepts zoom options for extraRadius and minRadius (same as focusLociOnResidue).
 */
export function focusLociOnChain(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    syncPlugin?: PluginUIContext,
    getChainLociFn: (plugin: PluginUIContext, structureRef: string, chainId: string) => any = getChainLoci,
    zoomExtraRadius?: number,
    zoomMinRadius?: number,
    syncStructureRef?: string,
    syncChainId?: string
) {
    const loci = getChainLociFn(plugin, structureRef, chainId);
    if (!loci) return;
    const focusOptions = (zoomExtraRadius !== undefined && zoomMinRadius !== undefined)
        ? { extraRadius: zoomExtraRadius, minRadius: zoomMinRadius }
        : undefined;
    plugin.managers.camera.focusLoci(loci, focusOptions);
    if (syncPlugin) {
        const syncLoci = getChainLociFn(syncPlugin, syncStructureRef ?? structureRef, syncChainId ?? chainId);
        if (syncLoci) {
            syncPlugin.managers.camera.focusLoci(syncLoci, focusOptions);
        }
    }
}

/**
 * Computes a loci that spans all supplied chain IDs by unioning chain loci.
 */
export function getSubunitLoci(
    plugin: PluginUIContext,
    structureRef: string,
    chainIds: string[]
) {
    if (!Array.isArray(chainIds) || chainIds.length === 0) return null;
    let mergedLoci: any = null;
    for (const chainId of chainIds) {
        const loci = getChainLoci(plugin, structureRef, chainId);
        if (!loci) continue;
        if (!mergedLoci) {
            mergedLoci = loci;
            continue;
        }
        if (mergedLoci.kind === 'element-loci' && loci.kind === 'element-loci') {
            mergedLoci = StructureElement.Loci.union(mergedLoci, loci);
        }
    }
    return mergedLoci;
}

/**
 * Focus the camera on a subunit (set of chains), with optional sync to another plugin.
 */
export function focusLociOnSubunit(
    plugin: PluginUIContext,
    structureRef: string,
    chainIds: string[],
    syncPlugin?: PluginUIContext,
    zoomExtraRadius?: number,
    zoomMinRadius?: number,
    syncStructureRef?: string,
    syncChainIds?: string[]
) {
    const loci = getSubunitLoci(plugin, structureRef, chainIds);
    if (!loci) return;
    const focusOptions = (zoomExtraRadius !== undefined && zoomMinRadius !== undefined)
        ? { extraRadius: zoomExtraRadius, minRadius: zoomMinRadius }
        : undefined;
    plugin.managers.camera.focusLoci(loci, focusOptions);
    if (syncPlugin) {
        const syncLoci = getSubunitLoci(syncPlugin, syncStructureRef ?? structureRef, syncChainIds ?? chainIds);
        if (syncLoci) {
            syncPlugin.managers.camera.focusLoci(syncLoci, focusOptions);
        }
    }
}

/**
 * Highlight/focus a subunit (set of chains) using Mol* structure focus channel,
 * independent of selection and highlight marker channels.
 */
export function highlightLociOnSubunit(
    plugin: PluginUIContext,
    structureRef: string,
    chainIds: string[],
    syncPlugin?: PluginUIContext,
    syncStructureRef?: string,
    syncChainIds?: string[]
) {
    const applyFocus = (
        targetPlugin: PluginUIContext,
        targetStructureRef: string,
        targetChainIds: string[]
    ) => {
        const loci = getSubunitLoci(targetPlugin, targetStructureRef, targetChainIds);
        if (!loci) return;
        const focusManager = targetPlugin.managers.structure?.focus;
        if (focusManager?.setFromLoci) {
            focusManager.setFromLoci(loci);
            return;
        }
        if (focusManager?.set) {
            focusManager.set({ loci, label: `subunit:${targetChainIds.join(',')}` });
        }
    };

    applyFocus(plugin, structureRef, chainIds);
    if (syncPlugin) {
        applyFocus(syncPlugin, syncStructureRef ?? structureRef, syncChainIds ?? chainIds);
    }
}

/**
 * Computes the loci for a given residue in a chain, optionally with insertion code.
 */
export function getResidueLoci(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    residueId: string,
    insCode?: string
) {
    const structureObj = plugin.managers.structure.hierarchy.current.structures.find(
        s => s.cell.transform.ref === structureRef
    )?.cell.obj?.data;
    if (!structureObj) return null;
    // Build query with optional insertion code
    const parsedResidueId = (typeof residueId === 'string' && !isNaN(Number(residueId))) ? Number(residueId) : residueId;
    const tests: any = {
        'chain-test': MolScriptBuilder.core.rel.eq([
            MolScriptBuilder.struct.atomProperty.macromolecular.auth_asym_id(),
            chainId
        ]),
        'residue-test': MolScriptBuilder.core.rel.eq([
            MolScriptBuilder.struct.atomProperty.macromolecular.auth_seq_id(),
            parsedResidueId
        ])
    };
    if (insCode) {
        tests['inscode-test'] = MolScriptBuilder.core.rel.eq([
            MolScriptBuilder.struct.atomProperty.macromolecular.pdbx_PDB_ins_code(),
            insCode
        ]);
    }
    const qb = MolScriptBuilder.struct.generator.atomGroups(tests);
    const compiled = compile(qb);
    const ctx = new QueryContext(structureObj);
    const selection = compiled(ctx);
    return StructureSelection.toLociWithSourceUnits(selection);
}

/**
 * Computes a loci that spans all supplied residue IDs in a chain by unioning residue loci.
 */
export function getResiduesLoci(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    residueIds: string[],
    residueInsCodes?: Record<string, string | undefined>
) {
    if (!Array.isArray(residueIds) || residueIds.length === 0) return null;
    const uniqueResidueIds = Array.from(new Set(residueIds.filter(Boolean)));
    let mergedLoci: any = null;
    for (const residueId of uniqueResidueIds) {
        const loci = getResidueLoci(plugin, structureRef, chainId, residueId, residueInsCodes?.[residueId]);
        if (!loci) continue;
        if (!mergedLoci) {
            mergedLoci = loci;
            continue;
        }
        if (mergedLoci.kind === 'element-loci' && loci.kind === 'element-loci') {
            mergedLoci = StructureElement.Loci.union(mergedLoci, loci);
        }
    }
    return mergedLoci;
}

/**
 * Focus the camera on multiple residues in a chain, with optional sync to another plugin.
 */
export function focusLociOnResidues(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    residueIds: string[],
    residueInsCodes?: Record<string, string | undefined>,
    syncPlugin?: PluginUIContext,
    zoomExtraRadius?: number,
    zoomMinRadius?: number,
    syncStructureRef?: string,
    syncChainId?: string,
    syncResidueIds?: string[],
    syncResidueInsCodes?: Record<string, string | undefined>
) {
    const loci = getResiduesLoci(plugin, structureRef, chainId, residueIds, residueInsCodes);
    if (!loci) return;
    const focusOptions = (zoomExtraRadius !== undefined && zoomMinRadius !== undefined)
        ? { extraRadius: zoomExtraRadius, minRadius: zoomMinRadius }
        : undefined;
    plugin.managers.camera.focusLoci(loci, focusOptions);
    if (syncPlugin) {
        const syncLoci = getResiduesLoci(
            syncPlugin,
            syncStructureRef ?? structureRef,
            syncChainId ?? chainId,
            syncResidueIds ?? residueIds,
            syncResidueInsCodes ?? residueInsCodes
        );
        if (syncLoci) {
            syncPlugin.managers.camera.focusLoci(syncLoci, focusOptions);
        }
    }
}

/**
 * Highlight one or many residues in a chain, with optional sync.
 * Uses Mol* highlight channel so residue highlighting stays visually distinct
 * from chain selection highlighting.
 */
export function highlightLociOnResidues(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    residueIds: string[],
    residueInsCodes?: Record<string, string | undefined>,
    syncPlugin?: PluginUIContext,
    syncStructureRef?: string,
    syncChainId?: string,
    syncResidueIds?: string[],
    syncResidueInsCodes?: Record<string, string | undefined>
) {
    const applyHighlight = (
        targetPlugin: PluginUIContext,
        targetStructureRef: string,
        targetChainId: string,
        targetResidueIds: string[],
        targetResidueInsCodes?: Record<string, string | undefined>
    ) => {
        const loci = getResiduesLoci(targetPlugin, targetStructureRef, targetChainId, targetResidueIds, targetResidueInsCodes);
        if (!loci) return;
        const lociHighlights = targetPlugin.managers.interactivity?.lociHighlights;
        if (lociHighlights?.highlightOnly) {
            lociHighlights.highlightOnly({ loci }, false);
            return;
        }
        // Fallback for environments where highlight manager is unavailable.
        targetPlugin.managers.interactivity?.lociSelects?.selectOnly?.({ loci }, false);
    };

    applyHighlight(plugin, structureRef, chainId, residueIds, residueInsCodes);
    if (syncPlugin) {
        applyHighlight(
            syncPlugin,
            syncStructureRef ?? structureRef,
            syncChainId ?? chainId,
            syncResidueIds ?? residueIds,
            syncResidueInsCodes ?? residueInsCodes
        );
    }
}

/**
 * Utility to get all Representation3D nodes for a structure.
 *
 * This function is useful for session save/restore logic, allowing you to capture
 * and later restore the full set of 3D representations (type, parameters, color themes, etc.)
 * for a given structure in the Mol* plugin state.
 *
 * @param plugin The Mol* plugin instance.
 * @param structureRef The structure reference to inspect.
 * @returns Array of representation info objects for the structure.
 */
export function getStructureRepresentations(plugin: any, structureRef: string) {
    const state = plugin.state.data;
    const reps: Array<{
        type: string | undefined;
        colorTheme: any;
        visible: boolean;
        repRef: string;
    }> = [];

    const structures = plugin?.managers?.structure?.hierarchy?.current?.structures;
    const struct = Array.isArray(structures)
        ? structures.find((s: any) => s.cell.transform.ref === structureRef)
        : null;

    if (struct && Array.isArray(struct.components)) {
        for (const comp of struct.components) {
            if (Array.isArray(comp.representations)) {
                for (const rep of comp.representations) {
                    if (rep.cell?.transform?.ref) {
                        const cell = state.cells.get(rep.cell.transform.ref);
                        const transformParams = cell?.transform?.params;
                        reps.push({
                            type: transformParams?.type?.name,
                            colorTheme: transformParams?.colorTheme ?? cell?.obj?.props?.colorTheme,
                            visible: cell?.state?.isHidden !== true,
                            repRef: rep.cell.transform.ref
                        });
                    }
                }
            }
        }
        return reps;
    }

    // Fallback for test/mocked plugin state without managers.structure hierarchy
    const treeChildren = state?.tree?.children;
    if (!treeChildren || typeof treeChildren.get !== 'function') {
        return reps;
    }

    const walk = (ref: string) => {
        const childrenEntry = treeChildren.get(ref);
        const children = childrenEntry?.toArray?.() ?? [];
        for (const childRef of children) {
            const cell = state.cells.get(childRef);
            if (cell?.obj?.type?.name === 'Representation3D') {
                const transformParams = cell?.transform?.params;
                reps.push({
                    type: transformParams?.type?.name,
                    colorTheme: transformParams?.colorTheme ?? cell?.obj?.props?.colorTheme,
                    visible: cell?.state?.isHidden !== true,
                    repRef: childRef
                });
            }
            walk(childRef);
        }
    };

    walk(structureRef);
    
    return reps;
}


