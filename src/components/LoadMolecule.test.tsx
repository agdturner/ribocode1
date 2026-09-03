/**
 * Test suite for LoadMolecule component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LoadDataRow, { idSuffix as loadMoleculeIdSuffix } from './LoadMolecule';
import { AllowedRepresentationType } from '../types/ribocode';

describe('LoadDataRow', () => {
    const baseProps = {
        viewerTitle: 'Viewer A',
        isLoaded: false,
        onFileInputClick: vi.fn(),
        fileInputRef: { current: null },
        onFileChange: vi.fn(),
        fileInputDisabled: false,
        fileInputLabel: 'Load AlignedTo',
        representationType: 'cartoon' as AllowedRepresentationType,
        onRepresentationTypeChange: vi.fn(),
        representationTypeDisabled: false,
        onAddColorsClick: vi.fn(),
        addColorsDisabled: false,
        colorsInputRef: { current: null },
        onColorsFileChange: vi.fn(),
        subunitToChainIds: new Map([
            ['All', new Set(['A', 'B'])],
            ['Large', new Set()],
            ['Small', new Set()],
            ['Other', new Set()],
        ]) as Map<import('../utils/subunit').RibosomeSubunitType, Set<string>>,
        selectedSubunit: 'All' as import('../utils/subunit').RibosomeSubunitType,
        onSelectSubunit: vi.fn(),
        subunitSelectDisabled: false,
        subunitZoomLabel: 'All',
        onSubunitHighlight: vi.fn(),
        subunitHighlightOn: false,
        subunitHighlightDisabled: false,
        onSubunitZoom: vi.fn(),
        subunitZoomDisabled: false,
        chainInfo: { chainLabels: new Map([['A', 'Chain A'], ['B', 'Chain B']]) },
        selectedChainId: 'A',
        onSelectChainId: vi.fn(),
        chainSelectDisabled: false,
        chainZoomLabel: 'Chain A',
        onChainHighlight: vi.fn(),
        chainHighlightOn: false,
        chainHighlightDisabled: false,
        onChainZoom: vi.fn(),
        chainZoomDisabled: false,
        residueInfo: { residueLabels: new Map([['1', { id: '1', name: 'Residue 1', compId: 'ALA', seqNumber: 1, insCode: '' }]]), residueToAtomIds: { '1': ['a1'] } },
        selectedResidueIds: ['1'],
        onSelectResidueIds: vi.fn(),
        residueSelectDisabled: false,
        residueZoomLabel: 'Residue 1',
        onResidueHighlight: vi.fn(),
        residueHighlightOn: false,
        residueHighlightDisabled: false,
        onResidueZoom: vi.fn(),
        residueZoomDisabled: false,
        onAddRepresentationClick: vi.fn(),
        addRepresentationDisabled: false,
        fogEnabled: false,
        fogNear: 0.1,
        fogFar: 1.0,
        onFogEnabledChange: vi.fn(),
        onFogNearChange: vi.fn(),
        onFogFarChange: vi.fn(),
        clippingMinNear: 0.1,
        clippingRadius: 100,
        onClippingMinNearChange: vi.fn(),
        onClippingRadiusChange: vi.fn(),
        idPrefix: 'test-viewer-a',
    };

    it('renders viewer title and file input button', () => {
        const { container } = render(<LoadDataRow {...baseProps} />);
        // Check for root id
        const root = container.querySelector(`#${baseProps.idPrefix}-${loadMoleculeIdSuffix}`);
        expect(root).toBeInTheDocument();
        expect(screen.getByText('Viewer A')).toBeInTheDocument();
        expect(screen.getByText('Load AlignedTo')).toBeInTheDocument();
    });

    it('calls onFileInputClick when file input button is clicked', () => {
        render(<LoadDataRow {...baseProps} />);
        fireEvent.click(screen.getByText('Load AlignedTo'));
        expect(baseProps.onFileInputClick).toHaveBeenCalled();
    });

    it('renders subunit, chain, and residue select controls', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} />);
        expect(screen.getByText('Chain A')).toBeInTheDocument();
        expect(screen.getByText('Residue 1')).toBeInTheDocument();
    });

    it('calls onAddColorsClick when Load Colours is clicked', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} />);
        fireEvent.click(screen.getByText('Load Colours'));
        expect(baseProps.onAddColorsClick).toHaveBeenCalled();
    });

    it('calls onAddRepresentationClick when + is clicked', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} />);
        fireEvent.click(screen.getByLabelText('Add Representation'));
        expect(baseProps.onAddRepresentationClick).toHaveBeenCalled();
    });

    it('renders select and zoom controls in selector-then-zoom order', () => {
        const { container } = render(<LoadDataRow {...baseProps} isLoaded={true} />);
        const controls = container.querySelector('.load-data-controls');
        expect(controls).toBeInTheDocument();

        const rowText = Array.from(controls!.children).map(el => (el.textContent || '').trim());
        const findRowIndex = (needle: string) => rowText.findIndex(text => text.includes(needle));

        const zoomParamsIndex = findRowIndex('Zoom extraRadius:');
        const subunitSelectIndex = findRowIndex('Select Subunit');
        const subunitZoomIndex = findRowIndex('Zoom to Subunit:');
        const chainSelectIndex = findRowIndex('Select Chain');
        const chainZoomIndex = findRowIndex('Zoom to Chain:');
        const residueSelectIndex = findRowIndex('Select Residues');
        const residueZoomIndex = findRowIndex('Zoom to Residue:');
        const loadColoursIndex = findRowIndex('Load Colours');
        const representationIndex = findRowIndex('Representation:');

        expect(representationIndex).toBeGreaterThanOrEqual(0);
        expect(loadColoursIndex).toBeGreaterThan(representationIndex);
        expect(zoomParamsIndex).toBeGreaterThan(representationIndex);
        expect(subunitSelectIndex).toBeGreaterThan(zoomParamsIndex);
        expect(subunitSelectIndex).toBeGreaterThanOrEqual(0);
        expect(subunitZoomIndex).toBeGreaterThan(subunitSelectIndex);
        expect(chainSelectIndex).toBeGreaterThan(subunitZoomIndex);
        expect(chainZoomIndex).toBeGreaterThan(chainSelectIndex);
        expect(residueSelectIndex).toBeGreaterThan(chainZoomIndex);
        expect(residueZoomIndex).toBeGreaterThan(residueSelectIndex);
    });

    it('hides select and zoom controls when showSelectZoomControls is false', () => {
        const { queryByText } = render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                showSelectZoomControls={false}
            />
        );
        expect(queryByText('Select Subunit')).not.toBeInTheDocument();
        expect(queryByText('Zoom to Subunit: All')).not.toBeInTheDocument();
        expect(queryByText('Select Chain')).not.toBeInTheDocument();
        expect(queryByText('Zoom to Chain: Chain A')).not.toBeInTheDocument();
        expect(queryByText('Select Residues')).not.toBeInTheDocument();
        expect(queryByText('Zoom to Residue: Residue 1')).not.toBeInTheDocument();
        expect(queryByText('Load Colours')).toBeInTheDocument();
        expect(queryByText(/Representation:/)).toBeInTheDocument();
    });

    it('calls subunit/chain/residue highlight and zoom handlers when buttons are clicked', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} />);
        fireEvent.click(screen.getByText('Highlight Subunit: Off'));
        fireEvent.click(screen.getByText('Zoom to Subunit: All'));
        fireEvent.click(screen.getByText('Highlight Chain: Off'));
        fireEvent.click(screen.getByText('Zoom to Chain: Chain A'));
        fireEvent.click(screen.getByText('Highlight Residues: Off'));
        fireEvent.click(screen.getByText('Zoom to Residue: Residue 1'));
        expect(baseProps.onSubunitHighlight).toHaveBeenCalled();
        expect(baseProps.onSubunitZoom).toHaveBeenCalled();
        expect(baseProps.onChainHighlight).toHaveBeenCalled();
        expect(baseProps.onChainZoom).toHaveBeenCalled();
        expect(baseProps.onResidueHighlight).toHaveBeenCalled();
        expect(baseProps.onResidueZoom).toHaveBeenCalled();
    });

    it('renders long loaded filenames in the wrapping label element', () => {
        const veryLongFilename = 'very_long_dataset_name_that_should_wrap_across_multiple_lines_in_the_column_layout_for_stability_and_readability_1234567890.cif';
        const { container } = render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                loadedFilename={veryLongFilename}
            />
        );
        const label = container.querySelector(`#${baseProps.idPrefix}-filename-label`) as HTMLDivElement | null;
        expect(label).toBeInTheDocument();
        expect(label).toHaveTextContent(veryLongFilename);
        expect(label).toHaveClass('loaded-filename');
    });
});
