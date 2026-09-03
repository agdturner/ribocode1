/**
 * Viewer column component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-06-11
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React from 'react';
import LoadDataRow, { SelectZoomControls } from './LoadMolecule';
import MoleculeUI from './Molecule';
import RealignedMoleculeList from './RealignedMoleculeList';
import MolstarContainer from './MolstarContainer';
import ChainSelectionTable from './ChainSelectionTable';
import MolstarAdvancedControls from './MolstarAdvancedControls';
import { AllowedRepresentationType } from '../types/ribocode';
import RepresentationSelectButton from './buttons/select/Representation';
import type { ViewerKey } from '../types/ribocode';

/**
 * Suffix for the ViewerColumn root id, used for consistent id construction in code and tests.
 */
export const idSuffix = 'viewer-column';

// Props for the ViewerColumn component
export interface LoadDataRowPropsInput {
	viewer: any;
	otherViewer: any;
	molstar: any;
	otherMolstar: any;
	realignedStructRefs: any;
	otherRealignedStructRefs: any;
	isMoleculeAlignedLoaded: boolean;
	isMoleculeAlignedToLoaded: boolean;
	viewerReady: boolean;
	otherViewerReady: boolean;
	representationType: any;
	setRepresentationType: (val: any) => void;
	colorsFile: any;
	isMoleculeColoursLoaded: boolean;
	structureRef: any;
	otherStructureRef: any;
	selectedSubunit: any;
	setSelectedSubunit: (val: any) => void;
	subunitZoomLabel: string;
	onSubunitHighlight: () => void;
	subunitHighlightOn?: boolean;
	subunitHighlightDisabled: boolean;
	onSubunitZoom: () => void;
	subunitZoomDisabled: boolean;
	subunitToChainIds: any;
	chainInfo: any;
	selectedChainId: any;
	setSelectedChainId: (val: any) => void;
	chainZoomLabel: string;
	onChainHighlight: () => void;
	chainHighlightOn?: boolean;
	chainHighlightDisabled: boolean;
	onChainZoom: () => void;
	chainZoomDisabled: boolean;
	residueInfo: any;
	selectedResidueIds: string[];
	setSelectedResidueIds: (val: string[]) => void;
	residueZoomLabel: string;
	onResidueHighlight: () => void;
	residueHighlightOn?: boolean;
	residueHighlightDisabled: boolean;
	onResidueZoom: () => void;
	residueZoomDisabled: boolean;
	zoomExtraRadius: number;
	setZoomExtraRadius: (val: number) => void;
	zoomMinRadius: number;
	setZoomMinRadius: (val: number) => void;
	fog: { enabled: boolean; near: number; far: number };
	setFog: {
		setEnabled: (val: boolean) => void;
		setNear: (val: number) => void;
		setFar: (val: number) => void;
	};
	clipping: { minNear: number; clipRadius: number };
	clippingDefaults?: { minNear: number; clipRadius: number };
	setClipping: {
		setMinNear: (val: number) => void;
		setClipRadius: (val: number) => void;
	};
	updateFog: (...args: any[]) => void;
	handleFileChange: (...args: any[]) => void;
	Aligned: string;
	allowedRepresentationTypes: readonly string[];
	syncEnabled: boolean;
	realignedRepRefs: any;
	setRealignedRepRefs: (val: any) => void;
	setRealignedStructRefs: (val: any) => void;
	fileInputLabel?: string;
	fileInputDisabled?: boolean;
	isAlignmentDataReady?: boolean;
	loadedFilename?: string;
}

/**
 * Generates props for the LoadDataRow component.
 * @param props - The input props required to generate the LoadDataRow props.
 * @returns An object containing the props for the LoadDataRow component.
 */
