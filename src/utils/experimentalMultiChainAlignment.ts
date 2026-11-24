/**
 * Experimental multi-chain alignment utilities for Ribocode.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { alignDatasetsGeneral } from 'molstar/lib/extensions/ribocode/utils/geometry';
import { Structure, Unit } from 'molstar/lib/mol-model/structure';
import { Column } from 'molstar/lib/mol-data/db';
import { align } from 'molstar/lib/mol-model/sequence/alignment/alignment';
import { getProteinOneLetterCode } from 'molstar/lib/mol-model/sequence/constants';
import { resolveChainIndices } from './chain';

type Point = { x: number; y: number; z: number };
export type ExperimentalAnchor = Point & {
    type: string; key: string; unknownInsertion?: boolean;
    sequenceIndex?: number; proteinCode?: string;
};
export type ExperimentalChainPair = {
    referenceChain: string;
    movingChain: string;
    reference: ExperimentalAnchor[];
    moving: ExperimentalAnchor[];
};
export type ExperimentalChainReport = {
    referenceChain: string;
    movingChain: string;
    anchorType: string;
    correspondence: 'residue-key' | 'protein-sequence';
    sequenceIdentity?: number;
    pairs: number;
    referenceAnchors: number;
    movingAnchors: number;
    unknownInsertionPairs: number;
    sharedFitRmsd: number;
    individualFitRmsd: number;
};

const anchorOrder = ['P', 'CA', "C4'", "C1'"];

export function hasLowResidueKeyCoverage(report: ExperimentalChainReport): boolean {
    return report.correspondence === 'residue-key'
        && (report.pairs * 2 < report.referenceAnchors || report.pairs * 2 < report.movingAnchors);
}

export function selectedExperimentalChainPairs(reference: string[], moving: string[]) {
    const result: Array<{ referenceChain: string; movingChain: string }> = [];
    const referenceSeen = new Set<string>();
    const movingSeen = new Set<string>();
    for (let i = 0; i < Math.max(reference.length, moving.length); i++) {
        const referenceChain = reference[i] || '';
        const movingChain = moving[i] || '';
        if (!referenceChain && !movingChain) continue;
        if (!referenceChain || !movingChain) throw new Error(`Chain slot ${i + 1} needs a selection on both sides.`);
        if (referenceSeen.has(referenceChain) || movingSeen.has(movingChain)) {
            throw new Error(`Chain slot ${i + 1} repeats a selected chain.`);
        }
        referenceSeen.add(referenceChain);
        movingSeen.add(movingChain);
        result.push({ referenceChain, movingChain });
    }
    if (!result.length) throw new Error('Select at least one chain pair.');
    return result;
}

export function extractExperimentalAnchors(structure: Structure, chainId: string): ExperimentalAnchor[] {
    const anchors: ExperimentalAnchor[] = [];
    const models = new Map<object, Set<number>>();
    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        const model = unit.model;
        let indices = models.get(model);
        if (!indices) {
            indices = resolveChainIndices(model.atomicHierarchy.chains, chainId);
            const labels = new Set(Array.from(indices, i => model.atomicHierarchy.chains.label_asym_id.value(i)));
            if (labels.size > 1) throw new Error(`Chain ${chainId} resolves to multiple label chains.`);
            models.set(model, indices);
        }
        const hierarchy = model.atomicHierarchy;
        for (let i = 0; i < unit.elements.length; i++) {
            const atom = unit.elements[i];
            if (!indices.has(hierarchy.chainAtomSegments.index[atom])) continue;
            const rawType = hierarchy.atoms.label_atom_id.value(atom).trim().toUpperCase();
            const type = rawType === 'C4*' ? "C4'" : rawType === 'C1*' ? "C1'" : rawType;
            if (!anchorOrder.includes(type)) continue;
            const residue = hierarchy.residueAtomSegments.index[atom];
            const seq = hierarchy.residues.auth_seq_id;
            const insertion = hierarchy.residues.pdbx_PDB_ins_code;
            const component = hierarchy.atoms.label_comp_id.value(atom).trim();
            const ins = insertion.value(residue).trim();
            const unknownInsertion = insertion.valueKind(residue) === Column.ValueKind.Unknown;
            const usableKey = seq.valueKind(residue) === Column.ValueKind.Present && !!component && component !== '?' && component !== '.';
            const key = usableKey ? JSON.stringify([seq.value(residue), unknownInsertion || ins === '?' || ins === '.' ? '' : ins, component]) : '';
            const labelSeq = hierarchy.residues.label_seq_id;
            const entityIndex = model.entities.getEntityIndex(hierarchy.chains.label_entity_id.value(hierarchy.chainAtomSegments.index[atom]));
            const protein = entityIndex >= 0 && model.entities.data.type.value(entityIndex) === 'polymer'
                && model.entities.subtype.value(entityIndex).startsWith('polypeptide');
            const sequenceIndex = protein && labelSeq.valueKind(residue) === Column.ValueKind.Present
                ? labelSeq.value(residue) : undefined;
            const proteinCode = protein ? getProteinOneLetterCode(component) : undefined;
            const point = { x: unit.conformation.x(atom), y: unit.conformation.y(atom), z: unit.conformation.z(atom) };
            if (![point.x, point.y, point.z].every(Number.isFinite)) throw new Error(`Chain ${chainId} contains a non-finite anchor.`);
            anchors.push({ ...point, type, key, unknownInsertion, sequenceIndex, proteinCode });
        }
        if (models.size > 1) throw new Error(`Chain ${chainId} spans multiple models.`);
    }
    if (!anchors.length) throw new Error(`Chain ${chainId} has no usable author-numbered anchors or could not be resolved.`);
    return anchors;
}

export function assertDistinctExperimentalChains(structure: Structure, ids: string[]): void {
    const models = new Set(structure.units.filter(Unit.isAtomic).map(unit => unit.model));
    for (const model of models) {
        const occupied = new Set<number>();
        for (const id of ids) {
            const resolved = resolveChainIndices(model.atomicHierarchy.chains, id);
            for (const index of resolved) {
                if (occupied.has(index)) throw new Error(`Chain ${id} resolves to a chain already selected in another slot.`);
                occupied.add(index);
            }
        }
    }
}

type Matched = { moving: ExperimentalAnchor; reference: ExperimentalAnchor };

function sequenceCorrespondence(reference: ExperimentalAnchor[], moving: ExperimentalAnchor[]) {
    const prepare = (anchors: ExperimentalAnchor[]) => {
        if (anchors.some(a => a.sequenceIndex === undefined || !Number.isInteger(a.sequenceIndex)
            || a.sequenceIndex <= 0 || a.proteinCode === undefined)) return null;
        const sorted = anchors.slice().sort((a, b) => a.sequenceIndex! - b.sequenceIndex!);
        if (sorted.some((a, i) => i > 0 && a.sequenceIndex === sorted[i - 1].sequenceIndex)) return null;
        return sorted;
    };
    const ref = prepare(reference);
    const mov = prepare(moving);
    if (!ref || !mov) return { reason: 'protein C-alpha anchors have missing or duplicate sequence positions, or are not from a protein polymer' };
    if ((ref.length + 1) * (mov.length + 1) > 2_000_000) return { reason: 'protein sequence alignment exceeds the 2,000,000-cell limit' };

    const trace = (left: ExperimentalAnchor[], right: ExperimentalAnchor[], reverse: boolean) => {
        const a = reverse ? left.slice().reverse() : left;
        const b = reverse ? right.slice().reverse() : right;
        const result = align(a.map(x => x.proteinCode!), b.map(x => x.proteinCode!), { substMatrix: 'blosum62' });
        const pairs: Matched[] = [];
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
        if (ai !== a.length || bi !== b.length) throw new Error('Protein sequence alignment did not cover both input sequences.');
        return { pairs, aligned };
    };
    const forward = trace(ref, mov, false);
    const reverse = trace(ref, mov, true);
    const ids = (pairs: Matched[]) => pairs.map(pair => `${pair.reference.sequenceIndex}:${pair.moving.sequenceIndex}`).sort();
    if (JSON.stringify(ids(forward.pairs)) !== JSON.stringify(ids(reverse.pairs))) {
        return { reason: 'forward and reverse protein sequence alignments disagree' };
    }
    const identity = forward.aligned ? forward.pairs.length / forward.aligned : 0;
    if (forward.pairs.length < 10 || identity < 0.5
        || forward.pairs.length / ref.length < 0.5 || forward.pairs.length / mov.length < 0.5) {
        return { reason: 'protein sequence alignment fails the minimum 10 matches, 50% identity and 50% coverage on each side' };
    }
    return { pairs: forward.pairs, identity };
}

function isNonCollinear(points: Point[]): boolean {
    const first = points[0];
    const far = points.reduce((best, point) =>
        distanceSquared(first, point) > distanceSquared(first, best) ? point : best, first);
    const dx = far.x - first.x, dy = far.y - first.y, dz = far.z - first.z;
    const lengthSq = dx * dx + dy * dy + dz * dz;
    if (lengthSq < 1e-12) return false;
    return points.some(point => {
        const x = point.x - first.x, y = point.y - first.y, z = point.z - first.z;
        const cx = dy * z - dz * y, cy = dz * x - dx * z, cz = dx * y - dy * x;
        return (cx * cx + cy * cy + cz * cz) / lengthSq > 1e-12;
    });
}

function distanceSquared(a: Point, b: Point) {
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}

function fit(pairs: Matched[]) {
    if (!isNonCollinear(pairs.map(p => p.reference)) || !isNonCollinear(pairs.map(p => p.moving))) {
        throw new Error('Anchor coordinates are degenerate (coincident or collinear).');
    }
    const result = alignDatasetsGeneral(pairs.map(p => p.moving), pairs.map(p => p.reference), () => true);
    if (![...result.rotmat, ...result.centroid, ...result.centroidReference, ...result.alignedX, ...result.alignedY, ...result.alignedZ].every(Number.isFinite)) {
        throw new Error('Experimental alignment produced a non-finite result.');
    }
    return result;
}

function rmsd(pairs: Matched[], result: ReturnType<typeof fit>, offset = 0) {
    return Math.sqrt(pairs.reduce((sum, pair, i) => sum + distanceSquared(pair.reference, {
        x: result.alignedX[offset + i], y: result.alignedY[offset + i], z: result.alignedZ[offset + i],
    }), 0) / pairs.length);
}

export function fitExperimentalMultiChain(chains: ExperimentalChainPair[]) {
    if (!chains.length) throw new Error('Select at least one chain pair.');
    const accepted = chains.map(chain => {
        for (const type of anchorOrder) {
            const moving = chain.moving.filter(a => a.type === type);
            const reference = chain.reference.filter(a => a.type === type);
            const unique = (anchors: ExperimentalAnchor[]) => {
                const byKey = new Map<string, ExperimentalAnchor>();
                const duplicates = new Set<string>();
                for (const anchor of anchors) {
                    if (!anchor.key) continue;
                    if (byKey.has(anchor.key)) duplicates.add(anchor.key);
                    else byKey.set(anchor.key, anchor);
                }
                for (const key of duplicates) byKey.delete(key);
                return byKey;
            };
            const referenceByKey = unique(reference);
            const pairs = Array.from(unique(moving)).flatMap(([key, anchor]) => {
                const match = referenceByKey.get(key);
                return match ? [{ moving: anchor, reference: match }] : [];
            });
            if (pairs.length >= 10) return {
                chain, type, pairs, movingCount: moving.length, referenceCount: reference.length,
                correspondence: 'residue-key' as const, sequenceIdentity: undefined,
            };
        }
        const reference = chain.reference.filter(a => a.type === 'CA');
        const moving = chain.moving.filter(a => a.type === 'CA');
        const sequence = sequenceCorrespondence(reference, moving);
        if (sequence.pairs) return {
            chain, type: 'CA', pairs: sequence.pairs, movingCount: moving.length, referenceCount: reference.length,
            correspondence: 'protein-sequence' as const, sequenceIdentity: sequence.identity,
        };
        throw new Error(`${chain.referenceChain} / ${chain.movingChain} needs at least 10 unambiguous shared residue anchors of one type; sequence fallback failed: ${sequence.reason}.`);
    });
    const pairs = accepted.flatMap(item => item.pairs);
    const result = fit(pairs);
    let offset = 0;
    const reports: ExperimentalChainReport[] = accepted.map(item => {
        const report = {
            referenceChain: item.chain.referenceChain, movingChain: item.chain.movingChain,
            anchorType: item.type, pairs: item.pairs.length,
            correspondence: item.correspondence, sequenceIdentity: item.sequenceIdentity,
            referenceAnchors: item.referenceCount, movingAnchors: item.movingCount,
            unknownInsertionPairs: item.correspondence === 'residue-key'
                ? item.pairs.filter(pair => pair.reference.unknownInsertion || pair.moving.unknownInsertion).length : 0,
            sharedFitRmsd: rmsd(item.pairs, result, offset),
            individualFitRmsd: rmsd(item.pairs, fit(item.pairs)),
        };
        offset += item.pairs.length;
        return report;
    });
    return { result, reports, pairs };
}
