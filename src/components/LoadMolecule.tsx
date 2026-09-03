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
import ChainSelectButton from './buttons/select/Chain';
import ResidueSelectButton from './buttons/select/Residue';
import SubunitSelectButton from './buttons/select/Subunit';
import { allowedRepresentationTypes, AllowedRepresentationType } from '../types/ribocode';
import { ResidueLabelInfo } from '../utils/residue';
import { RibosomeSubunitType } from '../utils/subunit';

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
    onAddColorsClick: () => void;
    addColorsDisabled: boolean;
    colorsInputRef: React.RefObject<HTMLInputElement | null>;
    onColorsFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    // Subunit selection
    subunitToChainIds: Map<string, Set<string>>;
    selectedSubunit: RibosomeSubunitType;
    onSelectSubunit: (subunit: RibosomeSubunitType) => void;
    subunitSelectDisabled: boolean;
    subunitZoomLabel: string;
    onSubunitHighlight: () => void;
    subunitHighlightOn?: boolean;
    subunitHighlightDisabled: boolean;
    onSubunitZoom: () => void;
    subunitZoomDisabled: boolean;
    // Chain
    chainInfo: { chainLabels: Map<string, string>; };
    selectedChainId: string;
    onSelectChainId: (id: string) => void;
    chainSelectDisabled: boolean;
    chainZoomLabel: string;
    onChainHighlight: () => void;
    chainHighlightOn?: boolean;
    chainHighlightDisabled: boolean;
    onChainZoom: () => void;
    chainZoomDisabled: boolean;
    // Residue
    residueInfo: {
        residueLabels: Map<string, ResidueLabelInfo>;
        residueToAtomIds: Record<string, string[]>;
    };
    selectedResidueIds: string[];
    onSelectResidueIds: (ids: string[]) => void;
    residueSelectDisabled: boolean;
    residueZoomLabel: string;
    onResidueHighlight: () => void;
    residueHighlightOn?: boolean;
    residueHighlightDisabled: boolean;
    onResidueZoom: () => void;
    residueZoomDisabled: boolean;
    zoomExtraRadius?: number;
    onZoomExtraRadiusChange?: (value: number) => void;
    zoomMinRadius?: number;
    onZoomMinRadiusChange?: (value: number) => void;
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
        onSubunitZoom: () => void;
        subunitZoomDisabled: boolean;
        chainInfo: { chainLabels: Map<string, string>; };
        selectedChainId: string;
        onSelectChainId: (id: string) => void;
        chainSelectDisabled: boolean;
        chainZoomLabel: string;
        onChainHighlight: () => void;
        chainHighlightOn?: boolean;
        chainHighlightDisabled: boolean;
        onChainZoom: () => void;
        chainZoomDisabled: boolean;
        residueInfo: {
            residueLabels: Map<string, ResidueLabelInfo>;
            residueToAtomIds: Record<string, string[]>;
        };
        selectedResidueIds: string[];
        onSelectResidueIds: (ids: string[]) => void;
        residueSelectDisabled: boolean;
        residueZoomLabel: string;
        onResidueHighlight: () => void;
        residueHighlightOn?: boolean;
        residueHighlightDisabled: boolean;
        onResidueZoom: () => void;
        residueZoomDisabled: boolean;
        zoomExtraRadius?: number;
        onZoomExtraRadiusChange?: (value: number) => void;
        zoomMinRadius?: number;
        onZoomMinRadiusChange?: (value: number) => void;
        idPrefix: string;
    }

    export const SelectZoomControls: React.FC<SelectZoomControlsProps> = ({
        subunitToChainIds,
        selectedSubunit,
        onSelectSubunit,
        subunitSelectDisabled,
        subunitZoomLabel,
        onSubunitHighlight,
        subunitHighlightOn = false,
        subunitHighlightDisabled,
        onSubunitZoom,
        subunitZoomDisabled,
        chainInfo,
        selectedChainId,
        onSelectChainId,
        chainSelectDisabled,
        chainZoomLabel,
        onChainHighlight,
        chainHighlightOn = false,
        chainHighlightDisabled,
        onChainZoom,
        chainZoomDisabled,
        residueInfo,
        selectedResidueIds,
        onSelectResidueIds,
        residueSelectDisabled,
        residueZoomLabel,
        onResidueHighlight,
        residueHighlightOn = false,
        residueHighlightDisabled,
        onResidueZoom,
        residueZoomDisabled,
        zoomExtraRadius = 0,
        onZoomExtraRadiusChange = () => {},
        zoomMinRadius = 0,
        onZoomMinRadiusChange = () => {},
        idPrefix,
    }) => (
        <>
            <div className="load-data-control-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <label htmlFor={`${idPrefix}-zoom-extra-radius`}>Zoom extraRadius:</label>
                <input
                    id={`${idPrefix}-zoom-extra-radius`}
                    type="number"
                    value={zoomExtraRadius}
                    min={0}
                    max={100}
                    step={1}
                    style={{ width: 60 }}
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
                    onChange={e => onZoomMinRadiusChange(Number(e.target.value))}
                />
            </div>
            <div className="load-data-control-row">
                <SubunitSelectButton
                    disabled={subunitSelectDisabled}
                    selectedSubunit={selectedSubunit}
                    onSelect={onSelectSubunit}
                    id={`${idPrefix}-subunit-select`}
                />
            </div>
            <div className="load-data-control-row">
                <button
                    onClick={onSubunitHighlight}
                    disabled={subunitHighlightDisabled}
                    aria-pressed={subunitHighlightOn}
                    className="msp-btn msp-form-control"
                    id={`${idPrefix}-highlight-subunit-btn`}
                >
                    Highlight Subunit: {subunitHighlightOn ? 'On' : 'Off'}
                </button>
            </div>
            <div className="load-data-control-row">
                <button
                    onClick={onSubunitZoom}
                    disabled={subunitZoomDisabled}
                    className="msp-btn msp-form-control"
                    id={`${idPrefix}-zoom-subunit-btn`}
                >
                    Zoom to Subunit: {subunitZoomLabel}
                </button>
            </div>
            <div className="load-data-control-row">
                <ChainSelectButton
                     disabled={chainSelectDisabled || !selectedSubunit}
                     chainLabels={getFilteredChainLabels(selectedSubunit, chainInfo.chainLabels, subunitToChainIds)}
                     selectedChainId={selectedChainId}
                     onSelect={onSelectChainId}
                     id={`${idPrefix}-chain-select`}
                />
            </div>
            <div className="load-data-control-row">
                <button
                    onClick={onChainHighlight}
                    disabled={chainHighlightDisabled}
                    aria-pressed={chainHighlightOn}
                    className="msp-btn msp-form-control"
                    id={`${idPrefix}-highlight-chain-btn`}
                >
                    Highlight Chain: {chainHighlightOn ? 'On' : 'Off'}
                </button>
            </div>
            <div className="load-data-control-row">
                <button
                    onClick={onChainZoom}
                    disabled={chainZoomDisabled}
                    className="msp-btn msp-form-control"
                    id={`${idPrefix}-zoom-chain-btn`}
                >
                    Zoom to Chain: {chainZoomLabel}
                </button>
            </div>
            <div className="load-data-control-row">
                <ResidueSelectButton
                    disabled={residueSelectDisabled || !selectedChainId}
                    residueLabels={residueInfo.residueLabels}
                    selectedResidueIds={selectedResidueIds}
                    onSelect={onSelectResidueIds}
                    id={`${idPrefix}-residue-select`}
                />
            </div>
            <div className="load-data-control-row">
                <button
                    onClick={onResidueHighlight}
                    disabled={residueHighlightDisabled}
                    aria-pressed={residueHighlightOn}
                    className="msp-btn msp-form-control"
                    id={`${idPrefix}-highlight-residue-btn`}
                >
                    Highlight Residues: {residueHighlightOn ? 'On' : 'Off'}
                </button>
            </div>
            <div className="load-data-control-row">
                <button
                    onClick={onResidueZoom}
                    disabled={residueZoomDisabled}
                    className="msp-btn msp-form-control"
                    id={`${idPrefix}-zoom-residue-btn`}
                >
                    Zoom to Residue: {residueZoomLabel}
                </button>
            </div>
        </>
    );


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
    subunitToChainIds,
    selectedSubunit,
    onSelectSubunit,
    subunitSelectDisabled,
    subunitZoomLabel,
    onSubunitHighlight,
    subunitHighlightOn = false,
    subunitHighlightDisabled,
    onSubunitZoom,
    subunitZoomDisabled,
    chainInfo,
    selectedChainId,
    onSelectChainId,
    chainSelectDisabled,
    chainZoomLabel,
    onChainHighlight,
    chainHighlightOn = false,
    chainHighlightDisabled,
    onChainZoom,
    chainZoomDisabled,
    residueInfo,
    selectedResidueIds,
    onSelectResidueIds,
    residueSelectDisabled,
    residueZoomLabel,
    onResidueHighlight,
    residueHighlightOn = false,
    residueHighlightDisabled,
    onResidueZoom,
    residueZoomDisabled,
    zoomExtraRadius = 0,
    onZoomExtraRadiusChange = () => {},
    zoomMinRadius = 0,
    onZoomMinRadiusChange = () => {},
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
}) => (

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
                {representationTypeSelector ? (
                    <span className="rep-type-controls">
                        {representationTypeSelector}
                        <button
                            onClick={onAddRepresentationClick}
                            disabled={addRepresentationDisabled}
                            aria-label="Add Representation"
                            className="msp-btn msp-form-control"
                            id={`${idPrefix}-add-representation-btn`}
                        >
                            +
                        </button>
                    </span>
                ) : (
                    <span className="rep-type-controls">
                        <label htmlFor="representation-type">
                            Representation:
                        </label>
                        <select
                            id={`${idPrefix}-${repTypeSelectIdSuffix}`}
                            value={representationType}
                            onChange={e => onRepresentationTypeChange(e.target.value as AllowedRepresentationType)}
                            disabled={representationTypeDisabled}
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
                            className="msp-btn msp-form-control"
                            id={`${idPrefix}-add-representation-btn`}
                        >
                            +
                        </button>
                    </span>
                )}
            </div>
            <div className="load-data-control-row">
                <button
                    type="button"
                    onClick={onAddColorsClick}
                    disabled={addColorsDisabled}
                    aria-label="Load Colours"
                    className="msp-btn msp-form-control"
                    id={`${idPrefix}-load-colours-btn`}
                >
                    Load Colours
                </button>
                <input
                    type="file"
                    accept=".csv,.tsv,.txt,.json"
                    ref={colorsInputRef}
                    onChange={onColorsFileChange}
                    style={{ display: 'none' }}
                    tabIndex={-1}
                    id={`${idPrefix}-colours-file-input`}
                />
            </div>
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
                        onSubunitZoom={onSubunitZoom}
                        subunitZoomDisabled={subunitZoomDisabled}
                        chainInfo={chainInfo}
                        selectedChainId={selectedChainId}
                        onSelectChainId={onSelectChainId}
                        chainSelectDisabled={chainSelectDisabled}
                        chainZoomLabel={chainZoomLabel}
                        onChainHighlight={onChainHighlight}
                        chainHighlightOn={chainHighlightOn}
                        chainHighlightDisabled={chainHighlightDisabled}
                        onChainZoom={onChainZoom}
                        chainZoomDisabled={chainZoomDisabled}
                        residueInfo={residueInfo}
                        selectedResidueIds={selectedResidueIds}
                        onSelectResidueIds={onSelectResidueIds}
                        residueSelectDisabled={residueSelectDisabled}
                        residueZoomLabel={residueZoomLabel}
                        onResidueHighlight={onResidueHighlight}
                        residueHighlightOn={residueHighlightOn}
                        residueHighlightDisabled={residueHighlightDisabled}
                        onResidueZoom={onResidueZoom}
                        residueZoomDisabled={residueZoomDisabled}
                        zoomExtraRadius={zoomExtraRadius}
                        onZoomExtraRadiusChange={onZoomExtraRadiusChange}
                        zoomMinRadius={zoomMinRadius}
                        onZoomMinRadiusChange={onZoomMinRadiusChange}
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
    onAddColorsClick: () => void;
    addColorsDisabled: boolean;
    colorsInputRef: React.RefObject<HTMLInputElement | null>;
    onColorsFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    // Subunit selection
    subunitToChainIds: Map<string, Set<string>>;
    selectedSubunit: RibosomeSubunitType;
    onSelectSubunit: (subunit: RibosomeSubunitType) => void;
    subunitSelectDisabled: boolean;
    subunitZoomLabel: string;
    onSubunitHighlight: () => void;
    subunitHighlightOn?: boolean;
    subunitHighlightDisabled: boolean;
    onSubunitZoom: () => void;
    subunitZoomDisabled: boolean;
    // Chain
    chainInfo: { chainLabels: Map<string, string>; };
    selectedChainId: string;
    onSelectChainId: (id: string) => void;
    chainSelectDisabled: boolean;
    chainZoomLabel: string;
    onChainHighlight: () => void;
    chainHighlightDisabled: boolean;
    onChainZoom: () => void;
    chainZoomDisabled: boolean;
    // Residue
    residueInfo: {
        residueLabels: Map<string, ResidueLabelInfo>;
        residueToAtomIds: Record<string, string[]>;
    };
    selectedResidueIds: string[];
    onSelectResidueIds: (ids: string[]) => void;
    residueSelectDisabled: boolean;
    residueZoomLabel: string;
    onResidueHighlight: () => void;
    residueHighlightOn?: boolean;
    residueHighlightDisabled: boolean;
    onResidueZoom: () => void;
    residueZoomDisabled: boolean;
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

export default LoadDataRow;
