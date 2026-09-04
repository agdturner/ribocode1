/**
 * Data utility functions for Ribocode.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { Asset } from 'molstar/lib/mol-util/assets';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { StructureElement, StructureProperties } from 'molstar/lib/mol-model/structure';

const ENABLE_ATOM_DATA_DIAGNOSTICS = false;

/**
 * Load a molecule from a URL into the Molstar viewer.
 * @param viewer The Molstar viewer/plugin instance.
 * @param molecule The molecule to load, with id and url.
 * @returns The loaded trajectory, model, and structure.
 */
export async function loadMoleculeToViewer(viewer: PluginUIContext, molecule: { id: string; url: string }) {
    const data = await viewer.builders.data.download(
        { url: molecule.url },
        { state: { isGhost: true } }
    );
    if (!data) return;
    const trajectory = await viewer.builders.structure.parseTrajectory(data, 'mmcif');
    const model = await viewer.builders.structure.createModel(trajectory);
    const structure = await viewer.builders.structure.createStructure(model);
    await viewer.builders.structure.hierarchy.applyPreset(trajectory, 'default');
    return { trajectory, model, structure };
}

/**
 * Load a molecule from a file into the Molstar viewer.
 * @param viewer The Molstar viewer/plugin instance.
 * @param file The file to load.
 * @returns The loaded trajectory, model, and structure.
 */
export async function loadMoleculeFileToViewer(viewer: PluginUIContext, file: Asset.File) {
    const data = await viewer.builders.data.readFile(
        { file, label: file.name },
        { state: { isGhost: true } }
    );
    if (!data) return;
    const trajectory = await viewer.builders.structure.parseTrajectory(data.data, 'mmcif');
    const model = await viewer.builders.structure.createModel(trajectory);
    const structure = await viewer.builders.structure.createStructure(model);
    await viewer.builders.structure.hierarchy.applyPreset(trajectory, 'default');
    return { trajectory, model, structure };
}

/**
 * Extract atom data (symbol type, chain ID, coordinates) from a Mol* structure.
 * @param structure The Mol* structure object.
 * @param filterChainId Optional chain ID to filter atoms by.
 * @returns An object containing arrays of symbol types, chain IDs, and coordinates (xs, ys, zs).
 */
