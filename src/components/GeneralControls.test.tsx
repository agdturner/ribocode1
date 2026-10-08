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
    const { getByLabelText, getByRole, container, unmount } = render(<GeneralControls {...props} idPrefix="test-controls" />);
    // Check for root id
    const root = container.querySelector(`#test-controls-${generalControlsIdSuffix}`);
    expect(root).toBeInTheDocument();

    // Test SyncButton is rendered and toggles
    const syncButton = getByLabelText(/Sync/i);
    expect(syncButton).toBeInTheDocument();
    fireEvent.click(syncButton);
    expect(setSyncEnabled).toHaveBeenCalledWith(true);

    // Test realign button
    const realignBtn = getByRole('button', { name: /Align Chains:/i });
    fireEvent.click(realignBtn);
    expect(handleRealignToChains).toHaveBeenCalled();
    expect(realignBtn).not.toBeDisabled();

    const realignResidueBtn = getByRole('button', { name: /Align Residues: 2 to 3/i });
    fireEvent.click(realignResidueBtn);
    expect(handleRealignToResidues).toHaveBeenCalled();
    expect(realignResidueBtn).not.toBeDisabled();

    const realignSubunitBtn = getByRole('button', { name: /Align Subunits:/i });
    fireEvent.click(realignSubunitBtn);
    expect(handleRealignToSubunits).toHaveBeenCalled();
    expect(realignSubunitBtn).not.toBeDisabled();

    // Test disabled state
    unmount();
    const { getByRole: getByRole2 } = render(
      <GeneralControls {...props} selectedChainIdAlignedTo="" />
    );
    expect(getByRole2('button', { name: /Align Chains/i })).toBeDisabled();
  });

  it('disables the sync select when syncDisabled is true', () => {
    const props = {
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
