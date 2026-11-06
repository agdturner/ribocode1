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
        colorMode: 'chain' as const,
        onColorModeChange: vi.fn(),
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
        onSubunitInspect: vi.fn(),
        subunitInspectOn: false,
        subunitInspectDisabled: false,
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
        onChainInspect: vi.fn(),
        chainInspectOn: false,
        chainInspectDisabled: false,
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
        onResidueInspect: vi.fn(),
        residueInspectOn: false,
        residueInspectDisabled: false,
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
        const loadAlignedToButton = screen.getByRole('button', { name: 'Load AlignedTo' });
        expect(loadAlignedToButton).toBeInTheDocument();
        expect(loadAlignedToButton).toHaveAttribute('title', 'Load the AlignedTo reference structure file (.cif or .mmcif).');
        const representationToggle = document.getElementById('test-viewer-a-representation-controls-toggle-btn');
        expect(representationToggle).toBeInTheDocument();
        expect(representationToggle).toHaveClass('molstar-file-btn');
        expect(representationToggle).toHaveClass('molstar-advanced-controls-toggle');
    });

    it('renders a Load Aligned button tooltip when configured for Aligned viewer', () => {
        render(<LoadDataRow {...baseProps} fileInputLabel="Load Aligned" />);
        const loadAlignedButton = screen.getByRole('button', { name: 'Load Aligned' });
        expect(loadAlignedButton).toHaveAttribute('title', 'Load the Aligned structure file (.cif or .mmcif).');
    });

    it('shows an enablement tooltip when Load Aligned is disabled', () => {
        render(<LoadDataRow {...baseProps} fileInputLabel="Load Aligned" fileInputDisabled={true} />);
        const loadAlignedButton = screen.getByRole('button', { name: 'Load Aligned' });
        expect(loadAlignedButton).toHaveAttribute(
            'title',
            'Disabled until AlignedTo is loaded. Load AlignedTo first, then this button will be enabled.'
        );
    });

    it('calls onFileInputClick when file input button is clicked', () => {
        render(<LoadDataRow {...baseProps} />);
        fireEvent.click(screen.getByText('Load AlignedTo'));
        expect(baseProps.onFileInputClick).toHaveBeenCalled();
    });

    it('renders subunit, chain, and residue select controls', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} />);
        fireEvent.click(screen.getByText('Show Subunit Controls'));
        fireEvent.click(screen.getByText('Show Chain Controls'));
        fireEvent.click(screen.getByText('Show Select 1'));
        fireEvent.click(screen.getByText('Show Residue Controls'));
        expect(screen.getByText('Chain A')).toBeInTheDocument();
        expect(screen.getByText('Residue 1')).toBeInTheDocument();
    });

    it('shows residue type counts in representation controls when residue-type mode is active', () => {
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorMode="residue-type"
                residueInfo={{
                    residueLabels: new Map([
                        ['1', { id: '1', name: 'ALA 1', compId: 'ALA', seqNumber: 1, insCode: '' }],
                        ['2', { id: '2', name: 'GLY 2', compId: 'GLY', seqNumber: 2, insCode: '' }],
                    ]),
                    residueToAtomIds: { '1': ['a1'], '2': ['a2'] }
                }}
                residueInfo2={{
                    residueLabels: new Map([
                        ['10', { id: '10', name: 'ALA 10', compId: 'ALA', seqNumber: 10, insCode: '' }],
                    ]),
                    residueToAtomIds: { '10': ['b1'] }
                }}
            />
        );

        fireEvent.click(screen.getByText('Show Representation Controls'));

        expect(screen.getByText('Residue Types (all chains in loaded dataset)')).toBeInTheDocument();
        expect(screen.getAllByText('ALA (2)').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('GLY (1)').length).toBeGreaterThanOrEqual(1);
    });

    it('keeps selected chain actions outside Select subsection', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} />);

        fireEvent.click(screen.getByText('Show Chain Controls'));
        expect(document.getElementById('test-viewer-a-selected-chain-label')).toBeInTheDocument();
        expect(document.getElementById('test-viewer-a-chain-table-container')).toBeNull();

        fireEvent.click(screen.getByText('Show Select 1'));
        expect(document.getElementById('test-viewer-a-chain-table-container')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Hide Select 1'));
        expect(document.getElementById('test-viewer-a-selected-chain-label')).toBeInTheDocument();
        expect(document.getElementById('test-viewer-a-chain-table-container')).toBeNull();
        expect(document.getElementById('test-viewer-a-show-uniprot-accession')).toBeNull();
    });

    it('calls onAddColorsClick when Load is clicked in chain mode', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} />);
        fireEvent.click(screen.getByText('Show Representation Controls'));
        fireEvent.click(screen.getByText('Load'));
        expect(baseProps.onAddColorsClick).toHaveBeenCalled();
    });

    it('renders colour theme selector and notifies selection changes', () => {
        const onSelectedColorThemeNameChange = vi.fn();
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'aligned-custom-1', label: 'Custom 1' },
                ]}
                selectedColorThemeName="default"
                onSelectedColorThemeNameChange={onSelectedColorThemeNameChange}
                removeColorThemeDisabled={true}
            />
        );

        fireEvent.click(screen.getByText('Show Representation Controls'));

        const select = document.getElementById('test-viewer-a-chain-colour-theme-select') as HTMLSelectElement;
        expect(select).toBeInTheDocument();
        expect(select.value).toBe('default');

        fireEvent.change(select, { target: { value: 'aligned-custom-1' } });
        expect(onSelectedColorThemeNameChange).toHaveBeenCalledWith('aligned-custom-1');
    });

    it('supports representation colouring mode toggle callback', () => {
        const onColorModeChange = vi.fn();
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorMode="chain"
                onColorModeChange={onColorModeChange}
            />
        );

        fireEvent.click(screen.getByText('Show Representation Controls'));

        const modeSelect = document.getElementById('test-viewer-a-color-mode-select') as HTMLSelectElement;
        expect(modeSelect).toBeInTheDocument();
        expect(modeSelect.value).toBe('chain');
        fireEvent.change(modeSelect, { target: { value: 'residue-type' } });
        expect(onColorModeChange).toHaveBeenCalledWith('residue-type');

    });

    it('renders editable residue type color mapping and applies selected residue color', () => {
        const onResidueTypeColorChange = vi.fn();
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorMode="residue-type"
                residueTypeColorsById={new Map([
                    ['ALA', '#AA0000'],
                    ['GLY', '#00AA00'],
                ])}
                onResidueTypeColorChange={onResidueTypeColorChange}
                residueInfo={{
                    residueLabels: new Map([
                        ['1', { id: '1', name: 'ALA 1', compId: 'ALA', seqNumber: 1, insCode: '' }],
                        ['2', { id: '2', name: 'GLY 2', compId: 'GLY', seqNumber: 2, insCode: '' }],
                    ]),
                    residueToAtomIds: { '1': ['a1'], '2': ['a2'] }
                }}
            />
        );

        fireEvent.click(screen.getByText('Show Representation Controls'));

        const alaColor = document.getElementById('test-viewer-a-residue-type-color-ALA') as HTMLInputElement;
        const alaApply = document.getElementById('test-viewer-a-residue-type-color-ALA-apply-btn') as HTMLButtonElement;
        expect(alaColor).toBeInTheDocument();
        expect(alaApply).toBeInTheDocument();
        expect(alaApply.disabled).toBe(true);

        fireEvent.change(alaColor, { target: { value: '#112233' } });
        expect(alaApply.disabled).toBe(false);
        fireEvent.click(alaApply);
        expect(onResidueTypeColorChange).toHaveBeenCalledWith('ALA', '#112233');

        // Chain color editor is hidden in residue mode.
        expect(document.getElementById('test-viewer-a-chain-color-table-container')).toBeNull();
    });

    it('applies per-chain color from searchable chain editor when chain mode is active', () => {
        const onChainColorChange = vi.fn();
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorMode="chain"
                chainColorsById={new Map([
                    ['A', '#3366FF'],
                    ['B', '#00AA00'],
                ])}
                onChainColorChange={onChainColorChange}
            />
        );

        fireEvent.click(screen.getByText('Show Representation Controls'));

        const search = document.getElementById('test-viewer-a-chain-color-table-search') as HTMLInputElement;
        expect(search).toBeInTheDocument();
        fireEvent.change(search, { target: { value: 'Chain A' } });

        const chainColorInput = document.getElementById('test-viewer-a-chain-color-A') as HTMLInputElement;
        expect(chainColorInput).toBeInTheDocument();
        expect(chainColorInput.value.toLowerCase()).toBe('#3366ff');

        fireEvent.change(chainColorInput, { target: { value: '#ff8800' } });
        expect(onChainColorChange).not.toHaveBeenCalled();

        const applyButton = document.getElementById('test-viewer-a-chain-color-A-apply-btn') as HTMLButtonElement;
        expect(applyButton).toBeInTheDocument();
        expect(applyButton.disabled).toBe(false);
        fireEvent.click(applyButton);
        expect(onChainColorChange).toHaveBeenCalledWith('A', '#ff8800');
    });

    it('calls onSaveColorTheme when save theme button is clicked', () => {
        const onSaveColorTheme = vi.fn();
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'aligned-custom-1', label: 'Custom 1' },
                ]}
                selectedColorThemeName="aligned-custom-1"
                onSelectedColorThemeNameChange={vi.fn()}
                onSaveColorTheme={onSaveColorTheme}
                saveColorThemeDisabled={false}
            />
        );

        fireEvent.click(screen.getByText('Show Representation Controls'));

        const saveButton = document.getElementById('test-viewer-a-save-chain-theme-btn') as HTMLButtonElement;
        expect(saveButton).toBeInTheDocument();
        expect(saveButton.disabled).toBe(false);
        fireEvent.click(saveButton);
        expect(onSaveColorTheme).toHaveBeenCalled();
    });

    it('calls onRemoveColorTheme when remove theme button is clicked', () => {
        const onRemoveColorTheme = vi.fn();
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'aligned-custom-1', label: 'Custom 1' },
                ]}
                selectedColorThemeName="aligned-custom-1"
                onSelectedColorThemeNameChange={vi.fn()}
                onRemoveColorTheme={onRemoveColorTheme}
                removeColorThemeDisabled={false}
            />
        );

        fireEvent.click(screen.getByText('Show Representation Controls'));

        const removeButton = document.getElementById('test-viewer-a-remove-chain-theme-btn') as HTMLButtonElement;
        expect(removeButton).toBeInTheDocument();
        expect(removeButton.disabled).toBe(false);
        fireEvent.click(removeButton);
        expect(onRemoveColorTheme).toHaveBeenCalled();
    });

    it('calls onAddRepresentationClick when + is clicked', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} />);
        fireEvent.click(screen.getByText('Show Representation Controls'));
        fireEvent.click(screen.getByLabelText('Add Representation'));
        expect(baseProps.onAddRepresentationClick).toHaveBeenCalled();
    });

    it('adds tooltips for representation controls in chain theme mode', () => {
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorMode="chain"
                colorThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'aligned-custom-1', label: 'Custom 1' },
                ]}
                selectedColorThemeName="aligned-custom-1"
                onSelectedColorThemeNameChange={vi.fn()}
                onSaveColorTheme={vi.fn()}
                saveColorThemeDisabled={false}
                onRemoveColorTheme={vi.fn()}
                removeColorThemeDisabled={false}
                chainColorsById={new Map([['A', '#3366FF']])}
                onChainColorChange={vi.fn()}
            />
        );

        fireEvent.click(screen.getByText('Show Representation Controls'));

        expect(document.getElementById('test-viewer-a-representation-type')).toHaveAttribute(
            'title',
            'Choose the representation type to add, currently set to cartoon'
        );
        expect(screen.getByLabelText('Add Representation')).toHaveAttribute(
            'title',
            'Add a new representation using the selected representation type using the theme as below.'
        );
        expect(document.getElementById('test-viewer-a-color-mode-select')).toHaveAttribute(
            'title',
            'Choose whether representation themes are based on chain or residue type.'
        );
        expect(document.getElementById('test-viewer-a-chain-colour-theme-select')).toHaveAttribute(
            'title',
            'Select the active chain colour theme.'
        );
        expect(document.getElementById('test-viewer-a-remove-chain-theme-btn')).toHaveAttribute(
            'title',
            'Remove the selected chain colour theme.'
        );
        expect(document.getElementById('test-viewer-a-load-chain-colours-btn')).toHaveAttribute(
            'title',
            'Load a chain colour theme from .json, .csv, .tsv, or .txt with chain IDs mapped to colour values.'
        );
        expect(document.getElementById('test-viewer-a-save-chain-theme-btn')).toHaveAttribute(
            'title',
            'Save the current chain colour theme to a file.'
        );
        expect(document.getElementById('test-viewer-a-chain-color-table-search')).toHaveAttribute(
            'title',
            'Filter chain rows before editing chain colours.'
        );
        expect(document.getElementById('test-viewer-a-chain-color-A')).toHaveAttribute(
            'title',
            'Choose a new colour for chain A.'
        );
        expect(document.getElementById('test-viewer-a-chain-color-A-apply-btn')).toHaveAttribute(
            'title',
            'Disabled until chain A has an unsaved colour change.'
        );
    });

    it('adds tooltips for representation controls in residue theme mode', () => {
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorMode="residue-type"
                colorThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'aligned-residue-1', label: 'Residue 1' },
                ]}
                selectedColorThemeName="aligned-residue-1"
                onSelectedColorThemeNameChange={vi.fn()}
                onSaveColorTheme={vi.fn()}
                saveColorThemeDisabled={false}
                onRemoveColorTheme={vi.fn()}
                removeColorThemeDisabled={false}
                residueInfo={{
                    residueLabels: new Map([
                        ['1', { id: '1', name: 'ALA 1', compId: 'ALA', seqNumber: 1, insCode: '' }],
                    ]),
                    residueToAtomIds: { '1': ['a1'] }
                }}
            />
        );

        fireEvent.click(screen.getByText('Show Representation Controls'));
        expect(document.getElementById('test-viewer-a-residue-colour-theme-select')).toHaveAttribute(
            'title',
            'Select the active residue colour theme.'
        );
        expect(document.getElementById('test-viewer-a-remove-residue-theme-btn')).toHaveAttribute(
            'title',
            'Remove the selected residue colour theme.'
        );
        expect(document.getElementById('test-viewer-a-load-residue-colours-btn')).toHaveAttribute(
            'title',
            'Load a residue colour theme from .json, .csv, .tsv, or .txt with residue types mapped to colour values.'
        );
        expect(document.getElementById('test-viewer-a-save-residue-theme-btn')).toHaveAttribute(
            'title',
            'Save the current residue colour theme to a file.'
        );
    });

    it('renders grouped select and zoom toggles and keeps residue disabled without chain', () => {
        const { container, unmount } = render(<LoadDataRow {...baseProps} isLoaded={true} />);
        const controls = container.querySelector('.load-data-controls');
        expect(controls).toBeInTheDocument();

        const rowText = Array.from(controls!.children).map(el => (el.textContent || '').trim());
        const findRowIndex = (needle: string) => rowText.findIndex(text => text.includes(needle));

        const subunitToggleIndex = findRowIndex('Show Subunit Controls');
        const chainToggleIndex = findRowIndex('Show Chain Controls');
        const visibilityToggleIndex = findRowIndex('Show Visibility Controls');
        const repControlsToggleIndex = findRowIndex('Show Representation Controls');

        expect(repControlsToggleIndex).toBeGreaterThanOrEqual(0);
        expect(visibilityToggleIndex).toBeGreaterThan(repControlsToggleIndex);
        expect(subunitToggleIndex).toBeGreaterThan(repControlsToggleIndex);
        expect(chainToggleIndex).toBeGreaterThan(subunitToggleIndex);

        fireEvent.click(screen.getByText('Show Representation Controls'));
        expect(screen.getByText('Hide Representation Controls')).toBeInTheDocument();
        expect(screen.getByText('Load')).toBeInTheDocument();
        expect(screen.getByLabelText('Add Representation')).toBeInTheDocument();

        unmount();

        const { getByText } = render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                selectedChainId=""
            />
        );
        fireEvent.click(getByText('Show Chain Controls'));
        fireEvent.click(getByText('Show Select 1'));
        expect((getByText('Show Residue Controls') as HTMLButtonElement).disabled).toBe(true);
    });

    it('adds tooltips to Show/Hide control toggle buttons', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} />);

        const representationToggle = document.getElementById('test-viewer-a-representation-controls-toggle-btn');
        expect(representationToggle).toHaveAttribute('title', 'Show representation controls.');
        fireEvent.click(representationToggle as HTMLElement);
        expect(document.getElementById('test-viewer-a-representation-controls-toggle-btn'))
            .toHaveAttribute('title', 'Hide representation controls.');

        expect(document.getElementById('test-viewer-a-visibility-controls-toggle-btn'))
            .toHaveAttribute('title', 'Show visibility controls.');
        expect(document.getElementById('test-viewer-a-subunit-controls-toggle-btn'))
            .toHaveAttribute('title', 'Show subunit controls.');
        expect(document.getElementById('test-viewer-a-chain-controls-toggle-btn'))
            .toHaveAttribute('title', 'Show chain controls.');

        fireEvent.click(screen.getByText('Show Chain Controls'));
        expect(document.getElementById('test-viewer-a-select-chain-controls-toggle-btn'))
            .toHaveAttribute('title', 'Show Select 1 controls.');

        fireEvent.click(screen.getByText('Show Select 2'));
        expect(document.getElementById('test-viewer-a-residue2-controls-toggle-btn'))
            .toHaveAttribute('title', 'Disabled. Select a chain in Select 2 to enable residue controls.');
    });

    it('explains why Select 2 and residue controls are disabled', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} selectedChainId="" />);

        fireEvent.click(screen.getByText('Show Chain Controls'));
        expect(document.getElementById('test-viewer-a-select-chain2-controls-toggle-btn'))
            .toHaveAttribute('title', 'Disabled. Select a chain in Select 1 first.');

        fireEvent.click(screen.getByText('Show Select 1'));
        expect(document.getElementById('test-viewer-a-residue-controls-toggle-btn'))
            .toHaveAttribute('title', 'Disabled. Select a chain in Select 1 to enable residue controls.');
    });

    it('hides select and zoom controls when showSelectZoomControls is false', () => {
        const { queryByText } = render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                showSelectZoomControls={false}
            />
        );
        expect(queryByText('Select')).not.toBeInTheDocument();
        expect(queryByText('Zoom')).not.toBeInTheDocument();
        expect(queryByText('Selected 1: Chain A')).not.toBeInTheDocument();
        expect(queryByText('Zoom')).not.toBeInTheDocument();
        expect(queryByText('Select')).not.toBeInTheDocument();
        expect(document.getElementById('test-viewer-a-zoom-residue-btn')).toBeNull();
        expect(queryByText('Show Representation Controls')).toBeInTheDocument();
        expect(queryByText('Load Colours')).not.toBeInTheDocument();
        expect(queryByText(/Representation:/)).not.toBeInTheDocument();
    });

    it('calls subunit/chain/residue basic highlight, inspect, and zoom handlers when buttons are clicked', () => {
        render(<LoadDataRow {...baseProps} isLoaded={true} />);
        fireEvent.click(screen.getByText('Show Subunit Controls'));
        fireEvent.click(screen.getByText('Show Chain Controls'));
        fireEvent.click(screen.getByText('Show Select 1'));
        fireEvent.click(screen.getByText('Show Residue Controls'));
        expect(document.getElementById('test-viewer-a-subunit-select')).toHaveAttribute(
            'title',
            'Choose the active subunit selection, currently set to All.'
        );
        expect(document.getElementById('test-viewer-a-zoom-subunit-btn')).toHaveAttribute(
            'title',
            'Zoom to current subunit selection (All).'
        );
        expect(document.getElementById('test-viewer-a-highlight-subunit-btn')).toHaveAttribute(
            'title',
            'Subunit highlight is Off. Click to turn it On.'
        );
        expect(document.getElementById('test-viewer-a-inspect-subunit-btn')).toHaveAttribute(
            'title',
            'Subunit inspect is Off. Click to turn it On.'
        );
        fireEvent.click(document.getElementById('test-viewer-a-zoom-subunit-btn') as HTMLButtonElement);
        fireEvent.click(document.getElementById('test-viewer-a-highlight-subunit-btn') as HTMLButtonElement);
        fireEvent.click(document.getElementById('test-viewer-a-inspect-subunit-btn') as HTMLButtonElement);
        fireEvent.click(document.getElementById('test-viewer-a-zoom-chain-btn') as HTMLButtonElement);
        fireEvent.click(document.getElementById('test-viewer-a-highlight-chain-btn') as HTMLButtonElement);
        fireEvent.click(document.getElementById('test-viewer-a-inspect-chain-btn') as HTMLButtonElement);
        fireEvent.click(document.getElementById('test-viewer-a-zoom-residue-btn') as HTMLButtonElement);
        fireEvent.click(document.getElementById('test-viewer-a-highlight-residue-btn') as HTMLButtonElement);
        fireEvent.click(document.getElementById('test-viewer-a-inspect-residue-btn') as HTMLButtonElement);
        expect(baseProps.onSubunitHighlight).toHaveBeenCalled();
        expect(baseProps.onSubunitInspect).toHaveBeenCalled();
        expect(baseProps.onSubunitZoom).toHaveBeenCalled();
        expect(baseProps.onChainHighlight).toHaveBeenCalled();
        expect(baseProps.onChainInspect).toHaveBeenCalled();
        expect(baseProps.onChainZoom).toHaveBeenCalled();
        expect(baseProps.onResidueHighlight).toHaveBeenCalled();
        expect(baseProps.onResidueInspect).toHaveBeenCalled();
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

    it('renders inspect toggles as On when corresponding props are true', () => {
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                chainInspectOn={true}
                residueInspectOn={true}
                subunitInspectOn={true}
            />
        );

        fireEvent.click(screen.getByText('Show Subunit Controls'));
        fireEvent.click(screen.getByText('Show Chain Controls'));
        fireEvent.click(screen.getByText('Show Select 1'));
        fireEvent.click(screen.getByText('Show Residue Controls'));

        expect(document.getElementById('test-viewer-a-inspect-subunit-btn')).toHaveTextContent('Inspect: On');
        expect(document.getElementById('test-viewer-a-inspect-chain-btn')).toHaveTextContent('Inspect: On');
        expect(document.getElementById('test-viewer-a-inspect-residue-btn')).toHaveTextContent('Inspect: On');
    });

    it('supports selection display mode and dim-unselected controls', () => {
        const onSelectionDisplayModeChange = vi.fn();
        const onDimUnselectedChange = vi.fn();
        const onDimUnselectedStrengthChange = vi.fn();

        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorMode="chain"
                selectionDisplayMode="overlay"
                onSelectionDisplayModeChange={onSelectionDisplayModeChange}
                dimUnselected={false}
                onDimUnselectedChange={onDimUnselectedChange}
                dimUnselectedStrength={0.4}
                onDimUnselectedStrengthChange={onDimUnselectedStrengthChange}
            />
        );

        expect(document.getElementById('test-viewer-a-selection-display-mode')).toBeNull();
        expect(document.getElementById('test-viewer-a-dim-unselected-toggle-btn')).toBeNull();
        expect(document.getElementById('test-viewer-a-dim-unselected-strength')).toBeNull();

        fireEvent.click(screen.getByText('Show Visibility Controls'));

        const modeSelect = document.getElementById('test-viewer-a-selection-display-mode') as HTMLSelectElement;
        const dimToggle = document.getElementById('test-viewer-a-dim-unselected-toggle-btn') as HTMLButtonElement;
        const dimStrength = document.getElementById('test-viewer-a-dim-unselected-strength') as HTMLInputElement;
        const zoomExtraRadius = document.getElementById('test-viewer-a-zoom-extra-radius') as HTMLInputElement;
        const zoomMinRadius = document.getElementById('test-viewer-a-zoom-min-radius') as HTMLInputElement;

        expect(modeSelect).toBeInTheDocument();
        expect(modeSelect).toHaveAttribute('title', 'Choose how highlights are displayed, currently set to overlay.');
        expect(modeSelect.value).toBe('overlay');
        fireEvent.change(modeSelect, { target: { value: 'halo' } });
        expect(onSelectionDisplayModeChange).toHaveBeenCalledWith('halo');

        expect(dimToggle).toBeInTheDocument();
        expect(dimToggle).toHaveAttribute(
            'title',
            'Dim unselected is currently Off. Turn it On to grey and de-emphasize unselected atoms/residues while keeping selected chain emphasized.'
        );
        expect(dimToggle).toHaveAttribute('aria-pressed', 'false');
        fireEvent.click(dimToggle);
        expect(onDimUnselectedChange).toHaveBeenCalledWith(true);

        expect(dimStrength).toBeInTheDocument();
        expect(dimStrength).toHaveAttribute('title', 'Disabled until Dim unselected is turned On.');
        expect(dimStrength.disabled).toBe(true);
        fireEvent.change(dimStrength, { target: { value: '70' } });
        expect(onDimUnselectedStrengthChange).toHaveBeenCalledWith(0.7);

        expect(zoomExtraRadius).toBeInTheDocument();
        expect(zoomExtraRadius).toHaveAttribute(
            'title',
            'Adjust extraRadius padding used when zooming to selections.'
        );
        expect(zoomMinRadius).toBeInTheDocument();
        expect(zoomMinRadius).toHaveAttribute(
            'title',
            'Adjust the minimum zoom radius used when zooming to selections.'
        );
    });

    it('describes dimming scope using selected residues when Theme Type is residue', () => {
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                colorMode="residue-type"
                dimUnselected={false}
            />
        );

        fireEvent.click(screen.getByText('Show Visibility Controls'));
        const dimToggle = document.getElementById('test-viewer-a-dim-unselected-toggle-btn') as HTMLButtonElement;
        expect(dimToggle).toHaveAttribute(
            'title',
            'Dim unselected is currently Off. Turn it On to grey and de-emphasize unselected atoms/residues while keeping selected residues emphasized.'
        );
    });

    it('supports residue quick actions and residue-type toggles', () => {
        const onSelectResidueIds = vi.fn();
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                selectedResidueIds={['1']}
                onSelectResidueIds={onSelectResidueIds}
                residueInfo={{
                    residueLabels: new Map([
                        ['1', { id: '1', name: 'ALA 1', compId: 'ALA', seqNumber: 1, insCode: '' }],
                        ['2', { id: '2', name: 'ALA 2', compId: 'ALA', seqNumber: 2, insCode: '' }],
                        ['3', { id: '3', name: 'GLY 3', compId: 'GLY', seqNumber: 3, insCode: '' }],
                    ]),
                    residueToAtomIds: { '1': ['a1'], '2': ['a2'], '3': ['a3'] },
                }}
                residueCommonIds={['2', '3']}
            />
        );

        fireEvent.click(screen.getByText('Show Chain Controls'));
        fireEvent.click(screen.getByText('Show Select 1'));
        expect(document.getElementById('test-viewer-a-chain-table-search')).toHaveAttribute(
            'title',
            'Select a chain for Select 1.'
        );
        expect(document.getElementById('test-viewer-a-zoom-chain-btn')).toHaveAttribute(
            'title',
            'Zoom to the current Select 1 chain selection (Chain A).'
        );
        expect(document.getElementById('test-viewer-a-highlight-chain-btn')).toHaveAttribute(
            'title',
            'Select 1 chain highlight is Off. Click to turn it On.'
        );
        expect(document.getElementById('test-viewer-a-inspect-chain-btn')).toHaveAttribute(
            'title',
            'Select 1 chain inspect is Off. Click to turn it On.'
        );
        fireEvent.click(screen.getByText('Show Residue Controls'));
        expect(document.getElementById('test-viewer-a-residue-select')).toHaveAttribute(
            'title',
            'Select one or more residues for Select 1.'
        );
        expect(document.getElementById('test-viewer-a-residue-select-all-btn')).toHaveAttribute(
            'title',
            'Select all residues for Select 1.'
        );
        expect(document.getElementById('test-viewer-a-residue-clear-selection-btn')).toHaveAttribute(
            'title',
            'Clear the current residue selection for Select 1.'
        );
        expect(document.getElementById('test-viewer-a-residue-invert-selection-btn')).toHaveAttribute(
            'title',
            'Invert the current residue selection for Select 1.'
        );
        expect(document.getElementById('test-viewer-a-residue-select-common-btn')).toHaveAttribute(
            'title',
            'Select residues shared between Select 1 and the other selection.'
        );
        expect(document.getElementById('test-viewer-a-residue-type-toggle-ALA-btn')).toHaveAttribute(
            'title',
            'Add all ALA residues in Select 1.'
        );
        expect(document.getElementById('test-viewer-a-zoom-residue-btn')).toHaveAttribute(
            'title',
            'Zoom to the current Select 1 residue selection (Residue 1).'
        );
        expect(document.getElementById('test-viewer-a-highlight-residue-btn')).toHaveAttribute(
            'title',
            'Select 1 residue highlight is Off. Click to turn it On.'
        );
        expect(document.getElementById('test-viewer-a-inspect-residue-btn')).toHaveAttribute(
            'title',
            'Select 1 residue inspect is Off. Click to turn it On.'
        );
        expect(screen.getAllByText('ALA (2)').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('GLY (1)').length).toBeGreaterThanOrEqual(1);

        fireEvent.click(document.getElementById('test-viewer-a-residue-select-all-btn') as HTMLButtonElement);
        expect(onSelectResidueIds).toHaveBeenLastCalledWith(['1', '2', '3']);

        fireEvent.click(document.getElementById('test-viewer-a-residue-invert-selection-btn') as HTMLButtonElement);
        expect(onSelectResidueIds).toHaveBeenLastCalledWith(['2', '3']);

        fireEvent.click(document.getElementById('test-viewer-a-residue-select-common-btn') as HTMLButtonElement);
        expect(onSelectResidueIds).toHaveBeenLastCalledWith(['2', '3']);

        fireEvent.click(document.getElementById('test-viewer-a-residue-type-toggle-ALA-btn') as HTMLButtonElement);
        expect(onSelectResidueIds).toHaveBeenLastCalledWith(['1', '2']);
    });

    it('supports independent chain-2 controls and combined zoom', () => {
        const onSelectChainId2 = vi.fn();
        const onChainZoom2 = vi.fn();
        const onCombinedSelectionZoom = vi.fn();
        const onShowUniprotAccessionInChainLabelsChange = vi.fn();
        const onSelectResidueIds2 = vi.fn();
        const onResidueZoom2 = vi.fn();

        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                selectedChainId2="B"
                onSelectChainId2={onSelectChainId2}
                onChainZoom2={onChainZoom2}
                chainZoomLabel2="Chain B"
                chainZoomDisabled2={false}
                onCombinedSelectionZoom={onCombinedSelectionZoom}
                combinedSelectionZoomDisabled={false}
                onShowUniprotAccessionInChainLabelsChange={onShowUniprotAccessionInChainLabelsChange}
                residueInfo2={{
                    residueLabels: new Map([
                        ['10', { id: '10', name: 'Residue 10', compId: 'GLY', seqNumber: 10, insCode: '' }],
                    ]),
                    residueToAtomIds: { '10': ['a10'] },
                }}
                selectedResidueIds2={['10']}
                onSelectResidueIds2={onSelectResidueIds2}
                residueCommonIds2={['10']}
                residueZoomLabel2="Residue 10"
                onResidueZoom2={onResidueZoom2}
                residueZoomDisabled2={false}
            />
        );

        fireEvent.click(screen.getByText('Show Chain Controls'));
        expect(document.getElementById('test-viewer-a-zoom-combined-selection-btn')).toHaveAttribute(
            'title',
            'Zoom to the current combined selection across selected chains.'
        );
        expect(document.getElementById('test-viewer-a-highlight-combined-selection-btn')).toHaveAttribute(
            'title',
            'Disabled until combined-selection highlighting is available.'
        );
        expect(document.getElementById('test-viewer-a-inspect-combined-selection-btn')).toHaveAttribute(
            'title',
            'Disabled until combined-selection inspection is available.'
        );
        expect(document.getElementById('test-viewer-a-show-uniprot-accession')).toHaveAttribute(
            'title',
            'UniProt accessions in chain labels are On. Click to turn them Off.'
        );
        fireEvent.click(screen.getByText('Show Select 2'));
        expect(document.getElementById('test-viewer-a-chain2-chain-table-search')).toHaveAttribute(
            'title',
            'Select a chain for Select 2.'
        );
        expect(document.getElementById('test-viewer-a-zoom-chain2-btn')).toHaveAttribute(
            'title',
            'Zoom to the current Select 2 chain selection (Chain B).'
        );
        expect(document.getElementById('test-viewer-a-highlight-chain2-btn')).toHaveAttribute(
            'title',
            'Disabled until Select 2 chain highlighting is available.'
        );
        expect(document.getElementById('test-viewer-a-inspect-chain2-btn')).toHaveAttribute(
            'title',
            'Disabled until Select 2 chain inspection is available.'
        );
        fireEvent.click(document.querySelector('[data-testid="test-viewer-a-chain2-chain-table-row-B"]') as HTMLTableRowElement);
        expect(onSelectChainId2).toHaveBeenCalledWith('B');

        fireEvent.click(document.getElementById('test-viewer-a-zoom-chain2-btn') as HTMLButtonElement);
        expect(onChainZoom2).toHaveBeenCalled();

        fireEvent.click(document.getElementById('test-viewer-a-zoom-combined-selection-btn') as HTMLButtonElement);
        expect(onCombinedSelectionZoom).toHaveBeenCalled();

        fireEvent.click(screen.getAllByText('Show Residue Controls')[0]);
        fireEvent.click(document.getElementById('test-viewer-a-zoom-residue2-btn') as HTMLButtonElement);
        expect(onResidueZoom2).toHaveBeenCalled();

        fireEvent.click(document.getElementById('test-viewer-a-residue2-select-common-btn') as HTMLButtonElement);
        expect(onSelectResidueIds2).toHaveBeenCalled();
    });

    it('explains disabled Select Shared tooltips for Select 1 and Select 2', () => {
        render(
            <LoadDataRow
                {...baseProps}
                isLoaded={true}
                selectedChainId="A"
                selectedChainId2="B"
                residueCommonIds={[]}
                residueCommonIds2={[]}
                residueInfo={{
                    residueLabels: new Map([
                        ['1', { id: '1', name: 'ALA 1', compId: 'ALA', seqNumber: 1, insCode: '' }],
                    ]),
                    residueToAtomIds: { '1': ['a1'] },
                }}
                residueInfo2={{
                    residueLabels: new Map([
                        ['10', { id: '10', name: 'GLY 10', compId: 'GLY', seqNumber: 10, insCode: '' }],
                    ]),
                    residueToAtomIds: { '10': ['a10'] },
                }}
                selectedResidueIds2={['10']}
                onSelectResidueIds2={vi.fn()}
            />
        );

        fireEvent.click(screen.getByText('Show Chain Controls'));
        fireEvent.click(screen.getByText('Show Select 1'));
        fireEvent.click(screen.getByText('Show Residue Controls'));
        expect(document.getElementById('test-viewer-a-residue-select-common-btn')).toHaveAttribute(
            'title',
            'Disabled until matching chains are selected in both AlignedTo and Aligned views and shared residues are available for Select 1.'
        );

        fireEvent.click(screen.getByText('Show Select 2'));
        fireEvent.click(screen.getAllByText('Show Residue Controls')[0]);
        expect(document.getElementById('test-viewer-a-residue2-select-common-btn')).toHaveAttribute(
            'title',
            'Disabled until matching chains are selected in both AlignedTo and Aligned views and shared residues are available for Select 2.'
        );
    });
});
