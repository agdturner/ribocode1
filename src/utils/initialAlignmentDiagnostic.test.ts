/**
 * Initial alignment diagnostic utility functions for Ribocode.
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
import { alignDatasetsGeneral, computeBigCentroid } from 'molstar/lib/extensions/ribocode/utils/geometry';
import { align } from 'molstar/lib/mol-model/sequence/alignment/alignment';
import { getProteinOneLetterCode, getRnaOneLetterCode } from 'molstar/lib/mol-model/sequence/constants';

type Atom = {
    type: string;
    name: string;
    chain: string;
    residue: string;
    component: string;
    alt: string;
    entityType: string;
    entitySubtype: string;
    x: number;
    y: number;
    z: number;
};
type Pair = { moving: Atom; reference: Atom };

async function readAtoms(filename: string): Promise<Atom[]> {
    const parsed = await CIF.parseText(fs.readFileSync(path.resolve(__dirname, '../../data/input', filename), 'utf8')).run();
    if (parsed.isError) throw new Error(parsed.message);
    const trajectory = await trajectoryFromMmCIF(parsed.result.blocks[0]).run();
    const model = trajectory.representative;
    const { atoms, chains, residues, chainAtomSegments, residueAtomSegments } = model.atomicHierarchy;
    const { x, y, z } = model.atomicConformation;
    const centroid = computeBigCentroid(Array.from(x), Array.from(y), Array.from(z));
    return Array.from(x, (_, i) => {
        const chain = chainAtomSegments.index[i];
        const residue = residueAtomSegments.index[i];
        const entity = model.entities.getEntityIndex(chains.label_entity_id.value(chain));
        return {
            type: atoms.type_symbol.value(i),
            name: atoms.label_atom_id.value(i),
            chain: chains.auth_asym_id.value(chain),
            residue: `${residues.auth_seq_id.value(residue)}:${residues.pdbx_PDB_ins_code.value(residue)}`,
            component: atoms.label_comp_id.value(i),
            alt: atoms.label_alt_id.value(i),
            entityType: model.entities.data.type.value(entity),
            entitySubtype: model.entities.subtype.value(entity),
            x: x[i] - centroid[0],
            y: y[i] - centroid[1],
            z: z[i] - centroid[2],
        };
    });
}

function key(atom: Atom): string {
    return JSON.stringify([atom.chain, atom.residue, atom.component, atom.name, atom.alt]);
}

function identityPairs(moving: Atom[], reference: Atom[], atomKey = key): Pair[] {
    const unique = (atoms: Atom[]) => {
        const map = new Map<string, Atom>();
        const duplicates = new Set<string>();
        for (const atom of atoms) {
            const id = atomKey(atom);
            if (map.has(id)) duplicates.add(id);
            else map.set(id, atom);
        }
        for (const id of duplicates) map.delete(id);
        return map;
    };
    const referenceMap = unique(reference);
    return Array.from(unique(moving)).flatMap(([id, atom]) => {
        const ref = referenceMap.get(id);
        return ref ? [{ moving: atom, reference: ref }] : [];
    });
}

function rmsd(pairs: Pair[], transform: (atom: Atom) => number[]): number {
    if (pairs.length === 0) throw new Error('No diagnostic atom pairs.');
    let sumSq = 0;
    for (const pair of pairs) {
        const [x, y, z] = transform(pair.moving);
        sumSq += (x - pair.reference.x) ** 2 + (y - pair.reference.y) ** 2 + (z - pair.reference.z) ** 2;
    }
    return Math.sqrt(sumSq / pairs.length);
}

function anchorChains(atoms: Atom[], anchor: 'CA' | "C4'", classify = true): Map<string, Atom[]> {
    const chains = new Map<string, Atom[]>();
    const seen = new Set<string>();
    for (const atom of atoms) {
        if (atom.name !== anchor || atom.type !== 'C') continue;
        if (classify && (atom.entityType !== 'polymer'
            || (anchor === 'CA' ? !atom.entitySubtype.startsWith('polypeptide')
                : atom.entitySubtype !== 'polyribonucleotide'))) continue;
        const id = JSON.stringify([atom.chain, atom.residue]);
        if (seen.has(id)) continue;
        seen.add(id);
        const residues = chains.get(atom.chain) ?? [];
        residues.push(atom);
        chains.set(atom.chain, residues);
    }
    return chains;
}

function compareSequences(reference: Atom[], moving: Atom[], kind: 'protein' | 'rna' = 'protein') {
    const code = kind === 'protein' ? getProteinOneLetterCode : getRnaOneLetterCode;
    const sequence = (atoms: Atom[]) => atoms.map(atom => code(atom.component)).join('');
    const result = align(sequence(reference), sequence(moving), {
        substMatrix: kind === 'protein' ? 'blosum62' : 'default',
    });
    const pairs: Pair[] = [];
    let referenceIndex = 0;
    let movingIndex = 0;
    let alignedCount = 0;
    let unknownCount = 0;
    for (let i = 0; i < result.aliA.length; i++) {
        const a = result.aliA[i];
        const b = result.aliB[i];
        if (a !== '-' && b !== '-') {
            alignedCount++;
            if (a === 'X' || b === 'X') unknownCount++;
            else if (a === b) pairs.push({ reference: reference[referenceIndex], moving: moving[movingIndex] });
        }
        if (a !== '-') referenceIndex++;
        if (b !== '-') movingIndex++;
    }
    expect(referenceIndex).toBe(reference.length);
    expect(movingIndex).toBe(moving.length);
    return {
        referenceChain: reference[0].chain,
        movingChain: moving[0].chain,
        referenceLength: reference.length,
        movingLength: moving.length,
        score: result.score,
        alignedCount,
        identicalCount: pairs.length,
        identity: pairs.length / alignedCount,
        referenceIdenticalCoverage: pairs.length / reference.length,
        movingIdenticalCoverage: pairs.length / moving.length,
        unknownCount,
        pairs,
    };
}

describe('initial alignment selector and correspondence diagnostics', () => {
    it('aligns RNA independently of chain names and author numbers and excludes unknown anchors', () => {
        const reference: Atom[] = ['A', 'C', 'G', 'U', 'A', 'C', 'G', 'U', 'UNK'].map((component, i) => ({
            type: 'C', name: "C4'", chain: 'REF', residue: `${i + 1}:`, component, alt: '',
            entityType: 'polymer', entitySubtype: 'polyribonucleotide',
            x: i, y: 0, z: 0,
        }));
        const moving = reference.map((atom, i) => ({ ...atom, chain: 'MOV', residue: `${i + 101}:` }));
        const result = compareSequences(reference, moving, 'rna');
        expect(result.identicalCount).toBe(8);
        expect(result.unknownCount).toBe(1);
        expect(result.pairs.every(pair => pair.reference.residue !== pair.moving.residue)).toBe(true);
        const duplicateCandidate = compareSequences(reference, moving.map(atom => ({ ...atom, chain: 'COPY' })), 'rna');
        expect(duplicateCandidate.score).toBe(result.score);
        const ligand = reference.map(atom => ({ ...atom, entityType: 'non-polymer' }));
        expect(anchorChains(ligand, "C4'").size).toBe(0);
        expect(anchorChains(ligand, "C4'", false).size).toBe(1);
    });

    it.each([
        { referenceFile: '6XU6.cif', movingFile: '6xu8.cif', chain: 'CU' },
        { referenceFile: '7WTT.cif', movingFile: '7WTZ.cif', chain: 'e' },
    ])('$referenceFile -> $movingFile compares RNA and protein anchors', async ({ referenceFile, movingFile, chain }) => {
        const reference = await readAtoms(referenceFile);
        const moving = await readAtoms(movingFile);
        const referenceChains = anchorChains(reference, 'CA');
        const movingChains = anchorChains(moving, 'CA');
        const targetReference = referenceChains.get(chain);
        const targetMoving = movingChains.get(chain);
        if (!targetReference || !targetMoving) throw new Error(`Missing diagnostic protein chain ${chain}.`);
        const sameChain = compareSequences(targetReference, targetMoving);
        const candidates = Array.from(movingChains.values())
            .map(atoms => compareSequences(targetReference, atoms))
            .sort((a, b) => b.score - a.score);
        const reverseCandidates = Array.from(referenceChains.values())
            .map(atoms => compareSequences(atoms, targetMoving))
            .sort((a, b) => b.score - a.score);
        const summarizeSequence = ({ pairs, ...summary }: ReturnType<typeof compareSequences>) => ({
            ...summary,
            identicalAuthorNumberPairs: pairs.filter(pair => pair.reference.residue === pair.moving.residue).length,
            firstIdenticalPairs: pairs.slice(0, 5).map(pair =>
                `${pair.reference.component} ${pair.reference.residue} -> ${pair.moving.component} ${pair.moving.residue}`),
        });
        console.log(`[Observed Protein Sequence Correspondence][${referenceFile}->${movingFile}]`, {
            referenceProteinChains: referenceChains.size,
            movingProteinChains: movingChains.size,
            sameChain: summarizeSequence(sameChain),
            topCandidates: candidates.slice(0, 5).map(summarizeSequence),
            reverseTopCandidates: reverseCandidates.slice(0, 3).map(summarizeSequence),
        });
        expect(candidates[0].movingChain).toBe(chain);
        expect(candidates[0].score).toBeGreaterThan(candidates[1].score);
        expect(reverseCandidates[0].referenceChain).toBe(chain);
        expect(reverseCandidates[0].score).toBeGreaterThan(reverseCandidates[1].score);
        expect(sameChain.identicalCount).toBe(chain === 'CU' ? 55 : 20);
        expect(sameChain.pairs.filter(pair => pair.moving.residue === pair.reference.residue).length)
            .toBe(chain === 'CU' ? 0 : 20);
        const referenceRna = anchorChains(reference, "C4'");
        const movingRna = anchorChains(moving, "C4'");
        console.log(`[Polymer Metadata][${referenceFile}->${movingFile}]`, {
            excludedReferenceC4Candidates: Array.from(anchorChains(reference, "C4'", false))
                .filter(([id]) => !referenceRna.has(id))
                .map(([id, atoms]) => ({ chain: id, residues: atoms.length, type: atoms[0].entityType, subtype: atoms[0].entitySubtype })),
            excludedMovingC4Candidates: Array.from(anchorChains(moving, "C4'", false))
                .filter(([id]) => !movingRna.has(id))
                .map(([id, atoms]) => ({ chain: id, residues: atoms.length, type: atoms[0].entityType, subtype: atoms[0].entitySubtype })),
        });
        const rnaComparisons = Array.from(referenceRna.values()).flatMap(ref =>
            Array.from(movingRna.values()).map(mov => compareSequences(ref, mov, 'rna')));
        const reciprocalRnaPairs: Pair[] = [];
        const rnaMatches = Array.from(referenceRna.keys()).map(referenceChain => {
            const ranked = rnaComparisons.filter(candidate => candidate.referenceChain === referenceChain)
                .sort((a, b) => b.score - a.score);
            const best = ranked[0];
            if (!best) throw new Error('No moving RNA chains.');
            const reverse = rnaComparisons.filter(candidate => candidate.movingChain === best.movingChain)
                .sort((a, b) => b.score - a.score);
            const tied = ranked.filter(candidate => candidate.score === best.score).map(candidate => candidate.movingChain);
            const reverseTied = reverse.filter(candidate => candidate.score === reverse[0].score)
                .map(candidate => candidate.referenceChain);
            const uniqueReciprocal = tied.length === 1 && reverseTied.length === 1
                && reverse[0].referenceChain === referenceChain;
            if (uniqueReciprocal) reciprocalRnaPairs.push(...best.pairs);
            return {
                ...summarizeSequence(best),
                secondScore: ranked[1]?.score ?? null,
                reverseBestScore: reverse[0].score,
                tiedCandidates: tied,
                reverseTiedCandidates: reverseTied,
                uniqueReciprocal,
            };
        });
        console.log(`[Observed RNA Reciprocal Correspondence][${referenceFile}->${movingFile}]`,
            JSON.stringify({
                referenceChains: referenceRna.size,
                movingChains: movingRna.size,
                matches: rnaMatches,
                reciprocalIdenticalAnchors: reciprocalRnaPairs.length,
            }, null, 2));
        expect(reciprocalRnaPairs.length).toBeGreaterThan(100);
        expect(reciprocalRnaPairs).toHaveLength(chain === 'CU' ? 5912 : 1567);
        expect(rnaMatches.filter(match => match.uniqueReciprocal)).toHaveLength(chain === 'CU' ? 5 : 1);
        expect(rnaMatches.filter(match => !match.uniqueReciprocal).map(match => match.referenceChain))
            .toEqual([]);
        const shared = identityPairs(moving, reference);
        const protein = shared.filter(pair => pair.moving.name === 'CA' && pair.moving.type === 'C');
        const rna = shared.filter(pair => pair.moving.name === 'P' && pair.moving.type === 'P');
        const targetChain = identityPairs(
            moving.filter(atom => atom.chain === chain && atom.name === 'CA'),
            reference.filter(atom => atom.chain === chain && atom.name === 'CA'),
            atom => JSON.stringify([atom.chain, atom.residue, atom.name, atom.alt])
        );
        const movingP = moving.filter(atom => atom.type === 'P');
        const referenceP = reference.filter(atom => atom.type === 'P');
        const ordered = movingP.slice(0, referenceP.length).map((atom, i) => ({
            moving: atom, reference: referenceP[i],
        }));
        expect(ordered.length).toBeGreaterThan(3);
        expect(protein.length).toBeGreaterThan(90);
        expect(rna.length).toBeGreaterThan(100);
        expect(targetChain.length).toBeGreaterThan(10);

        const experiments = [
            { name: 'P / file-order pairing', pairs: ordered },
            { name: 'P / shared author identity', pairs: rna },
            { name: 'P + CA / shared author identity', pairs: shared.filter(pair => pair.moving.name === 'P' || pair.moving.name === 'CA') },
            { name: "C4' + CA / shared author identity", pairs: shared.filter(pair => pair.moving.name === "C4'" || pair.moving.name === 'CA') },
            { name: "C4' / reciprocal sequence-identical anchors", pairs: reciprocalRnaPairs },
        ];
        const rows = experiments.map(({ name, pairs }) => {
            expect(pairs.length).toBeGreaterThan(3);
            const fit = alignDatasetsGeneral(pairs.map(pair => pair.moving), pairs.map(pair => pair.reference), () => true);
            const transform = (atom: Atom) => {
                const x = atom.x - fit.centroid[0];
                const y = atom.y - fit.centroid[1];
                const z = atom.z - fit.centroid[2];
                return [
                    fit.rotmat[0] * x + fit.rotmat[1] * y + fit.rotmat[2] * z + fit.centroidReference[0],
                    fit.rotmat[3] * x + fit.rotmat[4] * y + fit.rotmat[5] * z + fit.centroidReference[1],
                    fit.rotmat[6] * x + fit.rotmat[7] * y + fit.rotmat[8] * z + fit.centroidReference[2],
                ];
            };
            const proteinByChain = new Map<string, Pair[]>();
            for (const pair of protein) {
                const entries = proteinByChain.get(pair.moving.chain) ?? [];
                entries.push(pair);
                proteinByChain.set(pair.moving.chain, entries);
            }
            return {
                selector: name,
                fitPairs: pairs.length,
                fitRmsd: rmsd(pairs, transform),
                rnaPairs: rna.length,
                rnaRmsd: rmsd(rna, transform),
                proteinPairs: protein.length,
                proteinRmsd: rmsd(protein, transform),
                authorIdChainPairs: targetChain.length,
                authorIdChainRmsd: rmsd(targetChain, transform),
                sequenceIdenticalChainPairs: sameChain.pairs.length,
                sequenceIdenticalChainRmsd: rmsd(sameChain.pairs, transform),
                worstIdentityProteinChains: Array.from(proteinByChain, ([id, entries]) => ({
                    chain: id, pairs: entries.length, rmsd: rmsd(entries, transform),
                })).filter(entry => entry.pairs >= 10).sort((a, b) => b.rmsd - a.rmsd).slice(0, 5),
            };
        });
        console.log(`[Initial Alignment Selectors][${referenceFile}->${movingFile}][chain ${chain}]`, {
            phosphorusCounts: { moving: movingP.length, reference: referenceP.length },
            orderedIdentityMatches: ordered.filter(pair => key(pair.moving) === key(pair.reference)).length,
            targetChainAuthorIdPairs: targetChain.length,
            targetChainComponentMatches: targetChain.filter(pair => pair.moving.component === pair.reference.component).length,
            rows,
        });
        console.log(`[Per-chain Identity Residuals][${referenceFile}->${movingFile}]`,
            JSON.stringify(rows.map(row => ({
                selector: row.selector, chains: row.worstIdentityProteinChains,
            })), null, 2));
        if (chain === 'e') {
            const localFits = rows[4].worstIdentityProteinChains.map(({ chain: id }) => {
                const ref = referenceChains.get(id);
                const mov = movingChains.get(id);
                if (!ref || !mov) throw new Error(`Missing polymer metadata for residual chain ${id}.`);
                const sequence = compareSequences(ref, mov);
                if (sequence.pairs.length < 3) throw new Error(`Insufficient sequence anchors for chain ${id}.`);
                const fit = alignDatasetsGeneral(
                    sequence.pairs.map(pair => pair.moving), sequence.pairs.map(pair => pair.reference), () => true);
                let sumSq = 0;
                sequence.pairs.forEach((pair, i) => {
                    sumSq += (fit.alignedX[i] - pair.reference.x) ** 2
                        + (fit.alignedY[i] - pair.reference.y) ** 2
                        + (fit.alignedZ[i] - pair.reference.z) ** 2;
                });
                return {
                    chain: id, identicalPairs: sequence.pairs.length,
                    referenceCoverage: sequence.referenceIdenticalCoverage,
                    movingCoverage: sequence.movingIdenticalCoverage,
                    independentChainFitRmsd: Math.sqrt(sumSq / sequence.pairs.length),
                };
            });
            console.log('[Weak-fixture Independent Sequence Chain Fits]', JSON.stringify(localFits, null, 2));
        }
        for (const row of rows) {
            for (const metric of [row.fitRmsd, row.rnaRmsd, row.proteinRmsd, row.authorIdChainRmsd]) {
                expect(Number.isFinite(metric)).toBe(true);
            }
            expect(Number.isFinite(row.sequenceIdenticalChainRmsd)).toBe(true);
        }
        // For the strong fixture, independently reproduce the browser's initial CU measurement.
        if (chain === 'CU') {
            expect(rows[0].authorIdChainRmsd).toBeCloseTo(107.96288572683902, 3);
            expect(rows[1].rnaRmsd).toBeLessThan(3);
            expect(rows[1].proteinRmsd).toBeLessThan(3);
            expect(rows[1].rnaRmsd).toBeLessThan(rows[0].rnaRmsd / 50);
            expect(rows[1].proteinRmsd).toBeLessThan(rows[0].proteinRmsd / 50);
            expect(rows[1].sequenceIdenticalChainRmsd).toBeLessThan(4);
            expect(rows[1].sequenceIdenticalChainRmsd).toBeLessThan(rows[0].sequenceIdenticalChainRmsd / 25);
            expect(rows[4].rnaRmsd).toBeLessThan(3);
            expect(rows[4].proteinRmsd).toBeLessThan(3);
            expect(rows[4].sequenceIdenticalChainRmsd).toBeLessThan(4);
        }
    }, 120000);
});
