/**
 * General controls for cross-viewer actions such as sync and realignment.
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
 * Define the props for the GeneralControls component.
 * @typedef {Object} GeneralControlsProps
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
  viewerA: any;
  viewerB: any;
  activeViewer: ViewerKey;
  syncEnabled: boolean;
  setSyncEnabled: (v: boolean) => void;
  syncDisabled: boolean;
  sessionMenu?: React.ReactNode;
  selectedChainIdAlignedTo: string;
  selectedChainIdAligned: string;
  realignmentExists: boolean;
  handleRealignToChains: () => void;
  canRealignToResidues: boolean;
  residueRealignmentExists: boolean;
  residueRealignSummary: string;
  handleRealignToResidues: () => void;
  selectedSubunitAlignedTo: string;
  selectedSubunitAligned: string;
  subunitRealignmentExists: boolean;
  canRealignToSubunits: boolean;
  handleRealignToSubunits: () => void;
  idPrefix?: string;
}

/**
 * GeneralControls component that provides synchronization and realignment controls.
 * @param {GeneralControlsProps} props - The props for the GeneralControls component.
 * @returns {JSX.Element} The GeneralControls component.
 */
const GeneralControls: React.FC<GeneralControlsProps> = ({
  viewerA,
  viewerB,
  activeViewer,
  syncEnabled,
  setSyncEnabled,
  syncDisabled,
  sessionMenu,
  selectedChainIdAlignedTo,
  selectedChainIdAligned,
  realignmentExists,
  handleRealignToChains,
  canRealignToResidues,
  residueRealignmentExists,
  residueRealignSummary,
  handleRealignToResidues,
  selectedSubunitAlignedTo,
  selectedSubunitAligned,
  subunitRealignmentExists,
  canRealignToSubunits,
  handleRealignToSubunits,
  idPrefix = 'generalcontrols',
}) => (
  <div className="General-Controls" id={idPrefix ? `${idPrefix}-${idSuffix}` : idSuffix}>
    {sessionMenu}
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
          ? `Already aligned subunits: ${selectedSubunitAlignedTo} -> ${selectedSubunitAligned}`
          : `Align Subunits: ${selectedSubunitAlignedTo} -> ${selectedSubunitAligned}`
        : 'Align Subunits'}
    </button>
    <button
      disabled={!selectedChainIdAlignedTo || !selectedChainIdAligned || realignmentExists}
      onClick={handleRealignToChains}
      id={`${idPrefix}-realign-btn`}
    >
      {selectedChainIdAlignedTo && selectedChainIdAligned
        ? realignmentExists
          ? `Already aligned chains: ${selectedChainIdAlignedTo} → ${selectedChainIdAligned}`
          : `Align Chains: ${selectedChainIdAlignedTo} → ${selectedChainIdAligned}`
        : 'Align Chains'}
    </button>
    <button
      disabled={!canRealignToResidues || residueRealignmentExists}
      onClick={handleRealignToResidues}
      id={`${idPrefix}-realign-residue-btn`}
    >
      {canRealignToResidues
        ? residueRealignmentExists
          ? `Already aligned residues: ${residueRealignSummary}`
          : `Align Residues: ${residueRealignSummary}`
        : 'Align Residues'}
    </button>
  </div>
);

export default GeneralControls;
