/**
 * Ribocode App component.
 *
 * Main entry point for the Ribocode web application, providing the primary UI and state management for molecular alignment and visualization.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT. See LICENSE file for more info.
 *
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-06-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useConfirm } from './hooks/useConfirm';
import { SelectionProvider } from './context/SelectionContext';
import { ViewerStateProvider } from './context/ViewerStateContext';
import { SyncProvider } from './context/SyncContext';
import { handleToggle } from './handlers/uiHandlers';
import { useSessionSave } from './hooks/useSessionSave';
import { useSessionSaveAll } from './hooks/useSessionSaveAll';
import { useSessionLoadModal } from './hooks/useSessionLoadModal';
import { useUpdateChainInfo } from './hooks/useUpdateChainInfo';
import { useUpdateResidueInfo } from './hooks/useUpdateResidueInfo';
import { PluginCommands as MolPluginCommands } from 'molstar/lib/mol-plugin/commands';
import ViewerColumn , {
    getLoadDataRowProps,
    getMoleculeUIAlignedToProps,
    getMoleculeUIAlignedProps,
    getRealignedMoleculeListProps,
    getMolstarContainerProps
} from './components/ViewerColumn';
import TwoColumnsContainer from './components/TwoColumnsContainer';
import AppHeader from './components/AppHeader';
import { AlignedTo, Aligned, ReAligned } from './constants/ribocode';
import { inferColorThemeKind, parseColorFileContent, registerThemeIfNeeded } from './utils/colors';
import { useFileInput } from './hooks/useFileInput';
import { useChainState } from './hooks/useChainState';
import { getAtomDataFromStructureUnits, summarizeAtomCloud } from './utils/data';
import { applyStructureDimOverlay, clearStructureHighlightOverpaint, getStructureRepresentations, highlightLociOnChain, highlightLociOnResidues, highlightLociOnSubunit, inspectLociOnChain, inspectLociOnResidues, inspectLociOnSubunit, type HighlightDisplayMode } from './utils/structure';
import { parseDictionaryFileContent } from './utils/dictionary';
import { useResidueState } from './hooks/useResidueState';
import { useSubunitState } from './hooks/useSubunitState';
import { allowedRepresentationTypes, AllowedRepresentationType } from './types/ribocode';
import GeneralControls from './components/GeneralControls';
import { ViewerState } from './components/RibocodeViewer';
import { useMolstarViewer } from './hooks/useMolstarViewer';
import { loadMoleculeFileToViewer } from 'molstar/lib/extensions/ribocode/structure';
import { Asset } from 'molstar/lib/mol-util/assets';
import { useViewerState } from './hooks/useViewerState';
import { alignDatasetUsingChains } from 'molstar/lib/extensions/ribocode/utils/geometry';
import { Color } from 'molstar/lib/mol-util/color';
import { ChainIdColorTheme, ChainIdColorThemeProvider } from 'molstar/lib/mol-theme/color/chain-id';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { AlignmentData } from 'molstar/lib/extensions/ribocode/types';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { Mat4, Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import type { LoadedMolecule, ViewerKey, MoleculeMode } from './types/ribocode';
import { A, B } from './constants/ribocode';
import { makeFogSetters, makeClippingSetters, makeZoomHandler, makeChainHighlightToggleHandler, makeResidueHighlightToggleHandler, makeSubunitHighlightToggleHandler, makeChainInspectToggleHandler, makeResidueInspectToggleHandler, makeSubunitInspectToggleHandler } from './utils/viewerHelpers';
import { selectedAtomTypes } from './constants/ribocode';
import { parseRpNameTableBySpecies } from './utils/rpNameTable';
import { extractUniProtAccessionsFromText, fetchUniProtGeneNamesBatched, parseChainToMoleculeNameFromCifText, parseChainToUniProtFromCifText, UniProtGeneNameCache } from './utils/uniprot';
import rpNameTableCsv from '../data/input/RP_name_table_uniprot.csv?raw';

/**
 * The main App component.
 * @returns The main App component.
 */
interface AppProps {
    testForceIsMoleculeAlignedLoaded?: boolean;
}

interface SessionRepresentationSpec {
    type: AllowedRepresentationType;
    colorTheme: { name: string; params?: Record<string, unknown> };
    visible: boolean;
    chainThemeName?: string;
    residueThemeName?: string;
    activeThemeKind?: 'chain' | 'residue-type';
}

interface SerializableCameraSnapshot {
    position: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
    radius: number;
}

interface ChainRealignMetrics {
    timestamp: number;
    alignedToChainId: string;
    alignedChainId: string;
    atomPairCount: number;
    rmsd: number;
    meanPairDistanceBefore: number;
    meanPairDistanceAfter: number;
    improvementRatio: number;
}

interface ResidueRealignMetrics {
    timestamp: number;
    alignedToChainId: string;
    alignedChainId: string;
    alignedToResidueIds: string[];
    alignedResidueIds: string[];
    atomPairCount: number;
    rmsd: number;
    meanPairDistanceBefore: number;
    meanPairDistanceAfter: number;
    improvementRatio: number;
}

interface ResidueRealignDebugStatus {
    phase: 'idle' | 'blocked' | 'running' | 'success' | 'failed';
    reason?: string;
    details?: Record<string, unknown>;
    timestamp: number;
}

interface SessionUiState {
    zoom?: {
        extraRadius: number;
        minRadius: number;
    };
    zoomByViewer?: {
        viewerA?: {
            extraRadius: number;
            minRadius: number;
        };
        viewerB?: {
            extraRadius: number;
            minRadius: number;
        };
    };
    clippingByViewer?: {
        viewerA?: {
            minNear: number;
            clipRadius: number;
        };
        viewerB?: {
            minNear: number;
            clipRadius: number;
        };
    };
    selections?: {
        alignedTo?: {
            subunit?: string;
            chainId?: string;
            chainId2?: string;
            residueId?: string;
            residueId2?: string;
            residueIds?: string[];
            residueIds2?: string[];
        };
        aligned?: {
            subunit?: string;
            chainId?: string;
            chainId2?: string;
            residueId?: string;
            residueId2?: string;
            residueIds?: string[];
            residueIds2?: string[];
        };
    };
    highlights?: {
        alignedTo?: {
            chain?: boolean;
            residue?: boolean;
            subunit?: boolean;
        };
        aligned?: {
            chain?: boolean;
            residue?: boolean;
            subunit?: boolean;
        };
    };
    inspectByViewer?: {
        viewerA?: {
            alignedTo?: {
                chain?: boolean;
                residue?: boolean;
                subunit?: boolean;
            };
            aligned?: {
                chain?: boolean;
                residue?: boolean;
                subunit?: boolean;
            };
        };
        viewerB?: {
            alignedTo?: {
                chain?: boolean;
                residue?: boolean;
                subunit?: boolean;
            };
            aligned?: {
                chain?: boolean;
                residue?: boolean;
                subunit?: boolean;
            };
        };
    };
    visibilityByViewer?: {
        viewerA?: {
            alignedTo?: boolean;
            aligned?: boolean;
        };
        viewerB?: {
            alignedTo?: boolean;
            aligned?: boolean;
        };
    };
    fogByViewer?: {
        viewerA?: {
            enabled: boolean;
            near: number;
            far: number;
        };
        viewerB?: {
            enabled: boolean;
            near: number;
            far: number;
        };
    };
    syncEnabled?: boolean;
    activeViewer?: ViewerKey;
    cameraSnapshots?: {
        viewerA?: SerializableCameraSnapshot;
        viewerB?: SerializableCameraSnapshot;
    };
    structureTransformsByViewer?: {
        viewerA?: {
            alignedTo?: number[];
            aligned?: number[];
        };
        viewerB?: {
            alignedTo?: number[];
            aligned?: number[];
        };
    };
    uniprotGeneNames?: UniProtGeneNameCache;
    showUniprotAccessionInChainLabels?: boolean;
    showUniprotAccessionInChainLabelsByViewer?: {
        viewerA?: boolean;
        viewerB?: boolean;
    };
    chainFinderQueries?: {
        alignedTo?: string;
        aligned?: string;
    };
    colorThemesByMode?: {
        alignedTo?: {
            selectedThemeName?: string;
            selectedChainThemeName?: string;
            selectedResidueThemeName?: string;
            themes?: Array<{ value: string; label: string; rows: Array<Record<string, string>> }>;
        };
        aligned?: {
            selectedThemeName?: string;
            selectedChainThemeName?: string;
            selectedResidueThemeName?: string;
            themes?: Array<{ value: string; label: string; rows: Array<Record<string, string>> }>;
        };
    };
    selectionDisplay?: {
        mode?: HighlightDisplayMode;
        dimUnselected?: boolean;
        dimStrength?: number;
    };
    selectionDisplayByMode?: {
        alignedTo?: {
            mode?: HighlightDisplayMode;
            dimUnselected?: boolean;
            dimStrength?: number;
        };
        aligned?: {
            mode?: HighlightDisplayMode;
            dimUnselected?: boolean;
            dimStrength?: number;
        };
    };
}

type ColorThemeMode = 'AlignedTo' | 'Aligned';
type RepresentationColorMode = 'chain' | 'residue-type';

interface SelectionDisplaySettings {
    mode: HighlightDisplayMode;
    dimUnselected: boolean;
    dimStrength: number;
}

type SelectionDisplayByMode = Record<ColorThemeMode, SelectionDisplaySettings>;

interface LoadedColorThemeOption {
    value: string;
    label: string;
}

interface PersistedColorTheme extends LoadedColorThemeOption {
    rows: Array<Record<string, string>>;
}

const DEFAULT_COLOR_THEME_NAME = 'default';
const DEFAULT_COLOR_THEME_LABEL = 'Default';
const EDITABLE_CHAIN_THEME_BY_MODE: Record<ColorThemeMode, string> = {
    AlignedTo: 'AlignedTo-custom-chain-colors',
    Aligned: 'Aligned-custom-chain-colors',
};
const DEFAULT_RESIDUE_THEME_BY_MODE: Record<ColorThemeMode, string> = {
    AlignedTo: 'AlignedTo-default-residue-colors',
    Aligned: 'Aligned-default-residue-colors',
};
const RESIDUE_DEFAULT_PALETTE = [
    '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
    '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
    '#1B9E77', '#D95F02', '#7570B3', '#E7298A', '#66A61E',
    '#E6AB02', '#A6761D', '#666666', '#2E86AB', '#A23B72'
];

const UNIPROT_CACHE_STORAGE_KEY = 'ribocode-uniprot-gene-cache-v1';
const ENABLE_IN_PLACE_CHAIN_REALIGN = true;
const ENABLE_REALIGN_DIAGNOSTICS = false;
const SUBUNIT_REALIGN_CHAIN_ID = '__subunit__';
const RESIDUE_REALIGN_CHAIN_ID = '__residue__';
const DEFAULT_CLIPPING = { minNear: 1, clipRadius: 0 };

function round3(value: number): number {
    return Number.isFinite(value) ? Number(value.toFixed(3)) : value;
}

function readRotationFromMatrix(m: Mat4): number[][] {
    return [
        [Mat4.getValue(m, 0, 0), Mat4.getValue(m, 0, 1), Mat4.getValue(m, 0, 2)],
        [Mat4.getValue(m, 1, 0), Mat4.getValue(m, 1, 1), Mat4.getValue(m, 1, 2)],
        [Mat4.getValue(m, 2, 0), Mat4.getValue(m, 2, 1), Mat4.getValue(m, 2, 2)],
    ];
}

function getRotationDeterminant(r: number[][]): number {
    return r[0][0] * (r[1][1] * r[2][2] - r[1][2] * r[2][1])
        - r[0][1] * (r[1][0] * r[2][2] - r[1][2] * r[2][0])
        + r[0][2] * (r[1][0] * r[2][1] - r[1][1] * r[2][0]);
}

function getRotationOrthogonalityError(r: number[][]): number {
    const rrT = [
        [r[0][0] * r[0][0] + r[0][1] * r[0][1] + r[0][2] * r[0][2], r[0][0] * r[1][0] + r[0][1] * r[1][1] + r[0][2] * r[1][2], r[0][0] * r[2][0] + r[0][1] * r[2][1] + r[0][2] * r[2][2]],
        [r[1][0] * r[0][0] + r[1][1] * r[0][1] + r[1][2] * r[0][2], r[1][0] * r[1][0] + r[1][1] * r[1][1] + r[1][2] * r[1][2], r[1][0] * r[2][0] + r[1][1] * r[2][1] + r[1][2] * r[2][2]],
        [r[2][0] * r[0][0] + r[2][1] * r[0][1] + r[2][2] * r[0][2], r[2][0] * r[1][0] + r[2][1] * r[1][1] + r[2][2] * r[1][2], r[2][0] * r[2][0] + r[2][1] * r[2][1] + r[2][2] * r[2][2]],
    ];
    const id = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    let maxAbs = 0;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const d = Math.abs(rrT[i][j] - id[i][j]);
            if (d > maxAbs) maxAbs = d;
        }
    }
    return maxAbs;
}

function getRotationAngleDegrees(r: number[][]): number {
    const trace = r[0][0] + r[1][1] + r[2][2];
    const cosTheta = Math.min(1, Math.max(-1, (trace - 1) / 2));
    return (Math.acos(cosTheta) * 180) / Math.PI;
}

function summarizeMatrix(m: Mat4) {
    const r = readRotationFromMatrix(m);
    return {
        rotationDeg: round3(getRotationAngleDegrees(r)),
        rotationDet: round3(getRotationDeterminant(r)),
        orthogonalityMaxAbs: round3(getRotationOrthogonalityError(r)),
        translation: {
            x: round3(Mat4.getValue(m, 0, 3)),
            y: round3(Mat4.getValue(m, 1, 3)),
            z: round3(Mat4.getValue(m, 2, 3)),
        },
        matrixRows: [
            [round3(Mat4.getValue(m, 0, 0)), round3(Mat4.getValue(m, 0, 1)), round3(Mat4.getValue(m, 0, 2)), round3(Mat4.getValue(m, 0, 3))],
            [round3(Mat4.getValue(m, 1, 0)), round3(Mat4.getValue(m, 1, 1)), round3(Mat4.getValue(m, 1, 2)), round3(Mat4.getValue(m, 1, 3))],
            [round3(Mat4.getValue(m, 2, 0)), round3(Mat4.getValue(m, 2, 1)), round3(Mat4.getValue(m, 2, 2)), round3(Mat4.getValue(m, 2, 3))],
            [round3(Mat4.getValue(m, 3, 0)), round3(Mat4.getValue(m, 3, 1)), round3(Mat4.getValue(m, 3, 2)), round3(Mat4.getValue(m, 3, 3))],
        ],
    };
}

function chooseBestSharedElementSelector(
    movingSymbolTypes: string[],
    referenceSymbolTypes: string[],
    fallback: Record<string, boolean>
): { selector: Record<string, boolean>; mode: string; selectedType?: string; countDelta?: number; pairedCount?: number } {
    const movingCounts = new Map<string, number>();
    const referenceCounts = new Map<string, number>();

    for (const raw of movingSymbolTypes) {
        const type = String(raw || '').trim();
        if (!type) continue;
        movingCounts.set(type, (movingCounts.get(type) ?? 0) + 1);
    }
    for (const raw of referenceSymbolTypes) {
        const type = String(raw || '').trim();
        if (!type) continue;
        referenceCounts.set(type, (referenceCounts.get(type) ?? 0) + 1);
    }

    const candidates = Array.from(movingCounts.keys())
        .filter(type => referenceCounts.has(type))
        .map(type => {
            const moving = movingCounts.get(type) ?? 0;
            const reference = referenceCounts.get(type) ?? 0;
            return {
                type,
                moving,
                reference,
                delta: Math.abs(moving - reference),
                paired: Math.min(moving, reference),
            };
        })
        .filter(c => c.paired >= 10)
        .sort((a, b) => {
            if (a.delta !== b.delta) return a.delta - b.delta;
            if (a.paired !== b.paired) return b.paired - a.paired;
            return a.type.localeCompare(b.type);
        });

    if (candidates.length > 0) {
        const best = candidates[0];
        return {
            selector: { [best.type]: true },
            mode: 'single-best-shared-element',
            selectedType: best.type,
            countDelta: best.delta,
            pairedCount: best.paired,
        };
    }

    return {
        selector: fallback,
        mode: 'fallback-default-types',
    };
}

function downloadTextFile(filename: string, content: string, mimeType = 'text/plain;charset=utf-8'): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}

function getColumnStringValue(column: any, index: number): string {
    if (!column) return '';
    if (typeof column.value === 'function') {
        const v = column.value(index);
        return v == null ? '' : String(v);
    }
    if (Array.isArray(column.value)) {
        const v = column.value[index];
        return v == null ? '' : String(v);
    }
    return '';
}

function normalizeResidueInsCode(raw: string): string {
    const ins = String(raw || '').trim();
    if (!ins || ins === '?' || ins === '.') return '';
    return ins;
}

function buildResidueKeyFromParts(authSeqRaw: unknown, labelSeqRaw: unknown, insRaw: unknown): string {
    const authSeq = String(authSeqRaw ?? '').trim();
    const labelSeq = String(labelSeqRaw ?? '').trim();
    const seq = authSeq && authSeq !== '?' && authSeq !== '.' ? authSeq : labelSeq;
    const ins = normalizeResidueInsCode(String(insRaw ?? ''));
    return `${seq}:${ins}`;
}

function buildAnchorAtomDataForChain(structure: any, chainId: string) {
    const symbolTypes: string[] = [];
    const chainIds: string[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const zs: number[] = [];
    const residueKeys: string[] = [];

    if (!structure || !chainId) return { symbolTypes, chainIds, xs, ys, zs, residueKeys };

    const normalizedChainId = String(chainId).trim().toUpperCase();
    const units = structure?.data?.units ?? structure?.units ?? [];
    const seen = new Set<string>();

    const normalizeAnchorName = (raw: string): string => {
        const name = String(raw || '').trim().toUpperCase();
        if (name === 'P') return 'P';
        if (name === 'CA') return 'CA';
        if (name === "C4'" || name === 'C4*') return "C4'";
        if (name === "C1'" || name === 'C1*') return "C1'";
        return '';
    };

    const canUseStructureLocation = !!structure?.unitMap
        && !!StructureElement?.Location?.create
        && !!StructureProperties?.chain?.auth_asym_id
        && !!StructureProperties?.atom?.label_atom_id;

    if (canUseStructureLocation) {
        try {
            const loc = StructureElement.Location.create(structure);
            for (const unit of units) {
                if (unit.kind !== 0) continue;
                const elements = unit.elements ?? [];
                for (let i = 0; i < elements.length; i++) {
                    const atomIdx = elements[i];
                    loc.unit = unit;
                    loc.element = atomIdx;

                    const authChainId = String(StructureProperties.chain.auth_asym_id(loc) ?? '');
                    const labelChainId = String(StructureProperties.chain.label_asym_id(loc) ?? '');
                    const authNorm = authChainId.trim().toUpperCase();
                    const labelNorm = labelChainId.trim().toUpperCase();
                    if (authNorm !== normalizedChainId && labelNorm !== normalizedChainId) continue;

                    const labelAtomId = String(StructureProperties.atom.label_atom_id(loc) ?? '');
                    const authAtomId = String(StructureProperties.atom.auth_atom_id(loc) ?? '');
                    const anchor = normalizeAnchorName(labelAtomId || authAtomId);
                    if (!anchor) continue;

                    const residueKey = buildResidueKeyFromParts(
                        StructureProperties.residue.auth_seq_id(loc),
                        StructureProperties.residue.label_seq_id(loc),
                        StructureProperties.residue.pdbx_PDB_ins_code(loc)
                    );
                    if (!residueKey || residueKey === ':') continue;
                    const dedupeKey = `${anchor}:${residueKey}`;
                    if (seen.has(dedupeKey)) continue;
                    seen.add(dedupeKey);

                    const x = Number(StructureProperties.atom.x(loc));
                    const y = Number(StructureProperties.atom.y(loc));
                    const z = Number(StructureProperties.atom.z(loc));
                    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

                    symbolTypes.push(anchor);
                    chainIds.push(chainId);
                    xs.push(x);
                    ys.push(y);
                    zs.push(z);
                    residueKeys.push(residueKey);
                }
            }
            return { symbolTypes, chainIds, xs, ys, zs, residueKeys };
        } catch (err) {
            console.warn('[Re-align][Anchor] Falling back to hierarchy anchor extraction after structure-location failure.', err);
        }
    }

    for (const unit of units) {
        if (unit.kind !== 0) continue;
        const model = unit.model;
        const chains = model?.atomicHierarchy?.chains;
        const residues = model?.atomicHierarchy?.residues;
        const atoms = model?.atomicHierarchy?.atoms;
        const conformation = model?.atomicConformation;
        const residueAtomSegmentsIndex = model?.atomicHierarchy?.residueAtomSegments?.index;
        if (!chains || !atoms || !conformation || !residueAtomSegmentsIndex) continue;

        const elements = unit.elements ?? [];
        for (let i = 0; i < elements.length; i++) {
            const atomIdx = elements[i];
            const chainIdx = unit?.chainIndex?.[i] ?? unit?.chainIndex?.[atomIdx];
            const authChainId = getColumnStringValue(chains.auth_asym_id, chainIdx ?? -1);
            const labelChainId = getColumnStringValue(chains.label_asym_id, chainIdx ?? -1);
            const authNorm = String(authChainId).trim().toUpperCase();
            const labelNorm = String(labelChainId).trim().toUpperCase();
            if (authNorm !== normalizedChainId && labelNorm !== normalizedChainId) continue;

            const labelAtomId = getColumnStringValue(atoms.label_atom_id, atomIdx);
            const authAtomId = getColumnStringValue(atoms.auth_atom_id, atomIdx);
            const anchor = normalizeAnchorName(labelAtomId || authAtomId);
            if (!anchor) continue;

            const residueIdx = residueAtomSegmentsIndex[atomIdx];
            if (!Number.isFinite(residueIdx)) continue;
            const residueKey = buildResidueKeyFromParts(
                getColumnStringValue(residues?.auth_seq_id, residueIdx),
                getColumnStringValue(residues?.label_seq_id, residueIdx),
                getColumnStringValue(residues?.pdbx_PDB_ins_code, residueIdx)
            );
            if (!residueKey || residueKey === ':') continue;
            const dedupeKey = `${anchor}:${residueKey}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);

            const x = conformation.x?.[atomIdx] ?? NaN;
            const y = conformation.y?.[atomIdx] ?? NaN;
            const z = conformation.z?.[atomIdx] ?? NaN;
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;

            symbolTypes.push(anchor);
            chainIds.push(chainId);
            xs.push(x);
            ys.push(y);
            zs.push(z);
            residueKeys.push(residueKey);
        }
    }

    return { symbolTypes, chainIds, xs, ys, zs, residueKeys };
}

function parseResidueSortParts(residueKey: string): { seq: number; ins: string } {
    const raw = String(residueKey || '');
    const [seqRaw = '', insRaw = ''] = raw.split(':');
    const seq = Number.parseInt(seqRaw, 10);
    return {
        seq: Number.isFinite(seq) ? seq : Number.POSITIVE_INFINITY,
        ins: insRaw,
    };
}

function buildPairedAnchorFitData(
    selectedAnchorType: string,
    movingChainId: string,
    referenceChainId: string,
    movingAnchorData: { symbolTypes: string[]; xs: number[]; ys: number[]; zs: number[]; residueKeys: string[] },
    referenceAnchorData: { symbolTypes: string[]; xs: number[]; ys: number[]; zs: number[]; residueKeys: string[] }
) {
    const isFiniteCoord = (x: number, y: number, z: number) => Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);

    const movingEntries = movingAnchorData.symbolTypes
        .map((type, idx) => ({
            type,
            idx,
            residueKey: movingAnchorData.residueKeys[idx] ?? '',
            x: movingAnchorData.xs[idx],
            y: movingAnchorData.ys[idx],
            z: movingAnchorData.zs[idx],
        }))
        .filter(a => a.type === selectedAnchorType && isFiniteCoord(a.x, a.y, a.z));

    const referenceEntries = referenceAnchorData.symbolTypes
        .map((type, idx) => ({
            type,
            idx,
            residueKey: referenceAnchorData.residueKeys[idx] ?? '',
            x: referenceAnchorData.xs[idx],
            y: referenceAnchorData.ys[idx],
            z: referenceAnchorData.zs[idx],
        }))
        .filter(a => a.type === selectedAnchorType && isFiniteCoord(a.x, a.y, a.z));

    const movingByResidue = new Map<string, typeof movingEntries[number]>();
    for (const e of movingEntries) {
        if (!e.residueKey || movingByResidue.has(e.residueKey)) continue;
        movingByResidue.set(e.residueKey, e);
    }
    const referenceByResidue = new Map<string, typeof referenceEntries[number]>();
    for (const e of referenceEntries) {
        if (!e.residueKey || referenceByResidue.has(e.residueKey)) continue;
        referenceByResidue.set(e.residueKey, e);
    }

    const sharedResidueKeys = Array.from(movingByResidue.keys())
        .filter(k => referenceByResidue.has(k))
        .sort((a, b) => {
            const pa = parseResidueSortParts(a);
            const pb = parseResidueSortParts(b);
            if (pa.seq !== pb.seq) return pa.seq - pb.seq;
            return pa.ins.localeCompare(pb.ins);
        });

    const useSharedResidues = sharedResidueKeys.length >= 10;

    const sortedMoving = movingEntries.slice().sort((a, b) => {
        const pa = parseResidueSortParts(a.residueKey);
        const pb = parseResidueSortParts(b.residueKey);
        if (pa.seq !== pb.seq) return pa.seq - pb.seq;
        return pa.ins.localeCompare(pb.ins);
    });
    const sortedReference = referenceEntries.slice().sort((a, b) => {
        const pa = parseResidueSortParts(a.residueKey);
        const pb = parseResidueSortParts(b.residueKey);
        if (pa.seq !== pb.seq) return pa.seq - pb.seq;
        return pa.ins.localeCompare(pb.ins);
    });

    const pairCount = useSharedResidues
        ? sharedResidueKeys.length
        : Math.min(sortedMoving.length, sortedReference.length);

    const movingFit = { symbolTypes: [] as string[], chainIds: [] as string[], xs: [] as number[], ys: [] as number[], zs: [] as number[] };
    const referenceFit = { symbolTypes: [] as string[], chainIds: [] as string[], xs: [] as number[], ys: [] as number[], zs: [] as number[] };

    if (pairCount === 0) {
        return {
            movingFit,
            referenceFit,
            pairing: {
                strategy: useSharedResidues ? 'shared-residue-keys' : 'ordered-fallback',
                pairCount,
                sharedResidueKeyCount: sharedResidueKeys.length,
                movingSelectedCount: sortedMoving.length,
                referenceSelectedCount: sortedReference.length,
            }
        };
    }

    if (useSharedResidues) {
        for (const residueKey of sharedResidueKeys) {
            const m = movingByResidue.get(residueKey)!;
            const r = referenceByResidue.get(residueKey)!;
            movingFit.symbolTypes.push(selectedAnchorType);
            movingFit.chainIds.push(movingChainId);
            movingFit.xs.push(m.x);
            movingFit.ys.push(m.y);
            movingFit.zs.push(m.z);

            referenceFit.symbolTypes.push(selectedAnchorType);
            referenceFit.chainIds.push(referenceChainId);
            referenceFit.xs.push(r.x);
            referenceFit.ys.push(r.y);
            referenceFit.zs.push(r.z);
        }
    } else {
        for (let i = 0; i < pairCount; i++) {
            const m = sortedMoving[i];
            const r = sortedReference[i];
            movingFit.symbolTypes.push(selectedAnchorType);
            movingFit.chainIds.push(movingChainId);
            movingFit.xs.push(m.x);
            movingFit.ys.push(m.y);
            movingFit.zs.push(m.z);

            referenceFit.symbolTypes.push(selectedAnchorType);
            referenceFit.chainIds.push(referenceChainId);
            referenceFit.xs.push(r.x);
            referenceFit.ys.push(r.y);
            referenceFit.zs.push(r.z);
        }
    }

    return {
        movingFit,
        referenceFit,
        pairing: {
            strategy: useSharedResidues ? 'shared-residue-keys' : 'ordered-fallback',
            pairCount,
            sharedResidueKeyCount: sharedResidueKeys.length,
            movingSelectedCount: sortedMoving.length,
            referenceSelectedCount: sortedReference.length,
        }
    };
}

export function readClippingFromViewer(plugin: any): { minNear: number; clipRadius: number } {
    const clipping = plugin?.canvas3d?.props?.cameraClipping ?? {};
    const minNear = Number(clipping.minNear);
    const radius = Number(clipping.radius);
    return {
        minNear: Number.isFinite(minNear) ? minNear : DEFAULT_CLIPPING.minNear,
        clipRadius: Number.isFinite(radius) ? radius : DEFAULT_CLIPPING.clipRadius,
    };
}

export function copyCameraZoomRadiusBetweenViewers(
    sourceViewerRef: React.RefObject<PluginUIContext | null>,
    targetViewerRef: React.RefObject<PluginUIContext | null>
) {
    const sourceSnapshot = sourceViewerRef.current?.canvas3d?.camera?.getSnapshot?.();
    const targetCamera = targetViewerRef.current?.canvas3d?.camera;
    if (!sourceSnapshot || !targetCamera || typeof targetCamera.setState !== 'function') return;

    const toVec3 = (value: any): Vec3 | null => {
        if (!value || value.length < 3) return null;
        const x = Number(value[0]);
        const y = Number(value[1]);
        const z = Number(value[2]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
        return Vec3.create(x, y, z);
    };

    const position = toVec3(sourceSnapshot.position);
    const target = toVec3(sourceSnapshot.target);
    const up = toVec3(sourceSnapshot.up);
    const radius = Number(sourceSnapshot.radius);
    if (!position || !target || !up || !Number.isFinite(radius)) return;

    targetCamera.setState({
        ...targetCamera.state,
        position,
        target,
        up,
        radius,
    });
    targetViewerRef.current?.canvas3d?.requestDraw?.();
}

export async function runWithTemporarySyncDisabled<T>(
    isSyncEnabled: boolean,
    setSyncEnabled: (value: boolean) => void,
    action: () => Promise<T> | T
): Promise<T> {
    if (!isSyncEnabled) {
        return await action();
    }

    setSyncEnabled(false);
    try {
        return await action();
    } finally {
        setSyncEnabled(true);
    }
}

function getSelectedSubunitChainIds(
    subunitToChainIds: Map<string, Set<string>>,
    selectedSubunit: string
): string[] {
    const ids = subunitToChainIds.get(selectedSubunit);
    if (!ids) return [];
    return Array.from(ids);
}

function buildAtomDataForChainGroup(structure: any, chainIds: string[]) {
    const symbolTypes: string[] = [];
    const groupedChainIds: string[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const zs: number[] = [];

    for (const chainId of chainIds) {
        const chainData = getAtomDataFromStructureUnits(structure, chainId);
        symbolTypes.push(...chainData.symbolTypes);
        xs.push(...chainData.xs);
        ys.push(...chainData.ys);
        zs.push(...chainData.zs);
        groupedChainIds.push(...Array(chainData.xs.length).fill(SUBUNIT_REALIGN_CHAIN_ID));
    }

    return {
        symbolTypes,
        chainIds: groupedChainIds,
        xs,
        ys,
        zs,
    };
}

export function buildAtomDataForResidueGroup(
    structure: any,
    residueIds: string[],
    residueToAtomIds: Record<string, string[]>,
    selectedChainId?: string
) {
    const symbolTypes: string[] = [];
    const groupedChainIds: string[] = [];
    const xs: number[] = [];
    const ys: number[] = [];
    const zs: number[] = [];

    const allowedAtomIdx = new Set<number>();
    for (const residueId of residueIds) {
        for (const atomId of residueToAtomIds[residueId] ?? []) {
            const atomIdx = Number(atomId);
            if (Number.isFinite(atomIdx)) allowedAtomIdx.add(atomIdx);
        }
    }
    if (allowedAtomIdx.size === 0) {
        return { symbolTypes, chainIds: groupedChainIds, xs, ys, zs };
    }

    const units = structure?.data?.units ?? structure?.units ?? [];
    // Residue IDs are already built from the currently selected chain in getResidueInfo,
    // so re-filtering by chain index here can drop valid atoms due to model/unit index mismatches.
    void selectedChainId;

    for (const unit of units) {
        if (unit.kind !== 0) continue;
        const model = unit.model;
        const chains = model?.atomicHierarchy?.chains;
        const atoms = model?.atomicHierarchy?.atoms;
        const conformation = model?.atomicConformation;
        if (!atoms || !conformation) continue;

        const elements = unit.elements ?? [];
        for (let i = 0; i < elements.length; i++) {
            const atomIdx = elements[i];
            if (!allowedAtomIdx.has(atomIdx)) continue;

            const symbol = atoms.type_symbol && typeof atoms.type_symbol.value === 'function'
                ? String(atoms.type_symbol.value(atomIdx) ?? '')
                : '';
            symbolTypes.push(symbol);
            groupedChainIds.push(RESIDUE_REALIGN_CHAIN_ID);
            xs.push(conformation.x?.[atomIdx] ?? NaN);
            ys.push(conformation.y?.[atomIdx] ?? NaN);
            zs.push(conformation.z?.[atomIdx] ?? NaN);
        }
    }

    return {
        symbolTypes,
        chainIds: groupedChainIds,
        xs,
        ys,
        zs,
    };
}

function filterResolvedGeneNames(cache: unknown): UniProtGeneNameCache {
    if (!cache || typeof cache !== 'object') return {};
    const entries = Object.entries(cache as Record<string, unknown>)
        .map(([accession, gene]) => [String(accession).trim(), typeof gene === 'string' ? gene.trim() : ''] as const)
        .filter(([accession, gene]) => accession.length > 0 && gene.length > 0);
    return Object.fromEntries(entries);
}

function getResidueSelectionKey(
    chainId: string,
    residueIds: string[],
    residueInsCodes?: Record<string, string | undefined>
): string {
    if (!chainId || residueIds.length === 0) return '';
    const ordered = Array.from(new Set(residueIds.filter(Boolean))).sort();
    return `${chainId}|${ordered.map(id => `${id}:${residueInsCodes?.[id] ?? ''}`).join(',')}`;
}

export function hasSelectionForDisplayDim(config: {
    chainId?: string;
    residueIds?: string[];
    subunitChainIds?: string[];
}): boolean {
    const uniqueSubunitChainIds = Array.from(new Set((config.subunitChainIds ?? []).filter(Boolean)));
    const hasChain = Boolean(config.chainId);
    const hasResidues = (config.residueIds ?? []).length > 0;
    return uniqueSubunitChainIds.length > 0 || hasChain || hasResidues;
}

const App: React.FC<AppProps> = ({ testForceIsMoleculeAlignedLoaded }) => {

    // Store Files and filenames for aligned and alignedTo molecule reloads.
    const [alignedFile, setAlignedFile] = useState<any | null>(null);
    const [alignedFilename, setAlignedFilename] = useState<string | null>(null);
    const [alignedToFile, setAlignedToFile] = useState<any | null>(null);
    const [alignedToFilename, setAlignedToFilename] = useState<string | null>(null);
    const [expectedAlignedToFilename, setExpectedAlignedToFilename] = useState<string | null>(null);

    // Create plugin refs and pass to useMolstarViewers
    const pluginRefA: React.RefObject<PluginUIContext | null> = useRef<PluginUIContext | null>(null);
    const pluginRefB: React.RefObject<PluginUIContext | null> = useRef<PluginUIContext | null>(null);
    const molstarA: ReturnType<typeof useMolstarViewer> = useMolstarViewer(pluginRefA);
    const molstarB: ReturnType<typeof useMolstarViewer> = useMolstarViewer(pluginRefB);

    // Initialize viewer states, pass test prop for test control
    const viewerA: ViewerState = useViewerState(A, testForceIsMoleculeAlignedLoaded);
    const viewerB: ViewerState = useViewerState(B, testForceIsMoleculeAlignedLoaded);
    const setViewerAWrapper = useCallback((viewer: PluginUIContext) => {
        viewerA.ref.current = viewer;
    }, [viewerA]);
    const setViewerBWrapper = useCallback((viewer: PluginUIContext) => {
        viewerB.ref.current = viewer;
    }, [viewerB]);
    const [viewerAReady, setViewerAReady] = useState(false);
    const [viewerBReady, setViewerBReady] = useState(false);
    const [syncEnabled, setSyncEnabled] = useState(false);
    const [isRestoringSessionCameras, setIsRestoringSessionCameras] = useState(false);
    const [showUniprotAccessionInChainLabelsA, setShowUniprotAccessionInChainLabelsA] = useState(true);
    const [showUniprotAccessionInChainLabelsB, setShowUniprotAccessionInChainLabelsB] = useState(true);
    const [selectionDisplayByMode, setSelectionDisplayByMode] = useState<SelectionDisplayByMode>({
        AlignedTo: { mode: 'hybrid', dimUnselected: false, dimStrength: 0.45 },
        Aligned: { mode: 'hybrid', dimUnselected: false, dimStrength: 0.45 },
    });

    const setSelectionDisplayModeFor = useCallback((modeKey: ColorThemeMode, mode: HighlightDisplayMode) => {
        setSelectionDisplayByMode(prev => ({
            ...prev,
            [modeKey]: { ...prev[modeKey], mode },
        }));
    }, []);

    const setDimUnselectedFor = useCallback((modeKey: ColorThemeMode, value: boolean) => {
        setSelectionDisplayByMode(prev => ({
            ...prev,
            [modeKey]: { ...prev[modeKey], dimUnselected: value },
        }));
    }, []);

    const setDimUnselectedStrengthFor = useCallback((modeKey: ColorThemeMode, value: number) => {
        const clamped = Math.max(0, Math.min(1, Number(value)));
        setSelectionDisplayByMode(prev => ({
            ...prev,
            [modeKey]: { ...prev[modeKey], dimStrength: clamped },
        }));
    }, []);
    const rpNameLookupBySpecies = useMemo(
        () => parseRpNameTableBySpecies(rpNameTableCsv),
        []
    );
    const [uniprotGeneNames, setUniprotGeneNames] = useState<UniProtGeneNameCache>({});
    const [pendingUniProtCount, setPendingUniProtCount] = useState(0);
    const [inFlightUniProtCount, setInFlightUniProtCount] = useState(0);
    const [completedUniProtCount, setCompletedUniProtCount] = useState(0);
    const [alignedToChainToUniProtOverride, setAlignedToChainToUniProtOverride] = useState<Map<string, string>>(new Map());
    const [alignedChainToUniProtOverride, setAlignedChainToUniProtOverride] = useState<Map<string, string>>(new Map());
    const [alignedToChainToMoleculeOverride, setAlignedToChainToMoleculeOverride] = useState<Map<string, string>>(new Map());
    const [alignedChainToMoleculeOverride, setAlignedChainToMoleculeOverride] = useState<Map<string, string>>(new Map());
    const uniprotGeneNamesRef = useRef<UniProtGeneNameCache>({});
    const pendingUniProtAccessionsRef = useRef<Set<string>>(new Set());
    const inFlightUniProtAccessionsRef = useRef<Set<string>>(new Set());
    const isProcessingUniProtQueueRef = useRef(false);

    useEffect(() => {
        uniprotGeneNamesRef.current = uniprotGeneNames;
        setCompletedUniProtCount(Object.keys(uniprotGeneNames).length);
        const values = Object.values(uniprotGeneNames);
        const resolvedGeneNames = values.filter(Boolean).length;
        const unresolvedGeneNames = values.length - resolvedGeneNames;
        if (values.length > 0) {
            console.info(`[UniProt] Cache summary: ${resolvedGeneNames} gene name(s), ${unresolvedGeneNames} unresolved accession(s).`);
        }
    }, [uniprotGeneNames]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            const raw = window.localStorage.getItem(UNIPROT_CACHE_STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const resolvedOnly = filterResolvedGeneNames(parsed);
            setUniprotGeneNames(prev => ({ ...resolvedOnly, ...prev }));
            console.info(`[UniProt] Loaded ${Object.keys(resolvedOnly).length} cached gene name(s) from local storage.`);
        } catch (err) {
            console.warn('[UniProt] Failed to read cache from local storage.', err);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            const resolvedOnly = filterResolvedGeneNames(uniprotGeneNames);
            window.localStorage.setItem(UNIPROT_CACHE_STORAGE_KEY, JSON.stringify(resolvedOnly));
        } catch (err) {
            console.warn('[UniProt] Failed to save cache to local storage.', err);
        }
    }, [uniprotGeneNames]);

    const syncUniProtQueueCounts = useCallback(() => {
        setPendingUniProtCount(pendingUniProtAccessionsRef.current.size);
        setInFlightUniProtCount(inFlightUniProtAccessionsRef.current.size);
    }, []);

    const processUniProtQueue = useCallback(async () => {
        if (isProcessingUniProtQueueRef.current) return;
        if (typeof fetch !== 'function' || process.env.NODE_ENV === 'test') return;

        isProcessingUniProtQueueRef.current = true;
        try {
            while (pendingUniProtAccessionsRef.current.size > 0) {
                const pending = Array.from(pendingUniProtAccessionsRef.current);
                pendingUniProtAccessionsRef.current.clear();
                syncUniProtQueueCounts();

                const unresolved = pending.filter(accession => {
                    if (accession in uniprotGeneNamesRef.current) return false;
                    if (inFlightUniProtAccessionsRef.current.has(accession)) return false;
                    return true;
                });

                if (!unresolved.length) continue;

                unresolved.forEach(accession => inFlightUniProtAccessionsRef.current.add(accession));
                syncUniProtQueueCounts();
                console.info(`[UniProt] Looking up ${unresolved.length} accession(s) in background.`);

                await fetchUniProtGeneNamesBatched(unresolved, {
                    batchSize: 20,
                    delayMs: 1200,
                    onBatchResolved: (batch, resolvedBatch) => {
                        setUniprotGeneNames(prev => ({ ...prev, ...resolvedBatch }));
                        const matchedCount = Object.values(resolvedBatch).filter(Boolean).length;
                        console.info(`[UniProt] Batch resolved: ${batch.length} accession(s), ${matchedCount} gene name(s) found.`);
                    },
                });
                unresolved.forEach(accession => inFlightUniProtAccessionsRef.current.delete(accession));
                syncUniProtQueueCounts();
            }
        } finally {
            isProcessingUniProtQueueRef.current = false;
            syncUniProtQueueCounts();
            if (pendingUniProtAccessionsRef.current.size > 0) {
                void processUniProtQueue();
            }
        }
    }, [syncUniProtQueueCounts]);

    const onUniprotAccessionsDiscovered = useCallback((accessions: Iterable<string>) => {
        let hasQueuedAny = false;
        let discoveredCount = 0;
        for (const raw of accessions) {
            const accession = raw.trim();
            if (!accession) continue;
            discoveredCount += 1;
            if (accession in uniprotGeneNamesRef.current) continue;
            if (inFlightUniProtAccessionsRef.current.has(accession)) continue;
            if (pendingUniProtAccessionsRef.current.has(accession)) continue;
            pendingUniProtAccessionsRef.current.add(accession);
            hasQueuedAny = true;
        }

        syncUniProtQueueCounts();
        if (hasQueuedAny) {
            console.info(`[UniProt] Queued ${pendingUniProtAccessionsRef.current.size} accession(s) for lookup.`);
        } else if (discoveredCount > 0) {
            console.info(`[UniProt] Discovered ${discoveredCount} accession(s), but all were already cached or queued.`);
        }

        if (hasQueuedAny) {
            void processUniProtQueue();
        }
    }, [processUniProtQueue, syncUniProtQueueCounts]);

    const discoverUniprotAccessionsFromFile = useCallback(async (file: File, mode?: string) => {
        const lower = file.name.toLowerCase();
        const isCifLike = lower.endsWith('.cif') || lower.endsWith('.mmcif');
        if (!isCifLike) return;

        try {
            const text = await file.text();
            const accessions = extractUniProtAccessionsFromText(text);
            const chainToUniProt = parseChainToUniProtFromCifText(text);
            const chainToMoleculeName = parseChainToMoleculeNameFromCifText(text);

            if (chainToUniProt.size > 0) {
                if (mode === AlignedTo) {
                    setAlignedToChainToUniProtOverride(chainToUniProt);
                } else if (mode === Aligned) {
                    setAlignedChainToUniProtOverride(chainToUniProt);
                }
                console.info(`[UniProt] Parsed ${chainToUniProt.size} chain->UniProt mapping(s) from ${file.name}.`);
            } else {
                console.info(`[UniProt] Parsed 0 chain->UniProt mappings from ${file.name}.`);
            }

            if (chainToMoleculeName.size > 0) {
                if (mode === AlignedTo) {
                    setAlignedToChainToMoleculeOverride(chainToMoleculeName);
                } else if (mode === Aligned) {
                    setAlignedChainToMoleculeOverride(chainToMoleculeName);
                }
                console.info(`[UniProt] Parsed ${chainToMoleculeName.size} chain->molecule mapping(s) from ${file.name}.`);
            }

            if (accessions.size > 0) {
                console.info(`[UniProt] File scan discovered ${accessions.size} accession(s) from ${file.name}.`);
                onUniprotAccessionsDiscovered(accessions);
            } else {
                console.info(`[UniProt] File scan found no UniProt-style accessions in ${file.name}.`);
            }
        } catch (err) {
            console.warn(`[UniProt] Failed to scan ${file.name} for accessions.`, err);
        }
    }, [onUniprotAccessionsDiscovered]);

    // Use a ref to always have the latest alignmentData from AlignedTo
    const alignmentDataRef = useRef<any>(null);
    const persistedStructureTransformsRef = useRef<Record<string, number[]>>({});
    const persistedStructureTransformsByModeRef = useRef<{
        viewerA: { alignedTo?: number[]; aligned?: number[] };
        viewerB: { alignedTo?: number[]; aligned?: number[] };
    }>({ viewerA: {}, viewerB: {} });
    const structureTransformCheckpointsRef = useRef<Record<string, {
        timestamp: number;
        viewerA: {
            stateRefs: { alignedTo: string | null; aligned: string | null };
            resolvedRefs: { alignedTo: string | null; aligned: string | null };
            transforms: { alignedTo?: number[]; aligned?: number[] };
        };
        viewerB: {
            stateRefs: { alignedTo: string | null; aligned: string | null };
            resolvedRefs: { alignedTo: string | null; aligned: string | null };
            transforms: { alignedTo?: number[]; aligned?: number[] };
        };
    }>>({});
    useEffect(() => {
        const alignmentData = viewerA.moleculeAlignedTo?.alignmentData;
        if (alignmentData && Object.keys(alignmentData).length > 0) {
            alignmentDataRef.current = alignmentData;
        } else {
            alignmentDataRef.current = null;
        }
    }, [viewerA.moleculeAlignedTo]);

    const alignmentDataReady = alignmentDataRef.current;

    // Viewer state management
    // -----------------------
    const [activeViewer, setActiveViewer] = useState<ViewerKey>(A);
    // Dummy state to force re-render after plugin-side representation updates.
    const [, setForceUpdate] = useState(0);
    const forceUpdate = () => setForceUpdate(f => f + 1);

    // File inputs for dictionary and colors.
    const dictionaryFile = useFileInput<Array<Record<string, string>>>(parseDictionaryFileContent, []);
    const alignmentFile = useFileInput<Array<Record<string, string>>>(parseDictionaryFileContent, []);
    const [isMoleculeAlignedToColoursLoaded, setIsMoleculeAlignedToColoursLoaded] = useState(false);
    const [isMoleculeAlignedColoursLoaded, setIsMoleculeAlignedColoursLoaded] = useState(false);
    const chainColorsAlignedToInputRef = useRef<HTMLInputElement>(null);
    const chainColorsAlignedInputRef = useRef<HTMLInputElement>(null);
    const residueColorsAlignedToInputRef = useRef<HTMLInputElement>(null);
    const residueColorsAlignedInputRef = useRef<HTMLInputElement>(null);
    const [loadedColorThemes, setLoadedColorThemes] = useState<LoadedColorThemeOption[]>([
        { value: DEFAULT_COLOR_THEME_NAME, label: DEFAULT_COLOR_THEME_LABEL },
    ]);
    const [selectedColorThemeByMode, setSelectedColorThemeByMode] = useState<Record<ColorThemeMode, string>>({
        AlignedTo: DEFAULT_COLOR_THEME_NAME,
        Aligned: DEFAULT_COLOR_THEME_NAME,
    });
    const [selectedResidueThemeByMode, setSelectedResidueThemeByMode] = useState<Record<ColorThemeMode, string>>({
        AlignedTo: DEFAULT_COLOR_THEME_NAME,
        Aligned: DEFAULT_COLOR_THEME_NAME,
    });
    const [colorModeByMode, setColorModeByMode] = useState<Record<ColorThemeMode, RepresentationColorMode>>({
        AlignedTo: 'chain',
        Aligned: 'chain',
    });
    const [loadedColorThemeRowsByName, setLoadedColorThemeRowsByName] = useState<Record<string, Array<Record<string, string>>>>({});
    // Custom color map state.
    const [chainColorMaps] = useState<Map<string, Map<string, Color>>>(new Map());
    const [residueTypeColorMaps] = useState<Map<string, Map<string, Color>>>(new Map());
    const registerLoadedColorTheme = useCallback((themeName: string, rows: Array<Record<string, string>>) => {
        const themeKind = inferColorThemeKind(rows);
        if (!themeKind) {
            console.warn(`[ColorTheme] Could not infer theme kind for ${themeName}.`);
            return;
        }
        const themeChainColorMap = new Map<string, Color>();
        const themeResidueTypeColorMap = new Map<string, Color>();
        rows.forEach(row => {
            if (!row.color) return;
            try {
                const color = Color.fromHexStyle(row.color);
                if (themeKind === 'chain' && row.pdb_chain) {
                    themeChainColorMap.set(row.pdb_chain, color);
                }
                if (themeKind === 'residue-type' && row.residue_type) {
                    themeResidueTypeColorMap.set(row.residue_type, color);
                }
            } catch {
                // Ignore invalid rows and keep valid entries.
            }
        });
        if (themeKind === 'chain') {
            chainColorMaps.set(themeName, themeChainColorMap);
            residueTypeColorMaps.delete(themeName);
        } else {
            residueTypeColorMaps.set(themeName, themeResidueTypeColorMap);
            chainColorMaps.delete(themeName);
        }
        const safeRegisterTheme = (plugin: PluginUIContext | null) => {
            const registry = (plugin as any)?.representation?.structure?.themes?.colorThemeRegistry;
            if (!plugin || !registry) return;
            registerThemeIfNeeded(plugin, themeName, chainColorMaps, residueTypeColorMaps);
        };
        safeRegisterTheme(viewerA.ref.current);
        safeRegisterTheme(viewerB.ref.current);
    }, [chainColorMaps, residueTypeColorMaps, viewerA.ref, viewerB.ref]);

    const getThemeRowsByName = useCallback((themeName: string): Array<Record<string, string>> => {
        return loadedColorThemeRowsByName[themeName] ?? [];
    }, [loadedColorThemeRowsByName]);

    const getThemeKindByName = useCallback((themeName: string): 'chain' | 'residue-type' | null => {
        if (!themeName || themeName === DEFAULT_COLOR_THEME_NAME) return 'chain';
        return inferColorThemeKind(getThemeRowsByName(themeName));
    }, [getThemeRowsByName]);

    const chainThemeOptions = useMemo(() => {
        const options = loadedColorThemes.filter(option => {
            if (option.value === DEFAULT_COLOR_THEME_NAME) return true;
            return getThemeKindByName(option.value) === 'chain';
        });
        return options.length > 0 ? options : [{ value: DEFAULT_COLOR_THEME_NAME, label: DEFAULT_COLOR_THEME_LABEL }];
    }, [getThemeKindByName, loadedColorThemes]);

    const residueThemeOptions = useMemo(() => {
        const options = loadedColorThemes.filter(option => {
            if (option.value === DEFAULT_COLOR_THEME_NAME) return true;
            return getThemeKindByName(option.value) === 'residue-type';
        });
        return options.length > 0 ? options : [{ value: DEFAULT_COLOR_THEME_NAME, label: DEFAULT_COLOR_THEME_LABEL }];
    }, [getThemeKindByName, loadedColorThemes]);

    const getChainColorsByThemeName = useCallback((themeName: string): Map<string, string> => {
        const rows = getThemeRowsByName(themeName);
        const map = new Map<string, string>();
        rows.forEach((row) => {
            if (row.pdb_chain && row.color) {
                map.set(row.pdb_chain, row.color);
            }
        });
        return map;
    }, [getThemeRowsByName]);

    const getResidueTypeColorsByThemeName = useCallback((themeName: string): Map<string, string> => {
        const rows = getThemeRowsByName(themeName);
        const map = new Map<string, string>();
        rows.forEach((row) => {
            const residueType = String(row.residue_type ?? '').trim().toUpperCase();
            const color = normalizeThemeColor(row.color);
            if (!residueType || !color) return;
            map.set(residueType, color);
        });
        return map;
    }, [getThemeRowsByName]);

    const getCurrentColorThemeNameForMode = useCallback((mode: ColorThemeMode): string => {
        return selectedColorThemeByMode[mode] ?? DEFAULT_COLOR_THEME_NAME;
    }, [selectedColorThemeByMode]);

    const normalizeThemeColor = (value: unknown): string | null => {
        if (typeof value === 'string') {
            const normalized = value.trim().toUpperCase();
            return /^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/.test(normalized) ? normalized : null;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
            const hex = `#${Math.max(0, Math.min(0xFFFFFF, Math.floor(value))).toString(16).padStart(6, '0').toUpperCase()}`;
            return hex;
        }
        return null;
    };

    const getResidueTypeDefaultColor = useCallback((residueType: string): string => {
        const key = String(residueType ?? '').trim().toUpperCase();
        if (!key) return RESIDUE_DEFAULT_PALETTE[0];
        let hash = 0;
        for (let i = 0; i < key.length; i++) {
            hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
        }
        const index = Math.abs(hash) % RESIDUE_DEFAULT_PALETTE.length;
        return RESIDUE_DEFAULT_PALETTE[index];
    }, []);

    const getChainColorsFromActiveChainIdTheme = useCallback((mode: ColorThemeMode): Map<string, string> => {
        const structureRefs: Array<{ plugin: PluginUIContext | null; structureRef?: string | null }> = mode === 'AlignedTo'
            ? [
                { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[AlignedTo] },
                { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[AlignedTo] },
            ]
            : [
                { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[Aligned] },
                { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[Aligned] },
            ];

        const map = new Map<string, string>();
        for (const { plugin, structureRef } of structureRefs) {
            if (!plugin || !structureRef) continue;
            const reps = getStructureRepresentations(plugin, structureRef);
            for (const rep of reps) {
                const theme = rep.colorTheme as any;
                const themeName = typeof theme === 'string' ? theme : theme?.name;
                if (themeName !== 'chain-id') continue;
                const entries = theme?.params?.palette?.params?.list?.colors;
                if (!Array.isArray(entries)) continue;
                for (const entry of entries) {
                    if (!Array.isArray(entry) || entry.length < 2) continue;
                    const chain = String(entry[0] ?? '').trim();
                    const color = normalizeThemeColor(entry[1]);
                    if (!chain || !color) continue;
                    map.set(chain, color);
                    map.set(chain.toUpperCase(), color);
                }
            }
        }
        return map;
    }, [molstarA.structureRefs, molstarB.structureRefs, viewerA.ref, viewerB.ref]);

    const getChainColorsFromChainIdProvider = useCallback((mode: ColorThemeMode): Map<string, string> => {
        const structureRefs: Array<{ plugin: PluginUIContext | null; structureRef?: string | null }> = mode === 'AlignedTo'
            ? [
                { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[AlignedTo] },
                { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[AlignedTo] },
            ]
            : [
                { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[Aligned] },
                { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[Aligned] },
            ];

        const map = new Map<string, string>();
        for (const { plugin, structureRef } of structureRefs) {
            if (!plugin || !structureRef) continue;
            const structureData = plugin.managers.structure.hierarchy.current.structures.find(
                s => s.cell.transform.ref === structureRef
            )?.cell.obj?.data;
            if (!structureData) continue;

            try {
                const chainIdTheme = ChainIdColorTheme({ structure: structureData } as any, ChainIdColorThemeProvider.defaultValues as any);
                const location = StructureElement.Location.create(structureData);
                for (const unit of structureData.units) {
                    if (!unit?.elements?.length) continue;
                    for (let elementIndex = 0; elementIndex < unit.elements.length; elementIndex++) {
                        const element = unit.elements[elementIndex];
                        location.unit = unit;
                        location.element = element;
                        const auth = String(StructureProperties.chain.auth_asym_id(location) ?? '').trim();
                        const label = String(StructureProperties.chain.label_asym_id(location) ?? '').trim();
                        const resolved = normalizeThemeColor(chainIdTheme.color(location, false));
                        if (!resolved) continue;
                        if (auth) {
                            map.set(auth, resolved);
                            map.set(auth.toUpperCase(), resolved);
                        }
                        if (label) {
                            map.set(label, resolved);
                            map.set(label.toUpperCase(), resolved);
                        }
                    }
                }
            } catch {
                // Ignore fallback color extraction failures and keep other sources.
            }
        }
        return map;
    }, [molstarA.structureRefs, molstarB.structureRefs, viewerA.ref, viewerB.ref]);

    const getEquivalentChainIdsForMode = useCallback((mode: ColorThemeMode, chainId: string): string[] => {
        const normalizedSelectedChainId = String(chainId ?? '').trim();
        if (!normalizedSelectedChainId) return [];
        const selectedUpper = normalizedSelectedChainId.toUpperCase();
        const aliases = new Set<string>([normalizedSelectedChainId, selectedUpper]);

        const structureRefs: Array<{ plugin: PluginUIContext | null; structureRef?: string | null }> = mode === 'AlignedTo'
            ? [
                { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[AlignedTo] },
                { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[AlignedTo] },
            ]
            : [
                { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[Aligned] },
                { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[Aligned] },
            ];

        for (const { plugin, structureRef } of structureRefs) {
            if (!plugin || !structureRef) continue;
            const structureData = plugin.managers.structure.hierarchy.current.structures.find(
                s => s.cell.transform.ref === structureRef
            )?.cell.obj?.data;
            if (!structureData) continue;

            try {
                const location = StructureElement.Location.create(structureData);
                for (const unit of structureData.units ?? []) {
                    if (!unit?.elements?.length) continue;
                    for (let elementIndex = 0; elementIndex < unit.elements.length; elementIndex++) {
                        const element = unit.elements[elementIndex];
                        location.unit = unit;
                        location.element = element;
                        const auth = String(StructureProperties.chain.auth_asym_id(location) ?? '').trim();
                        const label = String(StructureProperties.chain.label_asym_id(location) ?? '').trim();
                        const authUpper = auth.toUpperCase();
                        const labelUpper = label.toUpperCase();
                        const matches = auth === normalizedSelectedChainId
                            || label === normalizedSelectedChainId
                            || authUpper === selectedUpper
                            || labelUpper === selectedUpper;
                        if (!matches) continue;
                        if (auth) {
                            aliases.add(auth);
                            aliases.add(authUpper);
                        }
                        if (label) {
                            aliases.add(label);
                            aliases.add(labelUpper);
                        }
                    }
                }
            } catch {
                // Best-effort alias expansion; keep basic aliases on failure.
            }
        }

        return Array.from(aliases).filter(Boolean);
    }, [molstarA.structureRefs, molstarB.structureRefs, viewerA.ref, viewerB.ref]);

    const isThemeInUseForFork = useCallback((themeName: string): boolean => {
        if (themeName === DEFAULT_COLOR_THEME_NAME) return false;
        const structureRefs: Array<{ plugin: PluginUIContext | null; structureRef?: string | null }> = [
            { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[AlignedTo] },
            { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[Aligned] },
            { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[AlignedTo] },
            { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[Aligned] },
        ];
        const getThemeName = (theme: any): string => {
            if (typeof theme === 'string') return theme;
            return typeof theme?.name === 'string' ? theme.name : '';
        };
        return structureRefs.some(({ plugin, structureRef }) => {
            if (!plugin || !structureRef) return false;
            const reps = getStructureRepresentations(plugin, structureRef);
            return reps.some(rep => getThemeName(rep.colorTheme) === themeName);
        });
    }, [molstarA.structureRefs, molstarB.structureRefs, viewerA.ref, viewerB.ref]);

    const updateChainColorInTheme = useCallback((themeName: string, chainId: string, color: string, mode?: ColorThemeMode) => {
        if (!themeName) return;
        if (!chainId || !color) return;
        const normalizedChainId = chainId.trim().toUpperCase();
        const normalizedColor = color.trim().toUpperCase();
        if (!/^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/.test(normalizedColor)) return;

        if (themeName === DEFAULT_COLOR_THEME_NAME || themeName === 'chain-id') {
            const targetMode = mode ?? 'AlignedTo';
            const chainAliases = getEquivalentChainIdsForMode(targetMode, chainId);
            const editableThemeName = EDITABLE_CHAIN_THEME_BY_MODE[targetMode];
            const existingMap = getChainColorsFromActiveChainIdTheme(targetMode);
            const existingRows = getThemeRowsByName(editableThemeName);
            existingRows.forEach((row) => {
                const chain = String(row.pdb_chain ?? '').trim();
                const resolved = normalizeThemeColor(row.color);
                if (chain && resolved) {
                    existingMap.set(chain, resolved);
                    existingMap.set(chain.toUpperCase(), resolved);
                }
            });
            for (const alias of chainAliases) {
                const trimmedAlias = alias.trim();
                if (!trimmedAlias) continue;
                existingMap.set(trimmedAlias, normalizedColor);
                existingMap.set(trimmedAlias.toUpperCase(), normalizedColor);
            }
            const currentRows = Array.from(existingMap.entries())
                .filter(([id]) => !!id && id === id.toUpperCase())
                .map(([pdb_chain, color]) => ({ pdb_chain, color }));
            const updatedRows = [...currentRows];
            const keysToUpdate = new Set(chainAliases.map(alias => alias.trim().toUpperCase()).filter(Boolean));
            keysToUpdate.add(normalizedChainId);
            keysToUpdate.forEach((aliasKey) => {
                const idx = updatedRows.findIndex(row => String(row.pdb_chain ?? '').trim().toUpperCase() === aliasKey);
                if (idx >= 0) {
                    updatedRows[idx] = { ...updatedRows[idx], color: normalizedColor };
                } else {
                    updatedRows.push({ pdb_chain: aliasKey, color: normalizedColor });
                }
            });

            if (!keysToUpdate.has(normalizedChainId)) {
                updatedRows.push({ pdb_chain: normalizedChainId, color: normalizedColor });
            }

            registerLoadedColorTheme(editableThemeName, updatedRows);
            setLoadedColorThemes(prev => {
                if (prev.some(option => option.value === editableThemeName)) return prev;
                return [...prev, { value: editableThemeName, label: editableThemeName }];
            });
            setLoadedColorThemeRowsByName(prev => ({
                ...prev,
                [editableThemeName]: updatedRows,
            }));
            setSelectedColorThemeByMode(prev => ({
                ...prev,
                [targetMode]: editableThemeName,
            }));

            return;
        }

        const currentRows = getThemeRowsByName(themeName);
        const updatedRows = [...currentRows];
        const targetModeForAlias: ColorThemeMode | null = mode
            ?? (selectedColorThemeByMode.AlignedTo === themeName
                ? 'AlignedTo'
                : selectedColorThemeByMode.Aligned === themeName
                    ? 'Aligned'
                    : null);
        const aliasKeys = new Set<string>([normalizedChainId]);
        if (targetModeForAlias) {
            getEquivalentChainIdsForMode(targetModeForAlias, chainId)
                .map(alias => alias.trim().toUpperCase())
                .filter(Boolean)
                .forEach(alias => aliasKeys.add(alias));
        }

        aliasKeys.forEach((aliasKey) => {
            const idx = updatedRows.findIndex(row => String(row.pdb_chain ?? '').trim().toUpperCase() === aliasKey);
            if (idx >= 0) {
                updatedRows[idx] = { ...updatedRows[idx], color: normalizedColor };
            } else {
                updatedRows.push({ pdb_chain: aliasKey, color: normalizedColor });
            }
        });

        if (!aliasKeys.has(normalizedChainId)) {
            updatedRows.push({ pdb_chain: normalizedChainId, color: normalizedColor });
        }
        const targetMode: ColorThemeMode | null = mode
            ?? (selectedColorThemeByMode.AlignedTo === themeName
                ? 'AlignedTo'
                : selectedColorThemeByMode.Aligned === themeName
                    ? 'Aligned'
                    : null);

        const shouldForkTheme = !!targetMode && isThemeInUseForFork(themeName);
        const effectiveThemeName = shouldForkTheme
            ? `${themeName}-edit-${Date.now().toString(36)}`
            : themeName;

        registerLoadedColorTheme(effectiveThemeName, updatedRows);
        setLoadedColorThemeRowsByName(prev => ({
            ...prev,
            [effectiveThemeName]: updatedRows,
        }));

        if (shouldForkTheme) {
            setLoadedColorThemes(prev => {
                if (prev.some(option => option.value === effectiveThemeName)) return prev;
                return [...prev, { value: effectiveThemeName, label: effectiveThemeName }];
            });
            setSelectedColorThemeByMode(prev => ({
                ...prev,
                [targetMode as ColorThemeMode]: effectiveThemeName,
            }));
        }
    }, [
        getEquivalentChainIdsForMode,
        getChainColorsFromActiveChainIdTheme,
        getThemeRowsByName,
        isThemeInUseForFork,
        registerLoadedColorTheme,
        selectedColorThemeByMode,
    ]);

    const updateResidueTypeColorInTheme = useCallback((themeName: string, residueType: string, color: string, mode?: ColorThemeMode) => {
        if (!themeName || !residueType || !color) return;
        const normalizedResidueType = residueType.trim().toUpperCase();
        const normalizedColor = color.trim().toUpperCase();
        if (!normalizedResidueType) return;
        if (!/^#(?:[0-9A-F]{3}|[0-9A-F]{6})$/.test(normalizedColor)) return;

        const targetMode = mode ?? 'AlignedTo';
        const editableThemeName = (themeName === DEFAULT_COLOR_THEME_NAME || themeName === 'chain-id')
            ? `residue-type-custom-${targetMode.toLowerCase()}`
            : themeName;
        const currentRows = getThemeRowsByName(editableThemeName);
        const updatedRows = [...currentRows];
        const idx = updatedRows.findIndex(row => String(row.residue_type ?? '').trim().toUpperCase() === normalizedResidueType);
        if (idx >= 0) {
            updatedRows[idx] = { ...updatedRows[idx], residue_type: normalizedResidueType, color: normalizedColor };
        } else {
            updatedRows.push({ residue_type: normalizedResidueType, color: normalizedColor });
        }

        const shouldForkTheme = editableThemeName === themeName && isThemeInUseForFork(themeName);
        const effectiveThemeName = shouldForkTheme
            ? `${themeName}-edit-${Date.now().toString(36)}`
            : editableThemeName;

        registerLoadedColorTheme(effectiveThemeName, updatedRows);
        setLoadedColorThemeRowsByName(prev => ({
            ...prev,
            [effectiveThemeName]: updatedRows,
        }));
        setLoadedColorThemes(prev => {
            if (prev.some(option => option.value === effectiveThemeName)) return prev;
            return [...prev, { value: effectiveThemeName, label: effectiveThemeName }];
        });
        setSelectedResidueThemeByMode(prev => ({
            ...prev,
            [targetMode]: effectiveThemeName,
        }));
    }, [
        getThemeRowsByName,
        isThemeInUseForFork,
        registerLoadedColorTheme,
    ]);

    const handleLoadColorThemeClick = useCallback((mode: ColorThemeMode, kind: 'chain' | 'residue-type') => {
        if (mode === AlignedTo) {
            if (kind === 'chain') chainColorsAlignedToInputRef.current?.click();
            else residueColorsAlignedToInputRef.current?.click();
        } else {
            if (kind === 'chain') chainColorsAlignedInputRef.current?.click();
            else residueColorsAlignedInputRef.current?.click();
        }
    }, [chainColorsAlignedInputRef, chainColorsAlignedToInputRef, residueColorsAlignedInputRef, residueColorsAlignedToInputRef]);

    const handleColorThemeFileChange = useCallback(async (mode: ColorThemeMode, expectedKind: 'chain' | 'residue-type', e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const parsedRows = await parseColorFileContent('', file);
            const parsedKind = inferColorThemeKind(parsedRows);
            if (!parsedKind) {
                alert('Could not parse colour file. Use a simple 2-column file with header: "chain,color" or "residue_type,color".');
                return;
            }
            if (parsedKind !== expectedKind) {
                alert(`Loaded file looks like a ${parsedKind} theme, but this control expects a ${expectedKind} theme.`);
                return;
            }
            const uniqueThemeName = `custom-colors-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const label = file.name.replace(/\.[^.]+$/, '');
            registerLoadedColorTheme(uniqueThemeName, parsedRows);
            setLoadedColorThemeRowsByName(prev => ({
                ...prev,
                [uniqueThemeName]: parsedRows,
            }));
            setLoadedColorThemes(prev => [...prev, { value: uniqueThemeName, label }]);
            if (expectedKind === 'chain') {
                setSelectedColorThemeByMode(prev => ({ ...prev, [mode]: uniqueThemeName }));
            } else {
                setSelectedResidueThemeByMode(prev => ({ ...prev, [mode]: uniqueThemeName }));
            }
            setIsMoleculeAlignedToColoursLoaded(true);
            setIsMoleculeAlignedColoursLoaded(true);
        } catch (err) {
            console.warn(`[ColorTheme] Failed to parse colour theme file for ${mode}.`, err);
        } finally {
            // Allow selecting the same file again.
            e.target.value = '';
        }
    }, [registerLoadedColorTheme]);

    const isThemeInUse = useCallback((themeName: string): boolean => {
        if (themeName === DEFAULT_COLOR_THEME_NAME) return false;
        const structureRefs: Array<{ plugin: PluginUIContext | null; structureRef?: string | null }> = [
            { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[AlignedTo] },
            { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[Aligned] },
            { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[AlignedTo] },
            { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[Aligned] },
        ];
        const getThemeName = (theme: any): string => {
            if (typeof theme === 'string') return theme;
            return typeof theme?.name === 'string' ? theme.name : '';
        };
        return structureRefs.some(({ plugin, structureRef }) => {
            if (!plugin || !structureRef) return false;
            const reps = getStructureRepresentations(plugin, structureRef);
            return reps.some(rep => getThemeName(rep.colorTheme) === themeName);
        });
    }, [molstarA.structureRefs, molstarB.structureRefs, viewerA.ref, viewerB.ref]);

    const handleRemoveSelectedColorTheme = useCallback((mode: ColorThemeMode, kind: 'chain' | 'residue-type') => {
        const selectedName = kind === 'chain' ? selectedColorThemeByMode[mode] : selectedResidueThemeByMode[mode];
        if (selectedName === DEFAULT_COLOR_THEME_NAME) return;
        if (isThemeInUse(selectedName)) {
            alert('This colour theme is currently used by one or more representations across the viewers. Switch those representations to another theme before removing it.');
            return;
        }
        const remainingLoadedThemeCount = loadedColorThemes.filter(option => option.value !== DEFAULT_COLOR_THEME_NAME && option.value !== selectedName).length;
        setLoadedColorThemes(prev => prev.filter(option => option.value !== selectedName));
        setSelectedColorThemeByMode(prev => {
            return {
                ...prev,
                AlignedTo: prev.AlignedTo === selectedName ? DEFAULT_COLOR_THEME_NAME : prev.AlignedTo,
                Aligned: prev.Aligned === selectedName ? DEFAULT_COLOR_THEME_NAME : prev.Aligned,
            };
        });
        setSelectedResidueThemeByMode(prev => ({
            ...prev,
            AlignedTo: prev.AlignedTo === selectedName ? DEFAULT_COLOR_THEME_NAME : prev.AlignedTo,
            Aligned: prev.Aligned === selectedName ? DEFAULT_COLOR_THEME_NAME : prev.Aligned,
        }));
        setIsMoleculeAlignedToColoursLoaded(remainingLoadedThemeCount > 0);
        setIsMoleculeAlignedColoursLoaded(remainingLoadedThemeCount > 0);
        setLoadedColorThemeRowsByName(prev => {
            const next = { ...prev };
            delete next[selectedName];
            if (!next[DEFAULT_COLOR_THEME_NAME]) next[DEFAULT_COLOR_THEME_NAME] = [];
            return next;
        });
        chainColorMaps.delete(selectedName);
        residueTypeColorMaps.delete(selectedName);
    }, [chainColorMaps, residueTypeColorMaps, isThemeInUse, loadedColorThemes, selectedColorThemeByMode, selectedResidueThemeByMode]);

    const chainColorsAlignedToFile = useMemo(() => ({
        inputRef: chainColorsAlignedToInputRef,
        handleButtonClick: () => handleLoadColorThemeClick('AlignedTo', 'chain'),
        handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            void handleColorThemeFileChange('AlignedTo', 'chain', e);
        },
    }), [handleColorThemeFileChange, handleLoadColorThemeClick]);

    const residueColorsAlignedToFile = useMemo(() => ({
        inputRef: residueColorsAlignedToInputRef,
        handleButtonClick: () => handleLoadColorThemeClick('AlignedTo', 'residue-type'),
        handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            void handleColorThemeFileChange('AlignedTo', 'residue-type', e);
        },
    }), [handleColorThemeFileChange, handleLoadColorThemeClick]);

    const selectedAlignedToThemeName = selectedColorThemeByMode.AlignedTo;
    const selectedAlignedThemeName = selectedColorThemeByMode.Aligned;
    const selectedAlignedToResidueThemeName = selectedResidueThemeByMode.AlignedTo;
    const selectedAlignedResidueThemeName = selectedResidueThemeByMode.Aligned;

    const chainColorsAlignedFile = useMemo(() => ({
        inputRef: chainColorsAlignedInputRef,
        handleButtonClick: () => handleLoadColorThemeClick('Aligned', 'chain'),
        handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            void handleColorThemeFileChange('Aligned', 'chain', e);
        },
    }), [handleColorThemeFileChange, handleLoadColorThemeClick]);

    const residueColorsAlignedFile = useMemo(() => ({
        inputRef: residueColorsAlignedInputRef,
        handleButtonClick: () => handleLoadColorThemeClick('Aligned', 'residue-type'),
        handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            void handleColorThemeFileChange('Aligned', 'residue-type', e);
        },
    }), [handleColorThemeFileChange, handleLoadColorThemeClick]);
    // Realigned molecule structure/representation refs
    const [realignedStructRefsA, setRealignedStructRefsA] = useState<{ [id: string]: string }>({});
    const [realignedStructRefsB, setRealignedStructRefsB] = useState<{ [id: string]: string }>({});
    const [realignedRepRefsA, setRealignedRepRefsA] = useState<{ [id: string]: string[] }>({});
    const [realignedRepRefsB, setRealignedRepRefsB] = useState<{ [id: string]: string[] }>({});
    // Subunit state (custom hook)
    const {
        subunitToChainIds: subunitToChainIdsAlignedTo,
        setSubunitToChainIds: setSubunitToChainIdsAlignedTo,
        selectedSubunit: selectedSubunitAlignedTo,
        setSelectedSubunit: setSelectedSubunitAlignedTo,
    } = useSubunitState();
    const {
        subunitToChainIds: subunitToChainIdsAligned,
        setSubunitToChainIds: setSubunitToChainIdsAligned,
        selectedSubunit: selectedSubunitAligned,
        setSelectedSubunit: setSelectedSubunitAligned,
    } = useSubunitState();
    // Chain state (custom hook)
    const {
        chainInfo: chainInfoAlignedTo,
        setChainInfo: setChainInfoAlignedTo,
        selectedChainId: selectedChainIdAlignedTo,
        setSelectedChainId: setSelectedChainIdAlignedTo,
    } = useChainState();
    const [selectedChainIdAlignedTo2, setSelectedChainIdAlignedTo2] = useState<string>('');
    const {
        chainInfo: chainInfoAligned,
        setChainInfo: setChainInfoAligned,
        selectedChainId: selectedChainIdAligned,
        setSelectedChainId: setSelectedChainIdAligned,
    } = useChainState();
    const [selectedChainIdAligned2, setSelectedChainIdAligned2] = useState<string>('');
    const [chainFinderQueryAlignedTo, setChainFinderQueryAlignedTo] = useState('');
    const [chainFinderQueryAligned, setChainFinderQueryAligned] = useState('');
    // Residue state (custom hook)
    const {
        residueInfo: residueInfoAlignedTo,
        setResidueInfo: setResidueInfoAlignedTo,
        selectedResidueIds: selectedResidueIdsAlignedTo,
        setSelectedResidueIds: setSelectedResidueIdsAlignedTo,
        selectedResidueId: selectedResidueIdAlignedTo,
        setSelectedResidueId: setSelectedResidueIdAlignedTo,
    } = useResidueState();
    const {
        residueInfo: residueInfoAlignedTo2,
        setResidueInfo: setResidueInfoAlignedTo2,
        selectedResidueIds: selectedResidueIdsAlignedTo2,
        setSelectedResidueIds: setSelectedResidueIdsAlignedTo2,
        selectedResidueId: selectedResidueIdAlignedTo2,
    } = useResidueState();
    const {
        residueInfo: residueInfoAligned,
        setResidueInfo: setResidueInfoAligned,
        selectedResidueIds: selectedResidueIdsAligned,
        setSelectedResidueIds: setSelectedResidueIdsAligned,
        selectedResidueId: selectedResidueIdAligned,
        setSelectedResidueId: setSelectedResidueIdAligned,
    } = useResidueState();
    const {
        residueInfo: residueInfoAligned2,
        setResidueInfo: setResidueInfoAligned2,
        selectedResidueIds: selectedResidueIdsAligned2,
        setSelectedResidueIds: setSelectedResidueIdsAligned2,
        selectedResidueId: selectedResidueIdAligned2,
    } = useResidueState();

    const getChainColorMapForDefaultTheme = useCallback((mode: ColorThemeMode): Map<string, string> => {
        const selectedChainId = mode === 'AlignedTo' ? selectedChainIdAlignedTo : selectedChainIdAligned;
        const chainInfo = mode === 'AlignedTo' ? chainInfoAlignedTo : chainInfoAligned;
        const rows = getThemeRowsByName(DEFAULT_COLOR_THEME_NAME);
        const activeMap = getChainColorsFromActiveChainIdTheme(mode);
        if (activeMap.size === 0) {
            const providerMap = getChainColorsFromChainIdProvider(mode);
            for (const [chainId, color] of providerMap.entries()) {
                activeMap.set(chainId, color);
            }
        }
        const map = new Map<string, string>();
        for (const [chainId, color] of activeMap.entries()) {
            map.set(chainId, color);
        }
        rows.forEach((row) => {
            if (!row.pdb_chain || !row.color) return;
            const color = normalizeThemeColor(row.color);
            if (!color) return;
            map.set(row.pdb_chain, color);
            map.set(row.pdb_chain.toUpperCase(), color);
        });
        if (selectedChainId) {
            if (!map.has(selectedChainId) && !map.has(selectedChainId.toUpperCase())) {
                map.set(selectedChainId, '#cccccc');
            }
        }
        for (const chainId of chainInfo.chainLabels.keys()) {
            if (!map.has(chainId) && !map.has(chainId.toUpperCase())) map.set(chainId, '#cccccc');
        }
        return map;
    }, [
        chainInfoAligned,
        chainInfoAlignedTo,
        getChainColorsFromChainIdProvider,
        getChainColorsFromActiveChainIdTheme,
        getThemeRowsByName,
        selectedChainIdAligned,
        selectedChainIdAlignedTo,
    ]);

    const chainColorsByMode = {
        AlignedTo: (() => {
            const selectedTheme = selectedColorThemeByMode.AlignedTo;
            const selectedRows = getThemeRowsByName(selectedTheme);
            const activeTheme = selectedTheme !== DEFAULT_COLOR_THEME_NAME && selectedRows.length > 0
                ? selectedTheme
                : getCurrentColorThemeNameForMode('AlignedTo');
            const merged = getChainColorMapForDefaultTheme('AlignedTo');
            if (activeTheme === DEFAULT_COLOR_THEME_NAME || activeTheme === 'chain-id') {
                return merged;
            }
            const loadedThemeRows = getThemeRowsByName(activeTheme);
            if (loadedThemeRows.length === 0) return merged;
            for (const [chainId, color] of getChainColorsByThemeName(activeTheme).entries()) {
                merged.set(chainId, color);
                merged.set(chainId.toUpperCase(), color);
            }
            return merged;
        })(),
        Aligned: (() => {
            const selectedTheme = selectedColorThemeByMode.Aligned;
            const selectedRows = getThemeRowsByName(selectedTheme);
            const activeTheme = selectedTheme !== DEFAULT_COLOR_THEME_NAME && selectedRows.length > 0
                ? selectedTheme
                : getCurrentColorThemeNameForMode('Aligned');
            const merged = getChainColorMapForDefaultTheme('Aligned');
            if (activeTheme === DEFAULT_COLOR_THEME_NAME || activeTheme === 'chain-id') {
                return merged;
            }
            const loadedThemeRows = getThemeRowsByName(activeTheme);
            if (loadedThemeRows.length === 0) return merged;
            for (const [chainId, color] of getChainColorsByThemeName(activeTheme).entries()) {
                merged.set(chainId, color);
                merged.set(chainId.toUpperCase(), color);
            }
            return merged;
        })(),
    };

    const getResidueTypeColorMapForDefaultTheme = useCallback((mode: ColorThemeMode): Map<string, string> => {
        const structureRefs: Array<{ plugin: PluginUIContext | null; structureRef?: string | null }> = mode === 'AlignedTo'
            ? [
                { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[AlignedTo] },
                { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[AlignedTo] },
            ]
            : [
                { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[Aligned] },
                { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[Aligned] },
            ];

        let structureData: any = null;
        for (const { plugin, structureRef } of structureRefs) {
            if (!plugin || !structureRef) continue;
            const candidate = plugin.managers.structure.hierarchy.current.structures.find(
                s => s.cell.transform.ref === structureRef
            )?.cell.obj?.data;
            if (candidate) {
                structureData = candidate;
                break;
            }
        }
        if (!structureData) return new Map<string, string>();

        const map = new Map<string, string>();
        const seenResidues = new Set<string>();
        for (const unit of structureData.units ?? []) {
            if (!unit?.elements?.length || !Unit.isAtomic(unit)) continue;
            for (let elementIndex = 0; elementIndex < unit.elements.length; elementIndex++) {
                const element = unit.elements[elementIndex];
                const residueIndex = unit.model.atomicHierarchy.residueAtomSegments.index[element];
                const residueKey = `${unit.id}:${residueIndex}`;
                if (seenResidues.has(residueKey)) continue;
                seenResidues.add(residueKey);
                const residueType = String(unit.model.atomicHierarchy.atoms.label_comp_id.value(element) ?? '').trim().toUpperCase() || '?';
                if (!map.has(residueType)) {
                    map.set(residueType, getResidueTypeDefaultColor(residueType));
                }
            }
        }
        return map;
    }, [getResidueTypeDefaultColor, molstarA.structureRefs, molstarB.structureRefs, viewerA.ref, viewerB.ref]);

    const residueTypeColorsByMode = {
        AlignedTo: (() => {
            const selectedTheme = selectedResidueThemeByMode.AlignedTo;
            const isDefaultTheme = selectedTheme === DEFAULT_COLOR_THEME_NAME || selectedTheme === 'chain-id';
            const activeThemeName = isDefaultTheme ? DEFAULT_RESIDUE_THEME_BY_MODE.AlignedTo : selectedTheme;
            const loadedRows = getThemeRowsByName(activeThemeName);
            if (loadedRows.length > 0) {
                return getResidueTypeColorsByThemeName(activeThemeName);
            }
            return getResidueTypeColorMapForDefaultTheme('AlignedTo');
        })(),
        Aligned: (() => {
            const selectedTheme = selectedResidueThemeByMode.Aligned;
            const isDefaultTheme = selectedTheme === DEFAULT_COLOR_THEME_NAME || selectedTheme === 'chain-id';
            const activeThemeName = isDefaultTheme ? DEFAULT_RESIDUE_THEME_BY_MODE.Aligned : selectedTheme;
            const loadedRows = getThemeRowsByName(activeThemeName);
            if (loadedRows.length > 0) {
                return getResidueTypeColorsByThemeName(activeThemeName);
            }
            return getResidueTypeColorMapForDefaultTheme('Aligned');
        })(),
    };

    const getResidueTypeCountsForMode = useCallback((mode: ColorThemeMode): Array<{ type: string; count: number }> => {
        const structureRefs: Array<{ plugin: PluginUIContext | null; structureRef?: string | null }> = mode === 'AlignedTo'
            ? [
                { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[AlignedTo] },
                { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[AlignedTo] },
            ]
            : [
                { plugin: viewerA.ref.current, structureRef: molstarA.structureRefs[Aligned] },
                { plugin: viewerB.ref.current, structureRef: molstarB.structureRefs[Aligned] },
            ];

        let structureData: any = null;
        for (const { plugin, structureRef } of structureRefs) {
            if (!plugin || !structureRef) continue;
            const candidate = plugin.managers.structure.hierarchy.current.structures.find(
                s => s.cell.transform.ref === structureRef
            )?.cell.obj?.data;
            if (candidate) {
                structureData = candidate;
                break;
            }
        }
        if (!structureData) return [];

        const counts = new Map<string, number>();
        const seenResidues = new Set<string>();
        for (const unit of structureData.units ?? []) {
            if (!unit?.elements?.length || !Unit.isAtomic(unit)) continue;
            for (let elementIndex = 0; elementIndex < unit.elements.length; elementIndex++) {
                const element = unit.elements[elementIndex];
                const residueIndex = unit.model.atomicHierarchy.residueAtomSegments.index[element];
                const residueKey = `${unit.id}:${residueIndex}`;
                if (seenResidues.has(residueKey)) continue;
                seenResidues.add(residueKey);
                const residueType = String(unit.model.atomicHierarchy.atoms.label_comp_id.value(element) ?? '').trim().toUpperCase() || '?';
                counts.set(residueType, (counts.get(residueType) ?? 0) + 1);
            }
        }

        return Array.from(counts.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => a.type.localeCompare(b.type));
    }, [molstarA.structureRefs, molstarB.structureRefs, viewerA.ref, viewerB.ref]);

    const buildDefaultResidueThemeRows = useCallback((mode: ColorThemeMode): Array<Record<string, string>> => {
        return Array.from(getResidueTypeColorMapForDefaultTheme(mode).entries()).map(([type, color]) => ({
            residue_type: type,
            color,
        }));
    }, [getResidueTypeColorMapForDefaultTheme]);

    const residueTypeCountsByMode = {
        AlignedTo: getResidueTypeCountsForMode('AlignedTo'),
        Aligned: getResidueTypeCountsForMode('Aligned'),
    };

    useEffect(() => {
        const registerDefaultResidueTheme = (mode: ColorThemeMode) => {
            const themeName = DEFAULT_RESIDUE_THEME_BY_MODE[mode];
            const rows = buildDefaultResidueThemeRows(mode);
            if (rows.length === 0) return;
            registerLoadedColorTheme(themeName, rows);
            setLoadedColorThemeRowsByName(prev => ({
                ...prev,
                [themeName]: rows,
            }));
        };
        registerDefaultResidueTheme('AlignedTo');
        registerDefaultResidueTheme('Aligned');
    }, [buildDefaultResidueThemeRows, registerLoadedColorTheme]);

    const getExportableChainThemeRowsForMode = useCallback((mode: ColorThemeMode): Array<{ chain: string; color: string }> => {
        const themeName = getCurrentColorThemeNameForMode(mode);
        const candidateRows = getThemeRowsByName(themeName);
        const map = getChainColorMapForDefaultTheme(mode);
        const candidateKind = inferColorThemeKind(candidateRows);
        if (candidateKind === 'chain' && candidateRows.length > 0) {
            for (const row of candidateRows) {
                const chain = String(row.pdb_chain ?? '').trim().toUpperCase();
                const color = normalizeThemeColor(row.color);
                if (!chain || !color) continue;
                map.set(chain, color);
            }
        }
        const chainLabels = mode === 'AlignedTo' ? chainInfoAlignedTo.chainLabels : chainInfoAligned.chainLabels;
        const orderedChainIds = chainLabels.size > 0
            ? Array.from(chainLabels.keys())
            : Array.from(map.keys()).filter(chain => chain === chain.toUpperCase());

        const normalizedByChain = new Map<string, string>();
        orderedChainIds
            .map(chain => {
                const resolved = map.get(chain) ?? map.get(chain.toUpperCase());
                return {
                    chain: chain.toUpperCase(),
                    color: normalizeThemeColor(resolved) ?? '',
                };
            })
            .filter(row => !!row.chain && !!row.color)
            .forEach(row => normalizedByChain.set(row.chain, row.color));

        return Array.from(normalizedByChain.entries())
            .map(([chain, color]) => ({ chain, color }))
            .sort((a, b) => a.chain.localeCompare(b.chain));
    }, [
        chainInfoAligned.chainLabels,
        chainInfoAlignedTo.chainLabels,
        getChainColorMapForDefaultTheme,
        getCurrentColorThemeNameForMode,
        getThemeRowsByName,
        normalizeThemeColor,
    ]);

    const handleSaveColorThemeForMode = useCallback((mode: ColorThemeMode) => {
        const rows = getExportableChainThemeRowsForMode(mode);
        if (rows.length === 0) {
            alert('No chain colours are available to save yet.');
            return;
        }

        const themeName = getCurrentColorThemeNameForMode(mode);
        const safeThemeName = themeName.replace(/[^a-zA-Z0-9._-]+/g, '-');
        const csvRows = ['chain,color', ...rows.map(row => `${row.chain},${row.color}`)];
        downloadTextFile(
            `ribocode-${mode.toLowerCase()}-${safeThemeName || 'theme'}-${Date.now()}.csv`,
            `${csvRows.join('\n')}\n`,
            'text/csv;charset=utf-8'
        );
    }, [getCurrentColorThemeNameForMode, getExportableChainThemeRowsForMode]);

    const handleSaveResidueThemeForMode = useCallback((mode: ColorThemeMode) => {
        const themeName = selectedResidueThemeByMode[mode] ?? DEFAULT_COLOR_THEME_NAME;
        const rows = getThemeRowsByName(themeName);
        const kind = inferColorThemeKind(rows);
        if (kind !== 'residue-type') {
            alert('No residue-type colour theme is selected for this dataset.');
            return;
        }
        const normalizedRows = rows
            .map((row) => ({
                residue_type: String(row.residue_type ?? '').trim().toUpperCase(),
                color: normalizeThemeColor(row.color) ?? '',
            }))
            .filter(row => !!row.residue_type && !!row.color)
            .sort((a, b) => a.residue_type.localeCompare(b.residue_type));
        if (normalizedRows.length === 0) {
            alert('No residue-type colours are available to save yet.');
            return;
        }

        const safeThemeName = themeName.replace(/[^a-zA-Z0-9._-]+/g, '-');
        const csvRows = ['residue_type,color', ...normalizedRows.map(row => `${row.residue_type},${row.color}`)];
        downloadTextFile(
            `ribocode-${mode.toLowerCase()}-${safeThemeName || 'residue-theme'}-${Date.now()}.csv`,
            `${csvRows.join('\n')}\n`,
            'text/csv;charset=utf-8'
        );
    }, [getThemeRowsByName, selectedResidueThemeByMode]);

    const handleSelectThemeForMode = useCallback((mode: ColorThemeMode, kind: 'chain' | 'residue-type', themeName: string) => {
        if (kind === 'chain') {
            setSelectedColorThemeByMode(prev => ({ ...prev, [mode]: themeName }));
        } else {
            setSelectedResidueThemeByMode(prev => ({ ...prev, [mode]: themeName }));
        }
    }, []);

    const updateRepresentationThemePref = useCallback(async (
        plugin: PluginUIContext | null,
        repRef: string,
        updater: (prev: {
            chainThemeName?: string;
            residueThemeName?: string;
            activeThemeKind?: 'chain' | 'residue-type';
            colorThemeName?: string;
            colorThemeParams?: Record<string, unknown>;
        }) => {
            chainThemeName: string;
            residueThemeName: string;
            activeThemeKind: 'chain' | 'residue-type';
            colorThemeName: string;
            colorThemeParams?: Record<string, unknown>;
        }
    ): Promise<void> => {
        if (!plugin || !repRef) return;
        const cell = plugin.state?.data?.cells?.get(repRef);
        const values = cell?.params?.values;
        if (!values) return;

        const currentTheme = values.colorTheme;
        const currentThemeName = typeof currentTheme === 'string'
            ? currentTheme
            : (typeof currentTheme?.name === 'string' ? currentTheme.name : DEFAULT_COLOR_THEME_NAME);
        const currentThemeParams = typeof currentTheme === 'string'
            ? {}
            : (currentTheme?.params ?? {});

        const next = updater({
            chainThemeName: values._ribocodeChainTheme,
            residueThemeName: values._ribocodeResidueTheme,
            activeThemeKind: values._ribocodeActiveThemeKind,
            colorThemeName: currentThemeName,
            colorThemeParams: currentThemeParams,
        });

        const tree = plugin.state.data.build().to(repRef).update((old: any) => ({
            ...old,
            colorTheme: {
                name: next.colorThemeName,
                params: {
                    ...(next.colorThemeParams ?? {}),
                    __ribocodeActiveThemeKind: next.activeThemeKind,
                },
            },
            _ribocodeChainTheme: next.chainThemeName,
            _ribocodeResidueTheme: next.residueThemeName,
            _ribocodeActiveThemeKind: next.activeThemeKind,
        }));

        await plugin.runTask(plugin.state.data.updateTree(tree));
        plugin.canvas3d?.requestDraw?.();
    }, []);

    const setRepresentationChainTheme = useCallback(async (mode: MoleculeMode, repRef: string, themeName: string): Promise<void> => {
        const updates: Promise<void>[] = [];
        const modeKey: ColorThemeMode = mode === 'Aligned' ? 'Aligned' : 'AlignedTo';
        const pluginA = viewerA.ref.current;
        const pluginB = viewerB.ref.current;
        const mapA = molstarA.repIdMapRef.current?.[mode] ?? {};
        const mapB = molstarB.repIdMapRef.current?.[mode] ?? {};
        const repId = Object.entries(mapA).find(([, ref]) => ref === repRef)?.[0]
            ?? Object.entries(mapB).find(([, ref]) => ref === repRef)?.[0]
            ?? null;

        const targets = new Map<string, { plugin: PluginUIContext | null; ref: string }>();
        if (repRef) {
            if (pluginA?.state?.data?.cells?.get(repRef)) targets.set(`A:${repRef}`, { plugin: pluginA, ref: repRef });
            if (pluginB?.state?.data?.cells?.get(repRef)) targets.set(`B:${repRef}`, { plugin: pluginB, ref: repRef });
        }
        if (repId) {
            const refA = mapA[repId];
            const refB = mapB[repId];
            if (refA) targets.set(`A:${refA}`, { plugin: pluginA, ref: refA });
            if (refB) targets.set(`B:${refB}`, { plugin: pluginB, ref: refB });
        }

        targets.forEach(({ plugin, ref }) => {
            updates.push(updateRepresentationThemePref(plugin, ref, (prev) => {
                const residueThemeName = prev.residueThemeName ?? selectedResidueThemeByMode[modeKey] ?? DEFAULT_COLOR_THEME_NAME;
                return {
                    chainThemeName: themeName,
                    residueThemeName,
                    activeThemeKind: 'chain',
                    colorThemeName: themeName,
                    colorThemeParams: {},
                };
            }));
        });

        await Promise.all(updates);
        forceUpdate();
    }, [forceUpdate, molstarA.repIdMapRef, molstarB.repIdMapRef, selectedResidueThemeByMode, updateRepresentationThemePref, viewerA.ref, viewerB.ref]);

    const setRepresentationResidueTheme = useCallback(async (mode: MoleculeMode, repRef: string, themeName: string): Promise<void> => {
        const updates: Promise<void>[] = [];
        const modeKey: ColorThemeMode = mode === 'Aligned' ? 'Aligned' : 'AlignedTo';
        const effectiveResidueThemeName =
            (themeName === DEFAULT_COLOR_THEME_NAME || themeName === 'chain-id')
                ? DEFAULT_RESIDUE_THEME_BY_MODE[modeKey]
                : themeName;
        const pluginA = viewerA.ref.current;
        const pluginB = viewerB.ref.current;
        const mapA = molstarA.repIdMapRef.current?.[mode] ?? {};
        const mapB = molstarB.repIdMapRef.current?.[mode] ?? {};
        const repId = Object.entries(mapA).find(([, ref]) => ref === repRef)?.[0]
            ?? Object.entries(mapB).find(([, ref]) => ref === repRef)?.[0]
            ?? null;

        const targets = new Map<string, { plugin: PluginUIContext | null; ref: string }>();
        if (repRef) {
            if (pluginA?.state?.data?.cells?.get(repRef)) targets.set(`A:${repRef}`, { plugin: pluginA, ref: repRef });
            if (pluginB?.state?.data?.cells?.get(repRef)) targets.set(`B:${repRef}`, { plugin: pluginB, ref: repRef });
        }
        if (repId) {
            const refA = mapA[repId];
            const refB = mapB[repId];
            if (refA) targets.set(`A:${refA}`, { plugin: pluginA, ref: refA });
            if (refB) targets.set(`B:${refB}`, { plugin: pluginB, ref: refB });
        }

        targets.forEach(({ plugin, ref }) => {
            updates.push(updateRepresentationThemePref(plugin, ref, (prev) => {
                const chainThemeName = prev.chainThemeName ?? selectedColorThemeByMode[modeKey] ?? DEFAULT_COLOR_THEME_NAME;
                return {
                    chainThemeName,
                    residueThemeName: effectiveResidueThemeName,
                    activeThemeKind: 'residue-type',
                    colorThemeName: effectiveResidueThemeName,
                    colorThemeParams: {},
                };
            }));
        });

        await Promise.all(updates);
        forceUpdate();
    }, [forceUpdate, molstarA.repIdMapRef, molstarB.repIdMapRef, selectedColorThemeByMode, updateRepresentationThemePref, viewerA.ref, viewerB.ref]);

    const handleSelectChainIdAlignedTo = useCallback((chainId: string) => {
        setSelectedChainIdAlignedTo(chainId);
        setSelectedResidueIdsAlignedTo([]);
        if (chainId && selectedChainIdAlignedTo2 === chainId) {
            setSelectedChainIdAlignedTo2('');
            setSelectedResidueIdsAlignedTo2([]);
        }
    }, [selectedChainIdAlignedTo2]);

    const handleSelectChainIdAlignedTo2 = useCallback((chainId: string) => {
        if (!selectedChainIdAlignedTo || !chainId || chainId === selectedChainIdAlignedTo) return;
        setSelectedChainIdAlignedTo2(chainId);
        setSelectedResidueIdsAlignedTo2([]);
    }, [selectedChainIdAlignedTo]);
    const handleClearChainIdAlignedTo2 = useCallback(() => {
        setSelectedChainIdAlignedTo2('');
        setSelectedResidueIdsAlignedTo2([]);
    }, []);

    const handleSelectChainIdAligned = useCallback((chainId: string) => {
        setSelectedChainIdAligned(chainId);
        setSelectedResidueIdsAligned([]);
        if (chainId && selectedChainIdAligned2 === chainId) {
            setSelectedChainIdAligned2('');
            setSelectedResidueIdsAligned2([]);
        }
    }, [selectedChainIdAligned2]);

    const handleSelectChainIdAligned2 = useCallback((chainId: string) => {
        if (!selectedChainIdAligned || !chainId || chainId === selectedChainIdAligned) return;
        setSelectedChainIdAligned2(chainId);
        setSelectedResidueIdsAligned2([]);
    }, [selectedChainIdAligned]);
    const handleClearChainIdAligned2 = useCallback(() => {
        setSelectedChainIdAligned2('');
        setSelectedResidueIdsAligned2([]);
    }, []);
    const pendingSessionSelectionsRef = useRef<SessionUiState['selections'] | null>(null);


    // Track realigned molecules with from/to chain IDs to prevent duplicates
    const [realignedMoleculesA, setRealignedMoleculesA] = useState<Array<{ id: string, file: File, label: string, from: string, to: string }>>([]);
    const [realignedMoleculesB, setRealignedMoleculesB] = useState<Array<{ id: string, file: File, label: string, from: string, to: string }>>([]);

    // Use custom confirmation hook
    const confirm = useConfirm();

    // Molecule loading logic extracted to useMoleculeLoader
    // Robust file loading logic for both AlignedTo and Aligned
    const normalizeSessionRepresentation = useCallback((rep: any): SessionRepresentationSpec | null => {
        const typeCandidate = rep?.params?.values?.type?.name ?? rep?.type;
        if (!typeCandidate || !allowedRepresentationTypes.includes(typeCandidate as AllowedRepresentationType)) {
            return null;
        }
        const values = rep?.params?.values ?? {};
        const colorThemeCandidate = values?.colorTheme ?? rep?.colorTheme;
        const normalizeThemeKind = (value: unknown): 'chain' | 'residue-type' => {
            return value === 'residue-type' ? 'residue-type' : 'chain';
        };
        const resolveThemeName = (themeValue: unknown, fallback: string): string => {
            if (typeof themeValue === 'string' && themeValue.trim()) return themeValue;
            return fallback;
        };

        if (typeof colorThemeCandidate === 'string') {
            const activeThemeKind = normalizeThemeKind(values?._ribocodeActiveThemeKind ?? rep?.activeThemeKind);
            const chainThemeName = resolveThemeName(values?._ribocodeChainTheme ?? rep?.chainThemeName, colorThemeCandidate);
            const residueThemeName = resolveThemeName(values?._ribocodeResidueTheme ?? rep?.residueThemeName, DEFAULT_COLOR_THEME_NAME);
            return {
                type: typeCandidate as AllowedRepresentationType,
                colorTheme: { name: colorThemeCandidate, params: {} },
                visible: rep?.visible !== false,
                chainThemeName,
                residueThemeName,
                activeThemeKind,
            };
        }
        if (colorThemeCandidate && typeof colorThemeCandidate.name === 'string') {
            const activeThemeKind = normalizeThemeKind(
                values?._ribocodeActiveThemeKind
                ?? rep?.activeThemeKind
                ?? colorThemeCandidate?.params?.__ribocodeActiveThemeKind
            );
            const fallbackChainTheme = activeThemeKind === 'chain' ? colorThemeCandidate.name : DEFAULT_COLOR_THEME_NAME;
            const fallbackResidueTheme = activeThemeKind === 'residue-type' ? colorThemeCandidate.name : DEFAULT_COLOR_THEME_NAME;
            const chainThemeName = resolveThemeName(values?._ribocodeChainTheme ?? rep?.chainThemeName, fallbackChainTheme);
            return {
                type: typeCandidate as AllowedRepresentationType,
                colorTheme: {
                    name: colorThemeCandidate.name,
                    params: colorThemeCandidate.params ?? {}
                },
                visible: rep?.visible !== false,
                chainThemeName,
                residueThemeName: resolveThemeName(values?._ribocodeResidueTheme ?? rep?.residueThemeName, fallbackResidueTheme),
                activeThemeKind,
            };
        }
        return {
            type: typeCandidate as AllowedRepresentationType,
            colorTheme: { name: 'default', params: {} },
            visible: rep?.visible !== false,
            chainThemeName: resolveThemeName(values?._ribocodeChainTheme ?? rep?.chainThemeName, DEFAULT_COLOR_THEME_NAME),
            residueThemeName: resolveThemeName(values?._ribocodeResidueTheme ?? rep?.residueThemeName, DEFAULT_COLOR_THEME_NAME),
            activeThemeKind: normalizeThemeKind(values?._ribocodeActiveThemeKind ?? rep?.activeThemeKind),
        };
    }, []);

    const serializeRepresentationsForMode = useCallback((
        molstar: ReturnType<typeof useMolstarViewer>,
        pluginRef: React.RefObject<PluginUIContext | null>,
        mode: MoleculeMode
    ): SessionRepresentationSpec[] => {
        const plugin = pluginRef.current;
        const structureRef = molstar.structureRefs[mode];
        if (!plugin || !structureRef) {
            return [];
        }
        const rawReps = getStructureRepresentations(plugin, structureRef);
        const normalized = rawReps
            .map((rep: any) => {
                const cellValues = rep?.repRef ? plugin.state?.data?.cells?.get(rep.repRef)?.params?.values : undefined;
                if (!cellValues) return normalizeSessionRepresentation(rep);
                return normalizeSessionRepresentation({
                    ...rep,
                    params: {
                        ...(rep?.params ?? {}),
                        values: {
                            ...(rep?.params?.values ?? {}),
                            ...cellValues,
                        },
                    },
                });
            })
            .filter((rep: SessionRepresentationSpec | null): rep is SessionRepresentationSpec => !!rep);
        console.log(`[serializeRepresentationsForMode] ${mode}: captured ${rawReps.length} reps, normalized to ${normalized.length}:`, normalized.map(r => `${r.type}(${r.visible ? 'visible' : 'hidden'})`).join(', '));
        return normalized;
    }, [normalizeSessionRepresentation]);

    const getSerializableCameraSnapshot = useCallback((viewerRef: React.RefObject<PluginUIContext | null>): SerializableCameraSnapshot | undefined => {
        const snapshot = viewerRef.current?.canvas3d?.camera?.getSnapshot?.();
        if (!snapshot) return undefined;
        const toTuple3 = (value: any): [number, number, number] | null => {
            if (!value || value.length < 3) return null;
            const x = Number(value[0]);
            const y = Number(value[1]);
            const z = Number(value[2]);
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
            return [x, y, z];
        };
        const position = toTuple3(snapshot.position);
        const target = toTuple3(snapshot.target);
        const up = toTuple3(snapshot.up);
        const radius = Number(snapshot.radius);
        if (!position || !target || !up || !Number.isFinite(radius)) return undefined;
        return { position, target, up, radius };
    }, []);

    const applySerializableCameraSnapshot = useCallback((viewerRef: React.RefObject<PluginUIContext | null>, snapshot?: SerializableCameraSnapshot) => {
        if (!snapshot) return;
        const camera = viewerRef.current?.canvas3d?.camera;
        if (!camera || typeof camera.setState !== 'function') return;
        camera.setState({
            ...camera.state,
            position: [...snapshot.position] as any,
            target: [...snapshot.target] as any,
            up: [...snapshot.up] as any,
            radius: snapshot.radius,
        });
        viewerRef.current?.canvas3d?.requestDraw?.();
    }, []);

    const copyCameraZoomRadius = useCallback((
        sourceViewerRef: React.RefObject<PluginUIContext | null>,
        targetViewerRef: React.RefObject<PluginUIContext | null>
    ) => {
        copyCameraZoomRadiusBetweenViewers(sourceViewerRef, targetViewerRef);
    }, []);

    const resolveViewerStructureRefs = useCallback((
        plugin: PluginUIContext | null,
        refs: Record<string, string | null | undefined>
    ): { alignedTo: string | null; aligned: string | null } => {
        const alignedToFromState = refs[AlignedTo] ?? null;
        const alignedFromState = refs[Aligned] ?? null;
        if (alignedToFromState || alignedFromState) {
            return { alignedTo: alignedToFromState, aligned: alignedFromState };
        }

        const structures = plugin?.managers?.structure?.hierarchy?.current?.structures ?? [];
        const alignedToFromPlugin = structures[0]?.cell?.transform?.ref ?? null;
        const alignedFromPlugin = structures[1]?.cell?.transform?.ref ?? null;
        return { alignedTo: alignedToFromPlugin, aligned: alignedFromPlugin };
    }, []);

    const getSerializableStructureTransform = useCallback((
        plugin: PluginUIContext | null,
        structureRef: string | null | undefined,
        cachedByMode?: number[]
    ): number[] | undefined => {
        if (Array.isArray(cachedByMode) && cachedByMode.length >= 16 && cachedByMode.every(Number.isFinite)) {
            return cachedByMode.slice(0, 16);
        }

        if (!structureRef) return undefined;

        const cached = persistedStructureTransformsRef.current[structureRef];
        if (Array.isArray(cached) && cached.length >= 16 && cached.every(Number.isFinite)) {
            return cached.slice(0, 16);
        }

        if (!plugin) return undefined;
        const structureEntry = plugin.managers.structure.hierarchy.current.structures.find(
            s => s.cell.transform.ref === structureRef
        );
        const matrix = structureEntry?.transform?.cell.obj?.data.coordinateSystem?.matrix ?? Mat4.identity();
        const serialized = Array.from({ length: 16 }, (_v, i) => Number(matrix[i]));
        if (serialized.some(value => !Number.isFinite(value))) return undefined;
        return serialized;
    }, []);

    const applySerializableStructureTransform = useCallback(async (
        plugin: PluginUIContext | null,
        structureRef: string | null | undefined,
        matrixValues?: number[]
    ) => {
        if (!plugin || !structureRef || !Array.isArray(matrixValues) || matrixValues.length < 16) return;
        const numericValues = matrixValues.slice(0, 16).map(Number);
        if (numericValues.some(value => !Number.isFinite(value))) return;

        const matrix = Mat4.identity();
        for (let i = 0; i < 16; i++) {
            matrix[i] = numericValues[i];
        }
        persistedStructureTransformsRef.current[structureRef] = numericValues;

        const existing = plugin.state.data.selectQ(q =>
            q.byRef(structureRef).subtree().withTransformer(StateTransforms.Model.TransformStructureConformation)
        )[0];
        const params = {
            transform: {
                name: 'matrix' as const,
                params: { data: matrix, transpose: false }
            }
        };
        const tree = existing
            ? plugin.state.data.build().to(existing).update(params)
            : plugin.state.data.build().to(structureRef)
                .insert(StateTransforms.Model.TransformStructureConformation, params, { tags: 'ribocode-session-restore-transform' });
        await plugin.runTask(plugin.state.data.updateTree(tree));
        plugin.canvas3d?.requestDraw?.();
    }, []);

    const getStructureTransformDiagnostics = useCallback(() => {
        const createViewerSnapshot = (
            plugin: PluginUIContext | null,
            refs: Record<string, string | null | undefined>,
            cachedByMode: { alignedTo?: number[]; aligned?: number[] }
        ) => {
            const resolvedRefs = resolveViewerStructureRefs(plugin, refs);
            return {
                stateRefs: {
                    alignedTo: refs[AlignedTo] ?? null,
                    aligned: refs[Aligned] ?? null,
                },
                resolvedRefs,
                transforms: {
                    alignedTo: getSerializableStructureTransform(plugin, resolvedRefs.alignedTo, cachedByMode.alignedTo),
                    aligned: getSerializableStructureTransform(plugin, resolvedRefs.aligned, cachedByMode.aligned),
                },
            };
        };

        return {
            timestamp: Date.now(),
            viewerA: createViewerSnapshot(viewerA.ref.current, molstarA.structureRefs, persistedStructureTransformsByModeRef.current.viewerA),
            viewerB: createViewerSnapshot(viewerB.ref.current, molstarB.structureRefs, persistedStructureTransformsByModeRef.current.viewerB),
        };
    }, [
        getSerializableStructureTransform,
        molstarA.structureRefs,
        molstarB.structureRefs,
        resolveViewerStructureRefs,
        viewerA.ref,
        viewerB.ref,
    ]);

    const clearInternalAlignmentCaches = useCallback(() => {
        realignTransformCacheRef.current = {};
        realignBaseTransformCacheRef.current = {};
        realignDiagnosticsCounterRef.current = {};
        lastChainRealignMetricsRef.current = null;
        lastResidueRealignMetricsRef.current = null;
        lastResidueRealignDebugRef.current = { phase: 'idle', timestamp: Date.now() };
        persistedStructureTransformsRef.current = {};
        persistedStructureTransformsByModeRef.current = { viewerA: {}, viewerB: {} };
        structureTransformCheckpointsRef.current = {};
    }, []);

    const hardResetLocalCachesAndReload = useCallback(async () => {
        clearInternalAlignmentCaches();

        try {
            localStorage.clear();
        } catch (err) {
            console.warn('[Cache Reset] localStorage clear failed.', err);
        }
        try {
            sessionStorage.clear();
        } catch (err) {
            console.warn('[Cache Reset] sessionStorage clear failed.', err);
        }

        try {
            const indexedDbWithDatabases = indexedDB as IDBFactory & {
                databases?: () => Promise<Array<{ name?: string }>>;
            };
            const dbs = await indexedDbWithDatabases.databases?.();
            if (Array.isArray(dbs)) {
                await Promise.all(
                    dbs
                        .map(db => db?.name)
                        .filter((name): name is string => !!name)
                        .map(name => new Promise<void>((resolve) => {
                            const req = indexedDB.deleteDatabase(name);
                            req.onsuccess = () => resolve();
                            req.onerror = () => resolve();
                            req.onblocked = () => resolve();
                        }))
                );
            }
        } catch (err) {
            console.warn('[Cache Reset] IndexedDB reset failed.', err);
        }

        try {
            const registrations = await navigator.serviceWorker?.getRegistrations?.();
            if (Array.isArray(registrations)) {
                await Promise.all(registrations.map(registration => registration.unregister()));
            }
        } catch (err) {
            console.warn('[Cache Reset] Service worker unregister failed.', err);
        }

        try {
            const keys = await caches?.keys?.();
            if (Array.isArray(keys)) {
                await Promise.all(keys.map(key => caches.delete(key)));
            }
        } catch (err) {
            console.warn('[Cache Reset] Cache Storage reset failed.', err);
        }

        window.location.reload();
    }, [clearInternalAlignmentCaches]);

    useEffect(() => {
        const globalObj = globalThis as any;
        const shouldExposeTestApi = globalObj?.__RIBOCODE_E2E__ === true || import.meta.env.DEV;
        if (!globalObj || !shouldExposeTestApi) return;

        globalObj.__ribocodeTestApi = {
            getCameraSnapshots: () => ({
                viewerA: getSerializableCameraSnapshot(viewerA.ref),
                viewerB: getSerializableCameraSnapshot(viewerB.ref),
            }),
            getRawCameraSnapshots: () => ({
                viewerA: viewerA.ref.current?.canvas3d?.camera?.getSnapshot?.(),
                viewerB: viewerB.ref.current?.canvas3d?.camera?.getSnapshot?.(),
            }),
            getStructureTransformDiagnostics,
            captureStructureTransformCheckpoint: (label: string) => {
                const key = typeof label === 'string' && label.trim().length > 0 ? label.trim() : 'default';
                const snapshot = getStructureTransformDiagnostics();
                structureTransformCheckpointsRef.current[key] = snapshot;
                return snapshot;
            },
            getStructureTransformCheckpoints: () => ({ ...structureTransformCheckpointsRef.current }),
            clearStructureTransformCheckpoints: () => {
                structureTransformCheckpointsRef.current = {};
            },
            setCameraSnapshot: (viewerKey: ViewerKey, snapshot: SerializableCameraSnapshot) => {
                if (viewerKey === A) {
                    applySerializableCameraSnapshot(viewerA.ref, snapshot);
                } else if (viewerKey === B) {
                    applySerializableCameraSnapshot(viewerB.ref, snapshot);
                }
            },
            getSyncState: () => ({
                syncEnabled,
                activeViewer,
            }),
            getLastRealignMetrics: () => ({
                chain: lastChainRealignMetricsRef.current,
                residue: lastResidueRealignMetricsRef.current,
            }),
            getLastResidueRealignDebug: () => lastResidueRealignDebugRef.current,
            clearInternalAlignmentCaches,
            getSubunitDiagnostics: () => ({
                alignedTo: {
                    selectedSubunit: selectedSubunitAlignedTo,
                    selectedChainIds: getSelectedSubunitChainIds(
                        subunitToChainIdsAlignedTo as unknown as Map<string, Set<string>>,
                        selectedSubunitAlignedTo
                    ).slice().sort(),
                    subunitToChainIds: Object.fromEntries(
                        Array.from(subunitToChainIdsAlignedTo.entries()).map(([subunit, ids]) => [subunit, Array.from(ids).sort()])
                    ),
                },
                aligned: {
                    selectedSubunit: selectedSubunitAligned,
                    selectedChainIds: getSelectedSubunitChainIds(
                        subunitToChainIdsAligned as unknown as Map<string, Set<string>>,
                        selectedSubunitAligned
                    ).slice().sort(),
                    subunitToChainIds: Object.fromEntries(
                        Array.from(subunitToChainIdsAligned.entries()).map(([subunit, ids]) => [subunit, Array.from(ids).sort()])
                    ),
                },
                confidence: (globalThis as any).__ribocodeSubunitInference ?? {},
            }),
        };

        return () => {
            if (globalObj.__ribocodeTestApi) {
                delete globalObj.__ribocodeTestApi;
            }
        };
    }, [
        activeViewer,
        applySerializableCameraSnapshot,
        getSerializableCameraSnapshot,
        getStructureTransformDiagnostics,
        clearInternalAlignmentCaches,
        selectedSubunitAlignedTo,
        selectedSubunitAligned,
        subunitToChainIdsAlignedTo,
        subunitToChainIdsAligned,
        syncEnabled,
        viewerA.ref,
        viewerB.ref,
    ]);

    const waitForRepresentationRef = useCallback(async (
        molstar: ReturnType<typeof useMolstarViewer>,
        mode: MoleculeMode,
        repId: string,
        timeoutMs = 3000
    ): Promise<string | null> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            // Use the ref (always current) rather than repIdMap state (stale closure)
            const repRef = molstar.repIdMapRef?.current?.[mode]?.[repId];
            if (repRef) {
                console.log(`[waitForRepresentationRef] Found ref for ${mode}/${repId.substring(0, 6)} after ${Date.now() - start}ms`);
                return repRef;
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        console.warn(`[waitForRepresentationRef] Timeout waiting for ref ${mode}/${repId.substring(0, 6)} after ${timeoutMs}ms`);
        return null;
    }, []);

    const setRepresentationVisible = useCallback(async (
        plugin: PluginUIContext | null,
        repRef: string,
        visible: boolean
    ): Promise<void> => {
        if (!plugin) {
            console.warn(`[setRepresentationVisible] Plugin is null for ref ${repRef.substring(repRef.length - 6)}`);
            return;
        }
        const cell = plugin.state.data?.cells?.get?.(repRef);
        if (cell) {
            const isVisible = cell?.state?.isHidden !== true;
            console.log(`[setRepresentationVisible] Ref ${repRef.substring(repRef.length - 6)}: currently ${isVisible ? 'visible' : 'hidden'}, wanting ${visible ? 'visible' : 'hidden'}`);
            if (isVisible === visible) {
                console.log(`[setRepresentationVisible] No change needed for ${repRef.substring(repRef.length - 6)}`);
                return;
            }
        } else {
            console.warn(`[setRepresentationVisible] Cell not found for ref ${repRef.substring(repRef.length - 6)}`);
        }
        console.log(`[setRepresentationVisible] Toggling ${repRef.substring(repRef.length - 6)} to ${visible ? 'visible' : 'hidden'}`);
        await MolPluginCommands.State.ToggleVisibility.apply(plugin, [plugin, { state: plugin.state.data, ref: repRef }]);
    }, []);

    const setMoleculeVisible = useCallback(async (
        plugin: PluginUIContext | null,
        molecule: any,
        visible: boolean
    ): Promise<void> => {
        if (!plugin) return;
        const ref = (molecule?.presetResult as any)?.model?.cell?.transform?.ref;
        if (!ref) return;
        const cell = plugin.state.data?.cells?.get?.(ref);
        const isVisible = cell?.state?.isHidden !== true;
        if (isVisible === visible) return;
        await MolPluginCommands.State.ToggleVisibility.apply(plugin, [plugin, { state: plugin.state.data, ref }]);
        plugin.canvas3d?.requestDraw?.();
    }, []);

    const setObjectVisibleByRef = useCallback(async (
        plugin: PluginUIContext | null,
        ref: string | null | undefined,
        visible: boolean
    ): Promise<void> => {
        if (!plugin || !ref) return;
        const cell = plugin.state.data?.cells?.get?.(ref);
        const isVisible = cell?.state?.isHidden !== true;
        if (isVisible === visible) return;
        await MolPluginCommands.State.ToggleVisibility.apply(plugin, [plugin, { state: plugin.state.data, ref }]);
        plugin.canvas3d?.requestDraw?.();
    }, []);

    const restoreSessionRepresentations = useCallback(async (
        mode: MoleculeMode,
        repsA: SessionRepresentationSpec[],
        repsB: SessionRepresentationSpec[],
        refA: string | null,
        refB: string | null,
        pluginA: PluginUIContext | null,
        pluginB: PluginUIContext | null
    ): Promise<void> => {
        console.log(`[restoreSessionRepresentations] Mode=${mode}, repsA=${repsA.length}, repsB=${repsB.length}`);
        const restoreForViewer = async (
            reps: SessionRepresentationSpec[],
            molstar: ReturnType<typeof useMolstarViewer>,
            structureRef: string | null,
            plugin: PluginUIContext | null,
            viewerName: string
        ) => {
            if (!reps.length || !structureRef) {
                console.log(`[restoreForViewer] Skipping ${viewerName}: reps.length=${reps.length}, structureRef=${structureRef ? 'set' : 'null'}`);
                return;
            }
            console.log(`[restoreForViewer] Restoring ${reps.length} reps to ${viewerName}`);

            const existingReps = plugin ? getStructureRepresentations(plugin, structureRef) : [];
            const usedExistingRepRefs = new Set<string>();
            const normalizeTheme = (theme: any): { name: string; params: Record<string, unknown> } => {
                if (typeof theme === 'string') return { name: theme, params: {} };
                return {
                    name: theme?.name ?? 'default',
                    params: theme?.params ?? {}
                };
            };
            const areThemesEqual = (themeA: any, themeB: any): boolean => {
                const normalizedA = normalizeTheme(themeA);
                const normalizedB = normalizeTheme(themeB);
                return normalizedA.name === normalizedB.name
                    && JSON.stringify(normalizedA.params) === JSON.stringify(normalizedB.params);
            };
            const normalizeThemeKind = (value: unknown): 'chain' | 'residue-type' => {
                return value === 'residue-type' ? 'residue-type' : 'chain';
            };
            const getRepThemePrefs = (repLike: any): {
                chainThemeName?: string;
                residueThemeName?: string;
                activeThemeKind: 'chain' | 'residue-type';
            } => {
                const values = repLike?.params?.values ?? {};
                const themeName = typeof repLike?.colorTheme?.name === 'string'
                    ? repLike.colorTheme.name
                    : (typeof repLike?.colorTheme === 'string' ? repLike.colorTheme : DEFAULT_COLOR_THEME_NAME);
                return {
                    chainThemeName: values?._ribocodeChainTheme ?? repLike?.chainThemeName ?? themeName,
                    residueThemeName: values?._ribocodeResidueTheme ?? repLike?.residueThemeName ?? DEFAULT_COLOR_THEME_NAME,
                    activeThemeKind: normalizeThemeKind(values?._ribocodeActiveThemeKind ?? repLike?.activeThemeKind),
                };
            };
            const areThemePrefsEqual = (a: any, b: any): boolean => {
                const prefA = getRepThemePrefs(a);
                const prefB = getRepThemePrefs(b);
                return prefA.chainThemeName === prefB.chainThemeName
                    && prefA.residueThemeName === prefB.residueThemeName
                    && prefA.activeThemeKind === prefB.activeThemeKind;
            };

            for (const rep of reps) {
                const exactMatch = existingReps.find(existing =>
                    !usedExistingRepRefs.has(existing.repRef) &&
                    existing.type === rep.type &&
                    areThemesEqual(existing.colorTheme, rep.colorTheme) &&
                    areThemePrefsEqual(existing, rep)
                );
                const typeOnlyMatch = existingReps.find(existing =>
                    !usedExistingRepRefs.has(existing.repRef) &&
                    existing.type === rep.type
                );

                if (exactMatch && plugin) {
                    usedExistingRepRefs.add(exactMatch.repRef);
                    console.log(`[restoreForViewer] Reusing existing ${rep.type} in ${viewerName}`);
                    if (exactMatch.visible !== rep.visible) {
                        await setRepresentationVisible(plugin, exactMatch.repRef, rep.visible);
                    }
                    continue;
                }

                if (typeOnlyMatch && plugin) {
                    usedExistingRepRefs.add(typeOnlyMatch.repRef);
                    console.log(`[restoreForViewer] Replacing ${rep.type} in ${viewerName} due to colorTheme mismatch`);
                    await MolPluginCommands.State.RemoveObject.apply(plugin, [plugin, {
                        state: plugin.state.data,
                        ref: typeOnlyMatch.repRef,
                    }]);
                }

                const repId = (typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : Math.random().toString(36).slice(2));

                const chainThemeName = rep.chainThemeName ?? rep.colorTheme.name;
                const residueThemeName = rep.residueThemeName ?? DEFAULT_COLOR_THEME_NAME;
                const activeThemeKind: 'chain' | 'residue-type' = rep.activeThemeKind === 'residue-type' ? 'residue-type' : 'chain';
                const restoredThemeName = activeThemeKind === 'residue-type' ? residueThemeName : chainThemeName;

                await molstar.addRepresentation(
                    mode,
                    structureRef,
                    rep.type,
                    {
                        name: restoredThemeName,
                        params: rep.colorTheme.params ?? {},
                    },
                    repId,
                    true,
                    {
                        chainThemeName,
                        residueThemeName,
                        activeThemeKind,
                    }
                );

                if (!rep.visible && plugin) {
                    const repRef = await waitForRepresentationRef(molstar, mode, repId);
                    if (repRef) {
                        console.log(`[restoreForViewer] Hiding ${rep.type} in ${viewerName}`);
                        await setRepresentationVisible(plugin, repRef, false);
                    } else {
                        console.warn(`[restoreForViewer] Failed to find ref for restored ${rep.type} in ${viewerName}`);
                    }
                }
            }
        };

        await restoreForViewer(repsA, molstarA, refA, pluginA, 'Viewer A');
        await restoreForViewer(repsB, molstarB, refB, pluginB, 'Viewer B');
    }, [molstarA, molstarB, setRepresentationVisible, waitForRepresentationRef]);

    const loadMoleculeIntoViewers = async (
        file: File,
        mode: string,
        alignmentData?: any,
        sessionRepresentationsA: SessionRepresentationSpec[] = [],
        sessionRepresentationsB: SessionRepresentationSpec[] = [],
        options?: { hideInRightViewerByDefault?: boolean }
    ): Promise<LoadedMolecule | undefined> => {
        const hideInRightViewerByDefault = options?.hideInRightViewerByDefault === true;
        void discoverUniprotAccessionsFromFile(file, mode);
        const assetFile = Asset.File(file);
        const waitForPlugins = async () => {
            for (let attempt = 0; attempt < 50; attempt++) {
                const pluginA = viewerA.ref.current;
                const pluginB = viewerB.ref.current;
                if (pluginA && pluginB) {
                    return { pluginA, pluginB };
                }
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return null;
        };

        const plugins = await waitForPlugins();
        const pluginA = plugins?.pluginA;
        const pluginB = plugins?.pluginB;
        if (!pluginA || !pluginB) {
            console.error('One or both viewers are not initialized.');
            return undefined;
        }
        // Prevent redundant state updates to break infinite update loops
        if (mode === AlignedTo) {
            if (alignedToFile && alignedToFile.name === file.name) {
                // Already loaded, skip
                return viewerA.moleculeAlignedTo as LoadedMolecule | undefined;
            }
            // Loading a new reference dataset establishes a new baseline; clear
            // any previously accumulated in-place realign cache state.
            realignTransformCacheRef.current = {};
            realignBaseTransformCacheRef.current = {};
            realignDiagnosticsCounterRef.current = {};
            lastChainRealignMetricsRef.current = null;
            lastResidueRealignMetricsRef.current = null;
            lastResidueRealignDebugRef.current = { phase: 'idle', timestamp: Date.now() };
            persistedStructureTransformsRef.current = {};
            persistedStructureTransformsByModeRef.current = { viewerA: {}, viewerB: {} };
            structureTransformCheckpointsRef.current = {};
            setAlignedToFile(file);
            setAlignedToFilename(file.name);
            if (expectedAlignedToFilename) setExpectedAlignedToFilename(null);

            // Load into Viewer A
            const viewerAMoleculeAlignedTo = await loadMoleculeFileToViewer(
                pluginA, assetFile, true, true
            );
            if (!viewerAMoleculeAlignedTo) {
                console.error('Failed to load molecule into viewer A.');
                return undefined;
            }
            viewerA.setMoleculeAlignedTo((prev: any) => ({
                label: viewerAMoleculeAlignedTo.label,
                name: viewerAMoleculeAlignedTo.name,
                filename: viewerAMoleculeAlignedTo.filename ?? prev?.filename ?? file.name,
                presetResult: viewerAMoleculeAlignedTo.presetResult ?? "Unknown",
                trajectory: viewerAMoleculeAlignedTo.trajectory,
                alignmentData: viewerAMoleculeAlignedTo.alignmentData
            }));
            viewerA.setIsMoleculeAlignedToLoaded(true);
            viewerA.setIsMoleculeAlignedToVisible(true);
            let refAAlignedTo: string | null = null;
            const structAAlignedTo = pluginA.managers.structure.hierarchy.current.structures[0];
            if (structAAlignedTo) {
                refAAlignedTo = structAAlignedTo.cell.transform.ref;
                molstarA.setStructureRef(AlignedTo, refAAlignedTo);
            }

            // Load into Viewer B
            const viewerBMoleculeAlignedTo = await loadMoleculeFileToViewer(
                pluginB, assetFile, true, true
            );
            if (!viewerBMoleculeAlignedTo) {
                console.error('Failed to load molecule into viewer B.');
                return undefined;
            }
            viewerB.setMoleculeAlignedTo((prev: any) => ({
                label: viewerBMoleculeAlignedTo.label,
                name: viewerBMoleculeAlignedTo.name,
                filename: viewerBMoleculeAlignedTo.filename ?? prev?.filename ?? file.name,
                presetResult: viewerBMoleculeAlignedTo.presetResult ?? "Unknown",
                trajectory: viewerBMoleculeAlignedTo.trajectory,
                alignmentData: viewerBMoleculeAlignedTo.alignmentData
            }));
            viewerB.setIsMoleculeAlignedToLoaded(true);
            if (hideInRightViewerByDefault) {
                await setMoleculeVisible(pluginB, viewerBMoleculeAlignedTo, false);
                viewerB.setIsMoleculeAlignedToVisible(false);
            } else {
                viewerB.setIsMoleculeAlignedToVisible(true);
            }
                let refBAlignedTo: string | null = null;
                const structBAlignedTo = pluginB.managers.structure.hierarchy.current.structures[0];
                if (structBAlignedTo) {
                    refBAlignedTo = structBAlignedTo.cell.transform.ref;
                    molstarB.setStructureRef(AlignedTo, refBAlignedTo);
                }

            await restoreSessionRepresentations(
                AlignedTo,
                sessionRepresentationsA,
                sessionRepresentationsB,
                refAAlignedTo,
                refBAlignedTo,
                pluginA,
                pluginB
            );

            return viewerAMoleculeAlignedTo as LoadedMolecule;

        } else if (mode === Aligned) {
            if (alignedFile && alignedFile.name === file.name) {
                // Already loaded, skip
                return viewerA.moleculeAligned as LoadedMolecule | undefined;
            }
            // A newly loaded aligned dataset must start from a clean in-place transform baseline.
            realignTransformCacheRef.current = {};
            realignBaseTransformCacheRef.current = {};
            realignDiagnosticsCounterRef.current = {};
            lastChainRealignMetricsRef.current = null;
            lastResidueRealignMetricsRef.current = null;
            lastResidueRealignDebugRef.current = { phase: 'idle', timestamp: Date.now() };
            persistedStructureTransformsRef.current = {};
            persistedStructureTransformsByModeRef.current = { viewerA: {}, viewerB: {} };
            structureTransformCheckpointsRef.current = {};
            setAlignedFile(file);
            setAlignedFilename(file.name);
            const alignData = alignmentData ?? viewerA.moleculeAlignedTo?.alignmentData;
            let refAAligned: string | null = null;
            let refBAligned: string | null = null;

            // Load into Viewer A
            const assetFileA = Asset.File(file);
            const pluginA = viewerA.ref.current;
            let viewerAMoleculeAligned = null;
            if (pluginA) {
                viewerAMoleculeAligned = await loadMoleculeFileToViewer(
                    pluginA, assetFileA, false, true, alignData
                );
            }
            if (viewerAMoleculeAligned) {
                viewerA.setMoleculeAligned((prev: any) => ({
                    label: viewerAMoleculeAligned.label,
                    name: viewerAMoleculeAligned.name,
                    filename: viewerAMoleculeAligned.filename ?? file.name,
                    presetResult: viewerAMoleculeAligned.presetResult ?? "Unknown",
                    trajectory: viewerAMoleculeAligned.trajectory,
                    alignmentData: viewerAMoleculeAligned.alignmentData
                }));
                viewerA.setIsMoleculeAlignedLoaded(true);
                if (hideInRightViewerByDefault) {
                    await setMoleculeVisible(pluginA, viewerAMoleculeAligned, false);
                    viewerA.setIsMoleculeAlignedVisible(false);
                } else {
                    viewerA.setIsMoleculeAlignedVisible(true);
                }
                const structAAligned = pluginA?.managers?.structure?.hierarchy?.current?.structures[1]
                    ?? pluginA?.managers?.structure?.hierarchy?.current?.structures[0];
                if (structAAligned) {
                    refAAligned = structAAligned.cell.transform.ref;
                    molstarA.setStructureRef(Aligned, refAAligned);
                }
            }

            // Load into Viewer B and update state/filename for UI
            const assetFileB = Asset.File(file);
            const pluginB = viewerB.ref.current;
            let viewerBMoleculeAligned = null;
            if (pluginB) {
                viewerBMoleculeAligned = await loadMoleculeFileToViewer(
                    pluginB, assetFileB, false, true, alignData
                );
            }
            if (viewerBMoleculeAligned) {
                viewerB.setMoleculeAligned((prev: any) => ({
                    label: viewerBMoleculeAligned.label,
                    name: viewerBMoleculeAligned.name,
                    filename: viewerBMoleculeAligned.filename ?? file.name,
                    presetResult: viewerBMoleculeAligned.presetResult ?? "Unknown",
                    trajectory: viewerBMoleculeAligned.trajectory,
                    alignmentData: viewerBMoleculeAligned.alignmentData
                }));
                viewerB.setIsMoleculeAlignedLoaded(true);
                viewerB.setIsMoleculeAlignedVisible(true);
                setAlignedFilename(file.name); // Ensure filename is set for UI
                const structBAligned = pluginB?.managers?.structure?.hierarchy?.current?.structures[1]
                    ?? pluginB?.managers?.structure?.hierarchy?.current?.structures[0];
                if (structBAligned) {
                    refBAligned = structBAligned.cell.transform.ref;
                    molstarB.setStructureRef(Aligned, refBAligned);
                }

            }

            await restoreSessionRepresentations(
                Aligned,
                sessionRepresentationsA,
                sessionRepresentationsB,
                refAAligned,
                refBAligned,
                pluginA,
                pluginB
            );

            return (viewerAMoleculeAligned ?? viewerBMoleculeAligned ?? undefined) as LoadedMolecule | undefined;
        }

        return undefined;
    };

    // Robust file input handler for both modes
    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>, mode: string) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (mode === AlignedTo && expectedAlignedToFilename && file.name !== expectedAlignedToFilename) {
                alert(`You must select the file '${expectedAlignedToFilename}' for AlignedTo as required by the loaded session.`);
                return;
            }
            // Use the ref for alignmentData to avoid async state issues
            const alignmentData = mode === Aligned ? alignmentDataRef.current : undefined;
            await loadMoleculeIntoViewers(file, mode, alignmentData, [], [], {
                hideInRightViewerByDefault: true,
            });
        },
        [expectedAlignedToFilename]
    );

    // Fog state grouped by viewer
    const [fogA, setFogA] = useState({ enabled: false, near: 0, far: 100 });
    const [fogB, setFogB] = useState({ enabled: false, near: 0, far: 100 });
    
    // Per-viewer clipping state mapped to Mol* cameraClipping settings.
    const [clippingA, setClippingA] = useState(DEFAULT_CLIPPING);
    const [clippingB, setClippingB] = useState(DEFAULT_CLIPPING);
    const [clippingDefaultsA, setClippingDefaultsA] = useState(DEFAULT_CLIPPING);
    const [clippingDefaultsB, setClippingDefaultsB] = useState(DEFAULT_CLIPPING);
    const clippingAInitializedRef = useRef(false);
    const clippingBInitializedRef = useRef(false);
    const clippingSyncTimerARef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clippingSyncTimerBRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
    // Per-viewer residue zoom options
    const [zoomExtraRadiusA, setZoomExtraRadiusA] = useState(0);
    const [zoomMinRadiusA, setZoomMinRadiusA] = useState(0);
    const [zoomExtraRadiusB, setZoomExtraRadiusB] = useState(0);
    const [zoomMinRadiusB, setZoomMinRadiusB] = useState(0);
    const [chainHighlightOnAlignedTo, setChainHighlightOnAlignedTo] = useState(false);
    const [chainHighlightOnAligned, setChainHighlightOnAligned] = useState(false);
    const [chainInspectOnAAlignedTo, setChainInspectOnAAlignedTo] = useState(false);
    const [chainInspectOnAAligned, setChainInspectOnAAligned] = useState(false);
    const [chainInspectOnBAlignedTo, setChainInspectOnBAlignedTo] = useState(false);
    const [chainInspectOnBAligned, setChainInspectOnBAligned] = useState(false);
    const [residueHighlightOnAlignedTo, setResidueHighlightOnAlignedTo] = useState(false);
    const [residueHighlightOnAligned, setResidueHighlightOnAligned] = useState(false);
    const [residueInspectOnAAlignedTo, setResidueInspectOnAAlignedTo] = useState(false);
    const [residueInspectOnAAligned, setResidueInspectOnAAligned] = useState(false);
    const [residueInspectOnBAlignedTo, setResidueInspectOnBAlignedTo] = useState(false);
    const [residueInspectOnBAligned, setResidueInspectOnBAligned] = useState(false);
    const [subunitHighlightOnAlignedTo, setSubunitHighlightOnAlignedTo] = useState(false);
    const [subunitHighlightOnAligned, setSubunitHighlightOnAligned] = useState(false);
    const [subunitInspectOnAAlignedTo, setSubunitInspectOnAAlignedTo] = useState(false);
    const [subunitInspectOnAAligned, setSubunitInspectOnAAligned] = useState(false);
    const [subunitInspectOnBAlignedTo, setSubunitInspectOnBAlignedTo] = useState(false);
    const [subunitInspectOnBAligned, setSubunitInspectOnBAligned] = useState(false);

    const updateFog = useCallback((pluginARef: any, pluginBRef: any, enabled: boolean, near: number, far: number, clippingMinNear: number, clippingRadius: number) => {
        const safeMinNear = Math.max(0.1, Number(clippingMinNear));
        const safeRadius = Math.max(0, Math.min(99, Number(clippingRadius)));
        [pluginARef, pluginBRef].forEach((pluginRef: any) => {
            const plugin = pluginRef?.canvas3d ? pluginRef : pluginRef?.current;
            if (!plugin?.canvas3d) return;
            if (typeof plugin.canvas3d.setProps !== 'function') return;
            const currentCamera = plugin.canvas3d.props?.camera ?? {};
            const currentCameraClipping = plugin.canvas3d.props?.cameraClipping ?? {};
            plugin.canvas3d.setProps({
                camera: {
                    ...currentCamera,
                    fog: enabled,
                    fogNear: Number(near),
                    fogFar: Number(far),
                },
                cameraClipping: {
                    ...currentCameraClipping,
                    far: true,
                    minNear: safeMinNear,
                    radius: safeRadius,
                },
            });
            plugin.canvas3d.requestDraw?.();
        });
    }, []);

    useEffect(() => {
        if (!viewerAReady || clippingAInitializedRef.current) return;
        const plugin = viewerA.ref.current;
        if (!plugin?.canvas3d) return;
        const initialClipping = readClippingFromViewer(plugin);
        setClippingA(initialClipping);
        setClippingDefaultsA(initialClipping);
        clippingAInitializedRef.current = true;
    }, [viewerAReady]);

    useEffect(() => {
        if (!viewerBReady || clippingBInitializedRef.current) return;
        const plugin = viewerB.ref.current;
        if (!plugin?.canvas3d) return;
        const initialClipping = readClippingFromViewer(plugin);
        setClippingB(initialClipping);
        setClippingDefaultsB(initialClipping);
        clippingBInitializedRef.current = true;
    }, [viewerBReady]);

    useEffect(() => {
        updateFog(viewerA.ref.current, null, fogA.enabled, fogA.near, fogA.far, clippingA.minNear, clippingA.clipRadius);
    }, [viewerAReady, fogA, clippingA, updateFog]);

    useEffect(() => {
        updateFog(viewerB.ref.current, null, fogB.enabled, fogB.near, fogB.far, clippingB.minNear, clippingB.clipRadius);
    }, [viewerBReady, fogB, clippingB, updateFog]);

    const syncClippingFromMolstarAfterZoom = useCallback((sourceViewer: ViewerKey, includeSyncedViewer: boolean) => {
        const applyFromViewer = (
            plugin: PluginUIContext | null,
            setClipping: React.Dispatch<React.SetStateAction<{ minNear: number; clipRadius: number }>>,
            setClippingDefaults: React.Dispatch<React.SetStateAction<{ minNear: number; clipRadius: number }>>
        ) => {
            if (!plugin?.canvas3d) return;
            const clippingFromMolstar = readClippingFromViewer(plugin);
            setClipping(clippingFromMolstar);
            setClippingDefaults(clippingFromMolstar);
        };

        const capture = () => {
            if (sourceViewer === A) {
                applyFromViewer(viewerA.ref.current, setClippingA, setClippingDefaultsA);
                if (includeSyncedViewer) {
                    applyFromViewer(viewerB.ref.current, setClippingB, setClippingDefaultsB);
                }
            } else {
                applyFromViewer(viewerB.ref.current, setClippingB, setClippingDefaultsB);
                if (includeSyncedViewer) {
                    applyFromViewer(viewerA.ref.current, setClippingA, setClippingDefaultsA);
                }
            }
        };

        // Mol* camera clipping can settle asynchronously after loci focus.
        // Sample a few times so visible clipping controls stay in sync without requiring a toggle.
        capture();
        setTimeout(capture, 0);
        setTimeout(capture, 32);
        setTimeout(capture, 96);
    }, [viewerA.ref, viewerB.ref, setClippingA, setClippingB, setClippingDefaultsA, setClippingDefaultsB]);

    const syncClippingFromMolstarCameraEvent = useCallback((viewerKey: ViewerKey) => {
        const applyIfChanged = (
            next: { minNear: number; clipRadius: number },
            setClipping: React.Dispatch<React.SetStateAction<{ minNear: number; clipRadius: number }>>,
            setClippingDefaults: React.Dispatch<React.SetStateAction<{ minNear: number; clipRadius: number }>>
        ) => {
            const hasChanged = (prev: { minNear: number; clipRadius: number }) =>
                Math.abs(prev.minNear - next.minNear) > 1e-6 || Math.abs(prev.clipRadius - next.clipRadius) > 1e-6;

            setClipping(prev => (hasChanged(prev) ? next : prev));
            setClippingDefaults(prev => (hasChanged(prev) ? next : prev));
        };

        const plugin = viewerKey === A ? viewerA.ref.current : viewerB.ref.current;
        if (!plugin?.canvas3d) return;

        const clippingFromMolstar = readClippingFromViewer(plugin);
        if (viewerKey === A) {
            applyIfChanged(clippingFromMolstar, setClippingA, setClippingDefaultsA);
        } else {
            applyIfChanged(clippingFromMolstar, setClippingB, setClippingDefaultsB);
        }
    }, [viewerA.ref, viewerB.ref]);

    useEffect(() => {
        if (!viewerAReady) return;
        const plugin = viewerA.ref.current;
        const stateChanged = plugin?.canvas3d?.camera?.stateChanged;
        if (!stateChanged || typeof stateChanged.subscribe !== 'function') return;

        const subscription = stateChanged.subscribe(() => {
            if (clippingSyncTimerARef.current) {
                clearTimeout(clippingSyncTimerARef.current);
            }
            clippingSyncTimerARef.current = setTimeout(() => {
                clippingSyncTimerARef.current = null;
                syncClippingFromMolstarCameraEvent(A);
            }, 0);
        });

        return () => {
            if (clippingSyncTimerARef.current) {
                clearTimeout(clippingSyncTimerARef.current);
                clippingSyncTimerARef.current = null;
            }
            subscription?.unsubscribe?.();
        };
    }, [viewerAReady, syncClippingFromMolstarCameraEvent, viewerA.ref]);

    useEffect(() => {
        if (!viewerBReady) return;
        const plugin = viewerB.ref.current;
        const stateChanged = plugin?.canvas3d?.camera?.stateChanged;
        if (!stateChanged || typeof stateChanged.subscribe !== 'function') return;

        const subscription = stateChanged.subscribe(() => {
            if (clippingSyncTimerBRef.current) {
                clearTimeout(clippingSyncTimerBRef.current);
            }
            clippingSyncTimerBRef.current = setTimeout(() => {
                clippingSyncTimerBRef.current = null;
                syncClippingFromMolstarCameraEvent(B);
            }, 0);
        });

        return () => {
            if (clippingSyncTimerBRef.current) {
                clearTimeout(clippingSyncTimerBRef.current);
                clippingSyncTimerBRef.current = null;
            }
            subscription?.unsubscribe?.();
        };
    }, [viewerBReady, syncClippingFromMolstarCameraEvent, viewerB.ref]);

    const toggleViewerAAlignedTo = {
        handleButtonClick: async () => {
            await handleToggle(
                viewerA,
                'molecule' + AlignedTo,
                viewerA.setIsMoleculeAlignedToVisible,
                viewerA.isMoleculeAlignedToVisible
            );
        },
    };

    // Toggle visibility for moleculeAligned in viewer A.
    const toggleViewerAAligned = {
        handleButtonClick: async () => {
            const wasVisible = viewerA.isMoleculeAlignedVisible;
            const sourceSnapshot = !wasVisible ? getSerializableCameraSnapshot(viewerB.ref) : undefined;
            await handleToggle(
                viewerA,
                'molecule' + Aligned,
                viewerA.setIsMoleculeAlignedVisible,
                viewerA.isMoleculeAlignedVisible
            );
            // Aligned is hidden in Viewer A by default. When revealing it, align camera/clipping with Viewer B.
            if (!wasVisible) {
                const targetPlugin = viewerA.ref.current;
                if (targetPlugin) {
                    try {
                        await MolPluginCommands.Camera.Reset(targetPlugin);
                    } catch (err) {
                        console.warn('Viewer A camera reset before reveal sync failed.', err);
                    }
                }
                if (sourceSnapshot) {
                    applySerializableCameraSnapshot(viewerA.ref, sourceSnapshot);
                    setTimeout(() => applySerializableCameraSnapshot(viewerA.ref, sourceSnapshot), 0);
                    setTimeout(() => applySerializableCameraSnapshot(viewerA.ref, sourceSnapshot), 32);
                } else {
                    copyCameraZoomRadius(viewerB.ref, viewerA.ref);
                }
                syncClippingFromMolstarAfterZoom(B, true);
            }
        },
    };

    // Toggle visibility for moleculeAlignedTo in viewer B.
    const toggleViewerBAlignedTo = {
        handleButtonClick: async () => {
            const wasVisible = viewerB.isMoleculeAlignedToVisible;
            const sourceSnapshot = !wasVisible ? getSerializableCameraSnapshot(viewerA.ref) : undefined;
            await handleToggle(
                viewerB,
                'molecule' + AlignedTo,
                viewerB.setIsMoleculeAlignedToVisible,
                viewerB.isMoleculeAlignedToVisible
            );
            // AlignedTo is hidden in Viewer B by default. When revealing it, align camera/clipping with Viewer A.
            if (!wasVisible) {
                const targetPlugin = viewerB.ref.current;
                if (targetPlugin) {
                    try {
                        await MolPluginCommands.Camera.Reset(targetPlugin);
                    } catch (err) {
                        console.warn('Viewer B camera reset before reveal sync failed.', err);
                    }
                }
                if (sourceSnapshot) {
                    applySerializableCameraSnapshot(viewerB.ref, sourceSnapshot);
                    setTimeout(() => applySerializableCameraSnapshot(viewerB.ref, sourceSnapshot), 0);
                    setTimeout(() => applySerializableCameraSnapshot(viewerB.ref, sourceSnapshot), 32);
                } else {
                    copyCameraZoomRadius(viewerA.ref, viewerB.ref);
                }
                syncClippingFromMolstarAfterZoom(A, true);
            }
        },
    };

    // Toggle visibility for moleculeAligned in viewer B.
    const toggleViewerBAligned = {
        handleButtonClick: async () => {
            await handleToggle(
                viewerB,
                'molecule' + Aligned,
                viewerB.setIsMoleculeAlignedVisible,
                viewerB.isMoleculeAlignedVisible
            );
        },
    };

    // Get structure refs for both viewers.
    const structureRefAAlignedTo: string | null = molstarA.structureRefs[AlignedTo];
    const structureRefAAligned: string | null = molstarA.structureRefs[Aligned];
    const structureRefBAlignedTo: string | null = molstarB.structureRefs[AlignedTo];
    const structureRefBAligned: string | null = molstarB.structureRefs[Aligned];
    
    // Representation type state.
    const [representationTypeAlignedTo, setRepresentationTypeAlignedTo] = useState<AllowedRepresentationType>('spacefill');
    const [representationTypeAligned, setRepresentationTypeAligned] = useState<AllowedRepresentationType>('spacefill');

    useEffect(() => {
        const safeRegisterTheme = (plugin: PluginUIContext | null, themeName: string) => {
            const registry = (plugin as any)?.representation?.structure?.themes?.colorThemeRegistry;
            if (!plugin || !registry) return;
            registerThemeIfNeeded(plugin, themeName, chainColorMaps, residueTypeColorMaps);
        };
        const allLoadedThemeNames = loadedColorThemes
            .map((option: LoadedColorThemeOption) => option.value)
            .filter(themeName => themeName !== DEFAULT_COLOR_THEME_NAME);
        allLoadedThemeNames.forEach(themeName => {
            safeRegisterTheme(viewerA.ref.current, themeName);
            safeRegisterTheme(viewerB.ref.current, themeName);
        });
    }, [loadedColorThemes, chainColorMaps, residueTypeColorMaps, viewerA.ref, viewerB.ref, viewerAReady, viewerBReady]);

    // Custom hooks for updating chain info and subunit-to-chain mapping for both viewers.
    useUpdateChainInfo(
        viewerA.ref,
        structureRefAAlignedTo,
        molstarA,
        setChainInfoAlignedTo,
        setSubunitToChainIdsAlignedTo,
        AlignedTo,
        rpNameLookupBySpecies,
        uniprotGeneNames,
        onUniprotAccessionsDiscovered,
        showUniprotAccessionInChainLabelsA,
        alignedToChainToUniProtOverride,
        alignedToChainToMoleculeOverride
    );
    useUpdateChainInfo(
        viewerB.ref,
        structureRefBAligned,
        molstarB,
        setChainInfoAligned,
        setSubunitToChainIdsAligned,
        Aligned,
        rpNameLookupBySpecies,
        uniprotGeneNames,
        onUniprotAccessionsDiscovered,
        showUniprotAccessionInChainLabelsB,
        alignedChainToUniProtOverride,
        alignedChainToMoleculeOverride
    );

    // Generalized effect for residue ID selection and info update.
    useUpdateResidueInfo(viewerA.ref, structureRefAAlignedTo, molstarA, selectedChainIdAlignedTo, setResidueInfoAlignedTo, selectedResidueIdsAlignedTo, setSelectedResidueIdsAlignedTo, AlignedTo, 'all');
    useUpdateResidueInfo(viewerA.ref, structureRefAAlignedTo, molstarA, selectedChainIdAlignedTo2, setResidueInfoAlignedTo2, selectedResidueIdsAlignedTo2, setSelectedResidueIdsAlignedTo2, `${AlignedTo}-slot2`, 'all');
    useUpdateResidueInfo(viewerB.ref, structureRefBAligned, molstarB, selectedChainIdAligned, setResidueInfoAligned, selectedResidueIdsAligned, setSelectedResidueIdsAligned, Aligned, 'all');
    useUpdateResidueInfo(viewerB.ref, structureRefBAligned, molstarB, selectedChainIdAligned2, setResidueInfoAligned2, selectedResidueIdsAligned2, setSelectedResidueIdsAligned2, `${Aligned}-slot2`, 'all');

    // Chain zoom handlers
    const chainZoomAAlignedTo = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        property: 'chain-test',
        chainId: selectedChainIdAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const chainZoomAAligned = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        property: 'chain-test',
        chainId: selectedChainIdAligned,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const chainZoomBAlignedTo = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        property: 'chain-test',
        chainId: selectedChainIdAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });
    const chainZoomBAligned = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        property: 'chain-test',
        chainId: selectedChainIdAligned,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });
    const chainZoomAAlignedTo2 = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        property: 'chain-test',
        chainId: selectedChainIdAlignedTo2,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo2,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const chainZoomAAligned2 = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        property: 'chain-test',
        chainId: selectedChainIdAligned2,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned2,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const chainZoomBAlignedTo2 = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        property: 'chain-test',
        chainId: selectedChainIdAlignedTo2,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo2,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });
    const chainZoomBAligned2 = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        property: 'chain-test',
        chainId: selectedChainIdAligned2,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned2,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });
    const combinedChainIdsAlignedTo = [selectedChainIdAlignedTo, selectedChainIdAlignedTo2].filter(Boolean);
    const combinedChainIdsAligned = [selectedChainIdAligned, selectedChainIdAligned2].filter(Boolean);
    const hasCombinedResiduesAlignedTo = (selectedResidueIdsAlignedTo.length + selectedResidueIdsAlignedTo2.length) > 0;
    const hasCombinedResiduesAligned = (selectedResidueIdsAligned.length + selectedResidueIdsAligned2.length) > 0;
    const combinedSelectionZoomAAlignedTo = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        property: 'subunit-test',
        chainId: selectedChainIdAlignedTo,
        chainIds: combinedChainIdsAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainIds: combinedChainIdsAlignedTo,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const combinedSelectionZoomAAligned = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        property: 'subunit-test',
        chainId: selectedChainIdAligned,
        chainIds: combinedChainIdsAligned,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainIds: combinedChainIdsAligned,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const combinedSelectionZoomBAlignedTo = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        property: 'subunit-test',
        chainId: selectedChainIdAlignedTo,
        chainIds: combinedChainIdsAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainIds: combinedChainIdsAlignedTo,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });
    const combinedSelectionZoomBAligned = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        property: 'subunit-test',
        chainId: selectedChainIdAligned,
        chainIds: combinedChainIdsAligned,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainIds: combinedChainIdsAligned,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });

    const chainHighlightAAlignedTo = makeChainHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainId: selectedChainIdAlignedTo,
        isHighlighted: chainHighlightOnAlignedTo,
        setIsHighlighted: setChainHighlightOnAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
    });
    const chainHighlightAAligned = makeChainHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        chainId: selectedChainIdAligned,
        isHighlighted: chainHighlightOnAligned,
        setIsHighlighted: setChainHighlightOnAligned,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned,
    });
    const chainHighlightBAlignedTo = makeChainHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        chainId: selectedChainIdAlignedTo,
        isHighlighted: chainHighlightOnAlignedTo,
        setIsHighlighted: setChainHighlightOnAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
    });
    const chainHighlightBAligned = makeChainHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        chainId: selectedChainIdAligned,
        isHighlighted: chainHighlightOnAligned,
        setIsHighlighted: setChainHighlightOnAligned,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned,
    });

    const inspectSyncVisibilityRef = useRef({
        viewerAAlignedToVisible: false,
        viewerAAlignedVisible: false,
        viewerBAlignedToVisible: false,
        viewerBAlignedVisible: false,
    });
    inspectSyncVisibilityRef.current = {
        viewerAAlignedToVisible: viewerA.isMoleculeAlignedToVisible,
        viewerAAlignedVisible: viewerA.isMoleculeAlignedVisible,
        viewerBAlignedToVisible: viewerB.isMoleculeAlignedToVisible,
        viewerBAlignedVisible: viewerB.isMoleculeAlignedVisible,
    };

    const chainInspectAAlignedTo = makeChainInspectToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainId: selectedChainIdAlignedTo,
        isInspecting: chainInspectOnAAlignedTo,
        setIsInspecting: setChainInspectOnAAlignedTo,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerBAlignedToVisible,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
    });
    const chainInspectAAligned = makeChainInspectToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        chainId: selectedChainIdAligned,
        isInspecting: chainInspectOnAAligned,
        setIsInspecting: setChainInspectOnAAligned,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerBAlignedVisible,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned,
    });
    const chainInspectBAlignedTo = makeChainInspectToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        chainId: selectedChainIdAlignedTo,
        isInspecting: chainInspectOnBAlignedTo,
        setIsInspecting: setChainInspectOnBAlignedTo,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerAAlignedToVisible,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
    });
    const chainInspectBAligned = makeChainInspectToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        chainId: selectedChainIdAligned,
        isInspecting: chainInspectOnBAligned,
        setIsInspecting: setChainInspectOnBAligned,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerAAlignedVisible,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned,
    });

    const selectedResidueInsCodesAlignedTo = useMemo(
        () => Object.fromEntries(
            selectedResidueIdsAlignedTo.map((id) => [id, residueInfoAlignedTo.residueLabels.get(id)?.insCode])
        ) as Record<string, string | undefined>,
        [selectedResidueIdsAlignedTo, residueInfoAlignedTo]
    );
    const selectedResidueInsCodesAligned = useMemo(
        () => Object.fromEntries(
            selectedResidueIdsAligned.map((id) => [id, residueInfoAligned.residueLabels.get(id)?.insCode])
        ) as Record<string, string | undefined>,
        [selectedResidueIdsAligned, residueInfoAligned]
    );
    const commonResidueIdsAcrossSelectedChains = useMemo(() => {
        if (!selectedChainIdAlignedTo || !selectedChainIdAligned) return [] as string[];
        const idsAlignedTo = new Set(residueInfoAlignedTo.residueLabels.keys());
        const idsAligned = new Set(residueInfoAligned.residueLabels.keys());
        if (idsAlignedTo.size === 0 || idsAligned.size === 0) return [] as string[];
        const shared = Array.from(idsAlignedTo).filter((id) => idsAligned.has(id));
        shared.sort((a, b) => Number(a) - Number(b));
        return shared;
    }, [
        residueInfoAlignedTo.residueLabels,
        residueInfoAligned.residueLabels,
        selectedChainIdAlignedTo,
        selectedChainIdAligned,
    ]);
    const commonResidueIdsAcrossSelectedChains2 = useMemo(() => {
        if (!selectedChainIdAlignedTo2 || !selectedChainIdAligned2) return [] as string[];
        const idsAlignedTo = new Set(residueInfoAlignedTo2.residueLabels.keys());
        const idsAligned = new Set(residueInfoAligned2.residueLabels.keys());
        if (idsAlignedTo.size === 0 || idsAligned.size === 0) return [] as string[];
        const shared = Array.from(idsAlignedTo).filter((id) => idsAligned.has(id));
        shared.sort((a, b) => Number(a) - Number(b));
        return shared;
    }, [
        residueInfoAlignedTo2.residueLabels,
        residueInfoAligned2.residueLabels,
        selectedChainIdAlignedTo2,
        selectedChainIdAligned2,
    ]);
    const residueZoomLabelAlignedTo = selectedResidueIdsAlignedTo.length > 1
        ? `${selectedResidueIdsAlignedTo.length} residues`
        : (residueInfoAlignedTo.residueLabels.get(selectedResidueIdAlignedTo)?.name || '');
    const residueZoomLabelAligned = selectedResidueIdsAligned.length > 1
        ? `${selectedResidueIdsAligned.length} residues`
        : (residueInfoAligned.residueLabels.get(selectedResidueIdAligned)?.name || '');
    const residueZoomLabelAlignedTo2 = selectedResidueIdsAlignedTo2.length > 1
        ? `${selectedResidueIdsAlignedTo2.length} residues`
        : (residueInfoAlignedTo2.residueLabels.get(selectedResidueIdAlignedTo2)?.name || '');
    const residueZoomLabelAligned2 = selectedResidueIdsAligned2.length > 1
        ? `${selectedResidueIdsAligned2.length} residues`
        : (residueInfoAligned2.residueLabels.get(selectedResidueIdAligned2)?.name || '');
    const residueZoomDisabledAlignedTo = selectedResidueIdsAlignedTo.length === 0;
    const residueZoomDisabledAligned = selectedResidueIdsAligned.length === 0;
    const residueZoomDisabledAlignedTo2 = selectedResidueIdsAlignedTo2.length === 0;
    const residueZoomDisabledAligned2 = selectedResidueIdsAligned2.length === 0;

    // Residue zoom handlers
    const residueZoomAAlignedTo = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        property: 'residue-test',
        chainId: selectedChainIdAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
        residueId: selectedResidueIdAlignedTo,
        syncResidueId: selectedResidueIdAlignedTo,
        insCode: residueInfoAlignedTo.residueLabels.get(selectedResidueIdAlignedTo)?.insCode,
        syncInsCode: residueInfoAlignedTo.residueLabels.get(selectedResidueIdAlignedTo)?.insCode,
        residueIds: selectedResidueIdsAlignedTo,
        syncResidueIds: selectedResidueIdsAlignedTo,
        residueInsCodes: selectedResidueInsCodesAlignedTo,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo,
        zoomExtraRadius: zoomExtraRadiusA,
        zoomMinRadius: zoomMinRadiusA,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const residueZoomAAligned = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        property: 'residue-test',
        chainId: selectedChainIdAligned,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned,
        residueId: selectedResidueIdAligned,
        syncResidueId: selectedResidueIdAligned,
        insCode: residueInfoAligned.residueLabels.get(selectedResidueIdAligned)?.insCode,
        syncInsCode: residueInfoAligned.residueLabels.get(selectedResidueIdAligned)?.insCode,
        residueIds: selectedResidueIdsAligned,
        syncResidueIds: selectedResidueIdsAligned,
        residueInsCodes: selectedResidueInsCodesAligned,
        syncResidueInsCodes: selectedResidueInsCodesAligned,
        zoomExtraRadius: zoomExtraRadiusA,
        zoomMinRadius: zoomMinRadiusA,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const residueZoomBAlignedTo = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        property: 'residue-test',
        chainId: selectedChainIdAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
        residueId: selectedResidueIdAlignedTo,
        syncResidueId: selectedResidueIdAlignedTo,
        insCode: residueInfoAlignedTo.residueLabels.get(selectedResidueIdAlignedTo)?.insCode,
        syncInsCode: residueInfoAlignedTo.residueLabels.get(selectedResidueIdAlignedTo)?.insCode,
        residueIds: selectedResidueIdsAlignedTo,
        syncResidueIds: selectedResidueIdsAlignedTo,
        residueInsCodes: selectedResidueInsCodesAlignedTo,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo,
        zoomExtraRadius: zoomExtraRadiusB,
        zoomMinRadius: zoomMinRadiusB,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });
    const residueZoomBAligned = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        property: 'residue-test',
        chainId: selectedChainIdAligned,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned,
        residueId: selectedResidueIdAligned,
        syncResidueId: selectedResidueIdAligned,
        insCode: residueInfoAligned.residueLabels.get(selectedResidueIdAligned)?.insCode,
        syncInsCode: residueInfoAligned.residueLabels.get(selectedResidueIdAligned)?.insCode,
        residueIds: selectedResidueIdsAligned,
        syncResidueIds: selectedResidueIdsAligned,
        residueInsCodes: selectedResidueInsCodesAligned,
        syncResidueInsCodes: selectedResidueInsCodesAligned,
        zoomExtraRadius: zoomExtraRadiusB,
        zoomMinRadius: zoomMinRadiusB,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });
    const selectedResidueInsCodesAlignedTo2 = useMemo(
        () => Object.fromEntries(
            selectedResidueIdsAlignedTo2.map((id) => [id, residueInfoAlignedTo2.residueLabels.get(id)?.insCode])
        ) as Record<string, string | undefined>,
        [selectedResidueIdsAlignedTo2, residueInfoAlignedTo2]
    );
    const selectedResidueInsCodesAligned2 = useMemo(
        () => Object.fromEntries(
            selectedResidueIdsAligned2.map((id) => [id, residueInfoAligned2.residueLabels.get(id)?.insCode])
        ) as Record<string, string | undefined>,
        [selectedResidueIdsAligned2, residueInfoAligned2]
    );
    const residueZoomAAlignedTo2 = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        property: 'residue-test',
        chainId: selectedChainIdAlignedTo2,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo2,
        residueId: selectedResidueIdAlignedTo2,
        syncResidueId: selectedResidueIdAlignedTo2,
        insCode: residueInfoAlignedTo2.residueLabels.get(selectedResidueIdAlignedTo2)?.insCode,
        syncInsCode: residueInfoAlignedTo2.residueLabels.get(selectedResidueIdAlignedTo2)?.insCode,
        residueIds: selectedResidueIdsAlignedTo2,
        syncResidueIds: selectedResidueIdsAlignedTo2,
        residueInsCodes: selectedResidueInsCodesAlignedTo2,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo2,
        zoomExtraRadius: zoomExtraRadiusA,
        zoomMinRadius: zoomMinRadiusA,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const residueZoomAAligned2 = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        property: 'residue-test',
        chainId: selectedChainIdAligned2,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned2,
        residueId: selectedResidueIdAligned2,
        syncResidueId: selectedResidueIdAligned2,
        insCode: residueInfoAligned2.residueLabels.get(selectedResidueIdAligned2)?.insCode,
        syncInsCode: residueInfoAligned2.residueLabels.get(selectedResidueIdAligned2)?.insCode,
        residueIds: selectedResidueIdsAligned2,
        syncResidueIds: selectedResidueIdsAligned2,
        residueInsCodes: selectedResidueInsCodesAligned2,
        syncResidueInsCodes: selectedResidueInsCodesAligned2,
        zoomExtraRadius: zoomExtraRadiusA,
        zoomMinRadius: zoomMinRadiusA,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const residueZoomBAlignedTo2 = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        property: 'residue-test',
        chainId: selectedChainIdAlignedTo2,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo2,
        residueId: selectedResidueIdAlignedTo2,
        syncResidueId: selectedResidueIdAlignedTo2,
        insCode: residueInfoAlignedTo2.residueLabels.get(selectedResidueIdAlignedTo2)?.insCode,
        syncInsCode: residueInfoAlignedTo2.residueLabels.get(selectedResidueIdAlignedTo2)?.insCode,
        residueIds: selectedResidueIdsAlignedTo2,
        syncResidueIds: selectedResidueIdsAlignedTo2,
        residueInsCodes: selectedResidueInsCodesAlignedTo2,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo2,
        zoomExtraRadius: zoomExtraRadiusB,
        zoomMinRadius: zoomMinRadiusB,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });
    const residueZoomBAligned2 = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        property: 'residue-test',
        chainId: selectedChainIdAligned2,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned2,
        residueId: selectedResidueIdAligned2,
        syncResidueId: selectedResidueIdAligned2,
        insCode: residueInfoAligned2.residueLabels.get(selectedResidueIdAligned2)?.insCode,
        syncInsCode: residueInfoAligned2.residueLabels.get(selectedResidueIdAligned2)?.insCode,
        residueIds: selectedResidueIdsAligned2,
        syncResidueIds: selectedResidueIdsAligned2,
        residueInsCodes: selectedResidueInsCodesAligned2,
        syncResidueInsCodes: selectedResidueInsCodesAligned2,
        zoomExtraRadius: zoomExtraRadiusB,
        zoomMinRadius: zoomMinRadiusB,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });

    const residueHighlightAAlignedTo = makeResidueHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainId: selectedChainIdAlignedTo,
        residueIds: selectedResidueIdsAlignedTo,
        residueInsCodes: selectedResidueInsCodesAlignedTo,
        isHighlighted: residueHighlightOnAlignedTo,
        setIsHighlighted: setResidueHighlightOnAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
        syncResidueIds: selectedResidueIdsAlignedTo,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo,
    });
    const residueHighlightAAligned = makeResidueHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        chainId: selectedChainIdAligned,
        residueIds: selectedResidueIdsAligned,
        residueInsCodes: selectedResidueInsCodesAligned,
        isHighlighted: residueHighlightOnAligned,
        setIsHighlighted: setResidueHighlightOnAligned,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned,
        syncResidueIds: selectedResidueIdsAligned,
        syncResidueInsCodes: selectedResidueInsCodesAligned,
    });
    const residueHighlightBAlignedTo = makeResidueHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        chainId: selectedChainIdAlignedTo,
        residueIds: selectedResidueIdsAlignedTo,
        residueInsCodes: selectedResidueInsCodesAlignedTo,
        isHighlighted: residueHighlightOnAlignedTo,
        setIsHighlighted: setResidueHighlightOnAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
        syncResidueIds: selectedResidueIdsAlignedTo,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo,
    });
    const residueHighlightBAligned = makeResidueHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        chainId: selectedChainIdAligned,
        residueIds: selectedResidueIdsAligned,
        residueInsCodes: selectedResidueInsCodesAligned,
        isHighlighted: residueHighlightOnAligned,
        setIsHighlighted: setResidueHighlightOnAligned,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned,
        syncResidueIds: selectedResidueIdsAligned,
        syncResidueInsCodes: selectedResidueInsCodesAligned,
    });
    const residueHighlightAAlignedTo2 = makeResidueHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainId: selectedChainIdAlignedTo2,
        residueIds: selectedResidueIdsAlignedTo2,
        residueInsCodes: selectedResidueInsCodesAlignedTo2,
        isHighlighted: residueHighlightOnAlignedTo,
        setIsHighlighted: setResidueHighlightOnAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo2,
        syncResidueIds: selectedResidueIdsAlignedTo2,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo2,
    });
    const residueHighlightAAligned2 = makeResidueHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        chainId: selectedChainIdAligned2,
        residueIds: selectedResidueIdsAligned2,
        residueInsCodes: selectedResidueInsCodesAligned2,
        isHighlighted: residueHighlightOnAligned,
        setIsHighlighted: setResidueHighlightOnAligned,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned2,
        syncResidueIds: selectedResidueIdsAligned2,
        syncResidueInsCodes: selectedResidueInsCodesAligned2,
    });
    const residueHighlightBAlignedTo2 = makeResidueHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        chainId: selectedChainIdAlignedTo2,
        residueIds: selectedResidueIdsAlignedTo2,
        residueInsCodes: selectedResidueInsCodesAlignedTo2,
        isHighlighted: residueHighlightOnAlignedTo,
        setIsHighlighted: setResidueHighlightOnAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo2,
        syncResidueIds: selectedResidueIdsAlignedTo2,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo2,
    });
    const residueHighlightBAligned2 = makeResidueHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        chainId: selectedChainIdAligned2,
        residueIds: selectedResidueIdsAligned2,
        residueInsCodes: selectedResidueInsCodesAligned2,
        isHighlighted: residueHighlightOnAligned,
        setIsHighlighted: setResidueHighlightOnAligned,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned2,
        syncResidueIds: selectedResidueIdsAligned2,
        syncResidueInsCodes: selectedResidueInsCodesAligned2,
    });

    const residueInspectAAlignedTo = makeResidueInspectToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainId: selectedChainIdAlignedTo,
        residueIds: selectedResidueIdsAlignedTo,
        residueInsCodes: selectedResidueInsCodesAlignedTo,
        isInspecting: residueInspectOnAAlignedTo,
        setIsInspecting: setResidueInspectOnAAlignedTo,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerBAlignedToVisible,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
        syncResidueIds: selectedResidueIdsAlignedTo,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo,
    });
    const residueInspectAAligned = makeResidueInspectToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        chainId: selectedChainIdAligned,
        residueIds: selectedResidueIdsAligned,
        residueInsCodes: selectedResidueInsCodesAligned,
        isInspecting: residueInspectOnAAligned,
        setIsInspecting: setResidueInspectOnAAligned,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerBAlignedVisible,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned,
        syncResidueIds: selectedResidueIdsAligned,
        syncResidueInsCodes: selectedResidueInsCodesAligned,
    });
    const residueInspectBAlignedTo = makeResidueInspectToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        chainId: selectedChainIdAlignedTo,
        residueIds: selectedResidueIdsAlignedTo,
        residueInsCodes: selectedResidueInsCodesAlignedTo,
        isInspecting: residueInspectOnBAlignedTo,
        setIsInspecting: setResidueInspectOnBAlignedTo,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerAAlignedToVisible,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
        syncResidueIds: selectedResidueIdsAlignedTo,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo,
    });
    const residueInspectBAligned = makeResidueInspectToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        chainId: selectedChainIdAligned,
        residueIds: selectedResidueIdsAligned,
        residueInsCodes: selectedResidueInsCodesAligned,
        isInspecting: residueInspectOnBAligned,
        setIsInspecting: setResidueInspectOnBAligned,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerAAlignedVisible,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned,
        syncResidueIds: selectedResidueIdsAligned,
        syncResidueInsCodes: selectedResidueInsCodesAligned,
    });
    const residueInspectAAlignedTo2 = makeResidueInspectToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainId: selectedChainIdAlignedTo2,
        residueIds: selectedResidueIdsAlignedTo2,
        residueInsCodes: selectedResidueInsCodesAlignedTo2,
        isInspecting: residueInspectOnAAlignedTo,
        setIsInspecting: setResidueInspectOnAAlignedTo,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerBAlignedToVisible,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo2,
        syncResidueIds: selectedResidueIdsAlignedTo2,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo2,
    });
    const residueInspectAAligned2 = makeResidueInspectToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        chainId: selectedChainIdAligned2,
        residueIds: selectedResidueIdsAligned2,
        residueInsCodes: selectedResidueInsCodesAligned2,
        isInspecting: residueInspectOnAAligned,
        setIsInspecting: setResidueInspectOnAAligned,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerBAlignedVisible,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned2,
        syncResidueIds: selectedResidueIdsAligned2,
        syncResidueInsCodes: selectedResidueInsCodesAligned2,
    });
    const residueInspectBAlignedTo2 = makeResidueInspectToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        chainId: selectedChainIdAlignedTo2,
        residueIds: selectedResidueIdsAlignedTo2,
        residueInsCodes: selectedResidueInsCodesAlignedTo2,
        isInspecting: residueInspectOnBAlignedTo,
        setIsInspecting: setResidueInspectOnBAlignedTo,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerAAlignedToVisible,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo2,
        syncResidueIds: selectedResidueIdsAlignedTo2,
        syncResidueInsCodes: selectedResidueInsCodesAlignedTo2,
    });
    const residueInspectBAligned2 = makeResidueInspectToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        chainId: selectedChainIdAligned2,
        residueIds: selectedResidueIdsAligned2,
        residueInsCodes: selectedResidueInsCodesAligned2,
        isInspecting: residueInspectOnBAligned,
        setIsInspecting: setResidueInspectOnBAligned,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerAAlignedVisible,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned2,
        syncResidueIds: selectedResidueIdsAligned2,
        syncResidueInsCodes: selectedResidueInsCodesAligned2,
    });

    const makeCombinedToggleHandler = (
        primary: { handleButtonClick: () => void },
        secondary: { handleButtonClick: () => void },
        hasSecondarySelection: boolean,
    ) => ({
        handleButtonClick: () => {
            primary.handleButtonClick();
            if (hasSecondarySelection) secondary.handleButtonClick();
        },
    });

    const combinedSelectionHighlightAAlignedTo = makeCombinedToggleHandler(
        residueHighlightAAlignedTo,
        residueHighlightAAlignedTo2,
        selectedResidueIdsAlignedTo2.length > 0,
    );
    const combinedSelectionHighlightAAligned = makeCombinedToggleHandler(
        residueHighlightAAligned,
        residueHighlightAAligned2,
        selectedResidueIdsAligned2.length > 0,
    );
    const combinedSelectionHighlightBAlignedTo = makeCombinedToggleHandler(
        residueHighlightBAlignedTo,
        residueHighlightBAlignedTo2,
        selectedResidueIdsAlignedTo2.length > 0,
    );
    const combinedSelectionHighlightBAligned = makeCombinedToggleHandler(
        residueHighlightBAligned,
        residueHighlightBAligned2,
        selectedResidueIdsAligned2.length > 0,
    );

    const combinedSelectionInspectAAlignedTo = makeCombinedToggleHandler(
        residueInspectAAlignedTo,
        residueInspectAAlignedTo2,
        selectedResidueIdsAlignedTo2.length > 0,
    );
    const combinedSelectionInspectAAligned = makeCombinedToggleHandler(
        residueInspectAAligned,
        residueInspectAAligned2,
        selectedResidueIdsAligned2.length > 0,
    );
    const combinedSelectionInspectBAlignedTo = makeCombinedToggleHandler(
        residueInspectBAlignedTo,
        residueInspectBAlignedTo2,
        selectedResidueIdsAlignedTo2.length > 0,
    );
    const combinedSelectionInspectBAligned = makeCombinedToggleHandler(
        residueInspectBAligned,
        residueInspectBAligned2,
        selectedResidueIdsAligned2.length > 0,
    );

    const selectedSubunitChainIdsAlignedTo = useMemo(
        () => getSelectedSubunitChainIds(subunitToChainIdsAlignedTo as unknown as Map<string, Set<string>>, selectedSubunitAlignedTo),
        [subunitToChainIdsAlignedTo, selectedSubunitAlignedTo]
    );
    const selectedSubunitChainIdsAligned = useMemo(
        () => getSelectedSubunitChainIds(subunitToChainIdsAligned as unknown as Map<string, Set<string>>, selectedSubunitAligned),
        [subunitToChainIdsAligned, selectedSubunitAligned]
    );

    const subunitZoomAAlignedTo = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        property: 'subunit-test',
        chainId: selectedChainIdAlignedTo,
        chainIds: selectedSubunitChainIdsAlignedTo,
        syncChainIds: selectedSubunitChainIdsAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        zoomExtraRadius: zoomExtraRadiusA,
        zoomMinRadius: zoomMinRadiusA,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const subunitZoomAAligned = makeZoomHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        property: 'subunit-test',
        chainId: selectedChainIdAligned,
        chainIds: selectedSubunitChainIdsAligned,
        syncChainIds: selectedSubunitChainIdsAligned,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        zoomExtraRadius: zoomExtraRadiusA,
        zoomMinRadius: zoomMinRadiusA,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(A, syncEnabled),
    });
    const subunitZoomBAlignedTo = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        property: 'subunit-test',
        chainId: selectedChainIdAlignedTo,
        chainIds: selectedSubunitChainIdsAlignedTo,
        syncChainIds: selectedSubunitChainIdsAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        zoomExtraRadius: zoomExtraRadiusB,
        zoomMinRadius: zoomMinRadiusB,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });
    const subunitZoomBAligned = makeZoomHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        property: 'subunit-test',
        chainId: selectedChainIdAligned,
        chainIds: selectedSubunitChainIdsAligned,
        syncChainIds: selectedSubunitChainIdsAligned,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        zoomExtraRadius: zoomExtraRadiusB,
        zoomMinRadius: zoomMinRadiusB,
        onAfterZoom: () => syncClippingFromMolstarAfterZoom(B, syncEnabled),
    });

    const subunitHighlightAAlignedTo = makeSubunitHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainIds: selectedSubunitChainIdsAlignedTo,
        isHighlighted: subunitHighlightOnAlignedTo,
        setIsHighlighted: setSubunitHighlightOnAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainIds: selectedSubunitChainIdsAlignedTo,
    });
    const subunitHighlightAAligned = makeSubunitHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        chainIds: selectedSubunitChainIdsAligned,
        isHighlighted: subunitHighlightOnAligned,
        setIsHighlighted: setSubunitHighlightOnAligned,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainIds: selectedSubunitChainIdsAligned,
    });
    const subunitHighlightBAlignedTo = makeSubunitHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        chainIds: selectedSubunitChainIdsAlignedTo,
        isHighlighted: subunitHighlightOnAlignedTo,
        setIsHighlighted: setSubunitHighlightOnAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainIds: selectedSubunitChainIdsAlignedTo,
    });
    const subunitHighlightBAligned = makeSubunitHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        chainIds: selectedSubunitChainIdsAligned,
        isHighlighted: subunitHighlightOnAligned,
        setIsHighlighted: setSubunitHighlightOnAligned,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainIds: selectedSubunitChainIdsAligned,
    });

    useEffect(() => {
        type HighlightDatasetConfig = {
            structureRef: string | null;
            modeKey: ColorThemeMode;
            chainId: string;
            residueIds: string[];
            residueInsCodes?: Record<string, string | undefined>;
            subunitChainIds: string[];
            chainOn: boolean;
            residueOn: boolean;
            subunitOn: boolean;
            displaySettings: SelectionDisplaySettings;
        };

        const applyHighlightsForPlugin = (
            plugin: PluginUIContext | null,
            datasetConfigs: HighlightDatasetConfig[]
        ) => {
            if (!plugin) return;

            plugin.managers.interactivity?.lociSelects?.deselectAll?.();
            for (const config of datasetConfigs) {
                if (!config.structureRef) continue;
                clearStructureHighlightOverpaint(plugin, config.structureRef);
            }

            for (const config of datasetConfigs) {
                if (!config.structureRef) continue;

                const uniqueSubunitChainIds = Array.from(new Set(config.subunitChainIds.filter(Boolean)));
                const hasSelection = hasSelectionForDisplayDim({
                    chainId: config.chainId,
                    residueIds: config.residueIds,
                    subunitChainIds: config.subunitChainIds,
                });

                // Dimming is tied to selected loci, not to whether highlight toggles are currently enabled.
                if (config.displaySettings.dimUnselected && hasSelection) {
                    applyStructureDimOverlay(plugin, config.structureRef, config.displaySettings.dimStrength);
                }

                if (config.subunitOn && uniqueSubunitChainIds.length > 0) {
                    highlightLociOnSubunit(plugin, config.structureRef, uniqueSubunitChainIds, config.displaySettings.mode);
                }

                if (config.chainOn && config.chainId) {
                    highlightLociOnChain(plugin, config.structureRef, config.chainId, config.displaySettings.mode);
                }

                if (config.residueOn && config.chainId && config.residueIds.length > 0) {
                    highlightLociOnResidues(
                        plugin,
                        config.structureRef,
                        config.chainId,
                        config.residueIds,
                        config.residueInsCodes,
                        config.displaySettings.mode
                    );
                }
            }
        };

        const datasetConfigs: HighlightDatasetConfig[] = [
            {
                structureRef: structureRefAAlignedTo,
                modeKey: 'AlignedTo',
                chainId: selectedChainIdAlignedTo,
                residueIds: selectedResidueIdsAlignedTo,
                residueInsCodes: selectedResidueInsCodesAlignedTo,
                subunitChainIds: selectedSubunitChainIdsAlignedTo,
                chainOn: chainHighlightOnAlignedTo,
                residueOn: residueHighlightOnAlignedTo,
                subunitOn: subunitHighlightOnAlignedTo,
                displaySettings: selectionDisplayByMode.AlignedTo,
            },
            {
                structureRef: structureRefAAlignedTo,
                modeKey: 'AlignedTo',
                chainId: selectedChainIdAlignedTo2,
                residueIds: selectedResidueIdsAlignedTo2,
                residueInsCodes: selectedResidueInsCodesAlignedTo2,
                subunitChainIds: selectedSubunitChainIdsAlignedTo,
                chainOn: false,
                residueOn: residueHighlightOnAlignedTo,
                subunitOn: false,
                displaySettings: selectionDisplayByMode.AlignedTo,
            },
            {
                structureRef: structureRefAAligned,
                modeKey: 'Aligned',
                chainId: selectedChainIdAligned,
                residueIds: selectedResidueIdsAligned,
                residueInsCodes: selectedResidueInsCodesAligned,
                subunitChainIds: selectedSubunitChainIdsAligned,
                chainOn: chainHighlightOnAligned,
                residueOn: residueHighlightOnAligned,
                subunitOn: subunitHighlightOnAligned,
                displaySettings: selectionDisplayByMode.Aligned,
            },
            {
                structureRef: structureRefAAligned,
                modeKey: 'Aligned',
                chainId: selectedChainIdAligned2,
                residueIds: selectedResidueIdsAligned2,
                residueInsCodes: selectedResidueInsCodesAligned2,
                subunitChainIds: selectedSubunitChainIdsAligned,
                chainOn: false,
                residueOn: residueHighlightOnAligned,
                subunitOn: false,
                displaySettings: selectionDisplayByMode.Aligned,
            },
        ];

        applyHighlightsForPlugin(viewerA.ref.current, datasetConfigs);
        applyHighlightsForPlugin(
            viewerB.ref.current,
            datasetConfigs.map((config) => ({
                ...config,
                structureRef: config.modeKey === 'AlignedTo' ? structureRefBAlignedTo : structureRefBAligned,
            }))
        );
    }, [
        chainHighlightOnAlignedTo,
        chainHighlightOnAligned,
        residueHighlightOnAlignedTo,
        residueHighlightOnAligned,
        subunitHighlightOnAlignedTo,
        subunitHighlightOnAligned,
        selectionDisplayByMode,
        selectedChainIdAlignedTo,
        selectedChainIdAlignedTo2,
        selectedChainIdAligned,
        selectedChainIdAligned2,
        selectedResidueIdsAlignedTo,
        selectedResidueIdsAlignedTo2,
        selectedResidueIdsAligned,
        selectedResidueIdsAligned2,
        selectedResidueInsCodesAlignedTo,
        selectedResidueInsCodesAlignedTo2,
        selectedResidueInsCodesAligned,
        selectedResidueInsCodesAligned2,
        selectedSubunitChainIdsAlignedTo,
        selectedSubunitChainIdsAligned,
        structureRefAAlignedTo,
        structureRefAAligned,
        structureRefBAlignedTo,
        structureRefBAligned,
        viewerA.ref,
        viewerB.ref,
    ]);

    const subunitInspectAAlignedTo = makeSubunitInspectToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainIds: selectedSubunitChainIdsAlignedTo,
        isInspecting: subunitInspectOnAAlignedTo,
        setIsInspecting: setSubunitInspectOnAAlignedTo,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerBAlignedToVisible,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainIds: selectedSubunitChainIdsAlignedTo,
    });
    const subunitInspectAAligned = makeSubunitInspectToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        chainIds: selectedSubunitChainIdsAligned,
        isInspecting: subunitInspectOnAAligned,
        setIsInspecting: setSubunitInspectOnAAligned,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerBAlignedVisible,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainIds: selectedSubunitChainIdsAligned,
    });
    const subunitInspectBAlignedTo = makeSubunitInspectToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        chainIds: selectedSubunitChainIdsAlignedTo,
        isInspecting: subunitInspectOnBAlignedTo,
        setIsInspecting: setSubunitInspectOnBAlignedTo,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerAAlignedToVisible,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainIds: selectedSubunitChainIdsAlignedTo,
    });
    const subunitInspectBAligned = makeSubunitInspectToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        chainIds: selectedSubunitChainIdsAligned,
        isInspecting: subunitInspectOnBAligned,
        setIsInspecting: setSubunitInspectOnBAligned,
        sync: true,
        shouldSync: () => inspectSyncVisibilityRef.current.viewerAAlignedVisible,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainIds: selectedSubunitChainIdsAligned,
    });

    useEffect(() => {
        type InspectDatasetConfig = {
            structureRef: string | null;
            isVisible: boolean;
            chainId: string;
            residueIds: string[];
            residueInsCodes?: Record<string, string | undefined>;
            subunitChainIds: string[];
            chainOn: boolean;
            residueOn: boolean;
            subunitOn: boolean;
        };

        const applyInspectForPlugin = (
            plugin: PluginUIContext | null,
            datasetConfigs: InspectDatasetConfig[]
        ) => {
            if (!plugin) return;
            plugin.managers.structure?.focus?.clear?.();

            for (const config of datasetConfigs) {
                if (!config.structureRef || !config.isVisible) continue;

                const uniqueSubunitChainIds = Array.from(new Set(config.subunitChainIds.filter(Boolean)));
                if (config.subunitOn && uniqueSubunitChainIds.length > 0) {
                    inspectLociOnSubunit(plugin, config.structureRef, uniqueSubunitChainIds);
                }

                if (config.chainOn && config.chainId) {
                    inspectLociOnChain(plugin, config.structureRef, config.chainId);
                }

                if (config.residueOn && config.chainId && config.residueIds.length > 0) {
                    inspectLociOnResidues(
                        plugin,
                        config.structureRef,
                        config.chainId,
                        config.residueIds,
                        config.residueInsCodes
                    );
                }
            }
        };

        applyInspectForPlugin(viewerA.ref.current, [
            {
                structureRef: structureRefAAlignedTo,
                isVisible: viewerA.isMoleculeAlignedToVisible,
                chainId: selectedChainIdAlignedTo,
                residueIds: selectedResidueIdsAlignedTo,
                residueInsCodes: selectedResidueInsCodesAlignedTo,
                subunitChainIds: selectedSubunitChainIdsAlignedTo,
                chainOn: chainInspectOnAAlignedTo,
                residueOn: residueInspectOnAAlignedTo,
                subunitOn: subunitInspectOnAAlignedTo,
            },
            {
                structureRef: structureRefAAligned,
                isVisible: viewerA.isMoleculeAlignedVisible,
                chainId: selectedChainIdAligned,
                residueIds: selectedResidueIdsAligned,
                residueInsCodes: selectedResidueInsCodesAligned,
                subunitChainIds: selectedSubunitChainIdsAligned,
                chainOn: chainInspectOnAAligned,
                residueOn: residueInspectOnAAligned,
                subunitOn: subunitInspectOnAAligned,
            },
        ]);

        applyInspectForPlugin(viewerB.ref.current, [
            {
                structureRef: structureRefBAlignedTo,
                isVisible: viewerB.isMoleculeAlignedToVisible,
                chainId: selectedChainIdAlignedTo,
                residueIds: selectedResidueIdsAlignedTo,
                residueInsCodes: selectedResidueInsCodesAlignedTo,
                subunitChainIds: selectedSubunitChainIdsAlignedTo,
                chainOn: chainInspectOnBAlignedTo,
                residueOn: residueInspectOnBAlignedTo,
                subunitOn: subunitInspectOnBAlignedTo,
            },
            {
                structureRef: structureRefBAligned,
                isVisible: viewerB.isMoleculeAlignedVisible,
                chainId: selectedChainIdAligned,
                residueIds: selectedResidueIdsAligned,
                residueInsCodes: selectedResidueInsCodesAligned,
                subunitChainIds: selectedSubunitChainIdsAligned,
                chainOn: chainInspectOnBAligned,
                residueOn: residueInspectOnBAligned,
                subunitOn: subunitInspectOnBAligned,
            },
        ]);
    }, [
        chainInspectOnAAlignedTo,
        chainInspectOnAAligned,
        chainInspectOnBAlignedTo,
        chainInspectOnBAligned,
        residueInspectOnAAlignedTo,
        residueInspectOnAAligned,
        residueInspectOnBAlignedTo,
        residueInspectOnBAligned,
        subunitInspectOnAAlignedTo,
        subunitInspectOnAAligned,
        subunitInspectOnBAlignedTo,
        subunitInspectOnBAligned,
        selectedChainIdAlignedTo,
        selectedChainIdAligned,
        selectedResidueIdsAlignedTo,
        selectedResidueIdsAligned,
        selectedResidueInsCodesAlignedTo,
        selectedResidueInsCodesAligned,
        selectedSubunitChainIdsAlignedTo,
        selectedSubunitChainIdsAligned,
        structureRefAAlignedTo,
        structureRefAAligned,
        structureRefBAlignedTo,
        structureRefBAligned,
        viewerA.isMoleculeAlignedToVisible,
        viewerA.isMoleculeAlignedVisible,
        viewerB.isMoleculeAlignedToVisible,
        viewerB.isMoleculeAlignedVisible,
        viewerA.ref,
        viewerB.ref,
    ]);

    useEffect(() => {
        const pending = pendingSessionSelectionsRef.current;
        if (!pending) return;

        let alignedToDone = true;
        let alignedDone = true;

        if (pending.alignedTo?.chainId) {
            if (chainInfoAlignedTo.chainLabels.has(pending.alignedTo.chainId)) {
                setSelectedChainIdAlignedTo(pending.alignedTo.chainId);
            } else {
                alignedToDone = false;
            }
        }
        if (pending.alignedTo?.chainId2) {
            if (chainInfoAlignedTo.chainLabels.has(pending.alignedTo.chainId2)) {
                setSelectedChainIdAlignedTo2(pending.alignedTo.chainId2);
            } else {
                alignedToDone = false;
            }
        }

        if (pending.aligned?.chainId) {
            if (chainInfoAligned.chainLabels.has(pending.aligned.chainId)) {
                setSelectedChainIdAligned(pending.aligned.chainId);
            } else {
                alignedDone = false;
            }
        }
        if (pending.aligned?.chainId2) {
            if (chainInfoAligned.chainLabels.has(pending.aligned.chainId2)) {
                setSelectedChainIdAligned2(pending.aligned.chainId2);
            } else {
                alignedDone = false;
            }
        }

        const pendingAlignedToResidueIds = Array.isArray(pending.alignedTo?.residueIds)
            ? pending.alignedTo!.residueIds!.filter(id => residueInfoAlignedTo.residueLabels.has(id))
            : [];
        if (pendingAlignedToResidueIds.length > 0) {
            setSelectedResidueIdsAlignedTo(pendingAlignedToResidueIds);
        } else if (pending.alignedTo?.residueId && residueInfoAlignedTo.residueLabels.size > 0) {
            if (residueInfoAlignedTo.residueLabels.has(pending.alignedTo.residueId)) {
                setSelectedResidueIdAlignedTo(pending.alignedTo.residueId);
            }
        }

        const pendingAlignedToResidueIds2 = Array.isArray(pending.alignedTo?.residueIds2)
            ? pending.alignedTo!.residueIds2!.filter(id => residueInfoAlignedTo2.residueLabels.has(id))
            : [];
        if (pendingAlignedToResidueIds2.length > 0) {
            setSelectedResidueIdsAlignedTo2(pendingAlignedToResidueIds2);
        } else if (pending.alignedTo?.residueId2 && residueInfoAlignedTo2.residueLabels.size > 0) {
            if (residueInfoAlignedTo2.residueLabels.has(pending.alignedTo.residueId2)) {
                setSelectedResidueIdsAlignedTo2([pending.alignedTo.residueId2]);
            }
        }

        const pendingAlignedResidueIds = Array.isArray(pending.aligned?.residueIds)
            ? pending.aligned!.residueIds!.filter(id => residueInfoAligned.residueLabels.has(id))
            : [];
        if (pendingAlignedResidueIds.length > 0) {
            setSelectedResidueIdsAligned(pendingAlignedResidueIds);
        } else if (pending.aligned?.residueId && residueInfoAligned.residueLabels.size > 0) {
            if (residueInfoAligned.residueLabels.has(pending.aligned.residueId)) {
                setSelectedResidueIdAligned(pending.aligned.residueId);
            }
        }

        const pendingAlignedResidueIds2 = Array.isArray(pending.aligned?.residueIds2)
            ? pending.aligned!.residueIds2!.filter(id => residueInfoAligned2.residueLabels.has(id))
            : [];
        if (pendingAlignedResidueIds2.length > 0) {
            setSelectedResidueIdsAligned2(pendingAlignedResidueIds2);
        } else if (pending.aligned?.residueId2 && residueInfoAligned2.residueLabels.size > 0) {
            if (residueInfoAligned2.residueLabels.has(pending.aligned.residueId2)) {
                setSelectedResidueIdsAligned2([pending.aligned.residueId2]);
            }
        }

        if (alignedToDone && alignedDone) {
            pendingSessionSelectionsRef.current = null;
        }
    }, [
        chainInfoAlignedTo.chainLabels,
        chainInfoAligned.chainLabels,
        residueInfoAlignedTo.residueLabels,
        residueInfoAligned.residueLabels,
        setSelectedChainIdAlignedTo,
        setSelectedChainIdAlignedTo2,
        setSelectedChainIdAligned,
        setSelectedChainIdAligned2,
        setSelectedResidueIdsAlignedTo,
        setSelectedResidueIdsAlignedTo2,
        setSelectedResidueIdsAligned,
        setSelectedResidueIdsAligned2,
        setSelectedResidueIdAlignedTo,
        setSelectedResidueIdAligned,
        residueInfoAlignedTo2.residueLabels,
        residueInfoAligned2.residueLabels,
    ]);

    // Unified robust delete handler for any representation
    const deleteRepresentation = async (ref: string, key: string, molstar: any, doForceUpdate = true) => {
        // Try to find repId for this ref
        let repId = Object.entries(molstar.repIdMap[key]).find(([id, r]) => r === ref)?.[0];
        let repRef = repId ? molstar.repIdMap[key][repId] : ref;
        // Fallback to array index if not found in repIdMap
        if (!repRef) {
            const idx = molstar.representationRefs[key].indexOf(ref);
            if (idx >= 0) repRef = molstar.representationRefs[key][idx];
        }
        if (!repRef) return;
        const plugin = molstar.pluginRef.current;
        if (!plugin) return;
        await import('molstar/lib/mol-plugin/commands').then(async ({ PluginCommands }) => {
            await PluginCommands.State.RemoveObject.apply(plugin, [plugin, { state: plugin.state.data, ref: repRef }]);
            // Remove parent component if empty
            const state = plugin.state.data;
            const repCell = state.cells.get(repRef);
            const parentRef = repCell?.transform.parent;
            if (parentRef) {
                const isComponent = state.cells.get(parentRef)?.obj?.type?.name === 'Structure Component';
                const children = state.tree.children.get(parentRef)?.toArray?.() || [];
                let rep3dCount = 0;
                for (const childRef of children) {
                    const c = state.cells.get(childRef);
                    if (c?.obj?.type?.name === 'Representation3D') rep3dCount++;
                }
                if (isComponent && rep3dCount === 0) {
                    await PluginCommands.State.RemoveObject.apply(plugin, [plugin, { state: plugin.state.data, ref: parentRef }]);
                }
            }
            // Remove from repIdMap if present
            if (repId && molstar.repIdMap[key][repId]) {
                const newMap = { ...molstar.repIdMap[key] };
                delete newMap[repId];
                molstar.setRepIdMap(key, newMap);
            }
            plugin.canvas3d?.requestDraw?.();
            if (molstar.structureRefs[AlignedTo]) {
                molstar.refreshRepresentationRefs(AlignedTo, molstar.structureRefs[AlignedTo]!);
            }
            if (molstar.structureRefs[Aligned]) {
                molstar.refreshRepresentationRefs(Aligned, molstar.structureRefs[Aligned]!);
            }
            if (doForceUpdate) forceUpdate();
        });
    };

    // Check if a re-alignment for the selected pair already exists
    const realignmentExists = realignedMoleculesA.some(mol => mol.from === selectedChainIdAlignedTo && mol.to === selectedChainIdAligned);
    const canRealignToSubunits = selectedSubunitAlignedTo !== 'All'
        && selectedSubunitAligned !== 'All'
        && selectedSubunitChainIdsAlignedTo.length > 0
        && selectedSubunitChainIdsAligned.length > 0;
    const subunitFromKey = `subunit:${selectedSubunitAlignedTo}`;
    const subunitToKey = `subunit:${selectedSubunitAligned}`;
    const subunitRealignmentExists = canRealignToSubunits
        && realignedMoleculesA.some(mol => mol.from === subunitFromKey && mol.to === subunitToKey);

    const hasResiduesSlot1 = !!selectedChainIdAlignedTo
        && !!selectedChainIdAligned
        && selectedResidueIdsAlignedTo.length > 0
        && selectedResidueIdsAligned.length > 0;
    const hasResiduesSlot2 = !!selectedChainIdAlignedTo2
        && !!selectedChainIdAligned2
        && selectedResidueIdsAlignedTo2.length > 0
        && selectedResidueIdsAligned2.length > 0;
    const canRealignToResidues = hasResiduesSlot1 || hasResiduesSlot2;

    const chainRealignSummary = useMemo(() => {
        if (!selectedChainIdAlignedTo || !selectedChainIdAligned) return '';
        const leftChains = [selectedChainIdAlignedTo, selectedChainIdAlignedTo2].filter((id): id is string => !!id);
        const rightChains = [selectedChainIdAligned, selectedChainIdAligned2].filter((id): id is string => !!id);
        return `${leftChains.join(', ')} -> ${rightChains.join(', ')}`;
    }, [selectedChainIdAlignedTo, selectedChainIdAlignedTo2, selectedChainIdAligned, selectedChainIdAligned2]);

    const residueSlotKey = (slot: 1 | 2) => {
        if (slot === 1) {
            return hasResiduesSlot1
                ? `${selectedChainIdAlignedTo}:${selectedResidueIdsAlignedTo.slice().sort().join(',')}|${selectedChainIdAligned}:${selectedResidueIdsAligned.slice().sort().join(',')}`
                : 'none';
        }
        return hasResiduesSlot2
            ? `${selectedChainIdAlignedTo2}:${selectedResidueIdsAlignedTo2.slice().sort().join(',')}|${selectedChainIdAligned2}:${selectedResidueIdsAligned2.slice().sort().join(',')}`
            : 'none';
    };

    const residueFromKey = `residue:${residueSlotKey(1)}::${residueSlotKey(2)}`;
    const residueToKey = residueFromKey;
    const residueRealignmentExists = canRealignToResidues
        && realignedMoleculesA.some(mol => mol.from === residueFromKey && mol.to === residueToKey);

    const applyStructureTransformInPlace = useCallback(async (
        plugin: PluginUIContext,
        structureRef: string,
        matrix: Mat4,
        tag: string
    ) => {
        const existing = plugin.state.data.selectQ(q =>
            q.byRef(structureRef).subtree().withTransformer(StateTransforms.Model.TransformStructureConformation)
        )[0];
        const params = {
            transform: {
                name: 'matrix' as const,
                params: { data: matrix, transpose: false }
            }
        };
        const tree = existing
            ? plugin.state.data.build().to(existing).update(params)
            : plugin.state.data.build().to(structureRef)
                .insert(StateTransforms.Model.TransformStructureConformation, params, { tags: tag });
        await plugin.runTask(plugin.state.data.updateTree(tree));
        plugin.canvas3d?.requestDraw?.();
    }, []);

    const realignTransformCacheRef = useRef<Record<string, Mat4>>({});
    const realignBaseTransformCacheRef = useRef<Record<string, Mat4>>({});
    const realignDiagnosticsCounterRef = useRef<Record<string, number>>({});
    const lastChainRealignMetricsRef = useRef<ChainRealignMetrics | null>(null);
    const lastResidueRealignMetricsRef = useRef<ResidueRealignMetrics | null>(null);
    const lastResidueRealignDebugRef = useRef<ResidueRealignDebugStatus>({ phase: 'idle', timestamp: Date.now() });

    useEffect(() => {
        realignTransformCacheRef.current = {};
        realignBaseTransformCacheRef.current = {};
        realignDiagnosticsCounterRef.current = {};
        lastChainRealignMetricsRef.current = null;
        lastResidueRealignMetricsRef.current = null;
        lastResidueRealignDebugRef.current = { phase: 'idle', timestamp: Date.now() };
        persistedStructureTransformsRef.current = {};
        persistedStructureTransformsByModeRef.current = { viewerA: {}, viewerB: {} };
        structureTransformCheckpointsRef.current = {};
    }, [structureRefAAligned, structureRefBAligned]);

    const getStructureCoordinateSystemMatrix = useCallback((
        plugin: PluginUIContext,
        structureRef: string
    ): Mat4 => {
        const structureEntry = plugin.managers.structure.hierarchy.current.structures.find(
            s => s.cell.transform.ref === structureRef
        );
        const coordinateSystem = structureEntry?.transform?.cell.obj?.data.coordinateSystem;
        if (coordinateSystem?.matrix) {
            return Mat4.copy(Mat4(), coordinateSystem.matrix);
        }
        return Mat4.identity();
    }, []);

    const applyComposedRealignTransform = useCallback(async (
        plugin: PluginUIContext,
        structureRef: string,
        deltaTransform: Mat4,
        tag: string,
        cacheKey: string,
        diagnostics?: {
            operation: 'chain' | 'subunit' | 'residue';
            from: string;
            to: string;
            movingFiniteAtomCount?: number;
            referenceFiniteAtomCount?: number;
            atomPairCount?: number;
            rmsd?: number;
        }
    ) => {
        const opKey = diagnostics
            ? `${diagnostics.operation}:${diagnostics.from}->${diagnostics.to}`
            : `unknown:${cacheKey}`;
        const structureCacheKey = `${cacheKey}:structure`;

        const previousApplied = realignTransformCacheRef.current[structureCacheKey]
            ? Mat4.copy(Mat4(), realignTransformCacheRef.current[structureCacheKey])
            : undefined;

        const current = getStructureCoordinateSystemMatrix(plugin, structureRef);
        if (!realignBaseTransformCacheRef.current[structureCacheKey]) {
            // Capture the original structure frame once per loaded structure.
            // Every re-align operation is then applied relative to this base to
            // avoid cross-operation transform stacking (e.g. chain -> residue).
            realignBaseTransformCacheRef.current[structureCacheKey] = Mat4.copy(Mat4(), current);
        }
        const base = realignBaseTransformCacheRef.current[structureCacheKey];
        const next = Mat4.mul(Mat4(), base, deltaTransform);
        realignTransformCacheRef.current[structureCacheKey] = Mat4.copy(Mat4(), next);
        const serializedNext = Array.from({ length: 16 }, (_v, i) => Number(next[i]));
        persistedStructureTransformsRef.current[structureRef] = serializedNext;
        const isViewerA = plugin === viewerA.ref.current;
        if (isViewerA) {
            persistedStructureTransformsByModeRef.current.viewerA.aligned = serializedNext;
        } else {
            persistedStructureTransformsByModeRef.current.viewerB.aligned = serializedNext;
        }

        if (ENABLE_REALIGN_DIAGNOSTICS) {
            const step = (realignDiagnosticsCounterRef.current[opKey] ?? 0) + 1;
            realignDiagnosticsCounterRef.current[opKey] = step;
            const source = previousApplied ? 'operation-baseline (previous-applied-available)' : 'operation-baseline';

            console.info('[Re-align Diagnostics]', {
                opKey,
                step,
                cacheKey,
                structureCacheKey,
                sourceCurrentTransform: source,
                structureRef,
                tag,
                fit: diagnostics
                    ? {
                        movingFiniteAtomCount: diagnostics.movingFiniteAtomCount,
                        referenceFiniteAtomCount: diagnostics.referenceFiniteAtomCount,
                        atomPairCount: diagnostics.atomPairCount,
                        rmsd: diagnostics.rmsd,
                    }
                    : undefined,
                delta: summarizeMatrix(deltaTransform),
                current: summarizeMatrix(current),
                base: summarizeMatrix(base),
                previousApplied: previousApplied ? summarizeMatrix(previousApplied) : null,
                next: summarizeMatrix(next),
            });
        }

        await applyStructureTransformInPlace(plugin, structureRef, next, tag);
    }, [applyStructureTransformInPlace, getStructureCoordinateSystemMatrix, viewerA.ref, viewerB.ref]);

    // Realign handler using selected chains
    const handleRealignToChains = () => {
        if (realignmentExists) return;
        const pluginA = viewerA.ref.current;
        if (!pluginA) {
            console.warn('Viewer A not initialized.');
            return;
        }
        // Step 1: Extract atom data for selected chains in both structures
        if (!structureRefAAlignedTo || !selectedChainIdAlignedTo) {
            console.warn('Viewer A, structure, or chain not selected.');
            return;
        }
        // Get objects
        const structureAlignedTo = pluginA.managers.structure.hierarchy.current.structures.find(
            s => s.cell.transform.ref === structureRefAAlignedTo
        )?.cell.obj?.data;
        if (ENABLE_REALIGN_DIAGNOSTICS) console.info('structureAlignedTo:', structureAlignedTo);
        if (!viewerA.moleculeAlignedTo) {
            console.warn('Viewer A moleculeAlignedTo not available.');
            return;
        }
        const structureAligned = pluginA.managers.structure.hierarchy.current.structures.find(
            s => s.cell.transform.ref === structureRefAAligned
        )?.cell.obj?.data;
        if (ENABLE_REALIGN_DIAGNOSTICS) console.info('structureAligned:', structureAligned);
        if (!structureAlignedTo || !structureAligned) {
            console.warn('Could not find structure objects for selected refs.');
            return;
        }
        // Get model from first unit in structure object
        const modelAlignedTo = structureAlignedTo?.units?.[0]?.model;
        const modelAligned = structureAligned?.units?.[0]?.model;
        if (!modelAlignedTo || !modelAligned) {
            console.warn('Could not find models in structures.');
            return;
        }
        const selectedChainPairs = [
            { alignedTo: selectedChainIdAlignedTo, aligned: selectedChainIdAligned },
            { alignedTo: selectedChainIdAlignedTo2, aligned: selectedChainIdAligned2 },
        ].filter((pair) => !!pair.alignedTo && !!pair.aligned) as Array<{ alignedTo: string; aligned: string }>;

        if (selectedChainPairs.length === 0) {
            console.warn('No valid chain pair selected for realignment.');
            return;
        }

        const mergeAtomData = (items: Array<{ symbolTypes: string[]; chainIds: string[]; xs: number[]; ys: number[]; zs: number[] }>) => {
            const merged = { symbolTypes: [] as string[], chainIds: [] as string[], xs: [] as number[], ys: [] as number[], zs: [] as number[] };
            for (const item of items) {
                merged.symbolTypes.push(...item.symbolTypes);
                merged.chainIds.push(...item.chainIds);
                merged.xs.push(...item.xs);
                merged.ys.push(...item.ys);
                merged.zs.push(...item.zs);
            }
            return merged;
        };

        const atomDataAlignedTo = mergeAtomData(
            selectedChainPairs.map(({ alignedTo }) => getAtomDataFromStructureUnits(structureAlignedTo, alignedTo))
        );
        const atomDataAligned = mergeAtomData(
            selectedChainPairs.map(({ aligned }) => getAtomDataFromStructureUnits(structureAligned, aligned))
        );

        const alignedToSummary = summarizeAtomCloud(atomDataAlignedTo.xs, atomDataAlignedTo.ys, atomDataAlignedTo.zs);
        const alignedSummary = summarizeAtomCloud(atomDataAligned.xs, atomDataAligned.ys, atomDataAligned.zs);

        const summarize = (summary: ReturnType<typeof summarizeAtomCloud>) => ({
            atomCount: summary.atomCount,
            finiteAtomCount: summary.finiteAtomCount,
            centroid: {
                x: Number.isFinite(summary.centroid.x) ? Number(summary.centroid.x.toFixed(3)) : summary.centroid.x,
                y: Number.isFinite(summary.centroid.y) ? Number(summary.centroid.y.toFixed(3)) : summary.centroid.y,
                z: Number.isFinite(summary.centroid.z) ? Number(summary.centroid.z.toFixed(3)) : summary.centroid.z,
            }
        });

        if (ENABLE_REALIGN_DIAGNOSTICS) {
            console.info('[Re-align][Chain atom summary]', {
                alignedTo: {
                    chainId: selectedChainPairs.map(pair => pair.alignedTo).join(', '),
                    ...summarize(alignedToSummary),
                },
                aligned: {
                    chainId: selectedChainPairs.map(pair => pair.aligned).join(', '),
                    ...summarize(alignedSummary),
                }
            });
        }

        if (alignedToSummary.finiteAtomCount === 0 || alignedSummary.finiteAtomCount === 0) {
            console.warn('[Re-align] Could not proceed: one or both selected chains contain no finite atom coordinates.', {
                alignedToChainId: selectedChainPairs.map(pair => pair.alignedTo).join(', '),
                alignedChainId: selectedChainPairs.map(pair => pair.aligned).join(', '),
                alignedToFiniteAtomCount: alignedToSummary.finiteAtomCount,
                alignedFiniteAtomCount: alignedSummary.finiteAtomCount,
            });
            return;
        }

        try {
            const anchorDataAligned = buildAnchorAtomDataForChain(structureAligned, selectedChainIdAligned);
            const anchorDataAlignedTo = buildAnchorAtomDataForChain(structureAlignedTo, selectedChainIdAlignedTo);

            const movingAnchorCount = new Map<string, number>();
            const referenceAnchorCount = new Map<string, number>();
            for (const t of anchorDataAligned.symbolTypes) movingAnchorCount.set(t, (movingAnchorCount.get(t) ?? 0) + 1);
            for (const t of anchorDataAlignedTo.symbolTypes) referenceAnchorCount.set(t, (referenceAnchorCount.get(t) ?? 0) + 1);

            if (ENABLE_REALIGN_DIAGNOSTICS) {
                console.info('[Re-align][Anchor availability]', {
                    moving: Object.fromEntries(movingAnchorCount.entries()),
                    reference: Object.fromEntries(referenceAnchorCount.entries()),
                    movingTotal: anchorDataAligned.symbolTypes.length,
                    referenceTotal: anchorDataAlignedTo.symbolTypes.length,
                });
            }

            const preferredAnchorOrder = ['P', 'CA', "C4'", "C1'"];
            let selectedAnchorType: string | undefined;
            for (const t of preferredAnchorOrder) {
                const pairs = Math.min(movingAnchorCount.get(t) ?? 0, referenceAnchorCount.get(t) ?? 0);
                if (pairs >= 10) {
                    selectedAnchorType = t;
                    break;
                }
            }

            const anchorPairData = selectedAnchorType
                ? buildPairedAnchorFitData(
                    selectedAnchorType,
                    selectedChainIdAligned,
                    selectedChainIdAlignedTo,
                    anchorDataAligned,
                    anchorDataAlignedTo
                )
                : undefined;

            const useAnchorFitting = !!selectedAnchorType && !!anchorPairData && anchorPairData.pairing.pairCount >= 10;
            const fitMoving = useAnchorFitting ? anchorPairData.movingFit : atomDataAligned;
            const fitReference = useAnchorFitting ? anchorPairData.referenceFit : atomDataAlignedTo;

            if (!useAnchorFitting && ENABLE_REALIGN_DIAGNOSTICS) {
                console.warn('[Re-align][Anchor] No suitable anchor pairing found (need >=10 paired anchors). Falling back to element-data fitting.', {
                    preferredAnchorOrder,
                    selectedAnchorType,
                    anchorPairing: anchorPairData?.pairing,
                    moving: Object.fromEntries(movingAnchorCount.entries()),
                    reference: Object.fromEntries(referenceAnchorCount.entries()),
                });
            }

            if (useAnchorFitting && ENABLE_REALIGN_DIAGNOSTICS) {
                console.info('[Re-align][Anchor pairing]', anchorPairData?.pairing);
            }

            const chainSelector = useAnchorFitting
                ? {
                    selector: { [selectedAnchorType as string]: true },
                    mode: 'anchor-atom',
                    selectedType: selectedAnchorType,
                    countDelta: Math.abs((movingAnchorCount.get(selectedAnchorType as string) ?? 0) - (referenceAnchorCount.get(selectedAnchorType as string) ?? 0)),
                    pairedCount: Math.min(movingAnchorCount.get(selectedAnchorType as string) ?? 0, referenceAnchorCount.get(selectedAnchorType as string) ?? 0),
                }
                : chooseBestSharedElementSelector(
                    atomDataAligned.symbolTypes,
                    atomDataAlignedTo.symbolTypes,
                    selectedAtomTypes
                );

            const selectedAtomTypesForChainRealign = chainSelector.selector;
            if (ENABLE_REALIGN_DIAGNOSTICS) {
                console.info('[Re-align][Atom selector]', {
                    mode: chainSelector.mode,
                    selectedType: chainSelector.selectedType,
                    countDelta: chainSelector.countDelta,
                    pairedCount: chainSelector.pairedCount,
                    atomTypeCount: Object.keys(selectedAtomTypesForChainRealign).length,
                    atomTypes: Object.keys(selectedAtomTypesForChainRealign),
                    fitDataMode: useAnchorFitting ? 'anchor-data' : 'element-data',
                    anchorPairing: anchorPairData?.pairing,
                });
            }

            const mergedAlignedChainId = '__multi_aligned__';
            const mergedAlignedToChainId = '__multi_alignedto__';
            const fitMovingChainIds = new Array(fitMoving.chainIds.length).fill(mergedAlignedChainId);
            const fitReferenceChainIds = new Array(fitReference.chainIds.length).fill(mergedAlignedToChainId);

            const result = alignDatasetUsingChains(
                selectedAtomTypesForChainRealign,
                mergedAlignedChainId,
                fitMoving.symbolTypes,
                fitMovingChainIds,
                fitMoving.xs,
                fitMoving.ys,
                fitMoving.zs,
                mergedAlignedToChainId,
                fitReference.symbolTypes,
                fitReferenceChainIds,
                fitReference.xs,
                fitReference.ys,
                fitReference.zs
            );

            const isFiniteCoord = (x: number, y: number, z: number) =>
                Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);

            const movingPairIndexes = fitMoving.symbolTypes
                .map((type, idx) => ({ type, idx }))
                .filter(({ type, idx }) =>
                    selectedAtomTypesForChainRealign[type]
                    && isFiniteCoord(fitMoving.xs[idx], fitMoving.ys[idx], fitMoving.zs[idx])
                )
                .map(({ idx }) => idx);

            const referencePairIndexes = fitReference.symbolTypes
                .map((type, idx) => ({ type, idx }))
                .filter(({ type, idx }) =>
                    selectedAtomTypesForChainRealign[type]
                    && isFiniteCoord(fitReference.xs[idx], fitReference.ys[idx], fitReference.zs[idx])
                )
                .map(({ idx }) => idx);

            const atomPairCount = Math.min(movingPairIndexes.length, referencePairIndexes.length);
            let pairwiseRmsd = NaN;
            let meanPairDistanceBefore = NaN;
            let meanPairDistanceAfter = NaN;
            let improvementRatio = NaN;
            if (atomPairCount > 0) {
                let sumSqBefore = 0;
                let sumSqAfter = 0;
                for (let i = 0; i < atomPairCount; i++) {
                    const movingIdx = movingPairIndexes[i];
                    const referenceIdx = referencePairIndexes[i];
                    const dxBefore = fitMoving.xs[movingIdx] - fitReference.xs[referenceIdx];
                    const dyBefore = fitMoving.ys[movingIdx] - fitReference.ys[referenceIdx];
                    const dzBefore = fitMoving.zs[movingIdx] - fitReference.zs[referenceIdx];
                    const dx = result.alignedX[movingIdx] - fitReference.xs[referenceIdx];
                    const dy = result.alignedY[movingIdx] - fitReference.ys[referenceIdx];
                    const dz = result.alignedZ[movingIdx] - fitReference.zs[referenceIdx];
                    sumSqBefore += dxBefore * dxBefore + dyBefore * dyBefore + dzBefore * dzBefore;
                    sumSqAfter += dx * dx + dy * dy + dz * dz;
                }
                meanPairDistanceBefore = Math.sqrt(sumSqBefore / atomPairCount);
                pairwiseRmsd = Math.sqrt(sumSqAfter / atomPairCount);
                meanPairDistanceAfter = pairwiseRmsd;
                if (Number.isFinite(meanPairDistanceBefore) && Number.isFinite(meanPairDistanceAfter) && meanPairDistanceAfter > 0) {
                    improvementRatio = meanPairDistanceBefore / meanPairDistanceAfter;
                }
            }

            lastChainRealignMetricsRef.current = {
                timestamp: Date.now(),
                alignedToChainId: selectedChainPairs.map(pair => pair.alignedTo).join(', '),
                alignedChainId: selectedChainPairs.map(pair => pair.aligned).join(', '),
                atomPairCount,
                rmsd: pairwiseRmsd,
                meanPairDistanceBefore,
                meanPairDistanceAfter,
                improvementRatio,
            };

            if (ENABLE_REALIGN_DIAGNOSTICS) {
                console.info('[Re-align][Fit quality]', {
                    movingSelectedAtomCount: movingPairIndexes.length,
                    referenceSelectedAtomCount: referencePairIndexes.length,
                    atomPairCount,
                    rmsd: Number.isFinite(pairwiseRmsd) ? Number(pairwiseRmsd.toFixed(4)) : pairwiseRmsd,
                    fitDataMode: useAnchorFitting ? 'anchor-data' : 'element-data',
                });
            }

            const buildRigidTransformFromFit = (): Mat4 => {
                const rot = result.rotmat;
                if (!Array.isArray(rot) || rot.length !== 9) {
                    throw new Error('Alignment result rotation matrix is invalid.');
                }

                const m = Mat4.identity();
                Mat4.setValue(m, 0, 0, rot[0]);
                Mat4.setValue(m, 0, 1, rot[1]);
                Mat4.setValue(m, 0, 2, rot[2]);
                Mat4.setValue(m, 1, 0, rot[3]);
                Mat4.setValue(m, 1, 1, rot[4]);
                Mat4.setValue(m, 1, 2, rot[5]);
                Mat4.setValue(m, 2, 0, rot[6]);
                Mat4.setValue(m, 2, 1, rot[7]);
                Mat4.setValue(m, 2, 2, rot[8]);

                const movingCentroid = result.centroid;
                const referenceCentroid = result.centroidReference;
                const tx = referenceCentroid[0] - (rot[0] * movingCentroid[0] + rot[1] * movingCentroid[1] + rot[2] * movingCentroid[2]);
                const ty = referenceCentroid[1] - (rot[3] * movingCentroid[0] + rot[4] * movingCentroid[1] + rot[5] * movingCentroid[2]);
                const tz = referenceCentroid[2] - (rot[6] * movingCentroid[0] + rot[7] * movingCentroid[1] + rot[8] * movingCentroid[2]);

                Mat4.setValue(m, 0, 3, tx);
                Mat4.setValue(m, 1, 3, ty);
                Mat4.setValue(m, 2, 3, tz);
                return m;
            };

            const applyInPlaceRealign = async (): Promise<boolean> => {
                if (!ENABLE_IN_PLACE_CHAIN_REALIGN) return false;
                const pluginAInPlace = viewerA.ref.current;
                const pluginBInPlace = viewerB.ref.current;
                if (!pluginAInPlace || !pluginBInPlace || !structureRefAAligned || !structureRefBAligned) {
                    return false;
                }

                const baseTransform = buildRigidTransformFromFit();
                const applyToViewer = async (plugin: PluginUIContext, structureRef: string, tag: string) => {
                    const viewerKey = plugin === viewerA.ref.current ? 'A' : 'B';
                    await applyComposedRealignTransform(
                        plugin,
                        structureRef,
                        baseTransform,
                        tag,
                        `${viewerKey}:${structureRef}`,
                        {
                            operation: 'chain',
                            from: selectedChainIdAligned,
                            to: selectedChainIdAlignedTo,
                            movingFiniteAtomCount: alignedSummary.finiteAtomCount,
                            referenceFiniteAtomCount: alignedToSummary.finiteAtomCount,
                            atomPairCount,
                            rmsd: pairwiseRmsd,
                        }
                    );
                };

                await applyToViewer(pluginAInPlace, structureRefAAligned, 'ribocode-realign-inplace');
                await applyToViewer(pluginBInPlace, structureRefBAligned, 'ribocode-realign-inplace');
                return true;
            };

            if (ENABLE_REALIGN_DIAGNOSTICS) console.info('Alignment result:', result);
            const alignmentData: AlignmentData = {
                centroidReference: result.centroidReference,
                centroid: result.centroid,
                rotMat: result.rotmat
            };
            // Load aligned structure in Viewers A and B.
            (async () => {
                const pluginA = viewerA.ref.current;
                if (!pluginA) {
                    console.warn('Viewer A not initialized.');
                    return;
                }

                await runWithTemporarySyncDisabled(syncEnabled, setSyncEnabled, async () => {
                    try {
                        const appliedInPlace = await applyInPlaceRealign();
                        if (appliedInPlace) {
                            // Match right-viewer viewpoint to left-viewer viewpoint.
                            copyCameraZoomRadius(viewerA.ref, viewerB.ref);
                            if (ENABLE_REALIGN_DIAGNOSTICS) console.info('[Re-align] Applied in-place transform to existing aligned structures.');
                            return;
                        }
                    } catch (inPlaceErr) {
                        console.warn('[Re-align] In-place transform failed; falling back to reload-based realign.', inPlaceErr);
                    }

                    const file = new File([alignedFile], alignedFile.name);
                    await loadMoleculeIntoViewers(file, ReAligned, alignmentData);
                    pluginA.canvas3d?.requestDraw?.();
                    const pluginB = viewerB.ref.current;
                    if (!pluginB) {
                        console.warn('Viewer B not initialized.');
                        return;
                    }
                    pluginB.canvas3d?.requestDraw?.();
                    // Keep viewpoint parity in fallback mode as well.
                    copyCameraZoomRadius(viewerA.ref, viewerB.ref);
                    if (ENABLE_REALIGN_DIAGNOSTICS) console.info('[Re-align] Applied reload-based fallback realign.');
                });
            })();
            if (ENABLE_REALIGN_DIAGNOSTICS) console.info('Realignment applied to Viewer A and B models.');
        } catch (err) {
            console.error('Alignment error:', err);
        }
    };

    const handleRealignToSubunits = () => {
        if (!canRealignToSubunits || subunitRealignmentExists) return;
        const pluginA = viewerA.ref.current;
        if (!pluginA) {
            console.warn('Viewer A not initialized.');
            return;
        }
        if (!structureRefAAlignedTo) {
            console.warn('Viewer A aligned-to structure not selected.');
            return;
        }

        const structureAlignedTo = pluginA.managers.structure.hierarchy.current.structures.find(
            s => s.cell.transform.ref === structureRefAAlignedTo
        )?.cell.obj?.data;
        const structureAligned = pluginA.managers.structure.hierarchy.current.structures.find(
            s => s.cell.transform.ref === structureRefAAligned
        )?.cell.obj?.data;

        if (!structureAlignedTo || !structureAligned) {
            console.warn('Could not find structure objects for selected refs.');
            return;
        }

        const atomDataAlignedTo = buildAtomDataForChainGroup(structureAlignedTo, selectedSubunitChainIdsAlignedTo);
        const atomDataAligned = buildAtomDataForChainGroup(structureAligned, selectedSubunitChainIdsAligned);

        const alignedToSummary = summarizeAtomCloud(atomDataAlignedTo.xs, atomDataAlignedTo.ys, atomDataAlignedTo.zs);
        const alignedSummary = summarizeAtomCloud(atomDataAligned.xs, atomDataAligned.ys, atomDataAligned.zs);
        if (alignedToSummary.finiteAtomCount === 0 || alignedSummary.finiteAtomCount === 0) {
            console.warn('[Re-align Subunit] Could not proceed: one or both selected subunits contain no finite atom coordinates.', {
                selectedSubunitAlignedTo,
                selectedSubunitAligned,
                alignedToFiniteAtomCount: alignedToSummary.finiteAtomCount,
                alignedFiniteAtomCount: alignedSummary.finiteAtomCount,
            });
            return;
        }

        try {
            const allSubunitAtomTypes = new Set<string>();
            for (const t of atomDataAligned.symbolTypes) {
                if (typeof t === 'string' && t.length > 0) allSubunitAtomTypes.add(t);
            }
            for (const t of atomDataAlignedTo.symbolTypes) {
                if (typeof t === 'string' && t.length > 0) allSubunitAtomTypes.add(t);
            }
            const selectedAtomTypesForSubunitRealign = allSubunitAtomTypes.size > 0
                ? Object.fromEntries(Array.from(allSubunitAtomTypes).map(atomType => [atomType, true]))
                : selectedAtomTypes;

            const result = alignDatasetUsingChains(
                selectedAtomTypesForSubunitRealign,
                SUBUNIT_REALIGN_CHAIN_ID,
                atomDataAligned.symbolTypes,
                atomDataAligned.chainIds,
                atomDataAligned.xs,
                atomDataAligned.ys,
                atomDataAligned.zs,
                SUBUNIT_REALIGN_CHAIN_ID,
                atomDataAlignedTo.symbolTypes,
                atomDataAlignedTo.chainIds,
                atomDataAlignedTo.xs,
                atomDataAlignedTo.ys,
                atomDataAlignedTo.zs
            );

            const isFiniteCoord = (x: number, y: number, z: number) =>
                Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);

            const buildRigidTransformFromFit = (): Mat4 => {
                const rot = result.rotmat;
                if (!Array.isArray(rot) || rot.length !== 9) {
                    throw new Error('Alignment result rotation matrix is invalid.');
                }

                const m = Mat4.identity();
                Mat4.setValue(m, 0, 0, rot[0]);
                Mat4.setValue(m, 0, 1, rot[1]);
                Mat4.setValue(m, 0, 2, rot[2]);
                Mat4.setValue(m, 1, 0, rot[3]);
                Mat4.setValue(m, 1, 1, rot[4]);
                Mat4.setValue(m, 1, 2, rot[5]);
                Mat4.setValue(m, 2, 0, rot[6]);
                Mat4.setValue(m, 2, 1, rot[7]);
                Mat4.setValue(m, 2, 2, rot[8]);

                let tx = 0;
                let ty = 0;
                let tz = 0;
                let n = 0;
                for (let i = 0; i < atomDataAligned.xs.length && i < result.alignedX.length; i++) {
                    const x = atomDataAligned.xs[i];
                    const y = atomDataAligned.ys[i];
                    const z = atomDataAligned.zs[i];
                    const xAligned = result.alignedX[i];
                    const yAligned = result.alignedY[i];
                    const zAligned = result.alignedZ[i];
                    if (!isFiniteCoord(x, y, z) || !isFiniteCoord(xAligned, yAligned, zAligned)) continue;

                    const xRot = rot[0] * x + rot[1] * y + rot[2] * z;
                    const yRot = rot[3] * x + rot[4] * y + rot[5] * z;
                    const zRot = rot[6] * x + rot[7] * y + rot[8] * z;
                    tx += (xAligned - xRot);
                    ty += (yAligned - yRot);
                    tz += (zAligned - zRot);
                    n++;
                }

                if (n === 0) {
                    throw new Error('No finite atom pairs were available to derive rigid translation from fit result.');
                }

                Mat4.setValue(m, 0, 3, tx / n);
                Mat4.setValue(m, 1, 3, ty / n);
                Mat4.setValue(m, 2, 3, tz / n);
                return m;
            };

            const applyInPlaceRealign = async (): Promise<boolean> => {
                if (!ENABLE_IN_PLACE_CHAIN_REALIGN) return false;
                const pluginAInPlace = viewerA.ref.current;
                const pluginBInPlace = viewerB.ref.current;
                if (!pluginAInPlace || !pluginBInPlace || !structureRefAAligned || !structureRefBAligned) {
                    return false;
                }

                const baseTransform = buildRigidTransformFromFit();
                const applyToViewer = async (plugin: PluginUIContext, structureRef: string, tag: string) => {
                    const viewerKey = plugin === viewerA.ref.current ? 'A' : 'B';
                    await applyComposedRealignTransform(
                        plugin,
                        structureRef,
                        baseTransform,
                        tag,
                        `${viewerKey}:${structureRef}`,
                        {
                            operation: 'subunit',
                            from: selectedSubunitAligned,
                            to: selectedSubunitAlignedTo,
                            movingFiniteAtomCount: alignedSummary.finiteAtomCount,
                            referenceFiniteAtomCount: alignedToSummary.finiteAtomCount,
                        }
                    );
                };

                await applyToViewer(pluginAInPlace, structureRefAAligned, 'ribocode-realign-subunit-inplace');
                await applyToViewer(pluginBInPlace, structureRefBAligned, 'ribocode-realign-subunit-inplace');
                return true;
            };

            const alignmentData: AlignmentData = {
                centroidReference: result.centroidReference,
                centroid: result.centroid,
                rotMat: result.rotmat
            };

            (async () => {
                const pluginA = viewerA.ref.current;
                if (!pluginA) {
                    console.warn('Viewer A not initialized.');
                    return;
                }

                await runWithTemporarySyncDisabled(syncEnabled, setSyncEnabled, async () => {
                    try {
                        const appliedInPlace = await applyInPlaceRealign();
                        if (appliedInPlace) {
                            copyCameraZoomRadius(viewerA.ref, viewerB.ref);
                            console.log('[Re-align Subunit] Applied in-place transform to existing aligned structures.');
                            return;
                        }
                    } catch (inPlaceErr) {
                        console.warn('[Re-align Subunit] In-place transform failed; falling back to reload-based realign.', inPlaceErr);
                    }

                    const file = new File([alignedFile], alignedFile.name);
                    await loadMoleculeIntoViewers(file, ReAligned, alignmentData);
                    pluginA.canvas3d?.requestDraw?.();
                    const pluginB = viewerB.ref.current;
                    if (!pluginB) {
                        console.warn('Viewer B not initialized.');
                        return;
                    }
                    pluginB.canvas3d?.requestDraw?.();
                    copyCameraZoomRadius(viewerA.ref, viewerB.ref);
                    console.log('[Re-align Subunit] Applied reload-based fallback realign.');
                });
            })();
        } catch (err) {
            console.error('Subunit alignment error:', err);
        }
    };

    const handleRealignToResidues = () => {
        const setResidueRealignDebug = (
            phase: ResidueRealignDebugStatus['phase'],
            reason?: string,
            details?: Record<string, unknown>
        ) => {
            lastResidueRealignDebugRef.current = {
                phase,
                reason,
                details,
                timestamp: Date.now(),
            };
        };

        const residueSelections = [
            {
                alignedToChainId: selectedChainIdAlignedTo,
                alignedChainId: selectedChainIdAligned,
                alignedToResidueIds: selectedResidueIdsAlignedTo,
                alignedResidueIds: selectedResidueIdsAligned,
                alignedToResidueInfo: residueInfoAlignedTo,
                alignedResidueInfo: residueInfoAligned,
            },
            {
                alignedToChainId: selectedChainIdAlignedTo2,
                alignedChainId: selectedChainIdAligned2,
                alignedToResidueIds: selectedResidueIdsAlignedTo2,
                alignedResidueIds: selectedResidueIdsAligned2,
                alignedToResidueInfo: residueInfoAlignedTo2,
                alignedResidueInfo: residueInfoAligned2,
            },
        ].filter((entry) =>
            !!entry.alignedToChainId
            && !!entry.alignedChainId
            && entry.alignedToResidueIds.length > 0
            && entry.alignedResidueIds.length > 0
        );

        const mergedAlignedToResidueIds = residueSelections.flatMap((entry) => entry.alignedToResidueIds);
        const mergedAlignedResidueIds = residueSelections.flatMap((entry) => entry.alignedResidueIds);
        const mergedAlignedToChainIds = residueSelections.map((entry) => entry.alignedToChainId);
        const mergedAlignedChainIds = residueSelections.map((entry) => entry.alignedChainId);

        if (!canRealignToResidues || residueRealignmentExists) {
            setResidueRealignDebug('blocked', 'residue-realign-precondition-failed', {
                canRealignToResidues,
                residueRealignmentExists,
                selectedChainIdAlignedTo: mergedAlignedToChainIds,
                selectedChainIdAligned: mergedAlignedChainIds,
                alignedToResidueCount: mergedAlignedToResidueIds.length,
                alignedResidueCount: mergedAlignedResidueIds.length,
            });
            return;
        }
        setResidueRealignDebug('running', 'residue-realign-started', {
            selectedChainIdAlignedTo: mergedAlignedToChainIds,
            selectedChainIdAligned: mergedAlignedChainIds,
            alignedToResidueCount: mergedAlignedToResidueIds.length,
            alignedResidueCount: mergedAlignedResidueIds.length,
        });
        const pluginA = viewerA.ref.current;
        if (!pluginA) {
            console.warn('Viewer A not initialized.');
            setResidueRealignDebug('failed', 'viewer-a-not-initialized');
            return;
        }
        if (!structureRefAAlignedTo) {
            console.warn('Viewer A aligned-to structure not selected.');
            setResidueRealignDebug('failed', 'alignedto-structure-ref-missing');
            return;
        }

        const structureAlignedTo = pluginA.managers.structure.hierarchy.current.structures.find(
            s => s.cell.transform.ref === structureRefAAlignedTo
        )?.cell.obj?.data;
        const structureAligned = pluginA.managers.structure.hierarchy.current.structures.find(
            s => s.cell.transform.ref === structureRefAAligned
        )?.cell.obj?.data;

        if (!structureAlignedTo || !structureAligned) {
            console.warn('Could not find structure objects for selected refs.');
            setResidueRealignDebug('failed', 'structure-object-missing', {
                hasAlignedToStructure: !!structureAlignedTo,
                hasAlignedStructure: !!structureAligned,
                structureRefAAlignedTo,
                structureRefAAligned,
            });
            return;
        }

        const mergeAtomData = (items: Array<{ symbolTypes: string[]; chainIds: string[]; xs: number[]; ys: number[]; zs: number[] }>) => {
            const merged = { symbolTypes: [] as string[], chainIds: [] as string[], xs: [] as number[], ys: [] as number[], zs: [] as number[] };
            for (const item of items) {
                merged.symbolTypes.push(...item.symbolTypes);
                merged.chainIds.push(...item.chainIds);
                merged.xs.push(...item.xs);
                merged.ys.push(...item.ys);
                merged.zs.push(...item.zs);
            }
            return merged;
        };

        const atomDataAlignedTo = mergeAtomData(
            residueSelections.map((entry) =>
                buildAtomDataForResidueGroup(
                    structureAlignedTo,
                    entry.alignedToResidueIds,
                    entry.alignedToResidueInfo.residueToAtomIds,
                    entry.alignedToChainId
                )
            )
        );
        const atomDataAligned = mergeAtomData(
            residueSelections.map((entry) =>
                buildAtomDataForResidueGroup(
                    structureAligned,
                    entry.alignedResidueIds,
                    entry.alignedResidueInfo.residueToAtomIds,
                    entry.alignedChainId
                )
            )
        );

        const alignedToSummary = summarizeAtomCloud(atomDataAlignedTo.xs, atomDataAlignedTo.ys, atomDataAlignedTo.zs);
        const alignedSummary = summarizeAtomCloud(atomDataAligned.xs, atomDataAligned.ys, atomDataAligned.zs);
        if (alignedToSummary.finiteAtomCount === 0 || alignedSummary.finiteAtomCount === 0) {
            console.warn('[Re-align Residue] Could not proceed: one or both selected residue sets contain no finite atom coordinates.', {
                selectedResidueIdsAlignedTo: mergedAlignedToResidueIds,
                selectedResidueIdsAligned: mergedAlignedResidueIds,
                alignedToFiniteAtomCount: alignedToSummary.finiteAtomCount,
                alignedFiniteAtomCount: alignedSummary.finiteAtomCount,
            });
            setResidueRealignDebug('failed', 'no-finite-atom-coordinates', {
                selectedResidueIdsAlignedTo: mergedAlignedToResidueIds,
                selectedResidueIdsAligned: mergedAlignedResidueIds,
                alignedToFiniteAtomCount: alignedToSummary.finiteAtomCount,
                alignedFiniteAtomCount: alignedSummary.finiteAtomCount,
            });
            return;
        }

        try {
            const allResidueAtomTypes = new Set<string>();
            for (const t of atomDataAligned.symbolTypes) {
                if (typeof t === 'string' && t.length > 0) allResidueAtomTypes.add(t);
            }
            for (const t of atomDataAlignedTo.symbolTypes) {
                if (typeof t === 'string' && t.length > 0) allResidueAtomTypes.add(t);
            }
            const selectedAtomTypesForResidueRealign = allResidueAtomTypes.size > 0
                ? Object.fromEntries(Array.from(allResidueAtomTypes).map(atomType => [atomType, true]))
                : selectedAtomTypes;

            const result = alignDatasetUsingChains(
                selectedAtomTypesForResidueRealign,
                RESIDUE_REALIGN_CHAIN_ID,
                atomDataAligned.symbolTypes,
                atomDataAligned.chainIds,
                atomDataAligned.xs,
                atomDataAligned.ys,
                atomDataAligned.zs,
                RESIDUE_REALIGN_CHAIN_ID,
                atomDataAlignedTo.symbolTypes,
                atomDataAlignedTo.chainIds,
                atomDataAlignedTo.xs,
                atomDataAlignedTo.ys,
                atomDataAlignedTo.zs
            );

            const isFiniteCoord = (x: number, y: number, z: number) =>
                Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);

            const movingPairIndexes = atomDataAligned.symbolTypes
                .map((type, idx) => ({ type, idx }))
                .filter(({ type, idx }) =>
                    selectedAtomTypesForResidueRealign[type]
                    && isFiniteCoord(atomDataAligned.xs[idx], atomDataAligned.ys[idx], atomDataAligned.zs[idx])
                )
                .map(({ idx }) => idx);

            const referencePairIndexes = atomDataAlignedTo.symbolTypes
                .map((type, idx) => ({ type, idx }))
                .filter(({ type, idx }) =>
                    selectedAtomTypesForResidueRealign[type]
                    && isFiniteCoord(atomDataAlignedTo.xs[idx], atomDataAlignedTo.ys[idx], atomDataAlignedTo.zs[idx])
                )
                .map(({ idx }) => idx);

            const atomPairCount = Math.min(movingPairIndexes.length, referencePairIndexes.length);
            let pairwiseRmsd = NaN;
            let meanPairDistanceBefore = NaN;
            let meanPairDistanceAfter = NaN;
            let improvementRatio = NaN;
            if (atomPairCount > 0) {
                let sumSqBefore = 0;
                let sumSqAfter = 0;
                for (let i = 0; i < atomPairCount; i++) {
                    const movingIdx = movingPairIndexes[i];
                    const referenceIdx = referencePairIndexes[i];
                    const dxBefore = atomDataAligned.xs[movingIdx] - atomDataAlignedTo.xs[referenceIdx];
                    const dyBefore = atomDataAligned.ys[movingIdx] - atomDataAlignedTo.ys[referenceIdx];
                    const dzBefore = atomDataAligned.zs[movingIdx] - atomDataAlignedTo.zs[referenceIdx];
                    const dx = result.alignedX[movingIdx] - atomDataAlignedTo.xs[referenceIdx];
                    const dy = result.alignedY[movingIdx] - atomDataAlignedTo.ys[referenceIdx];
                    const dz = result.alignedZ[movingIdx] - atomDataAlignedTo.zs[referenceIdx];
                    sumSqBefore += dxBefore * dxBefore + dyBefore * dyBefore + dzBefore * dzBefore;
                    sumSqAfter += dx * dx + dy * dy + dz * dz;
                }
                meanPairDistanceBefore = Math.sqrt(sumSqBefore / atomPairCount);
                pairwiseRmsd = Math.sqrt(sumSqAfter / atomPairCount);
                meanPairDistanceAfter = pairwiseRmsd;
                if (Number.isFinite(meanPairDistanceBefore) && Number.isFinite(meanPairDistanceAfter) && meanPairDistanceAfter > 0) {
                    improvementRatio = meanPairDistanceBefore / meanPairDistanceAfter;
                }
            }

            lastResidueRealignMetricsRef.current = {
                timestamp: Date.now(),
                alignedToChainId: mergedAlignedToChainIds.join(', '),
                alignedChainId: mergedAlignedChainIds.join(', '),
                alignedToResidueIds: [...mergedAlignedToResidueIds],
                alignedResidueIds: [...mergedAlignedResidueIds],
                atomPairCount,
                rmsd: pairwiseRmsd,
                meanPairDistanceBefore,
                meanPairDistanceAfter,
                improvementRatio,
            };
            setResidueRealignDebug('success', 'residue-realign-metrics-updated', {
                atomPairCount,
                meanPairDistanceBefore,
                meanPairDistanceAfter,
                improvementRatio,
            });

            const buildRigidTransformFromFit = (): Mat4 => {
                const rot = result.rotmat;
                if (!Array.isArray(rot) || rot.length !== 9) {
                    throw new Error('Alignment result rotation matrix is invalid.');
                }

                const m = Mat4.identity();
                Mat4.setValue(m, 0, 0, rot[0]);
                Mat4.setValue(m, 0, 1, rot[1]);
                Mat4.setValue(m, 0, 2, rot[2]);
                Mat4.setValue(m, 1, 0, rot[3]);
                Mat4.setValue(m, 1, 1, rot[4]);
                Mat4.setValue(m, 1, 2, rot[5]);
                Mat4.setValue(m, 2, 0, rot[6]);
                Mat4.setValue(m, 2, 1, rot[7]);
                Mat4.setValue(m, 2, 2, rot[8]);

                let tx = 0;
                let ty = 0;
                let tz = 0;
                let n = 0;
                for (let i = 0; i < atomDataAligned.xs.length && i < result.alignedX.length; i++) {
                    const x = atomDataAligned.xs[i];
                    const y = atomDataAligned.ys[i];
                    const z = atomDataAligned.zs[i];
                    const xAligned = result.alignedX[i];
                    const yAligned = result.alignedY[i];
                    const zAligned = result.alignedZ[i];
                    if (!isFiniteCoord(x, y, z) || !isFiniteCoord(xAligned, yAligned, zAligned)) continue;

                    const xRot = rot[0] * x + rot[1] * y + rot[2] * z;
                    const yRot = rot[3] * x + rot[4] * y + rot[5] * z;
                    const zRot = rot[6] * x + rot[7] * y + rot[8] * z;
                    tx += (xAligned - xRot);
                    ty += (yAligned - yRot);
                    tz += (zAligned - zRot);
                    n++;
                }

                if (n === 0) {
                    throw new Error('No finite atom pairs were available to derive rigid translation from fit result.');
                }

                Mat4.setValue(m, 0, 3, tx / n);
                Mat4.setValue(m, 1, 3, ty / n);
                Mat4.setValue(m, 2, 3, tz / n);
                return m;
            };

            const applyInPlaceRealign = async (): Promise<boolean> => {
                if (!ENABLE_IN_PLACE_CHAIN_REALIGN) return false;
                const pluginAInPlace = viewerA.ref.current;
                const pluginBInPlace = viewerB.ref.current;
                if (!pluginAInPlace || !pluginBInPlace || !structureRefAAligned || !structureRefBAligned) {
                    return false;
                }

                const baseTransform = buildRigidTransformFromFit();
                const applyToViewer = async (plugin: PluginUIContext, structureRef: string, tag: string) => {
                    const viewerKey = plugin === viewerA.ref.current ? 'A' : 'B';
                    await applyComposedRealignTransform(
                        plugin,
                        structureRef,
                        baseTransform,
                        tag,
                        `${viewerKey}:${structureRef}`,
                        {
                            operation: 'residue',
                            from: `${selectedChainIdAligned}:${selectedResidueIdsAligned.slice().sort().join(',')}`,
                            to: `${selectedChainIdAlignedTo}:${selectedResidueIdsAlignedTo.slice().sort().join(',')}`,
                            movingFiniteAtomCount: alignedSummary.finiteAtomCount,
                            referenceFiniteAtomCount: alignedToSummary.finiteAtomCount,
                        }
                    );
                };

                await applyToViewer(pluginAInPlace, structureRefAAligned, 'ribocode-realign-residue-inplace');
                await applyToViewer(pluginBInPlace, structureRefBAligned, 'ribocode-realign-residue-inplace');
                return true;
            };

            const alignmentData: AlignmentData = {
                centroidReference: result.centroidReference,
                centroid: result.centroid,
                rotMat: result.rotmat
            };

            (async () => {
                const pluginAAsync = viewerA.ref.current;
                if (!pluginAAsync) {
                    console.warn('Viewer A not initialized.');
                    return;
                }

                await runWithTemporarySyncDisabled(syncEnabled, setSyncEnabled, async () => {
                    try {
                        const appliedInPlace = await applyInPlaceRealign();
                        if (appliedInPlace) {
                            copyCameraZoomRadius(viewerA.ref, viewerB.ref);
                            console.log('[Re-align Residue] Applied in-place transform to existing aligned structures.');
                            return;
                        }
                    } catch (inPlaceErr) {
                        console.warn('[Re-align Residue] In-place transform failed; falling back to reload-based realign.', inPlaceErr);
                    }

                    const file = new File([alignedFile], alignedFile.name);
                    await loadMoleculeIntoViewers(file, ReAligned, alignmentData);
                    pluginAAsync.canvas3d?.requestDraw?.();
                    const pluginBAsync = viewerB.ref.current;
                    if (!pluginBAsync) {
                        console.warn('Viewer B not initialized.');
                        return;
                    }
                    pluginBAsync.canvas3d?.requestDraw?.();
                    copyCameraZoomRadius(viewerA.ref, viewerB.ref);
                    console.log('[Re-align Residue] Applied reload-based fallback realign.');
                });
            })();
        } catch (err) {
            console.error('Residue alignment error:', err);
            setResidueRealignDebug('failed', 'residue-alignment-error', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    };

    // --- Debug: Log subunit selection and filtered chain IDs ---
    useEffect(() => {
        const chains = subunitToChainIdsAlignedTo.get(selectedSubunitAlignedTo);
        console.log('[Subunit Select Debug][AlignedTo] selectedSubunit:', selectedSubunitAlignedTo, 'chain IDs:', chains ? Array.from(chains) : []);
    }, [selectedSubunitAlignedTo, subunitToChainIdsAlignedTo]);

    useEffect(() => {
        const chains = subunitToChainIdsAligned.get(selectedSubunitAligned);
        console.log('[Subunit Select Debug][Aligned] selectedSubunit:', selectedSubunitAligned, 'chain IDs:', chains ? Array.from(chains) : []);
    }, [selectedSubunitAligned, subunitToChainIdsAligned]);

    // Menu bar handlers

    const buildPersistedColorThemes = useCallback((): PersistedColorTheme[] => {
        return loadedColorThemes
            .filter(option => option.value !== DEFAULT_COLOR_THEME_NAME)
            .map(option => ({
                value: option.value,
                label: option.label,
                rows: loadedColorThemeRowsByName[option.value] ?? [],
            }))
            .filter(theme => theme.rows.length > 0);
    }, [loadedColorThemeRowsByName, loadedColorThemes]);

    // Session save: use custom hook
    const handleSaveSession = useSessionSave(() => {
        const resolvedRefsA = resolveViewerStructureRefs(viewerA.ref.current, molstarA.structureRefs);
        const resolvedRefsB = resolveViewerStructureRefs(viewerB.ref.current, molstarB.structureRefs);
        return {
            viewerA: {
            moleculeAlignedTo: viewerA.moleculeAlignedTo
                ? {
                    filename: viewerA.moleculeAlignedTo.filename,
                    alignmentData: viewerA.moleculeAlignedTo.alignmentData,
                    representations: serializeRepresentationsForMode(molstarA, pluginRefA, AlignedTo),
                    // add other serializable fields as needed
                }
                : null,
            moleculeAligned: viewerA.moleculeAligned
                ? {
                    filename: viewerA.moleculeAligned.filename,
                    alignmentData: viewerA.moleculeAligned.alignmentData,
                    representations: serializeRepresentationsForMode(molstarA, pluginRefA, Aligned),
                    // add other serializable fields as needed
                }
                : null,
        },
        viewerB: {
            moleculeAlignedTo: viewerB.moleculeAlignedTo
                ? {
                    filename: viewerB.moleculeAlignedTo.filename,
                    alignmentData: viewerB.moleculeAlignedTo.alignmentData,
                    representations: serializeRepresentationsForMode(molstarB, pluginRefB, AlignedTo),
                }
                : null,
            moleculeAligned: viewerB.moleculeAligned
                ? {
                    filename: viewerB.moleculeAligned.filename,
                    alignmentData: viewerB.moleculeAligned.alignmentData,
                    representations: serializeRepresentationsForMode(molstarB, pluginRefB, Aligned),
                }
                : null,
        },
            uiState: {
            zoom: {
                extraRadius: zoomExtraRadiusA,
                minRadius: zoomMinRadiusA,
            },
            zoomByViewer: {
                viewerA: { extraRadius: zoomExtraRadiusA, minRadius: zoomMinRadiusA },
                viewerB: { extraRadius: zoomExtraRadiusB, minRadius: zoomMinRadiusB },
            },
            clippingByViewer: {
                viewerA: { minNear: clippingA.minNear, clipRadius: clippingA.clipRadius },
                viewerB: { minNear: clippingB.minNear, clipRadius: clippingB.clipRadius },
            },
            selections: {
                alignedTo: {
                    subunit: selectedSubunitAlignedTo,
                    chainId: selectedChainIdAlignedTo,
                    chainId2: selectedChainIdAlignedTo2,
                    residueId: selectedResidueIdAlignedTo,
                    residueId2: selectedResidueIdAlignedTo2,
                    residueIds: selectedResidueIdsAlignedTo,
                    residueIds2: selectedResidueIdsAlignedTo2,
                },
                aligned: {
                    subunit: selectedSubunitAligned,
                    chainId: selectedChainIdAligned,
                    chainId2: selectedChainIdAligned2,
                    residueId: selectedResidueIdAligned,
                    residueId2: selectedResidueIdAligned2,
                    residueIds: selectedResidueIdsAligned,
                    residueIds2: selectedResidueIdsAligned2,
                },
            },
            highlights: {
                alignedTo: {
                    chain: chainHighlightOnAlignedTo,
                    residue: residueHighlightOnAlignedTo,
                    subunit: subunitHighlightOnAlignedTo,
                },
                aligned: {
                    chain: chainHighlightOnAligned,
                    residue: residueHighlightOnAligned,
                    subunit: subunitHighlightOnAligned,
                },
            },
            inspectByViewer: {
                viewerA: {
                    alignedTo: {
                        chain: chainInspectOnAAlignedTo,
                        residue: residueInspectOnAAlignedTo,
                        subunit: subunitInspectOnAAlignedTo,
                    },
                    aligned: {
                        chain: chainInspectOnAAligned,
                        residue: residueInspectOnAAligned,
                        subunit: subunitInspectOnAAligned,
                    },
                },
                viewerB: {
                    alignedTo: {
                        chain: chainInspectOnBAlignedTo,
                        residue: residueInspectOnBAlignedTo,
                        subunit: subunitInspectOnBAlignedTo,
                    },
                    aligned: {
                        chain: chainInspectOnBAligned,
                        residue: residueInspectOnBAligned,
                        subunit: subunitInspectOnBAligned,
                    },
                },
            },
            visibilityByViewer: {
                viewerA: {
                    alignedTo: viewerA.isMoleculeAlignedToVisible,
                    aligned: viewerA.isMoleculeAlignedVisible,
                },
                viewerB: {
                    alignedTo: viewerB.isMoleculeAlignedToVisible,
                    aligned: viewerB.isMoleculeAlignedVisible,
                },
            },
            fogByViewer: {
                viewerA: {
                    enabled: fogA.enabled,
                    near: fogA.near,
                    far: fogA.far,
                },
                viewerB: {
                    enabled: fogB.enabled,
                    near: fogB.near,
                    far: fogB.far,
                },
            },
            syncEnabled,
            activeViewer,
            cameraSnapshots: {
                viewerA: getSerializableCameraSnapshot(viewerA.ref),
                viewerB: getSerializableCameraSnapshot(viewerB.ref),
            },
            structureTransformsByViewer: {
                viewerA: {
                    alignedTo: getSerializableStructureTransform(viewerA.ref.current, resolvedRefsA.alignedTo, persistedStructureTransformsByModeRef.current.viewerA.alignedTo),
                    aligned: getSerializableStructureTransform(viewerA.ref.current, resolvedRefsA.aligned, persistedStructureTransformsByModeRef.current.viewerA.aligned),
                },
                viewerB: {
                    alignedTo: getSerializableStructureTransform(viewerB.ref.current, resolvedRefsB.alignedTo, persistedStructureTransformsByModeRef.current.viewerB.alignedTo),
                    aligned: getSerializableStructureTransform(viewerB.ref.current, resolvedRefsB.aligned, persistedStructureTransformsByModeRef.current.viewerB.aligned),
                },
            },
            uniprotGeneNames,
            showUniprotAccessionInChainLabelsByViewer: {
                viewerA: showUniprotAccessionInChainLabelsA,
                viewerB: showUniprotAccessionInChainLabelsB,
            },
            chainFinderQueries: {
                alignedTo: chainFinderQueryAlignedTo,
                aligned: chainFinderQueryAligned,
            },
            colorThemesByMode: {
                alignedTo: {
                    selectedThemeName: selectedColorThemeByMode.AlignedTo,
                    selectedChainThemeName: selectedColorThemeByMode.AlignedTo,
                    selectedResidueThemeName: selectedResidueThemeByMode.AlignedTo,
                    themes: buildPersistedColorThemes(),
                },
                aligned: {
                    selectedThemeName: selectedColorThemeByMode.Aligned,
                    selectedChainThemeName: selectedColorThemeByMode.Aligned,
                    selectedResidueThemeName: selectedResidueThemeByMode.Aligned,
                    themes: buildPersistedColorThemes(),
                },
            },
            selectionDisplay: {
                mode: selectionDisplayByMode.AlignedTo.mode,
                dimUnselected: selectionDisplayByMode.AlignedTo.dimUnselected,
                dimStrength: selectionDisplayByMode.AlignedTo.dimStrength,
            },
            selectionDisplayByMode: {
                alignedTo: {
                    mode: selectionDisplayByMode.AlignedTo.mode,
                    dimUnselected: selectionDisplayByMode.AlignedTo.dimUnselected,
                    dimStrength: selectionDisplayByMode.AlignedTo.dimStrength,
                },
                aligned: {
                    mode: selectionDisplayByMode.Aligned.mode,
                    dimUnselected: selectionDisplayByMode.Aligned.dimUnselected,
                    dimStrength: selectionDisplayByMode.Aligned.dimStrength,
                },
            },
        } as SessionUiState,
        };
    });


    const handleSaveSessionAll = useSessionSaveAll(
        () => {
            const resolvedRefsA = resolveViewerStructureRefs(viewerA.ref.current, molstarA.structureRefs);
            const resolvedRefsB = resolveViewerStructureRefs(viewerB.ref.current, molstarB.structureRefs);
            return {
                viewerA: {
                moleculeAlignedTo: viewerA.moleculeAlignedTo
                    ? {
                        filename: viewerA.moleculeAlignedTo.filename,
                        alignmentData: viewerA.moleculeAlignedTo.alignmentData,
                        representations: serializeRepresentationsForMode(molstarA, pluginRefA, AlignedTo),
                    }
                    : null,
                moleculeAligned: viewerA.moleculeAligned
                    ? {
                        filename: viewerA.moleculeAligned.filename,
                        alignmentData: viewerA.moleculeAligned.alignmentData,
                        representations: serializeRepresentationsForMode(molstarA, pluginRefA, Aligned),
                    }
                    : null,
            },
            viewerB: {
                moleculeAlignedTo: viewerB.moleculeAlignedTo
                    ? {
                        filename: viewerB.moleculeAlignedTo.filename,
                        alignmentData: viewerB.moleculeAlignedTo.alignmentData,
                        representations: serializeRepresentationsForMode(molstarB, pluginRefB, AlignedTo),
                    }
                    : null,
                moleculeAligned: viewerB.moleculeAligned
                    ? {
                        filename: viewerB.moleculeAligned.filename,
                        alignmentData: viewerB.moleculeAligned.alignmentData,
                        representations: serializeRepresentationsForMode(molstarB, pluginRefB, Aligned),
                    }
                    : null,
            },
                uiState: {
                zoom: {
                        extraRadius: zoomExtraRadiusA,
                        minRadius: zoomMinRadiusA,
                    },
                    zoomByViewer: {
                        viewerA: { extraRadius: zoomExtraRadiusA, minRadius: zoomMinRadiusA },
                        viewerB: { extraRadius: zoomExtraRadiusB, minRadius: zoomMinRadiusB },
                },
                clippingByViewer: {
                    viewerA: { minNear: clippingA.minNear, clipRadius: clippingA.clipRadius },
                    viewerB: { minNear: clippingB.minNear, clipRadius: clippingB.clipRadius },
                },
                selections: {
                    alignedTo: {
                        subunit: selectedSubunitAlignedTo,
                        chainId: selectedChainIdAlignedTo,
                        chainId2: selectedChainIdAlignedTo2,
                        residueId: selectedResidueIdAlignedTo,
                        residueId2: selectedResidueIdAlignedTo2,
                        residueIds: selectedResidueIdsAlignedTo,
                        residueIds2: selectedResidueIdsAlignedTo2,
                    },
                    aligned: {
                        subunit: selectedSubunitAligned,
                        chainId: selectedChainIdAligned,
                        chainId2: selectedChainIdAligned2,
                        residueId: selectedResidueIdAligned,
                        residueId2: selectedResidueIdAligned2,
                        residueIds: selectedResidueIdsAligned,
                        residueIds2: selectedResidueIdsAligned2,
                    },
                },
                highlights: {
                    alignedTo: {
                        chain: chainHighlightOnAlignedTo,
                        residue: residueHighlightOnAlignedTo,
                        subunit: subunitHighlightOnAlignedTo,
                    },
                    aligned: {
                        chain: chainHighlightOnAligned,
                        residue: residueHighlightOnAligned,
                        subunit: subunitHighlightOnAligned,
                    },
                },
                inspectByViewer: {
                    viewerA: {
                        alignedTo: {
                            chain: chainInspectOnAAlignedTo,
                            residue: residueInspectOnAAlignedTo,
                            subunit: subunitInspectOnAAlignedTo,
                        },
                        aligned: {
                            chain: chainInspectOnAAligned,
                            residue: residueInspectOnAAligned,
                            subunit: subunitInspectOnAAligned,
                        },
                    },
                    viewerB: {
                        alignedTo: {
                            chain: chainInspectOnBAlignedTo,
                            residue: residueInspectOnBAlignedTo,
                            subunit: subunitInspectOnBAlignedTo,
                        },
                        aligned: {
                            chain: chainInspectOnBAligned,
                            residue: residueInspectOnBAligned,
                            subunit: subunitInspectOnBAligned,
                        },
                    },
                },
                visibilityByViewer: {
                    viewerA: {
                        alignedTo: viewerA.isMoleculeAlignedToVisible,
                        aligned: viewerA.isMoleculeAlignedVisible,
                    },
                    viewerB: {
                        alignedTo: viewerB.isMoleculeAlignedToVisible,
                        aligned: viewerB.isMoleculeAlignedVisible,
                    },
                },
                fogByViewer: {
                    viewerA: {
                        enabled: fogA.enabled,
                        near: fogA.near,
                        far: fogA.far,
                    },
                    viewerB: {
                        enabled: fogB.enabled,
                        near: fogB.near,
                        far: fogB.far,
                    },
                },
                syncEnabled,
                activeViewer,
                cameraSnapshots: {
                    viewerA: getSerializableCameraSnapshot(viewerA.ref),
                    viewerB: getSerializableCameraSnapshot(viewerB.ref),
                },
                structureTransformsByViewer: {
                    viewerA: {
                        alignedTo: getSerializableStructureTransform(viewerA.ref.current, resolvedRefsA.alignedTo, persistedStructureTransformsByModeRef.current.viewerA.alignedTo),
                        aligned: getSerializableStructureTransform(viewerA.ref.current, resolvedRefsA.aligned, persistedStructureTransformsByModeRef.current.viewerA.aligned),
                    },
                    viewerB: {
                        alignedTo: getSerializableStructureTransform(viewerB.ref.current, resolvedRefsB.alignedTo, persistedStructureTransformsByModeRef.current.viewerB.alignedTo),
                        aligned: getSerializableStructureTransform(viewerB.ref.current, resolvedRefsB.aligned, persistedStructureTransformsByModeRef.current.viewerB.aligned),
                    },
                },
                uniprotGeneNames,
                showUniprotAccessionInChainLabelsByViewer: {
                    viewerA: showUniprotAccessionInChainLabelsA,
                    viewerB: showUniprotAccessionInChainLabelsB,
                },
                chainFinderQueries: {
                    alignedTo: chainFinderQueryAlignedTo,
                    aligned: chainFinderQueryAligned,
                },
                colorThemesByMode: {
                    alignedTo: {
                        selectedThemeName: selectedColorThemeByMode.AlignedTo,
                        selectedChainThemeName: selectedColorThemeByMode.AlignedTo,
                        selectedResidueThemeName: selectedResidueThemeByMode.AlignedTo,
                        themes: buildPersistedColorThemes(),
                    },
                    aligned: {
                        selectedThemeName: selectedColorThemeByMode.Aligned,
                        selectedChainThemeName: selectedColorThemeByMode.Aligned,
                        selectedResidueThemeName: selectedResidueThemeByMode.Aligned,
                        themes: buildPersistedColorThemes(),
                    },
                },
                selectionDisplay: {
                    mode: selectionDisplayByMode.AlignedTo.mode,
                    dimUnselected: selectionDisplayByMode.AlignedTo.dimUnselected,
                    dimStrength: selectionDisplayByMode.AlignedTo.dimStrength,
                },
                selectionDisplayByMode: {
                    alignedTo: {
                        mode: selectionDisplayByMode.AlignedTo.mode,
                        dimUnselected: selectionDisplayByMode.AlignedTo.dimUnselected,
                        dimStrength: selectionDisplayByMode.AlignedTo.dimStrength,
                    },
                    aligned: {
                        mode: selectionDisplayByMode.Aligned.mode,
                        dimUnselected: selectionDisplayByMode.Aligned.dimUnselected,
                        dimStrength: selectionDisplayByMode.Aligned.dimStrength,
                    },
                },
            } as SessionUiState,
            };
        },
        () => {
            const embeddedFiles: Record<string, File | null | undefined> = {};
            if (alignedToFile?.name) embeddedFiles[alignedToFile.name] = alignedToFile;
            if (alignedFile?.name) embeddedFiles[alignedFile.name] = alignedFile;
            return embeddedFiles;
        }
    );

    // Define the session loaded callback with proper typing and error handling
    const onSessionLoaded = useCallback(async (session: any, files: Record<string, File>) => {
        // Map filenames to semantic keys for compatibility
        const getFilename = (obj: any) => obj && typeof obj.filename === 'string' ? obj.filename : undefined;
        const getRepresentations = (obj: any): SessionRepresentationSpec[] => {
            if (!Array.isArray(obj?.representations)) return [];
            return obj.representations
                .map((rep: any) => normalizeSessionRepresentation(rep))
                .filter((rep: SessionRepresentationSpec | null): rep is SessionRepresentationSpec => !!rep);
        };
        const firstNonEmptyRepresentations = (...sources: any[]): SessionRepresentationSpec[] => {
            for (const src of sources) {
                const reps = getRepresentations(src);
                if (reps.length > 0) return reps;
            }
            return [];
        };
        const alignedToFilename = getFilename(session.viewerA?.alignedTo) || getFilename(session.viewerA?.moleculeAlignedTo);
        const alignedFilename = getFilename(session.viewerB?.aligned) || getFilename(session.viewerB?.moleculeAligned);
        // Fallback: try viewerB.alignedTo or viewerA.aligned
        const altAlignedToFilename = getFilename(session.viewerB?.alignedTo) || getFilename(session.viewerB?.moleculeAlignedTo);
        const altAlignedFilename = getFilename(session.viewerA?.aligned) || getFilename(session.viewerA?.moleculeAligned);
        const alignedToRepresentationsA = firstNonEmptyRepresentations(
            session.viewerA?.alignedTo,
            session.viewerA?.moleculeAlignedTo,
            session.viewerB?.alignedTo,
            session.viewerB?.moleculeAlignedTo
        );
        const alignedToRepresentationsB = firstNonEmptyRepresentations(
            session.viewerB?.alignedTo,
            session.viewerB?.moleculeAlignedTo,
            session.viewerA?.alignedTo,
            session.viewerA?.moleculeAlignedTo
        );
        const alignedRepresentationsA = firstNonEmptyRepresentations(
            session.viewerA?.aligned,
            session.viewerA?.moleculeAligned,
            session.viewerB?.aligned,
            session.viewerB?.moleculeAligned
        );
        const alignedRepresentationsB = firstNonEmptyRepresentations(
            session.viewerB?.aligned,
            session.viewerB?.moleculeAligned,
            session.viewerA?.aligned,
            session.viewerA?.moleculeAligned
        );

        // Try to get the files by filename
        const alignedToFile = (alignedToFilename && files[alignedToFilename]) || (altAlignedToFilename && files[altAlignedToFilename]);
        const alignedFile = (alignedFilename && files[alignedFilename]) || (altAlignedFilename && files[altAlignedFilename]);
        let loadedAny = false;
        try {
            if (alignedToFile) {
                const alignedToMolecule = await loadMoleculeIntoViewers(
                    alignedToFile,
                    AlignedTo,
                    undefined,
                    alignedToRepresentationsA,
                    alignedToRepresentationsB
                ) as LoadedMolecule | undefined;
                loadedAny = true;
                if (alignedFile) {
                    const restoredAlignmentData = alignedToMolecule?.alignmentData ?? alignmentDataRef.current;
                    // Defensive runtime check for alignmentData
                    if (!restoredAlignmentData) {
                        alert('AlignedTo alignment data not available after load. Cannot load Aligned file.');
                    } else {
                        await loadMoleculeIntoViewers(
                            alignedFile,
                            Aligned,
                            restoredAlignmentData,
                            alignedRepresentationsA,
                            alignedRepresentationsB
                        );
                    }
                }
            } else if (alignedFile) {
                await loadMoleculeIntoViewers(
                    alignedFile,
                    Aligned,
                    undefined,
                    alignedRepresentationsA,
                    alignedRepresentationsB
                );
                loadedAny = true;
            }
            const uiState = session?.uiState as SessionUiState | undefined;
            if (uiState?.colorThemesByMode) {
                const isValidPersistedTheme = (theme: any): theme is PersistedColorTheme =>
                    typeof theme?.value === 'string'
                    && theme.value.length > 0
                    && typeof theme?.label === 'string'
                    && Array.isArray(theme?.rows);

                const alignedToThemes = (uiState.colorThemesByMode.alignedTo?.themes ?? []).filter(isValidPersistedTheme);
                const alignedThemes = (uiState.colorThemesByMode.aligned?.themes ?? []).filter(isValidPersistedTheme);

                const mergedByValue = new Map<string, PersistedColorTheme>();
                [...alignedToThemes, ...alignedThemes].forEach(theme => {
                    if (!mergedByValue.has(theme.value)) mergedByValue.set(theme.value, theme);
                });

                const mergedThemes = Array.from(mergedByValue.values());
                const options: LoadedColorThemeOption[] = [
                    { value: DEFAULT_COLOR_THEME_NAME, label: DEFAULT_COLOR_THEME_LABEL },
                    ...mergedThemes.map(theme => ({ value: theme.value, label: theme.label })),
                ];

                setLoadedColorThemes(options);

                // Register loaded themes immediately so downstream session-restore
                // theme application can resolve providers deterministically.
                mergedThemes.forEach(theme => {
                    registerLoadedColorTheme(theme.value, theme.rows);
                });

                setLoadedColorThemeRowsByName(prev => {
                    const next = { ...prev };
                    mergedThemes.forEach(theme => {
                        next[theme.value] = theme.rows;
                    });
                    return next;
                });

                const alignedToSelectedChainCandidate = uiState.colorThemesByMode.alignedTo?.selectedChainThemeName
                    ?? uiState.colorThemesByMode.alignedTo?.selectedThemeName;
                const alignedSelectedChainCandidate = uiState.colorThemesByMode.aligned?.selectedChainThemeName
                    ?? uiState.colorThemesByMode.aligned?.selectedThemeName;
                const alignedToSelectedResidueCandidate = uiState.colorThemesByMode.alignedTo?.selectedResidueThemeName;
                const alignedSelectedResidueCandidate = uiState.colorThemesByMode.aligned?.selectedResidueThemeName;

                const restoredAlignedToThemeName = options.some(option => option.value === alignedToSelectedChainCandidate)
                    ? alignedToSelectedChainCandidate!
                    : DEFAULT_COLOR_THEME_NAME;
                const restoredAlignedThemeName = options.some(option => option.value === alignedSelectedChainCandidate)
                    ? alignedSelectedChainCandidate!
                    : DEFAULT_COLOR_THEME_NAME;

                const restoredAlignedToResidueThemeName = options.some(option => option.value === alignedToSelectedResidueCandidate)
                    ? alignedToSelectedResidueCandidate!
                    : DEFAULT_COLOR_THEME_NAME;
                const restoredAlignedResidueThemeName = options.some(option => option.value === alignedSelectedResidueCandidate)
                    ? alignedSelectedResidueCandidate!
                    : DEFAULT_COLOR_THEME_NAME;

                setSelectedColorThemeByMode(prev => ({
                    ...prev,
                    AlignedTo: restoredAlignedToThemeName,
                    Aligned: restoredAlignedThemeName,
                }));
                setSelectedResidueThemeByMode(prev => ({
                    ...prev,
                    AlignedTo: restoredAlignedToResidueThemeName,
                    Aligned: restoredAlignedResidueThemeName,
                }));

                const hasCustomThemes = mergedThemes.length > 0;
                setIsMoleculeAlignedToColoursLoaded(hasCustomThemes);
                setIsMoleculeAlignedColoursLoaded(hasCustomThemes);
            }

            if (uiState?.zoomByViewer?.viewerA || uiState?.zoomByViewer?.viewerB) {
                const zoomA = uiState.zoomByViewer?.viewerA;
                const zoomB = uiState.zoomByViewer?.viewerB;
                if (zoomA && Number.isFinite(zoomA.extraRadius)) setZoomExtraRadiusA(zoomA.extraRadius);
                if (zoomA && Number.isFinite(zoomA.minRadius)) setZoomMinRadiusA(zoomA.minRadius);
                if (zoomB && Number.isFinite(zoomB.extraRadius)) setZoomExtraRadiusB(zoomB.extraRadius);
                if (zoomB && Number.isFinite(zoomB.minRadius)) setZoomMinRadiusB(zoomB.minRadius);
            } else if (uiState?.zoom) {
                if (Number.isFinite(uiState.zoom.extraRadius)) {
                    setZoomExtraRadiusA(uiState.zoom.extraRadius);
                    setZoomExtraRadiusB(uiState.zoom.extraRadius);
                }
                if (Number.isFinite(uiState.zoom.minRadius)) {
                    setZoomMinRadiusA(uiState.zoom.minRadius);
                    setZoomMinRadiusB(uiState.zoom.minRadius);
                }
            }
            const clippingUiA = uiState?.clippingByViewer?.viewerA;
            const clippingUiB = uiState?.clippingByViewer?.viewerB;
            if (clippingUiA && Number.isFinite(clippingUiA.minNear) && Number.isFinite(clippingUiA.clipRadius)) {
                setClippingA({ minNear: clippingUiA.minNear, clipRadius: clippingUiA.clipRadius });
            }
            if (clippingUiB && Number.isFinite(clippingUiB.minNear) && Number.isFinite(clippingUiB.clipRadius)) {
                setClippingB({ minNear: clippingUiB.minNear, clipRadius: clippingUiB.clipRadius });
            }
            if (uiState?.selections?.alignedTo) {
                if (typeof uiState.selections.alignedTo.subunit === 'string') setSelectedSubunitAlignedTo(uiState.selections.alignedTo.subunit as any);
                if (typeof uiState.selections.alignedTo.chainId === 'string') setSelectedChainIdAlignedTo(uiState.selections.alignedTo.chainId);
                if (typeof uiState.selections.alignedTo.chainId2 === 'string') setSelectedChainIdAlignedTo2(uiState.selections.alignedTo.chainId2);
                if (Array.isArray((uiState.selections.alignedTo as any).residueIds)) {
                    setSelectedResidueIdsAlignedTo((uiState.selections.alignedTo as any).residueIds.filter((id: unknown) => typeof id === 'string'));
                } else if (typeof uiState.selections.alignedTo.residueId === 'string') {
                    setSelectedResidueIdAlignedTo(uiState.selections.alignedTo.residueId);
                }
                if (Array.isArray((uiState.selections.alignedTo as any).residueIds2)) {
                    setSelectedResidueIdsAlignedTo2((uiState.selections.alignedTo as any).residueIds2.filter((id: unknown) => typeof id === 'string'));
                } else if (typeof (uiState.selections.alignedTo as any).residueId2 === 'string') {
                    setSelectedResidueIdsAlignedTo2([(uiState.selections.alignedTo as any).residueId2]);
                }
            }
            if (uiState?.selections?.aligned) {
                if (typeof uiState.selections.aligned.subunit === 'string') setSelectedSubunitAligned(uiState.selections.aligned.subunit as any);
                if (typeof uiState.selections.aligned.chainId === 'string') setSelectedChainIdAligned(uiState.selections.aligned.chainId);
                if (typeof uiState.selections.aligned.chainId2 === 'string') setSelectedChainIdAligned2(uiState.selections.aligned.chainId2);
                if (Array.isArray((uiState.selections.aligned as any).residueIds)) {
                    setSelectedResidueIdsAligned((uiState.selections.aligned as any).residueIds.filter((id: unknown) => typeof id === 'string'));
                } else if (typeof uiState.selections.aligned.residueId === 'string') {
                    setSelectedResidueIdAligned(uiState.selections.aligned.residueId);
                }
                if (Array.isArray((uiState.selections.aligned as any).residueIds2)) {
                    setSelectedResidueIdsAligned2((uiState.selections.aligned as any).residueIds2.filter((id: unknown) => typeof id === 'string'));
                } else if (typeof (uiState.selections.aligned as any).residueId2 === 'string') {
                    setSelectedResidueIdsAligned2([(uiState.selections.aligned as any).residueId2]);
                }
            }
            if (uiState?.highlights?.alignedTo) {
                if (typeof uiState.highlights.alignedTo.chain === 'boolean') {
                    setChainHighlightOnAlignedTo(uiState.highlights.alignedTo.chain);
                }
                if (typeof uiState.highlights.alignedTo.residue === 'boolean') {
                    setResidueHighlightOnAlignedTo(uiState.highlights.alignedTo.residue);
                }
                if (typeof uiState.highlights.alignedTo.subunit === 'boolean') {
                    setSubunitHighlightOnAlignedTo(uiState.highlights.alignedTo.subunit);
                }
            }
            if (uiState?.highlights?.aligned) {
                if (typeof uiState.highlights.aligned.chain === 'boolean') {
                    setChainHighlightOnAligned(uiState.highlights.aligned.chain);
                }
                if (typeof uiState.highlights.aligned.residue === 'boolean') {
                    setResidueHighlightOnAligned(uiState.highlights.aligned.residue);
                }
                if (typeof uiState.highlights.aligned.subunit === 'boolean') {
                    setSubunitHighlightOnAligned(uiState.highlights.aligned.subunit);
                }
            }
            if (uiState?.inspectByViewer?.viewerA?.alignedTo) {
                if (typeof uiState.inspectByViewer.viewerA.alignedTo.chain === 'boolean') {
                    setChainInspectOnAAlignedTo(uiState.inspectByViewer.viewerA.alignedTo.chain);
                }
                if (typeof uiState.inspectByViewer.viewerA.alignedTo.residue === 'boolean') {
                    setResidueInspectOnAAlignedTo(uiState.inspectByViewer.viewerA.alignedTo.residue);
                }
                if (typeof uiState.inspectByViewer.viewerA.alignedTo.subunit === 'boolean') {
                    setSubunitInspectOnAAlignedTo(uiState.inspectByViewer.viewerA.alignedTo.subunit);
                }
            }
            if (uiState?.inspectByViewer?.viewerA?.aligned) {
                if (typeof uiState.inspectByViewer.viewerA.aligned.chain === 'boolean') {
                    setChainInspectOnAAligned(uiState.inspectByViewer.viewerA.aligned.chain);
                }
                if (typeof uiState.inspectByViewer.viewerA.aligned.residue === 'boolean') {
                    setResidueInspectOnAAligned(uiState.inspectByViewer.viewerA.aligned.residue);
                }
                if (typeof uiState.inspectByViewer.viewerA.aligned.subunit === 'boolean') {
                    setSubunitInspectOnAAligned(uiState.inspectByViewer.viewerA.aligned.subunit);
                }
            }
            if (uiState?.inspectByViewer?.viewerB?.alignedTo) {
                if (typeof uiState.inspectByViewer.viewerB.alignedTo.chain === 'boolean') {
                    setChainInspectOnBAlignedTo(uiState.inspectByViewer.viewerB.alignedTo.chain);
                }
                if (typeof uiState.inspectByViewer.viewerB.alignedTo.residue === 'boolean') {
                    setResidueInspectOnBAlignedTo(uiState.inspectByViewer.viewerB.alignedTo.residue);
                }
                if (typeof uiState.inspectByViewer.viewerB.alignedTo.subunit === 'boolean') {
                    setSubunitInspectOnBAlignedTo(uiState.inspectByViewer.viewerB.alignedTo.subunit);
                }
            }
            if (uiState?.inspectByViewer?.viewerB?.aligned) {
                if (typeof uiState.inspectByViewer.viewerB.aligned.chain === 'boolean') {
                    setChainInspectOnBAligned(uiState.inspectByViewer.viewerB.aligned.chain);
                }
                if (typeof uiState.inspectByViewer.viewerB.aligned.residue === 'boolean') {
                    setResidueInspectOnBAligned(uiState.inspectByViewer.viewerB.aligned.residue);
                }
                if (typeof uiState.inspectByViewer.viewerB.aligned.subunit === 'boolean') {
                    setSubunitInspectOnBAligned(uiState.inspectByViewer.viewerB.aligned.subunit);
                }
            }
            if (uiState?.fogByViewer?.viewerA) {
                const fogUiA = uiState.fogByViewer.viewerA;
                if (typeof fogUiA.enabled === 'boolean' && Number.isFinite(fogUiA.near) && Number.isFinite(fogUiA.far)) {
                    setFogA({ enabled: fogUiA.enabled, near: fogUiA.near, far: fogUiA.far });
                }
            }
            if (uiState?.fogByViewer?.viewerB) {
                const fogUiB = uiState.fogByViewer.viewerB;
                if (typeof fogUiB.enabled === 'boolean' && Number.isFinite(fogUiB.near) && Number.isFinite(fogUiB.far)) {
                    setFogB({ enabled: fogUiB.enabled, near: fogUiB.near, far: fogUiB.far });
                }
            }

            const restoreDatasetVisibilityForViewer = async (
                plugin: PluginUIContext | null,
                refs: { alignedTo: string | null; aligned: string | null },
                persisted: SessionUiState['visibilityByViewer'] extends infer T
                    ? T extends { viewerA?: infer V }
                        ? V | undefined
                        : never
                    : never,
                setAlignedToVisible: React.Dispatch<React.SetStateAction<boolean>>,
                setAlignedVisible: React.Dispatch<React.SetStateAction<boolean>>
            ) => {
                if (!plugin || !persisted) return;
                if (typeof persisted.alignedTo === 'boolean') {
                    await setObjectVisibleByRef(plugin, refs.alignedTo, persisted.alignedTo);
                    setAlignedToVisible(persisted.alignedTo);
                }
                if (typeof persisted.aligned === 'boolean') {
                    await setObjectVisibleByRef(plugin, refs.aligned, persisted.aligned);
                    setAlignedVisible(persisted.aligned);
                }
            };

            const restoredRefsA = resolveViewerStructureRefs(viewerA.ref.current, molstarA.structureRefs);
            const restoredRefsB = resolveViewerStructureRefs(viewerB.ref.current, molstarB.structureRefs);

            await restoreDatasetVisibilityForViewer(
                viewerA.ref.current,
                { alignedTo: restoredRefsA.alignedTo, aligned: restoredRefsA.aligned },
                uiState?.visibilityByViewer?.viewerA,
                viewerA.setIsMoleculeAlignedToVisible,
                viewerA.setIsMoleculeAlignedVisible
            );
            await restoreDatasetVisibilityForViewer(
                viewerB.ref.current,
                { alignedTo: restoredRefsB.alignedTo, aligned: restoredRefsB.aligned },
                uiState?.visibilityByViewer?.viewerB,
                viewerB.setIsMoleculeAlignedToVisible,
                viewerB.setIsMoleculeAlignedVisible
            );

            await applySerializableStructureTransform(
                viewerA.ref.current,
                restoredRefsA.alignedTo,
                uiState?.structureTransformsByViewer?.viewerA?.alignedTo
            );
            await applySerializableStructureTransform(
                viewerA.ref.current,
                restoredRefsA.aligned,
                uiState?.structureTransformsByViewer?.viewerA?.aligned
            );
            await applySerializableStructureTransform(
                viewerB.ref.current,
                restoredRefsB.alignedTo,
                uiState?.structureTransformsByViewer?.viewerB?.alignedTo
            );
            await applySerializableStructureTransform(
                viewerB.ref.current,
                restoredRefsB.aligned,
                uiState?.structureTransformsByViewer?.viewerB?.aligned
            );

            // Restore per-viewer camera snapshots with sync propagation suspended so
            // one viewer snapshot cannot overwrite the other while state settles.
            const shouldReEnableSyncAfterRestore = uiState?.syncEnabled === true;
            setIsRestoringSessionCameras(true);
            setSyncEnabled(false);
            await new Promise(resolve => setTimeout(resolve, 0));

            if (uiState?.activeViewer === A || uiState?.activeViewer === B) {
                setActiveViewer(uiState.activeViewer);
            }
            if (uiState?.cameraSnapshots) {
                applySerializableCameraSnapshot(viewerA.ref, uiState.cameraSnapshots.viewerA);
                applySerializableCameraSnapshot(viewerB.ref, uiState.cameraSnapshots.viewerB);
            }

            await new Promise(resolve => setTimeout(resolve, 0));
            setIsRestoringSessionCameras(false);
            setSyncEnabled(shouldReEnableSyncAfterRestore);

            pendingSessionSelectionsRef.current = uiState?.selections ?? null;
            if (uiState?.uniprotGeneNames && typeof uiState.uniprotGeneNames === 'object') {
                const resolvedOnly = filterResolvedGeneNames(uiState.uniprotGeneNames);
                setUniprotGeneNames(prev => ({ ...prev, ...resolvedOnly }));
            }
            if (typeof uiState?.showUniprotAccessionInChainLabels === 'boolean') {
                setShowUniprotAccessionInChainLabelsA(uiState.showUniprotAccessionInChainLabels);
                setShowUniprotAccessionInChainLabelsB(uiState.showUniprotAccessionInChainLabels);
            }
            if (typeof uiState?.showUniprotAccessionInChainLabelsByViewer?.viewerA === 'boolean') {
                setShowUniprotAccessionInChainLabelsA(uiState.showUniprotAccessionInChainLabelsByViewer.viewerA);
            }
            if (typeof uiState?.showUniprotAccessionInChainLabelsByViewer?.viewerB === 'boolean') {
                setShowUniprotAccessionInChainLabelsB(uiState.showUniprotAccessionInChainLabelsByViewer.viewerB);
            }
            if (typeof uiState?.chainFinderQueries?.alignedTo === 'string') {
                setChainFinderQueryAlignedTo(uiState.chainFinderQueries.alignedTo);
            }
            if (typeof uiState?.chainFinderQueries?.aligned === 'string') {
                setChainFinderQueryAligned(uiState.chainFinderQueries.aligned);
            }
            if (uiState?.selectionDisplayByMode) {
                const modeToStateKey: Array<[keyof NonNullable<SessionUiState['selectionDisplayByMode']>, ColorThemeMode]> = [
                    ['alignedTo', 'AlignedTo'],
                    ['aligned', 'Aligned'],
                ];
                for (const [sessionKey, modeKey] of modeToStateKey) {
                    const persisted = uiState.selectionDisplayByMode?.[sessionKey];
                    if (!persisted) continue;
                    if (persisted.mode === 'halo' || persisted.mode === 'overlay' || persisted.mode === 'hybrid') {
                        setSelectionDisplayModeFor(modeKey, persisted.mode);
                    }
                    if (typeof persisted.dimUnselected === 'boolean') {
                        setDimUnselectedFor(modeKey, persisted.dimUnselected);
                    }
                    if (Number.isFinite(persisted.dimStrength)) {
                        setDimUnselectedStrengthFor(modeKey, Number(persisted.dimStrength));
                    }
                }
            } else if (uiState?.selectionDisplay) {
                const mode = uiState.selectionDisplay.mode;
                if (mode === 'halo' || mode === 'overlay' || mode === 'hybrid') {
                    setSelectionDisplayModeFor('AlignedTo', mode);
                    setSelectionDisplayModeFor('Aligned', mode);
                }
                if (typeof uiState.selectionDisplay.dimUnselected === 'boolean') {
                    setDimUnselectedFor('AlignedTo', uiState.selectionDisplay.dimUnselected);
                    setDimUnselectedFor('Aligned', uiState.selectionDisplay.dimUnselected);
                }
                if (Number.isFinite(uiState.selectionDisplay.dimStrength)) {
                    const clamped = Math.max(0, Math.min(1, Number(uiState.selectionDisplay.dimStrength)));
                    setDimUnselectedStrengthFor('AlignedTo', clamped);
                    setDimUnselectedStrengthFor('Aligned', clamped);
                }
            }

            if (!loadedAny) {
                alert('Session loaded, but could not automatically reload datasets. Please reload the required files manually.');
            }
        } catch (e) {
            alert('Error loading session: ' + (e instanceof Error ? e.message : String(e)));
        }
    }, [
        loadMoleculeIntoViewers,
        normalizeSessionRepresentation,
        applySerializableCameraSnapshot,
        applySerializableStructureTransform,
        setSelectedSubunitAlignedTo,
        setSelectedSubunitAligned,
        setSelectedChainIdAlignedTo,
        setSelectedChainIdAlignedTo2,
        setSelectedChainIdAligned,
        setSelectedChainIdAligned2,
        setSelectedResidueIdsAlignedTo,
        setSelectedResidueIdsAlignedTo2,
        setSelectedResidueIdsAligned,
        setSelectedResidueIdsAligned2,
        setSelectedResidueIdAlignedTo,
        setSelectedResidueIdAligned,
        setChainHighlightOnAlignedTo,
        setChainHighlightOnAligned,
        setChainInspectOnAAlignedTo,
        setChainInspectOnAAligned,
        setChainInspectOnBAlignedTo,
        setChainInspectOnBAligned,
        setResidueHighlightOnAlignedTo,
        setResidueHighlightOnAligned,
        setResidueInspectOnAAlignedTo,
        setResidueInspectOnAAligned,
        setResidueInspectOnBAlignedTo,
        setResidueInspectOnBAligned,
        setSubunitHighlightOnAlignedTo,
        setSubunitHighlightOnAligned,
        setSubunitInspectOnAAlignedTo,
        setSubunitInspectOnAAligned,
        setSubunitInspectOnBAlignedTo,
        setSubunitInspectOnBAligned,
        setFogA,
        setFogB,
        setClippingA,
        setClippingB,
        setObjectVisibleByRef,
        setChainFinderQueryAlignedTo,
        setChainFinderQueryAligned,
        setUniprotGeneNames,
        setShowUniprotAccessionInChainLabelsA,
        setShowUniprotAccessionInChainLabelsB,
        setSelectionDisplayModeFor,
        setDimUnselectedFor,
        setDimUnselectedStrengthFor,
    ]);

    // Initialize session load modal with the callback
    const { handleLoadSession, handleLoadAllSession, SessionLoadModal } = useSessionLoadModal(onSessionLoaded);

    // Return the main app component.
    return (
        <ViewerStateProvider>
            <SelectionProvider>
                <SyncProvider>
                <div className="App">
                    <AppHeader />
                    {SessionLoadModal}
                    <GeneralControls
                        viewerA={viewerA.ref.current}
                        viewerB={viewerB.ref.current}
                        activeViewer={activeViewer}
                        syncEnabled={syncEnabled}
                        syncSuspend={isRestoringSessionCameras}
                        setSyncEnabled={setSyncEnabled}
                        syncDisabled={!viewerA.isMoleculeAlignedLoaded || !viewerB.isMoleculeAlignedLoaded}
                        sessionMenu={(
                            <div className="session-menu-container" style={{ position: 'relative' }}>
                                <button
                                    className="session-menu-btn"
                                    id="session-menu-btn"
                                    onClick={e => {
                                        const menu = document.getElementById('session-menu-dropdown');
                                        if (menu) {
                                            const willOpen = menu.style.display !== 'block';
                                            menu.style.display = willOpen ? 'block' : 'none';
                                            console.log(`[SessionMenu] Menu ${willOpen ? 'opened' : 'closed'} by button click`);
                                        }
                                    }}
                                    onBlur={e => {
                                        if (process.env.NODE_ENV !== 'test') {
                                            setTimeout(() => {
                                                const menu = document.getElementById('session-menu-dropdown');
                                                if (menu) {
                                                    menu.style.display = 'none';
                                                    console.log('[SessionMenu] Menu closed by blur');
                                                }
                                            }, 150);
                                        }
                                    }}
                                >
                                    Session ▾
                                </button>
                                <div
                                    id="session-menu-dropdown"
                                    className="session-menu-dropdown"
                                    style={{ display: 'none', position: 'absolute', background: '#fff', border: '1px solid #ccc', borderRadius: 4, minWidth: 120, zIndex: 1000 }}
                                >
                                    <div
                                        className="session-menu-item session-menu-item-border"
                                        onClick={() => {
                                            handleSaveSession();
                                            document.getElementById('session-menu-dropdown')!.style.display = 'none';
                                        }}
                                        tabIndex={0}
                                        onKeyDown={e => { if (e.key === 'Enter') handleSaveSession(); }}
                                        style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                    >
                                        Save
                                    </div>
                                    <div
                                        className="session-menu-item session-menu-item-border"
                                        onClick={() => {
                                            void handleSaveSessionAll();
                                            document.getElementById('session-menu-dropdown')!.style.display = 'none';
                                        }}
                                        tabIndex={0}
                                        onKeyDown={e => { if (e.key === 'Enter') void handleSaveSessionAll(); }}
                                        style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                    >
                                        Save All
                                    </div>
                                    <div
                                        className="session-menu-item session-menu-item-border"
                                        onClick={() => {
                                            console.log('[SessionMenu] Load menu item clicked');
                                            if (confirm('Loading a session will unload all current data and replace the session. Please save your work first if needed. Continue?')) {
                                                console.log('[SessionMenu] Triggering file input for session load');
                                                document.getElementById('session-menu-file-input')?.click();
                                            }
                                            setTimeout(() => {
                                                const dropdown = document.getElementById('session-menu-dropdown');
                                                if (dropdown) dropdown.style.display = 'none';
                                            }, 0);
                                        }}
                                        tabIndex={0}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                console.log('[SessionMenu] Load menu item activated by Enter key');
                                                if (confirm('Loading a session will unload all current data and replace the session. Please save your work first if needed. Continue?')) {
                                                    console.log('[SessionMenu] Triggering file input for session load (Enter)');
                                                    document.getElementById('session-menu-file-input')?.click();
                                                }
                                                setTimeout(() => {
                                                    const dropdown = document.getElementById('session-menu-dropdown');
                                                    if (dropdown) dropdown.style.display = 'none';
                                                }, 0);
                                            }
                                        }}
                                        style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                    >
                                        Load
                                    </div>
                                    <div
                                        className="session-menu-item session-menu-item-border"
                                        onClick={() => {
                                            console.log('[SessionMenu] Load All menu item clicked');
                                            if (confirm('Loading a session will unload all current data and replace the session. Please save your work first if needed. Continue?')) {
                                                console.log('[SessionMenu] Triggering file input for session load all');
                                                document.getElementById('session-menu-file-input-all')?.click();
                                            }
                                            setTimeout(() => {
                                                const dropdown = document.getElementById('session-menu-dropdown');
                                                if (dropdown) dropdown.style.display = 'none';
                                            }, 0);
                                        }}
                                        tabIndex={0}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                console.log('[SessionMenu] Load All menu item activated by Enter key');
                                                if (confirm('Loading a session will unload all current data and replace the session. Please save your work first if needed. Continue?')) {
                                                    console.log('[SessionMenu] Triggering file input for session load all (Enter)');
                                                    document.getElementById('session-menu-file-input-all')?.click();
                                                }
                                                setTimeout(() => {
                                                    const dropdown = document.getElementById('session-menu-dropdown');
                                                    if (dropdown) dropdown.style.display = 'none';
                                                }, 0);
                                            }
                                        }}
                                        style={{ padding: '8px 16px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                    >
                                        Load All
                                    </div>
                                    <div
                                        className="session-menu-item"
                                        onClick={() => {
                                            if (confirm('Troubleshooting reset: this will clear local Ribocode browser cache/storage and reload the page. Use this before filing a bug to check if the issue persists. Continue?')) {
                                                void hardResetLocalCachesAndReload();
                                            } else {
                                                const dropdown = document.getElementById('session-menu-dropdown');
                                                if (dropdown) dropdown.style.display = 'none';
                                            }
                                        }}
                                        tabIndex={0}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                if (confirm('Troubleshooting reset: this will clear local Ribocode browser cache/storage and reload the page. Use this before filing a bug to check if the issue persists. Continue?')) {
                                                    void hardResetLocalCachesAndReload();
                                                } else {
                                                    document.getElementById('session-menu-dropdown')!.style.display = 'none';
                                                }
                                            }
                                        }}
                                        style={{
                                            padding: '8px 16px',
                                            cursor: 'pointer',
                                            borderTop: '1px solid #eee',
                                            borderBottom: '1px solid #eee'
                                        }}
                                    >
                                        Reset Local Caches
                                    </div>
                                    <div
                                        className="session-menu-item"
                                        onClick={() => {
                                            if (confirm('Restarting will unload all data and reset the session. Please save your work first if needed. Continue?')) {
                                                window.location.reload();
                                            } else {
                                                const dropdown = document.getElementById('session-menu-dropdown');
                                                if (dropdown) dropdown.style.display = 'none';
                                            }
                                        }}
                                        tabIndex={0}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                if (confirm('Restarting will unload all data and reset the session. Please save your work first if needed. Continue?')) {
                                                    window.location.reload();
                                                } else {
                                                    document.getElementById('session-menu-dropdown')!.style.display = 'none';
                                                }
                                            }
                                        }}
                                        style={{ padding: '8px 16px', cursor: 'pointer' }}
                                    >
                                        Restart
                                    </div>
                                </div>
                                <input
                                    id="session-menu-file-input"
                                    type="file"
                                    accept="application/json"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        console.log('[SessionMenu] File input changed (session load)');
                                        handleLoadSession(e);
                                    }}
                                />
                                <input
                                    id="session-menu-file-input-all"
                                    type="file"
                                    accept="application/json"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        console.log('[SessionMenu] File input changed (session load all)');
                                        handleLoadAllSession(e);
                                    }}
                                />
                            </div>
                        )}
                        selectedChainIdAlignedTo={selectedChainIdAlignedTo}
                        selectedChainIdAligned={selectedChainIdAligned}
                        chainRealignSummary={chainRealignSummary}
                        realignmentExists={realignmentExists}
                        handleRealignToChains={handleRealignToChains}
                        canRealignToResidues={canRealignToResidues}
                        residueRealignmentExists={residueRealignmentExists}
                        residueRealignSummary={`${selectedResidueIdsAlignedTo.length + selectedResidueIdsAlignedTo2.length} to ${selectedResidueIdsAligned.length + selectedResidueIdsAligned2.length}`}
                        handleRealignToResidues={handleRealignToResidues}
                        selectedSubunitAlignedTo={selectedSubunitAlignedTo}
                        selectedSubunitAligned={selectedSubunitAligned}
                        subunitRealignmentExists={subunitRealignmentExists}
                        canRealignToSubunits={canRealignToSubunits}
                        handleRealignToSubunits={handleRealignToSubunits}
                    />
                    <TwoColumnsContainer
                        idPrefix="main-two-columns"
                        left={
                            <ViewerColumn
                                viewerKey={A}
                                loadDataRowPropsAlignedTo={getLoadDataRowProps({
                                    viewer: viewerA,
                                    otherViewer: viewerB,
                                    molstar: molstarA,
                                    otherMolstar: molstarB,
                                    realignedStructRefs: realignedStructRefsA,
                                    otherRealignedStructRefs: realignedStructRefsB,
                                    isMoleculeAlignedLoaded: viewerA.isMoleculeAlignedLoaded,
                                    isMoleculeAlignedToLoaded: viewerA.isMoleculeAlignedToLoaded,
                                    viewerReady: viewerAReady,
                                    otherViewerReady: viewerBReady,
                                    representationType: representationTypeAlignedTo,
                                    setRepresentationType: setRepresentationTypeAlignedTo,
                                    colorsFile: chainColorsAlignedToFile,
                                    chainColorsFile: chainColorsAlignedToFile,
                                    residueColorsFile: residueColorsAlignedToFile,
                                    isMoleculeColoursLoaded: isMoleculeAlignedToColoursLoaded,
                                    colorMode: colorModeByMode.AlignedTo,
                                    onColorModeChange: (mode: RepresentationColorMode) => setColorModeByMode(prev => ({ ...prev, AlignedTo: mode })),
                                    residueTypeColorsById: residueTypeColorsByMode.AlignedTo,
                                    residueTypeCounts: residueTypeCountsByMode.AlignedTo,
                                    onResidueTypeColorChange: (residueType: string, color: string) => updateResidueTypeColorInTheme(selectedResidueThemeByMode.AlignedTo, residueType, color, 'AlignedTo'),
                                    onSaveColorTheme: () => handleSaveColorThemeForMode('AlignedTo'),
                                    saveColorThemeDisabled: !selectedChainIdAlignedTo,
                                    colorThemeOptions: chainThemeOptions,
                                    selectedColorThemeName: selectedColorThemeByMode.AlignedTo,
                                    setSelectedColorThemeName: (themeName: string) => handleSelectThemeForMode('AlignedTo', 'chain', themeName),
                                    onRemoveColorTheme: () => handleRemoveSelectedColorTheme('AlignedTo', 'chain'),
                                    removeColorThemeDisabled: selectedColorThemeByMode.AlignedTo === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedColorThemeByMode.AlignedTo),
                                    chainThemeOptions,
                                    selectedChainThemeName: selectedColorThemeByMode.AlignedTo,
                                    setSelectedChainThemeName: (themeName: string) => handleSelectThemeForMode('AlignedTo', 'chain', themeName),
                                    onSaveChainTheme: () => handleSaveColorThemeForMode('AlignedTo'),
                                    saveChainThemeDisabled: false,
                                    onRemoveChainTheme: () => handleRemoveSelectedColorTheme('AlignedTo', 'chain'),
                                    removeChainThemeDisabled: selectedColorThemeByMode.AlignedTo === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedColorThemeByMode.AlignedTo),
                                    residueThemeOptions,
                                    selectedResidueThemeName: selectedResidueThemeByMode.AlignedTo,
                                    setSelectedResidueThemeName: (themeName: string) => handleSelectThemeForMode('AlignedTo', 'residue-type', themeName),
                                    onSaveResidueTheme: () => handleSaveResidueThemeForMode('AlignedTo'),
                                    saveResidueThemeDisabled: selectedResidueThemeByMode.AlignedTo === DEFAULT_COLOR_THEME_NAME && residueTypeColorsByMode.AlignedTo.size === 0,
                                    onRemoveResidueTheme: () => handleRemoveSelectedColorTheme('AlignedTo', 'residue-type'),
                                    removeResidueThemeDisabled: selectedResidueThemeByMode.AlignedTo === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedResidueThemeByMode.AlignedTo),
                                    structureRef: structureRefAAlignedTo,
                                    otherStructureRef: structureRefBAlignedTo,
                                    selectedSubunit: selectedSubunitAlignedTo,
                                    setSelectedSubunit: setSelectedSubunitAlignedTo,
                                    subunitZoomLabel: selectedSubunitAlignedTo,
                                    onSubunitHighlight: subunitHighlightAAlignedTo.handleButtonClick,
                                    subunitHighlightOn: viewerA.isMoleculeAlignedToVisible ? subunitHighlightOnAlignedTo : false,
                                    subunitHighlightDisabled: !viewerA.isMoleculeAlignedToVisible || (selectedSubunitChainIdsAlignedTo.length === 0 && !subunitHighlightOnAlignedTo),
                                    onSubunitInspect: subunitInspectAAlignedTo.handleButtonClick,
                                    subunitInspectOn: viewerA.isMoleculeAlignedToVisible ? subunitInspectOnAAlignedTo : false,
                                    subunitInspectDisabled: !viewerA.isMoleculeAlignedToVisible || (selectedSubunitChainIdsAlignedTo.length === 0 && !subunitInspectOnAAlignedTo),
                                    onSubunitZoom: subunitZoomAAlignedTo.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAlignedTo.length === 0,
                                    subunitToChainIds: subunitToChainIdsAlignedTo,
                                    chainInfo: chainInfoAlignedTo,
                                    chainColorsById: chainColorsByMode.AlignedTo,
                                    onChainColorChange: (chainId: string, color: string) => updateChainColorInTheme(getCurrentColorThemeNameForMode('AlignedTo'), chainId, color),
                                    selectedChainId: selectedChainIdAlignedTo,
                                    setSelectedChainId: handleSelectChainIdAlignedTo,
                                    selectedChainId2: selectedChainIdAlignedTo2,
                                    setSelectedChainId2: handleSelectChainIdAlignedTo2,
                                    clearSelectedChainId2: handleClearChainIdAlignedTo2,
                                    chainZoomLabel: selectedChainIdAlignedTo && chainInfoAlignedTo.chainLabels.has(selectedChainIdAlignedTo)
                                        ? chainInfoAlignedTo.chainLabels.get(selectedChainIdAlignedTo) ?? ''
                                        : '',
                                    chainZoomLabel2: selectedChainIdAlignedTo2 && chainInfoAlignedTo.chainLabels.has(selectedChainIdAlignedTo2)
                                        ? chainInfoAlignedTo.chainLabels.get(selectedChainIdAlignedTo2) ?? ''
                                        : '',
                                    onChainHighlight: residueHighlightAAlignedTo.handleButtonClick,
                                    chainHighlightOn: viewerA.isMoleculeAlignedToVisible ? residueHighlightOnAlignedTo : false,
                                    chainHighlightDisabled: !viewerA.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo.length === 0 && !residueHighlightOnAlignedTo),
                                    onChainInspect: residueInspectAAlignedTo.handleButtonClick,
                                    chainInspectOn: viewerA.isMoleculeAlignedToVisible ? residueInspectOnAAlignedTo : false,
                                    chainInspectDisabled: !viewerA.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo.length === 0 && !residueInspectOnAAlignedTo),
                                    onChainHighlight2: residueHighlightAAlignedTo2.handleButtonClick,
                                    chainHighlightOn2: viewerA.isMoleculeAlignedToVisible ? residueHighlightOnAlignedTo : false,
                                    chainHighlightDisabled2: !viewerA.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo2.length === 0 && !residueHighlightOnAlignedTo),
                                    onChainInspect2: residueInspectAAlignedTo2.handleButtonClick,
                                    chainInspectOn2: viewerA.isMoleculeAlignedToVisible ? residueInspectOnAAlignedTo : false,
                                    chainInspectDisabled2: !viewerA.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo2.length === 0 && !residueInspectOnAAlignedTo),
                                    onChainZoom: residueZoomAAlignedTo.handleButtonClick,
                                    onChainZoom2: residueZoomAAlignedTo2.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAlignedTo,
                                    chainZoomDisabled2: residueZoomDisabledAlignedTo2,
                                    onCombinedSelectionZoom: combinedSelectionZoomAAlignedTo.handleButtonClick,
                                    combinedSelectionZoomDisabled: !hasCombinedResiduesAlignedTo,
                                    onCombinedSelectionHighlight: combinedSelectionHighlightAAlignedTo.handleButtonClick,
                                    combinedSelectionHighlightOn: viewerA.isMoleculeAlignedToVisible ? residueHighlightOnAlignedTo : false,
                                    combinedSelectionHighlightDisabled: !viewerA.isMoleculeAlignedToVisible || (!hasCombinedResiduesAlignedTo && !residueHighlightOnAlignedTo),
                                    onCombinedSelectionInspect: combinedSelectionInspectAAlignedTo.handleButtonClick,
                                    combinedSelectionInspectOn: viewerA.isMoleculeAlignedToVisible ? residueInspectOnAAlignedTo : false,
                                    combinedSelectionInspectDisabled: !viewerA.isMoleculeAlignedToVisible || (!hasCombinedResiduesAlignedTo && !residueInspectOnAAlignedTo),
                                    showUniprotAccessionInChainLabels: showUniprotAccessionInChainLabelsA,
                                    setShowUniprotAccessionInChainLabels: setShowUniprotAccessionInChainLabelsA,
                                    uniprotLookupStatus: {
                                        completed: completedUniProtCount,
                                        pending: pendingUniProtCount,
                                        inFlight: inFlightUniProtCount,
                                    },
                                    residueInfo: residueInfoAlignedTo,
                                    residueCommonIds: commonResidueIdsAcrossSelectedChains,
                                    selectedResidueIds: selectedResidueIdsAlignedTo,
                                    setSelectedResidueIds: setSelectedResidueIdsAlignedTo,
                                    residueInfo2: residueInfoAlignedTo2,
                                    residueCommonIds2: commonResidueIdsAcrossSelectedChains2,
                                    selectedResidueIds2: selectedResidueIdsAlignedTo2,
                                    setSelectedResidueIds2: setSelectedResidueIdsAlignedTo2,
                                    residueZoomLabel: residueZoomLabelAlignedTo,
                                    residueZoomLabel2: residueZoomLabelAlignedTo2,
                                    onResidueHighlight: residueHighlightAAlignedTo.handleButtonClick,
                                    residueHighlightOn: viewerA.isMoleculeAlignedToVisible ? residueHighlightOnAlignedTo : false,
                                    residueHighlightDisabled: !viewerA.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo.length === 0 && !residueHighlightOnAlignedTo),
                                    onResidueInspect: residueInspectAAlignedTo.handleButtonClick,
                                    residueInspectOn: viewerA.isMoleculeAlignedToVisible ? residueInspectOnAAlignedTo : false,
                                    residueInspectDisabled: !viewerA.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo.length === 0 && !residueInspectOnAAlignedTo),
                                    onResidueHighlight2: residueHighlightAAlignedTo2.handleButtonClick,
                                    residueHighlightOn2: viewerA.isMoleculeAlignedToVisible ? residueHighlightOnAlignedTo : false,
                                    residueHighlightDisabled2: !viewerA.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo2.length === 0 && !residueHighlightOnAlignedTo),
                                    onResidueInspect2: residueInspectAAlignedTo2.handleButtonClick,
                                    residueInspectOn2: viewerA.isMoleculeAlignedToVisible ? residueInspectOnAAlignedTo : false,
                                    residueInspectDisabled2: !viewerA.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo2.length === 0 && !residueInspectOnAAlignedTo),
                                    onResidueZoom: residueZoomAAlignedTo.handleButtonClick,
                                    onResidueZoom2: residueZoomAAlignedTo2.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAlignedTo,
                                    residueZoomDisabled2: residueZoomDisabledAlignedTo2,
                                    zoomExtraRadius: zoomExtraRadiusA,
                                    setZoomExtraRadius: setZoomExtraRadiusA,
                                    zoomMinRadius: zoomMinRadiusA,
                                    setZoomMinRadius: setZoomMinRadiusA,
                                    selectionDisplayMode: selectionDisplayByMode.AlignedTo.mode,
                                    setSelectionDisplayMode: (mode: HighlightDisplayMode) => setSelectionDisplayModeFor('AlignedTo', mode),
                                    dimUnselected: selectionDisplayByMode.AlignedTo.dimUnselected,
                                    setDimUnselected: (value: boolean) => setDimUnselectedFor('AlignedTo', value),
                                    dimUnselectedStrength: selectionDisplayByMode.AlignedTo.dimStrength,
                                    setDimUnselectedStrength: (value: number) => setDimUnselectedStrengthFor('AlignedTo', value),
                                    fog: fogA,
                                    setFog: makeFogSetters(setFogA),
                                    clipping: clippingA,
                                    clippingDefaults: clippingDefaultsA,
                                    setClipping: makeClippingSetters(setClippingA),
                                    updateFog,
                                    handleFileChange,
                                    Aligned: AlignedTo,
                                    allowedRepresentationTypes,
                                    syncEnabled,
                                    realignedRepRefs: realignedRepRefsA,
                                    setRealignedRepRefs: setRealignedRepRefsA,
                                    setRealignedStructRefs: setRealignedStructRefsA,
                                    fileInputLabel: 'Load AlignedTo',
                                    fileInputDisabled: false,
                                })}
                                loadDataRowPropsAligned={getLoadDataRowProps({
                                    viewer: viewerA,
                                    otherViewer: viewerB,
                                    molstar: molstarA,
                                    otherMolstar: molstarB,
                                    realignedStructRefs: realignedStructRefsA,
                                    otherRealignedStructRefs: realignedStructRefsB,
                                    isMoleculeAlignedLoaded: viewerA.isMoleculeAlignedLoaded,
                                    isMoleculeAlignedToLoaded: viewerA.isMoleculeAlignedToLoaded,
                                    viewerReady: viewerAReady,
                                    otherViewerReady: viewerBReady,
                                    representationType: representationTypeAligned,
                                    setRepresentationType: setRepresentationTypeAligned,
                                    colorsFile: chainColorsAlignedFile,
                                    chainColorsFile: chainColorsAlignedFile,
                                    residueColorsFile: residueColorsAlignedFile,
                                    isMoleculeColoursLoaded: isMoleculeAlignedColoursLoaded,
                                    colorMode: colorModeByMode.Aligned,
                                    onColorModeChange: (mode: RepresentationColorMode) => setColorModeByMode(prev => ({ ...prev, Aligned: mode })),
                                    residueTypeColorsById: residueTypeColorsByMode.Aligned,
                                    residueTypeCounts: residueTypeCountsByMode.Aligned,
                                    onResidueTypeColorChange: (residueType: string, color: string) => updateResidueTypeColorInTheme(selectedResidueThemeByMode.Aligned, residueType, color, 'Aligned'),
                                    onSaveColorTheme: () => handleSaveColorThemeForMode('Aligned'),
                                    saveColorThemeDisabled: !selectedChainIdAligned,
                                    colorThemeOptions: chainThemeOptions,
                                    selectedColorThemeName: selectedColorThemeByMode.Aligned,
                                    setSelectedColorThemeName: (themeName: string) => handleSelectThemeForMode('Aligned', 'chain', themeName),
                                    onRemoveColorTheme: () => handleRemoveSelectedColorTheme('Aligned', 'chain'),
                                    removeColorThemeDisabled: selectedColorThemeByMode.Aligned === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedColorThemeByMode.Aligned),
                                    chainThemeOptions,
                                    selectedChainThemeName: selectedColorThemeByMode.Aligned,
                                    setSelectedChainThemeName: (themeName: string) => handleSelectThemeForMode('Aligned', 'chain', themeName),
                                    onSaveChainTheme: () => handleSaveColorThemeForMode('Aligned'),
                                    saveChainThemeDisabled: false,
                                    onRemoveChainTheme: () => handleRemoveSelectedColorTheme('Aligned', 'chain'),
                                    removeChainThemeDisabled: selectedColorThemeByMode.Aligned === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedColorThemeByMode.Aligned),
                                    residueThemeOptions,
                                    selectedResidueThemeName: selectedResidueThemeByMode.Aligned,
                                    setSelectedResidueThemeName: (themeName: string) => handleSelectThemeForMode('Aligned', 'residue-type', themeName),
                                    onSaveResidueTheme: () => handleSaveResidueThemeForMode('Aligned'),
                                    saveResidueThemeDisabled: selectedResidueThemeByMode.Aligned === DEFAULT_COLOR_THEME_NAME && residueTypeColorsByMode.Aligned.size === 0,
                                    onRemoveResidueTheme: () => handleRemoveSelectedColorTheme('Aligned', 'residue-type'),
                                    removeResidueThemeDisabled: selectedResidueThemeByMode.Aligned === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedResidueThemeByMode.Aligned),
                                    structureRef: structureRefAAligned,
                                    otherStructureRef: structureRefBAligned,
                                    selectedSubunit: selectedSubunitAligned,
                                    setSelectedSubunit: setSelectedSubunitAligned,
                                    subunitZoomLabel: selectedSubunitAligned,
                                    onSubunitHighlight: subunitHighlightAAligned.handleButtonClick,
                                    subunitHighlightOn: viewerA.isMoleculeAlignedVisible ? subunitHighlightOnAligned : false,
                                    subunitHighlightDisabled: !viewerA.isMoleculeAlignedVisible || (selectedSubunitChainIdsAligned.length === 0 && !subunitHighlightOnAligned),
                                    onSubunitInspect: subunitInspectAAligned.handleButtonClick,
                                    subunitInspectOn: viewerA.isMoleculeAlignedVisible ? subunitInspectOnAAligned : false,
                                    subunitInspectDisabled: !viewerA.isMoleculeAlignedVisible || (selectedSubunitChainIdsAligned.length === 0 && !subunitInspectOnAAligned),
                                    onSubunitZoom: subunitZoomAAligned.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAligned.length === 0,
                                    subunitToChainIds: subunitToChainIdsAligned,
                                    chainInfo: chainInfoAligned,
                                    chainColorsById: chainColorsByMode.Aligned,
                                    onChainColorChange: (chainId: string, color: string) => updateChainColorInTheme(getCurrentColorThemeNameForMode('Aligned'), chainId, color),
                                    selectedChainId: selectedChainIdAligned,
                                    setSelectedChainId: handleSelectChainIdAligned,
                                    selectedChainId2: selectedChainIdAligned2,
                                    setSelectedChainId2: handleSelectChainIdAligned2,
                                    clearSelectedChainId2: handleClearChainIdAligned2,
                                    chainZoomLabel: selectedChainIdAligned && chainInfoAligned.chainLabels.has(selectedChainIdAligned)
                                        ? chainInfoAligned.chainLabels.get(selectedChainIdAligned) ?? ''
                                        : '',
                                    chainZoomLabel2: selectedChainIdAligned2 && chainInfoAligned.chainLabels.has(selectedChainIdAligned2)
                                        ? chainInfoAligned.chainLabels.get(selectedChainIdAligned2) ?? ''
                                        : '',
                                    onChainHighlight: residueHighlightAAligned.handleButtonClick,
                                    chainHighlightOn: viewerA.isMoleculeAlignedVisible ? residueHighlightOnAligned : false,
                                    chainHighlightDisabled: !viewerA.isMoleculeAlignedVisible || (selectedResidueIdsAligned.length === 0 && !residueHighlightOnAligned),
                                    onChainInspect: residueInspectAAligned.handleButtonClick,
                                    chainInspectOn: viewerA.isMoleculeAlignedVisible ? residueInspectOnAAligned : false,
                                    chainInspectDisabled: !viewerA.isMoleculeAlignedVisible || (selectedResidueIdsAligned.length === 0 && !residueInspectOnAAligned),
                                    onChainHighlight2: residueHighlightAAligned2.handleButtonClick,
                                    chainHighlightOn2: viewerA.isMoleculeAlignedVisible ? residueHighlightOnAligned : false,
                                    chainHighlightDisabled2: !viewerA.isMoleculeAlignedVisible || (selectedResidueIdsAligned2.length === 0 && !residueHighlightOnAligned),
                                    onChainInspect2: residueInspectAAligned2.handleButtonClick,
                                    chainInspectOn2: viewerA.isMoleculeAlignedVisible ? residueInspectOnAAligned : false,
                                    chainInspectDisabled2: !viewerA.isMoleculeAlignedVisible || (selectedResidueIdsAligned2.length === 0 && !residueInspectOnAAligned),
                                    onChainZoom: residueZoomAAligned.handleButtonClick,
                                    onChainZoom2: residueZoomAAligned2.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAligned,
                                    chainZoomDisabled2: residueZoomDisabledAligned2,
                                    onCombinedSelectionZoom: combinedSelectionZoomAAligned.handleButtonClick,
                                    combinedSelectionZoomDisabled: !hasCombinedResiduesAligned,
                                    onCombinedSelectionHighlight: combinedSelectionHighlightAAligned.handleButtonClick,
                                    combinedSelectionHighlightOn: viewerA.isMoleculeAlignedVisible ? residueHighlightOnAligned : false,
                                    combinedSelectionHighlightDisabled: !viewerA.isMoleculeAlignedVisible || (!hasCombinedResiduesAligned && !residueHighlightOnAligned),
                                    onCombinedSelectionInspect: combinedSelectionInspectAAligned.handleButtonClick,
                                    combinedSelectionInspectOn: viewerA.isMoleculeAlignedVisible ? residueInspectOnAAligned : false,
                                    combinedSelectionInspectDisabled: !viewerA.isMoleculeAlignedVisible || (!hasCombinedResiduesAligned && !residueInspectOnAAligned),
                                    showUniprotAccessionInChainLabels: showUniprotAccessionInChainLabelsB,
                                    setShowUniprotAccessionInChainLabels: setShowUniprotAccessionInChainLabelsB,
                                    uniprotLookupStatus: {
                                        completed: completedUniProtCount,
                                        pending: pendingUniProtCount,
                                        inFlight: inFlightUniProtCount,
                                    },
                                    residueInfo: residueInfoAligned,
                                    residueCommonIds: commonResidueIdsAcrossSelectedChains,
                                    selectedResidueIds: selectedResidueIdsAligned,
                                    setSelectedResidueIds: setSelectedResidueIdsAligned,
                                    residueInfo2: residueInfoAligned2,
                                    residueCommonIds2: commonResidueIdsAcrossSelectedChains2,
                                    selectedResidueIds2: selectedResidueIdsAligned2,
                                    setSelectedResidueIds2: setSelectedResidueIdsAligned2,
                                    residueZoomLabel: residueZoomLabelAligned,
                                    residueZoomLabel2: residueZoomLabelAligned2,
                                    onResidueHighlight: residueHighlightAAligned.handleButtonClick,
                                    residueHighlightOn: viewerA.isMoleculeAlignedVisible ? residueHighlightOnAligned : false,
                                    residueHighlightDisabled: !viewerA.isMoleculeAlignedVisible || (selectedResidueIdsAligned.length === 0 && !residueHighlightOnAligned),
                                    onResidueInspect: residueInspectAAligned.handleButtonClick,
                                    residueInspectOn: viewerA.isMoleculeAlignedVisible ? residueInspectOnAAligned : false,
                                    residueInspectDisabled: !viewerA.isMoleculeAlignedVisible || (selectedResidueIdsAligned.length === 0 && !residueInspectOnAAligned),
                                    onResidueHighlight2: residueHighlightAAligned2.handleButtonClick,
                                    residueHighlightOn2: viewerA.isMoleculeAlignedVisible ? residueHighlightOnAligned : false,
                                    residueHighlightDisabled2: !viewerA.isMoleculeAlignedVisible || (selectedResidueIdsAligned2.length === 0 && !residueHighlightOnAligned),
                                    onResidueInspect2: residueInspectAAligned2.handleButtonClick,
                                    residueInspectOn2: viewerA.isMoleculeAlignedVisible ? residueInspectOnAAligned : false,
                                    residueInspectDisabled2: !viewerA.isMoleculeAlignedVisible || (selectedResidueIdsAligned2.length === 0 && !residueInspectOnAAligned),
                                    onResidueZoom: residueZoomAAligned.handleButtonClick,
                                    onResidueZoom2: residueZoomAAligned2.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAligned,
                                    residueZoomDisabled2: residueZoomDisabledAligned2,
                                    zoomExtraRadius: zoomExtraRadiusA,
                                    setZoomExtraRadius: setZoomExtraRadiusA,
                                    zoomMinRadius: zoomMinRadiusA,
                                    setZoomMinRadius: setZoomMinRadiusA,
                                    selectionDisplayMode: selectionDisplayByMode.Aligned.mode,
                                    setSelectionDisplayMode: (mode: HighlightDisplayMode) => setSelectionDisplayModeFor('Aligned', mode),
                                    dimUnselected: selectionDisplayByMode.Aligned.dimUnselected,
                                    setDimUnselected: (value: boolean) => setDimUnselectedFor('Aligned', value),
                                    dimUnselectedStrength: selectionDisplayByMode.Aligned.dimStrength,
                                    setDimUnselectedStrength: (value: number) => setDimUnselectedStrengthFor('Aligned', value),
                                    fog: fogA,
                                    setFog: makeFogSetters(setFogA),
                                    clipping: clippingA,
                                    clippingDefaults: clippingDefaultsA,
                                    setClipping: makeClippingSetters(setClippingA),
                                    updateFog,
                                    handleFileChange,
                                    Aligned: Aligned,
                                    allowedRepresentationTypes,
                                    syncEnabled,
                                    realignedRepRefs: realignedRepRefsA,
                                    setRealignedRepRefs: setRealignedRepRefsA,
                                    setRealignedStructRefs: setRealignedStructRefsA,
                                    fileInputLabel: 'Load Aligned',
                                    fileInputDisabled: !viewerA.isMoleculeAlignedToLoaded,
                                })}
                                moleculeUIAlignedToProps={getMoleculeUIAlignedToProps({
                                    molstar: molstarA,
                                    otherMolstar: molstarB,
                                    viewer: viewerA,
                                    isVisible: viewerA.isMoleculeAlignedToVisible,
                                    onToggleVisibility: toggleViewerAAlignedTo.handleButtonClick,
                                    chainZoomLabel: selectedChainIdAlignedTo && chainInfoAlignedTo.chainLabels.has(selectedChainIdAlignedTo)
                                        ? chainInfoAlignedTo.chainLabels.get(selectedChainIdAlignedTo) ?? ''
                                        : '',
                                    onChainZoom: chainZoomAAlignedTo.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAlignedTo,
                                    subunitZoomLabel: selectedSubunitAlignedTo,
                                    onSubunitZoom: subunitZoomAAlignedTo.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAlignedTo.length === 0,
                                    residueZoomLabel: residueZoomLabelAlignedTo,
                                    onResidueZoom: residueZoomAAlignedTo.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAlignedTo,
                                    isLoaded: viewerA.isMoleculeAlignedToLoaded,
                                    forceUpdate,
                                    representationRefs: molstarA.representationRefs[AlignedTo] || [],
                                    syncEnabled,
                                    deleteRepresentation,
                                    repIdMap: molstarA.repIdMap,
                                    AlignedTo,
                                    chainThemeOptions,
                                    residueThemeOptions,
                                    onRepresentationChainThemeChange: (ref: string, themeName: string) => {
                                        void setRepresentationChainTheme(AlignedTo, ref, themeName);
                                    },
                                    onRepresentationResidueThemeChange: (ref: string, themeName: string) => {
                                        void setRepresentationResidueTheme(AlignedTo, ref, themeName);
                                    },
                                })}
                                moleculeUIAlignedProps={getMoleculeUIAlignedProps({
                                    molstar: molstarA,
                                    otherMolstar: molstarB,
                                    viewer: viewerA,
                                    isVisible: viewerA.isMoleculeAlignedVisible,
                                    onToggleVisibility: toggleViewerAAligned.handleButtonClick,
                                    chainZoomLabel: selectedChainIdAligned && chainInfoAligned.chainLabels.has(selectedChainIdAligned)
                                        ? chainInfoAligned.chainLabels.get(selectedChainIdAligned) ?? ''
                                        : '',
                                    onChainZoom: chainZoomAAligned.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAligned,
                                    subunitZoomLabel: selectedSubunitAligned,
                                    onSubunitZoom: subunitZoomAAligned.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAligned.length === 0,
                                    residueZoomLabel: residueZoomLabelAligned,
                                    onResidueZoom: residueZoomAAligned.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAligned,
                                    isLoaded: viewerA.isMoleculeAlignedLoaded,
                                    forceUpdate,
                                    representationRefs: molstarA.representationRefs[Aligned] || [],
                                    syncEnabled,
                                    deleteRepresentation,
                                    repIdMap: molstarA.repIdMap,
                                    Aligned,
                                    chainThemeOptions,
                                    residueThemeOptions,
                                    onRepresentationChainThemeChange: (ref: string, themeName: string) => {
                                        void setRepresentationChainTheme(Aligned, ref, themeName);
                                    },
                                    onRepresentationResidueThemeChange: (ref: string, themeName: string) => {
                                        void setRepresentationResidueTheme(Aligned, ref, themeName);
                                    },
                                    chainInfoAligned,
                                    selectedChainIdAligned,
                                    residueInfoAligned,
                                    selectedResidueIdAligned
                                })}
                                realignedMoleculeListProps={getRealignedMoleculeListProps({
                                    molecules: realignedMoleculesA,
                                    molstar: molstarA,
                                    chainInfo: chainInfoAligned,
                                    residueInfo: residueInfoAligned,
                                    selectedResidueId: selectedResidueIdAligned,
                                    realignedStructRefs: realignedStructRefsA,
                                    setRealignedMolecules: setRealignedMoleculesA,
                                    setRealignedRepRefs: setRealignedRepRefsA,
                                    setRealignedStructRefs: setRealignedStructRefsA,
                                    forceUpdate,
                                    viewerKey: "A",
                                    otherMolstar: molstarB,
                                    otherRealignedStructRefs: realignedStructRefsB,
                                    setOtherRealignedMolecules: setRealignedMoleculesB,
                                    setOtherRealignedRepRefs: setRealignedRepRefsB,
                                    setOtherRealignedStructRefs: setRealignedStructRefsB,
                                })}
                                molstarContainerProps={getMolstarContainerProps({
                                    viewer: viewerA,
                                    pluginRef: pluginRefA,
                                    setViewerWrapper: setViewerAWrapper,
                                    setActiveViewer,
                                    setViewerReady: setViewerAReady
                                })}
                                alignedToChainFinderQuery={chainFinderQueryAlignedTo}
                                onAlignedToChainFinderQueryChange={setChainFinderQueryAlignedTo}
                                alignedChainFinderQuery={chainFinderQueryAligned}
                                onAlignedChainFinderQueryChange={setChainFinderQueryAligned}
                            />
                        }
                        right={
                            <ViewerColumn
                                viewerKey={B}
                                loadDataRowPropsAlignedTo={getLoadDataRowProps({
                                    viewer: viewerB,
                                    otherViewer: viewerA,
                                    molstar: molstarB,
                                    otherMolstar: molstarA,
                                    realignedStructRefs: realignedStructRefsB,
                                    otherRealignedStructRefs: realignedStructRefsA,
                                    isMoleculeAlignedLoaded: false, // Only matters for Aligned loader
                                    isMoleculeAlignedToLoaded: viewerB.isMoleculeAlignedToLoaded, // Only matters for AlignedTo loader
                                    viewerReady: viewerBReady,
                                    otherViewerReady: viewerAReady,
                                    representationType: representationTypeAlignedTo,
                                    setRepresentationType: setRepresentationTypeAlignedTo,
                                    colorsFile: chainColorsAlignedToFile,
                                    chainColorsFile: chainColorsAlignedToFile,
                                    residueColorsFile: residueColorsAlignedToFile,
                                    isMoleculeColoursLoaded: isMoleculeAlignedToColoursLoaded,
                                    colorMode: colorModeByMode.AlignedTo,
                                    onColorModeChange: (mode: RepresentationColorMode) => setColorModeByMode(prev => ({ ...prev, AlignedTo: mode })),
                                    residueTypeColorsById: residueTypeColorsByMode.AlignedTo,
                                    residueTypeCounts: residueTypeCountsByMode.AlignedTo,
                                    onResidueTypeColorChange: (residueType: string, color: string) => updateResidueTypeColorInTheme(selectedResidueThemeByMode.AlignedTo, residueType, color, 'AlignedTo'),
                                    onSaveColorTheme: () => handleSaveColorThemeForMode('AlignedTo'),
                                    saveColorThemeDisabled: !selectedChainIdAlignedTo,
                                    colorThemeOptions: chainThemeOptions,
                                    selectedColorThemeName: selectedColorThemeByMode.AlignedTo,
                                    setSelectedColorThemeName: (themeName: string) => handleSelectThemeForMode('AlignedTo', 'chain', themeName),
                                    onRemoveColorTheme: () => handleRemoveSelectedColorTheme('AlignedTo', 'chain'),
                                    removeColorThemeDisabled: selectedColorThemeByMode.AlignedTo === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedColorThemeByMode.AlignedTo),
                                    chainThemeOptions,
                                    selectedChainThemeName: selectedColorThemeByMode.AlignedTo,
                                    setSelectedChainThemeName: (themeName: string) => handleSelectThemeForMode('AlignedTo', 'chain', themeName),
                                    onSaveChainTheme: () => handleSaveColorThemeForMode('AlignedTo'),
                                    saveChainThemeDisabled: false,
                                    onRemoveChainTheme: () => handleRemoveSelectedColorTheme('AlignedTo', 'chain'),
                                    removeChainThemeDisabled: selectedColorThemeByMode.AlignedTo === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedColorThemeByMode.AlignedTo),
                                    residueThemeOptions,
                                    selectedResidueThemeName: selectedResidueThemeByMode.AlignedTo,
                                    setSelectedResidueThemeName: (themeName: string) => handleSelectThemeForMode('AlignedTo', 'residue-type', themeName),
                                    onSaveResidueTheme: () => handleSaveResidueThemeForMode('AlignedTo'),
                                    saveResidueThemeDisabled: selectedResidueThemeByMode.AlignedTo === DEFAULT_COLOR_THEME_NAME && residueTypeColorsByMode.AlignedTo.size === 0,
                                    onRemoveResidueTheme: () => handleRemoveSelectedColorTheme('AlignedTo', 'residue-type'),
                                    removeResidueThemeDisabled: selectedResidueThemeByMode.AlignedTo === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedResidueThemeByMode.AlignedTo),
                                    structureRef: structureRefBAlignedTo,
                                    otherStructureRef: structureRefAAlignedTo,
                                    selectedSubunit: selectedSubunitAlignedTo,
                                    setSelectedSubunit: setSelectedSubunitAlignedTo,
                                    subunitZoomLabel: selectedSubunitAlignedTo,
                                    onSubunitHighlight: subunitHighlightBAlignedTo.handleButtonClick,
                                    subunitHighlightOn: viewerB.isMoleculeAlignedToVisible ? subunitHighlightOnAlignedTo : false,
                                    subunitHighlightDisabled: !viewerB.isMoleculeAlignedToVisible || (selectedSubunitChainIdsAlignedTo.length === 0 && !subunitHighlightOnAlignedTo),
                                    onSubunitInspect: subunitInspectBAlignedTo.handleButtonClick,
                                    subunitInspectOn: viewerB.isMoleculeAlignedToVisible ? subunitInspectOnBAlignedTo : false,
                                    subunitInspectDisabled: !viewerB.isMoleculeAlignedToVisible || (selectedSubunitChainIdsAlignedTo.length === 0 && !subunitInspectOnBAlignedTo),
                                    onSubunitZoom: subunitZoomBAlignedTo.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAlignedTo.length === 0,
                                    subunitToChainIds: subunitToChainIdsAlignedTo,
                                    chainInfo: chainInfoAlignedTo,
                                    chainColorsById: chainColorsByMode.AlignedTo,
                                    onChainColorChange: (chainId: string, color: string) => updateChainColorInTheme(getCurrentColorThemeNameForMode('AlignedTo'), chainId, color),
                                    selectedChainId: selectedChainIdAlignedTo,
                                    setSelectedChainId: handleSelectChainIdAlignedTo,
                                    selectedChainId2: selectedChainIdAlignedTo2,
                                    setSelectedChainId2: handleSelectChainIdAlignedTo2,
                                    clearSelectedChainId2: handleClearChainIdAlignedTo2,
                                    chainZoomLabel: selectedChainIdAlignedTo && chainInfoAlignedTo.chainLabels.has(selectedChainIdAlignedTo)
                                        ? chainInfoAlignedTo.chainLabels.get(selectedChainIdAlignedTo) ?? ''
                                        : '',
                                    chainZoomLabel2: selectedChainIdAlignedTo2 && chainInfoAlignedTo.chainLabels.has(selectedChainIdAlignedTo2)
                                        ? chainInfoAlignedTo.chainLabels.get(selectedChainIdAlignedTo2) ?? ''
                                        : '',
                                    onChainHighlight: residueHighlightBAlignedTo.handleButtonClick,
                                    chainHighlightOn: viewerB.isMoleculeAlignedToVisible ? residueHighlightOnAlignedTo : false,
                                    chainHighlightDisabled: !viewerB.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo.length === 0 && !residueHighlightOnAlignedTo),
                                    onChainInspect: residueInspectBAlignedTo.handleButtonClick,
                                    chainInspectOn: viewerB.isMoleculeAlignedToVisible ? residueInspectOnBAlignedTo : false,
                                    chainInspectDisabled: !viewerB.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo.length === 0 && !residueInspectOnBAlignedTo),
                                    onChainHighlight2: residueHighlightBAlignedTo2.handleButtonClick,
                                    chainHighlightOn2: viewerB.isMoleculeAlignedToVisible ? residueHighlightOnAlignedTo : false,
                                    chainHighlightDisabled2: !viewerB.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo2.length === 0 && !residueHighlightOnAlignedTo),
                                    onChainInspect2: residueInspectBAlignedTo2.handleButtonClick,
                                    chainInspectOn2: viewerB.isMoleculeAlignedToVisible ? residueInspectOnBAlignedTo : false,
                                    chainInspectDisabled2: !viewerB.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo2.length === 0 && !residueInspectOnBAlignedTo),
                                    onChainZoom: residueZoomBAlignedTo.handleButtonClick,
                                    onChainZoom2: residueZoomBAlignedTo2.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAlignedTo,
                                    chainZoomDisabled2: residueZoomDisabledAlignedTo2,
                                    onCombinedSelectionZoom: combinedSelectionZoomBAlignedTo.handleButtonClick,
                                    combinedSelectionZoomDisabled: !hasCombinedResiduesAlignedTo,
                                    onCombinedSelectionHighlight: combinedSelectionHighlightBAlignedTo.handleButtonClick,
                                    combinedSelectionHighlightOn: viewerB.isMoleculeAlignedToVisible ? residueHighlightOnAlignedTo : false,
                                    combinedSelectionHighlightDisabled: !viewerB.isMoleculeAlignedToVisible || (!hasCombinedResiduesAlignedTo && !residueHighlightOnAlignedTo),
                                    onCombinedSelectionInspect: combinedSelectionInspectBAlignedTo.handleButtonClick,
                                    combinedSelectionInspectOn: viewerB.isMoleculeAlignedToVisible ? residueInspectOnBAlignedTo : false,
                                    combinedSelectionInspectDisabled: !viewerB.isMoleculeAlignedToVisible || (!hasCombinedResiduesAlignedTo && !residueInspectOnBAlignedTo),
                                    showUniprotAccessionInChainLabels: showUniprotAccessionInChainLabelsA,
                                    setShowUniprotAccessionInChainLabels: setShowUniprotAccessionInChainLabelsA,
                                    uniprotLookupStatus: {
                                        completed: completedUniProtCount,
                                        pending: pendingUniProtCount,
                                        inFlight: inFlightUniProtCount,
                                    },
                                    residueInfo: residueInfoAlignedTo,
                                    residueCommonIds: commonResidueIdsAcrossSelectedChains,
                                    selectedResidueIds: selectedResidueIdsAlignedTo,
                                    setSelectedResidueIds: setSelectedResidueIdsAlignedTo,
                                    residueInfo2: residueInfoAlignedTo2,
                                    residueCommonIds2: commonResidueIdsAcrossSelectedChains2,
                                    selectedResidueIds2: selectedResidueIdsAlignedTo2,
                                    setSelectedResidueIds2: setSelectedResidueIdsAlignedTo2,
                                    residueZoomLabel: residueZoomLabelAlignedTo,
                                    residueZoomLabel2: residueZoomLabelAlignedTo2,
                                    onResidueHighlight: residueHighlightBAlignedTo.handleButtonClick,
                                    residueHighlightOn: viewerB.isMoleculeAlignedToVisible ? residueHighlightOnAlignedTo : false,
                                    residueHighlightDisabled: !viewerB.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo.length === 0 && !residueHighlightOnAlignedTo),
                                    onResidueInspect: residueInspectBAlignedTo.handleButtonClick,
                                    residueInspectOn: viewerB.isMoleculeAlignedToVisible ? residueInspectOnBAlignedTo : false,
                                    residueInspectDisabled: !viewerB.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo.length === 0 && !residueInspectOnBAlignedTo),
                                    onResidueHighlight2: residueHighlightBAlignedTo2.handleButtonClick,
                                    residueHighlightOn2: viewerB.isMoleculeAlignedToVisible ? residueHighlightOnAlignedTo : false,
                                    residueHighlightDisabled2: !viewerB.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo2.length === 0 && !residueHighlightOnAlignedTo),
                                    onResidueInspect2: residueInspectBAlignedTo2.handleButtonClick,
                                    residueInspectOn2: viewerB.isMoleculeAlignedToVisible ? residueInspectOnBAlignedTo : false,
                                    residueInspectDisabled2: !viewerB.isMoleculeAlignedToVisible || (selectedResidueIdsAlignedTo2.length === 0 && !residueInspectOnBAlignedTo),
                                    onResidueZoom: residueZoomBAlignedTo.handleButtonClick,
                                    onResidueZoom2: residueZoomBAlignedTo2.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAlignedTo,
                                    residueZoomDisabled2: residueZoomDisabledAlignedTo2,
                                    zoomExtraRadius: zoomExtraRadiusB,
                                    setZoomExtraRadius: setZoomExtraRadiusB,
                                    zoomMinRadius: zoomMinRadiusB,
                                    setZoomMinRadius: setZoomMinRadiusB,
                                    selectionDisplayMode: selectionDisplayByMode.AlignedTo.mode,
                                    setSelectionDisplayMode: (mode: HighlightDisplayMode) => setSelectionDisplayModeFor('AlignedTo', mode),
                                    dimUnselected: selectionDisplayByMode.AlignedTo.dimUnselected,
                                    setDimUnselected: (value: boolean) => setDimUnselectedFor('AlignedTo', value),
                                    dimUnselectedStrength: selectionDisplayByMode.AlignedTo.dimStrength,
                                    setDimUnselectedStrength: (value: number) => setDimUnselectedStrengthFor('AlignedTo', value),
                                    fog: fogB,
                                    setFog: makeFogSetters(setFogB),
                                    clipping: clippingB,
                                    clippingDefaults: clippingDefaultsB,
                                    setClipping: makeClippingSetters(setClippingB),
                                    updateFog,
                                    handleFileChange,
                                    Aligned: AlignedTo,
                                    allowedRepresentationTypes,
                                    syncEnabled,
                                    realignedRepRefs: realignedRepRefsB,
                                    setRealignedRepRefs: setRealignedRepRefsB,
                                    setRealignedStructRefs: setRealignedStructRefsB,
                                    fileInputLabel: 'Load AlignedTo',
                                    fileInputDisabled: false,
                                })}
                                loadDataRowPropsAligned={getLoadDataRowProps({
                                    viewer: viewerB,
                                    otherViewer: viewerA,
                                    molstar: molstarB,
                                    otherMolstar: molstarA,
                                    realignedStructRefs: realignedStructRefsB,
                                    otherRealignedStructRefs: realignedStructRefsA,
                                    isMoleculeAlignedLoaded: viewerB.isMoleculeAlignedLoaded,
                                    isMoleculeAlignedToLoaded: viewerB.isMoleculeAlignedToLoaded,
                                    viewerReady: viewerBReady,
                                    otherViewerReady: viewerAReady,
                                    representationType: representationTypeAligned,
                                    setRepresentationType: setRepresentationTypeAligned,
                                    colorsFile: chainColorsAlignedFile,
                                    chainColorsFile: chainColorsAlignedFile,
                                    residueColorsFile: residueColorsAlignedFile,
                                    isMoleculeColoursLoaded: isMoleculeAlignedColoursLoaded,
                                    colorMode: colorModeByMode.Aligned,
                                    onColorModeChange: (mode: RepresentationColorMode) => setColorModeByMode(prev => ({ ...prev, Aligned: mode })),
                                    residueTypeColorsById: residueTypeColorsByMode.Aligned,
                                    residueTypeCounts: residueTypeCountsByMode.Aligned,
                                    onResidueTypeColorChange: (residueType: string, color: string) => updateResidueTypeColorInTheme(selectedResidueThemeByMode.Aligned, residueType, color, 'Aligned'),
                                    onSaveColorTheme: () => handleSaveColorThemeForMode('Aligned'),
                                    saveColorThemeDisabled: !selectedChainIdAligned,
                                    colorThemeOptions: chainThemeOptions,
                                    selectedColorThemeName: selectedColorThemeByMode.Aligned,
                                    setSelectedColorThemeName: (themeName: string) => handleSelectThemeForMode('Aligned', 'chain', themeName),
                                    onRemoveColorTheme: () => handleRemoveSelectedColorTheme('Aligned', 'chain'),
                                    removeColorThemeDisabled: selectedColorThemeByMode.Aligned === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedColorThemeByMode.Aligned),
                                    chainThemeOptions,
                                    selectedChainThemeName: selectedColorThemeByMode.Aligned,
                                    setSelectedChainThemeName: (themeName: string) => handleSelectThemeForMode('Aligned', 'chain', themeName),
                                    onSaveChainTheme: () => handleSaveColorThemeForMode('Aligned'),
                                    saveChainThemeDisabled: false,
                                    onRemoveChainTheme: () => handleRemoveSelectedColorTheme('Aligned', 'chain'),
                                    removeChainThemeDisabled: selectedColorThemeByMode.Aligned === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedColorThemeByMode.Aligned),
                                    residueThemeOptions,
                                    selectedResidueThemeName: selectedResidueThemeByMode.Aligned,
                                    setSelectedResidueThemeName: (themeName: string) => handleSelectThemeForMode('Aligned', 'residue-type', themeName),
                                    onSaveResidueTheme: () => handleSaveResidueThemeForMode('Aligned'),
                                    saveResidueThemeDisabled: selectedResidueThemeByMode.Aligned === DEFAULT_COLOR_THEME_NAME && residueTypeColorsByMode.Aligned.size === 0,
                                    onRemoveResidueTheme: () => handleRemoveSelectedColorTheme('Aligned', 'residue-type'),
                                    removeResidueThemeDisabled: selectedResidueThemeByMode.Aligned === DEFAULT_COLOR_THEME_NAME
                                        || isThemeInUse(selectedResidueThemeByMode.Aligned),
                                    structureRef: structureRefBAligned,
                                    otherStructureRef: structureRefAAligned,
                                    selectedSubunit: selectedSubunitAligned,
                                    setSelectedSubunit: setSelectedSubunitAligned,
                                    subunitZoomLabel: selectedSubunitAligned,
                                    onSubunitHighlight: subunitHighlightBAligned.handleButtonClick,
                                    subunitHighlightOn: viewerB.isMoleculeAlignedVisible ? subunitHighlightOnAligned : false,
                                    subunitHighlightDisabled: !viewerB.isMoleculeAlignedVisible || (selectedSubunitChainIdsAligned.length === 0 && !subunitHighlightOnAligned),
                                    onSubunitInspect: subunitInspectBAligned.handleButtonClick,
                                    subunitInspectOn: viewerB.isMoleculeAlignedVisible ? subunitInspectOnBAligned : false,
                                    subunitInspectDisabled: !viewerB.isMoleculeAlignedVisible || (selectedSubunitChainIdsAligned.length === 0 && !subunitInspectOnBAligned),
                                    onSubunitZoom: subunitZoomBAligned.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAligned.length === 0,
                                    subunitToChainIds: subunitToChainIdsAligned,
                                    chainInfo: chainInfoAligned,
                                    chainColorsById: chainColorsByMode.Aligned,
                                    onChainColorChange: (chainId: string, color: string) => updateChainColorInTheme(getCurrentColorThemeNameForMode('Aligned'), chainId, color),
                                    selectedChainId: selectedChainIdAligned,
                                    setSelectedChainId: handleSelectChainIdAligned,
                                    selectedChainId2: selectedChainIdAligned2,
                                    setSelectedChainId2: handleSelectChainIdAligned2,
                                    clearSelectedChainId2: handleClearChainIdAligned2,
                                    chainZoomLabel: selectedChainIdAligned && chainInfoAligned.chainLabels.has(selectedChainIdAligned)
                                        ? chainInfoAligned.chainLabels.get(selectedChainIdAligned) ?? ''
                                        : '',
                                    chainZoomLabel2: selectedChainIdAligned2 && chainInfoAligned.chainLabels.has(selectedChainIdAligned2)
                                        ? chainInfoAligned.chainLabels.get(selectedChainIdAligned2) ?? ''
                                        : '',
                                    onChainHighlight: residueHighlightBAligned.handleButtonClick,
                                    chainHighlightOn: viewerB.isMoleculeAlignedVisible ? residueHighlightOnAligned : false,
                                    chainHighlightDisabled: !viewerB.isMoleculeAlignedVisible || (selectedResidueIdsAligned.length === 0 && !residueHighlightOnAligned),
                                    onChainInspect: residueInspectBAligned.handleButtonClick,
                                    chainInspectOn: viewerB.isMoleculeAlignedVisible ? residueInspectOnBAligned : false,
                                    chainInspectDisabled: !viewerB.isMoleculeAlignedVisible || (selectedResidueIdsAligned.length === 0 && !residueInspectOnBAligned),
                                    onChainHighlight2: residueHighlightBAligned2.handleButtonClick,
                                    chainHighlightOn2: viewerB.isMoleculeAlignedVisible ? residueHighlightOnAligned : false,
                                    chainHighlightDisabled2: !viewerB.isMoleculeAlignedVisible || (selectedResidueIdsAligned2.length === 0 && !residueHighlightOnAligned),
                                    onChainInspect2: residueInspectBAligned2.handleButtonClick,
                                    chainInspectOn2: viewerB.isMoleculeAlignedVisible ? residueInspectOnBAligned : false,
                                    chainInspectDisabled2: !viewerB.isMoleculeAlignedVisible || (selectedResidueIdsAligned2.length === 0 && !residueInspectOnBAligned),
                                    onChainZoom: residueZoomBAligned.handleButtonClick,
                                    onChainZoom2: residueZoomBAligned2.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAligned,
                                    chainZoomDisabled2: residueZoomDisabledAligned2,
                                    onCombinedSelectionZoom: combinedSelectionZoomBAligned.handleButtonClick,
                                    combinedSelectionZoomDisabled: !hasCombinedResiduesAligned,
                                    onCombinedSelectionHighlight: combinedSelectionHighlightBAligned.handleButtonClick,
                                    combinedSelectionHighlightOn: viewerB.isMoleculeAlignedVisible ? residueHighlightOnAligned : false,
                                    combinedSelectionHighlightDisabled: !viewerB.isMoleculeAlignedVisible || (!hasCombinedResiduesAligned && !residueHighlightOnAligned),
                                    onCombinedSelectionInspect: combinedSelectionInspectBAligned.handleButtonClick,
                                    combinedSelectionInspectOn: viewerB.isMoleculeAlignedVisible ? residueInspectOnBAligned : false,
                                    combinedSelectionInspectDisabled: !viewerB.isMoleculeAlignedVisible || (!hasCombinedResiduesAligned && !residueInspectOnBAligned),
                                    showUniprotAccessionInChainLabels: showUniprotAccessionInChainLabelsB,
                                    setShowUniprotAccessionInChainLabels: setShowUniprotAccessionInChainLabelsB,
                                    uniprotLookupStatus: {
                                        completed: completedUniProtCount,
                                        pending: pendingUniProtCount,
                                        inFlight: inFlightUniProtCount,
                                    },
                                    residueInfo: residueInfoAligned,
                                    residueCommonIds: commonResidueIdsAcrossSelectedChains,
                                    selectedResidueIds: selectedResidueIdsAligned,
                                    setSelectedResidueIds: setSelectedResidueIdsAligned,
                                    residueInfo2: residueInfoAligned2,
                                    residueCommonIds2: commonResidueIdsAcrossSelectedChains2,
                                    selectedResidueIds2: selectedResidueIdsAligned2,
                                    setSelectedResidueIds2: setSelectedResidueIdsAligned2,
                                    residueZoomLabel: residueZoomLabelAligned,
                                    residueZoomLabel2: residueZoomLabelAligned2,
                                    onResidueHighlight: residueHighlightBAligned.handleButtonClick,
                                    residueHighlightOn: viewerB.isMoleculeAlignedVisible ? residueHighlightOnAligned : false,
                                    residueHighlightDisabled: !viewerB.isMoleculeAlignedVisible || (selectedResidueIdsAligned.length === 0 && !residueHighlightOnAligned),
                                    onResidueInspect: residueInspectBAligned.handleButtonClick,
                                    residueInspectOn: viewerB.isMoleculeAlignedVisible ? residueInspectOnBAligned : false,
                                    residueInspectDisabled: !viewerB.isMoleculeAlignedVisible || (selectedResidueIdsAligned.length === 0 && !residueInspectOnBAligned),
                                    onResidueHighlight2: residueHighlightBAligned2.handleButtonClick,
                                    residueHighlightOn2: viewerB.isMoleculeAlignedVisible ? residueHighlightOnAligned : false,
                                    residueHighlightDisabled2: !viewerB.isMoleculeAlignedVisible || (selectedResidueIdsAligned2.length === 0 && !residueHighlightOnAligned),
                                    onResidueInspect2: residueInspectBAligned2.handleButtonClick,
                                    residueInspectOn2: viewerB.isMoleculeAlignedVisible ? residueInspectOnBAligned : false,
                                    residueInspectDisabled2: !viewerB.isMoleculeAlignedVisible || (selectedResidueIdsAligned2.length === 0 && !residueInspectOnBAligned),
                                    onResidueZoom: residueZoomBAligned.handleButtonClick,
                                    onResidueZoom2: residueZoomBAligned2.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAligned,
                                    residueZoomDisabled2: residueZoomDisabledAligned2,
                                    zoomExtraRadius: zoomExtraRadiusB,
                                    setZoomExtraRadius: setZoomExtraRadiusB,
                                    zoomMinRadius: zoomMinRadiusB,
                                    setZoomMinRadius: setZoomMinRadiusB,
                                    selectionDisplayMode: selectionDisplayByMode.Aligned.mode,
                                    setSelectionDisplayMode: (mode: HighlightDisplayMode) => setSelectionDisplayModeFor('Aligned', mode),
                                    dimUnselected: selectionDisplayByMode.Aligned.dimUnselected,
                                    setDimUnselected: (value: boolean) => setDimUnselectedFor('Aligned', value),
                                    dimUnselectedStrength: selectionDisplayByMode.Aligned.dimStrength,
                                    setDimUnselectedStrength: (value: number) => setDimUnselectedStrengthFor('Aligned', value),
                                    fog: fogB,
                                    setFog: makeFogSetters(setFogB),
                                    clipping: clippingB,
                                    clippingDefaults: clippingDefaultsB,
                                    setClipping: makeClippingSetters(setClippingB),
                                    updateFog,
                                    handleFileChange,
                                    Aligned: Aligned,
                                    allowedRepresentationTypes,
                                    syncEnabled,
                                    realignedRepRefs: realignedRepRefsB,
                                    setRealignedRepRefs: setRealignedRepRefsB,
                                    setRealignedStructRefs: setRealignedStructRefsB,
                                    fileInputLabel: 'Load Aligned',
                                    fileInputDisabled: !viewerB.isMoleculeAlignedToLoaded,
                                })}
                                moleculeUIAlignedToProps={getMoleculeUIAlignedToProps({
                                    molstar: molstarB,
                                    otherMolstar: molstarA,
                                    viewer: viewerB,
                                    isVisible: viewerB.isMoleculeAlignedToVisible,
                                    onToggleVisibility: toggleViewerBAlignedTo.handleButtonClick,
                                    chainZoomLabel: selectedChainIdAlignedTo && chainInfoAlignedTo.chainLabels.has(selectedChainIdAlignedTo)
                                        ? chainInfoAlignedTo.chainLabels.get(selectedChainIdAlignedTo) ?? ''
                                        : '',
                                    onChainZoom: chainZoomBAlignedTo.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAlignedTo,
                                    subunitZoomLabel: selectedSubunitAlignedTo,
                                    onSubunitZoom: subunitZoomBAlignedTo.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAlignedTo.length === 0,
                                    residueZoomLabel: residueZoomLabelAlignedTo,
                                    onResidueZoom: residueZoomBAlignedTo.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAlignedTo,
                                    isLoaded: viewerB.isMoleculeAlignedToLoaded,
                                    forceUpdate,
                                    representationRefs: molstarB.representationRefs[AlignedTo] || [],
                                    syncEnabled,
                                    deleteRepresentation,
                                    repIdMap: molstarB.repIdMap,
                                    AlignedTo,
                                    chainThemeOptions,
                                    residueThemeOptions,
                                    onRepresentationChainThemeChange: (ref: string, themeName: string) => {
                                        void setRepresentationChainTheme(AlignedTo, ref, themeName);
                                    },
                                    onRepresentationResidueThemeChange: (ref: string, themeName: string) => {
                                        void setRepresentationResidueTheme(AlignedTo, ref, themeName);
                                    },
                                })}
                                moleculeUIAlignedProps={getMoleculeUIAlignedProps({
                                    molstar: molstarB,
                                    otherMolstar: molstarA,
                                    viewer: viewerB,
                                    isVisible: viewerB.isMoleculeAlignedVisible,
                                    onToggleVisibility: toggleViewerBAligned.handleButtonClick,
                                    chainZoomLabel: selectedChainIdAligned && chainInfoAligned.chainLabels.has(selectedChainIdAligned)
                                        ? chainInfoAligned.chainLabels.get(selectedChainIdAligned) ?? ''
                                        : '',
                                    onChainZoom: chainZoomBAligned.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAligned,
                                    subunitZoomLabel: selectedSubunitAligned,
                                    onSubunitZoom: subunitZoomBAligned.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAligned.length === 0,
                                    residueZoomLabel: residueZoomLabelAligned,
                                    onResidueZoom: residueZoomBAligned.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAligned,
                                    isLoaded: viewerB.isMoleculeAlignedLoaded,
                                    forceUpdate,
                                    representationRefs: molstarB.representationRefs[Aligned] || [],
                                    syncEnabled,
                                    deleteRepresentation,
                                    repIdMap: molstarB.repIdMap,
                                    Aligned,
                                    chainThemeOptions,
                                    residueThemeOptions,
                                    onRepresentationChainThemeChange: (ref: string, themeName: string) => {
                                        void setRepresentationChainTheme(Aligned, ref, themeName);
                                    },
                                    onRepresentationResidueThemeChange: (ref: string, themeName: string) => {
                                        void setRepresentationResidueTheme(Aligned, ref, themeName);
                                    },
                                    chainInfoAligned,
                                    selectedChainIdAligned,
                                    residueInfoAligned,
                                    selectedResidueIdAligned
                                })}
                                realignedMoleculeListProps={getRealignedMoleculeListProps({
                                    molecules: realignedMoleculesB,
                                    molstar: molstarB,
                                    chainInfo: chainInfoAligned,
                                    residueInfo: residueInfoAligned,
                                    selectedResidueId: selectedResidueIdAligned,
                                    realignedStructRefs: realignedStructRefsB,
                                    setRealignedMolecules: setRealignedMoleculesB,
                                    setRealignedRepRefs: setRealignedRepRefsB,
                                    setRealignedStructRefs: setRealignedStructRefsB,
                                    forceUpdate,
                                    viewerKey: "B",
                                    otherMolstar: molstarA,
                                    otherRealignedStructRefs: realignedStructRefsA,
                                    setOtherRealignedMolecules: setRealignedMoleculesA,
                                    setOtherRealignedRepRefs: setRealignedRepRefsA,
                                    setOtherRealignedStructRefs: setRealignedStructRefsB,
                                })}
                                molstarContainerProps={getMolstarContainerProps({
                                    viewer: viewerB,
                                    pluginRef: pluginRefB,
                                    setViewerWrapper: setViewerBWrapper,
                                    setActiveViewer,
                                    setViewerReady: setViewerBReady
                                })}
                                alignedToChainFinderQuery={chainFinderQueryAlignedTo}
                                onAlignedToChainFinderQueryChange={setChainFinderQueryAlignedTo}
                                alignedChainFinderQuery={chainFinderQueryAligned}
                                onAlignedChainFinderQueryChange={setChainFinderQueryAligned}
                            />
                        }
                    />
                </div>
                </SyncProvider>
            </SelectionProvider>
        </ViewerStateProvider>
    );
};

export default App;