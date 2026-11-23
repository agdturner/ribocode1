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
import { CIF } from 'molstar/lib/mol-io/reader/cif';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import type { Model } from 'molstar/lib/mol-model/structure/model';
import { align } from 'molstar/lib/mol-model/sequence/alignment/alignment';
import { getRnaOneLetterCode } from 'molstar/lib/mol-model/sequence/constants';
import { alignDatasetsGeneral, computeBigCentroid } from 'molstar/lib/extensions/ribocode/utils/geometry';
import type { AlignmentData } from 'molstar/lib/extensions/ribocode/types';

type Anchor = { type: string; code: string; x: number; y: number; z: number };
type Chain = { id: string; anchors: Anchor[] };
export type ExperimentalMatch = {
    referenceChain: string;
    movingChain: string;
    score: number;
    pairs: number;
    identity: number;
    referenceCoverage: number;
    movingCoverage: number;
};
export type ExperimentalInitialAlignmentResult =
    | { status: 'fitted'; alignmentData: AlignmentData; matches: ExperimentalMatch[]; pairCount: number }
    | { status: 'unfitted'; reason: string; matches: ExperimentalMatch[] };

function rnaChains(model: Model): Chain[] {
    const { atoms, chains, residues, chainAtomSegments, residueAtomSegments } = model.atomicHierarchy;
    const { x, y, z } = model.atomicConformation;
    const centroid = computeBigCentroid(Array.from(x), Array.from(y), Array.from(z));
    const byChain = new Map<number, Chain>();
    const seen = new Set<number>();
    for (let i = 0; i < x.length; i++) {
        const chainIndex = chainAtomSegments.index[i];
        const entity = model.entities.getEntityIndex(chains.label_entity_id.value(chainIndex));
        if (model.entities.data.type.value(entity) !== 'polymer'
            || model.entities.subtype.value(entity) !== 'polyribonucleotide'
            || atoms.label_atom_id.value(i) !== "C4'") continue;
        const residueIndex = residueAtomSegments.index[i];
        if (seen.has(residueIndex)) continue;
        seen.add(residueIndex);
        const chain = byChain.get(chainIndex) ?? { id: chains.label_asym_id.value(chainIndex), anchors: [] };
        chain.anchors.push({
            type: 'C',
            code: getRnaOneLetterCode(atoms.label_comp_id.value(i)),
            x: x[i] - centroid[0], y: y[i] - centroid[1], z: z[i] - centroid[2],
        });
        byChain.set(chainIndex, chain);
    }
    return Array.from(byChain.values());
}

export function fitExperimentalInitialAlignment(reference: Model, moving: Model): ExperimentalInitialAlignmentResult {
    const referenceChains = rnaChains(reference);
    const movingChains = rnaChains(moving);
    const matches: ExperimentalMatch[] = [];
    const unfitted = (reason: string): ExperimentalInitialAlignmentResult => ({ status: 'unfitted', reason, matches });
    if (!referenceChains.length || !movingChains.length) return unfitted('Both structures need observed RNA polymer C4\' anchors.');
    // Bound the quadratic aligner before allocating its score matrices.
    const cells = referenceChains.reduce((sum, ref) => sum
        + movingChains.reduce((count, mov) => count + (ref.anchors.length + 1) * (mov.anchors.length + 1), 0), 0);
    if (cells > 50_000_000) return unfitted('RNA sequence comparison exceeds the experimental 50-million-cell limit.');
    const candidates = referenceChains.flatMap(ref => movingChains.map(mov => {
        const alignment = align(ref.anchors.map(a => a.code), mov.anchors.map(a => a.code));
        const pairs: Array<{ reference: Anchor; moving: Anchor }> = [];
        let ri = 0;
        let mi = 0;
        let alignedCount = 0;
        for (let i = 0; i < alignment.aliA.length; i++) {
            const a = alignment.aliA[i];
            const b = alignment.aliB[i];
            if (a !== '-' && b !== '-') {
                alignedCount++;
                if (a !== 'X' && a === b) pairs.push({ reference: ref.anchors[ri], moving: mov.anchors[mi] });
            }
            if (a !== '-') ri++;
            if (b !== '-') mi++;
        }
        if (ri !== ref.anchors.length || mi !== mov.anchors.length) throw new Error('RNA alignment traceback does not cover input sequences.');
        return {
            ref, mov, pairs,
            summary: {
                referenceChain: ref.id, movingChain: mov.id, score: alignment.score, pairs: pairs.length,
                identity: alignedCount ? pairs.length / alignedCount : 0,
                referenceCoverage: pairs.length / ref.anchors.length,
                movingCoverage: pairs.length / mov.anchors.length,
            },
        };
    }));
    const accepted: typeof candidates = [];
    for (const ref of referenceChains) {
        const ranked = candidates.filter(candidate => candidate.ref === ref).sort((a, b) => b.summary.score - a.summary.score);
        const best = ranked[0];
        matches.push(best.summary);
        const reverse = candidates.filter(candidate => candidate.mov === best.mov).sort((a, b) => b.summary.score - a.summary.score);
        if (ranked.filter(c => c.summary.score === best.summary.score).length !== 1
            || reverse.filter(c => c.summary.score === reverse[0].summary.score).length !== 1
            || reverse[0].ref !== ref) return unfitted(`RNA chain ${ref.id} has an ambiguous or non-reciprocal match.`);
        if (best.summary.pairs < 20 || best.summary.identity < 0.9
            || best.summary.referenceCoverage < 0.8 || best.summary.movingCoverage < 0.8) {
            return unfitted(`RNA chain ${ref.id} does not meet experimental identity/coverage requirements.`);
        }
        accepted.push(best);
    }
    if (accepted.length !== movingChains.length) return unfitted('Some moving RNA chains have no accepted reciprocal match.');
    const pairs = accepted.flatMap(candidate => candidate.pairs);
    const fit = alignDatasetsGeneral(pairs.map(p => p.moving), pairs.map(p => p.reference), () => true);
    if (![...fit.rotmat, ...fit.centroid, ...fit.centroidReference].every(Number.isFinite)) {
        throw new Error('Experimental initial alignment produced a non-finite transform.');
    }
    return {
        status: 'fitted', matches, pairCount: pairs.length,
        alignmentData: { rotMat: fit.rotmat, centroid: fit.centroid, centroidReference: fit.centroidReference },
    };
}

export async function parseExperimentalAlignmentModel(file: File): Promise<Model> {
    const parsed = await CIF.parseText(await file.text()).run();
    if (parsed.isError) throw new Error(`Cannot parse ${file.name}: ${parsed.message}`);
    if (!parsed.result.blocks.length) throw new Error(`${file.name} has no CIF blocks.`);
    const trajectory = await trajectoryFromMmCIF(parsed.result.blocks[0]).run();
    if (!trajectory.frameCount) throw new Error(`${file.name} has no models.`);
    return trajectory.representative;
}
