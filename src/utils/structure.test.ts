/**
 * Test suite for getStructureRepresentations utility.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.2.0
 * @lastModified 2026-11-26
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { CIF } from 'molstar/lib/mol-io/reader/cif';
import { trajectoryFromMmCIF } from 'molstar/lib/mol-model-formats/structure/mmcif';
import { Structure, StructureElement } from 'molstar/lib/mol-model/structure';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { getResidueInfo } from './residue';
import { getStructureRepresentations, focusLociOnChain, focusLociOnResidue, getChainLoci, getResidueLoci, getResiduesLoci, getSubunitLoci, highlightLociOnChain, highlightLociOnResidues, restoreResidueLoci, serializeResidueLoci } from './structure';

// Static mock for a valid Loci object
const lociObj = { kind: 'element-loci', structure: {}, elements: [] } as any;

describe('chain and residue loci identity', () => {
    let plugin: PluginUIContext;
    let select: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        const rows = [
            'ATOM 1 C CA . GLY X 1 1 ? 0 0 0 1 10 1 E 1',
            'ATOM 2 C CA . GLY G 1 1 ? 1 0 0 1 10 1 e 1',
            'ATOM 3 C CA . GLY Y 1 1 ? 2 0 0 1 10 1 G 1',
            'ATOM 4 C CA . GLY Z 1 1 ? 3 0 0 1 10 1 . 1',
            'ATOM 7 C CA . GLY Z 1 2 B 3 1 0 1 10 1 . 1',
            'ATOM 5 C CA . GLY U 1 1 ? 4 0 0 1 10 1 AA 1',
            'ATOM 6 C CA . GLY V 1 1 ? 5 0 0 1 10 1 aa 1',
        ];
        const cif = `data_test
loop_
_entity.id
_entity.type
1 polymer
loop_
_entity_poly.entity_id
_entity_poly.type
1 polypeptide(L)
loop_
_atom_site.group_PDB
_atom_site.id
_atom_site.type_symbol
_atom_site.label_atom_id
_atom_site.label_alt_id
_atom_site.label_comp_id
_atom_site.label_asym_id
_atom_site.label_entity_id
_atom_site.label_seq_id
_atom_site.pdbx_PDB_ins_code
_atom_site.Cartn_x
_atom_site.Cartn_y
_atom_site.Cartn_z
_atom_site.occupancy
_atom_site.B_iso_or_equiv
_atom_site.auth_seq_id
_atom_site.auth_asym_id
_atom_site.pdbx_PDB_model_num
${rows.join('\n')}
`;
        const parsed = await CIF.parseText(cif).run();
        if (parsed.isError) throw new Error(parsed.message);
        const model = (await trajectoryFromMmCIF(parsed.result.blocks[0]).run()).representative;
        const structure = Structure.ofModel(model);
        select = vi.fn();
        plugin = {
            managers: { interactivity: { lociSelects: { select } }, structure: { hierarchy: { current: { structures: [
                { cell: { transform: { ref: 'ref' }, obj: { data: structure } } },
            ] } } } },
        } as any;
    });

    function atomIndices(loci: StructureElement.Loci | null): number[] {
        if (!loci) throw new Error('Expected a structure loci');
        return loci.elements.flatMap(({ unit, indices }) =>
            Array.from({ length: OrderedSet.size(indices) }, (_, i) =>
                unit.elements[OrderedSet.getAt(indices, i)]));
    }

    it('uses author priority, case-sensitive identities, and label aliases', () => {
        expect(atomIndices(getChainLoci(plugin, 'ref', 'E'))).toEqual([0]);
        expect(atomIndices(getChainLoci(plugin, 'ref', 'e'))).toEqual([1]);
        expect(atomIndices(getChainLoci(plugin, 'ref', 'G'))).toEqual([2]);
        expect(atomIndices(getChainLoci(plugin, 'ref', 'X'))).toEqual([0]);
        expect(atomIndices(getChainLoci(plugin, 'ref', 'Z'))).toEqual([3, 4]);
        expect(atomIndices(getChainLoci(plugin, 'ref', 'x'))).toEqual([0]);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(atomIndices(getChainLoci(plugin, 'ref', 'Aa'))).toEqual([]);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('intersects residue loci with the same resolved chain', () => {
        expect(atomIndices(getResidueLoci(plugin, 'ref', 'E', '1'))).toEqual([0]);
        expect(atomIndices(getResidueLoci(plugin, 'ref', 'e', '1'))).toEqual([1]);
        expect(atomIndices(getResidueLoci(plugin, 'ref', 'G', '1'))).toEqual([2]);
        expect(atomIndices(getResidueLoci(plugin, 'ref', 'Z', '1'))).toEqual([3, 4]);
        expect(atomIndices(getResidueLoci(plugin, 'ref', 'Z', '2'))).toEqual([]);
        expect(atomIndices(getResidueLoci(plugin, 'ref', 'Z', '1', 'B'))).toEqual([4]);
        expect(atomIndices(getResidueLoci(plugin, 'ref', 'Z', '1', 'C'))).toEqual([]);
        expect(atomIndices(getResiduesLoci(plugin, 'ref', 'Z', ['01', '1'], { '01': 'B', '1': 'C' }))).toEqual([4]);
        expect(atomIndices(getResiduesLoci(plugin, 'ref', 'Z', ['01', '1'], { '01': 'B' }))).toEqual([3, 4]);
        expect(atomIndices(getResiduesLoci(plugin, 'ref', 'Z', ['1'], { '1': '' }))).toEqual([3]);
        expect(atomIndices(getResiduesLoci(plugin, 'ref', 'Z', ['1:B']))).toEqual([4]);
        expect(atomIndices(getResiduesLoci(plugin, 'ref', 'Z', ['1', '1:B'], { '1': '' }))).toEqual([3, 4]);
    });

    it('keeps residue labels and atoms separate for shared author numbers', () => {
        const structure = getChainLoci(plugin, 'ref', 'Z')?.structure;
        if (!structure) throw new Error('Expected a structure');
        const info = getResidueInfo(structure, 'Z');
        expect([...info.residueLabels.keys()]).toEqual(['1', '1:B']);
        expect(info.residueToAtomIds['1']).toEqual(['3']);
        expect(info.residueToAtomIds['1:B']).toEqual(['4']);
    });

    it('round-trips exact loci without expanding insertion codes and rejects incompatible data', () => {
        const loci = getResidueLoci(plugin, 'ref', 'Z', '1', 'B');
        if (!loci) throw new Error('Expected a structure loci');
        const saved = JSON.parse(JSON.stringify(serializeResidueLoci(loci)));
        expect(atomIndices(restoreResidueLoci(plugin, 'ref', saved))).toEqual([4]);
        expect(restoreResidueLoci(plugin, 'ref', { ...saved, structureHash: saved.structureHash + 1 })).toBeNull();
        expect(restoreResidueLoci(plugin, 'ref', { ...saved, units: [{ ...saved.units[0], indices: [-1] }] })).toBeNull();
        expect(restoreResidueLoci(plugin, 'ref', { ...saved, units: [{ ...saved.units[0], indices: [999999] }] })).toBeNull();
    });

    it('passes resolved loci to highlights and unions case-distinct chains', () => {
        expect(atomIndices(getSubunitLoci(plugin, 'ref', ['E', 'e'])).sort()).toEqual([0, 1]);
        highlightLociOnChain(plugin, 'ref', 'G', 'halo');
        expect(atomIndices(select.mock.calls[0][0].loci)).toEqual([2]);
        highlightLociOnResidues(plugin, 'ref', 'Z', ['1'], undefined, 'halo');
        expect(atomIndices(select.mock.calls[1][0].loci)).toEqual([3, 4]);
    });
});

describe('structure', () => {
    let plugin: PluginUIContext;
    let structureRef: string;
    let chainId: string;
    let residueId: string;
    let insCode: string;

    beforeEach(() => {
        plugin = {
            managers: {
                structure: {
                    hierarchy: {
                        current: {
                            structures: [
                                {
                                    cell: {
                                        transform: { ref: 'test-ref' },
                                        obj: { data: {} }
                                    }
                                }
                            ]
                        }
                    }
                },
                camera: {
                    focusLoci: vi.fn()
                }
            }
        } as any;
        structureRef = 'test-ref';
        chainId = 'A';
        residueId = '1';
        insCode = '';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getChainLoci', () => {
        it('returns null if structure not found', () => {
            plugin.managers.structure.hierarchy.current.structures = [];
            expect(getChainLoci(plugin, structureRef, chainId)).toBeNull();
        });
        // Skipping positive test: would require full Mol* environment or ESM-compatible mocking
    });

    describe('getResidueLoci', () => {
        it('returns null if structure not found', () => {
            plugin.managers.structure.hierarchy.current.structures = [];
            expect(getResidueLoci(plugin, structureRef, chainId, residueId, insCode)).toBeNull();
        });
        // Skipping positive test: would require full Mol* environment or ESM-compatible mocking
    });

    describe('focusLociOnChain', () => {
        it('calls camera.focusLoci if loci is found', () => {
            focusLociOnChain(plugin, structureRef, chainId, undefined, () => lociObj);
            expect(plugin.managers.camera.focusLoci).toHaveBeenCalledWith(lociObj, undefined);
        });
        it('does not call camera.focusLoci if loci is null', () => {
            (plugin.managers.camera.focusLoci as ReturnType<typeof vi.fn>).mockClear();
            focusLociOnChain(plugin, structureRef, chainId, undefined, () => null);
            expect(plugin.managers.camera.focusLoci).not.toHaveBeenCalled();
        });
        it('passes extraRadius and minRadius as focus options when both are provided', () => {
            (plugin.managers.camera.focusLoci as ReturnType<typeof vi.fn>).mockClear();
            focusLociOnChain(plugin, structureRef, chainId, undefined, () => lociObj, 20, 16);
            expect(plugin.managers.camera.focusLoci).toHaveBeenCalledWith(
                lociObj,
                { extraRadius: 20, minRadius: 16 }
            );
        });
        it('passes no focus options when only one zoom param is provided', () => {
            (plugin.managers.camera.focusLoci as ReturnType<typeof vi.fn>).mockClear();
            // Only zoomExtraRadius provided → no options object
            focusLociOnChain(plugin, structureRef, chainId, undefined, () => lociObj, 20, undefined);
            expect(plugin.managers.camera.focusLoci).toHaveBeenCalledWith(lociObj, undefined);
        });
        it('also focuses sync plugin with same options when syncPlugin is provided', () => {
            const syncPlugin = {
                managers: { camera: { focusLoci: vi.fn() } }
            } as any;
          focusLociOnChain(plugin, structureRef, chainId, syncPlugin, () => lociObj, 10, 5, structureRef, chainId);
            expect(plugin.managers.camera.focusLoci).toHaveBeenCalledWith(
                lociObj, { extraRadius: 10, minRadius: 5 }
            );
            expect(syncPlugin.managers.camera.focusLoci).toHaveBeenCalledWith(
                lociObj, { extraRadius: 10, minRadius: 5 }
            );
        });
    });

    describe('focusLociOnResidue', () => {
        it('calls camera.focusLoci if loci is found', () => {
          focusLociOnResidue(plugin, structureRef, chainId, residueId, insCode, undefined, undefined, undefined, () => lociObj, undefined, undefined, undefined, undefined);
            expect(plugin.managers.camera.focusLoci).toHaveBeenCalled();
        });
        it('does not call camera.focusLoci if loci is null', () => {
            (plugin.managers.camera.focusLoci as ReturnType<typeof vi.fn>).mockClear();
          focusLociOnResidue(plugin, structureRef, chainId, residueId, insCode, undefined, undefined, undefined, () => null, undefined, undefined, undefined, undefined);
            expect(plugin.managers.camera.focusLoci).not.toHaveBeenCalled();
        });
    });
});

describe('getStructureRepresentations', () => {
  it('returns an empty array if no children', () => {
    const plugin = {
      state: {
        data: {
          tree: { children: new Map([["ref1", { toArray: () => [] }]]) },
          cells: new Map(),
        },
      },
    };
    const result = getStructureRepresentations(plugin, 'ref1');
    expect(result).toEqual([]);
  });

  it('returns Representation3D info for structure', () => {
    const repRef = 'rep1';
    const compRef = 'comp1';
    const structureRef = 'struct1';
    const colorTheme = { name: 'cartoon-color', params: {} };
    const repCell = {
      obj: { type: { name: 'Representation3D' }, props: { colorTheme: 'fallback-theme' } },
      transform: { params: { type: { name: 'cartoon' }, colorTheme } },
      state: { isHidden: false },
    };
    const compCell = { obj: { type: { name: 'Structure Component' } } };
    const plugin = {
      state: {
        data: {
          tree: {
            children: new Map([
              [structureRef, { toArray: () => [compRef] }],
              [compRef, { toArray: () => [repRef] }],
            ]),
          },
          cells: new Map([
            [compRef, compCell],
            [repRef, repCell],
          ]),
        },
      },
    };
    const result = getStructureRepresentations(plugin, structureRef);
    expect(result).toEqual([
      {
        type: 'cartoon',
        colorTheme,
        visible: true,
        repRef: repRef,
      },
    ]);
  });

  it('collects nested Representation3D nodes recursively', () => {
    const structureRef = 'struct1';
    const groupRef = 'group1';
    const nestedRepRef = 'nested-rep1';

    const nestedRepCell = {
      obj: { type: { name: 'Representation3D' } },
      transform: { params: { type: { name: 'line' }, colorTheme: { name: 'default', params: {} } } },
      state: { isHidden: true },
    };

    const plugin = {
      state: {
        data: {
          tree: {
            children: new Map([
              [structureRef, { toArray: () => [groupRef] }],
              [groupRef, { toArray: () => [nestedRepRef] }],
              [nestedRepRef, { toArray: () => [] }],
            ]),
          },
          cells: new Map<any, any>([
            [groupRef, { obj: { type: { name: 'Structure Component' } } }],
            [nestedRepRef, nestedRepCell],
          ]),
        },
      },
    };

    const result = getStructureRepresentations(plugin, structureRef);
    expect(result).toEqual([
      {
        type: 'line',
        colorTheme: { name: 'default', params: {} },
        visible: false,
        repRef: nestedRepRef,
      },
    ]);
  });
});
