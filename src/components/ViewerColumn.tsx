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
	colorsFile?: any;
	chainColorsFile?: any;
	residueColorsFile?: any;
	isMoleculeColoursLoaded: boolean;
	colorMode?: 'chain' | 'residue-type';
	onColorModeChange?: (mode: 'chain' | 'residue-type') => void;
	residueTypeColorsById?: Map<string, string>;
	residueTypeCounts?: Array<{ type: string; count: number }>;
	onResidueTypeColorChange?: (residueType: string, color: string) => void;
	onSaveColorTheme?: () => void;
	saveColorThemeDisabled?: boolean;
	colorThemeOptions?: Array<{ value: string; label: string }>;
	selectedColorThemeName?: string;
	setSelectedColorThemeName?: (themeName: string) => void;
	onRemoveColorTheme?: () => void;
	removeColorThemeDisabled?: boolean;
	onSaveChainTheme?: () => void;
	saveChainThemeDisabled?: boolean;
	chainThemeOptions?: Array<{ value: string; label: string }>;
	selectedChainThemeName?: string;
	setSelectedChainThemeName?: (themeName: string) => void;
	onRemoveChainTheme?: () => void;
	removeChainThemeDisabled?: boolean;
	onSaveResidueTheme?: () => void;
	saveResidueThemeDisabled?: boolean;
	residueThemeOptions?: Array<{ value: string; label: string }>;
	selectedResidueThemeName?: string;
	setSelectedResidueThemeName?: (themeName: string) => void;
	onRemoveResidueTheme?: () => void;
	removeResidueThemeDisabled?: boolean;
	structureRef: any;
	otherStructureRef: any;
	selectedSubunit: any;
	setSelectedSubunit: (val: any) => void;
	subunitZoomLabel: string;
	onSubunitHighlight: () => void;
	subunitHighlightOn?: boolean;
	subunitHighlightDisabled: boolean;
	onSubunitInspect: () => void;
	subunitInspectOn?: boolean;
	subunitInspectDisabled: boolean;
	onSubunitZoom: () => void;
	subunitZoomDisabled: boolean;
	subunitToChainIds: any;
	chainInfo: any;
	chainColorsById?: Map<string, string>;
	onChainColorChange?: (chainId: string, color: string) => void;
	selectedChainId: any;
	setSelectedChainId: (val: any) => void;
	selectedChainId2?: any;
	setSelectedChainId2?: (val: any) => void;
	clearSelectedChainId2?: () => void;
	chainZoomLabel: string;
	chainZoomLabel2?: string;
	onChainHighlight: () => void;
	chainHighlightOn?: boolean;
	chainHighlightDisabled: boolean;
	onChainInspect: () => void;
	chainInspectOn?: boolean;
	chainInspectDisabled: boolean;
	onChainHighlight2?: () => void;
	chainHighlightOn2?: boolean;
	chainHighlightDisabled2?: boolean;
	onChainInspect2?: () => void;
	chainInspectOn2?: boolean;
	chainInspectDisabled2?: boolean;
	onChainZoom: () => void;
	onChainZoom2?: () => void;
	chainZoomDisabled: boolean;
	chainZoomDisabled2?: boolean;
	onCombinedSelectionZoom?: () => void;
	combinedSelectionZoomDisabled?: boolean;
	onCombinedSelectionHighlight?: () => void;
	combinedSelectionHighlightOn?: boolean;
	combinedSelectionHighlightDisabled?: boolean;
	onCombinedSelectionInspect?: () => void;
	combinedSelectionInspectOn?: boolean;
	combinedSelectionInspectDisabled?: boolean;
	showUniprotAccessionInChainLabels?: boolean;
	setShowUniprotAccessionInChainLabels?: (val: boolean) => void;
	uniprotLookupStatus?: {
		completed: number;
		pending: number;
		inFlight: number;
	};
	residueInfo: any;
	residueCommonIds?: string[];
	selectedResidueIds: string[];
	setSelectedResidueIds: (val: string[]) => void;
	residueInfo2?: any;
	residueCommonIds2?: string[];
	selectedResidueIds2?: string[];
	setSelectedResidueIds2?: (val: string[]) => void;
	residueZoomLabel: string;
	residueZoomLabel2?: string;
	onResidueHighlight: () => void;
	residueHighlightOn?: boolean;
	residueHighlightDisabled: boolean;
	onResidueInspect: () => void;
	residueInspectOn?: boolean;
	residueInspectDisabled: boolean;
	onResidueHighlight2?: () => void;
	residueHighlightOn2?: boolean;
	residueHighlightDisabled2?: boolean;
	onResidueInspect2?: () => void;
	residueInspectOn2?: boolean;
	residueInspectDisabled2?: boolean;
	onResidueZoom: () => void;
	onResidueZoom2?: () => void;
	residueZoomDisabled: boolean;
	residueZoomDisabled2?: boolean;
	zoomExtraRadius: number;
	setZoomExtraRadius: (val: number) => void;
	zoomMinRadius: number;
	setZoomMinRadius: (val: number) => void;
	selectionDisplayMode?: 'halo' | 'overlay' | 'hybrid';
	setSelectionDisplayMode?: (mode: 'halo' | 'overlay' | 'hybrid') => void;
	dimUnselected?: boolean;
	setDimUnselected?: (value: boolean) => void;
	dimUnselectedStrength?: number;
	setDimUnselectedStrength?: (value: number) => void;
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
	chainColorsFile,
	residueColorsFile,
	isMoleculeColoursLoaded,
	colorMode,
	onColorModeChange,
	residueTypeColorsById,
	residueTypeCounts,
	onResidueTypeColorChange,
	onSaveColorTheme,
	saveColorThemeDisabled,
	colorThemeOptions,
	selectedColorThemeName,
	setSelectedColorThemeName,
	onRemoveColorTheme,
	removeColorThemeDisabled,
	onSaveChainTheme,
	saveChainThemeDisabled,
	chainThemeOptions,
	selectedChainThemeName,
	setSelectedChainThemeName,
	onRemoveChainTheme,
	removeChainThemeDisabled,
	onSaveResidueTheme,
	saveResidueThemeDisabled,
	residueThemeOptions,
	selectedResidueThemeName,
	setSelectedResidueThemeName,
	onRemoveResidueTheme,
	removeResidueThemeDisabled,
	structureRef,
	otherStructureRef,
	selectedSubunit,
	setSelectedSubunit,
	subunitZoomLabel,
	onSubunitHighlight,
	subunitHighlightOn,
	subunitHighlightDisabled,
	onSubunitInspect,
	subunitInspectOn,
	subunitInspectDisabled,
	onSubunitZoom,
	subunitZoomDisabled,
	subunitToChainIds,
	chainInfo,
	chainColorsById,
	onChainColorChange,
	selectedChainId,
	setSelectedChainId,
	selectedChainId2,
	setSelectedChainId2,
	clearSelectedChainId2,
	chainZoomLabel,
	chainZoomLabel2,
	onChainHighlight,
	chainHighlightOn,
	chainHighlightDisabled,
	onChainInspect,
	chainInspectOn,
	chainInspectDisabled,
	onChainHighlight2,
	chainHighlightOn2,
	chainHighlightDisabled2,
	onChainInspect2,
	chainInspectOn2,
	chainInspectDisabled2,
	onChainZoom,
	onChainZoom2,
	chainZoomDisabled,
	chainZoomDisabled2,
	onCombinedSelectionZoom,
	combinedSelectionZoomDisabled,
	onCombinedSelectionHighlight,
	combinedSelectionHighlightOn,
	combinedSelectionHighlightDisabled,
	onCombinedSelectionInspect,
	combinedSelectionInspectOn,
	combinedSelectionInspectDisabled,
	showUniprotAccessionInChainLabels,
	setShowUniprotAccessionInChainLabels,
	uniprotLookupStatus,
	residueInfo,
	residueCommonIds,
	selectedResidueIds,
	setSelectedResidueIds,
	residueInfo2,
	residueCommonIds2,
	selectedResidueIds2,
	setSelectedResidueIds2,
	residueZoomLabel,
	residueZoomLabel2,
	onResidueHighlight,
	residueHighlightOn,
	residueHighlightDisabled,
	onResidueInspect,
	residueInspectOn,
	residueInspectDisabled,
	onResidueHighlight2,
	residueHighlightOn2,
	residueHighlightDisabled2,
	onResidueInspect2,
	residueInspectOn2,
	residueInspectDisabled2,
	onResidueZoom,
	onResidueZoom2,
	residueZoomDisabled,
	residueZoomDisabled2,
	zoomExtraRadius,
	setZoomExtraRadius,
	zoomMinRadius,
	setZoomMinRadius,
	selectionDisplayMode,
	setSelectionDisplayMode,
	dimUnselected,
	setDimUnselected,
	dimUnselectedStrength,
	setDimUnselectedStrength,
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
	setRealignedStructRefs,
	loadedFilename,
}: LoadDataRowPropsInput) {
	const captureCameraSnapshot = (molstarInstance: any) => {
		const camera = molstarInstance?.pluginRef?.current?.canvas3d?.camera;
		const snapshot = camera?.getSnapshot?.();
		if (!camera || !snapshot) return null;
		return {
			camera,
			snapshot,
			requestDraw: molstarInstance?.pluginRef?.current?.canvas3d?.requestDraw,
		};
	};

	const restoreCameraSnapshot = (captured: any) => {
		if (!captured?.camera || !captured?.snapshot || typeof captured.camera.setState !== 'function') return;
		captured.camera.setState({
			...captured.camera.state,
			position: captured.snapshot.position,
			target: captured.snapshot.target,
			up: captured.snapshot.up,
			radius: captured.snapshot.radius,
		});
		if (typeof captured.requestDraw === 'function') {
			captured.requestDraw();
		}
	};

	   return {
			  // Use the correct molecule and loaded state for each row
			  viewerTitle:
				  Aligned === 'AlignedTo'
					  ? (viewer.moleculeAlignedTo ? Aligned + `: ${viewer.moleculeAlignedTo.name || viewer.moleculeAlignedTo.label || viewer.moleculeAlignedTo.filename}` : "")
					  : (viewer.moleculeAligned ? Aligned + `: ${viewer.moleculeAligned.name || viewer.moleculeAligned.label || viewer.moleculeAligned.filename}` : ""),
			  isLoaded: Aligned === 'AlignedTo'
				  ? (isMoleculeAlignedToLoaded || Boolean(loadedFilename))
				  : (isMoleculeAlignedLoaded || Boolean(loadedFilename) || Boolean(viewer.moleculeAligned && viewer.moleculeAligned.filename)),
			  loadedFilename:
				  Aligned === 'AlignedTo'
					  ? (viewer.moleculeAlignedTo?.filename || loadedFilename || viewer.moleculeAlignedTo?.name || viewer.moleculeAlignedTo?.label || "")
					  : (viewer.moleculeAligned?.filename || loadedFilename || viewer.moleculeAligned?.name || viewer.moleculeAligned?.label || ""),
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
		onAddColorsClick: colorsFile?.handleButtonClick,
		onLoadChainColorsClick: (chainColorsFile ?? colorsFile)?.handleButtonClick,
		onChainColorsFileChange: (chainColorsFile ?? colorsFile)?.handleFileChange,
		chainColorsInputRef: (chainColorsFile ?? colorsFile)?.inputRef,
		onLoadResidueColorsClick: (residueColorsFile ?? colorsFile)?.handleButtonClick,
		onResidueColorsFileChange: (residueColorsFile ?? colorsFile)?.handleFileChange,
		residueColorsInputRef: (residueColorsFile ?? colorsFile)?.inputRef,
			addColorsDisabled: Aligned === 'AlignedTo' ? !isMoleculeAlignedToLoaded : !isMoleculeAlignedLoaded,
			colorMode,
			onColorModeChange,
			residueTypeColorsById,
			residueTypeCounts,
			onResidueTypeColorChange,
			onSaveColorTheme,
			saveColorThemeDisabled,
		colorThemeOptions,
		selectedColorThemeName,
		onSelectedColorThemeNameChange: setSelectedColorThemeName,
		onRemoveColorTheme,
		removeColorThemeDisabled,
		onSaveChainTheme,
		saveChainThemeDisabled,
		chainThemeOptions,
		selectedChainThemeName,
		onSelectedChainThemeNameChange: setSelectedChainThemeName,
		onRemoveChainTheme,
		removeChainThemeDisabled,
		onSaveResidueTheme,
		saveResidueThemeDisabled,
		residueThemeOptions,
		selectedResidueThemeName,
		onSelectedResidueThemeNameChange: setSelectedResidueThemeName,
		onRemoveResidueTheme,
		removeResidueThemeDisabled,
		onAddRepresentationClick: async () => {
			const selectedChainTheme = selectedChainThemeName ?? selectedColorThemeName ?? 'default';
			const selectedResidueTheme = selectedResidueThemeName ?? 'default';
			const activeThemeKind: 'chain' | 'residue-type' = colorMode === 'residue-type' ? 'residue-type' : 'chain';
			const colorThemeName = activeThemeKind === 'residue-type'
				? selectedResidueTheme
				: selectedChainTheme;
			const colorTheme = {
				name: colorThemeName,
				params: {
					__ribocodeActiveThemeKind: activeThemeKind,
				},
			};
			const themePrefs = {
				chainThemeName: selectedChainTheme,
				residueThemeName: selectedResidueTheme,
				activeThemeKind,
			};
			const repId = (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
			const thisCameraBefore = captureCameraSnapshot(molstar);
			const otherCameraBefore = captureCameraSnapshot(otherMolstar);
			const thisViewerVisible = Aligned === 'AlignedTo'
				? viewer.isMoleculeAlignedToVisible
				: viewer.isMoleculeAlignedVisible;
			const otherViewerVisible = Aligned === 'AlignedTo'
				? otherViewer.isMoleculeAlignedToVisible
				: otherViewer.isMoleculeAlignedVisible;
			const addPromises: Promise<unknown>[] = [];
			if ((Aligned === 'AlignedTo' ? viewer.moleculeAlignedTo : viewer.moleculeAligned) && structureRef) {
				addPromises.push(molstar.addRepresentation(
					Aligned,
					structureRef,
					representationType,
					colorTheme,
					repId,
					thisViewerVisible,
					themePrefs
				));
			}
			if ((Aligned === 'AlignedTo' ? otherViewer.moleculeAlignedTo : otherViewer.moleculeAligned) && otherStructureRef) {
				addPromises.push(otherMolstar.addRepresentation(
					Aligned,
					otherStructureRef,
					representationType,
					colorTheme,
					repId,
					otherViewerVisible,
					themePrefs
				));
			}
			Object.entries(realignedStructRefs).forEach(([id, structRef]) => {
				if (structRef) {
					addPromises.push(molstar.addRepresentation(
						id,
						structRef,
						representationType,
						colorTheme,
						repId,
						true,
						themePrefs
					));
				}
			});
			Object.entries(otherRealignedStructRefs).forEach(([id, structRef]) => {
				if (structRef) {
					addPromises.push(otherMolstar.addRepresentation(
						id,
						structRef,
						representationType,
						colorTheme,
						repId,
						true,
						themePrefs
					));
				}
			});

			await Promise.all(addPromises);

			// Representation creation can transiently perturb camera states; restore both viewers.
			restoreCameraSnapshot(thisCameraBefore);
			restoreCameraSnapshot(otherCameraBefore);
		},
		addRepresentationDisabled: Aligned === 'AlignedTo' ? (!isMoleculeAlignedToLoaded || !representationType) : (!isMoleculeAlignedLoaded || !representationType),
		colorsInputRef: colorsFile?.inputRef,
		onColorsFileChange: colorsFile?.handleFileChange,
		selectedSubunit,
		onSelectSubunit: setSelectedSubunit,
		subunitZoomLabel,
		onSubunitHighlight,
		subunitHighlightOn,
		subunitHighlightDisabled,
		onSubunitInspect,
		subunitInspectOn,
		subunitInspectDisabled,
		onSubunitZoom,
		subunitZoomDisabled,
		subunitSelectDisabled: !isMoleculeAlignedToLoaded,
		chainInfo,
		chainColorsById,
		onChainColorChange,
		selectedChainId,
		onSelectChainId: setSelectedChainId,
		selectedChainId2,
		onSelectChainId2: setSelectedChainId2,
		onClearChainId2: clearSelectedChainId2,
		chainZoomLabel,
		chainZoomLabel2,
		onChainHighlight,
		chainHighlightOn,
		chainHighlightDisabled,
		onChainInspect,
		chainInspectOn,
		chainInspectDisabled,
		onChainHighlight2,
		chainHighlightOn2,
		chainHighlightDisabled2,
		onChainInspect2,
		chainInspectOn2,
		chainInspectDisabled2,
		onChainZoom,
		onChainZoom2,
		chainZoomDisabled,
		chainZoomDisabled2,
		onCombinedSelectionZoom,
		combinedSelectionZoomDisabled,
		onCombinedSelectionHighlight,
		combinedSelectionHighlightOn,
		combinedSelectionHighlightDisabled,
		onCombinedSelectionInspect,
		combinedSelectionInspectOn,
		combinedSelectionInspectDisabled,
		showUniprotAccessionInChainLabels,
		onShowUniprotAccessionInChainLabelsChange: setShowUniprotAccessionInChainLabels,
		uniprotLookupStatus,
		chainSelectDisabled: !isMoleculeAlignedToLoaded,
		residueInfo,
		residueCommonIds,
		selectedResidueIds,
		onSelectResidueIds: setSelectedResidueIds,
		residueInfo2,
		residueCommonIds2,
		selectedResidueIds2,
		onSelectResidueIds2: setSelectedResidueIds2,
		residueZoomLabel,
		residueZoomLabel2,
		onResidueHighlight,
		residueHighlightOn,
		residueHighlightDisabled,
		onResidueInspect,
		residueInspectOn,
		residueInspectDisabled,
		onResidueHighlight2,
		residueHighlightOn2,
		residueHighlightDisabled2,
		onResidueInspect2,
		residueInspectOn2,
		residueInspectDisabled2,
		onResidueZoom,
		onResidueZoom2,
		residueZoomDisabled,
		residueZoomDisabled2,
		zoomExtraRadius,
		onZoomExtraRadiusChange: setZoomExtraRadius,
		zoomMinRadius,
		onZoomMinRadiusChange: setZoomMinRadius,
		selectionDisplayMode,
		onSelectionDisplayModeChange: setSelectionDisplayMode,
		dimUnselected,
		onDimUnselectedChange: setDimUnselected,
		dimUnselectedStrength,
		onDimUnselectedStrengthChange: setDimUnselectedStrength,
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
		clippingDefaultMinNear: Number(clippingDefaults?.minNear ?? clipping.minNear ?? 1),
		clippingDefaultRadius: Number(clippingDefaults?.clipRadius ?? clipping.clipRadius ?? 0),
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
	AlignedTo,
	chainThemeOptions,
	residueThemeOptions,
	onRepresentationChainThemeChange,
	onRepresentationResidueThemeChange,
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
	AlignedTo: string,
	chainThemeOptions?: Array<{ value: string; label: string }>,
	residueThemeOptions?: Array<{ value: string; label: string }>,
	onRepresentationChainThemeChange?: (ref: string, themeName: string) => void,
	onRepresentationResidueThemeChange?: (ref: string, themeName: string) => void,
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
		chainThemeOptions,
		residueThemeOptions,
		onRepresentationChainThemeChange,
		onRepresentationResidueThemeChange,
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
	chainThemeOptions,
	residueThemeOptions,
	onRepresentationChainThemeChange,
	onRepresentationResidueThemeChange,
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
	chainThemeOptions?: Array<{ value: string; label: string }>,
	residueThemeOptions?: Array<{ value: string; label: string }>,
	onRepresentationChainThemeChange?: (ref: string, themeName: string) => void,
	onRepresentationResidueThemeChange?: (ref: string, themeName: string) => void,
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
		chainThemeOptions,
		residueThemeOptions,
		onRepresentationChainThemeChange,
		onRepresentationResidueThemeChange,
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
	const [showClippingControls, setShowClippingControls] = React.useState(false);
	const chainTableProps = viewerKey === 'A'
		? {
			chainLabels: loadDataRowPropsAlignedTo?.chainInfo?.chainLabels as Map<string, string>,
			selectedChainId: loadDataRowPropsAlignedTo?.selectedChainId ?? '',
			onSelectChainId: loadDataRowPropsAlignedTo?.onSelectChainId as (chainId: string) => void,
			title: 'Select',
			query: alignedToChainFinderQuery,
			onQueryChange: onAlignedToChainFinderQueryChange,
		}
		: {
			chainLabels: loadDataRowPropsAligned?.chainInfo?.chainLabels as Map<string, string>,
			selectedChainId: loadDataRowPropsAligned?.selectedChainId ?? '',
			onSelectChainId: loadDataRowPropsAligned?.onSelectChainId as (chainId: string) => void,
			title: 'Select',
			query: alignedChainFinderQuery,
			onQueryChange: onAlignedChainFinderQueryChange,
		};
	const activeLoadProps = viewerKey === 'A' ? loadDataRowPropsAlignedTo : loadDataRowPropsAligned;
	const activeSelectZoomIdPrefix = viewerKey === 'A' ? `${viewerIdPrefix}-alignedto` : `${viewerIdPrefix}-aligned`;
	const clippingNear = Number(activeLoadProps?.clippingMinNear ?? 1);
	const clippingFar = Number(activeLoadProps?.clippingRadius ?? 0);
	const clippingDefaultNear = Number(activeLoadProps?.clippingDefaultMinNear ?? clippingNear);
	const clippingDefaultFar = Number(activeLoadProps?.clippingDefaultRadius ?? clippingFar);

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
		       <button
			   id={`${viewerIdPrefix}-clipping-controls-toggle-btn`}
			   data-testid={`${viewerIdPrefix}-clipping-controls-toggle-btn`}
			   className="molstar-file-btn molstar-advanced-controls-toggle"
			   type="button"
			   onClick={() => setShowClippingControls((current) => !current)}
		       >
			   {showClippingControls ? 'Hide Clipping Controls' : 'Show Clipping Controls'}
		       </button>
		       {showClippingControls && (
			       <div className="load-data-controls" id={`${activeSelectZoomIdPrefix}-clipping-controls`}>
				   <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
					   <button
						   type="button"
						   className="msp-btn msp-form-control"
						   id={`${activeSelectZoomIdPrefix}-clip-near-reset-btn`}
						   onClick={() => activeLoadProps?.onClippingMinNearChange?.(clippingDefaultNear)}
					   >
						   Reset
					   </button>
				   </div>
				   <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
						   id={`${activeSelectZoomIdPrefix}-clip-far-reset-btn`}
						   onClick={() => activeLoadProps?.onClippingRadiusChange?.(clippingDefaultFar)}
					   >
						   Reset
					   </button>
				   </div>
		       </div>
		       )}
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
						   onSubunitInspect={activeLoadProps.onSubunitInspect}
						   subunitInspectOn={activeLoadProps.subunitInspectOn}
						   subunitInspectDisabled={activeLoadProps.subunitInspectDisabled}
						   onSubunitZoom={activeLoadProps.onSubunitZoom}
						   subunitZoomDisabled={activeLoadProps.subunitZoomDisabled}
						   chainInfo={activeLoadProps.chainInfo}
						   selectedChainId={activeLoadProps.selectedChainId}
						   onSelectChainId={activeLoadProps.onSelectChainId}
						   selectedChainId2={activeLoadProps.selectedChainId2}
						   onSelectChainId2={activeLoadProps.onSelectChainId2}
						   onClearChainId2={activeLoadProps.onClearChainId2}
						   chainSelectDisabled={activeLoadProps.chainSelectDisabled}
						   chainZoomLabel={activeLoadProps.chainZoomLabel}
						   chainZoomLabel2={activeLoadProps.chainZoomLabel2}
						   onChainHighlight={activeLoadProps.onChainHighlight}
						   chainHighlightOn={activeLoadProps.chainHighlightOn}
						   chainHighlightDisabled={activeLoadProps.chainHighlightDisabled}
						   onChainInspect={activeLoadProps.onChainInspect}
						   chainInspectOn={activeLoadProps.chainInspectOn}
						   chainInspectDisabled={activeLoadProps.chainInspectDisabled}
						   onChainHighlight2={activeLoadProps.onChainHighlight2}
						   chainHighlightOn2={activeLoadProps.chainHighlightOn2}
						   chainHighlightDisabled2={activeLoadProps.chainHighlightDisabled2}
						   onChainInspect2={activeLoadProps.onChainInspect2}
						   chainInspectOn2={activeLoadProps.chainInspectOn2}
						   chainInspectDisabled2={activeLoadProps.chainInspectDisabled2}
						   onChainZoom={activeLoadProps.onChainZoom}
						   onChainZoom2={activeLoadProps.onChainZoom2}
						   chainZoomDisabled={activeLoadProps.chainZoomDisabled}
						   chainZoomDisabled2={activeLoadProps.chainZoomDisabled2}
						   onCombinedSelectionZoom={activeLoadProps.onCombinedSelectionZoom}
						   combinedSelectionZoomDisabled={activeLoadProps.combinedSelectionZoomDisabled}
						   onCombinedSelectionHighlight={activeLoadProps.onCombinedSelectionHighlight}
						   combinedSelectionHighlightOn={activeLoadProps.combinedSelectionHighlightOn}
						   combinedSelectionHighlightDisabled={activeLoadProps.combinedSelectionHighlightDisabled}
						   onCombinedSelectionInspect={activeLoadProps.onCombinedSelectionInspect}
						   combinedSelectionInspectOn={activeLoadProps.combinedSelectionInspectOn}
						   combinedSelectionInspectDisabled={activeLoadProps.combinedSelectionInspectDisabled}
						   showUniprotAccessionInChainLabels={activeLoadProps.showUniprotAccessionInChainLabels}
						   onShowUniprotAccessionInChainLabelsChange={activeLoadProps.onShowUniprotAccessionInChainLabelsChange}
						   uniprotLookupStatus={activeLoadProps.uniprotLookupStatus}
						   residueInfo={activeLoadProps.residueInfo}
						   residueCommonIds={activeLoadProps.residueCommonIds}
						   selectedResidueIds={activeLoadProps.selectedResidueIds}
						   onSelectResidueIds={activeLoadProps.onSelectResidueIds}
						   residueInfo2={activeLoadProps.residueInfo2}
						   residueCommonIds2={activeLoadProps.residueCommonIds2}
						   selectedResidueIds2={activeLoadProps.selectedResidueIds2}
						   onSelectResidueIds2={activeLoadProps.onSelectResidueIds2}
						   residueSelectDisabled={activeLoadProps.residueSelectDisabled}
						   residueZoomLabel={activeLoadProps.residueZoomLabel}
						   residueZoomLabel2={activeLoadProps.residueZoomLabel2}
						   onResidueHighlight={activeLoadProps.onResidueHighlight}
						   residueHighlightOn={activeLoadProps.residueHighlightOn}
						   residueHighlightDisabled={activeLoadProps.residueHighlightDisabled}
						   onResidueInspect={activeLoadProps.onResidueInspect}
						   residueInspectOn={activeLoadProps.residueInspectOn}
						   residueInspectDisabled={activeLoadProps.residueInspectDisabled}
						   onResidueHighlight2={activeLoadProps.onResidueHighlight2}
						   residueHighlightOn2={activeLoadProps.residueHighlightOn2}
						   residueHighlightDisabled2={activeLoadProps.residueHighlightDisabled2}
						   onResidueInspect2={activeLoadProps.onResidueInspect2}
						   residueInspectOn2={activeLoadProps.residueInspectOn2}
						   residueInspectDisabled2={activeLoadProps.residueInspectDisabled2}
						   onResidueZoom={activeLoadProps.onResidueZoom}
						   onResidueZoom2={activeLoadProps.onResidueZoom2}
						   residueZoomDisabled={activeLoadProps.residueZoomDisabled}
						   residueZoomDisabled2={activeLoadProps.residueZoomDisabled2}
						   zoomExtraRadius={activeLoadProps.zoomExtraRadius}
						   onZoomExtraRadiusChange={activeLoadProps.onZoomExtraRadiusChange}
						   zoomMinRadius={activeLoadProps.zoomMinRadius}
						   onZoomMinRadiusChange={activeLoadProps.onZoomMinRadiusChange}
						   selectionDisplayMode={activeLoadProps.selectionDisplayMode}
						   onSelectionDisplayModeChange={activeLoadProps.onSelectionDisplayModeChange}
						   dimUnselected={activeLoadProps.dimUnselected}
						   onDimUnselectedChange={activeLoadProps.onDimUnselectedChange}
						   dimUnselectedStrength={activeLoadProps.dimUnselectedStrength}
						   onDimUnselectedStrengthChange={activeLoadProps.onDimUnselectedStrengthChange}
						   chainFinderSelectedChainId={chainTableProps.selectedChainId}
						   chainFinderOnSelectChainId={chainTableProps.onSelectChainId || (() => {})}
						   chainFinderTitle={chainTableProps.title}
						   chainFinderQuery={chainTableProps.query}
						   chainFinderOnQueryChange={chainTableProps.onQueryChange}
						   chainFinderIdPrefix={viewerIdPrefix}
						   idPrefix={activeSelectZoomIdPrefix}
					   />
				   </div>
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
