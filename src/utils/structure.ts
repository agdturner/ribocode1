/**
 * Utility functions for working with molecular structures in the Mol* plugin, including camera focus on specific loci, and retrieval of structure representations for session management.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.3.0
 * @lastModified 2026-11-26
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { Structure, StructureElement, Unit } from 'molstar/lib/mol-model/structure';
import { UnitIndex } from 'molstar/lib/mol-model/structure/structure/element/util';
import { OrderedSet, SortedArray } from 'molstar/lib/mol-data/int';
import { Color } from 'molstar/lib/mol-util/color';
import { setStructureOverpaint, clearStructureOverpaint } from 'molstar/lib/mol-plugin-state/helpers/structure-overpaint';
import { resolveChainIndices } from './chain';
import { parseResidueSelectionId } from './residue';

const SUBUNIT_HIGHLIGHT_COLOR = Color(0x4C78A8);
const CHAIN_HIGHLIGHT_COLOR = Color(0xF58518);
const RESIDUE_HIGHLIGHT_COLOR = Color(0xE45756);
const overpaintQueuesByPlugin = new WeakMap<PluginUIContext, Map<string, Promise<void>>>();
const applyingSelectionByPlugin = new WeakSet<PluginUIContext>();
const haloAdditionsByPlugin = new WeakMap<PluginUIContext, StructureElement.Loci[]>();

export function isApplyingRibocodeSelection(plugin: PluginUIContext): boolean {
    return applyingSelectionByPlugin.has(plugin);
}

export function withRibocodeSelection(plugin: PluginUIContext, apply: () => void) {
    if (isApplyingRibocodeSelection(plugin)) {
        apply();
        return;
    }
    applyingSelectionByPlugin.add(plugin);
    try {
        apply();
    } finally {
        applyingSelectionByPlugin.delete(plugin);
    }
}

export function excludeRibocodeHalo(plugin: PluginUIContext, loci: StructureElement.Loci): StructureElement.Loci {
    let native = loci;
    for (const added of haloAdditionsByPlugin.get(plugin) ?? []) {
        if (added.structure === loci.structure) {
            native = StructureElement.Loci.subtract(native, added);
        }
    }
    return native;
}

export function clearRibocodeHalo(plugin: PluginUIContext, preserveNativeSelection: boolean) {
    const additions = haloAdditionsByPlugin.get(plugin);
    haloAdditionsByPlugin.delete(plugin);
    const selects = plugin.managers.interactivity?.lociSelects;
    if (!preserveNativeSelection) {
        selects?.deselectAll?.();
        return;
    }
    withRibocodeSelection(plugin, () => {
        for (const loci of additions ?? []) {
            selects?.deselect?.({ loci }, false);
        }
    });
}

export type HighlightDisplayMode = 'halo' | 'overlay' | 'hybrid';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

function getNeutralDimColor(strength: number): ReturnType<typeof Color> {
    const t = clamp01(strength);
    const channel = Math.round(0xD8 - (0x70 * t));
    const hex = (channel << 16) | (channel << 8) | channel;
    return Color(hex);
}

function enqueueOverpaintUpdate(
    plugin: PluginUIContext,
    structureRef: string,
    task: () => Promise<void>
) {
    let queues = overpaintQueuesByPlugin.get(plugin);
    if (!queues) {
        queues = new Map<string, Promise<void>>();
        overpaintQueuesByPlugin.set(plugin, queues);
    }
    const previous = queues.get(structureRef) ?? Promise.resolve();
    const next = previous
        .catch(() => undefined)
        .then(task)
        .catch(() => undefined);
    queues.set(structureRef, next);
}

function getStructureComponentsByRef(plugin: PluginUIContext, structureRef: string) {
    return plugin.managers.structure.hierarchy.current.structures.find(
        s => s.cell.transform.ref === structureRef
    )?.components;
}

function addColorLayerForLoci(
    plugin: PluginUIContext,
    structureRef: string,
    loci: any,
    color: ReturnType<typeof Color>
) {
    const components = getStructureComponentsByRef(plugin, structureRef);
    if (!components || components.length === 0 || !loci) return false;
    enqueueOverpaintUpdate(plugin, structureRef, () =>
        setStructureOverpaint(plugin as any, components as any, color, async () => loci)
    );
    return true;
}

function clearColorLayerForLoci(
    plugin: PluginUIContext,
    structureRef: string,
    loci: any
) {
    const components = getStructureComponentsByRef(plugin, structureRef);
    if (!components || components.length === 0 || !loci) return false;
    enqueueOverpaintUpdate(plugin, structureRef, () =>
        setStructureOverpaint(plugin as any, components as any, -1, async () => loci)
    );
    return true;
}

export function clearStructureHighlightOverpaint(
    plugin: PluginUIContext,
    structureRef: string
) {
    const components = getStructureComponentsByRef(plugin, structureRef);
    if (!components || components.length === 0) return;
    enqueueOverpaintUpdate(plugin, structureRef, () =>
        clearStructureOverpaint(plugin as any, components as any)
    );
}

export function applyStructureDimOverlay(
    plugin: PluginUIContext,
    structureRef: string,
    strength: number,
    excludeLoci?: any
) {
    const components = getStructureComponentsByRef(plugin, structureRef);
    if (!components || components.length === 0) return false;
    const structureObj = plugin.managers.structure.hierarchy.current.structures.find(
        s => s.cell.transform.ref === structureRef
    )?.cell.obj?.data;
    if (!structureObj) return false;

    const color = getNeutralDimColor(strength);
    const allLoci = Structure.toStructureElementLoci(structureObj as any);
    const dimLoci = excludeLoci && allLoci?.kind === 'element-loci' && excludeLoci.kind === 'element-loci'
        ? StructureElement.Loci.subtract(allLoci, excludeLoci)
        : allLoci;
    enqueueOverpaintUpdate(plugin, structureRef, () =>
        setStructureOverpaint(plugin as any, components as any, color, async () => dimLoci as any)
    );
    return true;
}

function applyLociHighlightByMode(
    targetPlugin: PluginUIContext,
    targetStructureRef: string,
    loci: any,
    color: ReturnType<typeof Color>,
    mode: HighlightDisplayMode
) {
    if (!loci) return;

    const shouldApplyOverlay = mode === 'overlay' || mode === 'hybrid';
    const shouldApplyHalo = mode === 'halo' || mode === 'hybrid';

    if (shouldApplyOverlay) {
        const appliedOverlay = addColorLayerForLoci(targetPlugin, targetStructureRef, loci, color);
        if (mode === 'overlay' && appliedOverlay) return;
    }

    if (!shouldApplyHalo) return;

    const lociSelects = targetPlugin.managers.interactivity?.lociSelects;
    if (lociSelects?.select || lociSelects?.selectOnly) {
        // Mol* uses the same selection manager for native picks and Ribocode's persistent halo.
        const selection = targetPlugin.managers.structure?.selection;
        const structureLoci = StructureElement.Loci.is(loci) ? loci : undefined;
        const before = structureLoci && selection?.getLoci?.(structureLoci.structure);
        withRibocodeSelection(targetPlugin, () => {
            if (lociSelects.select) lociSelects.select({ loci }, false);
            else lociSelects.selectOnly({ loci }, false);
            const after = structureLoci && selection?.getLoci?.(structureLoci.structure);
            if (after && StructureElement.Loci.is(after)) {
                const added = before && StructureElement.Loci.is(before)
                    ? StructureElement.Loci.subtract(after, before)
                    : after;
                if (!StructureElement.Loci.isEmpty(added)) {
                    const additions = haloAdditionsByPlugin.get(targetPlugin) ?? [];
                    additions.push(added);
                    haloAdditionsByPlugin.set(targetPlugin, additions);
                }
            }
        });
        return;
    }
    targetPlugin.managers.interactivity?.lociHighlights?.highlight?.({ loci }, false);
}

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
function chainLoci(
    structure: Structure,
    chainId: string,
    residueCodes?: Map<string, Set<string> | null>
): StructureElement.Loci {
    const indicesByModel = new Map<Unit.Atomic['model'], Set<number>>();
    const elements: StructureElement.Loci.Element[] = [];
    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        let chainIndices = indicesByModel.get(unit.model);
        if (!chainIndices) {
            chainIndices = resolveChainIndices(unit.model.atomicHierarchy.chains, chainId);
            indicesByModel.set(unit.model, chainIndices);
        }
        const indices: UnitIndex[] = [];
        for (let i = 0; i < unit.elements.length; i++) {
            const atom = unit.elements[i];
            if (!chainIndices.has(unit.chainIndex[atom])) continue;
            if (residueCodes) {
                const residue = unit.residueIndex[atom];
                const residues = unit.model.atomicHierarchy.residues;
                const residueId = String(residues.auth_seq_id.value(residue));
                if (!residueCodes.has(residueId)) continue;
                const insCodes = residueCodes.get(residueId);
                const rawCode = residues.pdbx_PDB_ins_code.value(residue);
                const code = rawCode === '.' || rawCode === '?' ? '' : rawCode;
                if (insCodes && !insCodes.has(code)) continue;
            }
            indices.push(i as UnitIndex);
        }
        if (indices.length) elements.push({ unit, indices: OrderedSet.ofSortedArray(indices) });
    }
    return StructureElement.Loci(structure, elements);
}

export function getChainLoci(plugin: PluginUIContext, structureRef: string, chainId: string) {
    const structureObj = plugin.managers.structure.hierarchy.current.structures.find(
        s => s.cell.transform.ref === structureRef
    )?.cell.obj?.data;
    if (!structureObj) return null;
    return chainLoci(structureObj, chainId);
}

/**
 * Highlight/select a chain loci in Mol* so the chosen chain is visually emphasized.
 * Uses selectOnly when available to mirror Mol* selection tool behavior.
 */
