/**
 * Alignment geometry utility tests for Ribocode.
 *
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-11-23
 * @see https://github.com/ribocode-slola/ribocode1
 */
 import { describe, expect, it } from 'vitest';
import { alignDataset, alignDatasetsGeneral } from 'molstar/lib/extensions/ribocode/utils/geometry';
import { alignDatasetsGeneral as alignSourceDatasets } from '../../packages/molstar/src/extensions/ribocode/utils/geometry';

describe.each([
    { implementation: 'compiled runtime', align: alignDatasetsGeneral },
    { implementation: 'pinned source', align: alignSourceDatasets },
])('$implementation initial alignment rigid transform', ({ align }) => {
    it.each(['equal', 'extra moving', 'extra reference'] as const)(
        'maps actual coordinates to the reference with %s selected atom counts',
        (counts) => {
            const reference = [
                { type: 'P', x: 3, y: -2, z: 7 },
                { type: 'P', x: 7, y: -1, z: 8 },
                { type: 'P', x: 4, y: 3, z: 9 },
                { type: 'P', x: 2, y: 0, z: 13 },
                { type: 'C', x: 8, y: 5, z: 4 },
            ];
            // Rotate 90 degrees about Z, then translate. The C atom is not used in the fit.
            const moving = reference.map(atom => ({
                type: atom.type,
                x: -atom.y + 20,
                y: atom.x - 11,
                z: atom.z + 6,
            }));
            if (counts === 'extra moving') moving.push({ type: 'P', x: 100, y: -80, z: 60 });
            if (counts === 'extra reference') reference.push({ type: 'P', x: -90, y: 70, z: 50 });

            const result = align(moving, reference, atom => atom.type === 'P');

            expect(result.alignedX).toHaveLength(moving.length);
            expect(result.alignedY).toHaveLength(moving.length);
            expect(result.alignedZ).toHaveLength(moving.length);
            for (let i = 0; i < moving.length; i++) {
                const expected = {
                    x: moving[i].y + 11,
                    y: 20 - moving[i].x,
                    z: moving[i].z - 6,
                };
                expect(result.alignedX[i], `atom ${i} x`).toBeCloseTo(expected.x, 6);
                expect(result.alignedY[i], `atom ${i} y`).toBeCloseTo(expected.y, 6);
                expect(result.alignedZ[i], `atom ${i} z`).toBeCloseTo(expected.z, 6);
            }
            expect(result.centroid).toEqual([
                (22 + 21 + 17 + 20) / 4,
                (-8 - 4 - 7 - 9) / 4,
                (13 + 14 + 15 + 19) / 4,
            ]);
            expect(result.centroidReference).toEqual([4, 0, 9.25]);
        }
    );
});

describe('alignment geometry centroid mapping', () => {
    it('returns moving centroid as centroid and reference centroid as centroidReference for equal selected counts', () => {
        const moving = [
            { type: 'P', x: 10, y: 0, z: 0 },
            { type: 'P', x: 12, y: 2, z: 0 },
            { type: 'P', x: 11, y: 1, z: 2 },
        ];
        const reference = [
            { type: 'P', x: 0, y: 0, z: 0 },
            { type: 'P', x: 2, y: 2, z: 0 },
            { type: 'P', x: 1, y: 1, z: 2 },
        ];

        const result = alignDatasetsGeneral(moving, reference, (atom) => atom.type === 'P');

        expect(result.centroid[0]).toBeCloseTo(11, 7);
        expect(result.centroid[1]).toBeCloseTo(1, 7);
        expect(result.centroid[2]).toBeCloseTo(2 / 3, 7);

        expect(result.centroidReference[0]).toBeCloseTo(1, 7);
        expect(result.centroidReference[1]).toBeCloseTo(1, 7);
        expect(result.centroidReference[2]).toBeCloseTo(2 / 3, 7);
    });

    it('falls back to a shared atom type when selected atom type is missing', () => {
        const movingTypes = ['CA', 'CA', 'CA', 'CA'];
        const movingX = [11, 12, 11, 11];
        const movingY = [20, 20, 21, 20];
        const movingZ = [30, 30, 30, 31];

        const referenceTypes = ['CA', 'CA', 'CA', 'CA'];
        const referenceX = [1, 2, 1, 1];
        const referenceY = [0, 0, 1, 0];
        const referenceZ = [0, 0, 0, 1];

        // alignDataset defaults to selectedAtomTypes { P: true }, which previously threw
        // if no phosphorus atoms were present. Fallback should now select shared CA atoms.
        const result = alignDataset(
            movingTypes,
            movingX,
            movingY,
            movingZ,
            referenceTypes,
            referenceX,
            referenceY,
            referenceZ
        );

        expect(result.alignedX[0]).toBeCloseTo(referenceX[0], 5);
        expect(result.alignedY[0]).toBeCloseTo(referenceY[0], 5);
        expect(result.alignedZ[0]).toBeCloseTo(referenceZ[0], 5);
    });
});
