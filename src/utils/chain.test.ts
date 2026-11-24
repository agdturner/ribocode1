/**
 * Test suite for getChainInfo utility.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-11-22
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { getChainInfo, resolveChainIndices } from './chain';
import { RpNameLookupBySpecies } from './rpNameTable';

describe('resolveChainIndices', () => {
    const chains = {
        _rowCount: 6,
        auth_asym_id: { value: (i: number) => ['E', 'e', 'G', 'AA', 'aa', '.'][i] },
        label_asym_id: { value: (i: number) => ['X', 'G', 'Y', 'U', 'V', 'Z'][i] },
    };

    it('prefers exact author IDs over exact label aliases', () => {
        expect([...resolveChainIndices(chains, 'E')]).toEqual([0]);
        expect([...resolveChainIndices(chains, 'e')]).toEqual([1]);
        expect([...resolveChainIndices(chains, 'G')]).toEqual([2]);
        expect([...resolveChainIndices(chains, 'X')]).toEqual([0]);
        expect([...resolveChainIndices(chains, 'Z')]).toEqual([5]);
    });

    it('supports unambiguous case-insensitive aliases but rejects ambiguity', () => {
        expect([...resolveChainIndices(chains, 'x')]).toEqual([0]);
        expect([...resolveChainIndices(chains, 'g')]).toEqual([2]);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect([...resolveChainIndices(chains, 'Aa')]).toEqual([]);
        expect(warn).toHaveBeenCalledWith('[Chain lookup] Ambiguous case-insensitive chain ID:', 'Aa');
        warn.mockRestore();
    });
});

describe('getChainInfo', () => {
    let originalWarn: any;
    let originalLog: any;
    beforeAll(() => {
        originalWarn = console.warn;
        originalLog = console.log;
        console.warn = vi.fn();
        console.log = vi.fn();
    });
    afterAll(() => {
        console.warn = originalWarn;
        console.log = originalLog;
    });
    it('returns empty map if structure has no units', () => {
        const structure = { units: [] } as any;
        const result = getChainInfo(structure);
        expect(result.chainLabels.size).toBe(0);
    });

    it('extracts chain IDs and labels from structure units', () => {
        const mockChains = {
            _rowCount: 2,
            auth_asym_id: { value: (i: number) => (i === 0 ? 'A' : 'B') },
            label_asym_id: { value: (i: number) => (i === 0 ? 'X' : 'Y') },
        };
        const structure = {
            units: [
                { model: { atomicHierarchy: { chains: mockChains } } }
            ]
        } as any;
        const result = getChainInfo(structure);
        expect(result.chainLabels.get('A')).toBe('X [auth A]');
        expect(result.chainLabels.get('B')).toBe('Y [auth B]');
    });

    it('handles missing label_asym_id gracefully', () => {
        const mockChains = {
            _rowCount: 1,
            auth_asym_id: { value: () => 'C' },
            label_asym_id: undefined,
        };
        const structure = {
            units: [
                { model: { atomicHierarchy: { chains: mockChains } } }
            ]
        } as any;
        const result = getChainInfo(structure);
        expect(result.chainLabels.get('C')).toBe('[auth C]');
    });

    it('falls back to label_asym_id when auth_asym_id is placeholder', () => {
        const mockChains = {
            _rowCount: 1,
            auth_asym_id: { value: () => '.' },
            label_asym_id: { value: () => 'A' },
        };
        const structure = {
            units: [
                { model: { atomicHierarchy: { chains: mockChains } } }
            ]
        } as any;
        const result = getChainInfo(structure);
        expect(result.chainLabels.get('A')).toBe('A [auth A]');
    });

    it('deduplicates chains with the same auth_asym_id across units', () => {
        const mockChains = {
            _rowCount: 1,
            auth_asym_id: { value: () => 'A' },
            label_asym_id: { value: () => 'AA' },
        };
        const structure = {
            units: [
                { model: { atomicHierarchy: { chains: mockChains } } },
                { model: { atomicHierarchy: { chains: mockChains } } }
            ]
        } as any;
        const result = getChainInfo(structure);
        expect(result.chainLabels.size).toBe(1);
        expect(result.chainLabels.get('A')).toBe('AA [auth A]');
    });
});

describe('getChainInfo with rpNameLookup enrichment', () => {
    let originalWarn: any;
    let originalLog: any;
    beforeAll(() => {
        originalWarn = console.warn;
        originalLog = console.log;
        console.warn = vi.fn();
        console.log = vi.fn();
    });
    afterAll(() => {
        console.warn = originalWarn;
        console.log = originalLog;
    });

    function makeStructure(opts: {
        authId: string;
        labelId?: string;
        entityId?: string;
        structRef?: { entityId: string; accession: string }[];
    }) {
        const mockChains: any = {
            _rowCount: 1,
            auth_asym_id: { value: () => opts.authId },
            label_asym_id: opts.labelId ? { value: () => opts.labelId } : undefined,
        };
        if (opts.entityId !== undefined) {
            mockChains.label_entity_id = { value: () => opts.entityId };
        }
        const structRefRows = opts.structRef || [];
        const model: any = {
            atomicHierarchy: { chains: mockChains },
            sourceData: opts.structRef
                ? {
                    data: {
                        db: {
                            struct_ref: {
                                _rowCount: structRefRows.length,
                                entity_id: { value: (i: number) => structRefRows[i]?.entityId },
                                pdbx_db_accession: { value: (i: number) => structRefRows[i]?.accession }
                            }
                        }
                    }
                }
                : undefined
        };
        return { units: [{ model }] } as any;
    }

    it('uses gene family name when UniProt resolves via struct_ref', () => {
        const rpNameLookup = new Map([['P61247', 'eS1']]);
        const structure = makeStructure({
            authId: 'A',
            labelId: 'AA',
            entityId: '1',
            structRef: [{ entityId: '1', accession: 'P61247' }]
        });
        const result = getChainInfo(structure, rpNameLookup);
        expect(result.chainLabels.get('A')).toBe('eS1 | P61247 | AA [auth A]');
    });

    it('uses gene name when available for UniProt accession', () => {
        const rpNameLookup = new Map([['P61247', 'eS1']]);
        const structure = makeStructure({
            authId: 'A',
            labelId: 'AA',
            entityId: '1',
            structRef: [{ entityId: '1', accession: 'P61247' }]
        });
        const result = getChainInfo(structure, rpNameLookup, { P61247: 'RPS3A' });
        expect(result.chainLabels.get('A')).toBe('eS1 | RPS3A (P61247) | AA [auth A]');
    });

    it('hides UniProt accession from label when configured', () => {
        const rpNameLookup = new Map([['P61247', 'eS1']]);
        const structure = makeStructure({
            authId: 'A',
            labelId: 'AA',
            entityId: '1',
            structRef: [{ entityId: '1', accession: 'P61247' }]
        });
        const result = getChainInfo(structure, rpNameLookup, { P61247: 'RPS3A' }, false);
        expect(result.chainLabels.get('A')).toBe('eS1 | RPS3A | AA [auth A]');
    });

    it('falls back to UniProt accession label when family mapping is unavailable', () => {
        const rpNameLookup = new Map([['P99999', 'someFamily']]); // P61247 not present
        const structure = makeStructure({
            authId: 'A',
            labelId: 'AA',
            entityId: '1',
            structRef: [{ entityId: '1', accession: 'P61247' }]
        });
        const result = getChainInfo(structure, rpNameLookup);
        expect(result.chainLabels.get('A')).toBe('P61247 | AA [auth A]');
    });

    it('falls back to default label when struct_ref is absent', () => {
        const rpNameLookup = new Map([['P61247', 'eS1']]);
        const structure = makeStructure({ authId: 'B', labelId: 'BB' }); // no entityId, no structRef
        const result = getChainInfo(structure, rpNameLookup);
        expect(result.chainLabels.get('B')).toBe('BB [auth B]');
    });

    it('falls back to struct_ref_seq chain mapping when label_entity_id is missing', () => {
        const rpNameLookup = new Map([['P61247', 'eS1']]);
        const structure = {
            units: [
                {
                    model: {
                        atomicHierarchy: {
                            chains: {
                                _rowCount: 1,
                                auth_asym_id: { value: () => 'AA' },
                                label_asym_id: { value: () => 'AA' },
                            }
                        },
                        sourceData: {
                            data: {
                                db: {
                                    struct_ref: {
                                        _rowCount: 0,
                                        entity_id: { value: () => undefined },
                                        pdbx_db_accession: { value: () => undefined }
                                    },
                                    struct_ref_seq: {
                                        _rowCount: 1,
                                        pdbx_strand_id: { value: () => 'AA' },
                                        pdbx_db_accession: { value: () => 'P61247' }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        } as any;

        const result = getChainInfo(structure, rpNameLookup);
        expect(result.chainLabels.get('AA')).toBe('eS1 | P61247 | AA [auth AA]');
        expect(result.uniprotAccessions.has('P61247')).toBe(true);
    });

    it('falls back to authId in brackets when labelId is missing and no family found', () => {
        const rpNameLookup = new Map<string, string>();
        const structure = makeStructure({ authId: 'C' }); // no labelId, no structRef
        const result = getChainInfo(structure, rpNameLookup);
        expect(result.chainLabels.get('C')).toBe('[auth C]');
    });

    it('uses authId in family label when labelId is absent', () => {
        const rpNameLookup = new Map([['P61247', 'eS1']]);
        const structure = makeStructure({
            authId: 'A',
            // no labelId
            entityId: '1',
            structRef: [{ entityId: '1', accession: 'P61247' }]
        });
        const result = getChainInfo(structure, rpNameLookup);
        expect(result.chainLabels.get('A')).toBe('eS1 | P61247 | [auth A]');
    });

    it('uses species-specific lookup when available', () => {
        const rpNameLookupBySpecies: RpNameLookupBySpecies = {
            all: new Map([['P61247', 'ALL_FAMILY']]),
            arabidopsis: new Map(),
            drosophila: new Map(),
            human: new Map([['P61247', 'HUMAN_FAMILY']]),
            yeast: new Map([['P61247', 'YEAST_FAMILY']]),
        };

        const structure = {
            units: [
                {
                    model: {
                        atomicHierarchy: {
                            chains: {
                                _rowCount: 1,
                                auth_asym_id: { value: () => 'A' },
                                label_asym_id: { value: () => 'AA' },
                                label_entity_id: { value: () => '1' },
                            }
                        },
                        sourceData: {
                            data: {
                                db: {
                                    struct_ref: {
                                        _rowCount: 1,
                                        entity_id: { value: () => '1' },
                                        pdbx_db_accession: { value: () => 'P61247' }
                                    },
                                    entity_src_nat: {
                                        _rowCount: 1,
                                        pdbx_organism_scientific: { value: () => 'Homo sapiens' }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        } as any;

        const result = getChainInfo(structure, rpNameLookupBySpecies);
        expect(result.chainLabels.get('A')).toBe('HUMAN_FAMILY | P61247 | AA [auth A]');
    });

    it('falls back to all-species lookup when species is unknown', () => {
        const rpNameLookupBySpecies: RpNameLookupBySpecies = {
            all: new Map([['P61247', 'ALL_FAMILY']]),
            arabidopsis: new Map(),
            drosophila: new Map(),
            human: new Map(),
            yeast: new Map(),
        };

        const structure = {
            units: [
                {
                    model: {
                        atomicHierarchy: {
                            chains: {
                                _rowCount: 1,
                                auth_asym_id: { value: () => 'A' },
                                label_asym_id: { value: () => 'AA' },
                                label_entity_id: { value: () => '1' },
                            }
                        },
                        sourceData: {
                            data: {
                                db: {
                                    struct_ref: {
                                        _rowCount: 1,
                                        entity_id: { value: () => '1' },
                                        pdbx_db_accession: { value: () => 'P61247' }
                                    },
                                    entity_src_nat: {
                                        _rowCount: 1,
                                        pdbx_organism_scientific: { value: () => 'Unknown organism' }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        } as any;

        const result = getChainInfo(structure, rpNameLookupBySpecies);
        expect(result.chainLabels.get('A')).toBe('ALL_FAMILY | P61247 | AA [auth A]');
    });

    it('appends molecule description after preserved auth label', () => {
        const rpNameLookup = new Map([['P35268', 'eL22']]);
        const structure = makeStructure({
            authId: 'CU',
            labelId: 'ZB',
            entityId: '78',
            structRef: [{ entityId: '78', accession: 'P35268' }]
        });
        const chainToMoleculeOverride = new Map<string, string>([
            ['CU', 'Ribosomal protein L22-like protein']
        ]);
        const result = getChainInfo(structure, rpNameLookup, undefined, true, undefined, chainToMoleculeOverride);
        expect(result.chainLabels.get('CU')).toBe('eL22 | P35268 | ZB [auth CU] | Ribosomal protein L22-like protein');
    });

    it('keeps S30 on auth chain e and S6 on auth chain G when auth/label IDs collide', () => {
        const rpNameLookup = new Map<string, string>([
            ['P62861', 'eS30'],
            ['P62753', 'eS6'],
        ]);
        const structure = {
            units: [
                {
                    model: {
                        atomicHierarchy: {
                            chains: {
                                _rowCount: 2,
                                auth_asym_id: { value: (i: number) => (i === 0 ? 'e' : 'G') },
                                label_asym_id: { value: (i: number) => (i === 0 ? 'G' : 'J') },
                                label_entity_id: { value: (i: number) => (i === 0 ? '7' : '10') },
                            }
                        },
                        sourceData: {
                            data: {
                                db: {
                                    struct_ref: {
                                        _rowCount: 2,
                                        entity_id: { value: (i: number) => (i === 0 ? '7' : '10') },
                                        pdbx_db_accession: { value: (i: number) => (i === 0 ? 'P62861' : 'P62753') }
                                    }
                                }
                            }
                        }
                    }
                }
            ]
        } as any;

        const chainToMoleculeOverride = new Map<string, string>([
            ['e', '40S ribosomal protein S30'],
            ['G', '40S ribosomal protein S6'],
            ['J', '40S ribosomal protein S6'],
        ]);
        const chainToUniprotOverride = new Map<string, string>([
            ['e', 'P62861'],
            ['G', 'P62753'],
            ['J', 'P62753'],
        ]);

        const result = getChainInfo(
            structure,
            rpNameLookup,
            undefined,
            true,
            chainToUniprotOverride,
            chainToMoleculeOverride
        );

        expect(result.chainLabels.get('e')).toBe('eS30 | P62861 | G [auth e] | 40S ribosomal protein S30');
        expect(result.chainLabels.get('G')).toBe('eS6 | P62753 | J [auth G] | 40S ribosomal protein S6');
    });
});