export function getLoadDataRowProps({
	viewer,
	otherViewer,
	molstar,
	otherMolstar,
	realignedStructRefs,
	otherRealignedStructRefs,
	isMoleculeAlignedLoaded,
	isMoleculeAlignedToLoaded,
	viewerReady,
	otherViewerReady,
	representationType,
	setRepresentationType,
	colorsFile,
	isMoleculeColoursLoaded,
	structureRef,
	otherStructureRef,
	selectedSubunit,
	setSelectedSubunit,
	subunitZoomLabel,
	onSubunitHighlight,
	subunitHighlightOn,
	subunitHighlightDisabled,
	onSubunitZoom,
	subunitZoomDisabled,
	subunitToChainIds,
	chainInfo,
	selectedChainId,
	setSelectedChainId,
	chainZoomLabel,
	onChainHighlight,
	chainHighlightOn,
	chainHighlightDisabled,
	onChainZoom,
	chainZoomDisabled,
	residueInfo,
	selectedResidueIds,
	setSelectedResidueIds,
	residueZoomLabel,
	onResidueHighlight,
	residueHighlightOn,
	residueHighlightDisabled,
	onResidueZoom,
	residueZoomDisabled,
	zoomExtraRadius,
	setZoomExtraRadius,
	zoomMinRadius,
	setZoomMinRadius,
	fog,
	setFog,
	clipping,
	clippingDefaults,
	setClipping,
	updateFog,
	handleFileChange,
	Aligned,
	allowedRepresentationTypes,
	syncEnabled,
	realignedRepRefs,
	setRealignedRepRefs,
	setRealignedStructRefs
}: LoadDataRowPropsInput) {
	   return {
			  // Use the correct molecule and loaded state for each row
			  viewerTitle:
				  Aligned === 'AlignedTo'
					  ? (viewer.moleculeAlignedTo ? Aligned + `: ${viewer.moleculeAlignedTo.name || viewer.moleculeAlignedTo.label || viewer.moleculeAlignedTo.filename}` : "")
					  : (viewer.moleculeAligned ? Aligned + `: ${viewer.moleculeAligned.name || viewer.moleculeAligned.label || viewer.moleculeAligned.filename}` : ""),
			  isLoaded: Aligned === 'AlignedTo' ? isMoleculeAlignedToLoaded : (viewer.moleculeAligned && viewer.moleculeAligned.filename ? true : false),
			  loadedFilename:
				  Aligned === 'AlignedTo'
					  ? (viewer.moleculeAlignedTo?.filename || viewer.moleculeAlignedTo?.name || viewer.moleculeAlignedTo?.label || "")
					  : (viewer.moleculeAligned?.filename || viewer.moleculeAligned?.name || viewer.moleculeAligned?.label || ""),
		   onFileInputClick: viewer.handleFileInputButtonClick,
		   fileInputRef: viewer.fileInputRef,
		   onFileChange: (e: any) => handleFileChange(e, Aligned),
		   fileInputLabel: typeof arguments[0].fileInputLabel === 'string' ? arguments[0].fileInputLabel : `Load ${Aligned}`,
		   fileInputDisabled:
			   typeof arguments[0].fileInputDisabled === 'boolean'
				   ? arguments[0].fileInputDisabled
				   : false, // Always enabled unless explicitly disabled
		representationType,
		onRepresentationTypeChange: setRepresentationType,
		representationTypeDisabled: Aligned === 'AlignedTo' ? !isMoleculeAlignedToLoaded : !isMoleculeAlignedLoaded,
		representationTypeSelector: (
			<RepresentationSelectButton
				label="Add Representation"
				options={allowedRepresentationTypes as AllowedRepresentationType[]}
				selected={representationType}
				onSelect={option => setRepresentationType(option as AllowedRepresentationType)}
				disabled={Aligned === 'AlignedTo' ? !isMoleculeAlignedToLoaded : !isMoleculeAlignedLoaded}
			/>
		),
		onAddColorsClick: colorsFile.handleButtonClick,
			addColorsDisabled: Aligned === 'AlignedTo' ? !isMoleculeAlignedToLoaded : !isMoleculeAlignedLoaded,
		onAddRepresentationClick: () => {
			let colorTheme;
			if (isMoleculeColoursLoaded) {
				colorTheme = { name: Aligned + '-custom-chain-colors', params: {} };
			} else {
				colorTheme = { name: 'default', params: {} };
			}
			const repId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
			const thisViewerVisible = Aligned === 'AlignedTo'
				? viewer.isMoleculeAlignedToVisible
				: viewer.isMoleculeAlignedVisible;
			const otherViewerVisible = Aligned === 'AlignedTo'
				? otherViewer.isMoleculeAlignedToVisible
				: otherViewer.isMoleculeAlignedVisible;
			if ((Aligned === 'AlignedTo' ? viewer.moleculeAlignedTo : viewer.moleculeAligned) && structureRef) {
				molstar.addRepresentation(
					Aligned,
					structureRef,
					representationType,
					colorTheme,
					repId,
					thisViewerVisible
				);
			}
			if ((Aligned === 'AlignedTo' ? otherViewer.moleculeAlignedTo : otherViewer.moleculeAligned) && otherStructureRef) {
				otherMolstar.addRepresentation(
					Aligned,
					otherStructureRef,
					representationType,
					colorTheme,
					repId,
					otherViewerVisible
				);
			}
			Object.entries(realignedStructRefs).forEach(([id, structRef]) => {
				if (structRef) {
					molstar.addRepresentation(
						id,
						structRef,
						representationType,
						colorTheme,
						repId
					);
				}
			});
			Object.entries(otherRealignedStructRefs).forEach(([id, structRef]) => {
				if (structRef) {
					otherMolstar.addRepresentation(
						id,
						structRef,
						representationType,
						colorTheme,
						repId
					);
				}
			});
		},
		addRepresentationDisabled: Aligned === 'AlignedTo' ? (!isMoleculeAlignedToLoaded || !representationType) : (!isMoleculeAlignedLoaded || !representationType),
		colorsInputRef: colorsFile.inputRef,
		onColorsFileChange: colorsFile.handleFileChange,
		selectedSubunit,
		onSelectSubunit: setSelectedSubunit,
		subunitZoomLabel,
		onSubunitHighlight,
		subunitHighlightOn,
		subunitHighlightDisabled,
		onSubunitZoom,
		subunitZoomDisabled,
		subunitSelectDisabled: !isMoleculeAlignedToLoaded,
		chainInfo,
		selectedChainId,
		onSelectChainId: setSelectedChainId,
		chainZoomLabel,
		onChainHighlight,
		chainHighlightOn,
		chainHighlightDisabled,
		onChainZoom,
		chainZoomDisabled,
		chainSelectDisabled: !isMoleculeAlignedToLoaded,
		residueInfo,
		selectedResidueIds,
		onSelectResidueIds: setSelectedResidueIds,
		residueZoomLabel,
		onResidueHighlight,
		residueHighlightOn,
		residueHighlightDisabled,
		onResidueZoom,
		residueZoomDisabled,
		zoomExtraRadius,
		onZoomExtraRadiusChange: setZoomExtraRadius,
		zoomMinRadius,
		onZoomMinRadiusChange: setZoomMinRadius,
		residueSelectDisabled: !isMoleculeAlignedToLoaded,
		fogEnabled: fog.enabled,
		fogNear: fog.near,
		fogFar: fog.far,
		onFogEnabledChange: (val: boolean) => {
			setFog.setEnabled(val);
			updateFog(viewer.ref.current, null, val, fog.near, fog.far, clipping.minNear, clipping.clipRadius);
		},
		onFogNearChange: (val: number) => {
			setFog.setNear(val);
			updateFog(viewer.ref.current, null, fog.enabled, val, fog.far, clipping.minNear, clipping.clipRadius);
		},
		onFogFarChange: (val: number) => {
			setFog.setFar(val);
			updateFog(viewer.ref.current, null, fog.enabled, fog.near, val, clipping.minNear, clipping.clipRadius);
		},
		clippingMinNear: clipping.minNear,
		clippingRadius: clipping.clipRadius,
		onClippingMinNearChange: (val: number) => {
			setClipping.setMinNear(val);
			updateFog(viewer.ref.current, null, fog.enabled, fog.near, fog.far, val, clipping.clipRadius);
		},
		onClippingRadiusChange: (val: number) => {
			setClipping.setClipRadius(val);
			updateFog(viewer.ref.current, null, fog.enabled, fog.near, fog.far, clipping.minNear, val);
		},
		onResetClipping: () => {
			const resetMinNear = Number(clippingDefaults?.minNear ?? clipping.minNear ?? 1);
			const resetClipRadius = Number(clippingDefaults?.clipRadius ?? clipping.clipRadius ?? 0);
			setClipping.setMinNear(resetMinNear);
			setClipping.setClipRadius(resetClipRadius);
			updateFog(viewer.ref.current, null, fog.enabled, fog.near, fog.far, resetMinNear, resetClipRadius);
		},
		subunitToChainIds,
		idPrefix: viewer && viewer.key ? `viewer-${viewer.key}` : (viewer && viewer.moleculeAligned ? `viewer-${viewer.moleculeAligned.name?.replace(/\s+/g, '-').toLowerCase()}` : 'viewer-unknown'),
	};
}

