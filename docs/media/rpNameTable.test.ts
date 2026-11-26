/**
 * Test suite for rpNameTable utility functions.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-11-26
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { parseRpNameTable, parseRpNameTableBySpecies, buildEntityToUniprotMap, buildChainToUniprotMap, inferSpeciesKeyFromModel } from './rpNameTable';

describe('parseRpNameTable', () => {
    const HEADER = 'family,human_old_name,yeast_old_name,arabdidopsis_homologs,drosophila_homologs,human_homologs,yeast_homologs';

    it('returns an empty map for empty input', () => {
        expect(parseRpNameTable('').size).toBe(0);
    });

    it('returns an empty map for header-only input', () => {
        expect(parseRpNameTable(HEADER).size).toBe(0);
    });

    it('maps a single human UniProt code to its family name', () => {
        const csv = [HEADER, 'eS1,S1,S3A,,,,P61247'].join('\n');
        const lookup = parseRpNameTable(csv);
        expect(lookup.get('P61247')).toBe('eS1');
    });

    it('maps multiple semicolon-separated UniProt codes in one column', () => {
        const csv = [HEADER, 'uS2,S0,SA,,,P08865;A0A0C4DG17,P32905'].join('\n');
        const lookup = parseRpNameTable(csv);
        expect(lookup.get('P08865')).toBe('uS2');
        expect(lookup.get('A0A0C4DG17')).toBe('uS2');
        expect(lookup.get('P32905')).toBe('uS2');
    });

    it('maps codes across all species columns (cols 3–6)', () => {
        const csv = [
            HEADER,
            'uS3,S3,S3,Q9M339,Q06559,P23396,A0A6A5Q3Q1'
        ].join('\n');
        const lookup = parseRpNameTable(csv);
        // arabidopsis (col 3)
        expect(lookup.get('Q9M339')).toBe('uS3');
        // drosophila (col 4)
        expect(lookup.get('Q06559')).toBe('uS3');
        // human (col 5)
        expect(lookup.get('P23396')).toBe('uS3');
        // yeast (col 6)
        expect(lookup.get('A0A6A5Q3Q1')).toBe('uS3');
    });

    it('can parse only the selected species column', () => {
        const csv = [
            HEADER,
            'uS2,S0,SA,ARA_ONLY,DRO_ONLY,HUMAN_ONLY,YEAST_ONLY'
        ].join('\n');

        const humanLookup = parseRpNameTable(csv, 'human');
        const yeastLookup = parseRpNameTable(csv, 'yeast');

        expect(humanLookup.get('HUMAN_ONLY')).toBe('uS2');
        expect(humanLookup.has('YEAST_ONLY')).toBe(false);
        expect(yeastLookup.get('YEAST_ONLY')).toBe('uS2');
        expect(yeastLookup.has('HUMAN_ONLY')).toBe(false);
    });

    it('ignores blank lines in the CSV', () => {
        const csv = [HEADER, '', 'eS1,S1,S3A,,,,P61247', ''].join('\n');
        const lookup = parseRpNameTable(csv);
        expect(lookup.get('P61247')).toBe('eS1');
        expect(lookup.size).toBe(1);
    });

    it('handles multiple rows correctly', () => {
        const csv = [
            HEADER,
            'eS1,S1,S3A,,,,P61247',
            'uS2,S0,SA,,,P08865,P32905'
        ].join('\n');
        const lookup = parseRpNameTable(csv);
        expect(lookup.get('P61247')).toBe('eS1');
        expect(lookup.get('P08865')).toBe('uS2');
        expect(lookup.get('P32905')).toBe('uS2');
    });

    it('trims whitespace from UniProt codes', () => {
        const csv = [HEADER, 'eS1,S1,S3A,,,  P61247 ;D6RG13  ,'].join('\n');
        const lookup = parseRpNameTable(csv);
        expect(lookup.get('P61247')).toBe('eS1');
        expect(lookup.get('D6RG13')).toBe('eS1');
    });

    it('does not map old names (columns 1 and 2) to family', () => {
        const csv = [HEADER, 'eS1,S1,S3A,,,,P61247'].join('\n');
        const lookup = parseRpNameTable(csv);
        expect(lookup.has('S1')).toBe(false);
        expect(lookup.has('S3A')).toBe(false);
    });

    it('parses a realistic excerpt from the actual CSV', () => {
        const csv = [
            HEADER,
            'eS1,S1,S3A,Q42262;Q9CAV0,P55830,P61247;D6RG13;D6RGE0,A0A6A5PRY4;P33442',
            'uS2,S0,SA,B9DG17;Q08682,P38979,P08865;A0A0C4DG17,P32905;P46654'
        ].join('\n');
        const lookup = parseRpNameTable(csv);
        expect(lookup.get('Q42262')).toBe('eS1');
        expect(lookup.get('P55830')).toBe('eS1');
        expect(lookup.get('D6RGE0')).toBe('eS1');
        expect(lookup.get('P33442')).toBe('eS1');
        expect(lookup.get('B9DG17')).toBe('uS2');
        expect(lookup.get('P38979')).toBe('uS2');
        expect(lookup.get('P46654')).toBe('uS2');
    });
});

describe('parseRpNameTableBySpecies', () => {
    const HEADER = 'family,human_old_name,yeast_old_name,arabdidopsis_homologs,drosophila_homologs,human_homologs,yeast_homologs';

    it('returns distinct lookups for each species and all columns', () => {
        const csv = [
            HEADER,
            'eS1,S1,S3A,ARA1,DRO1,HUM1,YEA1'
        ].join('\n');

        const lookups = parseRpNameTableBySpecies(csv);

        expect(lookups.arabidopsis.get('ARA1')).toBe('eS1');
        expect(lookups.drosophila.get('DRO1')).toBe('eS1');
        expect(lookups.human.get('HUM1')).toBe('eS1');
        expect(lookups.yeast.get('YEA1')).toBe('eS1');
        expect(lookups.all.get('ARA1')).toBe('eS1');
        expect(lookups.all.get('YEA1')).toBe('eS1');
    });
});

describe('inferSpeciesKeyFromModel', () => {
    it('detects human from entity_src_nat scientific name', () => {
        const model = {
            sourceData: {
                data: {
                    db: {
                        entity_src_nat: {
                            _rowCount: 1,
                            pdbx_organism_scientific: { value: () => 'Homo sapiens' }
                        }
                    }
                }
            }
        };
        expect(inferSpeciesKeyFromModel(model)).toBe('human');
    });

    it('detects yeast from pdbx_entity_src_syn scientific name', () => {
        const model = {
            sourceData: {
                data: {
                    db: {
                        pdbx_entity_src_syn: {
                            _rowCount: 1,
                            organism_scientific: { value: () => 'Saccharomyces cerevisiae' }
                        }
                    }
                }
            }
        };
        expect(inferSpeciesKeyFromModel(model)).toBe('yeast');
    });

    it('returns undefined when no known species is found', () => {
        const model = {
            sourceData: {
                data: {
                    db: {
                        entity_src_nat: {
                            _rowCount: 1,
                            pdbx_organism_scientific: { value: () => 'Unknown organism' }
                        }
                    }
                }
            }
        };
        expect(inferSpeciesKeyFromModel(model)).toBeUndefined();
    });
});

describe('buildEntityToUniprotMap', () => {
    it('excludes non-UniProt databases and invalid accession values', () => {
        const model = { sourceData: { data: { db: { struct_ref: {
            _rowCount: 4,
            entity_id: { value: (i: number) => ['1', '2', '3', '4'][i] },
            db_name: { value: (i: number) => ['UNP', 'GB', 'UNIPROT', '?'][i] },
            pdbx_db_accession: { value: (i: number) => ['P61247', 'P08865', 'NR_133545.1', 'Q9V3G1'][i] },
        } } } } };
        expect([...buildEntityToUniprotMap(model)]).toEqual([['1', 'P61247'], ['4', 'Q9V3G1']]);
    });

    it('returns an empty map when model is null', () => {
        expect(buildEntityToUniprotMap(null).size).toBe(0);
    });

    it('returns an empty map when sourceData is absent', () => {
        expect(buildEntityToUniprotMap({}).size).toBe(0);
    });

    it('returns an empty map when struct_ref is absent', () => {
        const model = { sourceData: { data: { db: {} } } };
        expect(buildEntityToUniprotMap(model).size).toBe(0);
    });

    it('maps entity IDs to UniProt accessions', () => {
        const model = {
            sourceData: {
                data: {
                    db: {
                        struct_ref: {
                            _rowCount: 2,
                            entity_id: { value: (i: number) => ['1', '2'][i] },
                            pdbx_db_accession: { value: (i: number) => ['P61247', 'P08865'][i] }
                        }
                    }
                }
            }
        };
        const map = buildEntityToUniprotMap(model);
        expect(map.get('1')).toBe('P61247');
        expect(map.get('2')).toBe('P08865');
    });

    it('trims whitespace from accession values', () => {
        const model = {
            sourceData: {
                data: {
                    db: {
                        struct_ref: {
                            _rowCount: 1,
                            entity_id: { value: () => '1' },
                            pdbx_db_accession: { value: () => '  P61247  ' }
                        }
                    }
                }
            }
        };
        const map = buildEntityToUniprotMap(model);
        expect(map.get('1')).toBe('P61247');
    });

    it('ignores placeholder accession values', () => {
        const model = {
            sourceData: {
                data: {
                    db: {
                        struct_ref: {
                            _rowCount: 2,
                            entity_id: { value: (i: number) => ['1', '2'][i] },
                            pdbx_db_accession: { value: (i: number) => ['?', '.'][i] }
                        }
                    }
                }
            }
        };
        const map = buildEntityToUniprotMap(model);
        expect(map.size).toBe(0);
    });

    it('returns an empty map when struct_ref throws', () => {
        const model = {
            sourceData: {
                data: {
                    db: {
                        struct_ref: {
                            get _rowCount() { throw new Error('oops'); }
                        }
                    }
                }
            }
        };
        expect(buildEntityToUniprotMap(model).size).toBe(0);
    });
});

describe('buildChainToUniprotMap', () => {
    it('checks reference databases and rejects invalid accessions', () => {
        const model = { sourceData: { data: { db: {
            struct_ref: {
                _rowCount: 2,
                id: { value: (i: number) => ['1', '2'][i] },
                db_name: { value: (i: number) => ['UNP', 'GB'][i] },
            },
            struct_ref_seq: {
                _rowCount: 4,
                ref_id: { value: (i: number) => ['1', '2', '2', '?'][i] },
                pdbx_strand_id: { value: (i: number) => ['A', 'B', 'C', 'D'][i] },
                pdbx_db_accession: { value: (i: number) => ['P61247', 'P08865', 'NR_133545.1', 'Q9V3G1'][i] },
            },
        } } } };
        expect([...buildChainToUniprotMap(model)]).toEqual([['A', 'P61247'], ['D', 'Q9V3G1']]);
    });

    it('returns an empty map when struct_ref_seq is absent', () => {
        const model = { sourceData: { data: { db: {} } } };
        expect(buildChainToUniprotMap(model).size).toBe(0);
    });

    it('maps chain IDs from pdbx_strand_id to accession', () => {
        const model = {
            sourceData: {
                data: {
                    db: {
                        struct_ref_seq: {
                            _rowCount: 2,
                            pdbx_strand_id: { value: (i: number) => ['AA', 'AB, AC'][i] },
                            pdbx_db_accession: { value: (i: number) => ['P61247', 'P08865'][i] }
                        }
                    }
                }
            }
        };
        const map = buildChainToUniprotMap(model);
        expect(map.get('AA')).toBe('P61247');
        expect(map.get('AB')).toBe('P08865');
        expect(map.get('AC')).toBe('P08865');
    });

    it('ignores blank and placeholder accessions', () => {
        const model = {
            sourceData: {
                data: {
                    db: {
                        struct_ref_seq: {
                            _rowCount: 3,
                            pdbx_strand_id: { value: (i: number) => ['AA', 'AB', 'AC'][i] },
                            pdbx_db_accession: { value: (i: number) => ['?', '.', ''][i] }
                        }
                    }
                }
            }
        };
        const map = buildChainToUniprotMap(model);
        expect(map.size).toBe(0);
    });
});
