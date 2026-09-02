/**
 * Test suite for ResidueSelectButton component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-06-22
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ResidueSelectButton from './Residue';
import { ResidueLabelInfo } from 'src/utils/residue';

describe('ResidueSelectButton', () => {
    const residueLabels = new Map<string, ResidueLabelInfo>([
        ['10', { id: '10', name: 'GLY 10', compId: 'GLY', seqNumber: 10, insCode: '' }],
        ['20', { id: '20', name: 'ALA 20', compId: 'ALA', seqNumber: 20, insCode: '' }],
        ['30', { id: '30', name: 'SER 30', compId: 'SER', seqNumber: 30, insCode: '' }],
    ]);

    it('renders with default label and option display names', () => {
        const { getByLabelText, getByText } = render(
            <ResidueSelectButton
                disabled={false}
                residueLabels={residueLabels}
                selectedResidueIds={[]}
                onSelect={() => {}}
                id="test-residue-select"
            />
        );
        expect(getByLabelText('Select Residues')).toBeInTheDocument();
        expect(getByText('GLY 10')).toBeInTheDocument();
        expect(getByText('ALA 20')).toBeInTheDocument();
        expect(getByText('SER 30')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
        const { getByLabelText } = render(
            <ResidueSelectButton
                disabled={false}
                residueLabels={residueLabels}
                selectedResidueIds={[]}
                onSelect={() => {}}
                label="Pick Residue"
                id="custom-residue-select"
            />
        );
        expect(getByLabelText('Pick Residue')).toBeInTheDocument();
    });

    it('shows selected residues by ID (not by name string)', () => {
        const { getByLabelText } = render(
            <ResidueSelectButton
                disabled={false}
                residueLabels={residueLabels}
                selectedResidueIds={['20', '30']}
                onSelect={() => {}}
                id="select-residue-test"
            />
        );
        const select = getByLabelText('Select Residues') as HTMLSelectElement;
        const selected = Array.from(select.selectedOptions).map(o => o.value);
        expect(selected).toEqual(['20', '30']);
    });

    it('calls onSelect with residueIds when options are chosen', () => {
        const onSelect = vi.fn();
        const { getByLabelText } = render(
            <ResidueSelectButton
                disabled={false}
                residueLabels={residueLabels}
                selectedResidueIds={[]}
                onSelect={onSelect}
                id="test-residue-select-onselect"
            />
        );
        const select = getByLabelText('Select Residues') as HTMLSelectElement;
        Array.from(select.options).forEach(option => {
            option.selected = option.value === '20' || option.value === '30';
        });
        fireEvent.change(select);
        expect(onSelect).toHaveBeenCalledWith(['20', '30']);
    });

    it('is disabled when disabled prop is true', () => {
        const { getByLabelText } = render(
            <ResidueSelectButton
                disabled={true}
                residueLabels={residueLabels}
                selectedResidueIds={[]}
                onSelect={() => {}}
                id="test-residue-select-disabled"
            />
        );
        expect(getByLabelText('Select Residues')).toBeDisabled();
    });

    it('renders options in ascending sequence-number order', () => {
        // Provide residues in non-sorted order to verify sorting
        const unorderedLabels = new Map<string, ResidueLabelInfo>([
            ['30', { id: '30', name: 'SER 30', compId: 'SER', seqNumber: 30, insCode: '' }],
            ['10', { id: '10', name: 'GLY 10', compId: 'GLY', seqNumber: 10, insCode: '' }],
            ['20', { id: '20', name: 'ALA 20', compId: 'ALA', seqNumber: 20, insCode: '' }],
        ]);
        const { getAllByRole } = render(
            <ResidueSelectButton
                disabled={false}
                residueLabels={unorderedLabels}
                selectedResidueIds={[]}
                onSelect={() => {}}
                id="residue-order-test"
            />
        );
        const options = getAllByRole('option');
        expect(options.map(o => (o as HTMLOptionElement).value)).toEqual(['10', '20', '30']);
    });

    it('uses insertion code as secondary sort key', () => {
        const labelsWithInsCode = new Map<string, ResidueLabelInfo>([
            ['70B', { id: '70B', name: 'LEU 70B', compId: 'LEU', seqNumber: 70, insCode: 'B' }],
            ['70',  { id: '70',  name: 'LEU 70',  compId: 'LEU', seqNumber: 70, insCode: '' }],
            ['70A', { id: '70A', name: 'LEU 70A', compId: 'LEU', seqNumber: 70, insCode: 'A' }],
        ]);
        const { getAllByRole } = render(
            <ResidueSelectButton
                disabled={false}
                residueLabels={labelsWithInsCode}
                selectedResidueIds={[]}
                onSelect={() => {}}
                id="residue-inscode-test"
            />
        );
        const options = getAllByRole('option');
        expect(options.map(o => (o as HTMLOptionElement).value)).toEqual(['70', '70A', '70B']);
    });

    it('the select id matches the provided id prop', () => {
        const { getByLabelText } = render(
            <ResidueSelectButton
                disabled={false}
                residueLabels={residueLabels}
                selectedResidueIds={[]}
                onSelect={() => {}}
                id="my-residue-id"
            />
        );
        expect((getByLabelText('Select Residues') as HTMLSelectElement).id).toBe('my-residue-id');
    });
});

