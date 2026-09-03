/**
 * Test suite for useMolstarViewer hook.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { renderHook, act } from '@testing-library/react';
import { useMolstarViewer } from './useMolstarViewer';
import React from 'react';
import { vi } from 'vitest';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';

describe('useMolstarViewer', () => {
    it('initializes state and exposes API', () => {
        const pluginRef = React.createRef<PluginUIContext | null>();
        const { result } = renderHook(() => useMolstarViewer(pluginRef));
        expect(result.current).toHaveProperty('structureRefs');
        expect(result.current).toHaveProperty('setStructureRef');
        expect(result.current).toHaveProperty('representationRefs');
        expect(result.current).toHaveProperty('setRepresentationRefs');
        expect(result.current).toHaveProperty('lastAddedRepresentationRef');
        expect(result.current).toHaveProperty('setLastAddedRepresentationRef');
        expect(result.current).toHaveProperty('refreshRepresentationRefs');
        expect(result.current).toHaveProperty('addRepresentation');
        expect(result.current).toHaveProperty('getChainInfo');
        expect(result.current).toHaveProperty('repIdMap');
        expect(result.current).toHaveProperty('setRepIdMap');
        expect(result.current).toHaveProperty('getResidueInfo');
    });

    it('updates structureRefs and representationRefs state', () => {
        const pluginRef = React.createRef<PluginUIContext | null>();
        const { result } = renderHook(() => useMolstarViewer(pluginRef));
        act(() => {
            result.current.setStructureRef('foo', 'bar');
            result.current.setRepresentationRefs('foo', ['rep1', 'rep2']);
            result.current.setLastAddedRepresentationRef('foo', 'rep2');
            result.current.setRepIdMap('foo', { rep1: 'ref1' });
        });
        expect(result.current.structureRefs.foo).toBe('bar');
        expect(result.current.representationRefs.foo).toEqual(['rep1', 'rep2']);
        expect(result.current.lastAddedRepresentationRef.foo).toBe('rep2');
        expect(result.current.repIdMap.foo).toEqual({ rep1: 'ref1' });
    });

    it('restores camera snapshot after adding a representation', async () => {
        const pluginRef = React.createRef<PluginUIContext | null>();
        const commit = vi.fn().mockResolvedValue(undefined);
        const buildChain: any = {
            to: vi.fn().mockReturnThis(),
            apply: vi.fn().mockReturnThis(),
            commit,
            selector: { ref: 'rep-new' },
        };
        const cameraSnapshot = {
            position: [11, 12, 13],
            target: [1, 2, 3],
            up: [0, 1, 0],
            radius: 33,
        };
        const mockPlugin = {
            state: {
                data: {
                    build: vi.fn(() => buildChain),
                    cells: new Map([['rep-new', { transform: { ref: 'rep-new' } }]]),
                },
            },
            managers: {
                structure: {
                    hierarchy: {
                        current: {
                            structures: [
                                {
                                    cell: { transform: { ref: 'struct-1' } },
                                    components: [
                                        {
                                            key: 'polymer',
                                            cell: { transform: { ref: 'comp-1' } },
                                            representations: [
                                                { cell: { transform: { ref: 'rep-old' } } },
                                                { cell: { transform: { ref: 'rep-new' } } },
                                            ],
                                        },
                                    ],
                                },
                            ],
                        },
                    },
                },
            },
            canvas3d: {
                camera: {
                    state: {},
                    getSnapshot: vi.fn(() => cameraSnapshot),
                    setState: vi.fn(),
                },
                requestDraw: vi.fn(),
            },
        };

        pluginRef.current = mockPlugin as any;
        const { result } = renderHook(() => useMolstarViewer(pluginRef));

        await act(async () => {
            await result.current.addRepresentation('Aligned', 'struct-1', 'cartoon', { name: 'default' }, 'rep-id-1');
        });

        expect(mockPlugin.canvas3d.camera.setState).toHaveBeenCalledWith(expect.objectContaining({
            position: cameraSnapshot.position,
            target: cameraSnapshot.target,
            up: cameraSnapshot.up,
            radius: cameraSnapshot.radius,
        }));
        expect(mockPlugin.canvas3d.requestDraw).toHaveBeenCalled();
    });
});
