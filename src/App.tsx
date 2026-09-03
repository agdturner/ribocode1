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
import { useUpdateColors } from './hooks/useUpdateColors';
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
import { parseColorFileContent } from './utils/colors';
import { useFileInput } from './hooks/useFileInput';
import { useChainState } from './hooks/useChainState';
import { getAtomDataFromStructureUnits, summarizeAtomCloud } from './utils/data';
import { getStructureRepresentations } from './utils/structure';
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
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { AlignmentData } from 'molstar/lib/extensions/ribocode/types';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import type { LoadedMolecule, ViewerKey, MoleculeMode } from './types/ribocode';
import { A, B } from './constants/ribocode';
import { makeFogSetters, makeClippingSetters, makeZoomHandler, makeChainHighlightToggleHandler, makeResidueHighlightToggleHandler, makeSubunitHighlightToggleHandler } from './utils/viewerHelpers';
import { selectedAtomTypes } from './constants/ribocode';
import { parseRpNameTableBySpecies } from './utils/rpNameTable';
import { extractUniProtAccessionsFromText, fetchUniProtGeneNamesBatched, parseChainToMoleculeNameFromCifText, parseChainToUniProtFromCifText, UniProtGeneNameCache } from './utils/uniprot';
import { addRealignPair, hasRealignPair } from './utils/realignment';
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
}

interface SerializableCameraSnapshot {
    position: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
    radius: number;
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
            residueId?: string;
            residueIds?: string[];
        };
        aligned?: {
            subunit?: string;
            chainId?: string;
            residueId?: string;
            residueIds?: string[];
        };
    };
    syncEnabled?: boolean;
    activeViewer?: ViewerKey;
    cameraSnapshots?: {
        viewerA?: SerializableCameraSnapshot;
        viewerB?: SerializableCameraSnapshot;
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
}

const UNIPROT_CACHE_STORAGE_KEY = 'ribocode-uniprot-gene-cache-v1';
const ENABLE_IN_PLACE_CHAIN_REALIGN = true;
const SUBUNIT_REALIGN_CHAIN_ID = '__subunit__';
const RESIDUE_REALIGN_CHAIN_ID = '__residue__';
const DEFAULT_CLIPPING = { minNear: 1, clipRadius: 0 };

