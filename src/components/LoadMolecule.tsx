/**
 * Suffix for the representation type select id, used for consistent id construction in code and tests.
 */
export const repTypeSelectIdSuffix = 'representation-type';
/**
 * LoadMolecule component for loading molecular data into a Mol* viewer, selecting representation type,
 * adding colors, and selecting chain IDs.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React from 'react';
import ChainSelectionTable from './ChainSelectionTable';
import ResidueSelectButton from './buttons/select/Residue';
import SubunitSelectButton from './buttons/select/Subunit';
import { allowedRepresentationTypes, AllowedRepresentationType } from '../types/ribocode';
import { ResidueLabelInfo } from '../utils/residue';

const RESIDUE_DEFAULT_PALETTE = [
    '#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
    '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
    '#1B9E77', '#D95F02', '#7570B3', '#E7298A', '#66A61E',
    '#E6AB02', '#A6761D', '#666666', '#2E86AB', '#A23B72'
];

function getResidueTypeDefaultColor(type: string): string {
    const key = String(type ?? '').trim().toUpperCase();
    if (!key) return RESIDUE_DEFAULT_PALETTE[0];
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    const index = Math.abs(hash) % RESIDUE_DEFAULT_PALETTE.length;
    return RESIDUE_DEFAULT_PALETTE[index];
}
import { RibosomeSubunitType } from '../utils/subunit';

function getLoadButtonTitle(fileInputLabel: string, disabled: boolean): string {
    if (disabled && fileInputLabel === 'Load Aligned') {
        return 'Disabled until AlignedTo is loaded. Load AlignedTo first, then this button will be enabled.';
    }
    if (disabled) {
        return 'Currently disabled. This button is enabled when required data and state are available.';
    }
    if (fileInputLabel === 'Load AlignedTo') {
        return 'Load the AlignedTo reference structure file (.cif or .mmcif).';
    }
    if (fileInputLabel === 'Load Aligned') {
        return 'Load the Aligned structure file (.cif or .mmcif).';
    }
    return 'Load a structure file (.cif or .mmcif).';
}

function getControlsToggleTitle(
    controlsName: string,
    showing: boolean,
    disabledReason?: string
): string {
    if (disabledReason) {
        return `Disabled. ${disabledReason}`;
    }
    return showing
        ? `Hide ${controlsName} controls.`
        : `Show ${controlsName} controls.`;
}

const formatRepresentationType = (representationType: AllowedRepresentationType): string =>
    String(representationType).replace(/-/g, ' ');

const getRepresentationTypeTooltip = (
    disabled: boolean,
    representationType: AllowedRepresentationType
): string =>
    disabled
        ? 'Disabled until the dataset is loaded and ready for representation changes.'
        : `Choose the representation type to add, currently set to ${formatRepresentationType(representationType)}`;

const getAddRepresentationTooltip = (disabled: boolean): string =>
    disabled
        ? 'Disabled until a representation can be added to the loaded dataset.'
        : 'Add a new representation using the selected representation type using the theme as below.';

const getThemeModeTooltip = (disabled: boolean): string =>
    disabled
        ? 'Disabled until colour themes are available for this dataset.'
        : 'Choose whether representation themes are based on chain or residue type.';

const getThemeSelectorTooltip = (kind: 'chain' | 'residue', disabled: boolean): string =>
    disabled
        ? 'Disabled until colour themes are available for this dataset.'
        : kind === 'chain'
            ? 'Select the active chain colour theme.'
            : 'Select the active residue colour theme.';

const getThemeRemoveTooltip = (kind: 'chain' | 'residue', disabled: boolean): string =>
    disabled
        ? 'Disabled until a removable custom theme is selected.'
        : kind === 'chain'
            ? 'Remove the selected chain colour theme.'
            : 'Remove the selected residue colour theme.';

const getThemeLoadTooltip = (kind: 'chain' | 'residue', disabled: boolean): string =>
    disabled
        ? 'Disabled until theme loading is available for the loaded dataset.'
        : kind === 'chain'
            ? 'Load a chain colour theme from .json, .csv, .tsv, or .txt with chain IDs mapped to colour values.'
            : 'Load a residue colour theme from .json, .csv, .tsv, or .txt with residue types mapped to colour values.';

const getThemeSaveTooltip = (kind: 'chain' | 'residue', disabled: boolean): string =>
    disabled
        ? 'Disabled until the current theme can be saved.'
        : kind === 'chain'
            ? 'Save the current chain colour theme to a file.'
            : 'Save the current residue colour theme to a file.';

const getChainColourSearchTooltip = (): string =>
    'Filter chain rows before editing chain colours.';

const getChainColourPickerTooltip = (chainId: string): string =>
    `Choose a new colour for chain ${chainId}.`;

const getChainColourApplyTooltip = (chainId: string, disabled: boolean): string =>
    disabled
        ? `Disabled until chain ${chainId} has an unsaved colour change.`
        : `Apply the selected colour to chain ${chainId}.`;

const getZoomExtraRadiusTooltip = (): string =>
    'Adjust extraRadius padding used when zooming to selections.';

const getZoomMinRadiusTooltip = (): string =>
    'Adjust the minimum zoom radius used when zooming to selections.';

const getHighlightDisplayTooltip = (selectionDisplayMode: 'halo' | 'overlay' | 'hybrid'): string =>
    `Choose how highlights are displayed, currently set to ${selectionDisplayMode}.`;

const getDimUnselectedTooltip = (dimUnselected: boolean, colorMode: 'chain' | 'residue-type'): string => {
    const scopeLabel = colorMode === 'residue-type' ? 'selected residues' : 'selected chain';
    return dimUnselected
        ? `Dim unselected is currently On. Greys and de-emphasizes unselected atoms/residues while keeping ${scopeLabel} emphasized. Click to turn it Off.`
        : `Dim unselected is currently Off. Turn it On to grey and de-emphasize unselected atoms/residues while keeping ${scopeLabel} emphasized.`;
};

const getDimOpacityTooltip = (dimUnselected: boolean): string =>
    dimUnselected
        ? 'Adjust opacity strength applied to unselected atoms/residues.'
        : 'Disabled until Dim unselected is turned On.';

const getSubunitSelectTooltip = (disabled: boolean, selectedSubunit: RibosomeSubunitType): string =>
    disabled
        ? 'Disabled until subunit selection is available for the loaded dataset.'
        : `Choose the active subunit selection, currently set to ${selectedSubunit}.`;

const getSubunitZoomTooltip = (disabled: boolean, subunitZoomLabel: string): string =>
    disabled
        ? 'Disabled until a zoomable subunit selection is available.'
        : `Zoom to current subunit selection (${subunitZoomLabel}).`;

const getSubunitHighlightTooltip = (disabled: boolean, subunitHighlightOn: boolean): string =>
    disabled
        ? 'Disabled until subunit highlighting is available.'
        : subunitHighlightOn
            ? 'Subunit highlight is On. Click to turn it Off.'
            : 'Subunit highlight is Off. Click to turn it On.';

const getSubunitInspectTooltip = (disabled: boolean, subunitInspectOn: boolean): string =>
    disabled
        ? 'Disabled until subunit inspection is available.'
        : subunitInspectOn
            ? 'Subunit inspect is On. Click to turn it Off.'
            : 'Subunit inspect is Off. Click to turn it On.';

const getCombinedSelectionZoomTooltip = (disabled: boolean): string =>
    disabled
        ? 'Disabled until a combined chain selection is available.'
        : 'Zoom to the current combined selection across selected chains.';

const getCombinedSelectionHighlightTooltip = (disabled: boolean, highlightOn: boolean): string =>
    disabled
        ? 'Disabled until combined-selection highlighting is available.'
        : highlightOn
            ? 'Combined-selection highlight is On. Click to turn it Off.'
            : 'Combined-selection highlight is Off. Click to turn it On.';

const getCombinedSelectionInspectTooltip = (disabled: boolean, inspectOn: boolean): string =>
    disabled
        ? 'Disabled until combined-selection inspection is available.'
        : inspectOn
            ? 'Combined-selection inspect is On. Click to turn it Off.'
            : 'Combined-selection inspect is Off. Click to turn it On.';

const getUniprotLabelToggleTooltip = (enabled: boolean): string =>
    enabled
        ? 'UniProt accessions in chain labels are On. Click to turn them Off.'
        : 'UniProt accessions in chain labels are Off. Click to turn them On.';

const getChainSelectTooltip = (slot: string): string =>
    `Select a chain for ${slot}.`;

const getChainZoomTooltip = (slot: 'Select 1' | 'Select 2' | 'Select 3', disabled: boolean, label: string): string =>
    disabled
        ? `Disabled until ${slot} has a zoomable chain selection.`
        : `Zoom to the current ${slot} chain selection (${label}).`;

const getChainHighlightTooltip = (slot: 'Select 1' | 'Select 2' | 'Select 3', disabled: boolean, on: boolean): string =>
    disabled
        ? `Disabled until ${slot} chain highlighting is available.`
        : on
            ? `${slot} chain highlight is On. Click to turn it Off.`
            : `${slot} chain highlight is Off. Click to turn it On.`;

const getChainInspectTooltip = (slot: 'Select 1' | 'Select 2' | 'Select 3', disabled: boolean, on: boolean): string =>
    disabled
        ? `Disabled until ${slot} chain inspection is available.`
        : on
            ? `${slot} chain inspect is On. Click to turn it Off.`
            : `${slot} chain inspect is Off. Click to turn it On.`;

const getResidueSelectTooltip = (slot: 'Select 1' | 'Select 2' | 'Select 3', disabled: boolean): string =>
    disabled
        ? `Disabled until a chain is selected for ${slot}.`
        : `Select one or more residues for ${slot}.`;

const getResidueBulkSelectTooltip = (
    action: 'all' | 'clear' | 'invert' | 'shared',
    slot: 'Select 1' | 'Select 2' | 'Select 3',
    disabled: boolean
): string => {
    if (disabled) {
        if (action === 'shared') {
            return `Disabled until matching chains are selected in both AlignedTo and Aligned views and shared residues are available for ${slot}.`;
        }
        return `Disabled until residue selection is available for ${slot}.`;
    }
    if (action === 'all') return `Select all residues for ${slot}.`;
    if (action === 'clear') return `Clear the current residue selection for ${slot}.`;
    if (action === 'invert') return `Invert the current residue selection for ${slot}.`;
    return `Select residues shared between ${slot} and the other selection.`;
};

const getResidueTypeToggleTooltip = (
    actionLabel: 'Add' | 'Remove',
    type: string,
    slot: 'Select 1' | 'Select 2' | 'Select 3',
    disabled: boolean
): string =>
    disabled
        ? `Disabled until residue type selection is available for ${slot}.`
        : `${actionLabel} all ${type} residues in ${slot}.`;

const getResidueTypeDetailsTooltip = (
    slot: 'Select 1' | 'Select 2' | 'Select 3',
    type: string,
    expanded: boolean,
    disabled: boolean,
): string =>
    disabled
        ? `Disabled until ${type} residue details are available for ${slot}.`
        : expanded
            ? `Hide ${type} residue details for ${slot}.`
            : `Show ${type} residue details for ${slot}.`;

const getResidueZoomTooltip = (slot: 'Select 1' | 'Select 2' | 'Select 3', disabled: boolean, label: string): string =>
    disabled
        ? `Disabled until ${slot} has a zoomable residue selection.`
        : `Zoom to the current ${slot} residue selection (${label}).`;

const getResidueHighlightTooltip = (slot: 'Select 1' | 'Select 2' | 'Select 3', disabled: boolean, on: boolean): string =>
    disabled
        ? `Disabled until ${slot} residue highlighting is available.`
        : on
            ? `${slot} residue highlight is On. Click to turn it Off.`
            : `${slot} residue highlight is Off. Click to turn it On.`;

const getResidueInspectTooltip = (slot: 'Select 1' | 'Select 2' | 'Select 3', disabled: boolean, on: boolean): string =>
    disabled
        ? `Disabled until ${slot} residue inspection is available.`
        : on
            ? `${slot} residue inspect is On. Click to turn it Off.`
            : `${slot} residue inspect is Off. Click to turn it On.`;

/**
 * Suffix for the LoadMolecule root id, used for consistent id construction in code and tests.
 */
export const idSuffix = 'load-molecule';

/**
 * Props for LoadDataRow component.
 * @param clippingMinNear Minimum near clipping plane distance.
 * @param clippingRadius Clipping radius controlling visible scene amount.
 * @param onClippingMinNearChange Function to handle changes to minimum near clipping distance.
 * @param onClippingRadiusChange Function to handle changes to clipping radius.
 * @param viewerTitle The title of the viewer.
 * @param isLoaded Whether the data is loaded.
 * @param onFileInputClick Function to handle file input button click.
 * @param fileInputRef Ref for the hidden file input element.
 * @param onFileChange Function to handle file input change event.
 * @param fileInputDisabled Whether the file input button is disabled.
 * @param fileInputLabel Label for the file input button.
 * @param representationType Current representation type.
 * @param onRepresentationTypeChange Function to handle representation type change.
 * @param representationTypeDisabled Whether the representation type selector is disabled.
 * @param colorsInputRef Ref for the hidden colors file input element.
 * @param onColorsFileChange Function to handle colors file input change event.
 * @param subunitToChainIds Map of subunit types to their associated chain IDs.
 * @param selectedSubunit Currently selected subunit.
 * @param onSelectSubunit Function to handle subunit selection.
 * @param subunitSelectDisabled Whether the subunit select button is disabled.
 * @param chainIds Array of chain IDs.
 * @param selectedChainId Currently selected chain ID.
 * @param onSelectChainId Function to handle chain ID selection.
 * @param chainSelectDisabled Whether the chain select button is disabled.
 * @param residueInfo Information about residues for selection.
 * @param selectedResidueIds Currently selected residue IDs.
 * @param onSelectResidueIds Function to handle residue ID selection.
 * @param residueSelectDisabled Whether the residue select button is disabled.
 * @param representationTypeSelector Optional custom representation type selector component.
 * @param onAddRepresentationClick Function to handle add representation button click.
 * @param addRepresentationDisabled Whether the add representation button is disabled.
 * @param fogEnabled Whether fog is enabled.
 * @param fogNear Fog near distance.
 * @param fogFar Fog far distance.
 * @param onFogEnabledChange Function to handle changes to fog enabled state.
 * @param onFogNearChange Function to handle changes to fog near distance.
 * @param onFogFarChange Function to handle changes to fog far distance.
 * @param idPrefix Prefix for generating unique IDs.
 */