export function highlightLociOnChain(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    mode: HighlightDisplayMode = 'overlay',
    syncPlugin?: PluginUIContext,
    getChainLociFn: (plugin: PluginUIContext, structureRef: string, chainId: string) => any = getChainLoci,
    syncStructureRef?: string,
    syncChainId?: string
) {
    const applyHighlight = (targetPlugin: PluginUIContext, targetStructureRef: string, targetChainId: string) => {
        const loci = getChainLociFn(targetPlugin, targetStructureRef, targetChainId);
        applyLociHighlightByMode(targetPlugin, targetStructureRef, loci, CHAIN_HIGHLIGHT_COLOR, mode);
    };

    applyHighlight(plugin, structureRef, chainId);
    if (syncPlugin) {
        applyHighlight(syncPlugin, syncStructureRef ?? structureRef, syncChainId ?? chainId);
    }
}

/**
 * Remove persistent chain highlight from selection markers.
 */
export function unhighlightLociOnChain(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    syncPlugin?: PluginUIContext,
    getChainLociFn: (plugin: PluginUIContext, structureRef: string, chainId: string) => any = getChainLoci,
    syncStructureRef?: string,
    syncChainId?: string
) {
    const removeHighlight = (targetPlugin: PluginUIContext, targetStructureRef: string, targetChainId: string) => {
        const loci = getChainLociFn(targetPlugin, targetStructureRef, targetChainId);
        if (!loci) return;
        if (clearColorLayerForLoci(targetPlugin, targetStructureRef, loci)) return;
        const lociSelects = targetPlugin.managers.interactivity?.lociSelects;
        if (lociSelects?.deselect) {
            lociSelects.deselect({ loci }, false);
            return;
        }
        if (lociSelects?.deselectAll) {
            lociSelects.deselectAll();
        }
    };

    removeHighlight(plugin, structureRef, chainId);
    if (syncPlugin) {
        removeHighlight(syncPlugin, syncStructureRef ?? structureRef, syncChainId ?? chainId);
    }
}