/**
 * Generates props for the MoleculeUI component for the aligned-to molecule.
 * @param props - The input props required to generate the MoleculeUIAlignedTo props.
 * @returns An object containing the props for the MoleculeUI component for the aligned-to molecule.
 */
export function getMoleculeUIAlignedToProps({
	molstar,
	otherMolstar,
	viewer,
	isVisible,
	onToggleVisibility,
	chainZoomLabel,
	onChainZoom,
	chainZoomDisabled,
	subunitZoomLabel,
	onSubunitZoom,
	subunitZoomDisabled,
	residueZoomLabel,
	onResidueZoom,
	residueZoomDisabled,
	isLoaded,
	forceUpdate,
	representationRefs,
	syncEnabled,
	deleteRepresentation,
	repIdMap,
	AlignedTo
}: {
	molstar: any,
	otherMolstar: any,
	viewer: any,
	isVisible: boolean,
	onToggleVisibility: () => void,
	chainZoomLabel: string,
	onChainZoom: () => void,
	chainZoomDisabled: boolean,
	subunitZoomLabel: string,
	onSubunitZoom: () => void,
	subunitZoomDisabled: boolean,
	residueZoomLabel: string,
	onResidueZoom: () => void,
	residueZoomDisabled: boolean,
	isLoaded: boolean,
	forceUpdate: () => void,
	representationRefs: any[],
	syncEnabled: boolean,
	deleteRepresentation: any,
	repIdMap: any,
	AlignedTo: string
}) {
	return {
		key: representationRefs?.join('-') || viewer.viewerKey + `-` + AlignedTo,
		label: viewer.moleculeAlignedTo?.label ?? AlignedTo,
		plugin: viewer.ref.current,
		isVisible,
		onToggleVisibility,
		chainZoomLabel,
		onChainZoom,
		chainZoomDisabled,
		subunitZoomLabel,
		onSubunitZoom,
		subunitZoomDisabled,
		residueZoomLabel,
		onResidueZoom,
		residueZoomDisabled,
		isLoaded,
		forceUpdate,
		representationRefs: representationRefs || [],
		onDeleteRepresentation: (ref: string) => {
			const repId = Object.entries(repIdMap[AlignedTo]).find(([id, r]) => r === ref)?.[0];
			if (syncEnabled && repId) {
				Promise.all([
					deleteRepresentation(molstar.repIdMap[AlignedTo][repId], AlignedTo, molstar, false),
					deleteRepresentation(otherMolstar.repIdMap[AlignedTo][repId], AlignedTo, otherMolstar, false)
				]).then(forceUpdate);
			} else if (repId) {
				deleteRepresentation(molstar.repIdMap[AlignedTo][repId], AlignedTo, molstar);
			} else {
				if (syncEnabled) {
					Promise.all([
						deleteRepresentation(ref, AlignedTo, molstar, false),
						deleteRepresentation(ref, AlignedTo, otherMolstar, false)
					]).then(forceUpdate);
				} else {
					deleteRepresentation(ref, AlignedTo, molstar);
				}
			}
		},
		onToggleRepVisibility: (ref: string) => {
			const toggleInInstance = (molstarInstance: any, actualRef: string) => {
				const plugin = molstarInstance.pluginRef.current;
				if (!plugin) return;
				const cell = plugin.state?.data?.cells?.get(actualRef);
				if (cell) {
					import('molstar/lib/mol-plugin/commands').then(({ PluginCommands }) => {
						PluginCommands.State.ToggleVisibility.apply(plugin, [plugin, { state: plugin.state.data, ref: actualRef }]);
						plugin.canvas3d?.requestDraw?.();
						forceUpdate();
					});
				}
			};
			toggleInInstance(molstar, ref);
		},
	};
}