interface LoadDataRowProps {
    viewerTitle: string;
    isLoaded: boolean;
    loadedFilename?: string;
    onFileInputClick: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    fileInputDisabled: boolean;
    fileInputLabel: string;
    representationType: AllowedRepresentationType;
    onRepresentationTypeChange: (type: AllowedRepresentationType) => void;
    representationTypeDisabled: boolean;
    onAddColorsClick?: () => void;
    addColorsDisabled: boolean;
    colorsInputRef?: React.RefObject<HTMLInputElement | null>;
    onColorsFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onLoadChainColorsClick?: () => void;
    chainColorsInputRef?: React.RefObject<HTMLInputElement | null>;
    onChainColorsFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onLoadResidueColorsClick?: () => void;
    residueColorsInputRef?: React.RefObject<HTMLInputElement | null>;
    onResidueColorsFileChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    colorMode?: 'chain' | 'residue-type';
    onColorModeChange?: (mode: 'chain' | 'residue-type') => void;
    residueTypeColorsById?: Map<string, string>;
    residueTypeCounts?: Array<{ type: string; count: number }>;
    onResidueTypeColorChange?: (residueType: string, color: string) => void;
    onSaveColorTheme?: () => void;
    saveColorThemeDisabled?: boolean;
    colorThemeOptions?: Array<{ value: string; label: string }>;
    selectedColorThemeName?: string;
    onSelectedColorThemeNameChange?: (themeName: string) => void;
    onRemoveColorTheme?: () => void;
    removeColorThemeDisabled?: boolean;
    onSaveChainTheme?: () => void;
    saveChainThemeDisabled?: boolean;
    chainThemeOptions?: Array<{ value: string; label: string }>;
    selectedChainThemeName?: string;
    onSelectedChainThemeNameChange?: (themeName: string) => void;
    onRemoveChainTheme?: () => void;
    removeChainThemeDisabled?: boolean;
    onSaveResidueTheme?: () => void;
    saveResidueThemeDisabled?: boolean;
    residueThemeOptions?: Array<{ value: string; label: string }>;
    selectedResidueThemeName?: string;
    onSelectedResidueThemeNameChange?: (themeName: string) => void;
    onRemoveResidueTheme?: () => void;
    removeResidueThemeDisabled?: boolean;
    // Subunit selection
    subunitToChainIds: Map<string, Set<string>>;
    selectedSubunit: RibosomeSubunitType;
    onSelectSubunit: (subunit: RibosomeSubunitType) => void;
    subunitSelectDisabled: boolean;
    subunitZoomLabel: string;
    onSubunitHighlight: () => void;
    subunitHighlightOn?: boolean;
    subunitHighlightDisabled: boolean;
    onSubunitInspect: () => void;
    subunitInspectOn?: boolean;
    subunitInspectDisabled: boolean;
    onSubunitZoom: () => void;
    subunitZoomDisabled: boolean;
    // Chain
    chainInfo: { chainLabels: Map<string, string>; };
    chainColorsById?: Map<string, string>;
    onChainColorChange?: (chainId: string, color: string) => void;
    selectedChainId: string;
    onSelectChainId: (id: string) => void;
    selectedChainId2?: string;
    onSelectChainId2?: (id: string) => void;
    selectedChainId3?: string;
    onSelectChainId3?: (id: string) => void;
    additionalSelectedChainIds?: string[];
    onAdditionalSelectedChainIdsChange?: (ids: string[]) => void;
    chainSelectDisabled: boolean;
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
    onChainHighlight3?: () => void;
    chainHighlightOn3?: boolean;
    chainHighlightDisabled3?: boolean;
    onChainInspect3?: () => void;
    chainInspectOn3?: boolean;
    chainInspectDisabled3?: boolean;
    onChainZoom: () => void;
    onChainZoom2?: () => void;
    onChainZoom3?: () => void;
    chainZoomDisabled: boolean;
    chainZoomDisabled2?: boolean;
    chainZoomLabel3?: string;
    chainZoomDisabled3?: boolean;
    onCombinedSelectionZoom?: () => void;
    combinedSelectionZoomDisabled?: boolean;
    onCombinedSelectionHighlight?: () => void;
    combinedSelectionHighlightOn?: boolean;
    combinedSelectionHighlightDisabled?: boolean;
    onCombinedSelectionInspect?: () => void;
    combinedSelectionInspectOn?: boolean;
    combinedSelectionInspectDisabled?: boolean;
    showUniprotAccessionInChainLabels?: boolean;
    onShowUniprotAccessionInChainLabelsChange?: (value: boolean) => void;
    uniprotLookupStatus?: {
        completed: number;
        pending: number;
        inFlight: number;
    };
    // Residue
    residueInfo: {
        residueLabels: Map<string, ResidueLabelInfo>;
        residueToAtomIds: Record<string, string[]>;
    };
    residueCommonIds?: string[];
    selectedResidueIds: string[];
    onSelectResidueIds: (ids: string[]) => void;
    residueInfo2?: {
        residueLabels: Map<string, ResidueLabelInfo>;
        residueToAtomIds: Record<string, string[]>;
    };
    residueCommonIds2?: string[];
    selectedResidueIds2?: string[];
    onSelectResidueIds2?: (ids: string[]) => void;
    residueInfo3?: {
        residueLabels: Map<string, ResidueLabelInfo>;
        residueToAtomIds: Record<string, string[]>;
    };
    residueCommonIds3?: string[];
    selectedResidueIds3?: string[];
    onSelectResidueIds3?: (ids: string[]) => void;
    residueSelectDisabled: boolean;
    residueZoomLabel: string;
    residueZoomLabel2?: string;
    residueZoomLabel3?: string;
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
    onResidueHighlight3?: () => void;
    residueHighlightOn3?: boolean;
    residueHighlightDisabled3?: boolean;
    onResidueInspect3?: () => void;
    residueInspectOn3?: boolean;
    residueInspectDisabled3?: boolean;
    onResidueZoom: () => void;
    onResidueZoom2?: () => void;
    onResidueZoom3?: () => void;
    residueZoomDisabled: boolean;
    residueZoomDisabled2?: boolean;
    residueZoomDisabled3?: boolean;
    zoomExtraRadius?: number;
    onZoomExtraRadiusChange?: (value: number) => void;
    zoomMinRadius?: number;
    onZoomMinRadiusChange?: (value: number) => void;
    selectionDisplayMode?: 'halo' | 'overlay' | 'hybrid';
    onSelectionDisplayModeChange?: (mode: 'halo' | 'overlay' | 'hybrid') => void;
    dimUnselected?: boolean;
    onDimUnselectedChange?: (value: boolean) => void;
    dimUnselectedStrength?: number;
    onDimUnselectedStrengthChange?: (value: number) => void;
    // Optional representation type selector
    representationTypeSelector?: React.ReactNode;
    onAddRepresentationClick: () => void;
    addRepresentationDisabled: boolean;
    // Fog controls
    fogEnabled: boolean;
    fogNear: number;
    fogFar: number;
    onFogEnabledChange: (enabled: boolean) => void;
    onFogNearChange: (value: number) => void;
    onFogFarChange: (value: number) => void;
    // Clipping controls
    clippingMinNear: number;
    clippingRadius: number;
    onClippingMinNearChange: (value: number) => void;
    onClippingRadiusChange: (value: number) => void;
    // Test mode override
    testMode?: boolean;
    showSelectZoomControls?: boolean;
    idPrefix: string;
}

    export interface SelectZoomControlsProps {
        subunitToChainIds: Map<string, Set<string>>;
        selectedSubunit: RibosomeSubunitType;
        onSelectSubunit: (subunit: RibosomeSubunitType) => void;
        subunitSelectDisabled: boolean;
        subunitZoomLabel: string;
        onSubunitHighlight: () => void;
        subunitHighlightOn?: boolean;
        subunitHighlightDisabled: boolean;
        onSubunitInspect: () => void;
        subunitInspectOn?: boolean;
        subunitInspectDisabled: boolean;
        onSubunitZoom: () => void;
        subunitZoomDisabled: boolean;
        chainInfo: { chainLabels: Map<string, string>; };
        chainColorsById?: Map<string, string>;
        onChainColorChange?: (chainId: string, color: string) => void;
        colorMode?: 'chain' | 'residue-type';
        selectedChainId: string;
        onSelectChainId: (id: string) => void;
        selectedChainId2?: string;
        onSelectChainId2?: (id: string) => void;
        selectedChainId3?: string;
        onSelectChainId3?: (id: string) => void;
        additionalSelectedChainIds?: string[];
        onAdditionalSelectedChainIdsChange?: (ids: string[]) => void;
        onClearChainId2?: () => void;
        onClearChainId3?: () => void;
        chainSelectDisabled: boolean;
        chainZoomLabel: string;
        chainZoomLabel2?: string;
        chainZoomLabel3?: string;
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
        onChainHighlight3?: () => void;
        chainHighlightOn3?: boolean;
        chainHighlightDisabled3?: boolean;
        onChainInspect3?: () => void;
        chainInspectOn3?: boolean;
        chainInspectDisabled3?: boolean;
        onChainZoom: () => void;
        onChainZoom2?: () => void;
        onChainZoom3?: () => void;
        chainZoomDisabled: boolean;
        chainZoomDisabled2?: boolean;
        chainZoomDisabled3?: boolean;
        onCombinedSelectionZoom?: () => void;
        combinedSelectionZoomDisabled?: boolean;
        onCombinedSelectionHighlight?: () => void;
        combinedSelectionHighlightOn?: boolean;
        combinedSelectionHighlightDisabled?: boolean;
        onCombinedSelectionInspect?: () => void;
        combinedSelectionInspectOn?: boolean;
        combinedSelectionInspectDisabled?: boolean;
        showUniprotAccessionInChainLabels?: boolean;
        onShowUniprotAccessionInChainLabelsChange?: (value: boolean) => void;
        uniprotLookupStatus?: {
            completed: number;
            pending: number;
            inFlight: number;
        };
        residueInfo: {
            residueLabels: Map<string, ResidueLabelInfo>;
            residueToAtomIds: Record<string, string[]>;
        };
        residueCommonIds?: string[];
        selectedResidueIds: string[];
        onSelectResidueIds: (ids: string[]) => void;
        residueInfo2?: {
            residueLabels: Map<string, ResidueLabelInfo>;
            residueToAtomIds: Record<string, string[]>;
        };
        residueCommonIds2?: string[];
        selectedResidueIds2?: string[];
        onSelectResidueIds2?: (ids: string[]) => void;
        residueInfo3?: {
            residueLabels: Map<string, ResidueLabelInfo>;
            residueToAtomIds: Record<string, string[]>;
        };
        residueCommonIds3?: string[];
        selectedResidueIds3?: string[];
        onSelectResidueIds3?: (ids: string[]) => void;
        residueSelectDisabled: boolean;
        residueZoomLabel: string;
        residueZoomLabel2?: string;
        residueZoomLabel3?: string;
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
        onResidueHighlight3?: () => void;
        residueHighlightOn3?: boolean;
        residueHighlightDisabled3?: boolean;
        onResidueInspect3?: () => void;
        residueInspectOn3?: boolean;
        residueInspectDisabled3?: boolean;
        onResidueZoom: () => void;
        onResidueZoom2?: () => void;
        onResidueZoom3?: () => void;
        residueZoomDisabled: boolean;
        residueZoomDisabled2?: boolean;
        residueZoomDisabled3?: boolean;
        zoomExtraRadius?: number;
        onZoomExtraRadiusChange?: (value: number) => void;
        zoomMinRadius?: number;
        onZoomMinRadiusChange?: (value: number) => void;
        selectionDisplayMode?: 'halo' | 'overlay' | 'hybrid';
        onSelectionDisplayModeChange?: (mode: 'halo' | 'overlay' | 'hybrid') => void;
        dimUnselected?: boolean;
        onDimUnselectedChange?: (value: boolean) => void;
        dimUnselectedStrength?: number;
        onDimUnselectedStrengthChange?: (value: number) => void;
        chainFinderChainLabels?: Map<string, string>;
        chainFinderSelectedChainId?: string;
        chainFinderOnSelectChainId?: (chainId: string) => void;
        chainFinderTitle?: string;
        chainFinderQuery?: string;
        chainFinderOnQueryChange?: (query: string) => void;
        chainFinderIdPrefix?: string;
        idPrefix: string;
    }

    const EMPTY_CHAIN_SELECTIONS: string[] = [];

    export const SelectZoomControls: React.FC<SelectZoomControlsProps> = ({
        subunitToChainIds,
        selectedSubunit,
        onSelectSubunit,
        subunitSelectDisabled,
        subunitZoomLabel,
        onSubunitHighlight,
        subunitHighlightOn = false,
        subunitHighlightDisabled,
        onSubunitInspect,
        subunitInspectOn = false,
        subunitInspectDisabled,
        onSubunitZoom,
        subunitZoomDisabled,
        chainInfo,
        chainColorsById,
        onChainColorChange,
        colorMode = 'chain',
        selectedChainId,
        onSelectChainId,
        selectedChainId2 = '',
        onSelectChainId2,
        selectedChainId3 = '',
        onSelectChainId3,
        onClearChainId2 = () => {},
        onClearChainId3 = () => {},
        additionalSelectedChainIds = EMPTY_CHAIN_SELECTIONS,
        onAdditionalSelectedChainIdsChange,
        chainSelectDisabled,
        chainZoomLabel,
        chainZoomLabel2 = '',
        chainZoomLabel3 = '',
        onChainHighlight,
        chainHighlightOn = false,
        chainHighlightDisabled,
        onChainInspect,
        chainInspectOn = false,
        chainInspectDisabled,
        onChainHighlight2 = () => {},
        chainHighlightOn2 = false,
        chainHighlightDisabled2 = true,
        onChainInspect2 = () => {},
        chainInspectOn2 = false,
        chainInspectDisabled2 = true,
        onChainHighlight3 = () => {},
        chainHighlightOn3 = false,
        chainHighlightDisabled3 = true,
        onChainInspect3 = () => {},
        chainInspectOn3 = false,
        chainInspectDisabled3 = true,
        onChainZoom,
        onChainZoom2 = () => {},
        onChainZoom3 = () => {},
        chainZoomDisabled,
        chainZoomDisabled2 = true,
        chainZoomDisabled3 = true,
        onCombinedSelectionZoom = () => {},
        combinedSelectionZoomDisabled = true,
        onCombinedSelectionHighlight = () => {},
        combinedSelectionHighlightOn = false,
        combinedSelectionHighlightDisabled = true,
        onCombinedSelectionInspect = () => {},
        combinedSelectionInspectOn = false,
        combinedSelectionInspectDisabled = true,
        showUniprotAccessionInChainLabels = true,
        onShowUniprotAccessionInChainLabelsChange,
        uniprotLookupStatus,
        residueInfo,
        residueCommonIds = [],
        selectedResidueIds,
        onSelectResidueIds,
        residueInfo2,
        residueCommonIds2 = [],
        selectedResidueIds2 = [],
        onSelectResidueIds2,
        residueInfo3,
        residueCommonIds3 = [],
        selectedResidueIds3 = [],
        onSelectResidueIds3,
        residueSelectDisabled,
        residueZoomLabel,
        residueZoomLabel2 = '',
        residueZoomLabel3 = '',
        onResidueHighlight,
        residueHighlightOn = false,
        residueHighlightDisabled,
        onResidueInspect,
        residueInspectOn = false,
        residueInspectDisabled,
        onResidueHighlight2 = () => {},
        residueHighlightOn2 = false,
        residueHighlightDisabled2 = true,
        onResidueInspect2 = () => {},
        residueInspectOn2 = false,
        residueInspectDisabled2 = true,
        onResidueHighlight3 = () => {},
        residueHighlightOn3 = false,
        residueHighlightDisabled3 = true,
        onResidueInspect3 = () => {},
        residueInspectOn3 = false,
        residueInspectDisabled3 = true,
        onResidueZoom,
        onResidueZoom2 = () => {},
        onResidueZoom3 = () => {},
        residueZoomDisabled,
        residueZoomDisabled2 = true,
        residueZoomDisabled3 = true,
        zoomExtraRadius = 0,
        onZoomExtraRadiusChange = () => {},
        zoomMinRadius = 0,
        onZoomMinRadiusChange = () => {},
        selectionDisplayMode = 'hybrid',
        onSelectionDisplayModeChange = () => {},
        dimUnselected = false,
        onDimUnselectedChange = () => {},
        dimUnselectedStrength = 0.45,
        onDimUnselectedStrengthChange = () => {},
        chainFinderChainLabels,
        chainFinderSelectedChainId,
        chainFinderOnSelectChainId,
        chainFinderTitle,
        chainFinderQuery,
        chainFinderOnQueryChange,
        chainFinderIdPrefix,
        idPrefix,
    }) => {
        const [showVisibilityControls, setShowVisibilityControls] = React.useState(false);
        const [showSubunitControls, setShowSubunitControls] = React.useState(false);
        const [showChainControls, setShowChainControls] = React.useState(false);
        const [showSelectChainControls, setShowSelectChainControls] = React.useState(false);
        const [showSelectChain2Controls, setShowSelectChain2Controls] = React.useState(false);
        const [showSelectChain3Controls, setShowSelectChain3Controls] = React.useState(false);
        const [showResidueControls, setShowResidueControls] = React.useState(false);
        const [showResidue2Controls, setShowResidue2Controls] = React.useState(false);
        const [showResidue3Controls, setShowResidue3Controls] = React.useState(false);
        const [expandedResidueTypeDetails, setExpandedResidueTypeDetails] = React.useState<Record<string, boolean>>({});
        const filteredChainLabels = getFilteredChainLabels(selectedSubunit, chainInfo.chainLabels, subunitToChainIds);
        const effectiveChainLabels = chainFinderChainLabels ?? filteredChainLabels;
        const residueSectionDisabled = !selectedChainId;
        const chain2SectionDisabled = !selectedChainId;
        const residue2SectionDisabled = !selectedChainId2;
        const chain3SectionDisabled = !selectedChainId2;
        const residue3SectionDisabled = !selectedChainId3;
        const effectiveChainLabelsSlot2 = React.useMemo(() => {
            if (!selectedChainId) return effectiveChainLabels;
            return new Map(Array.from(effectiveChainLabels.entries()).filter(([id]) => id !== selectedChainId));
        }, [effectiveChainLabels, selectedChainId]);
        const effectiveChainLabelsSlot3 = React.useMemo(() => {
            if (!selectedChainId || !selectedChainId2) return effectiveChainLabelsSlot2;
            return new Map(Array.from(effectiveChainLabels.entries()).filter(([id]) => id !== selectedChainId && id !== selectedChainId2));
        }, [effectiveChainLabels, effectiveChainLabelsSlot2, selectedChainId, selectedChainId2]);
        const selectedChain2Label = selectedChainId2
            ? (effectiveChainLabelsSlot2.get(selectedChainId2) ?? chainInfo.chainLabels.get(selectedChainId2) ?? selectedChainId2)
            : 'None';
        const selectedChain3Label = selectedChainId3
            ? (effectiveChainLabelsSlot3.get(selectedChainId3) ?? chainInfo.chainLabels.get(selectedChainId3) ?? selectedChainId3)
            : 'None';
        const selectedChainSequence = React.useMemo(
            () => [selectedChainId, selectedChainId2, selectedChainId3, ...additionalSelectedChainIds].map(id => id ?? ''),
            [selectedChainId, selectedChainId2, selectedChainId3, additionalSelectedChainIds]
        );
        const additionalSlotCount = Math.max(0, effectiveChainLabels.size - 3);
        const additionalSlotVisibility = React.useMemo(() => {
            const visibility = new Array(additionalSlotCount).fill(false);
            for (let i = 0; i < additionalSlotCount; i += 1) {
                const prerequisite = i === 0 ? selectedChainId3 : additionalSelectedChainIds[i - 1];
                visibility[i] = Boolean(prerequisite);
            }
            return visibility;
        }, [additionalSelectedChainIds, additionalSlotCount, selectedChainId3]);
        const [showAdditionalChainControlsBySlot, setShowAdditionalChainControlsBySlot] = React.useState<Record<number, boolean>>({});

        const setAdditionalSelectionAt = React.useCallback((slotIndex: number, chainId: string) => {
            const current = additionalSelectedChainIds.slice(0, additionalSlotCount);
            const occupied = new Set(
                [selectedChainId, selectedChainId2, selectedChainId3, ...current.slice(0, slotIndex)].filter(Boolean)
            );
            if (!chainId || occupied.has(chainId)) return;
            const next = current.slice(0, slotIndex);
            next[slotIndex] = chainId;
            onAdditionalSelectedChainIdsChange?.(next);
        }, [additionalSelectedChainIds, additionalSlotCount, onAdditionalSelectedChainIdsChange, selectedChainId, selectedChainId2, selectedChainId3]);

        const clearAdditionalSelectionAt = React.useCallback((slotIndex: number) => {
            const current = additionalSelectedChainIds.slice(0, additionalSlotCount);
            const next = current.slice(0, slotIndex);
            onAdditionalSelectedChainIdsChange?.(next);
            setShowAdditionalChainControlsBySlot(prev => {
                const updated: Record<number, boolean> = {};
                for (const key of Object.keys(prev)) {
                    const idx = Number(key);
                    if (Number.isInteger(idx) && idx < slotIndex) {
                        updated[idx] = prev[idx];
                    }
                }
                return updated;
            });
        }, [additionalSelectedChainIds, additionalSlotCount, onAdditionalSelectedChainIdsChange]);

        React.useEffect(() => {
            if (residueSectionDisabled) {
                setShowResidueControls(false);
            }
        }, [residueSectionDisabled]);

        React.useEffect(() => {
            if (residue2SectionDisabled) {
                setShowResidue2Controls(false);
            }
        }, [residue2SectionDisabled]);
        React.useEffect(() => {
            if (residue3SectionDisabled) {
                setShowResidue3Controls(false);
            }
        }, [residue3SectionDisabled]);

        React.useEffect(() => {
            if (chain2SectionDisabled) {
                setShowSelectChain2Controls(false);
                setShowResidue2Controls(false);
                setShowSelectChain3Controls(false);
                setShowResidue3Controls(false);
            }
        }, [chain2SectionDisabled]);
        React.useEffect(() => {
            if (chain3SectionDisabled) {
                setShowSelectChain3Controls(false);
                setShowResidue3Controls(false);
            }
        }, [chain3SectionDisabled]);
        React.useEffect(() => {
            setShowAdditionalChainControlsBySlot(prev => {
                const next: Record<number, boolean> = {};
                for (const key of Object.keys(prev)) {
                    const idx = Number(key);
                    if (Number.isInteger(idx) && idx < additionalSlotCount && additionalSlotVisibility[idx]) {
                        next[idx] = prev[idx];
                    }
                }
                return next;
            });
        }, [additionalSlotCount, additionalSlotVisibility]);

        const selectedChainLabel = selectedChainId
            ? (effectiveChainLabels.get(selectedChainId) ?? chainInfo.chainLabels.get(selectedChainId) ?? selectedChainId)
            : 'None';
        const orderedResidueIds = React.useMemo(() => {
            const orderedEntries = Array.from(residueInfo.residueLabels.entries()).sort(
                ([, a], [, b]) => a.seqNumber - b.seqNumber || a.insCode.localeCompare(b.insCode)
            );
            return orderedEntries.map(([residueId]) => residueId);
        }, [residueInfo.residueLabels]);
        const orderedResidueIds2 = React.useMemo(() => {
            const residueLabels = residueInfo2?.residueLabels;
            if (!residueLabels) return [] as string[];
            const orderedEntries = Array.from(residueLabels.entries()).sort(
                ([, a], [, b]) => a.seqNumber - b.seqNumber || a.insCode.localeCompare(b.insCode)
            );
            return orderedEntries.map(([residueId]) => residueId);
        }, [residueInfo2]);
        const orderedResidueIds3 = React.useMemo(() => {
            const residueLabels = residueInfo3?.residueLabels;
            if (!residueLabels) return [] as string[];
            const orderedEntries = Array.from(residueLabels.entries()).sort(
                ([, a], [, b]) => a.seqNumber - b.seqNumber || a.insCode.localeCompare(b.insCode)
            );
            return orderedEntries.map(([residueId]) => residueId);
        }, [residueInfo3]);
        const residueTypeBuckets = React.useMemo(() => {
            const buckets = new Map<string, string[]>();
            for (const residueId of orderedResidueIds) {
                const info = residueInfo.residueLabels.get(residueId);
                const key = String(info?.compId || '?').trim().toUpperCase() || '?';
                if (!buckets.has(key)) buckets.set(key, []);
                buckets.get(key)!.push(residueId);
            }
            return Array.from(buckets.entries())
                .map(([type, residueIds]) => ({ type, residueIds, count: residueIds.length }))
                .sort((a, b) => a.type.localeCompare(b.type));
        }, [orderedResidueIds, residueInfo.residueLabels]);
        const allResidueTypeCounts = React.useMemo(() => {
            const counts = new Map<string, number>();
            const addFrom = (info?: { residueLabels: Map<string, ResidueLabelInfo> }) => {
                if (!info) return;
                for (const [, residue] of info.residueLabels.entries()) {
                    const type = String(residue.compId || '?').trim().toUpperCase() || '?';
                    counts.set(type, (counts.get(type) ?? 0) + 1);
                }
            };
            addFrom(residueInfo);
            addFrom(residueInfo2);
            return Array.from(counts.entries())
                .map(([type, count]) => ({ type, count }))
                .sort((a, b) => a.type.localeCompare(b.type));
        }, [residueInfo, residueInfo2]);
        const residueTypeBuckets2 = React.useMemo(() => {
            const residueLabels = residueInfo2?.residueLabels;
            if (!residueLabels) return [] as Array<{ type: string; residueIds: string[]; count: number }>;
            const buckets = new Map<string, string[]>();
            for (const residueId of orderedResidueIds2) {
                const info = residueLabels.get(residueId);
                const key = String(info?.compId || '?').trim().toUpperCase() || '?';
                if (!buckets.has(key)) buckets.set(key, []);
                buckets.get(key)!.push(residueId);
            }
            return Array.from(buckets.entries())
                .map(([type, residueIds]) => ({ type, residueIds, count: residueIds.length }))
                .sort((a, b) => a.type.localeCompare(b.type));
        }, [orderedResidueIds2, residueInfo2]);
        const residueTypeBuckets3 = React.useMemo(() => {
            const residueLabels = residueInfo3?.residueLabels;
            if (!residueLabels) return [] as Array<{ type: string; residueIds: string[]; count: number }>;
            const buckets = new Map<string, string[]>();
            for (const residueId of orderedResidueIds3) {
                const info = residueLabels.get(residueId);
                const key = String(info?.compId || '?').trim().toUpperCase() || '?';
                if (!buckets.has(key)) buckets.set(key, []);
                buckets.get(key)!.push(residueId);
            }
            return Array.from(buckets.entries())
                .map(([type, residueIds]) => ({ type, residueIds, count: residueIds.length }))
                .sort((a, b) => a.type.localeCompare(b.type));
        }, [orderedResidueIds3, residueInfo3]);
        const orderedSelectionFromSet = React.useCallback((set: Set<string>): string[] => {
            const ordered: string[] = [];
            for (const residueId of orderedResidueIds) {
                if (set.has(residueId)) ordered.push(residueId);
            }
            return ordered;
        }, [orderedResidueIds]);

        const orderedSelectionFromSet2 = React.useCallback((set: Set<string>): string[] => {
            const ordered: string[] = [];
            for (const residueId of orderedResidueIds2) {
                if (set.has(residueId)) ordered.push(residueId);
            }
            return ordered;
        }, [orderedResidueIds2]);
        const orderedSelectionFromSet3 = React.useCallback((set: Set<string>): string[] => {
            const ordered: string[] = [];
            for (const residueId of orderedResidueIds3) {
                if (set.has(residueId)) ordered.push(residueId);
            }
            return ordered;
        }, [orderedResidueIds3]);
        const orderSelectionForSlot = React.useCallback((slot: '' | '2' | '3', set: Set<string>): string[] => {
            if (slot === '2') return orderedSelectionFromSet2(set);
            if (slot === '3') return orderedSelectionFromSet3(set);
            return orderedSelectionFromSet(set);
        }, [orderedSelectionFromSet, orderedSelectionFromSet2, orderedSelectionFromSet3]);

        const renderResidueControls = ({
            slot,
            residueInfoSlot,
            selectedResidueIdsSlot,
            onSelectResidueIdsSlot,
            residueCommonIdsSlot,
            orderedResidueIdsSlot,
            residueTypeBucketsSlot,
            zoomLabel,
            onZoom,
            zoomDisabled,
            onHighlight,
            highlightOn,
            highlightDisabled,
            onInspect,
            inspectOn,
            inspectDisabled,
            selectedChainIdSlot,
            showSharedButton,
        }: {
            slot: '' | '2' | '3';
            residueInfoSlot: { residueLabels: Map<string, ResidueLabelInfo> };
            selectedResidueIdsSlot: string[];
            onSelectResidueIdsSlot: (ids: string[]) => void;
            residueCommonIdsSlot: string[];
            orderedResidueIdsSlot: string[];
            residueTypeBucketsSlot: Array<{ type: string; residueIds: string[]; count: number }>;
            zoomLabel: string;
            onZoom: () => void;
            zoomDisabled: boolean;
            onHighlight: () => void;
            highlightOn: boolean;
            highlightDisabled: boolean;
            onInspect: () => void;
            inspectOn: boolean;
            inspectDisabled: boolean;
            selectedChainIdSlot: string;
            showSharedButton: boolean;
        }) => (
            (() => {
                const slotLabel: 'Select 1' | 'Select 2' | 'Select 3' = slot === '2' ? 'Select 2' : slot === '3' ? 'Select 3' : 'Select 1';
                return (
            <>
                <div className="load-data-control-row" style={{ marginLeft: 36 }}>
                    <ResidueSelectButton
                        disabled={residueSelectDisabled || !selectedChainIdSlot}
                        residueLabels={residueInfoSlot.residueLabels}
                        selectedResidueIds={selectedResidueIdsSlot}
                        onSelect={onSelectResidueIdsSlot}
                        title={getResidueSelectTooltip(slotLabel, residueSelectDisabled || !selectedChainIdSlot)}
                        id={`${idPrefix}-residue${slot}-select`}
                    />
                </div>
                <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 36 }}>
                    <button
                        type="button"
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-residue${slot}-select-all-btn`}
                        disabled={residueSelectDisabled || orderedResidueIdsSlot.length === 0}
                        title={getResidueBulkSelectTooltip('all', slotLabel, residueSelectDisabled || orderedResidueIdsSlot.length === 0)}
                        onClick={() => onSelectResidueIdsSlot(orderedResidueIdsSlot)}
                    >
                        Select All
                    </button>
                    <button
                        type="button"
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-residue${slot}-clear-selection-btn`}
                        disabled={residueSelectDisabled || selectedResidueIdsSlot.length === 0}
                        title={getResidueBulkSelectTooltip('clear', slotLabel, residueSelectDisabled || selectedResidueIdsSlot.length === 0)}
                        onClick={() => onSelectResidueIdsSlot([])}
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-residue${slot}-invert-selection-btn`}
                        disabled={residueSelectDisabled || orderedResidueIdsSlot.length === 0}
                        title={getResidueBulkSelectTooltip('invert', slotLabel, residueSelectDisabled || orderedResidueIdsSlot.length === 0)}
                        onClick={() => {
                            const selectedSet = new Set(selectedResidueIdsSlot);
                            const inverted = orderedResidueIdsSlot.filter(id => !selectedSet.has(id));
                            onSelectResidueIdsSlot(inverted);
                        }}
                    >
                        Invert
                    </button>
                    {showSharedButton && (
                        <button
                            type="button"
                            className="msp-btn msp-form-control"
                            id={`${idPrefix}-residue${slot}-select-common-btn`}
                            disabled={residueSelectDisabled || residueCommonIdsSlot.length === 0}
                            title={getResidueBulkSelectTooltip('shared', slotLabel, residueSelectDisabled || residueCommonIdsSlot.length === 0)}
                            onClick={() => {
                                const available = new Set(orderedResidueIdsSlot);
                                const common = residueCommonIdsSlot.filter(id => available.has(id));
                                onSelectResidueIdsSlot(common);
                            }}
                        >
                            Select Shared
                        </button>
                    )}
                </div>
                {residueTypeBucketsSlot.length > 0 && (
                    <div className="load-data-control-row" style={{ marginLeft: 36, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {residueTypeBucketsSlot.map(({ type, residueIds, count }) => {
                            const selectedSet = new Set(selectedResidueIdsSlot);
                            const allSelected = residueIds.length > 0 && residueIds.every(id => selectedSet.has(id));
                            const actionLabel = allSelected ? 'Remove' : 'Add';
                            const btnIdSafeType = type.replace(/[^A-Za-z0-9_-]/g, '_');
                            const detailsKey = `${slot || '1'}:${type}`;
                            const detailsExpanded = Boolean(expandedResidueTypeDetails[detailsKey]);
                            return (
                                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span>{`${type} (${count})`}</span>
                                    <button
                                        type="button"
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-residue${slot}-type-toggle-${btnIdSafeType}-btn`}
                                        disabled={residueSelectDisabled || residueIds.length === 0}
                                        title={getResidueTypeToggleTooltip(actionLabel as 'Add' | 'Remove', type, slotLabel, residueSelectDisabled || residueIds.length === 0)}
                                        onClick={() => {
                                            const nextSet = new Set(selectedResidueIdsSlot);
                                            if (allSelected) {
                                                residueIds.forEach(id => nextSet.delete(id));
                                            } else {
                                                residueIds.forEach(id => nextSet.add(id));
                                            }
                                            onSelectResidueIdsSlot(orderSelectionForSlot(slot, nextSet));
                                        }}
                                    >
                                        {actionLabel}
                                    </button>
                                    <button
                                        type="button"
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-residue${slot}-type-details-${btnIdSafeType}-btn`}
                                        disabled={residueSelectDisabled || residueIds.length === 0}
                                        title={getResidueTypeDetailsTooltip(slotLabel, type, detailsExpanded, residueSelectDisabled || residueIds.length === 0)}
                                        aria-expanded={detailsExpanded}
                                        onClick={() => setExpandedResidueTypeDetails(prev => ({ ...prev, [detailsKey]: !prev[detailsKey] }))}
                                    >
                                        {detailsExpanded ? 'Hide list' : 'Show list'}
                                    </button>
                                    {detailsExpanded && (
                                        <div
                                            id={`${idPrefix}-residue${slot}-type-details-${btnIdSafeType}-panel`}
                                            style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 8 }}
                                        >
                                            {residueIds.map((residueId) => {
                                                const residueInfo = residueInfoSlot.residueLabels.get(residueId);
                                                const residueLabel = residueInfo?.name ?? residueId;
                                                const residueIdSafe = residueId.replace(/[^A-Za-z0-9_-]/g, '_');
                                                return (
                                                    <label
                                                        key={residueId}
                                                        htmlFor={`${idPrefix}-residue${slot}-type-${btnIdSafeType}-residue-${residueIdSafe}-chk`}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                                    >
                                                        <input
                                                            id={`${idPrefix}-residue${slot}-type-${btnIdSafeType}-residue-${residueIdSafe}-chk`}
                                                            type="checkbox"
                                                            checked={selectedSet.has(residueId)}
                                                            onChange={() => {
                                                                const nextSet = new Set(selectedResidueIdsSlot);
                                                                if (nextSet.has(residueId)) {
                                                                    nextSet.delete(residueId);
                                                                } else {
                                                                    nextSet.add(residueId);
                                                                }
                                                                onSelectResidueIdsSlot(orderSelectionForSlot(slot, nextSet));
                                                            }}
                                                        />
                                                        <span>{residueLabel}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 36 }}>
                    <button
                        onClick={onZoom}
                        disabled={zoomDisabled}
                        aria-label={`Zoom (${zoomLabel})`}
                        title={getResidueZoomTooltip(slotLabel, zoomDisabled, zoomLabel)}
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-zoom-residue${slot}-btn`}
                    >
                        Zoom
                    </button>
                    <button
                        onClick={onHighlight}
                        disabled={highlightDisabled}
                        aria-pressed={highlightOn}
                        title={getResidueHighlightTooltip(slotLabel, highlightDisabled, highlightOn)}
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-highlight-residue${slot}-btn`}
                    >
                        Highlight: {highlightOn ? 'On' : 'Off'}
                    </button>
                    <button
                        onClick={onInspect}
                        disabled={inspectDisabled}
                        aria-pressed={inspectOn}
                        title={getResidueInspectTooltip(slotLabel, inspectDisabled, inspectOn)}
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-inspect-residue${slot}-btn`}
                    >
                        Inspect: {inspectOn ? 'On' : 'Off'}
                    </button>
                </div>
            </>
                );
            })()
        );

        return (
            <>
                <div className="load-data-control-row">
                    <button
                        type="button"
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-visibility-controls-toggle-btn`}
                        onClick={() => setShowVisibilityControls((current) => !current)}
                        title={getControlsToggleTitle('visibility', showVisibilityControls)}
                    >
                        {showVisibilityControls ? 'Hide Visibility Controls' : 'Show Visibility Controls'}
                    </button>
                </div>
                {showVisibilityControls && (
                    <>
                        <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 12 }}>
                            <label htmlFor={`${idPrefix}-zoom-extra-radius`}>Zoom extraRadius:</label>
                            <input
                                id={`${idPrefix}-zoom-extra-radius`}
                                type="number"
                                value={zoomExtraRadius}
                                min={0}
                                max={100}
                                step={1}
                                style={{ width: 60 }}
                                title={getZoomExtraRadiusTooltip()}
                                onChange={e => onZoomExtraRadiusChange(Number(e.target.value))}
                            />
                            <label htmlFor={`${idPrefix}-zoom-min-radius`}>minRadius:</label>
                            <input
                                id={`${idPrefix}-zoom-min-radius`}
                                type="number"
                                value={zoomMinRadius}
                                min={0}
                                max={100}
                                step={1}
                                style={{ width: 60 }}
                                title={getZoomMinRadiusTooltip()}
                                onChange={e => onZoomMinRadiusChange(Number(e.target.value))}
                            />
                        </div>
                        <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 12 }}>
                            <label htmlFor={`${idPrefix}-selection-display-mode`}>Highlight display:</label>
                            <select
                                id={`${idPrefix}-selection-display-mode`}
                                value={selectionDisplayMode}
                                onChange={e => onSelectionDisplayModeChange(e.target.value as 'halo' | 'overlay' | 'hybrid')}
                                title={getHighlightDisplayTooltip(selectionDisplayMode)}
                                className="msp-select msp-form-control"
                            >
                                <option value="halo">Highlight (halo)</option>
                                <option value="overlay">Colour overlay</option>
                                <option value="hybrid">Hybrid</option>
                            </select>
                        </div>
                        <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 12 }}>
                            <button
                                type="button"
                                className="msp-btn msp-form-control"
                                id={`${idPrefix}-dim-unselected-toggle-btn`}
                                aria-pressed={dimUnselected}
                                title={getDimUnselectedTooltip(dimUnselected, colorMode)}
                                onClick={() => onDimUnselectedChange(!dimUnselected)}
                            >
                                Dim unselected: {dimUnselected ? 'On' : 'Off'}
                            </button>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <label htmlFor={`${idPrefix}-dim-unselected-strength`}>Opacity</label>
                                <input
                                    id={`${idPrefix}-dim-unselected-strength`}
                                    type="range"
                                    min={0}
                                    max={100}
                                    step={1}
                                    value={Math.round(dimUnselectedStrength * 100)}
                                    onChange={e => onDimUnselectedStrengthChange(Number(e.target.value) / 100)}
                                    disabled={!dimUnselected}
                                    title={getDimOpacityTooltip(dimUnselected)}
                                />
                                <span>{Math.round(dimUnselectedStrength * 100)}%</span>
                            </div>
                        </div>
                    </>
                )}
                <div className="load-data-control-row">
                    <button
                        type="button"
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-subunit-controls-toggle-btn`}
                        onClick={() => setShowSubunitControls((current) => !current)}
                        title={getControlsToggleTitle('subunit', showSubunitControls)}
                    >
                        {showSubunitControls ? 'Hide Subunit Controls' : 'Show Subunit Controls'}
                    </button>
                </div>
                {showSubunitControls && (
                    <>
                        <div className="load-data-control-row" style={{ marginLeft: 12 }}>
                            <SubunitSelectButton
                                disabled={subunitSelectDisabled}
                                selectedSubunit={selectedSubunit}
                                onSelect={onSelectSubunit}
                                id={`${idPrefix}-subunit-select`}
                                title={getSubunitSelectTooltip(subunitSelectDisabled, selectedSubunit)}
                            />
                        </div>
                        <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 12 }}>
                            <button
                                onClick={onSubunitZoom}
                                disabled={subunitZoomDisabled}
                                aria-label={`Zoom (${subunitZoomLabel})`}
                                title={getSubunitZoomTooltip(subunitZoomDisabled, subunitZoomLabel)}
                                className="msp-btn msp-form-control"
                                id={`${idPrefix}-zoom-subunit-btn`}
                            >
                                Zoom
                            </button>
                            <button
                                onClick={onSubunitHighlight}
                                disabled={subunitHighlightDisabled}
                                aria-pressed={subunitHighlightOn}
                                title={getSubunitHighlightTooltip(subunitHighlightDisabled, subunitHighlightOn)}
                                className="msp-btn msp-form-control"
                                id={`${idPrefix}-highlight-subunit-btn`}
                            >
                                Highlight: {subunitHighlightOn ? 'On' : 'Off'}
                            </button>
                            <button
                                onClick={onSubunitInspect}
                                disabled={subunitInspectDisabled}
                                aria-pressed={subunitInspectOn}
                                title={getSubunitInspectTooltip(subunitInspectDisabled, subunitInspectOn)}
                                className="msp-btn msp-form-control"
                                id={`${idPrefix}-inspect-subunit-btn`}
                            >
                                Inspect: {subunitInspectOn ? 'On' : 'Off'}
                            </button>
                        </div>
                    </>
                )}

                <div className="load-data-control-row">
                    <button
                        type="button"
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-chain-controls-toggle-btn`}
                        onClick={() => setShowChainControls((current) => !current)}
                        title={getControlsToggleTitle('chain', showChainControls)}
                    >
                        {showChainControls ? 'Hide Chain Controls' : 'Show Chain Controls'}
                    </button>
                </div>
                {showChainControls && (
                    <>
                        <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 12 }}>
                            <button
                                onClick={onCombinedSelectionZoom}
                                disabled={combinedSelectionZoomDisabled}
                                title={getCombinedSelectionZoomTooltip(combinedSelectionZoomDisabled)}
                                className="msp-btn msp-form-control"
                                id={`${idPrefix}-zoom-combined-selection-btn`}
                            >
                                Zoom
                            </button>
                            <button
                                onClick={onCombinedSelectionHighlight}
                                disabled={combinedSelectionHighlightDisabled}
                                aria-pressed={combinedSelectionHighlightOn}
                                title={getCombinedSelectionHighlightTooltip(combinedSelectionHighlightDisabled, combinedSelectionHighlightOn)}
                                className="msp-btn msp-form-control"
                                id={`${idPrefix}-highlight-combined-selection-btn`}
                            >
                                Highlight: {combinedSelectionHighlightOn ? 'On' : 'Off'}
                            </button>
                            <button
                                onClick={onCombinedSelectionInspect}
                                disabled={combinedSelectionInspectDisabled}
                                aria-pressed={combinedSelectionInspectOn}
                                title={getCombinedSelectionInspectTooltip(combinedSelectionInspectDisabled, combinedSelectionInspectOn)}
                                className="msp-btn msp-form-control"
                                id={`${idPrefix}-inspect-combined-selection-btn`}
                            >
                                Inspect: {combinedSelectionInspectOn ? 'On' : 'Off'}
                            </button>
                        </div>
                        {onShowUniprotAccessionInChainLabelsChange && (
                            <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 12 }}>
                                <button
                                    type="button"
                                    className="msp-btn msp-form-control"
                                    id={`${idPrefix}-show-uniprot-accession`}
                                    aria-pressed={showUniprotAccessionInChainLabels}
                                    title={getUniprotLabelToggleTooltip(showUniprotAccessionInChainLabels)}
                                    onClick={() => onShowUniprotAccessionInChainLabelsChange(!showUniprotAccessionInChainLabels)}
                                >
                                    Include UniProt accession in labels: {showUniprotAccessionInChainLabels ? 'On' : 'Off'}
                                </button>
                                <span
                                    id={`${idPrefix}-uniprot-status`}
                                    style={{ fontSize: 12, color: '#555' }}
                                >
                                    UniProt cache: {uniprotLookupStatus?.completed ?? 0} cached, {uniprotLookupStatus?.pending ?? 0} pending, {uniprotLookupStatus?.inFlight ?? 0} in-flight
                                </span>
                            </div>
                        )}
                        <div className="load-data-control-row" id={`${idPrefix}-selected-chain-label`} style={{ marginLeft: 12 }}>
                            <span>Selected 1: {selectedChainLabel}</span>
                        </div>
                        <div className="load-data-control-row" style={{ marginLeft: 12 }}>
                            <button
                                type="button"
                                className="msp-btn msp-form-control"
                                id={`${idPrefix}-select-chain-controls-toggle-btn`}
                                onClick={() => setShowSelectChainControls((current) => !current)}
                                title={getControlsToggleTitle('Select 1', showSelectChainControls)}
                            >
                                {showSelectChainControls ? 'Hide Select 1' : 'Show Select 1'}
                            </button>
                        </div>
                        {showSelectChainControls && (
                            <>
                                <div style={{ marginLeft: 24 }}>
                                    {!!effectiveChainLabels && effectiveChainLabels.size > 0 && (
                                        <ChainSelectionTable
                                            chainLabels={effectiveChainLabels}
                                            selectedChainId={chainFinderSelectedChainId ?? selectedChainId}
                                            onSelectChainId={chainFinderOnSelectChainId ?? onSelectChainId}
                                            title={chainFinderTitle}
                                            titleTooltip={getChainSelectTooltip('Select 1')}
                                            query={chainFinderQuery}
                                            onQueryChange={chainFinderOnQueryChange}
                                            idPrefix={chainFinderIdPrefix ?? idPrefix}
                                        />
                                    )}
                                </div>
                                <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 24 }}>
                                    <button
                                        onClick={onChainZoom}
                                        disabled={chainZoomDisabled}
                                        aria-label={`Zoom (${chainZoomLabel})`}
                                        title={getChainZoomTooltip('Select 1', chainZoomDisabled, chainZoomLabel)}
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-zoom-chain-btn`}
                                    >
                                        Zoom
                                    </button>
                                    <button
                                        onClick={onChainHighlight}
                                        disabled={chainHighlightDisabled}
                                        aria-pressed={chainHighlightOn}
                                        title={getChainHighlightTooltip('Select 1', chainHighlightDisabled, chainHighlightOn)}
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-highlight-chain-btn`}
                                    >
                                        Highlight: {chainHighlightOn ? 'On' : 'Off'}
                                    </button>
                                    <button
                                        onClick={onChainInspect}
                                        disabled={chainInspectDisabled}
                                        aria-pressed={chainInspectOn}
                                        title={getChainInspectTooltip('Select 1', chainInspectDisabled, chainInspectOn)}
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-inspect-chain-btn`}
                                    >
                                        Inspect: {chainInspectOn ? 'On' : 'Off'}
                                    </button>
                                </div>
                                <div className="load-data-control-row" style={{ marginLeft: 24 }}>
                                    <button
                                        type="button"
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-residue-controls-toggle-btn`}
                                        onClick={() => setShowResidueControls((current) => !current)}
                                        title={getControlsToggleTitle(
                                            'residue',
                                            showResidueControls,
                                            residueSectionDisabled
                                                ? 'Select a chain in Select 1 to enable residue controls.'
                                                : undefined
                                        )}
                                        aria-disabled={residueSectionDisabled}
                                        disabled={residueSectionDisabled}
                                    >
                                        {showResidueControls ? 'Hide Residue Controls' : 'Show Residue Controls'}
                                    </button>
                                </div>
                                {showResidueControls && (
                                    renderResidueControls({
                                        slot: '',
                                        residueInfoSlot: residueInfo,
                                        selectedResidueIdsSlot: selectedResidueIds,
                                        onSelectResidueIdsSlot: onSelectResidueIds,
                                        residueCommonIdsSlot: residueCommonIds,
                                        orderedResidueIdsSlot: orderedResidueIds,
                                        residueTypeBucketsSlot: residueTypeBuckets,
                                        zoomLabel: residueZoomLabel,
                                        onZoom: onResidueZoom,
                                        zoomDisabled: residueZoomDisabled,
                                        onHighlight: onResidueHighlight,
                                        highlightOn: residueHighlightOn,
                                        highlightDisabled: residueHighlightDisabled,
                                        onInspect: onResidueInspect,
                                        inspectOn: residueInspectOn,
                                        inspectDisabled: residueInspectDisabled,
                                        selectedChainIdSlot: selectedChainId,
                                        showSharedButton: true,
                                    })
                                )}
                            </>
                        )}
                        {!!selectedChainId && (
                            <>
                                <div className="load-data-control-row" id={`${idPrefix}-selected-chain2-label`} style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span>Selected 2: {selectedChain2Label}</span>
                                    <button
                                        type="button"
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-clear-chain2-selection-btn`}
                                        aria-label="Clear Chain 2"
                                        disabled={!selectedChainId2}
                                        onClick={onClearChainId2}
                                        style={{ minWidth: 0, padding: '2px 8px' }}
                                    >
                                        X
                                    </button>
                                </div>
                                <div className="load-data-control-row" style={{ marginLeft: 12 }}>
                                    <button
                                        type="button"
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-select-chain2-controls-toggle-btn`}
                                        onClick={() => setShowSelectChain2Controls((current) => !current)}
                                        title={getControlsToggleTitle('Select 2', showSelectChain2Controls)}
                                    >
                                        {showSelectChain2Controls ? 'Hide Select 2' : 'Show Select 2'}
                                    </button>
                                </div>
                                {showSelectChain2Controls && (
                                    <>
                                        <div style={{ marginLeft: 24 }}>
                                            {!!effectiveChainLabelsSlot2 && effectiveChainLabelsSlot2.size > 0 && (
                                                <ChainSelectionTable
                                                    chainLabels={effectiveChainLabelsSlot2}
                                                    selectedChainId={selectedChainId2}
                                                    onSelectChainId={onSelectChainId2 ?? (() => {})}
                                                    title="Select"
                                                    titleTooltip={getChainSelectTooltip('Select 2')}
                                                    idPrefix={`${idPrefix}-chain2`}
                                                />
                                            )}
                                        </div>
                                        <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 24 }}>
                                            <button
                                                type="button"
                                                className="msp-btn msp-form-control"
                                                id={`${idPrefix}-zoom-chain2-btn`}
                                                onClick={onChainZoom2}
                                                disabled={chainZoomDisabled2}
                                                aria-label={`Zoom (${chainZoomLabel2})`}
                                                title={getChainZoomTooltip('Select 2', chainZoomDisabled2, chainZoomLabel2)}
                                            >
                                                Zoom
                                            </button>
                                            <button
                                                type="button"
                                                className="msp-btn msp-form-control"
                                                id={`${idPrefix}-highlight-chain2-btn`}
                                                onClick={onChainHighlight2}
                                                disabled={chainHighlightDisabled2}
                                                aria-pressed={chainHighlightOn2}
                                                title={getChainHighlightTooltip('Select 2', chainHighlightDisabled2, chainHighlightOn2)}
                                            >
                                                Highlight: {chainHighlightOn2 ? 'On' : 'Off'}
                                            </button>
                                            <button
                                                type="button"
                                                className="msp-btn msp-form-control"
                                                id={`${idPrefix}-inspect-chain2-btn`}
                                                onClick={onChainInspect2}
                                                disabled={chainInspectDisabled2}
                                                aria-pressed={chainInspectOn2}
                                                title={getChainInspectTooltip('Select 2', chainInspectDisabled2, chainInspectOn2)}
                                            >
                                                Inspect: {chainInspectOn2 ? 'On' : 'Off'}
                                            </button>
                                        </div>
                                        <div className="load-data-control-row" style={{ marginLeft: 24 }}>
                                            <button
                                                type="button"
                                                className="msp-btn msp-form-control"
                                                id={`${idPrefix}-residue2-controls-toggle-btn`}
                                                onClick={() => setShowResidue2Controls((current) => !current)}
                                                title={getControlsToggleTitle(
                                                    'residue',
                                                    showResidue2Controls,
                                                    residue2SectionDisabled
                                                        ? 'Select a chain in Select 2 to enable residue controls.'
                                                        : undefined
                                                )}
                                                aria-disabled={residue2SectionDisabled}
                                                disabled={residue2SectionDisabled}
                                            >
                                                {showResidue2Controls ? 'Hide Residue Controls' : 'Show Residue Controls'}
                                            </button>
                                        </div>
                                        {showResidue2Controls && residueInfo2 && (
                                            renderResidueControls({
                                                slot: '2',
                                                residueInfoSlot: residueInfo2,
                                                selectedResidueIdsSlot: selectedResidueIds2,
                                                onSelectResidueIdsSlot: onSelectResidueIds2 ?? (() => {}),
                                                residueCommonIdsSlot: residueCommonIds2,
                                                orderedResidueIdsSlot: orderedResidueIds2,
                                                residueTypeBucketsSlot: residueTypeBuckets2,
                                                zoomLabel: residueZoomLabel2,
                                                onZoom: onResidueZoom2,
                                                zoomDisabled: residueZoomDisabled2,
                                                onHighlight: onResidueHighlight2,
                                                highlightOn: residueHighlightOn2,
                                                highlightDisabled: residueHighlightDisabled2,
                                                onInspect: onResidueInspect2,
                                                inspectOn: residueInspectOn2,
                                                inspectDisabled: residueInspectDisabled2,
                                                selectedChainIdSlot: selectedChainId2,
                                                showSharedButton: true,
                                            })
                                        )}
                                    </>
                                )}
                            </>
                        )}
                        {!!selectedChainId2 && (
                            <>
                                <div className="load-data-control-row" id={`${idPrefix}-selected-chain3-label`} style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span>Selected 3: {selectedChain3Label}</span>
                                    <button
                                        type="button"
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-clear-chain3-selection-btn`}
                                        aria-label="Clear Chain 3"
                                        disabled={!selectedChainId3}
                                        onClick={onClearChainId3}
                                        style={{ minWidth: 0, padding: '2px 8px' }}
                                    >
                                        X
                                    </button>
                                </div>
                                <div className="load-data-control-row" style={{ marginLeft: 12 }}>
                                    <button
                                        type="button"
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-select-chain3-controls-toggle-btn`}
                                        onClick={() => setShowSelectChain3Controls((current) => !current)}
                                        title={getControlsToggleTitle('Select 3', showSelectChain3Controls)}
                                    >
                                        {showSelectChain3Controls ? 'Hide Select 3' : 'Show Select 3'}
                                    </button>
                                </div>
                                {showSelectChain3Controls && (
                                    <>
                                        <div style={{ marginLeft: 24 }}>
                                            {!!effectiveChainLabelsSlot3 && effectiveChainLabelsSlot3.size > 0 && (
                                                <ChainSelectionTable
                                                    chainLabels={effectiveChainLabelsSlot3}
                                                    selectedChainId={selectedChainId3}
                                                    onSelectChainId={onSelectChainId3 ?? (() => {})}
                                                    title="Select"
                                                    titleTooltip={getChainSelectTooltip('Select 3')}
                                                    idPrefix={`${idPrefix}-chain3`}
                                                />
                                            )}
                                        </div>
                                        <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 24 }}>
                                            <button
                                                type="button"
                                                className="msp-btn msp-form-control"
                                                id={`${idPrefix}-zoom-chain3-btn`}
                                                onClick={onChainZoom3}
                                                disabled={chainZoomDisabled3}
                                                aria-label={`Zoom (${chainZoomLabel3})`}
                                                title={getChainZoomTooltip('Select 3', chainZoomDisabled3, chainZoomLabel3)}
                                            >
                                                Zoom
                                            </button>
                                            <button
                                                type="button"
                                                className="msp-btn msp-form-control"
                                                id={`${idPrefix}-highlight-chain3-btn`}
                                                onClick={onChainHighlight3}
                                                disabled={chainHighlightDisabled3}
                                                aria-pressed={chainHighlightOn3}
                                                title={getChainHighlightTooltip('Select 3', chainHighlightDisabled3, chainHighlightOn3)}
                                            >
                                                Highlight: {chainHighlightOn3 ? 'On' : 'Off'}
                                            </button>
                                            <button
                                                type="button"
                                                className="msp-btn msp-form-control"
                                                id={`${idPrefix}-inspect-chain3-btn`}
                                                onClick={onChainInspect3}
                                                disabled={chainInspectDisabled3}
                                                aria-pressed={chainInspectOn3}
                                                title={getChainInspectTooltip('Select 3', chainInspectDisabled3, chainInspectOn3)}
                                            >
                                                Inspect: {chainInspectOn3 ? 'On' : 'Off'}
                                            </button>
                                        </div>
                                        <div className="load-data-control-row" style={{ marginLeft: 24 }}>
                                            <button
                                                type="button"
                                                className="msp-btn msp-form-control"
                                                id={`${idPrefix}-residue3-controls-toggle-btn`}
                                                onClick={() => setShowResidue3Controls((current) => !current)}
                                                title={getControlsToggleTitle(
                                                    'residue',
                                                    showResidue3Controls,
                                                    residue3SectionDisabled
                                                        ? 'Select a chain in Select 3 to enable residue controls.'
                                                        : undefined
                                                )}
                                                aria-disabled={residue3SectionDisabled}
                                                disabled={residue3SectionDisabled}
                                            >
                                                {showResidue3Controls ? 'Hide Residue Controls' : 'Show Residue Controls'}
                                            </button>
                                        </div>
                                        {showResidue3Controls && residueInfo3 && (
                                            renderResidueControls({
                                                slot: '3',
                                                residueInfoSlot: residueInfo3,
                                                selectedResidueIdsSlot: selectedResidueIds3,
                                                onSelectResidueIdsSlot: onSelectResidueIds3 ?? (() => {}),
                                                residueCommonIdsSlot: residueCommonIds3,
                                                orderedResidueIdsSlot: orderedResidueIds3,
                                                residueTypeBucketsSlot: residueTypeBuckets3,
                                                zoomLabel: residueZoomLabel3,
                                                onZoom: onResidueZoom3,
                                                zoomDisabled: residueZoomDisabled3,
                                                onHighlight: onResidueHighlight3,
                                                highlightOn: residueHighlightOn3,
                                                highlightDisabled: residueHighlightDisabled3,
                                                onInspect: onResidueInspect3,
                                                inspectOn: residueInspectOn3,
                                                inspectDisabled: residueInspectDisabled3,
                                                selectedChainIdSlot: selectedChainId3,
                                                showSharedButton: true,
                                            })
                                        )}
                                    </>
                                )}
                            </>
                        )}
                        {Array.from({ length: additionalSlotCount }).map((_, additionalSlotIndex) => {
                            if (!additionalSlotVisibility[additionalSlotIndex]) return null;
                            const slotNumber = additionalSlotIndex + 4;
                            const currentSelection = additionalSelectedChainIds[additionalSlotIndex] ?? '';
                            const priorSelections = new Set(
                                selectedChainSequence.slice(0, slotNumber - 1).filter(Boolean)
                            );
                            const chainLabelsForSlot = new Map(
                                Array.from(effectiveChainLabels.entries()).filter(([id]) => !priorSelections.has(id))
                            );
                            const selectedLabel = currentSelection
                                ? (chainInfo.chainLabels.get(currentSelection) ?? currentSelection)
                                : 'None';
                            const isExpanded = Boolean(showAdditionalChainControlsBySlot[additionalSlotIndex]);
                            return (
                                <React.Fragment key={`additional-select-slot-${slotNumber}`}>
                                    <div className="load-data-control-row" id={`${idPrefix}-selected-chain${slotNumber}-label`} style={{ marginLeft: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span>{`Selected ${slotNumber}: ${selectedLabel}`}</span>
                                        <button
                                            type="button"
                                            className="msp-btn msp-form-control"
                                            id={`${idPrefix}-clear-chain${slotNumber}-selection-btn`}
                                            aria-label={`Clear Chain ${slotNumber}`}
                                            disabled={!currentSelection}
                                            onClick={() => clearAdditionalSelectionAt(additionalSlotIndex)}
                                            style={{ minWidth: 0, padding: '2px 8px' }}
                                        >
                                            X
                                        </button>
                                    </div>
                                    <div className="load-data-control-row" style={{ marginLeft: 12 }}>
                                        <button
                                            type="button"
                                            className="msp-btn msp-form-control"
                                            id={`${idPrefix}-select-chain${slotNumber}-controls-toggle-btn`}
                                            onClick={() => setShowAdditionalChainControlsBySlot(prev => ({ ...prev, [additionalSlotIndex]: !prev[additionalSlotIndex] }))}
                                            title={getControlsToggleTitle(`Select ${slotNumber}`, isExpanded)}
                                        >
                                            {isExpanded ? `Hide Select ${slotNumber}` : `Show Select ${slotNumber}`}
                                        </button>
                                    </div>
                                    {isExpanded && (
                                        <div style={{ marginLeft: 24 }}>
                                            {!!chainLabelsForSlot && chainLabelsForSlot.size > 0 && (
                                                <ChainSelectionTable
                                                    chainLabels={chainLabelsForSlot}
                                                    selectedChainId={currentSelection}
                                                    onSelectChainId={(id) => setAdditionalSelectionAt(additionalSlotIndex, id)}
                                                    title="Select"
                                                    titleTooltip={getChainSelectTooltip(`Select ${slotNumber}`)}
                                                    idPrefix={`${idPrefix}-chain${slotNumber}`}
                                                />
                                            )}
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </>
                )}
            </>
        );
    };


// Helper to filter chain labels by subunit selection
function getFilteredChainLabels(selectedSubunit: RibosomeSubunitType, chainLabels: Map<string, string>, subunitToChainIds: Map<string, Set<string>>): Map<string, string> {
    if (selectedSubunit === 'All') return chainLabels;
    const allowedIds = subunitToChainIds.get(selectedSubunit);
    if (!allowedIds) return new Map();
    return new Map([...chainLabels].filter(([id]) => allowedIds.has(id)));
}

/**
 * A row component for loading data into a Mol* viewer, selecting representation type,
 * adding colors, and selecting chain IDs.
 * @param viewerTitle The title of the viewer.
 * @param isLoaded Whether the data is loaded.
 * @param onFileInputClick Function to handle file input button click.
 * @param fileInputRef Ref for the hidden file input element.
 * @param onFileChange Function to handle file input change event.
 * @param fileInputDisabled Whether the file input button is disabled.
 * @param fileInputLabel Label for the file input button.
 * @param representationType Current representation type.
 * @param onRepresentationTypeChange Function to handle representation type change.
 * @param representationTypeDisabled Whether the representation type selector is disabled.
 * @param onAddColorsClick Function to handle add colors button click.
 * @param addColorsDisabled Whether the add colors button is disabled.
 * @param colorsInputRef Ref for the hidden colors file input element.
 * @param onColorsFileChange Function to handle colors file input change event.
 * @param subunitToChainIds Map of subunit types to their associated chain IDs.
 * @param selectedSubunit Currently selected subunit.
 * @param onSelectSubunit Function to handle subunit selection.
 * @param subunitSelectDisabled Whether the subunit select button is disabled.
 * @param chainIds Array of chain IDs.
 * @param selectedChainId Currently selected chain ID.
 * @param onSelectChainId Function to handle chain ID selection.
 * @param chainSelectDisabled Whether the chain select button is disabled.
 * @param residueInfo Information about residues for selection.
 * @param selectedResidueIds Currently selected residue IDs.
 * @param onSelectResidueIds Function to handle residue ID selection.
 * @param residueSelectDisabled Whether the residue select button is disabled.
 * @param representationTypeSelector Optional custom representation type selector component.
 * @param onAddRepresentationClick Function to handle add representation button click.
 * @param addRepresentationDisabled Whether the add representation button is disabled.
 * @param fogEnabled Whether fog is enabled.
 * @param fogNear Fog near distance.
 * @param fogFar Fog far distance.
 * @param onFogEnabledChange Function to handle changes to fog enabled state.
 * @param onFogNearChange Function to handle changes to fog near distance.
 * @param onFogFarChange Function to handle changes to fog far distance.
 * @returns The LoadDataRow component.
 */
const LoadDataRow: React.FC<LoadDataRowProps> = ({
    clippingMinNear,
    clippingRadius,
    onClippingMinNearChange,
    onClippingRadiusChange,
    viewerTitle,
    isLoaded,
    loadedFilename,
    onFileInputClick,
    fileInputRef,
    onFileChange,
    fileInputDisabled,
    fileInputLabel,
    representationType,
    onRepresentationTypeChange,
    representationTypeDisabled,
    onAddColorsClick,
    addColorsDisabled,
    colorsInputRef,
    onColorsFileChange,
    onLoadChainColorsClick,
    chainColorsInputRef,
    onChainColorsFileChange,
    onLoadResidueColorsClick,
    residueColorsInputRef,
    onResidueColorsFileChange,
    colorMode = 'chain',
    onColorModeChange = () => {},
    residueTypeColorsById,
    residueTypeCounts,
    onResidueTypeColorChange,
    onSaveColorTheme,
    saveColorThemeDisabled = false,
    colorThemeOptions,
    selectedColorThemeName,
    onSelectedColorThemeNameChange,
    onRemoveColorTheme,
    removeColorThemeDisabled,
    onSaveChainTheme,
    saveChainThemeDisabled,
    chainThemeOptions,
    selectedChainThemeName,
    onSelectedChainThemeNameChange,
    onRemoveChainTheme,
    removeChainThemeDisabled,
    onSaveResidueTheme,
    saveResidueThemeDisabled,
    residueThemeOptions,
    selectedResidueThemeName,
    onSelectedResidueThemeNameChange,
    onRemoveResidueTheme,
    removeResidueThemeDisabled,
    subunitToChainIds,
    selectedSubunit,
    onSelectSubunit,
    subunitSelectDisabled,
    subunitZoomLabel,
    onSubunitHighlight,
    subunitHighlightOn = false,
    subunitHighlightDisabled,
    onSubunitInspect,
    subunitInspectOn = false,
    subunitInspectDisabled,
    onSubunitZoom,
    subunitZoomDisabled,
    chainInfo,
    chainColorsById,
    onChainColorChange,
    selectedChainId,
    onSelectChainId,
    selectedChainId2,
    onSelectChainId2,
    selectedChainId3,
    onSelectChainId3,
    additionalSelectedChainIds,
    onAdditionalSelectedChainIdsChange,
    chainSelectDisabled,
    chainZoomLabel,
    chainZoomLabel2,
    chainZoomLabel3,
    onChainHighlight,
    chainHighlightOn = false,
    chainHighlightDisabled,
    onChainInspect,
    chainInspectOn = false,
    chainInspectDisabled,
    onChainHighlight3,
    chainHighlightOn3 = false,
    chainHighlightDisabled3,
    onChainInspect3,
    chainInspectOn3 = false,
    chainInspectDisabled3,
    onChainZoom,
    onChainZoom2,
    onChainZoom3,
    chainZoomDisabled,
    chainZoomDisabled2,
    chainZoomDisabled3,
    onCombinedSelectionZoom,
    combinedSelectionZoomDisabled,
    showUniprotAccessionInChainLabels = true,
    onShowUniprotAccessionInChainLabelsChange,
    uniprotLookupStatus,
    residueInfo,
    residueCommonIds,
    selectedResidueIds,
    onSelectResidueIds,
    residueInfo2,
    residueCommonIds2,
    selectedResidueIds2,
    onSelectResidueIds2,
    residueInfo3,
    residueCommonIds3,
    selectedResidueIds3,
    onSelectResidueIds3,
    residueSelectDisabled,
    residueZoomLabel,
    residueZoomLabel2,
    residueZoomLabel3,
    onResidueHighlight,
    residueHighlightOn = false,
    residueHighlightDisabled,
    onResidueInspect,
    residueInspectOn = false,
    residueInspectDisabled,
    onResidueHighlight3,
    residueHighlightOn3 = false,
    residueHighlightDisabled3,
    onResidueInspect3,
    residueInspectOn3 = false,
    residueInspectDisabled3,
    onResidueZoom,
    onResidueZoom2,
    onResidueZoom3,
    residueZoomDisabled,
    residueZoomDisabled2,
    residueZoomDisabled3,
    zoomExtraRadius = 0,
    onZoomExtraRadiusChange = () => {},
    zoomMinRadius = 0,
    onZoomMinRadiusChange = () => {},
    selectionDisplayMode = 'hybrid',
    onSelectionDisplayModeChange = () => {},
    dimUnselected = false,
    onDimUnselectedChange = () => {},
    dimUnselectedStrength = 0.45,
    onDimUnselectedStrengthChange = () => {},
    representationTypeSelector,
    onAddRepresentationClick = () => { },
    addRepresentationDisabled = false,
    fogEnabled,
    fogNear,
    fogFar,
    onFogEnabledChange,
    onFogNearChange,
    onFogFarChange,
    testMode,
    showSelectZoomControls = true,
    idPrefix
}) => {
    const [showRepresentationControls, setShowRepresentationControls] = React.useState(false);
    const [chainColorQuery, setChainColorQuery] = React.useState('');
    const [chainColorDraftById, setChainColorDraftById] = React.useState<Record<string, string>>({});
    const [residueTypeColorDraftById, setResidueTypeColorDraftById] = React.useState<Record<string, string>>({});
    const chainLabelsForColorEditor = React.useMemo(() => {
        return getFilteredChainLabels(selectedSubunit, chainInfo.chainLabels, subunitToChainIds);
    }, [selectedSubunit, chainInfo.chainLabels, subunitToChainIds]);

    const chainColorRows = React.useMemo(() => {
        const q = chainColorQuery.trim().toLowerCase();
        return Array.from(chainLabelsForColorEditor.entries())
            .sort((a, b) => {
                const byLabel = a[1].localeCompare(b[1], undefined, { numeric: true, sensitivity: 'base' });
                if (byLabel !== 0) return byLabel;
                return a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' });
            })
            .filter(([chainId, label]) => {
                if (!q) return true;
                return chainId.toLowerCase().includes(q) || label.toLowerCase().includes(q);
            });
    }, [chainLabelsForColorEditor, chainColorQuery]);

    React.useEffect(() => {
        setChainColorDraftById(prev => {
            const next: Record<string, string> = {};
            for (const [chainId] of chainLabelsForColorEditor.entries()) {
                const resolved = chainColorsById?.get(chainId) ?? '#CCCCCC';
                next[chainId] = resolved;
            }
            for (const key of Object.keys(prev)) {
                if (next[key]) continue;
                next[key] = prev[key];
            }
            return next;
        });
    }, [chainLabelsForColorEditor, chainColorsById]);

    const allResidueTypeCounts = React.useMemo(() => {
        if (Array.isArray(residueTypeCounts) && residueTypeCounts.length > 0) {
            return [...residueTypeCounts].sort((a, b) => a.type.localeCompare(b.type));
        }
        const counts = new Map<string, number>();
        const addFrom = (info?: { residueLabels: Map<string, ResidueLabelInfo> }) => {
            if (!info) return;
            for (const [, residue] of info.residueLabels.entries()) {
                const type = String(residue.compId || '?').trim().toUpperCase() || '?';
                counts.set(type, (counts.get(type) ?? 0) + 1);
            }
        };
        addFrom(residueInfo);
        addFrom(residueInfo2);
        return Array.from(counts.entries())
            .map(([type, count]) => ({ type, count }))
            .sort((a, b) => a.type.localeCompare(b.type));
    }, [residueInfo, residueInfo2, residueTypeCounts]);

    React.useEffect(() => {
        setResidueTypeColorDraftById(prev => {
            const next: Record<string, string> = {};
            for (const { type } of allResidueTypeCounts) {
                const resolved = residueTypeColorsById?.get(type) ?? getResidueTypeDefaultColor(type);
                next[type] = resolved;
            }
            // Preserve drafts for residue types not currently shown.
            for (const key of Object.keys(prev)) {
                if (next[key]) continue;
                next[key] = prev[key];
            }
            return next;
        });
    }, [allResidueTypeCounts, residueTypeColorsById]);

    const effectiveChainThemeOptions = chainThemeOptions ?? colorThemeOptions;
    const effectiveChainThemeName = selectedChainThemeName ?? selectedColorThemeName;
    const effectiveSetChainThemeName = onSelectedChainThemeNameChange ?? onSelectedColorThemeNameChange;
    const effectiveLoadChainColors = onLoadChainColorsClick ?? onAddColorsClick;
    const effectiveChainInputRef = chainColorsInputRef ?? colorsInputRef;
    const effectiveOnChainFileChange = onChainColorsFileChange ?? onColorsFileChange;
    const effectiveSaveChainTheme = onSaveChainTheme ?? onSaveColorTheme;
    const effectiveSaveChainThemeDisabled = saveChainThemeDisabled ?? saveColorThemeDisabled;
    const effectiveRemoveChainTheme = onRemoveChainTheme ?? onRemoveColorTheme;
    const effectiveRemoveChainThemeDisabled = removeChainThemeDisabled ?? removeColorThemeDisabled;

    const effectiveResidueThemeOptions = (residueThemeOptions ?? colorThemeOptions)?.filter(option => option.value !== 'chain-id');
    const effectiveResidueThemeName = selectedResidueThemeName ?? selectedColorThemeName;
    const effectiveSetResidueThemeName = onSelectedResidueThemeNameChange ?? onSelectedColorThemeNameChange;
    const effectiveLoadResidueColors = onLoadResidueColorsClick ?? onAddColorsClick;
    const effectiveResidueInputRef = residueColorsInputRef ?? colorsInputRef;
    const effectiveOnResidueFileChange = onResidueColorsFileChange ?? onColorsFileChange;
    const effectiveSaveResidueTheme = onSaveResidueTheme ?? onSaveColorTheme;
    const effectiveSaveResidueThemeDisabled = saveResidueThemeDisabled ?? saveColorThemeDisabled;
    const effectiveRemoveResidueTheme = onRemoveResidueTheme ?? onRemoveColorTheme;
    const effectiveRemoveResidueThemeDisabled = removeResidueThemeDisabled ?? removeColorThemeDisabled;

    return (

    <div className="load-data-row" id={idPrefix ? `${idPrefix}-${idSuffix}` : idSuffix}>
        <div className="viewer-title">{viewerTitle}</div>
        {/* Only show the load button if not loaded */}
        {!isLoaded && (
            <div>
                <button
                    type="button"
                    onClick={onFileInputClick}
                    disabled={testMode ? false : fileInputDisabled}
                    className="msp-btn msp-form-control"
                    aria-label={fileInputLabel}
                    title={getLoadButtonTitle(fileInputLabel, testMode ? false : fileInputDisabled)}
                    id={`${idPrefix}-load-btn`}
                >
                    {fileInputLabel}
                </button>
                <input
                    type="file"
                    accept=".cif,.mmcif"
                    ref={fileInputRef}
                    onChange={onFileChange}
                    style={{ display: 'none' }}
                    tabIndex={-1}
                    id={`${idPrefix}-file-input`}
                />
            </div>
        )}
        {/* Always show the filename if loaded */}
        {isLoaded && (
            <div className="loaded-filename" id={`${idPrefix}-filename-label`}>
                {loadedFilename || viewerTitle}
            </div>
        )}
        <div className="load-data-controls">
            <div className="load-data-control-row">
                <button
                    type="button"
                    className="molstar-file-btn molstar-advanced-controls-toggle"
                    id={`${idPrefix}-representation-controls-toggle-btn`}
                    aria-label={showRepresentationControls ? 'Hide Representation Controls' : 'Show Representation Controls'}
                    title={getControlsToggleTitle('representation', showRepresentationControls)}
                    onClick={() => setShowRepresentationControls(prev => !prev)}
                >
                    {showRepresentationControls ? 'Hide Representation Controls' : 'Show Representation Controls'}
                </button>
            </div>
            {showRepresentationControls && (
            <div className="load-data-control-row">
                {representationTypeSelector ? (
                    <span className="rep-type-controls">
                        {representationTypeSelector}
                        <button
                            onClick={onAddRepresentationClick}
                            disabled={addRepresentationDisabled}
                            aria-label="Add Representation"
                            title={getAddRepresentationTooltip(addRepresentationDisabled)}
                            className="msp-btn msp-form-control"
                            id={`${idPrefix}-add-representation-btn`}
                        >
                            +
                        </button>
                    </span>
                ) : (
                    <span className="rep-type-controls">
                        <label
                            htmlFor={`${idPrefix}-${repTypeSelectIdSuffix}`}
                            title={getRepresentationTypeTooltip(representationTypeDisabled, representationType)}
                        >
                            Representation:
                        </label>
                        <select
                            id={`${idPrefix}-${repTypeSelectIdSuffix}`}
                            value={representationType}
                            onChange={e => onRepresentationTypeChange(e.target.value as AllowedRepresentationType)}
                            disabled={representationTypeDisabled}
                            title={getRepresentationTypeTooltip(representationTypeDisabled, representationType)}
                            className="msp-select msp-form-control"
                        >
                            {allowedRepresentationTypes.map(type => (
                                <option key={type} value={type}>{type.replace(/-/g, ' ')}</option>
                            ))}
                        </select>
                        <button
                            onClick={onAddRepresentationClick}
                            disabled={addRepresentationDisabled}
                            aria-label="Add Representation"
                            title={getAddRepresentationTooltip(addRepresentationDisabled)}
                            className="msp-btn msp-form-control"
                            id={`${idPrefix}-add-representation-btn`}
                        >
                            +
                        </button>
                    </span>
                )}
            </div>
            )}
            {showRepresentationControls && (
            <div className="load-data-control-row" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>Theme:</strong>
                    <select
                        id={`${idPrefix}-color-mode-select`}
                        value={colorMode}
                        onChange={e => onColorModeChange(e.target.value as 'chain' | 'residue-type')}
                        title={getThemeModeTooltip(addColorsDisabled)}
                        className="msp-select msp-form-control"
                    >
                        <option value="chain">Chain</option>
                        <option value="residue-type">Residue</option>
                    </select>
                </div>

                {colorMode === 'chain' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 16 }}>
                    {effectiveChainThemeOptions && effectiveChainThemeOptions.length > 0 && (
                        <>
                            <span title={getThemeSelectorTooltip('chain', addColorsDisabled)}>
                                <select
                                    id={`${idPrefix}-chain-colour-theme-select`}
                                    value={effectiveChainThemeName ?? effectiveChainThemeOptions[0].value}
                                    onChange={e => effectiveSetChainThemeName?.(e.target.value)}
                                    disabled={addColorsDisabled}
                                    title={getThemeSelectorTooltip('chain', addColorsDisabled)}
                                    className="msp-select msp-form-control"
                                >
                                    {effectiveChainThemeOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </span>
                            <button
                                type="button"
                                onClick={effectiveRemoveChainTheme}
                                disabled={effectiveRemoveChainThemeDisabled ?? true}
                                aria-label="Remove"
                                title={getThemeRemoveTooltip('chain', effectiveRemoveChainThemeDisabled ?? true)}
                                className="msp-btn msp-form-control"
                                id={`${idPrefix}-remove-chain-theme-btn`}
                            >
                                X
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={effectiveLoadChainColors}
                        disabled={addColorsDisabled}
                        aria-label="Load"
                        title={getThemeLoadTooltip('chain', addColorsDisabled)}
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-load-chain-colours-btn`}
                    >
                        Load
                    </button>
                    <button
                        type="button"
                        onClick={effectiveSaveChainTheme}
                        disabled={effectiveSaveChainThemeDisabled || !effectiveSaveChainTheme}
                        aria-label="Save"
                        title={getThemeSaveTooltip('chain', !!(effectiveSaveChainThemeDisabled || !effectiveSaveChainTheme))}
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-save-chain-theme-btn`}
                    >
                        Save
                    </button>
                    <input
                        type="file"
                        accept=".csv,.tsv,.txt,.json"
                        ref={effectiveChainInputRef}
                        onChange={effectiveOnChainFileChange}
                        style={{ display: 'none' }}
                        tabIndex={-1}
                        id={`${idPrefix}-chain-colours-file-input`}
                    />
                </div>
                )}

                {colorMode === 'residue-type' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginLeft: 16 }}>
                    {effectiveResidueThemeOptions && effectiveResidueThemeOptions.length > 0 && (
                        <>
                            <span title={getThemeSelectorTooltip('residue', addColorsDisabled)}>
                                <select
                                    id={`${idPrefix}-residue-colour-theme-select`}
                                    value={effectiveResidueThemeName ?? effectiveResidueThemeOptions[0].value}
                                    onChange={e => effectiveSetResidueThemeName?.(e.target.value)}
                                    disabled={addColorsDisabled}
                                    title={getThemeSelectorTooltip('residue', addColorsDisabled)}
                                    className="msp-select msp-form-control"
                                >
                                    {effectiveResidueThemeOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </span>
                            <button
                                type="button"
                                onClick={effectiveRemoveResidueTheme}
                                disabled={effectiveRemoveResidueThemeDisabled ?? true}
                                aria-label="Remove"
                                title={getThemeRemoveTooltip('residue', effectiveRemoveResidueThemeDisabled ?? true)}
                                className="msp-btn msp-form-control"
                                id={`${idPrefix}-remove-residue-theme-btn`}
                            >
                                X
                            </button>
                        </>
                    )}
                    <button
                        type="button"
                        onClick={effectiveLoadResidueColors}
                        disabled={addColorsDisabled}
                        aria-label="Load"
                        title={getThemeLoadTooltip('residue', addColorsDisabled)}
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-load-residue-colours-btn`}
                    >
                        Load
                    </button>
                    <button
                        type="button"
                        onClick={effectiveSaveResidueTheme}
                        disabled={effectiveSaveResidueThemeDisabled || !effectiveSaveResidueTheme}
                        aria-label="Save"
                        title={getThemeSaveTooltip('residue', !!(effectiveSaveResidueThemeDisabled || !effectiveSaveResidueTheme))}
                        className="msp-btn msp-form-control"
                        id={`${idPrefix}-save-residue-theme-btn`}
                    >
                        Save
                    </button>
                    <input
                        type="file"
                        accept=".csv,.tsv,.txt,.json"
                        ref={effectiveResidueInputRef}
                        onChange={effectiveOnResidueFileChange}
                        style={{ display: 'none' }}
                        tabIndex={-1}
                        id={`${idPrefix}-residue-colours-file-input`}
                    />
                </div>
                )}
            </div>
            )}
            {showRepresentationControls && colorMode === 'chain' && (
                <div className="load-data-control-row" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginLeft: 24 }} id={`${idPrefix}-chain-color-table-container`}>
                    <strong>Chain Colours</strong>
                    <input
                        id={`${idPrefix}-chain-color-table-search`}
                        data-testid={`${idPrefix}-chain-color-table-search`}
                        className="chain-selection-table-search"
                        type="text"
                        value={chainColorQuery}
                        onChange={e => setChainColorQuery(e.target.value)}
                        placeholder="Search chain, auth, UniProt, molecule..."
                        title={getChainColourSearchTooltip()}
                        aria-label="Chain colour search"
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {chainColorRows.map(([chainId, label]) => {
                            const current = chainColorsById?.get(chainId) ?? '#CCCCCC';
                            const draft = chainColorDraftById[chainId] ?? current;
                            return (
                                <div key={chainId} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ minWidth: 180 }}>{`${chainId}: ${label}`}</span>
                                    <input
                                        id={`${idPrefix}-chain-color-${chainId}`}
                                        type="color"
                                        value={draft}
                                        onChange={e => {
                                            const value = e.target.value;
                                            setChainColorDraftById(prev => ({ ...prev, [chainId]: value }));
                                        }}
                                        title={getChainColourPickerTooltip(chainId)}
                                        aria-label={`Chain ${chainId} colour`}
                                    />
                                    <button
                                        type="button"
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-chain-color-${chainId}-apply-btn`}
                                        onClick={() => onChainColorChange?.(chainId, draft)}
                                        disabled={!onChainColorChange || draft.toUpperCase() === current.toUpperCase()}
                                        title={getChainColourApplyTooltip(chainId, !onChainColorChange || draft.toUpperCase() === current.toUpperCase())}
                                    >
                                        Apply
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {showRepresentationControls && colorMode === 'residue-type' && allResidueTypeCounts.length > 0 && (
                <div className="load-data-control-row" style={{ display: 'flex', flexDirection: 'column', gap: 4, marginLeft: 32 }}>
                    <strong>Residue Types (all chains in loaded dataset)</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {allResidueTypeCounts.map(({ type, count }) => {
                            const current = residueTypeColorsById?.get(type) ?? getResidueTypeDefaultColor(type);
                            const draft = residueTypeColorDraftById[type] ?? current;
                            return (
                                <div key={`${type}-${count}`} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ minWidth: 130 }}>{`${type} (${count})`}</span>
                                    <input
                                        id={`${idPrefix}-residue-type-color-${type}`}
                                        type="color"
                                        value={draft}
                                        onChange={e => {
                                            const value = e.target.value;
                                            setResidueTypeColorDraftById(prev => ({ ...prev, [type]: value }));
                                        }}
                                        aria-label={`Residue type ${type} colour`}
                                    />
                                    <button
                                        type="button"
                                        className="msp-btn msp-form-control"
                                        id={`${idPrefix}-residue-type-color-${type}-apply-btn`}
                                        onClick={() => onResidueTypeColorChange?.(type, draft)}
                                        disabled={!onResidueTypeColorChange || draft.toUpperCase() === current.toUpperCase()}
                                    >
                                        Apply
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            {showSelectZoomControls && (
                    <SelectZoomControls
                        subunitToChainIds={subunitToChainIds}
                        selectedSubunit={selectedSubunit}
                        onSelectSubunit={onSelectSubunit}
                        subunitSelectDisabled={subunitSelectDisabled}
                        subunitZoomLabel={subunitZoomLabel}
                        onSubunitHighlight={onSubunitHighlight}
                        subunitHighlightOn={subunitHighlightOn}
                        subunitHighlightDisabled={subunitHighlightDisabled}
                        onSubunitInspect={onSubunitInspect}
                        subunitInspectOn={subunitInspectOn}
                        subunitInspectDisabled={subunitInspectDisabled}
                        onSubunitZoom={onSubunitZoom}
                        subunitZoomDisabled={subunitZoomDisabled}
                        chainInfo={chainInfo}
                        colorMode={colorMode}
                        selectedChainId={selectedChainId}
                        onSelectChainId={onSelectChainId}
                        selectedChainId2={selectedChainId2}
                        onSelectChainId2={onSelectChainId2}
                        selectedChainId3={selectedChainId3}
                        onSelectChainId3={onSelectChainId3}
                        additionalSelectedChainIds={additionalSelectedChainIds}
                        onAdditionalSelectedChainIdsChange={onAdditionalSelectedChainIdsChange}
                        chainSelectDisabled={chainSelectDisabled}
                        chainZoomLabel={chainZoomLabel}
                        chainZoomLabel2={chainZoomLabel2}
                        chainZoomLabel3={chainZoomLabel3}
                        onChainHighlight={onChainHighlight}
                        chainHighlightOn={chainHighlightOn}
                        chainHighlightDisabled={chainHighlightDisabled}
                        onChainInspect={onChainInspect}
                        chainInspectOn={chainInspectOn}
                        chainInspectDisabled={chainInspectDisabled}
                        onChainHighlight3={onChainHighlight3}
                        chainHighlightOn3={chainHighlightOn3}
                        chainHighlightDisabled3={chainHighlightDisabled3}
                        onChainInspect3={onChainInspect3}
                        chainInspectOn3={chainInspectOn3}
                        chainInspectDisabled3={chainInspectDisabled3}
                        onChainZoom={onChainZoom}
                        onChainZoom2={onChainZoom2}
                        onChainZoom3={onChainZoom3}
                        chainZoomDisabled={chainZoomDisabled}
                        chainZoomDisabled2={chainZoomDisabled2}
                        chainZoomDisabled3={chainZoomDisabled3}
                        onCombinedSelectionZoom={onCombinedSelectionZoom}
                        combinedSelectionZoomDisabled={combinedSelectionZoomDisabled}
                        showUniprotAccessionInChainLabels={showUniprotAccessionInChainLabels}
                        onShowUniprotAccessionInChainLabelsChange={onShowUniprotAccessionInChainLabelsChange}
                        uniprotLookupStatus={uniprotLookupStatus}
                        residueInfo={residueInfo}
                        residueCommonIds={residueCommonIds}
                        selectedResidueIds={selectedResidueIds}
                        onSelectResidueIds={onSelectResidueIds}
                        residueInfo2={residueInfo2}
                        residueCommonIds2={residueCommonIds2}
                        selectedResidueIds2={selectedResidueIds2}
                        onSelectResidueIds2={onSelectResidueIds2}
                        residueInfo3={residueInfo3}
                        residueCommonIds3={residueCommonIds3}
                        selectedResidueIds3={selectedResidueIds3}
                        onSelectResidueIds3={onSelectResidueIds3}
                        residueSelectDisabled={residueSelectDisabled}
                        residueZoomLabel={residueZoomLabel}
                        residueZoomLabel2={residueZoomLabel2}
                        residueZoomLabel3={residueZoomLabel3}
                        onResidueHighlight={onResidueHighlight}
                        residueHighlightOn={residueHighlightOn}
                        residueHighlightDisabled={residueHighlightDisabled}
                        onResidueInspect={onResidueInspect}
                        residueInspectOn={residueInspectOn}
                        residueInspectDisabled={residueInspectDisabled}
                        onResidueHighlight3={onResidueHighlight3}
                        residueHighlightOn3={residueHighlightOn3}
                        residueHighlightDisabled3={residueHighlightDisabled3}
                        onResidueInspect3={onResidueInspect3}
                        residueInspectOn3={residueInspectOn3}
                        residueInspectDisabled3={residueInspectDisabled3}
                        onResidueZoom={onResidueZoom}
                        onResidueZoom2={onResidueZoom2}
                        onResidueZoom3={onResidueZoom3}
                        residueZoomDisabled={residueZoomDisabled}
                        residueZoomDisabled2={residueZoomDisabled2}
                        residueZoomDisabled3={residueZoomDisabled3}
                        zoomExtraRadius={zoomExtraRadius}
                        onZoomExtraRadiusChange={onZoomExtraRadiusChange}
                        zoomMinRadius={zoomMinRadius}
                        onZoomMinRadiusChange={onZoomMinRadiusChange}
                        selectionDisplayMode={selectionDisplayMode}
                        onSelectionDisplayModeChange={onSelectionDisplayModeChange}
                        dimUnselected={dimUnselected}
                        onDimUnselectedChange={onDimUnselectedChange}
                        dimUnselectedStrength={dimUnselectedStrength}
                        onDimUnselectedStrengthChange={onDimUnselectedStrengthChange}
                        idPrefix={idPrefix}
                    />
            )}
        </div>
        {/*
        Fog controls
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <label>
                Fog:
                <input
                    type="checkbox"
                    checked={fogEnabled}
                    onChange={e => onFogEnabledChange(e.target.checked)}
                    style={{ marginLeft: 4 }}
                />
            </label>
            <label>
                Near:
                <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.01}
                    value={fogNear}
                    onChange={e => onFogNearChange(Number(e.target.value))}
                    style={{ width: 60, marginLeft: 4 }}
                    disabled={!fogEnabled}
                />
            </label>
            <label>
                Far:
                <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.01}
                    value={fogFar}
                    onChange={e => onFogFarChange(Number(e.target.value))}
                    style={{ width: 60, marginLeft: 4 }}
                    disabled={!fogEnabled}
                />
            </label>
            <label>
                Camera Near:
                <input
                    type="number"
                    min={0.001}
                    max={10}
                    step={0.001}
                    value={clippingMinNear}
                    onChange={e => onClippingMinNearChange(Number(e.target.value))}
                    style={{ width: 70, marginLeft: 4 }}
                />
            </label>
            <label>
                Camera Far:
                <input
                    type="number"
                    min={1}
                    max={1000}
                    step={1}
                    value={clippingRadius}
                    onChange={e => onClippingRadiusChange(Number(e.target.value))}
                    style={{ width: 70, marginLeft: 4 }}
                />
            </label>
        </div>
        */}
    </div>
);
};

export default LoadDataRow;
