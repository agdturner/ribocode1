/**
 * Test suite for getAtomDataFromStructureUnits utility.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-11-23
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import * as dataUtils from './data';

describe('data.ts utility functions', () => {
    let originalLog: any;
    beforeAll(() => {
        originalLog = console.log;
        console.log = vi.fn();
    });
    afterAll(() => {
        console.log = originalLog;
    });

    describe('getAtomDataFromStructureUnits', () => {
        it('distinguishes author IDs by case and prioritizes them over label aliases', () => {
            const structure = {
                units: [{
                    kind: 0,
                    model: {
                        atomicHierarchy: {
                            atoms: { type_symbol: { value: () => 'C' } },
                            chains: {
                                _rowCount: 3,
                                auth_asym_id: { value: (i: number) => ['E', 'e', 'G'][i] },
                                label_asym_id: { value: (i: number) => ['X', 'G', 'Y'][i] },
                            },
                            chainAtomSegments: { index: [0, 0, 1, 2] },
                            residueAtomSegments: { index: [0, 1, 2, 3] },
                        },
                        atomicConformation: { x: [1, 2, 3, 4], y: [0, 0, 0, 0], z: [0, 0, 0, 0] },
                    },
                    elements: [0, 1, 2, 3],
                }],
            };
            expect(dataUtils.getAtomDataFromStructureUnits(structure, 'E').xs).toEqual([1, 2]);
            expect(dataUtils.getAtomDataFromStructureUnits(structure, 'e').xs).toEqual([3]);
            expect(dataUtils.getAtomDataFromStructureUnits(structure, 'G').xs).toEqual([4]);
            expect(dataUtils.getAtomDataFromStructureUnits(structure, 'X').xs).toEqual([1, 2]);
        });

        it('returns empty arrays for undefined structure', () => {
            const result = dataUtils.getAtomDataFromStructureUnits(undefined);
            expect(result).toEqual({ symbolTypes: [], chainIds: [], xs: [], ys: [], zs: [] });
        });

        it('rejects a placeholder chain filter instead of returning all atoms', () => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const result = dataUtils.getAtomDataFromStructureUnits({ units: [{}] }, '.');
            expect(result.xs).toEqual([]);
            expect(warn).toHaveBeenCalledWith('[getAtomDataFromStructureUnits] Invalid chain ID:', '.');
            warn.mockRestore();
        });

        it('extracts atom data from mock structure', () => {
            const mockStructure = {
                data: {
                    units: [
                        {
                            kind: 0,
                            model: {
                                atomicHierarchy: {
                                    atoms: {
                                        type_symbol: { value: (i: number) => ['C', 'N'][i] }
                                    },
                                    chains: {
                                        auth_asym_id: { value: (i: number) => ['A', 'B'][i] },
                                        _rowCount: 2
                                    }
                                },
                                atomicConformation: {
                                    x: [1, 2],
                                    y: [3, 4],
                                    z: [5, 6]
                                }
                            },
                            elements: [0, 1],
                            chainIndex: [0, 1]
                        }
                    ]
                }
            };
            const result = dataUtils.getAtomDataFromStructureUnits(mockStructure);
            expect(result.symbolTypes).toEqual(['C', 'N']);
            expect(result.chainIds).toEqual(['A', 'B']);
            expect(result.xs).toEqual([1, 2]);
            expect(result.ys).toEqual([3, 4]);
            expect(result.zs).toEqual([5, 6]);
        });

        it('filters chain using unit-local chainIndex ordering', () => {
            const mockStructure = {
                units: [
                    {
                        kind: 0,
                        model: {
                            atomicHierarchy: {
                                atoms: {
                                    type_symbol: { value: (i: number) => ['C', 'N'][i] }
                                },
                                chains: {
                                    auth_asym_id: { value: (i: number) => ['A', 'B'][i] },
                                    _rowCount: 2
                                }
                            },
                            atomicConformation: {
                                x: [11, 22],
                                y: [33, 44],
                                z: [55, 66]
                            }
                        },
                        elements: [0, 1],
                        chainIndex: [1, 0],
                    }
                ]
            };

            const result = dataUtils.getAtomDataFromStructureUnits(mockStructure, 'A');
            expect(result.symbolTypes).toEqual(['N']);
            expect(result.chainIds).toEqual(['A']);
            expect(result.xs).toEqual([22]);
            expect(result.ys).toEqual([44]);
            expect(result.zs).toEqual([66]);
        });

        it('matches chain filter case-insensitively by auth or label ID', () => {
            const mockStructure = {
                units: [
                    {
                        kind: 0,
                        model: {
                            atomicHierarchy: {
                                atoms: {
                                    type_symbol: { value: (i: number) => ['C', 'N'][i] }
                                },
                                chains: {
                                    auth_asym_id: { value: (i: number) => ['CU', 'DX'][i] },
                                    label_asym_id: { value: (i: number) => ['XB', 'YB'][i] },
                                    _rowCount: 2
                                },
                                residueAtomSegments: {
                                    index: [0, 1]
                                },
                                chainAtomSegments: {
                                    index: [0, 1]
                                }
                            },
                            atomicConformation: {
                                x: [101, 202],
                                y: [303, 404],
                                z: [505, 606]
                            }
                        },
                        elements: [0, 1],
                    }
                ]
            };

            const byLowerAuth = dataUtils.getAtomDataFromStructureUnits(mockStructure, 'cu');
            expect(byLowerAuth.xs).toEqual([101]);
            expect(byLowerAuth.chainIds).toEqual(['CU']);

            const byLabel = dataUtils.getAtomDataFromStructureUnits(mockStructure, 'xb');
            expect(byLabel.xs).toEqual([101]);
            expect(byLabel.chainIds).toEqual(['CU']);
        });

        it('filters chain when unit.chainIndex is missing using segment index fallback', () => {
            const mockStructure = {
                units: [
                    {
                        kind: 0,
                        model: {
                            atomicHierarchy: {
                                atoms: {
                                    type_symbol: { value: (i: number) => ['C', 'N'][i] }
                                },
                                chains: {
                                    auth_asym_id: { value: (i: number) => ['CU', 'DX'][i] },
                                    label_asym_id: { value: (i: number) => ['XB', 'YB'][i] },
                                    _rowCount: 2
                                },
                                residueAtomSegments: {
                                    index: [0, 1]
                                },
                                chainAtomSegments: {
                                    index: [0, 1]
                                }
                            },
                            atomicConformation: {
                                x: [101, 202],
                                y: [303, 404],
                                z: [505, 606]
                            }
                        },
                        elements: [0, 1],
                    }
                ]
            };

            const byAuth = dataUtils.getAtomDataFromStructureUnits(mockStructure, 'CU');
            expect(byAuth.xs).toEqual([101]);
            expect(byAuth.chainIds).toEqual(['CU']);

            const byLabel = dataUtils.getAtomDataFromStructureUnits(mockStructure, 'XB');
            expect(byLabel.xs).toEqual([101]);
            expect(byLabel.chainIds).toEqual(['CU']);
        });

        it('falls back to label_asym_id when auth_asym_id is placeholder', () => {
            const mockStructure = {
                units: [
                    {
                        kind: 0,
                        model: {
                            atomicHierarchy: {
                                atoms: {
                                    type_symbol: { value: (i: number) => ['C', 'N'][i] }
                                },
                                chains: {
                                    auth_asym_id: { value: () => '.' },
                                    label_asym_id: { value: () => 'A' },
                                    _rowCount: 1
                                },
                                residueAtomSegments: {
                                    index: [0, 1]
                                },
                                chainAtomSegments: {
                                    index: [0, 0]
                                }
                            },
                            atomicConformation: {
                                x: [10, 20],
                                y: [30, 40],
                                z: [50, 60]
                            }
                        },
                        elements: [0, 1],
                    }
                ]
            };

            const result = dataUtils.getAtomDataFromStructureUnits(mockStructure, 'A');
            expect(result.symbolTypes).toEqual(['C', 'N']);
            expect(result.chainIds).toEqual(['A', 'A']);
            expect(result.xs).toEqual([10, 20]);
        });
    });

    describe('summarizeAtomCloud', () => {
        it('computes centroid from finite coordinates', () => {
            const summary = dataUtils.summarizeAtomCloud([0, 2, 4], [1, 3, 5], [2, 4, 6]);
            expect(summary.atomCount).toBe(3);
            expect(summary.finiteAtomCount).toBe(3);
            expect(summary.centroid).toEqual({ x: 2, y: 3, z: 4 });
        });

        it('ignores non-finite coordinates', () => {
            const summary = dataUtils.summarizeAtomCloud([1, NaN], [2, 9], [3, Infinity]);
            expect(summary.atomCount).toBe(2);
            expect(summary.finiteAtomCount).toBe(1);
            expect(summary.centroid).toEqual({ x: 1, y: 2, z: 3 });
        });
    });

    describe('updateAndLogAtomCoordinates', () => {
        it('recenters and rotates atom coordinates', () => {
            const model = {
                atomicConformation: {
                    x: [1, 2, 3],
                    y: [4, 5, 6],
                    z: [7, 8, 9]
                }
            };
            const centroid = [1, 4, 7] as any; // Vec3 type workaround for test
            const rotmat = [1,0,0, 0,1,0, 0,0,1]; // Identity
            dataUtils.updateAndLogAtomCoordinates(model, centroid, rotmat);
            expect(model.atomicConformation.x).toEqual([0, 1, 2]);
            expect(model.atomicConformation.y).toEqual([0, 1, 2]);
            expect(model.atomicConformation.z).toEqual([0, 1, 2]);
        });
    });
});