/**
 * Inspect a chain loci using Mol* structure focus manager.
 * This drives focus/history/details behavior rather than a simple marker highlight.
 */
export function inspectLociOnChain(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    syncPlugin?: PluginUIContext,
    getChainLociFn: (plugin: PluginUIContext, structureRef: string, chainId: string) => any = getChainLoci,
    syncStructureRef?: string,
    syncChainId?: string
) {
    const applyFocus = (targetPlugin: PluginUIContext, targetStructureRef: string, targetChainId: string) => {
        const loci = getChainLociFn(targetPlugin, targetStructureRef, targetChainId);
        if (!loci) return;
        const focusManager = targetPlugin.managers.structure?.focus;
        if (focusManager?.setFromLoci) {
            focusManager.setFromLoci(loci);
            return;
        }
        if (focusManager?.set) {
            focusManager.set({ loci, label: `chain:${targetChainId}` });
        }
    };

    applyFocus(plugin, structureRef, chainId);
    if (syncPlugin) {
        applyFocus(syncPlugin, syncStructureRef ?? structureRef, syncChainId ?? chainId);
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
    let mergedLoci: StructureElement.Loci | null = null;
    for (const chainId of chainIds) {
        const loci = getChainLoci(plugin, structureRef, chainId);
        if (!loci) continue;
        mergedLoci = mergedLoci ? StructureElement.Loci.union(mergedLoci, loci) : loci;
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
 * Highlight a subunit (set of chains) using Mol* interactivity highlight markers.
 * This is a simple visual emphasis mode without focus/details semantics.
 */
export function highlightLociOnSubunit(
    plugin: PluginUIContext,
    structureRef: string,
    chainIds: string[],
    mode: HighlightDisplayMode = 'overlay',
    syncPlugin?: PluginUIContext,
    syncStructureRef?: string,
    syncChainIds?: string[]
) {
    const applyHighlight = (
        targetPlugin: PluginUIContext,
        targetStructureRef: string,
        targetChainIds: string[]
    ) => {
        const loci = getSubunitLoci(targetPlugin, targetStructureRef, targetChainIds);
        applyLociHighlightByMode(targetPlugin, targetStructureRef, loci, SUBUNIT_HIGHLIGHT_COLOR, mode);
    };

    applyHighlight(plugin, structureRef, chainIds);
    if (syncPlugin) {
        applyHighlight(syncPlugin, syncStructureRef ?? structureRef, syncChainIds ?? chainIds);
    }
}

/**
 * Remove persistent subunit highlight from selection markers.
 */
export function unhighlightLociOnSubunit(
    plugin: PluginUIContext,
    structureRef: string,
    chainIds: string[],
    syncPlugin?: PluginUIContext,
    syncStructureRef?: string,
    syncChainIds?: string[]
) {
    const removeHighlight = (
        targetPlugin: PluginUIContext,
        targetStructureRef: string,
        targetChainIds: string[]
    ) => {
        const loci = getSubunitLoci(targetPlugin, targetStructureRef, targetChainIds);
        if (!loci) return;
        if (clearColorLayerForLoci(targetPlugin, targetStructureRef, loci)) return;
        const lociSelects = targetPlugin.managers.interactivity?.lociSelects;
        if (lociSelects?.deselect) {
            lociSelects.deselect({ loci }, false);
            return;
        }
        if (lociSelects?.deselectAll) {
            lociSelects.deselectAll();
        }
    };

    removeHighlight(plugin, structureRef, chainIds);
    if (syncPlugin) {
        removeHighlight(syncPlugin, syncStructureRef ?? structureRef, syncChainIds ?? chainIds);
    }
}

/**
 * Inspect a subunit (set of chains) using Mol* structure focus manager.
 * This is the chemistry-details/focus behavior.
 */
export function inspectLociOnSubunit(
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
    return getResiduesLoci(plugin, structureRef, chainId, [residueId], { [residueId]: insCode });
}

export interface SerializableResidueLoci {
    structureHash: number;
    units: Array<{ id: number; indices: number[] }>;
}

export function serializeResidueLoci(loci: StructureElement.Loci): SerializableResidueLoci {
    return {
        structureHash: loci.structure.hashCode,
        units: loci.elements.map(({ unit, indices }) => ({
            id: unit.id,
            indices: Array.from({ length: OrderedSet.size(indices) }, (_, i) => OrderedSet.getAt(indices, i)),
        })),
    };
}

export function restoreResidueLoci(
    plugin: PluginUIContext,
    structureRef: string,
    saved: SerializableResidueLoci
): StructureElement.Loci | null {
    const structure = plugin.managers.structure.hierarchy.current.structures.find(
        s => s.cell.transform.ref === structureRef
    )?.cell.obj?.data;
    if (!structure || !saved || !Number.isInteger(saved.structureHash)
        || saved.structureHash !== structure.hashCode || !Array.isArray(saved.units) || !saved.units.length) return null;
    const elements: StructureElement.Loci['elements'][number][] = [];
    const seen = new Set<number>();
    for (const entry of saved.units) {
        if (!entry || !Number.isInteger(entry.id) || seen.has(entry.id)
            || !structure.unitMap.has(entry.id) || !Array.isArray(entry.indices) || !entry.indices.length) return null;
        const unit = structure.unitMap.get(entry.id);
        let previous = -1;
        const indices: UnitIndex[] = [];
        for (const index of entry.indices) {
            if (!Number.isInteger(index) || index <= previous || index >= unit.elements.length) return null;
            indices.push(index as UnitIndex);
            previous = index;
        }
        seen.add(entry.id);
        elements.push({ unit, indices: SortedArray.ofSortedArray(indices) });
    }
    return StructureElement.Loci(structure, elements);
}

/**
 * Computes a loci that spans all supplied residue IDs in a chain.
 */
export function getResiduesLoci(
    plugin: PluginUIContext,
    structureRef: string,
    chainId: string,
    residueIds: string[],
    residueInsCodes?: Record<string, string | undefined>
) {
    if (!Array.isArray(residueIds) || residueIds.length === 0) return null;
    const structureObj = plugin.managers.structure.hierarchy.current.structures.find(
        s => s.cell.transform.ref === structureRef
    )?.cell.obj?.data;
    if (!structureObj) return null;
    const residueCodes = new Map<string, Set<string> | null>();
    for (const residueId of new Set(residueIds.filter(Boolean))) {
        const parsed = parseResidueSelectionId(residueId);
        const key = !isNaN(Number(parsed.authSeqId)) ? String(Number(parsed.authSeqId)) : parsed.authSeqId;
        const insCode = parsed.insertionCode ?? residueInsCodes?.[residueId];
        if (insCode === undefined) residueCodes.set(key, null);
        else if (!residueCodes.has(key)) residueCodes.set(key, new Set([insCode]));
        else residueCodes.get(key)?.add(insCode);
    }
    if (residueCodes.size === 0) return null;
    return chainLoci(structureObj, chainId, residueCodes);
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
    mode: HighlightDisplayMode = 'overlay',
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
        applyLociHighlightByMode(targetPlugin, targetStructureRef, loci, RESIDUE_HIGHLIGHT_COLOR, mode);
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
 * Remove persistent residue highlight from selection markers.
 */
export function unhighlightLociOnResidues(
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
    const removeHighlight = (
        targetPlugin: PluginUIContext,
        targetStructureRef: string,
        targetChainId: string,
        targetResidueIds: string[],
        targetResidueInsCodes?: Record<string, string | undefined>
    ) => {
        const loci = getResiduesLoci(targetPlugin, targetStructureRef, targetChainId, targetResidueIds, targetResidueInsCodes);
        if (!loci) return;
        if (clearColorLayerForLoci(targetPlugin, targetStructureRef, loci)) return;
        const lociSelects = targetPlugin.managers.interactivity?.lociSelects;
        if (lociSelects?.deselect) {
            lociSelects.deselect({ loci }, false);
            return;
        }
        if (lociSelects?.deselectAll) {
            lociSelects.deselectAll();
        }
    };

    removeHighlight(plugin, structureRef, chainId, residueIds, residueInsCodes);
    if (syncPlugin) {
        removeHighlight(
            syncPlugin,
            syncStructureRef ?? structureRef,
            syncChainId ?? chainId,
            syncResidueIds ?? residueIds,
            syncResidueInsCodes ?? residueInsCodes
        );
    }
}

/**
 * Inspect one or many residues in a chain using Mol* structure focus manager.
 * This drives focus/history/details behavior rather than marker-only highlight.
 */
export function inspectLociOnResidues(
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
    const applyFocus = (
        targetPlugin: PluginUIContext,
        targetStructureRef: string,
        targetChainId: string,
        targetResidueIds: string[],
        targetResidueInsCodes?: Record<string, string | undefined>
    ) => {
        const loci = getResiduesLoci(targetPlugin, targetStructureRef, targetChainId, targetResidueIds, targetResidueInsCodes);
        if (!loci) return;
        const focusManager = targetPlugin.managers.structure?.focus;
        if (focusManager?.setFromLoci) {
            focusManager.setFromLoci(loci);
            return;
        }
        if (focusManager?.set) {
            focusManager.set({ loci, label: `residues:${targetChainId}:${targetResidueIds.join(',')}` });
        }
    };

    applyFocus(plugin, structureRef, chainId, residueIds, residueInsCodes);
    if (syncPlugin) {
        applyFocus(
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
