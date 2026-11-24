/**
 * Offline comparison of multi-chain fit weighting. This is not a production
 * correspondence or alignment policy.
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
import { MinimizeRmsd } from 'molstar/lib/mol-math/linear-algebra/3d/minimize-rmsd';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';

type Point = [number, number, number];
type Pair = { reference: Point; moving: Point };
type ChainPair = {
    referenceChain: string;
    movingChain: string;
    referenceAnchors: number;
    movingAnchors: number;
    pairs: Pair[];
};
type Weighting = 'per-atom' | 'per-chain';

function fit(chains: ChainPair[], weighting: Weighting): (point: Point) => Point {
    if (!chains.length || chains.some(chain => chain.pairs.length < 3)) {
        throw new Error('Every chain pair needs at least three diagnostic correspondences.');
    }
    const weighted = chains.flatMap(chain => chain.pairs.map(pair => ({
        ...pair, weight: weighting === 'per-atom' ? 1 : 1 / chain.pairs.length,
    })));
    if (weighted.some(pair => [...pair.reference, ...pair.moving].some(value => !Number.isFinite(value)))) {
        throw new Error('Diagnostic coordinates must be finite.');
    }
    const total = weighted.reduce((sum, pair) => sum + pair.weight, 0);
    const center = (side: 'reference' | 'moving'): Point => [0, 1, 2].map(axis =>
        weighted.reduce((sum, pair) => sum + pair.weight * pair[side][axis], 0) / total) as Point;
    const aCenter = center('reference');
    const bCenter = center('moving');
    const positions = (side: 'reference' | 'moving', centroid: Point) => ({
        x: weighted.map(pair => Math.sqrt(pair.weight) * (pair[side][0] - centroid[0])),
        y: weighted.map(pair => Math.sqrt(pair.weight) * (pair[side][1] - centroid[1])),
        z: weighted.map(pair => Math.sqrt(pair.weight) * (pair[side][2] - centroid[2])),
    });
    const result = MinimizeRmsd.compute({
        a: positions('reference', aCenter),
        b: positions('moving', bCenter),
        centerA: Vec3.zero(),
        centerB: Vec3.zero(),
    });
    return point => {
        const rotated = Vec3.transformMat4(Vec3.zero(), Vec3.create(
            point[0] - bCenter[0], point[1] - bCenter[1], point[2] - bCenter[2]
        ), result.bTransform);
        return [rotated[0] + aCenter[0], rotated[1] + aCenter[1], rotated[2] + aCenter[2]];
    };
}

function rmsd(pairs: Pair[], transform: (point: Point) => Point): number {
    if (!pairs.length) throw new Error('Cannot compute RMSD without correspondences.');
    const squared = pairs.reduce((sum, pair) => {
        const moved = transform(pair.moving);
        return sum + moved.reduce((value, coordinate, axis) =>
            value + (coordinate - pair.reference[axis]) ** 2, 0);
    }, 0);
    return Math.sqrt(squared / pairs.length);
}

function report(chains: ChainPair[], weighting: Weighting) {
    const transform = fit(chains, weighting);
    const totalPairs = chains.reduce((sum, chain) => sum + chain.pairs.length, 0);
    return {
        weighting,
        totalPairs,
        overallRmsd: rmsd(chains.flatMap(chain => chain.pairs), transform),
        chains: chains.map(chain => ({
            referenceChain: chain.referenceChain,
            movingChain: chain.movingChain,
            pairs: chain.pairs.length,
            referenceAnchors: chain.referenceAnchors,
            movingAnchors: chain.movingAnchors,
            referenceCoverage: chain.pairs.length / chain.referenceAnchors,
            movingCoverage: chain.pairs.length / chain.movingAnchors,
            weightFraction: weighting === 'per-atom' ? chain.pairs.length / totalPairs : 1 / chains.length,
            sharedFitRmsd: rmsd(chain.pairs, transform),
            individualFitRmsd: rmsd(chain.pairs, fit([chain], 'per-atom')),
        })),
    };
}

type Anchor = { key: string; point: Point };

async function readAnchors(filename: string, chainIds: string[]): Promise<Map<string, Anchor[]>> {
    const parsed = await CIF.parseText(fs.readFileSync(path.resolve(__dirname, '../../data/input', filename), 'utf8')).run();
    if (parsed.isError) throw new Error(parsed.message);
    const model = (await trajectoryFromMmCIF(parsed.result.blocks[0]).run()).representative;
    const { atoms, chains, residues, chainAtomSegments, residueAtomSegments } = model.atomicHierarchy;
    const result = new Map(chainIds.map(id => [id, [] as Anchor[]]));
    for (let i = 0; i < atoms._rowCount; i++) {
        const id = chains.auth_asym_id.value(chainAtomSegments.index[i]);
        const anchors = result.get(id);
        if (!anchors || atoms.label_atom_id.value(i) !== 'CA' || atoms.type_symbol.value(i) !== 'C') continue;
        const residue = residueAtomSegments.index[i];
        anchors.push({
            key: JSON.stringify([
                residues.auth_seq_id.value(residue), residues.pdbx_PDB_ins_code.value(residue),
                atoms.label_comp_id.value(i),
            ]),
            point: [model.atomicConformation.x[i], model.atomicConformation.y[i], model.atomicConformation.z[i]],
        });
    }
    return result;
}

function makeChainPair(referenceChain: string, movingChain: string, reference: Anchor[], moving: Anchor[]): ChainPair {
    const unique = (anchors: Anchor[]) => {
        const seen = new Map<string, Anchor>();
        const duplicates = new Set<string>();
        for (const anchor of anchors) {
            if (seen.has(anchor.key)) duplicates.add(anchor.key);
            else seen.set(anchor.key, anchor);
        }
        for (const key of duplicates) seen.delete(key);
        return seen;
    };
    const referenceByKey = unique(reference);
    const pairs = Array.from(unique(moving)).flatMap(([key, anchor]) => {
        const match = referenceByKey.get(key);
        return match ? [{ moving: anchor.point, reference: match.point }] : [];
    });
    return { referenceChain, movingChain, referenceAnchors: reference.length, movingAnchors: moving.length, pairs };
}

describe('offline multi-chain weighting diagnostic', () => {
    it('compares conflicting T, F and K chain pairs in 7WTT/7WTZ', async () => {
        const ids = ['T', 'F', 'K'];
        const ref = await readAnchors('7WTT.cif', ids);
        const mov = await readAnchors('7WTZ.cif', ids);
        const chains = ids.map(id => {
            const reference = ref.get(id);
            const moving = mov.get(id);
            if (!reference?.length || !moving?.length) throw new Error(`Missing chain ${id} anchors.`);
            return makeChainPair(id, id, reference, moving);
        });
        const results = {
            perAtom: report(chains, 'per-atom'),
            perChain: report(chains, 'per-chain'),
            withoutK: report(chains.slice(0, 2), 'per-atom'),
            excludedKUnderWithoutKFit: rmsd(chains[2].pairs, fit(chains.slice(0, 2), 'per-atom')),
        };
        console.log('[Offline conflict diagnostic][7WTT<-7WTZ]', JSON.stringify(results, null, 2));
        expect(chains.map(item => item.pairs.length)).toEqual([144, 189, 909]);
        for (const entry of results.perAtom.chains) {
            expect(entry.referenceCoverage).toBeGreaterThan(0.8);
            expect(entry.movingCoverage).toBeGreaterThan(0.8);
            expect(entry.individualFitRmsd).toBeLessThan(2);
        }
        expect(results.perAtom.overallRmsd).toBeGreaterThan(5);
        expect(results.withoutK.chains.every(entry => entry.sharedFitRmsd < 1)).toBe(true);
        expect(results.excludedKUnderWithoutKFit).toBeGreaterThan(10);
        expect(results.perChain.chains[2].sharedFitRmsd).toBeGreaterThan(results.perAtom.chains[2].sharedFitRmsd);
        expect(results.perChain.chains[0].sharedFitRmsd).toBeLessThan(results.perAtom.chains[0].sharedFitRmsd);
    }, 120000);
    const tetrahedron: Point[] = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const chain = (id: string, repetitions: number, displacement: number): ChainPair => {
        const pairs = Array.from({ length: repetitions }, () => tetrahedron).flat().map(reference => ({
            reference, moving: [reference[0] + displacement, reference[1], reference[2]] as Point,
        }));
        return { referenceChain: id, movingChain: id, referenceAnchors: pairs.length, movingAnchors: pairs.length, pairs };
    };

    it('recovers a shared rotation and translation', () => {
        const pairs = tetrahedron.map(reference => ({
            reference, moving: [-reference[1] + 4, reference[0] - 2, reference[2] + 3] as Point,
        }));
        const input = { referenceChain: 'A', movingChain: 'A', referenceAnchors: 4, movingAnchors: 4, pairs };
        expect(report([input], 'per-atom').overallRmsd).toBeLessThan(1e-6);
        expect(report([input], 'per-chain').overallRmsd).toBeLessThan(1e-6);
    });

    it('fits mutually consistent chain pairs together', () => {
        const chains = [chain('A', 2, 4), chain('B', 1, 4)];
        for (const weighting of ['per-atom', 'per-chain'] as const) {
            expect(report(chains, weighting).chains.every(entry => entry.sharedFitRmsd < 1e-6)).toBe(true);
        }
    });

    it('shows the unequal-length trade-off and individually good but conflicting fits', () => {
        const chains = [chain('long', 2, 0), chain('short', 1, 6)];
        const atom = report(chains, 'per-atom');
        const equal = report(chains, 'per-chain');
        expect(atom.chains[0].sharedFitRmsd).toBeCloseTo(2, 6);
        expect(atom.chains[1].sharedFitRmsd).toBeCloseTo(4, 6);
        expect(equal.chains[0].sharedFitRmsd).toBeCloseTo(3, 6);
        expect(equal.chains[1].sharedFitRmsd).toBeCloseTo(3, 6);
        expect(equal.chains.every(entry => entry.individualFitRmsd < 1e-8)).toBe(true);
        expect(atom.overallRmsd).toBeLessThan(equal.overallRmsd);
        expect(equal.chains.reduce((sum, item) => sum + item.sharedFitRmsd ** 2, 0))
            .toBeLessThan(atom.chains.reduce((sum, item) => sum + item.sharedFitRmsd ** 2, 0));
    });

    it('matches exact replication for equal-chain weighting with different rotations', () => {
        const long = chain('long', 2, 0);
        const short = chain('short', 1, 0);
        short.pairs = short.pairs.map(pair => ({
            reference: pair.reference,
            moving: [-pair.moving[1] + 2, pair.moving[0] - 3, pair.moving[2] + 1],
        }));
        const weighted = fit([long, short], 'per-chain');
        const replicated = fit([long, { ...short, pairs: [...short.pairs, ...short.pairs] }], 'per-atom');
        for (const point of tetrahedron) {
            const weightedPoint = weighted(point);
            const replicatedPoint = replicated(point);
            weightedPoint.forEach((value, axis) => expect(value).toBeCloseTo(replicatedPoint[axis], 6));
        }
    });

    it('excludes duplicated correspondence keys rather than choosing an arbitrary anchor', () => {
        const anchor = (key: string): Anchor => ({ key, point: [0, 0, 0] });
        const result = makeChainPair('A', 'B', [anchor('x'), anchor('x'), anchor('y')], [anchor('x'), anchor('y')]);
        expect(result.pairs).toHaveLength(1);
        expect(result.referenceAnchors).toBe(3);
        expect(result.movingAnchors).toBe(2);
    });

    it('rejects missing correspondences and nonfinite coordinates', () => {
        expect(() => fit([chain('A', 1, 0), { ...chain('B', 1, 0), pairs: [] }], 'per-chain')).toThrow(/at least three/);
        const invalid = chain('A', 1, 0);
        invalid.pairs[0].moving[0] = NaN;
        expect(() => fit([invalid], 'per-atom')).toThrow(/finite/);
    });

    it('compares e and E for 7WTT/7WTZ using unique, component-identical author-residue CA anchors', async () => {
        const reference = await readAnchors('7WTT.cif', ['e', 'E']);
        const moving = await readAnchors('7WTZ.cif', ['e', 'E']);
        const chains = ['e', 'E'].map(id => {
            const ref = reference.get(id);
            const mov = moving.get(id);
            if (!ref?.length || !mov?.length) throw new Error(`Missing chain ${id} anchors.`);
            return makeChainPair(id, id, ref, mov);
        });
        const atom = report(chains, 'per-atom');
        const equal = report(chains, 'per-chain');
        expect(chains.map(item => [item.referenceAnchors, item.movingAnchors])).toEqual([[20, 55], [262, 262]]);
        expect(chains[0].pairs).toHaveLength(20);
        expect(chains[1].pairs.length).toBeGreaterThan(200);
        expect(atom.chains.every(item => Number.isFinite(item.sharedFitRmsd))).toBe(true);
        expect(equal.chains.every(item => Number.isFinite(item.sharedFitRmsd))).toBe(true);
        console.log('[Offline multi-chain weighting][7WTT<-7WTZ]', JSON.stringify({ perAtom: atom, perChain: equal }, null, 2));
    }, 120000);
});