/**
 * Generates props for the MoleculeUI component for the aligned molecule.
 * @param props - The input props required to generate the MoleculeUIAligned props.
 * @returns An object containing the props for the MoleculeUI component for the aligned molecule.
 */
export function getMoleculeUIAlignedProps({
	molstar,
	otherMolstar,
	viewer,
	isVisible,
	onToggleVisibility,
	chainZoomLabel,
	onChainZoom,
	chainZoomDisabled,
	subunitZoomLabel,
	onSubunitZoom,
	subunitZoomDisabled,
	residueZoomLabel,
	onResidueZoom,
	residueZoomDisabled,
	isLoaded,
	forceUpdate,
	representationRefs,
	syncEnabled,
	deleteRepresentation,
	repIdMap,
	Aligned,
	chainInfoAligned,
	selectedChainIdAligned,
	residueInfoAligned,
	selectedResidueIdAligned
}: {
	molstar: any,
	otherMolstar: any,
	viewer: any,
	isVisible: boolean,
	onToggleVisibility: () => void,
	chainZoomLabel: string,
	onChainZoom: () => void,
	chainZoomDisabled: boolean,
	subunitZoomLabel: string,
	onSubunitZoom: () => void,
	subunitZoomDisabled: boolean,
	residueZoomLabel: string,
	onResidueZoom: () => void,
	residueZoomDisabled: boolean,
	isLoaded: boolean,
	forceUpdate: () => void,
	representationRefs: any[],
	syncEnabled: boolean,
	deleteRepresentation: any,
	repIdMap: any,
	Aligned: string,
	chainInfoAligned: any,
	selectedChainIdAligned: any,
	residueInfoAligned: any,
	selectedResidueIdAligned: any
}) {
	return {
		key: representationRefs?.join('-') || viewer.viewerKey + `-` + Aligned,
		label: viewer.moleculeAligned?.label ?? Aligned,
		plugin: viewer.ref.current,
		isVisible,
		onToggleVisibility,
		chainZoomLabel,
		onChainZoom,
		chainZoomDisabled,
		subunitZoomLabel,
		onSubunitZoom,
		subunitZoomDisabled,
		residueZoomLabel,
		onResidueZoom,
		residueZoomDisabled,
		isLoaded,
		forceUpdate,
		representationRefs: representationRefs || [],
		onDeleteRepresentation: (ref: string) => {
			const repId = Object.entries(repIdMap[Aligned]).find(([id, r]) => r === ref)?.[0];
			if (syncEnabled && repId) {
				Promise.all([
					deleteRepresentation(molstar.repIdMap[Aligned][repId], Aligned, molstar, false),
					deleteRepresentation(otherMolstar.repIdMap[Aligned][repId], Aligned, otherMolstar, false)
				]).then(forceUpdate);
			} else if (repId) {
				deleteRepresentation(molstar.repIdMap[Aligned][repId], Aligned, molstar);
			} else {
				if (syncEnabled) {
					Promise.all([
						deleteRepresentation(ref, Aligned, molstar, false),
						deleteRepresentation(ref, Aligned, otherMolstar, false)
					]).then(forceUpdate);
				} else {
					deleteRepresentation(ref, Aligned, molstar);
				}
			}
		},
		onToggleRepVisibility: (ref: string) => {
			const toggleInInstance = (molstarInstance: any, actualRef: string) => {
				const plugin = molstarInstance.pluginRef.current;
				if (!plugin) return;
				const cell = plugin.state?.data?.cells?.get(actualRef);
				if (cell) {
					import('molstar/lib/mol-plugin/commands').then(({ PluginCommands }) => {
						PluginCommands.State.ToggleVisibility.apply(plugin, [plugin, { state: plugin.state.data, ref: actualRef }]);
						plugin.canvas3d?.requestDraw?.();
						forceUpdate();
					});
				}
			};
			toggleInInstance(molstar, ref);
		},
	};
}