export function readClippingFromViewer(plugin: any): { minNear: number; clipRadius: number } {
    const clipping = plugin?.canvas3d?.props?.cameraClipping ?? {};
    const minNear = Number(clipping.minNear);
    const radius = Number(clipping.radius);
    return {
        minNear: Number.isFinite(minNear) ? minNear : DEFAULT_CLIPPING.minNear,
        clipRadius: Number.isFinite(radius) ? radius : DEFAULT_CLIPPING.clipRadius,
    };
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

function buildAtomDataForResidueGroup(
    structure: any,
    residueIds: string[],
    residueToAtomIds: Record<string, string[]>
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
    for (const unit of units) {
        if (unit.kind !== 0) continue;
        const model = unit.model;
        const atoms = model?.atomicHierarchy?.atoms;
        const conformation = model?.atomicConformation;
        if (!atoms || !conformation) continue;

        for (const atomIdx of unit.elements ?? []) {
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
    const [showUniprotAccessionInChainLabels, setShowUniprotAccessionInChainLabels] = useState(true);
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

    // File inputs for dictionary and colors.
    const dictionaryFile = useFileInput<Array<Record<string, string>>>(parseDictionaryFileContent, []);
    const alignmentFile = useFileInput<Array<Record<string, string>>>(parseDictionaryFileContent, []);
    const [isMoleculeAlignedToColoursLoaded, setIsMoleculeAlignedToColoursLoaded] = useState(false);
    const [isMoleculeAlignedColoursLoaded, setIsMoleculeAlignedColoursLoaded] = useState(false);
    const colorsAlignedToFile = useFileInput<Array<Record<string, string>>>(parseColorFileContent, []);
    const colorsAlignedFile = useFileInput<Array<Record<string, string>>>(parseColorFileContent, []);
    // Chain color map state.
    const [chainColorMaps] = useState<Map<string, Map<string, Color>>>(new Map());
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
    const {
        chainInfo: chainInfoAligned,
        setChainInfo: setChainInfoAligned,
        selectedChainId: selectedChainIdAligned,
        setSelectedChainId: setSelectedChainIdAligned,
    } = useChainState();
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
        residueInfo: residueInfoAligned,
        setResidueInfo: setResidueInfoAligned,
        selectedResidueIds: selectedResidueIdsAligned,
        setSelectedResidueIds: setSelectedResidueIdsAligned,
        selectedResidueId: selectedResidueIdAligned,
        setSelectedResidueId: setSelectedResidueIdAligned,
    } = useResidueState();
    const pendingSessionSelectionsRef = useRef<SessionUiState['selections'] | null>(null);


    // Track realigned molecules with from/to chain IDs to prevent duplicates
    const [realignedMoleculesA, setRealignedMoleculesA] = useState<Array<{ id: string, file: File, label: string, from: string, to: string }>>([]);
    const [realignedMoleculesB, setRealignedMoleculesB] = useState<Array<{ id: string, file: File, label: string, from: string, to: string }>>([]);
    const [appliedInPlaceRealignPairs, setAppliedInPlaceRealignPairs] = useState<string[]>([]);

    // Use custom confirmation hook
    const confirm = useConfirm();

    // Molecule loading logic extracted to useMoleculeLoader
    // Robust file loading logic for both AlignedTo and Aligned
    const normalizeSessionRepresentation = useCallback((rep: any): SessionRepresentationSpec | null => {
        const typeCandidate = rep?.params?.values?.type?.name ?? rep?.type;
        if (!typeCandidate || !allowedRepresentationTypes.includes(typeCandidate as AllowedRepresentationType)) {
            return null;
        }
        const colorThemeCandidate = rep?.params?.values?.colorTheme ?? rep?.colorTheme;
        if (typeof colorThemeCandidate === 'string') {
            return {
                type: typeCandidate as AllowedRepresentationType,
                colorTheme: { name: colorThemeCandidate, params: {} },
                visible: rep?.visible !== false
            };
        }
        if (colorThemeCandidate && typeof colorThemeCandidate.name === 'string') {
            return {
                type: typeCandidate as AllowedRepresentationType,
                colorTheme: {
                    name: colorThemeCandidate.name,
                    params: colorThemeCandidate.params ?? {}
                },
                visible: rep?.visible !== false
            };
        }
        return {
            type: typeCandidate as AllowedRepresentationType,
            colorTheme: { name: 'default', params: {} },
            visible: rep?.visible !== false
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
            .map((rep: any) => normalizeSessionRepresentation(rep))
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
        };

        return () => {
            if (globalObj.__ribocodeTestApi) {
                delete globalObj.__ribocodeTestApi;
            }
        };
    }, [activeViewer, applySerializableCameraSnapshot, getSerializableCameraSnapshot, syncEnabled, viewerA.ref, viewerB.ref]);

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

            for (const rep of reps) {
                const exactMatch = existingReps.find(existing =>
                    !usedExistingRepRefs.has(existing.repRef) &&
                    existing.type === rep.type &&
                    areThemesEqual(existing.colorTheme, rep.colorTheme)
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

                await molstar.addRepresentation(mode, structureRef, rep.type, rep.colorTheme, repId);

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
        const pluginA = viewerA.ref.current;
        const pluginB = viewerB.ref.current;
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
            setAppliedInPlaceRealignPairs([]);
            setAlignedToFile(file);
            setAlignedToFilename(file.name);
            if (expectedAlignedToFilename) setExpectedAlignedToFilename(null);
            // Ensure the loader button disappears after upload
            viewerA.setIsMoleculeAlignedToLoaded(true);

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
                filename: viewerAMoleculeAlignedTo.filename ?? prev?.filename ?? "",
                presetResult: viewerAMoleculeAlignedTo.presetResult ?? "Unknown",
                trajectory: viewerAMoleculeAlignedTo.trajectory,
                alignmentData: viewerAMoleculeAlignedTo.alignmentData
            }));
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
                filename: viewerBMoleculeAlignedTo.filename ?? prev?.filename ?? "",
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
            setAppliedInPlaceRealignPairs([]);
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
            if (mode === Aligned && alignedFilename && file.name !== alignedFilename) {
                alert(`Selected file name (${file.name}) does not match the expected Aligned file (${alignedFilename}). Please select the correct file.`);
                return;
            }
            // Use the ref for alignmentData to avoid async state issues
            const alignmentData = mode === Aligned ? alignmentDataRef.current : undefined;
            await loadMoleculeIntoViewers(file, mode, alignmentData, [], [], {
                hideInRightViewerByDefault: true,
            });
        },
        [expectedAlignedToFilename, alignedFilename]
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
    
    // Per-viewer residue zoom options
    const [zoomExtraRadiusA, setZoomExtraRadiusA] = useState(0);
    const [zoomMinRadiusA, setZoomMinRadiusA] = useState(0);
    const [zoomExtraRadiusB, setZoomExtraRadiusB] = useState(0);
    const [zoomMinRadiusB, setZoomMinRadiusB] = useState(0);
    const [chainHighlightOnAAlignedTo, setChainHighlightOnAAlignedTo] = useState(false);
    const [chainHighlightOnAAligned, setChainHighlightOnAAligned] = useState(false);
    const [chainHighlightOnBAlignedTo, setChainHighlightOnBAlignedTo] = useState(false);
    const [chainHighlightOnBAligned, setChainHighlightOnBAligned] = useState(false);
    const [residueHighlightOnAAlignedTo, setResidueHighlightOnAAlignedTo] = useState(false);
    const [residueHighlightOnAAligned, setResidueHighlightOnAAligned] = useState(false);
    const [residueHighlightOnBAlignedTo, setResidueHighlightOnBAlignedTo] = useState(false);
    const [residueHighlightOnBAligned, setResidueHighlightOnBAligned] = useState(false);
    const [subunitHighlightOnAAlignedTo, setSubunitHighlightOnAAlignedTo] = useState(false);
    const [subunitHighlightOnAAligned, setSubunitHighlightOnAAligned] = useState(false);
    const [subunitHighlightOnBAlignedTo, setSubunitHighlightOnBAlignedTo] = useState(false);
    const [subunitHighlightOnBAligned, setSubunitHighlightOnBAligned] = useState(false);

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

    // Toggle visibility for moleculeAlignedTo in viewer A.
    const toggleViewerAAlignedTo = {
        handleButtonClick: () =>
            handleToggle(
                viewerA,
                'molecule' + AlignedTo,
                viewerA.setIsMoleculeAlignedToVisible,
                viewerA.isMoleculeAlignedToVisible
            ),
    };

    // Toggle visibility for moleculeAligned in viewer A.
    const toggleViewerAAligned = {
        handleButtonClick: () =>
            handleToggle(
                viewerA,
                'molecule' + Aligned,
                viewerA.setIsMoleculeAlignedVisible,
                viewerA.isMoleculeAlignedVisible
            ),
    };

    // Toggle visibility for moleculeAlignedTo in viewer B.
    const toggleViewerBAlignedTo = {
        handleButtonClick: () =>
            handleToggle(
                viewerB,
                'molecule' + AlignedTo,
                viewerB.setIsMoleculeAlignedToVisible,
                viewerB.isMoleculeAlignedToVisible
            ),
    };

    // Toggle visibility for moleculeAligned in viewer B.
    const toggleViewerBAligned = {
        handleButtonClick: () =>
            handleToggle(
                viewerB,
                'molecule' + Aligned,
                viewerB.setIsMoleculeAlignedVisible,
                viewerB.isMoleculeAlignedVisible
            ),
    };

    // Dummy state to force re-render after toggling representation visibility
    const [, setForceUpdate] = useState(0);
    const forceUpdate = () => setForceUpdate(f => f + 1);

    // Get structure refs for both viewers.
    const structureRefAAlignedTo: string | null = molstarA.structureRefs[AlignedTo];
    const structureRefAAligned: string | null = molstarA.structureRefs[Aligned];
    const structureRefBAlignedTo: string | null = molstarB.structureRefs[AlignedTo];
    const structureRefBAligned: string | null = molstarB.structureRefs[Aligned];
    
    // Theme names for custom chain color themes.
    const themeNameAlignedTo = AlignedTo + '-custom-chain-colors';
    const themeNameAligned = Aligned + '-custom-chain-colors';

    // Representation type state.
    const [representationTypeAlignedTo, setRepresentationTypeAlignedTo] = useState<AllowedRepresentationType>('spacefill');
    const [representationTypeAligned, setRepresentationTypeAligned] = useState<AllowedRepresentationType>('spacefill');

    // Use the custom hook for both color sets (AlignedTo)
    useUpdateColors(
        viewerA.ref.current,
        colorsAlignedToFile.data,
        setIsMoleculeAlignedToColoursLoaded,
        themeNameAlignedTo,
        chainColorMaps,
        [viewerA.moleculeAlignedTo, viewerB.moleculeAlignedTo, representationTypeAlignedTo, structureRefAAlignedTo, structureRefBAlignedTo]
    );
    useUpdateColors(
        viewerB.ref.current,
        colorsAlignedToFile.data,
        setIsMoleculeAlignedToColoursLoaded,
        themeNameAlignedTo,
        chainColorMaps,
        [viewerA.moleculeAlignedTo, viewerB.moleculeAlignedTo, representationTypeAlignedTo, structureRefAAlignedTo, structureRefBAlignedTo]
    );

    // Use the custom hook for both color sets (Aligned)
    useUpdateColors(
        viewerA.ref.current,
        colorsAlignedFile.data,
        setIsMoleculeAlignedColoursLoaded,
        themeNameAligned,
        chainColorMaps,
        [viewerA.moleculeAligned, viewerB.moleculeAligned, representationTypeAligned, structureRefAAligned, structureRefBAligned]
    );
    useUpdateColors(
        viewerB.ref.current,
        colorsAlignedFile.data,
        setIsMoleculeAlignedColoursLoaded,
        themeNameAligned,
        chainColorMaps,
        [viewerA.moleculeAligned, viewerB.moleculeAligned, representationTypeAligned, structureRefAAligned, structureRefBAligned]
    );

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
        showUniprotAccessionInChainLabels,
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
        showUniprotAccessionInChainLabels,
        alignedChainToUniProtOverride,
        alignedChainToMoleculeOverride
    );

    // Generalized effect for residue ID selection and info update.
    useUpdateResidueInfo(viewerA.ref, structureRefAAlignedTo, molstarA, selectedChainIdAlignedTo, setResidueInfoAlignedTo, selectedResidueIdsAlignedTo, setSelectedResidueIdsAlignedTo, AlignedTo);
    useUpdateResidueInfo(viewerB.ref, structureRefBAligned, molstarB, selectedChainIdAligned, setResidueInfoAligned, selectedResidueIdsAligned, setSelectedResidueIdsAligned, Aligned);

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
    });

    const chainHighlightAAlignedTo = makeChainHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainId: selectedChainIdAlignedTo,
        isHighlighted: chainHighlightOnAAlignedTo,
        setIsHighlighted: setChainHighlightOnAAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
    });
    const chainHighlightAAligned = makeChainHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        chainId: selectedChainIdAligned,
        isHighlighted: chainHighlightOnAAligned,
        setIsHighlighted: setChainHighlightOnAAligned,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainId: selectedChainIdAligned,
    });
    const chainHighlightBAlignedTo = makeChainHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        chainId: selectedChainIdAlignedTo,
        isHighlighted: chainHighlightOnBAlignedTo,
        setIsHighlighted: setChainHighlightOnBAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainId: selectedChainIdAlignedTo,
    });
    const chainHighlightBAligned = makeChainHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        chainId: selectedChainIdAligned,
        isHighlighted: chainHighlightOnBAligned,
        setIsHighlighted: setChainHighlightOnBAligned,
        sync: syncEnabled,
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
    const residueZoomLabelAlignedTo = selectedResidueIdsAlignedTo.length > 1
        ? `${selectedResidueIdsAlignedTo.length} residues`
        : (residueInfoAlignedTo.residueLabels.get(selectedResidueIdAlignedTo)?.name || '');
    const residueZoomLabelAligned = selectedResidueIdsAligned.length > 1
        ? `${selectedResidueIdsAligned.length} residues`
        : (residueInfoAligned.residueLabels.get(selectedResidueIdAligned)?.name || '');
    const residueZoomDisabledAlignedTo = selectedResidueIdsAlignedTo.length === 0;
    const residueZoomDisabledAligned = selectedResidueIdsAligned.length === 0;

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
        zoomMinRadius: zoomMinRadiusA
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
        zoomMinRadius: zoomMinRadiusA
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
        zoomMinRadius: zoomMinRadiusB
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
        zoomMinRadius: zoomMinRadiusB
    });

    const residueHighlightAAlignedTo = makeResidueHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainId: selectedChainIdAlignedTo,
        residueIds: selectedResidueIdsAlignedTo,
        residueInsCodes: selectedResidueInsCodesAlignedTo,
        isHighlighted: residueHighlightOnAAlignedTo,
        setIsHighlighted: setResidueHighlightOnAAlignedTo,
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
        isHighlighted: residueHighlightOnAAligned,
        setIsHighlighted: setResidueHighlightOnAAligned,
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
        isHighlighted: residueHighlightOnBAlignedTo,
        setIsHighlighted: setResidueHighlightOnBAlignedTo,
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
        isHighlighted: residueHighlightOnBAligned,
        setIsHighlighted: setResidueHighlightOnBAligned,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainId: selectedChainIdAligned,
        syncResidueIds: selectedResidueIdsAligned,
        syncResidueInsCodes: selectedResidueInsCodesAligned,
    });

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
        zoomMinRadius: zoomMinRadiusA
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
        zoomMinRadius: zoomMinRadiusA
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
        zoomMinRadius: zoomMinRadiusB
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
        zoomMinRadius: zoomMinRadiusB
    });

    const subunitHighlightAAlignedTo = makeSubunitHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAlignedTo,
        chainIds: selectedSubunitChainIdsAlignedTo,
        isHighlighted: subunitHighlightOnAAlignedTo,
        setIsHighlighted: setSubunitHighlightOnAAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAlignedTo,
        syncChainIds: selectedSubunitChainIdsAlignedTo,
    });
    const subunitHighlightAAligned = makeSubunitHighlightToggleHandler({
        pluginRef: viewerA.ref,
        structureRef: structureRefAAligned,
        chainIds: selectedSubunitChainIdsAligned,
        isHighlighted: subunitHighlightOnAAligned,
        setIsHighlighted: setSubunitHighlightOnAAligned,
        sync: syncEnabled,
        syncPluginRef: viewerB.ref,
        syncStructureRef: structureRefBAligned,
        syncChainIds: selectedSubunitChainIdsAligned,
    });
    const subunitHighlightBAlignedTo = makeSubunitHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAlignedTo,
        chainIds: selectedSubunitChainIdsAlignedTo,
        isHighlighted: subunitHighlightOnBAlignedTo,
        setIsHighlighted: setSubunitHighlightOnBAlignedTo,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAlignedTo,
        syncChainIds: selectedSubunitChainIdsAlignedTo,
    });
    const subunitHighlightBAligned = makeSubunitHighlightToggleHandler({
        pluginRef: viewerB.ref,
        structureRef: structureRefBAligned,
        chainIds: selectedSubunitChainIdsAligned,
        isHighlighted: subunitHighlightOnBAligned,
        setIsHighlighted: setSubunitHighlightOnBAligned,
        sync: syncEnabled,
        syncPluginRef: viewerA.ref,
        syncStructureRef: structureRefAAligned,
        syncChainIds: selectedSubunitChainIdsAligned,
    });

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

        if (pending.aligned?.chainId) {
            if (chainInfoAligned.chainLabels.has(pending.aligned.chainId)) {
                setSelectedChainIdAligned(pending.aligned.chainId);
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

        if (alignedToDone && alignedDone) {
            pendingSessionSelectionsRef.current = null;
        }
    }, [
        chainInfoAlignedTo.chainLabels,
        chainInfoAligned.chainLabels,
        residueInfoAlignedTo.residueLabels,
        residueInfoAligned.residueLabels,
        setSelectedChainIdAlignedTo,
        setSelectedChainIdAligned,
        setSelectedResidueIdsAlignedTo,
        setSelectedResidueIdsAligned,
        setSelectedResidueIdAlignedTo,
        setSelectedResidueIdAligned,
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
    const realignmentExists = realignedMoleculesA.some(mol => mol.from === selectedChainIdAlignedTo && mol.to === selectedChainIdAligned)
        || hasRealignPair(appliedInPlaceRealignPairs, selectedChainIdAlignedTo, selectedChainIdAligned);
    const canRealignToSubunits = selectedSubunitAlignedTo !== 'All'
        && selectedSubunitAligned !== 'All'
        && selectedSubunitChainIdsAlignedTo.length > 0
        && selectedSubunitChainIdsAligned.length > 0;
    const subunitFromKey = `subunit:${selectedSubunitAlignedTo}`;
    const subunitToKey = `subunit:${selectedSubunitAligned}`;
    const subunitRealignmentExists = canRealignToSubunits
        && (realignedMoleculesA.some(mol => mol.from === subunitFromKey && mol.to === subunitToKey)
            || hasRealignPair(appliedInPlaceRealignPairs, subunitFromKey, subunitToKey));

    const canRealignToResidues = !!selectedChainIdAlignedTo
        && !!selectedChainIdAligned
        && selectedResidueIdsAlignedTo.length > 0
        && selectedResidueIdsAligned.length > 0;
    const residueFromKey = `residue:${selectedChainIdAlignedTo}:${selectedResidueIdsAlignedTo.slice().sort().join(',')}`;
    const residueToKey = `residue:${selectedChainIdAligned}:${selectedResidueIdsAligned.slice().sort().join(',')}`;
    const residueRealignmentExists = canRealignToResidues
        && (realignedMoleculesA.some(mol => mol.from === residueFromKey && mol.to === residueToKey)
            || hasRealignPair(appliedInPlaceRealignPairs, residueFromKey, residueToKey));

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
        console.log('structureAlignedTo:', structureAlignedTo);
        if (!viewerA.moleculeAlignedTo) {
            console.warn('Viewer A moleculeAlignedTo not available.');
            return;
        }
        const structureAligned = pluginA.managers.structure.hierarchy.current.structures.find(
            s => s.cell.transform.ref === structureRefAAligned
        )?.cell.obj?.data;
        console.log('structureAligned:', structureAligned);
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
        // Extract atom data for each structure using structure.units, filtered by selected chain
        const atomDataAlignedTo = getAtomDataFromStructureUnits(structureAlignedTo, selectedChainIdAlignedTo);
        const atomDataAligned = getAtomDataFromStructureUnits(structureAligned, selectedChainIdAligned);

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

        console.log('[Re-align][Chain atom summary]', {
            alignedTo: {
                chainId: selectedChainIdAlignedTo,
                ...summarize(alignedToSummary),
            },
            aligned: {
                chainId: selectedChainIdAligned,
                ...summarize(alignedSummary),
            }
        });

        if (alignedToSummary.finiteAtomCount === 0 || alignedSummary.finiteAtomCount === 0) {
            console.warn('[Re-align] Could not proceed: one or both selected chains contain no finite atom coordinates.', {
                alignedToChainId: selectedChainIdAlignedTo,
                alignedChainId: selectedChainIdAligned,
                alignedToFiniteAtomCount: alignedToSummary.finiteAtomCount,
                alignedFiniteAtomCount: alignedSummary.finiteAtomCount,
            });
            return;
        }

        try {
            const allChainAtomTypes = new Set<string>();
            for (const t of atomDataAligned.symbolTypes) {
                if (typeof t === 'string' && t.length > 0) allChainAtomTypes.add(t);
            }
            for (const t of atomDataAlignedTo.symbolTypes) {
                if (typeof t === 'string' && t.length > 0) allChainAtomTypes.add(t);
            }
            const selectedAtomTypesForChainRealign = allChainAtomTypes.size > 0
                ? Object.fromEntries(Array.from(allChainAtomTypes).map(atomType => [atomType, true]))
                : selectedAtomTypes;
            console.log('[Re-align][Atom selector]', {
                mode: allChainAtomTypes.size > 0 ? 'all-chain-atom-types' : 'fallback-default-types',
                atomTypeCount: Object.keys(selectedAtomTypesForChainRealign).length,
                atomTypes: Object.keys(selectedAtomTypesForChainRealign),
            });

            const result = alignDatasetUsingChains(
                selectedAtomTypesForChainRealign,
                selectedChainIdAligned,
                atomDataAligned.symbolTypes,
                atomDataAligned.chainIds,
                atomDataAligned.xs,
                atomDataAligned.ys,
                atomDataAligned.zs,
                selectedChainIdAlignedTo,
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
                    selectedAtomTypesForChainRealign[type]
                    && isFiniteCoord(atomDataAligned.xs[idx], atomDataAligned.ys[idx], atomDataAligned.zs[idx])
                )
                .map(({ idx }) => idx);

            const referencePairIndexes = atomDataAlignedTo.symbolTypes
                .map((type, idx) => ({ type, idx }))
                .filter(({ type, idx }) =>
                    selectedAtomTypesForChainRealign[type]
                    && isFiniteCoord(atomDataAlignedTo.xs[idx], atomDataAlignedTo.ys[idx], atomDataAlignedTo.zs[idx])
                )
                .map(({ idx }) => idx);

            const atomPairCount = Math.min(movingPairIndexes.length, referencePairIndexes.length);
            let pairwiseRmsd = NaN;
            if (atomPairCount > 0) {
                let sumSq = 0;
                for (let i = 0; i < atomPairCount; i++) {
                    const movingIdx = movingPairIndexes[i];
                    const referenceIdx = referencePairIndexes[i];
                    const dx = result.alignedX[movingIdx] - atomDataAlignedTo.xs[referenceIdx];
                    const dy = result.alignedY[movingIdx] - atomDataAlignedTo.ys[referenceIdx];
                    const dz = result.alignedZ[movingIdx] - atomDataAlignedTo.zs[referenceIdx];
                    sumSq += dx * dx + dy * dy + dz * dz;
                }
                pairwiseRmsd = Math.sqrt(sumSq / atomPairCount);
            }

            console.log('[Re-align][Fit quality]', {
                movingSelectedAtomCount: movingPairIndexes.length,
                referenceSelectedAtomCount: referencePairIndexes.length,
                atomPairCount,
                rmsd: Number.isFinite(pairwiseRmsd) ? Number(pairwiseRmsd.toFixed(4)) : pairwiseRmsd,
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
                    const structureEntry = plugin.managers.structure.hierarchy.current.structures.find(
                        s => s.cell.transform.ref === structureRef
                    );
                    const coordinateSystem = structureEntry?.transform?.cell.obj?.data.coordinateSystem;
                    const matrix = coordinateSystem && !Mat4.isIdentity(coordinateSystem.matrix)
                        ? Mat4.mul(Mat4(), coordinateSystem.matrix, baseTransform)
                        : baseTransform;
                    await applyStructureTransformInPlace(plugin, structureRef, matrix, tag);
                };

                await applyToViewer(pluginAInPlace, structureRefAAligned, 'ribocode-realign-inplace');
                await applyToViewer(pluginBInPlace, structureRefBAligned, 'ribocode-realign-inplace');
                return true;
            };

            console.log('Alignment result:', result);
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

                try {
                    const appliedInPlace = await applyInPlaceRealign();
                    if (appliedInPlace) {
                        setAppliedInPlaceRealignPairs(prev => addRealignPair(prev, selectedChainIdAlignedTo, selectedChainIdAligned));
                        // Keep the transformed structure in frame automatically.
                        await chainZoomBAligned.handleButtonClick();
                        console.log('[Re-align] Applied in-place transform to existing aligned structures.');
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
                console.log('[Re-align] Applied reload-based fallback realign.');
            })();
            console.log('Realignment applied to Viewer A and B models.');
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
                    const structureEntry = plugin.managers.structure.hierarchy.current.structures.find(
                        s => s.cell.transform.ref === structureRef
                    );
                    const coordinateSystem = structureEntry?.transform?.cell.obj?.data.coordinateSystem;
                    const matrix = coordinateSystem && !Mat4.isIdentity(coordinateSystem.matrix)
                        ? Mat4.mul(Mat4(), coordinateSystem.matrix, baseTransform)
                        : baseTransform;
                    await applyStructureTransformInPlace(plugin, structureRef, matrix, tag);
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

                try {
                    const appliedInPlace = await applyInPlaceRealign();
                    if (appliedInPlace) {
                        setAppliedInPlaceRealignPairs(prev => addRealignPair(prev, subunitFromKey, subunitToKey));
                        await subunitZoomBAligned.handleButtonClick();
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
                console.log('[Re-align Subunit] Applied reload-based fallback realign.');
            })();
        } catch (err) {
            console.error('Subunit alignment error:', err);
        }
    };

    const handleRealignToResidues = () => {
        if (!canRealignToResidues || residueRealignmentExists) return;
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

        const atomDataAlignedTo = buildAtomDataForResidueGroup(
            structureAlignedTo,
            selectedResidueIdsAlignedTo,
            residueInfoAlignedTo.residueToAtomIds
        );
        const atomDataAligned = buildAtomDataForResidueGroup(
            structureAligned,
            selectedResidueIdsAligned,
            residueInfoAligned.residueToAtomIds
        );

        const alignedToSummary = summarizeAtomCloud(atomDataAlignedTo.xs, atomDataAlignedTo.ys, atomDataAlignedTo.zs);
        const alignedSummary = summarizeAtomCloud(atomDataAligned.xs, atomDataAligned.ys, atomDataAligned.zs);
        if (alignedToSummary.finiteAtomCount === 0 || alignedSummary.finiteAtomCount === 0) {
            console.warn('[Re-align Residue] Could not proceed: one or both selected residue sets contain no finite atom coordinates.', {
                selectedResidueIdsAlignedTo,
                selectedResidueIdsAligned,
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
                    const structureEntry = plugin.managers.structure.hierarchy.current.structures.find(
                        s => s.cell.transform.ref === structureRef
                    );
                    const coordinateSystem = structureEntry?.transform?.cell.obj?.data.coordinateSystem;
                    const matrix = coordinateSystem && !Mat4.isIdentity(coordinateSystem.matrix)
                        ? Mat4.mul(Mat4(), coordinateSystem.matrix, baseTransform)
                        : baseTransform;
                    await applyStructureTransformInPlace(plugin, structureRef, matrix, tag);
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

                try {
                    const appliedInPlace = await applyInPlaceRealign();
                    if (appliedInPlace) {
                        setAppliedInPlaceRealignPairs(prev => addRealignPair(prev, residueFromKey, residueToKey));
                        await residueZoomBAligned.handleButtonClick();
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
                console.log('[Re-align Residue] Applied reload-based fallback realign.');
            })();
        } catch (err) {
            console.error('Residue alignment error:', err);
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

    // Session save: use custom hook
    const handleSaveSession = useSessionSave(() => ({
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
                    residueId: selectedResidueIdAlignedTo,
                    residueIds: selectedResidueIdsAlignedTo,
                },
                aligned: {
                    subunit: selectedSubunitAligned,
                    chainId: selectedChainIdAligned,
                    residueId: selectedResidueIdAligned,
                    residueIds: selectedResidueIdsAligned,
                },
            },
            syncEnabled,
            activeViewer,
            cameraSnapshots: {
                viewerA: getSerializableCameraSnapshot(viewerA.ref),
                viewerB: getSerializableCameraSnapshot(viewerB.ref),
            },
            uniprotGeneNames,
            showUniprotAccessionInChainLabels,
            chainFinderQueries: {
                alignedTo: chainFinderQueryAlignedTo,
                aligned: chainFinderQueryAligned,
            },
        } as SessionUiState,
    }));

    const handleSaveSessionAll = useSessionSaveAll(
        () => ({
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
                        residueId: selectedResidueIdAlignedTo,
                        residueIds: selectedResidueIdsAlignedTo,
                    },
                    aligned: {
                        subunit: selectedSubunitAligned,
                        chainId: selectedChainIdAligned,
                        residueId: selectedResidueIdAligned,
                        residueIds: selectedResidueIdsAligned,
                    },
                },
                syncEnabled,
                activeViewer,
                cameraSnapshots: {
                    viewerA: getSerializableCameraSnapshot(viewerA.ref),
                    viewerB: getSerializableCameraSnapshot(viewerB.ref),
                },
                uniprotGeneNames,
                showUniprotAccessionInChainLabels,
                chainFinderQueries: {
                    alignedTo: chainFinderQueryAlignedTo,
                    aligned: chainFinderQueryAligned,
                },
            } as SessionUiState,
        }),
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
                if (Array.isArray((uiState.selections.alignedTo as any).residueIds)) {
                    setSelectedResidueIdsAlignedTo((uiState.selections.alignedTo as any).residueIds.filter((id: unknown) => typeof id === 'string'));
                } else if (typeof uiState.selections.alignedTo.residueId === 'string') {
                    setSelectedResidueIdAlignedTo(uiState.selections.alignedTo.residueId);
                }
            }
            if (uiState?.selections?.aligned) {
                if (typeof uiState.selections.aligned.subunit === 'string') setSelectedSubunitAligned(uiState.selections.aligned.subunit as any);
                if (typeof uiState.selections.aligned.chainId === 'string') setSelectedChainIdAligned(uiState.selections.aligned.chainId);
                if (Array.isArray((uiState.selections.aligned as any).residueIds)) {
                    setSelectedResidueIdsAligned((uiState.selections.aligned as any).residueIds.filter((id: unknown) => typeof id === 'string'));
                } else if (typeof uiState.selections.aligned.residueId === 'string') {
                    setSelectedResidueIdAligned(uiState.selections.aligned.residueId);
                }
            }

            // Restore per-viewer camera snapshots with sync temporarily disabled so
            // one viewer snapshot does not immediately overwrite the other.
            const shouldReEnableSyncAfterRestore = uiState?.syncEnabled === true;
            setSyncEnabled(false);
            await new Promise(resolve => setTimeout(resolve, 0));

            if (uiState?.activeViewer === A || uiState?.activeViewer === B) {
                setActiveViewer(uiState.activeViewer);
            }
            if (uiState?.cameraSnapshots) {
                applySerializableCameraSnapshot(viewerA.ref, uiState.cameraSnapshots.viewerA);
                applySerializableCameraSnapshot(viewerB.ref, uiState.cameraSnapshots.viewerB);
            }
            setSyncEnabled(shouldReEnableSyncAfterRestore);

            pendingSessionSelectionsRef.current = uiState?.selections ?? null;
            if (uiState?.uniprotGeneNames && typeof uiState.uniprotGeneNames === 'object') {
                const resolvedOnly = filterResolvedGeneNames(uiState.uniprotGeneNames);
                setUniprotGeneNames(prev => ({ ...prev, ...resolvedOnly }));
            }
            if (typeof uiState?.showUniprotAccessionInChainLabels === 'boolean') {
                setShowUniprotAccessionInChainLabels(uiState.showUniprotAccessionInChainLabels);
            } else if (uiState?.showUniprotAccessionInChainLabelsByViewer) {
                if (typeof uiState.showUniprotAccessionInChainLabelsByViewer.viewerA === 'boolean') {
                    setShowUniprotAccessionInChainLabels(uiState.showUniprotAccessionInChainLabelsByViewer.viewerA);
                } else if (typeof uiState.showUniprotAccessionInChainLabelsByViewer.viewerB === 'boolean') {
                    setShowUniprotAccessionInChainLabels(uiState.showUniprotAccessionInChainLabelsByViewer.viewerB);
                }
            }
            if (typeof uiState?.chainFinderQueries?.alignedTo === 'string') {
                setChainFinderQueryAlignedTo(uiState.chainFinderQueries.alignedTo);
            }
            if (typeof uiState?.chainFinderQueries?.aligned === 'string') {
                setChainFinderQueryAligned(uiState.chainFinderQueries.aligned);
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
        setSelectedSubunitAlignedTo,
        setSelectedSubunitAligned,
        setSelectedChainIdAlignedTo,
        setSelectedChainIdAligned,
        setSelectedResidueIdsAlignedTo,
        setSelectedResidueIdsAligned,
        setSelectedResidueIdAlignedTo,
        setSelectedResidueIdAligned,
        setClippingA,
        setClippingB,
        setChainFinderQueryAlignedTo,
        setChainFinderQueryAligned,
        setUniprotGeneNames,
        setShowUniprotAccessionInChainLabels,
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
                    {/* Session menu dropdown below the title */}
                    <nav className="session-menu-bar">
                        <div className="session-menu-container">
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
                    </nav>
                    {SessionLoadModal}
                    <GeneralControls
                        viewerA={viewerA.ref.current}
                        viewerB={viewerB.ref.current}
                        activeViewer={activeViewer}
                        syncEnabled={syncEnabled}
                        setSyncEnabled={setSyncEnabled}
                        syncDisabled={!viewerA.isMoleculeAlignedLoaded || !viewerB.isMoleculeAlignedLoaded}
                        showUniprotAccessionInChainLabels={showUniprotAccessionInChainLabels}
                        setShowUniprotAccessionInChainLabels={setShowUniprotAccessionInChainLabels}
                        uniprotLookupStatus={{
                            completed: completedUniProtCount,
                            pending: pendingUniProtCount,
                            inFlight: inFlightUniProtCount,
                        }}
                        selectedChainIdAlignedTo={selectedChainIdAlignedTo}
                        selectedChainIdAligned={selectedChainIdAligned}
                        realignmentExists={realignmentExists}
                        handleRealignToChains={handleRealignToChains}
                        canRealignToResidues={canRealignToResidues}
                        residueRealignmentExists={residueRealignmentExists}
                        residueRealignSummary={`${selectedResidueIdsAlignedTo.length} to ${selectedResidueIdsAligned.length}`}
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
                                    colorsFile: colorsAlignedToFile,
                                    isMoleculeColoursLoaded: isMoleculeAlignedToColoursLoaded,
                                    structureRef: structureRefAAlignedTo,
                                    otherStructureRef: structureRefBAlignedTo,
                                    selectedSubunit: selectedSubunitAlignedTo,
                                    setSelectedSubunit: setSelectedSubunitAlignedTo,
                                    subunitZoomLabel: selectedSubunitAlignedTo,
                                    onSubunitHighlight: subunitHighlightAAlignedTo.handleButtonClick,
                                    subunitHighlightOn: subunitHighlightOnAAlignedTo,
                                    subunitHighlightDisabled: selectedSubunitChainIdsAlignedTo.length === 0 && !subunitHighlightOnAAlignedTo,
                                    onSubunitZoom: subunitZoomAAlignedTo.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAlignedTo.length === 0,
                                    subunitToChainIds: subunitToChainIdsAlignedTo,
                                    chainInfo: chainInfoAlignedTo,
                                    selectedChainId: selectedChainIdAlignedTo,
                                    setSelectedChainId: setSelectedChainIdAlignedTo,
                                    chainZoomLabel: selectedChainIdAlignedTo && chainInfoAlignedTo.chainLabels.has(selectedChainIdAlignedTo)
                                        ? chainInfoAlignedTo.chainLabels.get(selectedChainIdAlignedTo) ?? ''
                                        : '',
                                    onChainHighlight: chainHighlightAAlignedTo.handleButtonClick,
                                    chainHighlightOn: chainHighlightOnAAlignedTo,
                                    chainHighlightDisabled: !selectedChainIdAlignedTo && !chainHighlightOnAAlignedTo,
                                    onChainZoom: chainZoomAAlignedTo.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAlignedTo,
                                    residueInfo: residueInfoAlignedTo,
                                    selectedResidueIds: selectedResidueIdsAlignedTo,
                                    setSelectedResidueIds: setSelectedResidueIdsAlignedTo,
                                    residueZoomLabel: residueZoomLabelAlignedTo,
                                    onResidueHighlight: residueHighlightAAlignedTo.handleButtonClick,
                                    residueHighlightOn: residueHighlightOnAAlignedTo,
                                    residueHighlightDisabled: selectedResidueIdsAlignedTo.length === 0 && !residueHighlightOnAAlignedTo,
                                    onResidueZoom: residueZoomAAlignedTo.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAlignedTo,
                                    zoomExtraRadius: zoomExtraRadiusA,
                                    setZoomExtraRadius: setZoomExtraRadiusA,
                                    zoomMinRadius: zoomMinRadiusA,
                                    setZoomMinRadius: setZoomMinRadiusA,
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
                                    colorsFile: colorsAlignedFile,
                                    isMoleculeColoursLoaded: isMoleculeAlignedColoursLoaded,
                                    structureRef: structureRefAAligned,
                                    otherStructureRef: structureRefBAligned,
                                    selectedSubunit: selectedSubunitAligned,
                                    setSelectedSubunit: setSelectedSubunitAligned,
                                    subunitZoomLabel: selectedSubunitAligned,
                                    onSubunitHighlight: subunitHighlightAAligned.handleButtonClick,
                                    subunitHighlightOn: subunitHighlightOnAAligned,
                                    subunitHighlightDisabled: selectedSubunitChainIdsAligned.length === 0 && !subunitHighlightOnAAligned,
                                    onSubunitZoom: subunitZoomAAligned.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAligned.length === 0,
                                    subunitToChainIds: subunitToChainIdsAligned,
                                    chainInfo: chainInfoAligned,
                                    selectedChainId: selectedChainIdAligned,
                                    setSelectedChainId: setSelectedChainIdAligned,
                                    chainZoomLabel: selectedChainIdAligned && chainInfoAligned.chainLabels.has(selectedChainIdAligned)
                                        ? chainInfoAligned.chainLabels.get(selectedChainIdAligned) ?? ''
                                        : '',
                                    onChainHighlight: chainHighlightAAligned.handleButtonClick,
                                    chainHighlightOn: chainHighlightOnAAligned,
                                    chainHighlightDisabled: !selectedChainIdAligned && !chainHighlightOnAAligned,
                                    onChainZoom: chainZoomAAligned.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAligned,
                                    residueInfo: residueInfoAligned,
                                    selectedResidueIds: selectedResidueIdsAligned,
                                    setSelectedResidueIds: setSelectedResidueIdsAligned,
                                    residueZoomLabel: residueZoomLabelAligned,
                                    onResidueHighlight: residueHighlightAAligned.handleButtonClick,
                                    residueHighlightOn: residueHighlightOnAAligned,
                                    residueHighlightDisabled: selectedResidueIdsAligned.length === 0 && !residueHighlightOnAAligned,
                                    onResidueZoom: residueZoomAAligned.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAligned,
                                    zoomExtraRadius: zoomExtraRadiusA,
                                    setZoomExtraRadius: setZoomExtraRadiusA,
                                    zoomMinRadius: zoomMinRadiusA,
                                    setZoomMinRadius: setZoomMinRadiusA,
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
                                    AlignedTo
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
                                    colorsFile: colorsAlignedToFile,
                                    isMoleculeColoursLoaded: isMoleculeAlignedToColoursLoaded,
                                    structureRef: structureRefBAlignedTo,
                                    otherStructureRef: structureRefAAlignedTo,
                                    selectedSubunit: selectedSubunitAlignedTo,
                                    setSelectedSubunit: setSelectedSubunitAlignedTo,
                                    subunitZoomLabel: selectedSubunitAlignedTo,
                                    onSubunitHighlight: subunitHighlightBAlignedTo.handleButtonClick,
                                    subunitHighlightOn: subunitHighlightOnBAlignedTo,
                                    subunitHighlightDisabled: selectedSubunitChainIdsAlignedTo.length === 0 && !subunitHighlightOnBAlignedTo,
                                    onSubunitZoom: subunitZoomBAlignedTo.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAlignedTo.length === 0,
                                    subunitToChainIds: subunitToChainIdsAlignedTo,
                                    chainInfo: chainInfoAlignedTo,
                                    selectedChainId: selectedChainIdAlignedTo,
                                    setSelectedChainId: setSelectedChainIdAlignedTo,
                                    chainZoomLabel: selectedChainIdAlignedTo && chainInfoAlignedTo.chainLabels.has(selectedChainIdAlignedTo)
                                        ? chainInfoAlignedTo.chainLabels.get(selectedChainIdAlignedTo) ?? ''
                                        : '',
                                    onChainHighlight: chainHighlightBAlignedTo.handleButtonClick,
                                    chainHighlightOn: chainHighlightOnBAlignedTo,
                                    chainHighlightDisabled: !selectedChainIdAlignedTo && !chainHighlightOnBAlignedTo,
                                    onChainZoom: chainZoomBAlignedTo.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAlignedTo,
                                    residueInfo: residueInfoAlignedTo,
                                    selectedResidueIds: selectedResidueIdsAlignedTo,
                                    setSelectedResidueIds: setSelectedResidueIdsAlignedTo,
                                    residueZoomLabel: residueZoomLabelAlignedTo,
                                    onResidueHighlight: residueHighlightBAlignedTo.handleButtonClick,
                                    residueHighlightOn: residueHighlightOnBAlignedTo,
                                    residueHighlightDisabled: selectedResidueIdsAlignedTo.length === 0 && !residueHighlightOnBAlignedTo,
                                    onResidueZoom: residueZoomBAlignedTo.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAlignedTo,
                                    zoomExtraRadius: zoomExtraRadiusB,
                                    setZoomExtraRadius: setZoomExtraRadiusB,
                                    zoomMinRadius: zoomMinRadiusB,
                                    setZoomMinRadius: setZoomMinRadiusB,
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
                                    isMoleculeAlignedLoaded: !!(viewerB.moleculeAligned && viewerB.moleculeAligned.filename),
                                    isMoleculeAlignedToLoaded: viewerB.isMoleculeAlignedToLoaded,
                                    viewerReady: viewerBReady,
                                    otherViewerReady: viewerAReady,
                                    representationType: representationTypeAligned,
                                    setRepresentationType: setRepresentationTypeAligned,
                                    colorsFile: colorsAlignedFile,
                                    isMoleculeColoursLoaded: isMoleculeAlignedColoursLoaded,
                                    structureRef: structureRefBAligned,
                                    otherStructureRef: structureRefAAligned,
                                    selectedSubunit: selectedSubunitAligned,
                                    setSelectedSubunit: setSelectedSubunitAligned,
                                    subunitZoomLabel: selectedSubunitAligned,
                                    onSubunitHighlight: subunitHighlightBAligned.handleButtonClick,
                                    subunitHighlightOn: subunitHighlightOnBAligned,
                                    subunitHighlightDisabled: selectedSubunitChainIdsAligned.length === 0 && !subunitHighlightOnBAligned,
                                    onSubunitZoom: subunitZoomBAligned.handleButtonClick,
                                    subunitZoomDisabled: selectedSubunitChainIdsAligned.length === 0,
                                    subunitToChainIds: subunitToChainIdsAligned,
                                    chainInfo: chainInfoAligned,
                                    selectedChainId: selectedChainIdAligned,
                                    setSelectedChainId: setSelectedChainIdAligned,
                                    chainZoomLabel: selectedChainIdAligned && chainInfoAligned.chainLabels.has(selectedChainIdAligned)
                                        ? chainInfoAligned.chainLabels.get(selectedChainIdAligned) ?? ''
                                        : '',
                                    onChainHighlight: chainHighlightBAligned.handleButtonClick,
                                    chainHighlightOn: chainHighlightOnBAligned,
                                    chainHighlightDisabled: !selectedChainIdAligned && !chainHighlightOnBAligned,
                                    onChainZoom: chainZoomBAligned.handleButtonClick,
                                    chainZoomDisabled: !selectedChainIdAligned,
                                    residueInfo: residueInfoAligned,
                                    selectedResidueIds: selectedResidueIdsAligned,
                                    setSelectedResidueIds: setSelectedResidueIdsAligned,
                                    residueZoomLabel: residueZoomLabelAligned,
                                    onResidueHighlight: residueHighlightBAligned.handleButtonClick,
                                    residueHighlightOn: residueHighlightOnBAligned,
                                    residueHighlightDisabled: selectedResidueIdsAligned.length === 0 && !residueHighlightOnBAligned,
                                    onResidueZoom: residueZoomBAligned.handleButtonClick,
                                    residueZoomDisabled: residueZoomDisabledAligned,
                                    zoomExtraRadius: zoomExtraRadiusB,
                                    setZoomExtraRadius: setZoomExtraRadiusB,
                                    zoomMinRadius: zoomMinRadiusB,
                                    setZoomMinRadius: setZoomMinRadiusB,
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
                                    // Ensure loadedFilename is always passed explicitly for Aligned
                                    loadedFilename: viewerB.moleculeAligned?.filename || viewerB.moleculeAligned?.name || viewerB.moleculeAligned?.label || '',
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
                                    AlignedTo
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