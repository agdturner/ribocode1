/**
 * Test suite for Molecule component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';import { render, screen, fireEvent } from '@testing-library/react';
import MoleculeUI, { idSuffix as moleculeIdSuffix } from './Molecule';

describe('MoleculeUI', () => {
    const mockPlugin = {} as any;
    const baseProps = {
        label: 'Test Molecule',
        plugin: mockPlugin,
        isVisible: true,
        onToggleVisibility: vi.fn(),
        chainZoomLabel: 'A',
        onChainZoom: vi.fn(),
        chainZoomDisabled: false,
        residueZoomLabel: '10',
        onResidueZoom: vi.fn(),
        residueZoomDisabled: false,
        isLoaded: true,
        forceUpdate: vi.fn(),
        representationRefs: [],
    };


    it('applies idPrefix to root div', () => {
        const { container } = render(
            <MoleculeUI
                {...baseProps}
                label="TestMol"
                idPrefix="test-prefix"
            />
        );
        const root = container.querySelector(`#test-prefix-${moleculeIdSuffix}-testmol`);
        expect(root).toBeInTheDocument();
    });

    it('calls onToggleVisibility when visibility button is clicked', () => {
        render(<MoleculeUI {...baseProps} />);
        fireEvent.click(screen.getByLabelText('Hide Test Molecule'));
        expect(baseProps.onToggleVisibility).toHaveBeenCalled();
    });

    it('does not render zoom controls in MoleculeUI', () => {
        render(<MoleculeUI {...baseProps} />);
        expect(screen.queryByText(/Zoom to Subunit:/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Zoom to Chain:/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/Zoom to Residue:/i)).not.toBeInTheDocument();
    });

    it('renders and calls onRemove if provided', () => {
        const onRemove = vi.fn();
        render(<MoleculeUI {...baseProps} onRemove={onRemove} />);
        fireEvent.click(screen.getByLabelText('Remove Test Molecule'));
        expect(onRemove).toHaveBeenCalled();
    });

    it('passes representation ref to onToggleRepVisibility', () => {
        const onToggleRepVisibility = vi.fn();
        const repRef = 'rep-ref-1';
        const pluginWithRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: { values: { type: { name: 'spacefill' }, _ribocodeId: 'custom-id-1' } },
                            state: { isHidden: false }
                        }]
                    ])
                }
            }
        } as any;

        render(
            <MoleculeUI
                {...baseProps}
                plugin={pluginWithRep}
                representationRefs={[repRef]}
                onToggleRepVisibility={onToggleRepVisibility}
            />
        );

        fireEvent.click(screen.getByLabelText('Toggle visibility for spacefill representation'));
        expect(onToggleRepVisibility).toHaveBeenCalledWith(repRef);
    });

    it('renders representation controls in the same top row as main visibility control', () => {
        const repRef = 'rep-ref-2';
        const pluginWithRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: { values: { type: { name: 'cartoon' }, _ribocodeId: 'custom-id-2' } },
                            state: { isHidden: false }
                        }]
                    ])
                }
            }
        } as any;

        const { container } = render(
            <MoleculeUI
                {...baseProps}
                plugin={pluginWithRep}
                representationRefs={[repRef]}
            />
        );

        const topRow = container.querySelector('.molecule-top-row');
        expect(topRow).toBeInTheDocument();
        expect(topRow?.querySelector('.molecule-visibility-btn')).toBeInTheDocument();
        expect(topRow?.querySelector('.rep-controls')).toBeInTheDocument();
        expect(topRow?.querySelector('.rep-btn-group')).toBeInTheDocument();
    });
});