/**
 * Generates props for the RealignedMoleculeList component.
 * @param props - The input props required to generate the RealignedMoleculeList props.
 * @returns An object containing the props for the RealignedMoleculeList component.
 */
export function getRealignedMoleculeListProps({
	molecules,
	molstar,
	chainInfo,
	residueInfo,
	selectedResidueId,
	realignedStructRefs,
	setRealignedMolecules,
	setRealignedRepRefs,
	setRealignedStructRefs,
	forceUpdate,
	viewerKey,
	otherMolstar,
	otherRealignedStructRefs,
	setOtherRealignedMolecules,
	setOtherRealignedRepRefs,
	setOtherRealignedStructRefs
}: {
	molecules: any,
	molstar: any,
	chainInfo: any,
	residueInfo: any,
	selectedResidueId: any,
	realignedStructRefs: any,
	setRealignedMolecules: any,
	setRealignedRepRefs: any,
	setRealignedStructRefs: any,
	forceUpdate: () => void,
	viewerKey: string,
	otherMolstar: any,
	otherRealignedStructRefs: any,
	setOtherRealignedMolecules: any,
	setOtherRealignedRepRefs: any,
	setOtherRealignedStructRefs: any
}) {
	return {
		molecules,
		molstar,
		chainInfo,
		residueInfo,
		selectedResidueId,
		realignedStructRefs,
		setRealignedMolecules,
		setRealignedRepRefs,
		setRealignedStructRefs,
		forceUpdate,
		viewerKey,
		otherMolstar,
		otherRealignedStructRefs,
		setOtherRealignedMolecules,
		setOtherRealignedRepRefs,
		setOtherRealignedStructRefs,
	};
}

