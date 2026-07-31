/**
 * Test suite for getStructureRepresentations utility.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { getStructureRepresentations, focusLociOnChain, focusLociOnResidue, getChainLoci, getResidueLoci } from './structure';

// Static mock for a valid Loci object
const lociObj = { kind: 'element-loci', structure: {}, elements: [] } as any;

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
