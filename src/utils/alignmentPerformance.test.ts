/**
 * Alignment performance utility tests for Ribocode.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-23
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { alignDatasetUsingChains } from 'molstar/lib/extensions/ribocode/utils/geometry';

function pairwiseRmsd(
    alignedX: number[],
    alignedY: number[],
    alignedZ: number[],
    refX: number[],
    refY: number[],
    refZ: number[],
    count: number
): number {
    if (count <= 0) return Number.NaN;
    let sumSq = 0;
    for (let i = 0; i < count; i++) {
        const dx = alignedX[i] - refX[i];
        const dy = alignedY[i] - refY[i];
        const dz = alignedZ[i] - refZ[i];
        sumSq += dx * dx + dy * dy + dz * dz;
    }
    return Math.sqrt(sumSq / count);
}

function meanPairDistance(
    xA: number[],
    yA: number[],
    zA: number[],
    xB: number[],
    yB: number[],
    zB: number[],
    count: number
): number {
    if (count <= 0) return Number.NaN;
    let sum = 0;
    for (let i = 0; i < count; i++) {
        const dx = xA[i] - xB[i];
        const dy = yA[i] - yB[i];
        const dz = zA[i] - zB[i];
        sum += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    return sum / count;
}

describe('alignment performance metrics', () => {
    it('keeps chain RMSD near zero for a rigid rotation+translation case', () => {
        const referenceTypes = ['P', 'P', 'P', 'P'];
        const referenceChainIds = ['REF', 'REF', 'REF', 'REF'];
        const referenceX = [0, 1, 0, 0];
        const referenceY = [0, 0, 1, 0];
        const referenceZ = [0, 0, 0, 1];

        const tx = 10;
        const ty = -5;
        const tz = 3;

        // Rotate 90 degrees around Z and then translate.
        const movingTypes = ['P', 'P', 'P', 'P'];
        const movingChainIds = ['MOV', 'MOV', 'MOV', 'MOV'];
        const movingX = referenceY.map(y => -y + tx);
        const movingY = referenceX.map(x => x + ty);
        const movingZ = referenceZ.map(z => z + tz);

        const result = alignDatasetUsingChains(
            { P: true },
            'MOV',
            movingTypes,
            movingChainIds,
            movingX,
            movingY,
            movingZ,
            'REF',
            referenceTypes,
            referenceChainIds,
            referenceX,
            referenceY,
            referenceZ
        );

        const rmsd = pairwiseRmsd(
            result.alignedX,
            result.alignedY,
            result.alignedZ,
            referenceX,
            referenceY,
            referenceZ,
            referenceX.length
        );

        expect(rmsd).toBeLessThan(1e-6);
    });

    it('improves mean pair distance by at least 10x when moving set has extra atoms', () => {
        const referenceTypes = ['P', 'P', 'P'];
        const referenceChainIds = ['REF', 'REF', 'REF'];
        const referenceX = [0, 2, 1];
        const referenceY = [0, 0, 2];
        const referenceZ = [0, 1, 0];

        // First three atoms correspond to reference but are translated; fourth is an extra outlier.
        const movingTypes = ['P', 'P', 'P', 'P'];
        const movingChainIds = ['MOV', 'MOV', 'MOV', 'MOV'];
        const movingX = [20, 22, 21, 200];
        const movingY = [-10, -10, -8, -200];
        const movingZ = [5, 6, 5, 100];

        const before = meanPairDistance(
            movingX,
            movingY,
            movingZ,
            referenceX,
            referenceY,
            referenceZ,
            referenceX.length
        );

        const result = alignDatasetUsingChains(
            { P: true },
            'MOV',
            movingTypes,
            movingChainIds,
            movingX,
            movingY,
            movingZ,
            'REF',
            referenceTypes,
            referenceChainIds,
            referenceX,
            referenceY,
            referenceZ
        );

        const after = meanPairDistance(
            result.alignedX,
            result.alignedY,
            result.alignedZ,
            referenceX,
            referenceY,
            referenceZ,
            referenceX.length
        );

        const rmsd = pairwiseRmsd(
            result.alignedX,
            result.alignedY,
            result.alignedZ,
            referenceX,
            referenceY,
            referenceZ,
            referenceX.length
        );

        expect(after).toBeLessThan(before / 10);
        expect(rmsd).toBeLessThan(1e-4);
    });
});
