/**
 * Experimental initial alignment utility functions for Ribocode.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-23
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CIF } from 'molstar/lib/mol-io/reader/cif';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { fitExperimentalInitialAlignment } from './experimentalInitialAlignment';

async function modelFromText(text: string) {
    const parsed = await CIF.parseText(text).run();
    if (parsed.isError) throw new Error(parsed.message);
    return (await trajectoryFromMmCIF(parsed.result.blocks[0]).run()).representative;
}

function syntheticRna(chains: string[], length = 24, unknown = false) {
    const sequence = 'ACGUAGCUCGAAUGCUACGUGCAU';
    const rows = chains.flatMap((chain, ci) => Array.from({ length }, (_, i) =>
        `ATOM ${ci * 100 + i + 1} C "C4'" . ${unknown ? 'UNK' : sequence[i % sequence.length]} ${chain} 1 ${i + 1} ? ${i % 5 + ci * 10} ${i * i % 7} ${i % 3} 1 10 ${i + 101} ${chain} 1`));
    return `data_test
loop_
_entity.id
_entity.type
1 polymer
loop_
_entity_poly.entity_id
_entity_poly.type
1 polyribonucleotide
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_alt_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_entity_id
_atom_site.label_seq_id
_atom_site.pdbx_PDB_ins_code
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.occupancy
_atom_site.B_iso_or_equiv
_atom_site.auth_seq_id
_atom_site.auth_asym_id
_atom_site.pdbx_PDB_model_num
${rows.join('\n')}
`;
}

describe('experimental initial alignment acceptance', () => {
    it('accepts renamed RNA chains with sufficient correspondence', async () => {
        const reference = await modelFromText(syntheticRna(['REF']));
        const moving = await modelFromText(syntheticRna(['MOV']));
        const result = fitExperimentalInitialAlignment(reference, moving);
        expect(result.status).toBe('fitted');
        if (result.status !== 'fitted') throw new Error(result.reason);
        expect(result.pairCount).toBe(24);
        expect(result.matches[0].movingChain).toBe('MOV');
        expect(result.matches[0].identity).toBe(1);
    });

    it.each([
        { name: 'tied RNA candidates', reference: syntheticRna(['R']), moving: syntheticRna(['A', 'B']), reason: /ambiguous/ },
        { name: 'insufficient observed coverage', reference: syntheticRna(['R']), moving: syntheticRna(['A'], 12), reason: /identity\/coverage/ },
        { name: 'unknown residue sequences', reference: syntheticRna(['R'], 24, true), moving: syntheticRna(['A'], 24, true), reason: /identity\/coverage/ },
        { name: 'non-polymer anchors', reference: syntheticRna(['R']).replace('1 polymer', '1 non-polymer'), moving: syntheticRna(['A']), reason: /RNA polymer/ },
        { name: 'coverage below 80 percent', reference: syntheticRna(['R'], 20), moving: syntheticRna(['A'], 26), reason: /identity\/coverage/ },
    ])('leaves $name unfitted with an explicit reason', async ({ reference, moving, reason }) => {
        const result = fitExperimentalInitialAlignment(await modelFromText(reference), await modelFromText(moving));
        expect(result.status).toBe('unfitted');
        if (result.status !== 'unfitted') throw new Error('Unexpected accepted fit.');
        expect(result.reason).toMatch(reason);
        expect('alignmentData' in result).toBe(false);
    });

    it('accepts the minimum 20 pairs at exactly 80 percent moving coverage', async () => {
        const result = fitExperimentalInitialAlignment(
            await modelFromText(syntheticRna(['R'], 20)), await modelFromText(syntheticRna(['A'], 25)));
        expect(result.status).toBe('fitted');
        if (result.status !== 'fitted') throw new Error(result.reason);
        expect(result.pairCount).toBe(20);
        expect(result.matches[0].movingCoverage).toBe(0.8);
    });

    it.each([
        { reference: '6XU6.cif', moving: '6xu8.cif', pairs: 5912 },
        { reference: '7WTT.cif', moving: '7WTZ.cif', pairs: 1567 },
    ])('accepts conservative correspondence in $reference/$moving', async ({ reference, moving, pairs }) => {
        const read = (name: string) => modelFromText(fs.readFileSync(path.resolve(__dirname, '../../data/input', name), 'utf8'));
        const result = fitExperimentalInitialAlignment(await read(reference), await read(moving));
        expect(result.status).toBe('fitted');
        if (result.status !== 'fitted') throw new Error(result.reason);
        expect(result.pairCount).toBe(pairs);
        expect(result.matches.every(match => match.identity >= 0.9
            && match.referenceCoverage >= 0.8 && match.movingCoverage >= 0.8)).toBe(true);
    }, 120000);
});