/**
 * Generates props for the MolstarContainer component.
 * @param props - The input props required to generate the MolstarContainer props.
 * @returns An object containing the props for the MolstarContainer component.
 */
export function getMolstarContainerProps({
	viewer,
	pluginRef,
	setViewerWrapper,
	setActiveViewer,
	setViewerReady
}: {
	viewer: any,
	pluginRef: any,
	setViewerWrapper: (viewer: any) => void,
	setActiveViewer: (viewer: ViewerKey) => void,
	setViewerReady: (ready: boolean) => void
}) {
	return {
		ref: pluginRef,
		viewerKey: viewer.viewerKey,
		setViewer: setViewerWrapper,
		onMouseDown: () => setActiveViewer(viewer.viewerKey),
		onReady: () => setViewerReady(true),
	};
}

/**
 * Define the props for the ViewerColumn component
 * @typedef {Object} ViewerColumnProps
 * @property {ViewerKey} viewerKey - Unique key for the viewer column (e.g., 'A' or 'B').
 * @property {Object} loadDataRowProps - Props to pass to the LoadDataRow component.
 * @property {Object} moleculeUIAlignedToProps - Props to pass to the MoleculeUI component for the aligned-to molecule.
 * @property {Object} moleculeUIAlignedProps - Props to pass to the MoleculeUI component for the aligned molecule.
 * @property {Object} realignedMoleculeListProps - Props to pass to the RealignedMoleculeList component.
 * @property {Object} molstarContainerProps - Props to pass to the MolstarContainer component.
 */


/**
 * A column in the viewer that contains the LoadDataRow, MoleculeUI, RealignedMoleculeList, and MolstarContainer components.
 * @param {ViewerColumnProps} props - The props for the ViewerColumn component.
 * @returns {JSX.Element} The ViewerColumn component. 
 */


export interface ViewerColumnProps {
	viewerKey: ViewerKey;
	loadDataRowPropsAlignedTo: any;
	loadDataRowPropsAligned: any;
	moleculeUIAlignedToProps: any;
	moleculeUIAlignedProps: any;
	realignedMoleculeListProps: any;
	molstarContainerProps: any;
	alignedToChainFinderQuery?: string;
	onAlignedToChainFinderQueryChange?: (query: string) => void;
	alignedChainFinderQuery?: string;
	onAlignedChainFinderQueryChange?: (query: string) => void;
	testMode?: boolean;
	idPrefix?: string;
}

