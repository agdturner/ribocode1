/**
 * Offline 18S correspondence and residual diagnostic; not a production fit.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { Column } from 'molstar/lib/mol-data/db';
import { CIF } from 'molstar/lib/mol-io/reader/cif';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Structure } from 'molstar/lib/mol-model/structure';
import { align } from 'molstar/lib/mol-model/sequence/alignment/alignment';
import { getRnaOneLetterCode } from 'molstar/lib/mol-model/sequence/constants';
import { MinimizeRmsd } from 'molstar/lib/mol-math/linear-algebra/3d/minimize-rmsd';
import { Mat4, Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { extractExperimentalAnchors, fitExperimentalMultiChain } from './experimentalMultiChainAlignment';

type Anchor = { label: number; auth: number; code: string; key: string; x: number; y: number; z: number };
type Pair = { reference: Anchor; moving: Anchor };

async function load(filename: string) {
    const data = fs.readFileSync(path.resolve(__dirname, '../../data/input', filename), 'utf8');
    const parsed = await CIF.parseText(data).run();
    if (parsed.isError) throw new Error(parsed.message);
    const model = (await trajectoryFromMmCIF(parsed.result.blocks[0]).run()).representative;
    const h = model.atomicHierarchy;
    const coordinates = model.atomicConformation;
    const anchors: Anchor[] = [];
    for (let i = 0; i < h.atoms._rowCount; i++) {
        const chain = h.chainAtomSegments.index[i];
        if (h.chains.auth_asym_id.value(chain) !== '2' || h.atoms.label_atom_id.value(i) !== 'P') continue;
        const entity = model.entities.getEntityIndex(h.chains.label_entity_id.value(chain));
        if (entity < 0 || model.entities.data.type.value(entity) !== 'polymer'
            || model.entities.subtype.value(entity) !== 'polyribonucleotide') {
            throw new Error(`${filename}: chain 2 is not RNA`);
        }
        const residue = h.residueAtomSegments.index[i];
        const seq = h.residues.label_seq_id;
        const auth = h.residues.auth_seq_id;
        const insertion = h.residues.pdbx_PDB_ins_code;
        if (seq.valueKind(residue) !== Column.ValueKind.Present || auth.valueKind(residue) !== Column.ValueKind.Present) {
            throw new Error(`${filename}: missing residue position`);
        }
        const rawInsertion = insertion.value(residue).trim();
        const ins = insertion.valueKind(residue) === Column.ValueKind.Unknown || rawInsertion === '?' || rawInsertion === '.'
            ? '' : rawInsertion;
        const component = h.atoms.label_comp_id.value(i).trim();
        anchors.push({
            label: seq.value(residue), auth: auth.value(residue), code: getRnaOneLetterCode(component),
            key: JSON.stringify([auth.value(residue), ins, component]),
            x: coordinates.x[i], y: coordinates.y[i], z: coordinates.z[i],
        });
    }
    anchors.sort((a, b) => a.label - b.label);
    if (anchors.some((a, i) => i > 0 && a.label === anchors[i - 1].label)) {
        throw new Error(`${filename}: duplicate phosphorus sequence positions`);
    }
    return { anchors, structure: Structure.ofModel(model) };
}

function sequencePairs(ref: Anchor[], mov: Anchor[], reverse: boolean) {
    const a = reverse ? ref.slice().reverse() : ref;
    const b = reverse ? mov.slice().reverse() : mov;
    const result = align(a.map(x => x.code), b.map(x => x.code));
    const pairs: Pair[] = [];
    let ai = 0, bi = 0, aligned = 0;
    for (let i = 0; i < result.aliA.length; i++) {
        const x = result.aliA[i], y = result.aliB[i];
        if (x !== '-' && y !== '-') {
            aligned++;
            if (x !== 'X' && x === y) pairs.push({ reference: a[ai], moving: b[bi] });
        }
        if (x !== '-') ai++;
        if (y !== '-') bi++;
    }
    if (ai !== a.length || bi !== b.length) throw new Error('Sequence traceback did not cover inputs');
    return { pairs, aligned };
}

function fit(pairs: Pair[]) {
    const pos = (side: 'reference' | 'moving') => ({
        x: pairs.map(p => p[side].x), y: pairs.map(p => p[side].y), z: pairs.map(p => p[side].z),
    });
    return MinimizeRmsd.compute({ a: pos('reference'), b: pos('moving') });
}

function distances(pairs: Pair[], result: ReturnType<typeof fit>) {
    return pairs.map(pair => {
        const p = Vec3.transformMat4(Vec3(), Vec3.create(pair.moving.x, pair.moving.y, pair.moving.z), result.bTransform);
        return Math.hypot(p[0] - pair.reference.x, p[1] - pair.reference.y, p[2] - pair.reference.z);
    });
}

function rmsd(values: number[]) {
    return Math.sqrt(values.reduce((sum, d) => sum + d * d, 0) / values.length);
}

function compareTransforms(local: ReturnType<typeof fit>, global: ReturnType<typeof fit>, pairs: Pair[]) {
    const a = local.bTransform, b = global.bTransform;
    let trace = 0;
    for (let col = 0; col < 3; col++) {
        for (let row = 0; row < 3; row++) trace += a[col * 4 + row] * b[col * 4 + row];
    }
    const angleDegrees = Math.acos(Math.max(-1, Math.min(1, (trace - 1) / 2))) * 180 / Math.PI;
    const center = Vec3.create(
        pairs.reduce((sum, p) => sum + p.moving.x, 0) / pairs.length,
        pairs.reduce((sum, p) => sum + p.moving.y, 0) / pairs.length,
        pairs.reduce((sum, p) => sum + p.moving.z, 0) / pairs.length,
    );
    const localCenter = Vec3.transformMat4(Vec3(), center, a);
    const globalCenter = Vec3.transformMat4(Vec3(), center, b);
    return { angleDegrees, centerDisplacement: Vec3.distance(localCenter, globalCenter) };
}

describe('7WTT/7WTZ 18S RNA diagnostic', () => {
    it('compares rotation and displacement at a defined point', () => {
        const identity = { bTransform: Mat4.identity(), rmsd: 0, nAlignedElements: 1 };
        const rotation = Mat4.identity();
        rotation[0] = 0;
        rotation[1] = 1;
        rotation[4] = -1;
        rotation[5] = 0;
        const moved = { ...identity, bTransform: rotation };
        const point: Anchor = { label: 1, auth: 1, code: 'A', key: '', x: 2, y: 0, z: 0 };
        const comparison = compareTransforms(moved, identity, [{ reference: point, moving: point }]);
        expect(comparison.angleDegrees).toBeCloseTo(90, 8);
        expect(comparison.centerDisplacement).toBeCloseTo(Math.sqrt(8), 8);
    });

    it('compares residue-key and sequence pairs and locates deviations', async () => {
        const [reference, moving] = await Promise.all([load('7WTT.cif'), load('7WTZ.cif')]);
        const experimental = fitExperimentalMultiChain([{
            referenceChain: '2', movingChain: '2',
            reference: extractExperimentalAnchors(reference.structure, '2'),
            moving: extractExperimentalAnchors(moving.structure, '2'),
        }]);
        const refByKey = new Map(reference.anchors.map(a => [a.key, a]));
        const movByKey = new Map(moving.anchors.map(a => [a.key, a]));
        if (refByKey.size !== reference.anchors.length || movByKey.size !== moving.anchors.length) {
            throw new Error('Duplicate residue keys in 18S fixture');
        }
        const keys = experimental.pairs.map(pair => {
            const a = refByKey.get(pair.reference.key), b = movByKey.get(pair.moving.key);
            if (!a || !b) throw new Error('Missing fixture anchor for experimental pair');
            for (const [actual, extracted] of [[pair.reference, a], [pair.moving, b]] as const) {
                expect([actual.x, actual.y, actual.z]).toEqual([extracted.x, extracted.y, extracted.z]);
            }
            return { reference: a, moving: b };
        });
        const seq = sequencePairs(reference.anchors, moving.anchors, false);
        const rev = sequencePairs(reference.anchors, moving.anchors, true);
        const pairId = (pair: Pair) => `${pair.reference.label}:${pair.moving.label}`;
        const keyIds = new Set(keys.map(pairId));
        const seqIds = new Set(seq.pairs.map(pairId));
        const revIds = new Set(rev.pairs.map(pairId));
        const keyFit = fit(keys), seqFit = fit(seq.pairs);
        const keyDistances = distances(keys, keyFit);
        const sorted = keyDistances.slice().sort((a, b) => a - b);
        const top = keys.map((pair, i) => ({ pair, distance: keyDistances[i] })).sort((a, b) => b.distance - a.distance);
        const trimCount = Math.floor(keys.length * 0.9);
        const trimmed = top.slice(top.length - trimCount).map(x => x.pair);
        const trimmedFit = fit(trimmed);
        const windows = new Map<number, number[]>();
        keys.forEach((pair, i) => {
            const window = Math.floor((pair.reference.label - 1) / 100) * 100 + 1;
            const values = windows.get(window) ?? [];
            values.push(keyDistances[i]);
            windows.set(window, values);
        });
        const totalSquares = keyDistances.reduce((sum, d) => sum + d * d, 0);
        const overlap = [...seqIds].filter(id => keyIds.has(id)).length;
        const traceOverlap = [...seqIds].filter(id => revIds.has(id)).length;
        const highDeviation = keys.map((pair, i) => ({ label: pair.reference.label, distance: keyDistances[i] }))
            .filter(x => x.distance > 20).sort((a, b) => a.label - b.label);
        const runs: Array<{ start: number; end: number; count: number }> = [];
        for (const item of highDeviation) {
            const last = runs[runs.length - 1];
            if (last && item.label === last.end + 1) {
                last.end = item.label;
                last.count++;
            } else {
                runs.push({ start: item.label, end: item.label, count: 1 });
            }
        }
        const localFits = [[101, 200], [601, 700], [901, 1000], [1301, 1400],
            [1363, 1377], [1401, 1500], [1701, 1800]].map(([start, end]) => {
            const inside = (pair: Pair) => pair.reference.label >= start && pair.reference.label <= end;
            const localPairs = keys.filter(inside);
            const outsidePairs = keys.filter(pair => !inside(pair));
            const localFit = fit(localPairs);
            const experimentalPairs = experimental.pairs.filter((_, i) => inside(keys[i]));
            const verification = fitExperimentalMultiChain([{
                referenceChain: '2', movingChain: '2',
                reference: experimentalPairs.map(pair => pair.reference),
                moving: experimentalPairs.map(pair => pair.moving),
            }]);
            const localRmsd = rmsd(distances(localPairs, localFit));
            expect(localPairs.length).toBeGreaterThanOrEqual(10);
            expect(Math.abs(localRmsd - verification.reports[0].individualFitRmsd)).toBeLessThan(0.01);
            return {
                start, end, count: localPairs.length, localRmsd,
                localUnderGlobal: rmsd(distances(localPairs, keyFit)),
                outsideCount: outsidePairs.length,
                outsideUnderLocal: rmsd(distances(outsidePairs, localFit)),
                outsideUnderGlobal: rmsd(distances(outsidePairs, keyFit)),
                allUnderLocal: rmsd(distances(keys, localFit)),
                ...compareTransforms(localFit, keyFit, keys),
            };
        });
        console.log('[18S correspondence diagnostic]', JSON.stringify({
            counts: { ref: reference.anchors.length, mov: moving.anchors.length, keys: keys.length, sequence: seq.pairs.length, aligned: seq.aligned, unknownRef: reference.anchors.filter(a => a.code === 'X').length, unknownMov: moving.anchors.filter(a => a.code === 'X').length },
            overlap: { keyAndSequence: overlap, forwardAndReverse: traceOverlap, reverseCount: revIds.size },
            rmsds: { keys: keyFit.rmsd, sequence: seqFit.rmsd, sequenceUnderKeyFit: rmsd(distances(seq.pairs, keyFit)), keysUnderSequenceFit: rmsd(distances(keys, seqFit)), trimmed90Fit: trimmedFit.rmsd, trimmed90UnderTrimmedFit: rmsd(distances(trimmed, trimmedFit)), allKeysUnderTrimmedFit: rmsd(distances(keys, trimmedFit)) },
            residuals: { median: sorted[Math.floor(sorted.length / 2)], p90: sorted[Math.floor(sorted.length * 0.9)], p95: sorted[Math.floor(sorted.length * 0.95)], max: sorted[sorted.length - 1], above5: sorted.filter(d => d > 5).length, above10: sorted.filter(d => d > 10).length, above20: sorted.filter(d => d > 20).length, top10PercentSquaredFraction: top.slice(0, keys.length - trimCount).reduce((sum, x) => sum + x.distance ** 2, 0) / totalSquares },
            worstWindows: Array.from(windows, ([start, values]) => ({ start, count: values.length, rmsd: rmsd(values), squaredFraction: values.reduce((sum, d) => sum + d * d, 0) / totalSquares })).sort((a, b) => b.rmsd - a.rmsd).slice(0, 8),
            runsAbove20: runs,
            localFits,
            worstPairs: top.slice(0, 8).map(x => ({ refLabel: x.pair.reference.label, refAuth: x.pair.reference.auth, movLabel: x.pair.moving.label, movAuth: x.pair.moving.auth, distance: x.distance })),
        }, null, 2));
        expect(experimental.reports[0].anchorType).toBe('P');
        expect(experimental.reports[0].correspondence).toBe('residue-key');
        expect(reference.anchors).toHaveLength(1575);
        expect(moving.anchors).toHaveLength(1623);
        expect(keys).toHaveLength(1566);
        expect(keyFit.rmsd).toBeCloseTo(experimental.reports[0].individualFitRmsd, 3);
        expect(Math.abs(rmsd(keyDistances) - keyFit.rmsd)).toBeLessThan(0.002);
        expect(Math.abs(rmsd(distances(seq.pairs, seqFit)) - seqFit.rmsd)).toBeLessThan(0.002);
        expect(Math.abs(rmsd(distances(trimmed, trimmedFit)) - trimmedFit.rmsd)).toBeLessThan(0.002);
        expect(seq.pairs).toHaveLength(1567);
        expect(seq.aligned).toBe(1568);
        expect(overlap).toBe(1558);
        expect(revIds.size).toBe(1567);
        expect(traceOverlap).toBe(1561);
        expect(seqFit.rmsd).toBeCloseTo(11.109, 2);
        expect(sorted[Math.floor(sorted.length / 2)]).toBeCloseTo(3.635, 2);
        expect(sorted.filter(d => d > 10)).toHaveLength(111);
        expect(sorted.filter(d => d > 20)).toHaveLength(27);
        expect(sorted[sorted.length - 1]).toBeCloseTo(102.029, 2);
        expect(trimmedFit.rmsd).toBeCloseTo(2.837, 2);
        expect(rmsd(distances(keys, trimmedFit))).toBeCloseTo(11.103, 2);
        expect(windows.get(1301)).toHaveLength(78);
        expect(rmsd(windows.get(1301)!)).toBeCloseTo(44.133, 2);
        const region = localFits.find(x => x.start === 1301);
        const core = localFits.find(x => x.start === 1363);
        expect(region).toBeDefined();
        expect(core).toBeDefined();
        expect(region!.localRmsd).toBeCloseTo(23.031, 2);
        expect(region!.outsideUnderLocal).toBeCloseTo(131.303, 2);
        expect(core!.count).toBe(15);
        expect(core!.localRmsd).toBeCloseTo(1.452, 2);
        expect(core!.localUnderGlobal).toBeCloseTo(86.457, 2);
        expect(core!.outsideUnderLocal).toBeCloseTo(186.807, 2);
        expect(core!.angleDegrees).toBeCloseTo(152.214, 1);
        expect(keys.filter(p => p.reference.label >= 1363 && p.reference.label <= 1377)
            .every(p => seqIds.has(pairId(p)) && revIds.has(pairId(p)))).toBe(true);
    }, 120000);
});
