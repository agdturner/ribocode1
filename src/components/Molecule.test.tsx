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
import { vi } from 'vitest';import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

    it('renders representation controls in an indented row below the main visibility control', () => {
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
        expect(topRow?.querySelector('.rep-controls')).not.toBeInTheDocument();

        const repRow = container.querySelector('.rep-controls-row');
        expect(repRow).toBeInTheDocument();
        expect(repRow?.querySelector('.rep-btn-group-row')).toBeInTheDocument();
    });

    it('updates representation opacity when slider is changed', () => {
        const repRef = 'rep-ref-3';
        const update = vi.fn(() => ({ kind: 'mock-tree-update' }));
        const to = vi.fn(() => ({ update }));
        const build = vi.fn(() => ({ to }));
        const updateTree = vi.fn(() => ({ kind: 'mock-tree-commit' }));
        const runTask = vi.fn(async () => undefined);

        const pluginWithRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: {
                                values: {
                                    type: { name: 'cartoon', params: { alpha: 1 } },
                                    _ribocodeId: 'custom-id-3'
                                }
                            },
                            state: { isHidden: false }
                        }]
                    ]),
                    build,
                    updateTree,
                }
            },
            runTask,
            canvas3d: {
                requestDraw: vi.fn(),
            },
        } as any;

        render(
            <MoleculeUI
                {...baseProps}
                plugin={pluginWithRep}
                representationRefs={[repRef]}
                idPrefix="viewer-column-A-aligned"
            />
        );

        const slider = document.getElementById('viewer-column-A-aligned-rep-opacity-custom-id-3') as HTMLInputElement | null;
        expect(slider).toBeInTheDocument();
        fireEvent.change(slider!, { target: { value: '0.35' } });

        expect(build).toHaveBeenCalled();
        expect(to).toHaveBeenCalledWith(repRef);
        expect(update).toHaveBeenCalledTimes(1);
        expect(runTask).toHaveBeenCalledWith({ kind: 'mock-tree-commit' });
    });

    it('shows general visibility as visible when dataset is visible even if all representations are hidden', () => {
        const repRef = 'rep-ref-hidden';
        const pluginWithHiddenRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: { values: { type: { name: 'cartoon' }, _ribocodeId: 'rep-hidden' } },
                            state: { isHidden: true }
                        }]
                    ])
                }
            }
        } as any;

        render(
            <MoleculeUI
                {...baseProps}
                plugin={pluginWithHiddenRep}
                isVisible={true}
                representationRefs={[repRef]}
            />
        );

        expect(screen.getByLabelText('Hide Test Molecule')).toBeInTheDocument();
    });

    it('general visibility toggle sets all representations visible when all are hidden', async () => {
        const repA = 'rep-a-hidden';
        const repB = 'rep-b-hidden';

        const onToggleRepVisibility = vi.fn((ref: string) => {
            const cell = pluginWithHiddenReps.state.data.cells.get(ref);
            if (cell) cell.state.isHidden = !cell.state.isHidden;
        });

        const pluginWithHiddenReps = {
            state: {
                data: {
                    cells: new Map([
                        [repA, { params: { values: { type: { name: 'cartoon' } } }, state: { isHidden: true } }],
                        [repB, { params: { values: { type: { name: 'spacefill' } } }, state: { isHidden: true } }],
                    ])
                }
            },
            canvas3d: { requestDraw: vi.fn() },
        } as any;

        render(
            <MoleculeUI
                {...baseProps}
                plugin={pluginWithHiddenReps}
                isVisible={true}
                representationRefs={[repA, repB]}
                onToggleRepVisibility={onToggleRepVisibility}
            />
        );

        fireEvent.click(screen.getByLabelText('Hide Test Molecule'));

        await waitFor(() => {
            expect(onToggleRepVisibility).toHaveBeenCalledTimes(2);
        });
    });

    it('switching Theme Type to Residue applies the stored residue theme for the representation', () => {
        const repRef = 'rep-ref-theme-switch';
        const onRepresentationChainThemeChange = vi.fn();
        const onRepresentationResidueThemeChange = vi.fn();
        const pluginWithRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: {
                                values: {
                                    type: { name: 'cartoon' },
                                    _ribocodeId: 'custom-id-theme-switch',
                                    _ribocodeChainTheme: 'Aligned-chain-theme',
                                    _ribocodeResidueTheme: 'Aligned-residue-theme',
                                    _ribocodeActiveThemeKind: 'chain',
                                    colorTheme: { name: 'Aligned-chain-theme', params: {} },
                                }
                            },
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
                idPrefix="viewer-column-A-alignedto"
                chainThemeOptions={[
                    { value: 'Aligned-chain-theme', label: 'Aligned chain theme' },
                ]}
                residueThemeOptions={[
                    { value: 'Aligned-residue-theme', label: 'Aligned residue theme' },
                ]}
                onRepresentationChainThemeChange={onRepresentationChainThemeChange}
                onRepresentationResidueThemeChange={onRepresentationResidueThemeChange}
            />
        );

        const themeTypeSelect = document.getElementById('viewer-column-A-alignedto-rep-theme-kind-custom-id-theme-switch') as HTMLSelectElement | null;
        expect(themeTypeSelect).toBeInTheDocument();
        fireEvent.change(themeTypeSelect!, { target: { value: 'residue-type' } });

        expect(themeTypeSelect?.value).toBe('residue-type');
        expect(onRepresentationResidueThemeChange).toHaveBeenCalledWith(repRef, 'Aligned-residue-theme');
        expect(onRepresentationChainThemeChange).not.toHaveBeenCalled();
    });

    it('shows applied residue theme name in selector when residue theme field is missing', () => {
        const repRef = 'rep-ref-residue-label';
        const pluginWithRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: {
                                values: {
                                    type: { name: 'cartoon' },
                                    _ribocodeId: 'custom-id-residue-label',
                                    _ribocodeChainTheme: 'Aligned-chain-theme',
                                    _ribocodeActiveThemeKind: 'residue-type',
                                    colorTheme: { name: 'Aligned-residue-theme-2', params: {} },
                                }
                            },
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
                idPrefix="viewer-column-A-alignedto"
                chainThemeOptions={[
                    { value: 'Aligned-chain-theme', label: 'Aligned chain theme' },
                ]}
                residueThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'Aligned-residue-theme-2', label: 'Aligned residue theme 2' },
                ]}
            />
        );

        const residueThemeSelect = document.getElementById('viewer-column-A-alignedto-rep-residue-theme-custom-id-residue-label') as HTMLSelectElement | null;
        expect(residueThemeSelect).toBeInTheDocument();
        expect(residueThemeSelect?.value).toBe('Aligned-residue-theme-2');
    });

    it('infers Theme Type as Residue when active kind metadata is missing but applied theme is residue-based', () => {
        const repRef = 'rep-ref-missing-kind';
        const pluginWithRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: {
                                values: {
                                    type: { name: 'cartoon' },
                                    _ribocodeId: 'custom-id-missing-kind',
                                    colorTheme: { name: 'Aligned-residue-theme-3', params: {} },
                                }
                            },
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
                idPrefix="viewer-column-A-alignedto"
                chainThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'Aligned-chain-theme', label: 'Aligned chain theme' },
                ]}
                residueThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'Aligned-residue-theme-3', label: 'Aligned residue theme 3' },
                ]}
            />
        );

        const themeTypeSelect = document.getElementById('viewer-column-A-alignedto-rep-theme-kind-custom-id-missing-kind') as HTMLSelectElement | null;
        expect(themeTypeSelect).toBeInTheDocument();
        expect(themeTypeSelect?.value).toBe('residue-type');

        const residueThemeSelect = document.getElementById('viewer-column-A-alignedto-rep-residue-theme-custom-id-missing-kind') as HTMLSelectElement | null;
        expect(residueThemeSelect).toBeInTheDocument();
        expect(residueThemeSelect?.value).toBe('Aligned-residue-theme-3');
    });

    it('switching Theme Type to Residue uses currently applied residue theme when residue metadata is missing', () => {
        const repRef = 'rep-ref-residue-switch-missing-meta';
        const onRepresentationResidueThemeChange = vi.fn();
        const pluginWithRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: {
                                values: {
                                    type: { name: 'cartoon' },
                                    _ribocodeId: 'custom-id-residue-switch-missing-meta',
                                    colorTheme: { name: 'Aligned-residue-theme-4', params: {} },
                                }
                            },
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
                idPrefix="viewer-column-A-aligned"
                chainThemeOptions={[
                    { value: 'default', label: 'Default' },
                ]}
                residueThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'Aligned-residue-theme-4', label: 'Aligned residue theme 4' },
                ]}
                onRepresentationResidueThemeChange={onRepresentationResidueThemeChange}
            />
        );

        const themeTypeSelect = document.getElementById('viewer-column-A-aligned-rep-theme-kind-custom-id-residue-switch-missing-meta') as HTMLSelectElement | null;
        expect(themeTypeSelect).toBeInTheDocument();
        fireEvent.change(themeTypeSelect!, { target: { value: 'residue-type' } });

        expect(onRepresentationResidueThemeChange).toHaveBeenCalledWith(repRef, 'Aligned-residue-theme-4');
    });

    it('does not include residue themes in chain selector after switching back to chain', () => {
        const repRef = 'rep-ref-no-theme-mixing';
        const pluginWithRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: {
                                values: {
                                    type: { name: 'cartoon' },
                                    _ribocodeId: 'custom-id-no-theme-mixing',
                                    _ribocodeActiveThemeKind: 'chain',
                                    colorTheme: { name: 'Aligned-residue-theme-1', params: {} },
                                }
                            },
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
                idPrefix="viewer-column-A-alignedto"
                chainThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'Aligned-chain-theme-1', label: 'Aligned chain theme 1' },
                ]}
                residueThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'Aligned-residue-theme-1', label: 'Aligned residue theme 1' },
                ]}
            />
        );

        const chainThemeSelect = document.querySelector('select[id*="rep-chain-theme-"]') as HTMLSelectElement | null;
        expect(chainThemeSelect).toBeInTheDocument();
        expect(chainThemeSelect?.value).toBe('default');

        const optionValues = Array.from(chainThemeSelect?.options ?? []).map(option => option.value);
        expect(optionValues).toContain('default');
        expect(optionValues).toContain('Aligned-chain-theme-1');
        expect(optionValues).not.toContain('Aligned-residue-theme-1');
    });

    it('switching Theme Type to Residue after custom chain theme does not reuse chain theme name', () => {
        const repRef = 'rep-ref-chain-to-residue-fallback';
        const onRepresentationResidueThemeChange = vi.fn();
        const pluginWithRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: {
                                values: {
                                    type: { name: 'cartoon' },
                                    _ribocodeId: 'custom-id-chain-to-residue-fallback',
                                    _ribocodeActiveThemeKind: 'chain',
                                    colorTheme: { name: 'Aligned-chain-theme-new', params: {} },
                                }
                            },
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
                idPrefix="viewer-column-A-alignedto"
                chainThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'Aligned-chain-theme-new', label: 'Aligned chain theme new' },
                ]}
                residueThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'Aligned-residue-theme-1', label: 'Aligned residue theme 1' },
                ]}
                onRepresentationResidueThemeChange={onRepresentationResidueThemeChange}
            />
        );

        const themeTypeSelect = document.querySelector('select[id*="rep-theme-kind-"]') as HTMLSelectElement | null;
        expect(themeTypeSelect).toBeInTheDocument();
        fireEvent.change(themeTypeSelect!, { target: { value: 'residue-type' } });

        expect(onRepresentationResidueThemeChange).toHaveBeenCalledWith(repRef, 'default');
        expect(onRepresentationResidueThemeChange).not.toHaveBeenCalledWith(repRef, 'Aligned-chain-theme-new');
    });

    it('switching Theme Type to Residue ignores invalid persisted residue theme that points to a chain theme', () => {
        const repRef = 'rep-ref-invalid-persisted-residue-theme';
        const onRepresentationResidueThemeChange = vi.fn();
        const pluginWithRep = {
            state: {
                data: {
                    cells: new Map([
                        [repRef, {
                            params: {
                                values: {
                                    type: { name: 'cartoon' },
                                    _ribocodeId: 'custom-id-invalid-persisted-residue-theme',
                                    _ribocodeActiveThemeKind: 'chain',
                                    _ribocodeResidueTheme: 'Aligned-chain-theme-new',
                                    colorTheme: { name: 'Aligned-chain-theme-new', params: {} },
                                }
                            },
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
                idPrefix="viewer-column-A-alignedto"
                chainThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'Aligned-chain-theme-new', label: 'Aligned chain theme new' },
                ]}
                residueThemeOptions={[
                    { value: 'default', label: 'Default' },
                    { value: 'Aligned-residue-theme-1', label: 'Aligned residue theme 1' },
                ]}
                onRepresentationResidueThemeChange={onRepresentationResidueThemeChange}
            />
        );

        const themeTypeSelect = document.querySelector('select[id*="rep-theme-kind-"]') as HTMLSelectElement | null;
        expect(themeTypeSelect).toBeInTheDocument();
        fireEvent.change(themeTypeSelect!, { target: { value: 'residue-type' } });

        expect(onRepresentationResidueThemeChange).toHaveBeenCalledWith(repRef, 'default');
        expect(onRepresentationResidueThemeChange).not.toHaveBeenCalledWith(repRef, 'Aligned-chain-theme-new');
    });
});
