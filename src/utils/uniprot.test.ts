/**
 * Test suite for UniProt utilities.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.2.0
 * @lastModified 2026-11-26
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { extractUniProtAccessionsFromText, fetchUniProtGeneNames, fetchUniProtGeneNamesBatched, parseChainToMoleculeNameFromCifText, parseChainToUniProtFromCifText } from './uniprot';
import fs from 'fs';
import path from 'path';
import { vi } from 'vitest';

describe('extractUniProtAccessionsFromText', () => {
    it('extracts and deduplicates valid accessions from CIF-like text', () => {
        const text = [
            '4 4 ? LA 1 ? 257 ? P62917 1 ? 257 ? 1 257',
            '5 5 ? LB 1 ? 403 ? P39023 1 ? 403 ? 1 403',
            '6 6 ? LC 1 ? 427 ? P36578 1 ? 427 ? 1 427',
            'repeat P39023 and invalid 174924 and 6XU8'
        ].join('\n');

        const accessions = extractUniProtAccessionsFromText(text);
        expect(accessions.has('P62917')).toBe(true);
        expect(accessions.has('P39023')).toBe(true);
        expect(accessions.has('P36578')).toBe(true);
        expect(accessions.has('174924')).toBe(false);
        expect(accessions.has('6XU8')).toBe(false);
        expect(accessions.size).toBe(3);
    });
});

describe('parseChainToUniProtFromCifText', () => {
    it('uses reference database identity and handles multiline loop values', () => {
        const cif = [
            'loop_', '_struct_ref.id', '_struct_ref.db_name', '_struct_ref.pdbx_db_accession', '_struct_ref.pdbx_seq_one_letter_code',
            '1 UNP P61247', ';SEQUENCE', 'CONTINUED', ';',
            '2 GB P08865', ';OTHER', ';',
            '3 GB NR_133545.1', ';RNA', ';',
            '4 UNIPROT Q9V3G1', ';PROTEIN', ';',
            '#', 'loop_', '_struct_ref_seq.ref_id', '_struct_ref_seq.pdbx_strand_id', '_struct_ref_seq.pdbx_db_accession',
            '1 A P61247', '2 B P08865', '3 C NR_133545.1', '4 D Q9V3G1',
            '5 E P38979', '6 F 174298', '#',
        ].join('\n');

        expect([...parseChainToUniProtFromCifText(cif)]).toEqual([
            ['A', 'P61247'], ['D', 'Q9V3G1'], ['E', 'P38979'],
        ]);
    });

    it('keeps protein references and excludes GenBank RNA references in 6XU6', () => {
        const cif = fs.readFileSync(path.resolve(__dirname, '../../data/input/6XU6.cif'), 'utf8');
        const chains = parseChainToUniProtFromCifText(cif);
        expect(chains.get('AA')).toBe('P38979');
        expect(chains.get('CA')).toBe('Q9V3G1');
        for (const chain of ['A9', 'A7', 'A8', 'B2', 'A5']) {
            expect(chains.has(chain)).toBe(false);
        }
    });

    it('honours database identity even when struct_ref lacks an accession column', () => {
        const cif = [
            'loop_', '_struct_ref.id', '_struct_ref.db_name', '1 GB', '2 UNP', '#',
            'loop_', '_struct_ref_seq.ref_id', '_struct_ref_seq.pdbx_strand_id', '_struct_ref_seq.pdbx_db_accession',
            '1 A P61247', '2 B P08865', '#',
        ].join('\n');
        expect([...parseChainToUniProtFromCifText(cif)]).toEqual([['B', 'P08865']]);
    });

    it('parses singleton references in the AlphaFold fixture', () => {
        const cif = fs.readFileSync(path.resolve(__dirname, '../../data/input/AF-Q13895-F1-model_v6.cif'), 'utf8');
        expect([...parseChainToUniProtFromCifText(cif)]).toEqual([['A', 'Q13895']]);
    });

    it('respects singleton database provenance and skips unrelated multiline text', () => {
        const cif = [
            'data_test', '_note.text', ';',
            'loop_', '_struct_ref.id', '_struct_ref.db_name', '_struct_ref.pdbx_db_accession', '9 UNP Q9V3G1',
            '_struct_ref.id 9', '_struct_ref.db_name UNP', '_struct_ref.pdbx_db_accession Q9V3G1', ';',
            '_struct_ref.id', '1', '_struct_ref.db_name GB', '_struct_ref.pdbx_db_accession P61247',
            '_struct_ref_seq.ref_id 1', '_struct_ref_seq.pdbx_strand_id A',
            '_struct_ref_seq.pdbx_db_accession P61247',
        ].join('\n');
        expect(parseChainToUniProtFromCifText(cif).size).toBe(0);
        expect([...parseChainToUniProtFromCifText(cif.replace('_struct_ref.db_name GB', '_struct_ref.db_name ?'))])
            .toEqual([['A', 'P61247']]);
    });
});

describe('fetchUniProtGeneNames', () => {
    it('parses UniProt TSV response and returns primary gene names', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => 'Entry\tGene Names (primary)\tGene Names\nP61247\tRPS3A\tRPS3A FTE1\nP33442\tRPS3A\tRPS3A\n',
        });

        const result = await fetchUniProtGeneNames(['P61247', 'P33442'], fetchMock as any);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            P61247: 'RPS3A',
            P33442: 'RPS3A',
        });
    });

    it('fills unresolved accessions with null', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => 'Entry\tGene Names (primary)\tGene Names\nP61247\tRPS3A\tRPS3A FTE1\n',
        });

        const result = await fetchUniProtGeneNames(['P61247', 'Q99999'], fetchMock as any);

        expect(result).toEqual({
            P61247: 'RPS3A',
            Q99999: null,
        });
    });

    it('falls back to alternate gene-name column when primary is empty', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            text: async () => 'Entry\tGene Names (primary)\tGene Names\nQ9V9M7\t\tQ9V9M7_DROME\n',
        });

        const result = await fetchUniProtGeneNames(['Q9V9M7'], fetchMock as any);

        expect(result).toEqual({
            Q9V9M7: 'Q9V9M7_DROME',
        });
    });
});

describe('fetchUniProtGeneNamesBatched', () => {
    it('marks whole batch as null on request failure and continues', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: false,
                status: 429,
                text: async () => '',
            })
            .mockResolvedValueOnce({
                ok: true,
                text: async () => 'Entry\tGene Names (primary)\nP3\tG3\n',
            });

        const result = await fetchUniProtGeneNamesBatched(['P1', 'P2', 'P3'], {
            batchSize: 2,
            delayMs: 0,
            fetchFn: fetchMock as any,
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
            P1: null,
            P2: null,
            P3: 'G3',
        });
    });
});

describe('parseChainToMoleculeNameFromCifText', () => {
    it('handles CIF comments, split rows, and embedded quotes without shifting subsequent values', () => {
        const cifText = [
            'loop_', '_entity.id', '_entity.pdbx_description',
            "1 'Protein's domain' # description", '# comment between rows',
            '2', "'Another protein'", 'stop_',
            'loop_', '_struct_asym.id', '_struct_asym.entity_id',
            'A 1 # first', 'B 2', '#',
        ].join('\n');

        const map = parseChainToMoleculeNameFromCifText(cifText);
        expect(map.get('A')).toBe("Protein's domain");
        expect(map.get('B')).toBe('Another protein');
    });

    it('maps both label and auth chain IDs to molecule descriptions', () => {
        const cifText = [
            'loop_',
            '_entity.id',
            '_entity.pdbx_description',
            "78 'Ribosomal protein L22-like protein'",
            '#',
            'loop_',
            '_struct_asym.id',
            '_struct_asym.entity_id',
            'ZB 78',
            '#',
            'loop_',
            '_pdbx_poly_seq_scheme.asym_id',
            '_pdbx_poly_seq_scheme.pdb_strand_id',
            'ZB CU',
            '#',
        ].join('\n');

        const map = parseChainToMoleculeNameFromCifText(cifText);
        expect(map.get('ZB')).toBe('Ribosomal protein L22-like protein');
        expect(map.get('CU')).toBe('Ribosomal protein L22-like protein');
    });

    it('prefers auth-chain mapping when auth and label IDs collide', () => {
        const cifText = [
            'loop_',
            '_entity.id',
            '_entity.pdbx_description',
            "7 '40S ribosomal protein S30'",
            "10 '40S ribosomal protein S6'",
            '#',
            'loop_',
            '_struct_asym.id',
            '_struct_asym.entity_id',
            'G 7',
            'J 10',
            '#',
            'loop_',
            '_pdbx_poly_seq_scheme.asym_id',
            '_pdbx_poly_seq_scheme.pdb_strand_id',
            'G e',
            'J G',
            '#',
        ].join('\n');

        const map = parseChainToMoleculeNameFromCifText(cifText);
        expect(map.get('e')).toBe('40S ribosomal protein S30');
        expect(map.get('G')).toBe('40S ribosomal protein S6');
    });
});
