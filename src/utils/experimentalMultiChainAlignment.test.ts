/**
 * Test suite for experimental multi-chain alignment utilities in Ribocode.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CIF } from 'molstar/lib/mol-io/reader/cif';
import { Column } from 'molstar/lib/mol-data/db';
import type { CifBlock, CifField } from 'molstar/lib/mol-io/reader/cif/data-model';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Structure } from 'molstar/lib/mol-model/structure';
import { resolveChainIndices } from './chain';
import {
    assertDistinctExperimentalChains, extractExperimentalAnchors, fitExperimentalMultiChain, hasLowResidueKeyCoverage, selectedExperimentalChainPairs,
    type ExperimentalAnchor,
} from './experimentalMultiChainAlignment';

function anchors(count: number, offset = 0, type = 'CA'): ExperimentalAnchor[] {
    return Array.from({ length: count }, (_, i) => ({
        key: String(i), type, x: (i % 3) + offset, y: Math.floor(i / 3) % 3, z: Math.floor(i / 9),
    }));
}

async function cifBlock(filename: string): Promise<CifBlock> {
    const data = fs.readFileSync(path.resolve(__dirname, '../../data/input', filename), 'utf8');
    const cif = await CIF.parseText(data).run();
    if (cif.isError) throw new Error(cif.message);
    return cif.result.blocks[0];
}

async function structure(filename: string) {
    const trajectory = await trajectoryFromMmCIF(await cifBlock(filename)).run();
    return Structure.ofModel(trajectory.representative);
}

describe('experimental multi-chain alignment', () => {
    it('pairs all occupied slots and rejects missing and repeated selections', () => {
        expect(selectedExperimentalChainPairs(['a', 'b', 'c', 'd'], ['w', 'x', 'y', 'z'])).toEqual([
            { referenceChain: 'a', movingChain: 'w' }, { referenceChain: 'b', movingChain: 'x' },
            { referenceChain: 'c', movingChain: 'y' }, { referenceChain: 'd', movingChain: 'z' },
        ]);
        expect(() => selectedExperimentalChainPairs(['a', 'b'], ['x'])).toThrow('slot 2');
        expect(() => selectedExperimentalChainPairs(['a', 'a'], ['x', 'y'])).toThrow('repeats');
    });

    it('combines multiple types and reports both individual and shared fits', () => {
        const result = fitExperimentalMultiChain([
            { referenceChain: 'A', movingChain: 'X', reference: anchors(12), moving: anchors(12, 4) },
            { referenceChain: 'B', movingChain: 'Y', reference: anchors(15, 20, 'P'), moving: anchors(15, 30, 'P') },
        ]);
        expect(result.pairs).toHaveLength(27);
        expect(result.reports.map(r => [r.anchorType, r.pairs])).toEqual([['CA', 12], ['P', 15]]);
        expect(result.reports.map(r => r.correspondence)).toEqual(['residue-key', 'residue-key']);
        for (const report of result.reports) {
            expect(report.individualFitRmsd).toBeLessThan(1e-5);
            expect(report.sharedFitRmsd).toBeGreaterThan(0.1);
        }
    });

    it('excludes duplicate keys, never uses ordered fallback, and rejects degenerate fits', () => {
        const reference = anchors(10);
        expect(() => fitExperimentalMultiChain([{
            referenceChain: 'A', movingChain: 'B', reference, moving: [...anchors(10), anchors(10)[0]],
        }])).toThrow('at least 10 unambiguous');
        expect(() => fitExperimentalMultiChain([{
            referenceChain: 'A', movingChain: 'B', reference, moving: anchors(10).map(a => ({ ...a, key: `other-${a.key}` })),
        }])).toThrow('at least 10 unambiguous');
        const missingKey = { ...anchors(1)[0], key: '' };
        const coverage = fitExperimentalMultiChain([{
            referenceChain: 'A', movingChain: 'B', reference: [...reference, missingKey], moving: anchors(10),
        }]).reports[0];
        expect([coverage.pairs, coverage.referenceAnchors]).toEqual([10, 11]);
        const line = anchors(10).map((a, i) => ({ ...a, x: i, y: 0, z: 0 }));
        expect(() => fitExperimentalMultiChain([{ referenceChain: 'A', movingChain: 'B', reference: line, moving: line }])).toThrow('degenerate');
    });

    it('matches real e/E and conflicting T/F/K fixture anchors', async () => {
        const [reference, moving] = await Promise.all([structure('7WTT.cif'), structure('7WTZ.cif')]);
        const model = reference.units[0].model;
        const rows = model.atomicHierarchy.chains;
        const index = Array.from({ length: rows._rowCount }, (_, i) => i).find(i => {
            const label = rows.label_asym_id.value(i);
            return rows.auth_asym_id.value(i) !== label && resolveChainIndices(rows, label).has(i);
        });
        if (index === undefined) throw new Error('Missing usable fixture chain alias.');
        const auth = rows.auth_asym_id.value(index);
        const label = rows.label_asym_id.value(index);
        expect(() => assertDistinctExperimentalChains(reference, [auth, label])).toThrow('already selected');
        const run = (ids: string[]) => fitExperimentalMultiChain(ids.map(id => ({
            referenceChain: id, movingChain: id,
            reference: extractExperimentalAnchors(reference, id),
            moving: extractExperimentalAnchors(moving, id),
        })));
        const small = run(['e', 'E']);
        expect(small.reports.map(r => r.pairs)).toEqual([20, 262]);
        expect(small.reports.every(r => r.correspondence === 'residue-key')).toBe(true);
        expect(small.reports[0].movingAnchors).toBe(55);
        expect(small.reports.map(hasLowResidueKeyCoverage)).toEqual([true, false]);
        expect(small.reports[0].unknownInsertionPairs).toBeGreaterThan(0);
        expect(small.reports[0].sharedFitRmsd).toBeCloseTo(0.494, 2);
        const conflict = run(['T', 'F', 'K']);
        expect(conflict.reports.map(r => r.pairs)).toEqual([144, 189, 909]);
        expect(conflict.reports.every(r => r.correspondence === 'residue-key')).toBe(true);
        expect(conflict.reports.map(r => r.sharedFitRmsd)).toEqual([
            expect.closeTo(16.291, 2), expect.closeTo(12.510, 2), expect.closeTo(10.796, 2),
        ]);
        expect(conflict.reports.every(r => r.individualFitRmsd < 2)).toBe(true);
    }, 120000);

    it('uses protein sequence correspondence for renumbered CU chains', async () => {
        const [reference, moving] = await Promise.all([structure('6XU6.cif'), structure('6xu8.cif')]);
        const result = fitExperimentalMultiChain([{
            referenceChain: 'CU', movingChain: 'CU',
            reference: extractExperimentalAnchors(reference, 'CU'),
            moving: extractExperimentalAnchors(moving, 'CU'),
        }]);
        expect(result.reports[0].correspondence).toBe('protein-sequence');
        expect(result.reports[0].pairs).toBe(55);
        expect(result.reports[0].sequenceIdentity).toBeCloseTo(55 / 95);
        expect(result.reports[0].individualFitRmsd).toBeLessThan(4);
        const mixed = fitExperimentalMultiChain([
            { referenceChain: 'CU', movingChain: 'CU', reference: extractExperimentalAnchors(reference, 'CU'), moving: extractExperimentalAnchors(moving, 'CU') },
            { referenceChain: 'A', movingChain: 'B', reference: anchors(12), moving: anchors(12, 4) },
        ]);
        expect(mixed.reports.map(r => [r.correspondence, r.pairs])).toEqual([['protein-sequence', 55], ['residue-key', 12]]);
        expect(mixed.pairs).toHaveLength(67);
    }, 120000);

    it('reproduces the real CU/CP mixed-strategy fit and characterizes other pairs', async () => {
        const [reference, moving] = await Promise.all([structure('6XU6.cif'), structure('6xu8.cif')]);
        const pair = (a: string, b = a) => ({
            referenceChain: a, movingChain: b,
            reference: extractExperimentalAnchors(reference, a),
            moving: extractExperimentalAnchors(moving, b),
        });
        const result = fitExperimentalMultiChain([pair('CU'), pair('CP')]);
        expect(result.pairs).toHaveLength(240);
        const [cu, cp] = result.reports;
        expect([cu.correspondence, cu.pairs, cu.referenceAnchors, cu.movingAnchors]).toEqual(['protein-sequence', 55, 96, 99]);
        expect(cu.sequenceIdentity).toBeCloseTo(55 / 95);
        expect(cu.sharedFitRmsd).toBeCloseTo(3.134, 3);
        expect(cu.individualFitRmsd).toBeCloseTo(2.850, 3);
        expect([cp.correspondence, cp.pairs, cp.referenceAnchors, cp.movingAnchors, cp.unknownInsertionPairs])
            .toEqual(['residue-key', 185, 185, 185, 185]);
        expect(cp.sharedFitRmsd).toBeCloseTo(2.082, 3);
        expect(cp.individualFitRmsd).toBeCloseTo(1.841, 3);
        expect(result.reports.map(hasLowResidueKeyCoverage)).toEqual([false, false]);
        const co = fitExperimentalMultiChain([pair('CO')]).reports[0];
        expect([co.correspondence, co.pairs, co.referenceAnchors, co.movingAnchors]).toEqual(['residue-key', 205, 205, 205]);
        expect(co.individualFitRmsd).toBeCloseTo(0.982, 3);
        expect(() => fitExperimentalMultiChain([pair('CP', 'CU')])).toThrow('forward and reverse protein sequence alignments disagree');
        expect(() => fitExperimentalMultiChain([pair('CU'), pair('CP', 'CU')])).toThrow('CP / CU');
        const misleading = fitExperimentalMultiChain([pair('CP', 'CO')]).reports[0];
        expect([misleading.correspondence, misleading.pairs, misleading.referenceAnchors, misleading.movingAnchors])
            .toEqual(['residue-key', 14, 185, 205]);
        expect(misleading.individualFitRmsd).toBeCloseTo(20.135, 3);
        expect(hasLowResidueKeyCoverage(misleading)).toBe(true);
        expect(hasLowResidueKeyCoverage({ ...misleading, referenceAnchors: 28, movingAnchors: 28 })).toBe(false);
        expect(hasLowResidueKeyCoverage({ ...misleading, referenceAnchors: 29, movingAnchors: 28 })).toBe(true);
        expect(hasLowResidueKeyCoverage({ ...misleading, referenceAnchors: 28, movingAnchors: 29 })).toBe(true);
        expect(hasLowResidueKeyCoverage({ ...misleading, correspondence: 'protein-sequence' })).toBe(false);
    }, 120000);

    it('checks CP atom and sequence-scheme insertion metadata in both CIF files', async () => {
        for (const filename of ['6XU6.cif', '6xu8.cif']) {
            const block = await cifBlock(filename);
            const field = (name: string): CifField => {
                const result = block.getField(name);
                if (!result) throw new Error(`Missing ${name} in ${filename}`);
                return result;
            };
            const atomChain = field('atom_site.auth_asym_id');
            const atomName = field('atom_site.label_atom_id');
            const atomLabelChain = field('atom_site.label_asym_id');
            const atomSeq = field('atom_site.label_seq_id');
            const atomAuth = field('atom_site.auth_seq_id');
            const atomIns = field('atom_site.pdbx_PDB_ins_code');
            const schemeChain = field('pdbx_poly_seq_scheme.asym_id');
            const schemeSeq = field('pdbx_poly_seq_scheme.seq_id');
            const schemeAuth = field('pdbx_poly_seq_scheme.auth_seq_num');
            const schemeIns = field('pdbx_poly_seq_scheme.pdb_ins_code');
            const scheme = new Map<string, number>();
            for (let i = 0; i < schemeChain.rowCount; i++) {
                scheme.set(`${schemeChain.str(i)}:${schemeSeq.int(i)}`, i);
            }
            let count = 0;
            for (let i = 0; i < atomChain.rowCount; i++) {
                if (atomChain.str(i) !== 'CP' || atomName.str(i) !== 'CA') continue;
                count++;
                expect(atomIns.valueKind(i)).toBe(Column.ValueKind.Unknown);
                const row = scheme.get(`${atomLabelChain.str(i)}:${atomSeq.int(i)}`);
                expect(row).toBeDefined();
                if (row === undefined) throw new Error(`Missing CP scheme position in ${filename}`);
                expect(schemeAuth.int(row)).toBe(atomAuth.int(i));
                expect(schemeIns.valueKind(row)).toBe(Column.ValueKind.NotPresent);
            }
            expect(count).toBe(185);
        }
    }, 120000);

    it('rejects weak and duplicate-position protein sequence fallbacks', () => {
        const reference = anchors(12).map((a, i) => ({ ...a, key: `r${i}`, sequenceIndex: i + 1, proteinCode: 'A' }));
        const moving = anchors(12).map((a, i) => ({ ...a, key: `m${i}`, sequenceIndex: i + 1, proteinCode: 'G' }));
        const chain = { referenceChain: 'A', movingChain: 'B', reference, moving };
        expect(() => fitExperimentalMultiChain([chain])).toThrow('50% identity');
        const duplicate = reference.map((a, i) => ({ ...a, sequenceIndex: i === 1 ? 1 : i + 1 }));
        expect(() => fitExperimentalMultiChain([{ ...chain, reference: duplicate, moving: reference.map((a, i) => ({ ...a, key: `m${i}` })) }])).toThrow('duplicate sequence positions');
        expect(() => fitExperimentalMultiChain([{ ...chain, reference: reference.map(a => ({ ...a, proteinCode: undefined })) }])).toThrow('not from a protein polymer');
    });

    it('rejects uncertain sequence alignments and oversized matrices', () => {
        const sequence = (length: number, prefix: string, code = 'A') => anchors(length).map((a, i) => ({
            ...a, key: `${prefix}${i}`, sequenceIndex: i + 1, proteinCode: code,
        }));
        const chain = { referenceChain: 'A', movingChain: 'B', reference: sequence(12, 'r'), moving: sequence(13, 'm') };
        expect(() => fitExperimentalMultiChain([chain])).toThrow('forward and reverse');
        expect(() => fitExperimentalMultiChain([{ ...chain, reference: sequence(12, 'r', 'X'), moving: sequence(12, 'm', 'X') }])).toThrow('minimum 10 matches');
        const codes = 'ACDEFGHIKLMN';
        const short = sequence(12, 'r').map((a, i) => ({ ...a, proteinCode: codes[i] }));
        const long = sequence(32, 'm').map((a, i) => ({ ...a, proteinCode: i < codes.length ? codes[i] : 'V' }));
        expect(() => fitExperimentalMultiChain([{ ...chain, reference: short, moving: long }])).toThrow('50% coverage');
        expect(() => fitExperimentalMultiChain([{ ...chain, reference: sequence(1414, 'r'), moving: sequence(1414, 'm') }])).toThrow('2,000,000-cell limit');
    });
});
