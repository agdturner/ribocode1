/**
 * Test suite for getResidueInfo utility.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { getResidueInfo } from './residue';

describe('getResidueInfo', () => {
    let originalWarn: any;
    let originalInfo: any;
    beforeAll(() => {
        originalWarn = console.warn;
        originalInfo = console.info;
        console.warn = vi.fn();
        console.info = vi.fn();
    });
    afterAll(() => {
        console.warn = originalWarn;
        console.info = originalInfo;
    });

    it('returns empty maps and warns if no units', () => {
        const structure = { units: [] };
        const result = getResidueInfo(structure, 'A');
        expect(result.residueLabels.size).toBe(0);
        expect(Object.keys(result.residueToAtomIds).length).toBe(0);
        expect(console.warn).toHaveBeenCalledWith('No units found in structure.');
    });

    it('returns empty maps and warns if no atomic unit with model', () => {
        const structure = { units: [{ kind: 1 }] };
        const result = getResidueInfo(structure, 'A');
        expect(result.residueLabels.size).toBe(0);
        expect(Object.keys(result.residueToAtomIds).length).toBe(0);
        expect(console.warn).toHaveBeenCalledWith('No atomic unit with model found in molecule.units.');
    });

    it('returns empty maps and warns if chainId not found', () => {
        const structure = {
            units: [{ kind: 0, model: { atomicHierarchy: { chains: { auth_asym_id: { value: (i: number) => 'B' }, _rowCount: 1 }, residues: {} } } }]
        };
        const result = getResidueInfo(structure, 'A');
        expect(result.residueLabels.size).toBe(0);
        expect(Object.keys(result.residueToAtomIds).length).toBe(0);
        expect(console.warn).toHaveBeenCalledWith('Chain ID not found in model.atomicHierarchy.chains:', 'A');
    });

    it('extracts residue info for valid structure', () => {
        // The chainIndex for atomIdx 5 must match the chainIdx found for chainId 'A' (which is 0)
        const structure = {
            units: [
                {
                    kind: 0,
                    model: {
                        atomicHierarchy: {
                            chains: {
                                auth_asym_id: { value: (i: number) => ['A'][i] },
                                _rowCount: 1
                            },
                            residues: {
                                auth_seq_id: { value: (i: number) => [10][i] },
                                label_comp_id: { value: (i: number) => ['GLY'][i] },
                                label_seq_id: { value: (i: number) => [10][i] },
                                auth_comp_id: { value: (i: number) => ['GLY'][i] },
                                group_PDB: { value: (i: number) => ['GLY'][i] },
                                pdbx_PDB_ins_code: { value: (i: number) => [''][i] }
                            }
                        }
                    },
                    chainIndex: { 5: 0 }, // atomIdx 5 belongs to chainIdx 0
                    residueIndex: { 5: 0 },
                    elements: [5]
                }
            ]
        };
        const result = getResidueInfo(structure, 'A');
        expect(result.residueLabels.size).toBe(1);
        const labelInfo = result.residueLabels.get('10');
        expect(labelInfo).toEqual({
            id: '10',
            name: '10 GLY',
            compId: 'GLY',
            seqNumber: 10,
            insCode: ''
        });
        expect(result.residueToAtomIds['10']).toEqual(['5']);
    });

    it('formats RNA residues as one-letter code plus residue number', () => {
        const structure = {
            units: [
                {
                    kind: 0,
                    model: {
                        atomicHierarchy: {
                            chains: {
                                auth_asym_id: { value: (i: number) => ['R'][i] },
                                _rowCount: 1
                            },
                            residues: {
                                auth_seq_id: { value: (i: number) => [12][i] },
                                label_comp_id: { value: (i: number) => ['A'][i] },
                                label_seq_id: { value: (i: number) => [12][i] },
                                auth_comp_id: { value: (i: number) => ['A'][i] },
                                group_PDB: { value: (i: number) => ['A'][i] },
                                pdbx_PDB_ins_code: { value: (i: number) => [''][i] }
                            }
                        }
                    },
                    chainIndex: { 9: 0 },
                    residueIndex: { 9: 0 },
                    elements: [9]
                }
            ]
        };
        const result = getResidueInfo(structure, 'R');
        const labelInfo = result.residueLabels.get('12');
        expect(labelInfo?.name).toBe('12 A');
    });

    it('maps canonical three-letter RNA residue names to one-letter labels', () => {
        const structure = {
            units: [
                {
                    kind: 0,
                    model: {
                        atomicHierarchy: {
                            chains: {
                                auth_asym_id: { value: (i: number) => ['R'][i] },
                                _rowCount: 1
                            },
                            residues: {
                                auth_seq_id: { value: (i: number) => [15][i] },
                                label_comp_id: { value: (i: number) => ['ADE'][i] },
                                label_seq_id: { value: (i: number) => [15][i] },
                                auth_comp_id: { value: (i: number) => ['ADE'][i] },
                                group_PDB: { value: (i: number) => ['ADE'][i] },
                                pdbx_PDB_ins_code: { value: (i: number) => [''][i] }
                            }
                        }
                    },
                    chainIndex: { 11: 0 },
                    residueIndex: { 11: 0 },
                    elements: [11]
                }
            ]
        };
        const result = getResidueInfo(structure, 'R');
        expect(result.residueLabels.get('15')?.name).toBe('15 A');
    });

    it('does not truncate ATOM token and falls back to atom-level comp_id', () => {
        const structure = {
            units: [
                {
                    kind: 0,
                    model: {
                        atomicHierarchy: {
                            chains: {
                                auth_asym_id: { value: (i: number) => ['A'][i] },
                                _rowCount: 1
                            },
                            residues: {
                                auth_seq_id: { value: (i: number) => [42][i] },
                                label_comp_id: { value: (i: number) => [''][i] },
                                label_seq_id: { value: (i: number) => [42][i] },
                                auth_comp_id: { value: (i: number) => [''][i] },
                                group_PDB: { value: (i: number) => ['ATOM'][i] },
                                pdbx_PDB_ins_code: { value: (i: number) => [''][i] }
                            },
                            atoms: {
                                label_comp_id: { value: (i: number) => ['GLY'][i] },
                                auth_comp_id: { value: (i: number) => ['GLY'][i] }
                            }
                        }
                    },
                    chainIndex: { 3: 0 },
                    residueIndex: { 3: 0 },
                    elements: [3]
                }
            ]
        };
        const result = getResidueInfo(structure, 'A');
        expect(result.residueLabels.get('42')?.name).toBe('42 GLY');
        expect(result.residueLabels.get('42')?.compId).toBe('GLY');
    });
});
