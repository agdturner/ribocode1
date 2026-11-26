/**
 * Curated fixture diagnostic, not a biological correspondence ground truth.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-26
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CIF } from 'molstar/lib/mol-io/reader/cif';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { MinimizeRmsd } from 'molstar/lib/mol-math/linear-algebra/3d/minimize-rmsd';
import { Structure } from 'molstar/lib/mol-model/structure';
import {
    extractExperimentalAnchors, fitExperimentalMultiChain, hasLowResidueKeyCoverage,
    type ExperimentalAnchor,
} from './experimentalMultiChainAlignment';

type AcceptedCase = {
    reference: string; moving: string; descriptions: [string, string];
    expected: 'plausible' | 'deliberate-mismatch';
    anchor: string; method: 'residue-key' | 'protein-sequence';
    pairs: number; referenceCount: number; movingCount: number;
    lowCoverage: boolean; rmsd: number;
};
type RejectedCase = {
    reference: string; moving: string; descriptions: [string, string];
    expected: 'deliberate-mismatch'; rejection: string;
};

async function fixture(filename: string) {
    const data = fs.readFileSync(path.resolve(__dirname, '../../data/input', filename), 'utf8');
    const parsed = await CIF.parseText(data).run();
    if (parsed.isError) throw new Error(parsed.message);
    const model = (await trajectoryFromMmCIF(parsed.result.blocks[0]).run()).representative;
    const rows = model.atomicHierarchy.chains;
    const descriptions = new Map<string, string>();
    for (let i = 0; i < rows._rowCount; i++) {
        const id = rows.auth_asym_id.value(i);
        const entityIndex = model.entities.getEntityIndex(rows.label_entity_id.value(i));
        if (entityIndex < 0) throw new Error(`Missing entity for ${filename} ${id}`);
        if (model.entities.data.type.value(entityIndex) !== 'polymer') continue;
        const description = model.entities.data.pdbx_description.value(entityIndex).join(', ');
        if (descriptions.has(id) && descriptions.get(id) !== description) {
            throw new Error(`Ambiguous description for ${filename} ${id}`);
        }
        descriptions.set(id, description);
    }
    return { structure: Structure.ofModel(model), descriptions };
}

function independentRmsd(pairs: { reference: ExperimentalAnchor; moving: ExperimentalAnchor }[]) {
    const positions = (side: 'reference' | 'moving') => ({
        x: pairs.map(p => p[side].x), y: pairs.map(p => p[side].y), z: pairs.map(p => p[side].z),
    });
    return MinimizeRmsd.compute({ a: positions('reference'), b: positions('moving') }).rmsd;
}

const drosophila: AcceptedCase[] = [
    { reference: 'CP', moving: 'CP', descriptions: ['60S ribosomal protein L17', '60S ribosomal protein L17'], expected: 'plausible', anchor: 'CA', method: 'residue-key', pairs: 185, referenceCount: 185, movingCount: 185, lowCoverage: false, rmsd: 1.841 },
    { reference: 'CO', moving: 'CO', descriptions: ['60S ribosomal protein L13a', '60S ribosomal protein L13a'], expected: 'plausible', anchor: 'CA', method: 'residue-key', pairs: 205, referenceCount: 205, movingCount: 205, lowCoverage: false, rmsd: 0.982 },
    { reference: 'CU', moving: 'CU', descriptions: ['Ribosomal protein L22-like protein', '60S ribosomal protein L22'], expected: 'plausible', anchor: 'CA', method: 'protein-sequence', pairs: 55, referenceCount: 96, movingCount: 99, lowCoverage: false, rmsd: 2.850 },
    { reference: 'A7', moving: 'A7', descriptions: ['5S ribosomal RNA', '5S ribosomal RNA'], expected: 'plausible', anchor: 'P', method: 'residue-key', pairs: 119, referenceCount: 119, movingCount: 119, lowCoverage: false, rmsd: 1.364 },
    { reference: 'A8', moving: 'A8', descriptions: ['5.8S ribosomal RNA', '5.8S ribosomal RNA'], expected: 'plausible', anchor: 'P', method: 'residue-key', pairs: 122, referenceCount: 122, movingCount: 122, lowCoverage: false, rmsd: 1.203 },
    { reference: 'A9', moving: 'A9', descriptions: ['2S ribosomal RNA', '2S ribosomal RNA'], expected: 'plausible', anchor: 'P', method: 'residue-key', pairs: 29, referenceCount: 29, movingCount: 29, lowCoverage: false, rmsd: 0.830 },
    { reference: 'B2', moving: 'B2', descriptions: ['18S ribosomal RNA', '18S ribosomal RNA'], expected: 'plausible', anchor: 'P', method: 'residue-key', pairs: 1935, referenceCount: 1935, movingCount: 1935, lowCoverage: false, rmsd: 2.875 },
    { reference: 'CP', moving: 'CO', descriptions: ['60S ribosomal protein L17', '60S ribosomal protein L13a'], expected: 'deliberate-mismatch', anchor: 'CA', method: 'residue-key', pairs: 14, referenceCount: 185, movingCount: 205, lowCoverage: true, rmsd: 20.135 },
    { reference: 'A7', moving: 'A8', descriptions: ['5S ribosomal RNA', '5.8S ribosomal RNA'], expected: 'deliberate-mismatch', anchor: 'P', method: 'residue-key', pairs: 29, referenceCount: 119, movingCount: 122, lowCoverage: true, rmsd: 38.938 },
    { reference: 'B2', moving: 'A5', descriptions: ['18S ribosomal RNA', '28S ribosomal RNA'], expected: 'deliberate-mismatch', anchor: 'P', method: 'residue-key', pairs: 478, referenceCount: 1935, movingCount: 3701, lowCoverage: true, rmsd: 85.342 },
];

const human: AcceptedCase[] = [
    { reference: 'e', moving: 'e', descriptions: ['40S ribosomal protein S30', '40S ribosomal protein S30'], expected: 'plausible', anchor: 'CA', method: 'residue-key', pairs: 20, referenceCount: 20, movingCount: 55, lowCoverage: true, rmsd: 0.354 },
    { reference: 'E', moving: 'E', descriptions: ['40S ribosomal protein S4, X isoform', '40S ribosomal protein S4, X isoform'], expected: 'plausible', anchor: 'CA', method: 'residue-key', pairs: 262, referenceCount: 262, movingCount: 262, lowCoverage: false, rmsd: 0.316 },
    { reference: 'T', moving: 'T', descriptions: ['40S ribosomal protein S19', '40S ribosomal protein S19'], expected: 'plausible', anchor: 'CA', method: 'residue-key', pairs: 144, referenceCount: 144, movingCount: 144, lowCoverage: false, rmsd: 0.701 },
    { reference: 'F', moving: 'F', descriptions: ['40S ribosomal protein S5', '40S ribosomal protein S5'], expected: 'plausible', anchor: 'CA', method: 'residue-key', pairs: 189, referenceCount: 189, movingCount: 189, lowCoverage: false, rmsd: 0.821 },
    { reference: '2', moving: '2', descriptions: ['18S rRNA', '18S rRNA'], expected: 'plausible', anchor: 'P', method: 'residue-key', pairs: 1566, referenceCount: 1575, movingCount: 1623, lowCoverage: false, rmsd: 10.840 },
    { reference: 'T', moving: 'F', descriptions: ['40S ribosomal protein S19', '40S ribosomal protein S5'], expected: 'deliberate-mismatch', anchor: 'CA', method: 'residue-key', pairs: 11, referenceCount: 144, movingCount: 189, lowCoverage: true, rmsd: 14.975 },
];

describe('experimental correspondence safeguard diagnostics', () => {
    it.each([
        { files: ['6XU6.cif', '6xu8.cif'], cases: drosophila, rejected: [
            { reference: 'CP', moving: 'CU', descriptions: ['60S ribosomal protein L17', '60S ribosomal protein L22'], expected: 'deliberate-mismatch', rejection: 'forward and reverse protein sequence alignments disagree' },
            { reference: 'A8', moving: 'A9', descriptions: ['5.8S ribosomal RNA', '2S ribosomal RNA'], expected: 'deliberate-mismatch', rejection: 'sequence fallback failed' },
        ] as RejectedCase[] },
        { files: ['7WTT.cif', '7WTZ.cif'], cases: human, rejected: [
            { reference: 'e', moving: 'E', descriptions: ['40S ribosomal protein S30', '40S ribosomal protein S4, X isoform'], expected: 'deliberate-mismatch', rejection: 'forward and reverse protein sequence alignments disagree' },
        ] as RejectedCase[] },
    ])('characterizes $files', async ({ files, cases, rejected }) => {
        const [reference, moving] = await Promise.all(files.map(fixture));
        const ref = new Map<string, ExperimentalAnchor[]>();
        const mov = new Map<string, ExperimentalAnchor[]>();
        const anchors = (data: Awaited<ReturnType<typeof fixture>>, cache: Map<string, ExperimentalAnchor[]>, id: string) => {
            if (!cache.has(id)) cache.set(id, extractExperimentalAnchors(data.structure, id));
            const result = cache.get(id);
            if (!result) throw new Error(`No cached anchors for ${id}`);
            return result;
        };
        for (const item of [...cases, ...rejected]) {
            expect([reference.descriptions.get(item.reference), moving.descriptions.get(item.moving)]).toEqual(item.descriptions);
            const pair = {
                referenceChain: item.reference, movingChain: item.moving,
                reference: anchors(reference, ref, item.reference), moving: anchors(moving, mov, item.moving),
            };
            if ('rejection' in item) {
                expect(() => fitExperimentalMultiChain([pair])).toThrow(item.rejection);
                continue;
            }
            const result = fitExperimentalMultiChain([pair]);
            const row = result.reports[0];
            expect([row.anchorType, row.correspondence, row.pairs, row.referenceAnchors, row.movingAnchors])
                .toEqual([item.anchor, item.method, item.pairs, item.referenceCount, item.movingCount]);
            expect(hasLowResidueKeyCoverage(row)).toBe(item.lowCoverage);
            expect(row.individualFitRmsd).toBeCloseTo(item.rmsd, 2);
            expect(independentRmsd(result.pairs)).toBeCloseTo(row.individualFitRmsd, 3);
        }
    }, 120000);
});