const ViewerColumn: React.FC<ViewerColumnProps> = ({
	viewerKey,
	loadDataRowPropsAlignedTo,
	loadDataRowPropsAligned,
	moleculeUIAlignedToProps,
	moleculeUIAlignedProps,
	realignedMoleculeListProps,
	molstarContainerProps,
	alignedToChainFinderQuery,
	onAlignedToChainFinderQueryChange,
	alignedChainFinderQuery,
	onAlignedChainFinderQueryChange,
	testMode,
	idPrefix
}) => {
	const viewerIdPrefix = idPrefix ? `${idPrefix}-${idSuffix}-${viewerKey}` : `${idSuffix}-${viewerKey}`;
	const [showAdvancedMolstarControls, setShowAdvancedMolstarControls] = React.useState(false);
	const [showSelectZoomControls, setShowSelectZoomControls] = React.useState(false);
	const chainTableProps = viewerKey === 'A'
		? {
			chainLabels: loadDataRowPropsAlignedTo?.chainInfo?.chainLabels as Map<string, string>,
			selectedChainId: loadDataRowPropsAlignedTo?.selectedChainId ?? '',
			onSelectChainId: loadDataRowPropsAlignedTo?.onSelectChainId as (chainId: string) => void,
			title: 'AlignedTo Chain Finder',
			query: alignedToChainFinderQuery,
			onQueryChange: onAlignedToChainFinderQueryChange,
		}
		: {
			chainLabels: loadDataRowPropsAligned?.chainInfo?.chainLabels as Map<string, string>,
			selectedChainId: loadDataRowPropsAligned?.selectedChainId ?? '',
			onSelectChainId: loadDataRowPropsAligned?.onSelectChainId as (chainId: string) => void,
			title: 'Aligned Chain Finder',
			query: alignedChainFinderQuery,
			onQueryChange: onAlignedChainFinderQueryChange,
		};
	const activeLoadProps = viewerKey === 'A' ? loadDataRowPropsAlignedTo : loadDataRowPropsAligned;
	const activeSelectZoomIdPrefix = viewerKey === 'A' ? `${viewerIdPrefix}-alignedto` : `${viewerIdPrefix}-aligned`;
	const clippingNear = Number(activeLoadProps?.clippingMinNear ?? 1);
	const clippingFar = Number(activeLoadProps?.clippingRadius ?? 0);

	       return (
		       <div className="Column" id={viewerIdPrefix}>
		       <MolstarContainer
			   {...molstarContainerProps}
			   idPrefix={viewerIdPrefix}
			   viewerKey={viewerKey}
			   showAdvancedControls={false}
		       />
		       <MoleculeUI key={moleculeUIAlignedToProps.key} {...(() => { const { key, ...rest } = moleculeUIAlignedToProps; return rest; })()} idPrefix={viewerIdPrefix} />
		       <MoleculeUI key={moleculeUIAlignedProps.key} {...(() => { const { key, ...rest } = moleculeUIAlignedProps; return rest; })()} idPrefix={viewerIdPrefix} />
		       <RealignedMoleculeList {...realignedMoleculeListProps} idPrefix={viewerIdPrefix} />
					   {/* Only render the correct loader in each column as per requirements */}
					   {viewerKey === 'A' && (
					   <LoadDataRow {...loadDataRowPropsAlignedTo} showSelectZoomControls={false} testMode={testMode} idPrefix={`${viewerIdPrefix}-alignedto`} />
					   )}
					   {viewerKey === 'B' && (
					   <LoadDataRow {...loadDataRowPropsAligned} showSelectZoomControls={false} testMode={testMode} idPrefix={`${viewerIdPrefix}-aligned`} />
					   )}
		       <div className="load-data-controls" id={`${activeSelectZoomIdPrefix}-clipping-controls`}>
				   <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
					   <strong>Clipping</strong>
					   <span
						   style={{ fontSize: 12, opacity: 0.8 }}
						   title="Matches Mol* clipping settings: Min Near controls minimum near plane distance, Clip Radius controls how much of the scene is shown."
					   >
						   Matches Mol* clipping settings
					   </span>
					   <label htmlFor={`${activeSelectZoomIdPrefix}-clip-near-range`}>Min Near:</label>
					   <input
						   id={`${activeSelectZoomIdPrefix}-clip-near-range`}
						   type="range"
						   min={0.1}
						   max={100}
						   step={0.1}
						   value={clippingNear}
						   onChange={(e) => activeLoadProps?.onClippingMinNearChange?.(Number(e.target.value))}
					   />
					   <input
						   id={`${activeSelectZoomIdPrefix}-clip-near-number`}
						   type="number"
						   min={0.1}
						   max={100}
						   step={0.1}
						   value={clippingNear}
						   onChange={(e) => activeLoadProps?.onClippingMinNearChange?.(Number(e.target.value))}
						   style={{ width: 80 }}
					   />
					   <label htmlFor={`${activeSelectZoomIdPrefix}-clip-far-range`}>Clip Radius:</label>
					   <input
						   id={`${activeSelectZoomIdPrefix}-clip-far-range`}
						   type="range"
						   min={0}
						   max={99}
						   step={1}
						   value={clippingFar}
						   onChange={(e) => activeLoadProps?.onClippingRadiusChange?.(Number(e.target.value))}
					   />
					   <input
						   id={`${activeSelectZoomIdPrefix}-clip-far-number`}
						   type="number"
						   min={0}
						   max={99}
						   step={1}
						   value={clippingFar}
						   onChange={(e) => activeLoadProps?.onClippingRadiusChange?.(Number(e.target.value))}
						   style={{ width: 90 }}
					   />
					   <button
						   type="button"
						   className="msp-btn msp-form-control"
						   id={`${activeSelectZoomIdPrefix}-clip-reset-btn`}
						   onClick={() => activeLoadProps?.onResetClipping?.()}
					   >
						   Reset Clipping
					   </button>
				   </div>
		       </div>
		       <button
			   id={`${viewerIdPrefix}-select-zoom-controls-toggle-btn`}
			   data-testid={`${viewerIdPrefix}-select-zoom-controls-toggle-btn`}
			   className="molstar-file-btn molstar-advanced-controls-toggle"
			   type="button"
			   onClick={() => setShowSelectZoomControls((current) => !current)}
		       >
			   {showSelectZoomControls ? 'Hide Select and Zoom Controls' : 'Show Select and Zoom Controls'}
		       </button>
			       {showSelectZoomControls && (
			   <>
				   <div className="load-data-controls" id={`${activeSelectZoomIdPrefix}-select-zoom-controls`}>
					   <SelectZoomControls
						   subunitToChainIds={activeLoadProps.subunitToChainIds}
						   selectedSubunit={activeLoadProps.selectedSubunit}
						   onSelectSubunit={activeLoadProps.onSelectSubunit}
						   subunitSelectDisabled={activeLoadProps.subunitSelectDisabled}
						   subunitZoomLabel={activeLoadProps.subunitZoomLabel}
						   onSubunitHighlight={activeLoadProps.onSubunitHighlight}
						   subunitHighlightOn={activeLoadProps.subunitHighlightOn}
						   subunitHighlightDisabled={activeLoadProps.subunitHighlightDisabled}
						   onSubunitZoom={activeLoadProps.onSubunitZoom}
						   subunitZoomDisabled={activeLoadProps.subunitZoomDisabled}
						   chainInfo={activeLoadProps.chainInfo}
						   selectedChainId={activeLoadProps.selectedChainId}
						   onSelectChainId={activeLoadProps.onSelectChainId}
						   chainSelectDisabled={activeLoadProps.chainSelectDisabled}
						   chainZoomLabel={activeLoadProps.chainZoomLabel}
						   onChainHighlight={activeLoadProps.onChainHighlight}
						   chainHighlightOn={activeLoadProps.chainHighlightOn}
						   chainHighlightDisabled={activeLoadProps.chainHighlightDisabled}
						   onChainZoom={activeLoadProps.onChainZoom}
						   chainZoomDisabled={activeLoadProps.chainZoomDisabled}
						   residueInfo={activeLoadProps.residueInfo}
						   selectedResidueIds={activeLoadProps.selectedResidueIds}
						   onSelectResidueIds={activeLoadProps.onSelectResidueIds}
						   residueSelectDisabled={activeLoadProps.residueSelectDisabled}
						   residueZoomLabel={activeLoadProps.residueZoomLabel}
						   onResidueHighlight={activeLoadProps.onResidueHighlight}
						   residueHighlightOn={activeLoadProps.residueHighlightOn}
						   residueHighlightDisabled={activeLoadProps.residueHighlightDisabled}
						   onResidueZoom={activeLoadProps.onResidueZoom}
						   residueZoomDisabled={activeLoadProps.residueZoomDisabled}
						   zoomExtraRadius={activeLoadProps.zoomExtraRadius}
						   onZoomExtraRadiusChange={activeLoadProps.onZoomExtraRadiusChange}
						   zoomMinRadius={activeLoadProps.zoomMinRadius}
						   onZoomMinRadiusChange={activeLoadProps.onZoomMinRadiusChange}
						   idPrefix={activeSelectZoomIdPrefix}
					   />
				   </div>
				   <ChainSelectionTable
					   chainLabels={chainTableProps.chainLabels || new Map<string, string>()}
					   selectedChainId={chainTableProps.selectedChainId}
					   onSelectChainId={chainTableProps.onSelectChainId || (() => {})}
					   title={chainTableProps.title}
					   query={chainTableProps.query}
					   onQueryChange={chainTableProps.onQueryChange}
					   idPrefix={viewerIdPrefix}
				   />
			   </>
			       )}
			       <button
				   id={`${viewerIdPrefix}-advanced-molstar-controls-toggle-btn`}
				   data-testid={`${viewerIdPrefix}-advanced-molstar-controls-toggle-btn`}
				   className="molstar-file-btn molstar-advanced-controls-toggle"
				   type="button"
				   onClick={() => setShowAdvancedMolstarControls((current) => !current)}
			   >
				   {showAdvancedMolstarControls ? 'Hide Advanced Mol* Controls' : 'Show Advanced Mol* Controls'}
			       </button>
			       <MolstarAdvancedControls
				   plugin={(molstarContainerProps?.ref?.current ?? null) as any}
				   visible={showAdvancedMolstarControls}
				   idPrefix={viewerIdPrefix}
			       />
		       </div>
	       );
};

export default ViewerColumn;
