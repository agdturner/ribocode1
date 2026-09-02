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
    const setZoomExtraRadius = vi.fn();
    const setZoomMinRadius = vi.fn();
    const setShowUniprotAccessionInChainLabels = vi.fn();
    const setSyncEnabled = vi.fn();
    const handleRealignToChains = vi.fn();
    const handleRealignToSubunits = vi.fn();
    const props = {
      zoomExtraRadius: 20,
      setZoomExtraRadius,
      zoomMinRadius: 16,
      setZoomMinRadius,
      showUniprotAccessionInChainLabels: true,
      setShowUniprotAccessionInChainLabels,
      uniprotLookupStatus: { completed: 5, pending: 2, inFlight: 1 },
      viewerA: {},
      viewerB: {},
      activeViewer: 'A' as ViewerKey,
      syncEnabled: false,
      setSyncEnabled,
      syncDisabled: false,
      selectedChainIdAlignedTo: A,
      selectedChainIdAligned: B,
      realignmentExists: false,
      handleRealignToChains,
      selectedSubunitAlignedTo: 'Large',
      selectedSubunitAligned: 'Small',
      subunitRealignmentExists: false,
      canRealignToSubunits: true,
      handleRealignToSubunits,
    };
    const { getByLabelText, getByRole, getByText, container } = render(<GeneralControls {...props} idPrefix="test-controls" />);
    // Check for root id
    const root = container.querySelector(`#test-controls-${generalControlsIdSuffix}`);
    expect(root).toBeInTheDocument();

    // Test zoomExtraRadius input
    const extraRadiusInput = getByLabelText(/Residue Zoom extraRadius/i);
    fireEvent.change(extraRadiusInput, { target: { value: '25' } });
    expect(setZoomExtraRadius).toHaveBeenCalledWith(25);

    // Test zoomMinRadius input
    const minRadiusInput = getByLabelText(/minRadius/i);
    fireEvent.change(minRadiusInput, { target: { value: '18' } });
    expect(setZoomMinRadius).toHaveBeenCalledWith(18);

    const showUniProtToggle = getByLabelText(/Show UniProt accession in chain labels/i);
    fireEvent.click(showUniProtToggle);
    expect(setShowUniprotAccessionInChainLabels).toHaveBeenCalledWith(false);
    expect(getByText(/UniProt cache: 5 cached, 2 pending, 1 in-flight/i)).toBeInTheDocument();

    // Test SyncButton (actually a select) is rendered and works
    const syncSelect = getByLabelText(/Select Sync/i);
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
      zoomExtraRadius: 20,
      setZoomExtraRadius: vi.fn(),
      zoomMinRadius: 16,
      setZoomMinRadius: vi.fn(),
      showUniprotAccessionInChainLabels: true,
      setShowUniprotAccessionInChainLabels: vi.fn(),
      uniprotLookupStatus: { completed: 0, pending: 0, inFlight: 0 },
      viewerA: {},
      viewerB: {},
      activeViewer: 'A' as ViewerKey,
      syncEnabled: false,
      setSyncEnabled: vi.fn(),
      syncDisabled: true,
      selectedChainIdAlignedTo: A,
      selectedChainIdAligned: B,
      realignmentExists: false,
      handleRealignToChains: vi.fn(),
      selectedSubunitAlignedTo: 'Large',
      selectedSubunitAligned: 'Small',
      subunitRealignmentExists: false,
      canRealignToSubunits: true,
      handleRealignToSubunits: vi.fn(),
    };

    const { getByLabelText } = render(<GeneralControls {...props} />);
    expect(getByLabelText(/Select Sync/i)).toBeDisabled();
  });
});
