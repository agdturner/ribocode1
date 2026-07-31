import { alignDatasetsGeneral } from 'molstar/lib/extensions/ribocode/utils/geometry';

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
});
