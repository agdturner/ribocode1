
/**
 * Test suite for ViewerColumn component.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-06-11
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import ViewerColumn, { getMoleculeUIAlignedProps, idSuffix as viewerColumnIdSuffix } from './ViewerColumn';
import { idSuffix as moleculeIdSuffix } from './Molecule';
import { getLoadDataRowProps } from './ViewerColumn';

// Mock props for ViewerColumn
const loadDataRowProps = {
    representationType: 'spacefill',
    onRepresentationTypeChange: vi.fn(),
    representationTypeDisabled: false,
    onAddColorsClick: vi.fn(),
    addColorsDisabled: false,
    selectedSubunit: 'All',
    onSelectSubunit: vi.fn(),
    subunitSelectDisabled: false,
    chainInfo: { chainLabels: new Map() },
    selectedChainId: '',
    onSelectChainId: vi.fn(),
    chainSelectDisabled: false,
    residueInfo: { residueLabels: new Map(), residueToAtomIds: {} },
    selectedResidueId: '',
    onSelectResidueId: vi.fn(),
    residueSelectDisabled: false,
    onAddRepresentationClick: vi.fn(),
    addRepresentationDisabled: false,
    fogEnabled: false,
    fogNear: 0.5,
    fogFar: 2.0,
    onFogEnabledChange: vi.fn(),
    onFogNearChange: vi.fn(),
    onFogFarChange: vi.fn(),
    cameraNear: 0.1,
    cameraFar: 100,
    onCameraNearChange: vi.fn(),
    onCameraFarChange: vi.fn(),
};
// Minimal valid props for MoleculeUI
const minimalMoleculeUIProps = {
    label: 'Test Molecule',
    plugin: null,
    isVisible: true,
    onToggleVisibility: vi.fn(),
    chainZoomLabel: 'A',
    onChainZoom: vi.fn(),
    chainZoomDisabled: false,
    residueZoomLabel: '1',
    onResidueZoom: vi.fn(),
    residueZoomDisabled: false,
    isLoaded: true,
    forceUpdate: vi.fn(),
    representationRefs: [],
};
const moleculeUIAlignedToProps = { ...minimalMoleculeUIProps, label: 'MoleculeUI AlignedTo' };
const moleculeUIAlignedProps = { ...minimalMoleculeUIProps, label: 'MoleculeUI Aligned' };
const realignedMoleculeListProps = {
    molecules: [],
    molstar: { pluginRef: { current: null }, representationRefs: {}, repIdMap: {} },
    chainInfo: { chainLabels: new Map() },
    residueInfo: { residueLabels: new Map() },
    selectedResidueId: '',
    realignedStructRefs: {},
    setRealignedMolecules: vi.fn(),
    setRealignedRepRefs: vi.fn(),
    setRealignedStructRefs: vi.fn(),
    forceUpdate: vi.fn(),
    viewerKey: 'A',
    otherMolstar: { pluginRef: { current: null }, representationRefs: {}, repIdMap: {} },
    otherRealignedStructRefs: {},
    setOtherRealignedMolecules: vi.fn(),
    setOtherRealignedRepRefs: vi.fn(),
    setOtherRealignedStructRefs: vi.fn(),
};
const molstarContainerProps = {
    setViewer: vi.fn(),
};

describe('ViewerColumn', () => {


    it('renders all subcomponents with minimal valid props', () => {
        // The idPrefix logic in ViewerColumn composes viewerIdPrefix = `${idPrefix}-${viewerColumnIdSuffix}-${viewerKey}`
        const rootIdPrefix = `viewer-A-viewer-column-A`;
        const alignedToLabel = 'MoleculeUI AlignedTo';
        const alignedLabel = 'MoleculeUI Aligned';
        render(
            <ViewerColumn
                viewerKey="A"
                loadDataRowPropsAlignedTo={loadDataRowProps}
                loadDataRowPropsAligned={loadDataRowProps}
                moleculeUIAlignedToProps={{ ...moleculeUIAlignedToProps, label: alignedToLabel }}
                moleculeUIAlignedProps={{ ...moleculeUIAlignedProps, label: alignedLabel }}
                realignedMoleculeListProps={realignedMoleculeListProps}
                molstarContainerProps={molstarContainerProps}
                idPrefix={"viewer-A"}
            />
        );
        // The id construction matches MoleculeUI: `${idPrefix}-${moleculeIdSuffix}-${label.replace(/\s+/g, '-').toLowerCase()}`
        const alignedToId = `${rootIdPrefix}-${moleculeIdSuffix}-${alignedToLabel.replace(/\s+/g, '-').toLowerCase()}`;
        const alignedId = `${rootIdPrefix}-${moleculeIdSuffix}-${alignedLabel.replace(/\s+/g, '-').toLowerCase()}`;
        const alignedTo = document.getElementById(alignedToId);
        const aligned = document.getElementById(alignedId);
        // Debug: log the DOM and ids
        // eslint-disable-next-line no-console
        console.log('alignedToId', alignedToId, 'alignedId', alignedId);
        // eslint-disable-next-line no-console
        console.log('container.innerHTML:', document.body.innerHTML);
        expect(alignedTo).toBeInTheDocument();
        expect(aligned).toBeInTheDocument();
    });

    it('applies idPrefix to root and propagates to RibocodeViewer', () => {
        const idPrefix = 'test-root';
        render(
            <ViewerColumn
                viewerKey="A"
                loadDataRowPropsAlignedTo={loadDataRowProps}
                loadDataRowPropsAligned={loadDataRowProps}
                moleculeUIAlignedToProps={moleculeUIAlignedToProps}
                moleculeUIAlignedProps={moleculeUIAlignedProps}
                realignedMoleculeListProps={realignedMoleculeListProps}
                molstarContainerProps={molstarContainerProps}
                idPrefix={idPrefix}
            />
        );
        // Root div id
        const root = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A`);
        expect(root).toBeInTheDocument();
        // RibocodeViewer id
        const ribocodeViewer = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A-ribocode-viewer`);
        expect(ribocodeViewer).toBeInTheDocument();
    });

    it('renders advanced Mol* controls toggle collapsed by default and toggles open/closed', () => {
        const idPrefix = 'test-root';
        render(
            <ViewerColumn
                viewerKey="A"
                loadDataRowPropsAlignedTo={loadDataRowProps}
                loadDataRowPropsAligned={loadDataRowProps}
                moleculeUIAlignedToProps={moleculeUIAlignedToProps}
                moleculeUIAlignedProps={moleculeUIAlignedProps}
                realignedMoleculeListProps={realignedMoleculeListProps}
                molstarContainerProps={molstarContainerProps}
                idPrefix={idPrefix}
            />
        );

        const toggleButton = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A-advanced-molstar-controls-toggle-btn`);
        expect(toggleButton).toBeInTheDocument();
        expect(toggleButton).toHaveTextContent('Show Advanced Mol* Controls');

        const closedPanel = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A-advanced-molstar-controls-panel`);
        expect(closedPanel).toBeNull();

        fireEvent.click(toggleButton as HTMLElement);
        expect(toggleButton).toHaveTextContent('Hide Advanced Mol* Controls');
        const openedPanel = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A-advanced-molstar-controls-panel`);
        expect(openedPanel).toBeInTheDocument();

        fireEvent.click(toggleButton as HTMLElement);
        expect(toggleButton).toHaveTextContent('Show Advanced Mol* Controls');
        const reClosedPanel = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A-advanced-molstar-controls-panel`);
        expect(reClosedPanel).toBeNull();
    });

    it('renders Mol* viewer above controls so both columns stay top-aligned', () => {
        const idPrefix = 'test-root';
        const loadDataRowPropsWithChains = {
            ...loadDataRowProps,
            chainInfo: { chainLabels: new Map([['A', 'Chain A']]) },
        };
        render(
            <ViewerColumn
                viewerKey="A"
                loadDataRowPropsAlignedTo={loadDataRowPropsWithChains}
                loadDataRowPropsAligned={loadDataRowPropsWithChains}
                moleculeUIAlignedToProps={moleculeUIAlignedToProps}
                moleculeUIAlignedProps={moleculeUIAlignedProps}
                realignedMoleculeListProps={realignedMoleculeListProps}
                molstarContainerProps={molstarContainerProps}
                idPrefix={idPrefix}
            />
        );

        const root = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A`);
        const molstarContainer = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A-molstar-container`);
        const chainFinder = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A-chain-table-container`);
        const toggleButton = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A-advanced-molstar-controls-toggle-btn`);

        expect(root).toBeInTheDocument();
        expect(molstarContainer).toBeInTheDocument();
        expect(chainFinder).toBeInTheDocument();
        expect(toggleButton).toBeInTheDocument();

        expect(root?.firstElementChild?.id).toBe(`${idPrefix}-${viewerColumnIdSuffix}-A-molstar-container`);

        const children = Array.from(root?.children ?? []);
        const chainFinderIndex = children.findIndex((child) => child.id === `${idPrefix}-${viewerColumnIdSuffix}-A-chain-table-container`);
        const toggleIndex = children.findIndex((child) => child.id === `${idPrefix}-${viewerColumnIdSuffix}-A-advanced-molstar-controls-toggle-btn`);

        expect(chainFinderIndex).toBeGreaterThan(-1);
        expect(toggleIndex).toBeGreaterThan(chainFinderIndex);

        fireEvent.click(toggleButton as HTMLElement);
        const advancedPanel = document.getElementById(`${idPrefix}-${viewerColumnIdSuffix}-A-advanced-molstar-controls-panel`);
        expect(advancedPanel).toBeInTheDocument();

        const updatedChildren = Array.from(root?.children ?? []);
        const panelIndex = updatedChildren.findIndex((child) => child.id === `${idPrefix}-${viewerColumnIdSuffix}-A-advanced-molstar-controls-panel`);
        expect(panelIndex).toBeGreaterThan(toggleIndex);
    });

    it('keeps representation visibility toggles local to one viewer even when sync is enabled', async () => {
        const getCellA = vi.fn().mockReturnValue(undefined);
        const getCellB = vi.fn().mockReturnValue(undefined);
        const pluginA = {
            state: { data: { cells: { get: getCellA } } },
            canvas3d: { requestDraw: vi.fn() },
        } as any;
        const pluginB = {
            state: { data: { cells: { get: getCellB } } },
            canvas3d: { requestDraw: vi.fn() },
        } as any;

        const molstarA = {
            pluginRef: { current: pluginA },
            repIdMap: { Aligned: { shared: 'rep-a' } },
        } as any;
        const molstarB = {
            pluginRef: { current: pluginB },
            repIdMap: { Aligned: { shared: 'rep-b' } },
        } as any;

        const props = getMoleculeUIAlignedProps({
            molstar: molstarA,
            otherMolstar: molstarB,
            viewer: { viewerKey: 'A', moleculeAligned: { label: 'Aligned' }, ref: { current: pluginA } },
            isVisible: true,
            onToggleVisibility: vi.fn(),
            chainZoomLabel: '',
            onChainZoom: vi.fn(),
            chainZoomDisabled: false,
            residueZoomLabel: '',
            onResidueZoom: vi.fn(),
            residueZoomDisabled: false,
            isLoaded: true,
            forceUpdate: vi.fn(),
            representationRefs: ['rep-a'],
            syncEnabled: true,
            deleteRepresentation: vi.fn(),
            repIdMap: { Aligned: { shared: 'rep-a' } },
            Aligned: 'Aligned',
            chainInfoAligned: {},
            selectedChainIdAligned: '',
            residueInfoAligned: {},
            selectedResidueIdAligned: '',
        });

        props.onToggleRepVisibility('rep-a');

        expect(getCellA).toHaveBeenCalledWith('rep-a');
        expect(getCellB).not.toHaveBeenCalled();
    });

    it('passes per-viewer visibility flags when adding representations', () => {
        const addRepresentationA = vi.fn();
        const addRepresentationB = vi.fn();
        const viewer = {
            key: 'A',
            moleculeAligned: { filename: '6xu8.cif' },
            moleculeAlignedTo: null,
            isMoleculeAlignedVisible: false,
            isMoleculeAlignedToVisible: true,
            handleFileInputButtonClick: vi.fn(),
            fileInputRef: { current: null },
            ref: { current: null },
        } as any;
        const otherViewer = {
            key: 'B',
            moleculeAligned: { filename: '6xu8.cif' },
            moleculeAlignedTo: null,
            isMoleculeAlignedVisible: true,
            isMoleculeAlignedToVisible: true,
            handleFileInputButtonClick: vi.fn(),
            fileInputRef: { current: null },
            ref: { current: null },
        } as any;

        const props = getLoadDataRowProps({
            viewer,
            otherViewer,
            molstar: {
                addRepresentation: addRepresentationA,
                representationRefs: {},
                repIdMap: {},
                pluginRef: { current: null },
            },
            otherMolstar: {
                addRepresentation: addRepresentationB,
                representationRefs: {},
                repIdMap: {},
                pluginRef: { current: null },
            },
            realignedStructRefs: {},
            otherRealignedStructRefs: {},
            isMoleculeAlignedLoaded: true,
            isMoleculeAlignedToLoaded: true,
            viewerReady: true,
            otherViewerReady: true,
            representationType: 'spacefill',
            setRepresentationType: vi.fn(),
            colorsFile: { handleButtonClick: vi.fn(), inputRef: { current: null }, handleFileChange: vi.fn() },
            isMoleculeColoursLoaded: false,
            structureRef: 'ref-a',
            otherStructureRef: 'ref-b',
            selectedSubunit: 'All',
            setSelectedSubunit: vi.fn(),
            subunitZoomLabel: 'All',
            onSubunitZoom: vi.fn(),
            subunitZoomDisabled: false,
            subunitToChainIds: new Map(),
            chainInfo: { chainLabels: new Map([['A', 'Chain A']]) },
            selectedChainId: 'A',
            setSelectedChainId: vi.fn(),
            chainZoomLabel: 'Chain A',
            onChainZoom: vi.fn(),
            chainZoomDisabled: false,
            residueInfo: { residueLabels: new Map(), residueToAtomIds: {} },
            selectedResidueId: '',
            setSelectedResidueId: vi.fn(),
            residueZoomLabel: '',
            onResidueZoom: vi.fn(),
            residueZoomDisabled: true,
            fog: { enabled: false, near: 0, far: 100 },
            setFog: { setEnabled: vi.fn(), setNear: vi.fn(), setFar: vi.fn() },
            camera: { near: 0.1, far: 1000 },
            setCamera: { setNear: vi.fn(), setFar: vi.fn() },
            updateFog: vi.fn(),
            handleFileChange: vi.fn(),
            Aligned: 'Aligned',
            allowedRepresentationTypes: ['spacefill'] as any,
            syncEnabled: false,
            realignedRepRefs: {},
            setRealignedRepRefs: vi.fn(),
            setRealignedStructRefs: vi.fn(),
        });

        props.onAddRepresentationClick();

        expect(addRepresentationA).toHaveBeenCalledWith(
            'Aligned',
            'ref-a',
            'spacefill',
            expect.any(Object),
            expect.any(String),
            false
        );
        expect(addRepresentationB).toHaveBeenCalledWith(
            'Aligned',
            'ref-b',
            'spacefill',
            expect.any(Object),
            expect.any(String),
            true
        );
    });
});