export function getAtomDataFromStructureUnits(structure: any, filterChainId?: string): {
    symbolTypes: string[];
    chainIds: string[];
    xs: number[];
    ys: number[];
    zs: number[];
} {
    const symbolTypes: string[] = [];
    const chainIds: string[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const zs: number[] = [];
    const uniqueChainIds = new Set<string>();
    if (!structure) return { symbolTypes, chainIds, xs, ys, zs };
    const units = structure.data?.units ?? structure.units;
    if (!units) return { symbolTypes, chainIds, xs, ys, zs };
    if (units.length > 0) {
        if (ENABLE_ATOM_DATA_DIAGNOSTICS) console.info('[getAtomDataFromStructureUnits] First unit:', units[0]);
        if (units[0].model) {
            if (ENABLE_ATOM_DATA_DIAGNOSTICS) console.info('[getAtomDataFromStructureUnits] First unit.model:', units[0].model);
        }
    }

    const normalizedFilterChainId = filterChainId ? String(filterChainId).trim().toUpperCase() : undefined;

    // Preferred extraction path for real Mol* Structure objects.
    const canUseStructureLocation = !!structure?.unitMap
        && !!StructureElement?.Location?.create
        && !!StructureProperties?.chain?.auth_asym_id;
    if (canUseStructureLocation) {
        try {
            const loc = StructureElement.Location.create(structure);
            const p = Vec3();
            for (const unit of units) {
                if (unit.kind !== 0) continue;
                const elements = unit.elements;
                for (let i = 0; i < elements.length; i++) {
                    const atomIdx = elements[i];
                    loc.unit = unit;
                    loc.element = atomIdx;

                    const authId = String(StructureProperties.chain.auth_asym_id(loc) ?? '');
                    const labelId = String(StructureProperties.chain.label_asym_id(loc) ?? '');
                    const authNorm = authId.trim().toUpperCase();
                    const labelNorm = labelId.trim().toUpperCase();

                    if (authId) uniqueChainIds.add(authId);
                    if (normalizedFilterChainId && authNorm !== normalizedFilterChainId && labelNorm !== normalizedFilterChainId) {
                        continue;
                    }

                    const symbol = String(StructureProperties.atom.type_symbol(loc) ?? '');
                    unit.conformation.position(atomIdx, p);

                    symbolTypes.push(symbol);
                    chainIds.push(authId);
                    xs.push(p[0]);
                    ys.push(p[1]);
                    zs.push(p[2]);
                }
            }
            if (ENABLE_ATOM_DATA_DIAGNOSTICS) console.info('[getAtomDataFromStructureUnits] Unique chain IDs in structure:', Array.from(uniqueChainIds));
            return { symbolTypes, chainIds, xs, ys, zs };
        } catch (err) {
            console.warn('[getAtomDataFromStructureUnits] Falling back to hierarchy extraction path after structure-location failure.', err);
        }
    }

    // Fallback path for lightweight mocks or incomplete structures.
    let chains: any = undefined;
    if (units.length > 0) chains = units[0].model.atomicHierarchy.chains;
    const resolveChainIdxForAtom = (unit: any, atomIdx: number, elementOffset: number): number | undefined => {
        const model = unit?.model;
        const residueAtomSegmentsIndex = model?.atomicHierarchy?.residueAtomSegments?.index;
        const chainAtomSegmentsIndex = model?.atomicHierarchy?.chainAtomSegments?.index;
        if (residueAtomSegmentsIndex && chainAtomSegmentsIndex) {
            const residueIdx = residueAtomSegmentsIndex[atomIdx];
            if (residueIdx !== undefined) {
                const derivedChainIdx = chainAtomSegmentsIndex[residueIdx];
                if (derivedChainIdx !== undefined) return derivedChainIdx;
            }
        }
        const unitChainIndex = unit?.chainIndex;
        if (unitChainIndex) {
            const local = unitChainIndex[elementOffset];
            if (local !== undefined) return local;
            const byAtom = unitChainIndex[atomIdx];
            if (byAtom !== undefined) return byAtom;
        }
        return undefined;
    };

    for (const unit of units) {
        if (unit.kind !== 0) continue;
        const model = unit.model;
        const elements = unit.elements;
        const atoms = model.atomicHierarchy.atoms;
        const conformation = model.atomicConformation;
        for (let i = 0; i < elements.length; i++) {
            const atomIdx = elements[i];
            const chainIdx = resolveChainIdxForAtom(unit, atomIdx, i);
            let chainId = '';
            let labelChainId = '';
            if (chains && chains.auth_asym_id && typeof chains.auth_asym_id.value === 'function' && chainIdx !== undefined) {
                chainId = chains.auth_asym_id.value(chainIdx);
                labelChainId = chains.label_asym_id?.value?.(chainIdx) ?? '';
            }
            if (chainId) uniqueChainIds.add(chainId);
            if (normalizedFilterChainId) {
                const authNorm = String(chainId ?? '').trim().toUpperCase();
                const labelNorm = String(labelChainId ?? '').trim().toUpperCase();
                if (authNorm !== normalizedFilterChainId && labelNorm !== normalizedFilterChainId) continue;
            }
            let symbol = '';
            if (atoms.type_symbol && typeof atoms.type_symbol.value === 'function') {
                symbol = atoms.type_symbol.value(atomIdx);
            }
            const x = conformation.x?.[atomIdx] ?? NaN;
            const y = conformation.y?.[atomIdx] ?? NaN;
            const z = conformation.z?.[atomIdx] ?? NaN;
            symbolTypes.push(symbol);
            chainIds.push(chainId);
            xs.push(x);
            ys.push(y);
            zs.push(z);
        }
    }
    if (ENABLE_ATOM_DATA_DIAGNOSTICS) console.info('[getAtomDataFromStructureUnits] Unique chain IDs in structure:', Array.from(uniqueChainIds));
    return { symbolTypes, chainIds, xs, ys, zs };
}

export interface AtomCloudSummary {
    atomCount: number;
    finiteAtomCount: number;
    centroid: { x: number; y: number; z: number };
}

/**
 * Summarize atom positions and compute centroid of finite coordinates.
 */
export function summarizeAtomCloud(xs: number[], ys: number[], zs: number[]): AtomCloudSummary {
    const atomCount = Math.min(xs.length, ys.length, zs.length);
    let finiteAtomCount = 0;
    let sx = 0;
    let sy = 0;
    let sz = 0;

    for (let i = 0; i < atomCount; i++) {
        const x = xs[i];
        const y = ys[i];
        const z = zs[i];
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
        sx += x;
        sy += y;
        sz += z;
        finiteAtomCount++;
    }

    if (finiteAtomCount === 0) {
        return {
            atomCount,
            finiteAtomCount,
            centroid: { x: NaN, y: NaN, z: NaN },
        };
    }

    return {
        atomCount,
        finiteAtomCount,
        centroid: {
            x: sx / finiteAtomCount,
            y: sy / finiteAtomCount,
            z: sz / finiteAtomCount,
        },
    };
}

/**
 * Update atom coordinates and log before/after for verification.
 * @param model The Mol* model object
 * @param centroid Translation centroid used to recenter coordinates.
 * @param rotmat 3x3 rotation matrix (flat array, row-major).
 */
export function updateAndLogAtomCoordinates(model: any, centroid: Vec3, rotmat: number[]) {
    const xs = model.atomicConformation.x;
    const ys = model.atomicConformation.y;
    const zs = model.atomicConformation.z;
    const n = xs.length;
    const np = Math.floor(n / 3);
    // Log before update
    if (ENABLE_ATOM_DATA_DIAGNOSTICS) console.info('Preparing to update atom coordinates:');
    for (let i = 0; i < n; i++) {
        if (i % np === 0) {
            if (ENABLE_ATOM_DATA_DIAGNOSTICS) {
                console.info(`Preparing to update atom ${i}: new coords x=${xs[i]}, y=${ys[i]}, z=${zs[i]}`);
            }
        }
    }
    // Recentering
    for (let i = 0; i < n; i++) {
        xs[i] = xs[i] - centroid[0];
        ys[i] = ys[i] - centroid[1];
        zs[i] = zs[i] - centroid[2];
    }
    // Rotation
    for (let i = 0; i < n; i++) {
        const x = xs[i];
        const y = ys[i];
        const z = zs[i];
        xs[i] = rotmat[0] * x + rotmat[1] * y + rotmat[2] * z;
        ys[i] = rotmat[3] * x + rotmat[4] * y + rotmat[5] * z;
        zs[i] = rotmat[6] * x + rotmat[7] * y + rotmat[8] * z;
    }
    // Reassign updated coordinates
    model.atomicConformation.x = xs;
    model.atomicConformation.y = ys;
    model.atomicConformation.z = zs;
    // Log after update
    if (ENABLE_ATOM_DATA_DIAGNOSTICS) console.info('Atom coordinates updated.');
    for (let i = 0; i < n; i++) {
        if (i % np === 0) {
            if (ENABLE_ATOM_DATA_DIAGNOSTICS) {
                console.info(`Updated atom ${i}: new coords x=${model.atomicConformation.x[i]}, y=${model.atomicConformation.y[i]}, z=${model.atomicConformation.z[i]}`);
            }
        }
    }
}