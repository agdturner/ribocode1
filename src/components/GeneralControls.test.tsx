/**
 * Test suite for GeneralControls component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import GeneralControls, { idSuffix as generalControlsIdSuffix } from './GeneralControls';
import type { ViewerKey } from '../types/ribocode';
import { A, B } from '../constants/ribocode';

describe('GeneralControls', () => {
  it('renders and responds to user input', () => {
    const setShowUniprotAccessionInChainLabels = vi.fn();
    const setSyncEnabled = vi.fn();
    const handleRealignToChains = vi.fn();
    const handleRealignToResidues = vi.fn();
    const handleRealignToSubunits = vi.fn();
    const props = {
      viewerA: {},
      viewerB: {},
      activeViewer: 'A' as ViewerKey,
      syncEnabled: false,
      setSyncEnabled,
      syncDisabled: false,
      showUniprotAccessionInChainLabels: true,
      setShowUniprotAccessionInChainLabels,
      uniprotLookupStatus: { completed: 5, pending: 2, inFlight: 1 },
      selectedChainIdAlignedTo: A,
      selectedChainIdAligned: B,
      realignmentExists: false,
      handleRealignToChains,
      canRealignToResidues: true,
      residueRealignmentExists: false,
      residueRealignSummary: '2 to 3',
      handleRealignToResidues,
      selectedSubunitAlignedTo: 'Large',
      selectedSubunitAligned: 'Small',
      subunitRealignmentExists: false,
      canRealignToSubunits: true,
      handleRealignToSubunits,
    };
    const { getByLabelText, getByRole, container } = render(<GeneralControls {...props} idPrefix="test-controls" />);
    // Check for root id
    const root = container.querySelector(`#test-controls-${generalControlsIdSuffix}`);
    expect(root).toBeInTheDocument();

    const showUniProtToggle = getByLabelText(/Show UniProt accession in chain labels/i);
    fireEvent.click(showUniProtToggle);
    expect(setShowUniprotAccessionInChainLabels).toHaveBeenCalledWith(false);
    expect(container.querySelector('#test-controls-uniprot-status')?.textContent).toContain('UniProt cache: 5 cached, 2 pending, 1 in-flight');

    // Test SyncButton (actually a select) is rendered and works
    const syncSelect = getByLabelText(/Sync/i);
    expect(syncSelect).toBeInTheDocument();
    fireEvent.change(syncSelect, { target: { value: 'On' } });
    expect(setSyncEnabled).toHaveBeenCalledWith(true);
    fireEvent.change(syncSelect, { target: { value: 'Off' } });
    expect(setSyncEnabled).toHaveBeenCalledWith(false);

    // Test realign button
    const realignBtn = getByRole('button', { name: /Re-align :/i });
    fireEvent.click(realignBtn);
    expect(handleRealignToChains).toHaveBeenCalled();
    expect(realignBtn).not.toBeDisabled();

    const realignResidueBtn = getByRole('button', { name: /Realign to Residues: 2 to 3/i });
    fireEvent.click(realignResidueBtn);
    expect(handleRealignToResidues).toHaveBeenCalled();
    expect(realignResidueBtn).not.toBeDisabled();

    const realignSubunitBtn = getByRole('button', { name: /Realign to Subunits:/i });
    fireEvent.click(realignSubunitBtn);
    expect(handleRealignToSubunits).toHaveBeenCalled();
    expect(realignSubunitBtn).not.toBeDisabled();

    // Test disabled state
    const { getByRole: getByRole2 } = render(
      <GeneralControls {...props} selectedChainIdAlignedTo="" />
    );
    expect(getByRole2('button', { name: /Re-align to Chains/i })).toBeDisabled();
  });

  it('disables the sync select when syncDisabled is true', () => {
    const props = {
      viewerA: {},
      viewerB: {},
      activeViewer: 'A' as ViewerKey,
      syncEnabled: false,
      setSyncEnabled: vi.fn(),
      syncDisabled: true,
      showUniprotAccessionInChainLabels: true,
      setShowUniprotAccessionInChainLabels: vi.fn(),
      uniprotLookupStatus: { completed: 0, pending: 0, inFlight: 0 },
      selectedChainIdAlignedTo: A,
      selectedChainIdAligned: B,
      realignmentExists: false,
      handleRealignToChains: vi.fn(),
      canRealignToResidues: false,
      residueRealignmentExists: false,
      residueRealignSummary: '0 to 0',
      handleRealignToResidues: vi.fn(),
      selectedSubunitAlignedTo: 'Large',
      selectedSubunitAligned: 'Small',
      subunitRealignmentExists: false,
      canRealignToSubunits: true,
      handleRealignToSubunits: vi.fn(),
    };

    const { getByLabelText } = render(<GeneralControls {...props} />);
    expect(getByLabelText(/Sync/i)).toBeDisabled();
  });
});
