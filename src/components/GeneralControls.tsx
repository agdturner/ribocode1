/**
 * General controls for the Ribocode viewer, including data loading, representation selection, color loading, and chain/residue selection.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React from 'react';
import SyncButton from './buttons/Sync';
import { idSuffix as syncSelectIdSuffix } from './buttons/Sync';
import type { ViewerKey } from '../types/ribocode';

/**
 * Suffix for the GeneralControls root id, used for consistent id construction in code and tests.
 */
export const idSuffix = 'general-controls';

/**
 * Define the props for the GeneralControls component
 * @typedef {Object} GeneralControlsProps
 * @property {number} zoomExtraRadius - Extra radius for residue zoom.
 * @property {function} setZoomExtraRadius - Function to update the zoom extra radius.
 * @property {number} zoomMinRadius - Minimum radius for residue zoom.
 * @property {function} setZoomMinRadius - Function to update the zoom minimum radius.
 * @property {Object} viewerA - Reference to viewer A.
 * @property {Object} viewerB - Reference to viewer B.
 * @property {string} activeViewer - Key of the currently active viewer ('A' or 'B').
 * @property {boolean} syncEnabled - Whether synchronization between viewers is enabled.
 * @property {function} setSyncEnabled - Function to toggle synchronization between viewers.
 * @property {string} selectedChainIdAlignedTo - ID of the selected chain in the aligned-to molecule.
 * @property {string} selectedChainIdAligned - ID of the selected chain in the aligned molecule.
 * @property {boolean} realignmentExists - Whether a realignment already exists for the selected chains.
 * @property {function} handleRealignToChains - Function to trigger realignment based on selected chains.
 */
interface GeneralControlsProps {
  zoomExtraRadius: number;
  setZoomExtraRadius: (v: number) => void;
  zoomMinRadius: number;
  setZoomMinRadius: (v: number) => void;
  showUniprotAccessionInChainLabels: boolean;
  setShowUniprotAccessionInChainLabels: (v: boolean) => void;
  uniprotLookupStatus?: {
    completed: number;
    pending: number;
    inFlight: number;
  };
  viewerA: any;
  viewerB: any;
  activeViewer: ViewerKey;
  syncEnabled: boolean;
  setSyncEnabled: (v: boolean) => void;
    syncDisabled: boolean;
  selectedChainIdAlignedTo: string;
  selectedChainIdAligned: string;
  realignmentExists: boolean;
  handleRealignToChains: () => void;
  selectedSubunitAlignedTo: string;
  selectedSubunitAligned: string;
  subunitRealignmentExists: boolean;
  canRealignToSubunits: boolean;
  handleRealignToSubunits: () => void;
  idPrefix?: string;
}

/**
 * GeneralControls component that provides UI controls for zoom settings, synchronization, and realignment.
 * @param {GeneralControlsProps} props - The props for the GeneralControls component.
 * @returns {JSX.Element} The GeneralControls component.
 */
const GeneralControls: React.FC<GeneralControlsProps> = ({
  zoomExtraRadius,
  setZoomExtraRadius,
  zoomMinRadius,
  setZoomMinRadius,
  showUniprotAccessionInChainLabels,
  setShowUniprotAccessionInChainLabels,
  uniprotLookupStatus,
  viewerA,
  viewerB,
  activeViewer,
  syncEnabled,
  setSyncEnabled,
  syncDisabled,
  selectedChainIdAlignedTo,
  selectedChainIdAligned,
  realignmentExists,
  handleRealignToChains,
  selectedSubunitAlignedTo,
  selectedSubunitAligned,
  subunitRealignmentExists,
  canRealignToSubunits,
  handleRealignToSubunits,
  idPrefix = 'generalcontrols',
}) => (
  <div className="General-Controls" id={idPrefix ? `${idPrefix}-${idSuffix}` : idSuffix}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <label>
        Residue Zoom extraRadius:
        <input
          type="number"
          value={zoomExtraRadius}
          min={0}
          max={100}
          step={1}
          style={{ width: 60, marginLeft: 4 }}
          onChange={e => setZoomExtraRadius(Number(e.target.value))}
          id={`${idPrefix}-zoom-extra-radius`}
        />
      </label>
      <label>
        minRadius:
        <input
          type="number"
          value={zoomMinRadius}
          min={0}
          max={100}
          step={1}
          style={{ width: 60, marginLeft: 4 }}
          onChange={e => setZoomMinRadius(Number(e.target.value))}
          id={`${idPrefix}-zoom-min-radius`}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={showUniprotAccessionInChainLabels}
          onChange={e => setShowUniprotAccessionInChainLabels(e.target.checked)}
          id={`${idPrefix}-show-uniprot-accession`}
          style={{ marginRight: 4 }}
        />
        Show UniProt accession in chain labels
      </label>
      <span
        id={`${idPrefix}-uniprot-status`}
        style={{ fontSize: 12, color: '#555' }}
      >
        UniProt cache: {uniprotLookupStatus?.completed ?? 0} cached, {uniprotLookupStatus?.pending ?? 0} pending, {uniprotLookupStatus?.inFlight ?? 0} in-flight
      </span>
    </div>
    <SyncButton
      viewerA={viewerA}
      viewerB={viewerB}
      activeViewer={activeViewer}
      disabled={syncDisabled}
      syncEnabled={syncEnabled}
      setSyncEnabled={setSyncEnabled}
      id={idPrefix ? `${idPrefix}-${syncSelectIdSuffix}` : syncSelectIdSuffix}
    />
    <button
      disabled={!canRealignToSubunits || subunitRealignmentExists}
      onClick={handleRealignToSubunits}
      id={`${idPrefix}-realign-subunit-btn`}
    >
      {canRealignToSubunits
        ? subunitRealignmentExists
          ? `Already realigned subunits: ${selectedSubunitAlignedTo} -> ${selectedSubunitAligned}`
          : `Realign to Subunits: ${selectedSubunitAlignedTo} -> ${selectedSubunitAligned}`
        : 'Realign to Subunits'}
    </button>
    <button
      disabled={!selectedChainIdAlignedTo || !selectedChainIdAligned || realignmentExists}
      onClick={handleRealignToChains}
      id={`${idPrefix}-realign-btn`}
    >
      {selectedChainIdAlignedTo && selectedChainIdAligned
        ? realignmentExists
          ? `Already re-aligned: ${selectedChainIdAlignedTo} → ${selectedChainIdAligned}`
          : `Re-align : ${selectedChainIdAlignedTo} → ${selectedChainIdAligned}`
        : 'Re-align to Chains'}
    </button>
  </div>
);

export default GeneralControls;
