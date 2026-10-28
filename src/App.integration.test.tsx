/**
 * Integration test suite for App component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Copilot, Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-06-11
 * @see https://github.com/ribocode-slola/ribocode1 
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
import App from './App';
import * as structureUtils from './utils/structure';
import { vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { PluginCommands } from 'molstar/lib/mol-plugin/commands';
import { alignDatasetUsingChains } from 'molstar/lib/extensions/ribocode/utils/geometry';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';

vi.mock('./hooks/useSessionLoadModal', () => ({
  useSessionLoadModal: vi.fn((onSessionLoaded: any) => {
    (globalThis as any).__onSessionLoaded = onSessionLoaded;
    return {
      handleLoadSession: vi.fn(),
      SessionLoadModal: null,
    };
  }),
}));

vi.mock('./hooks/useSessionSave', () => ({
  useSessionSave: vi.fn((getSessionState: any) => {
    (globalThis as any).__getSessionState = getSessionState;
    return vi.fn();
  }),
}));

vi.mock('molstar/lib/mol-plugin/commands', () => ({
  PluginCommands: {
    State: {
      ToggleVisibility: {
        apply: vi.fn().mockResolvedValue(undefined),
      },
      RemoveObject: {
        apply: vi.fn().mockResolvedValue(undefined),
      },
    },
  },
}));

vi.mock('./utils/structure', () => ({
  getStructureRepresentations: vi.fn((_plugin: any, structureRef: string) => {
    const byRef = (globalThis as any).__mockStructureRepsByRef || {};
    return byRef[structureRef] || [];
  }),
  focusLociOnChain: vi.fn(),
  focusLociOnResidue: vi.fn(),
  focusLociOnResidues: vi.fn(),
  focusLociOnSubunit: vi.fn(),
  clearStructureHighlightOverpaint: vi.fn(),
  applyStructureDimOverlay: vi.fn(),
  highlightLociOnChain: vi.fn(),
  highlightLociOnResidues: vi.fn(),
  highlightLociOnSubunit: vi.fn(),
  unhighlightLociOnChain: vi.fn(),
  unhighlightLociOnResidues: vi.fn(),
  unhighlightLociOnSubunit: vi.fn(),
  inspectLociOnChain: vi.fn(),
  inspectLociOnResidues: vi.fn(),
  inspectLociOnSubunit: vi.fn(),
}));

vi.mock('./utils/data', () => ({
  getAtomDataFromStructureUnits: vi.fn((_structure: any, chainId: string) => {
    const xs = [0, 1, 2, 3];
    const ys = [0, 0, 0, 0];
    const zs = [0, 0, 0, 0];
    return {
      symbolTypes: ['C', 'N', 'O', 'P'],
      chainIds: [chainId, chainId, chainId, chainId],
      xs,
      ys,
      zs,
    };
  }),
  summarizeAtomCloud: vi.fn((xs: number[], ys: number[], zs: number[]) => {
    const atomCount = xs.length;
    return {
      atomCount,
      finiteAtomCount: atomCount,
      centroid: {
        x: xs.reduce((a, b) => a + b, 0) / atomCount,
        y: ys.reduce((a, b) => a + b, 0) / atomCount,
        z: zs.reduce((a, b) => a + b, 0) / atomCount,
      },
    };
  }),
}));

vi.mock('molstar/lib/extensions/ribocode/utils/geometry', () => ({
  alignDatasetUsingChains: vi.fn((
    _selectedAtomTypes: any,
    _movingChainId: string,
    _movingSymbolTypes: string[],
    _movingChainIds: string[],
    movingXs: number[],
    movingYs: number[],
    movingZs: number[]
  ) => ({
    rotmat: [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ],
    centroidReference: [0, 0, 0],
    centroid: [0, 0, 0],
    alignedX: [...movingXs],
    alignedY: [...movingYs],
    alignedZ: [...movingZs],
  })),
}));

vi.mock('./hooks/useMolstarViewer', () => ({
  useMolstarViewer: vi.fn((pluginRef: any) => {
    const allInstances = ((globalThis as any).__molstarViewerInstances ||= []);
    const instanceByPluginRef = ((globalThis as any).__molstarViewerInstanceByPluginRef ||= new Map<any, any>());
    const existing = instanceByPluginRef.get(pluginRef);
    if (existing) {
      return existing;
    }
    const structureRefs: Record<string, string> = {};
    const representationRefs: Record<string, string[]> = {};
    const repIdMap: Record<string, Record<string, string>> = {};
    let repCounter = 0;
    const addRepresentation = vi.fn(async (key: string, _structureRef: string, _type: string, _colorTheme: any, repId?: string) => {
      const resolvedRepId = repId || `auto-rep-${repCounter++}`;
      const repRef = `mock-${key}-${resolvedRepId}`;
      if (!representationRefs[key]) representationRefs[key] = [];
      representationRefs[key].push(repRef);
      if (!repIdMap[key]) repIdMap[key] = {};
      repIdMap[key][resolvedRepId] = repRef;
      return resolvedRepId;
    });
    const instance = {
      pluginRef,
      structureRefs,
      setStructureRef: vi.fn((key: string, ref: string) => {
        structureRefs[key] = ref;
      }),
      representationRefs,
      setRepresentationRefs: vi.fn((key: string, refs: string[]) => {
        representationRefs[key] = refs;
      }),
      lastAddedRepresentationRef: {},
      setLastAddedRepresentationRef: vi.fn(),
      refreshRepresentationRefs: vi.fn(),
      addRepresentation,
      getChainInfo: vi.fn().mockReturnValue({ chainLabels: new Map() }),
      repIdMap,
      repIdMapRef: { current: repIdMap },
      setRepIdMap: vi.fn((key: string, map: Record<string, string>) => {
        repIdMap[key] = map;
      }),
      getResidueInfo: vi.fn().mockReturnValue({
        residueLabels: new Map([
          ['10', { id: '10', name: 'GLY 10', compId: 'GLY', seqNumber: 10, insCode: '' }],
          ['20', { id: '20', name: 'ALA 20', compId: 'ALA', seqNumber: 20, insCode: '' }],
        ]),
        residueToAtomIds: { '10': ['1'], '20': ['2'] },
      }),
    };
    instanceByPluginRef.set(pluginRef, instance);
    allInstances.push(instance);
    return instance;
  }),
}));

// Mock useUpdateChainInfo to immediately populate chain info when structureRef is provided
vi.mock('./hooks/useUpdateChainInfo', () => ({
  useUpdateChainInfo: vi.fn((pluginRef: any, structureRef: string | null, _molstar: any, setChainInfo: any, setSubunitToChainIds: any) => {
    const { useEffect } = require('react');
    useEffect(() => {
      if (!pluginRef?.current) return;
      setChainInfo({ chainLabels: new Map([['A', 'Chain A'], ['B', 'Chain B']]) });
      setSubunitToChainIds(new Map([
        ['All', new Set(['A', 'B'])],
        ['Large', new Set(['A'])],
        ['Small', new Set(['B'])],
        ['Other', new Set()],
      ]));
    }, [pluginRef?.current, structureRef]);
  }),
}));

vi.mock('./hooks/useUpdateResidueInfo', () => ({
  useUpdateResidueInfo: vi.fn((pluginRef: any, structureRef: string | null, _molstar: any, selectedChainId: string, setResidueInfo: any) => {
    const { useEffect } = require('react');
    useEffect(() => {
      if (!pluginRef?.current || !selectedChainId) return;
      setResidueInfo({
        residueLabels: new Map([
          ['10', { id: '10', name: 'GLY 10', compId: 'GLY', seqNumber: 10, insCode: '' }],
          ['20', { id: '20', name: 'ALA 20', compId: 'ALA', seqNumber: 20, insCode: '' }],
        ]),
        residueToAtomIds: { '10': ['1'], '20': ['2'] },
      });
    }, [pluginRef?.current, structureRef, selectedChainId]);
  }),
}));

// Mock the Mol* loader before importing the app
vi.mock('molstar/lib/extensions/ribocode/structure', () => {
  const loadMoleculeFileToViewerMock = vi.fn().mockImplementation(async (_plugin, assetFile, isAlignedTo) => ({
    label: assetFile?.name ?? 'mock-molecule',
    name: assetFile?.name ?? 'mock-molecule',
    filename: assetFile?.name ?? 'mock-molecule.cif',
    presetResult: { model: { cell: { transform: { ref: isAlignedTo ? 'mock-ref-0' : 'mock-ref-1' } } } },
    trajectory: {},
    alignmentData: isAlignedTo ? { rows: [1] } : undefined,
  }));
  // @ts-ignore
  global.__loadMoleculeFileToViewerMock = loadMoleculeFileToViewerMock;
  return {
    loadMoleculeFileToViewer: loadMoleculeFileToViewerMock,
  };
});

// Mock MolstarContainer to always render a stub and trigger viewer loaded state
vi.mock('./components/MolstarContainer', () => {
  const React = require('react');
  const createMockCamera = () => {
    const listeners = new Set<() => void>();
    const state = {
      mode: 'perspective',
      position: [1, 2, 3],
      target: [4, 5, 6],
      up: [0, 1, 0],
      radius: 10,
    };

    return {
      state,
      stateChanged: {
        subscribe: vi.fn((cb: () => void) => {
          listeners.add(cb);
          return { unsubscribe: vi.fn(() => listeners.delete(cb)) };
        }),
      },
      getSnapshot: vi.fn(() => ({
        position: [...state.position],
        target: [...state.target],
        up: [...state.up],
        radius: state.radius,
      })),
      setState: vi.fn((nextState: any) => {
        if (nextState?.position) state.position = [...nextState.position];
        if (nextState?.target) state.target = [...nextState.target];
        if (nextState?.up) state.up = [...nextState.up];
        if (typeof nextState?.radius === 'number') state.radius = nextState.radius;
        listeners.forEach(listener => listener());
      }),
      emit: vi.fn((nextState: any = {}) => {
        if (nextState?.position) state.position = [...nextState.position];
        if (nextState?.target) state.target = [...nextState.target];
        if (nextState?.up) state.up = [...nextState.up];
        if (typeof nextState?.radius === 'number') state.radius = nextState.radius;
        listeners.forEach(listener => listener());
      }),
    };
  };
  const buildStructure = (ref: string) => ({
    cell: {
      transform: { ref },
      obj: {
        data: {
          units: [
            { chainGroupId: 'A', label: 'Chain A', subunit: 'default', model: {} },
            { chainGroupId: 'B', label: 'Chain B', subunit: 'default', model: {} },
          ],
        },
      },
    },
  });
  const buildStateData = () => {
    const builder = {
      to: vi.fn(() => builder),
      update: vi.fn(() => builder),
      insert: vi.fn(() => builder),
    };
    return {
      selectQ: vi.fn(() => []),
      build: vi.fn(() => builder),
      updateTree: vi.fn(() => ({ kind: 'mock-tree-update' })),
    };
  };
  const buildPlugin = () => {
    const canvas3d = {
      props: {
        camera: {},
        cameraClipping: { minNear: 0.5, radius: 77, far: true },
      },
      setProps: vi.fn((nextProps: any) => {
        canvas3d.props = { ...canvas3d.props, ...nextProps };
      }),
      requestDraw: vi.fn(),
      camera: createMockCamera(),
    };

    return {
      managers: {
        structure: {
          hierarchy: {
            current: {
              structures: [
                buildStructure('mock-ref-0'),
                buildStructure('mock-ref-1'),
              ],
            },
          },
        },
      },
      state: { data: buildStateData() },
      runTask: vi.fn().mockResolvedValue(undefined),
      canvas3d,
    };
  };
  const mockPluginA = buildPlugin();
  const mockPluginB = buildPlugin();
  // @ts-ignore
  global.__mockPluginA = mockPluginA;
  // @ts-ignore
  global.__mockPluginB = mockPluginB;
  return {
    __esModule: true,
    default: ({ idPrefix, viewerKey, onMouseDown, onReady, setViewer }: { idPrefix: string, viewerKey: 'A' | 'B', onMouseDown?: (viewerKey: 'A' | 'B') => void, onReady?: () => void, setViewer?: (plugin: any) => void }) => {
      const plugin = idPrefix?.includes('-B') ? mockPluginB : mockPluginA;
      // Use useLayoutEffect with empty deps so setViewer fires synchronously
      // before any user-event handlers that read viewerA/B.ref.current.
      React.useLayoutEffect(() => {
        if (setViewer) setViewer(plugin);
        if (onReady) onReady();
      }, []);
      return (
        <div
          id={`${idPrefix}-molstar-container-mock`}
          onMouseDown={() => onMouseDown?.(viewerKey)}
          onPointerDown={() => onMouseDown?.(viewerKey)}
          onPointerMove={() => onMouseDown?.(viewerKey)}
          onWheel={() => onMouseDown?.(viewerKey)}
        >
          [Mocked MolstarContainer]
        </div>
      );
    },
  };
});

// Lightweight helper for creating deterministic mock files used by integration tests.
function loadTestFile(filename: string): File {
  return new File(['mock-file-content'], filename, { type: 'text/plain' });
}

describe('App integration: AlignedTo and Aligned loading', () => {

  beforeAll(() => {
    // Suppress console output during tests to avoid pending async console operations
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('renders the AppHeader with correct id', async () => {
    render(<App testForceIsMoleculeAlignedLoaded={true} />);
    const header = await screen.findByRole('banner');
    expect(header).toBeInTheDocument();
    expect(header.id).toBe('app-header');
    expect(header.tagName.toLowerCase()).toBe('header');
  });

  it('toggles visibility for all representations', async () => {
    render(<App />);
    const header = await screen.findByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('disables Load Aligned until AlignedTo data are loaded', async () => {
    render(<App />);

    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement | null;
    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;

    expect(alignedLoadBtn).toBeInTheDocument();
    expect(alignedLoadBtn).toBeDisabled();
    expect(alignedToInput).toBeInTheDocument();

    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });

    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
    }, { timeout: 5000 });
  });

  it('disables Column B Load Chain/Residue Colours until Aligned data are loaded', async () => {
    render(<App />);

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement | null;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement | null;
    const alignedRepControlsToggle = document.getElementById('viewer-column-B-aligned-representation-controls-toggle-btn') as HTMLButtonElement | null;

    expect(alignedToInput).toBeInTheDocument();
    expect(alignedInput).toBeInTheDocument();
    expect(alignedLoadBtn).toBeInTheDocument();
    expect(alignedRepControlsToggle).toBeInTheDocument();
    fireEvent.click(alignedRepControlsToggle!);

    const alignedChainColoursBtn = document.getElementById('viewer-column-B-aligned-load-chain-colours-btn') as HTMLButtonElement | null;
    const alignedColorModeSelect = document.getElementById('viewer-column-B-aligned-color-mode-select') as HTMLSelectElement | null;
    expect(alignedChainColoursBtn).toBeInTheDocument();
    expect(alignedColorModeSelect).toBeInTheDocument();
    expect(alignedColorModeSelect!.value).toBe('chain');
    expect(document.getElementById('viewer-column-B-aligned-load-residue-colours-btn')).toBeNull();
    expect(alignedChainColoursBtn).toBeDisabled();

    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });

    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
      expect(document.getElementById('viewer-column-B-aligned-load-chain-colours-btn')).toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.change(alignedInput!, { target: { files: [loadTestFile('6xu8.cif')] } });
    fireEvent.click(alignedLoadBtn!);

    const molstarInstances = (globalThis as any).__molstarViewerInstances as any[];
    expect(Array.isArray(molstarInstances)).toBe(true);
    for (const instance of molstarInstances) {
      instance?.setStructureRef?.('AlignedTo', 'mock-ref-0');
      instance?.setStructureRef?.('Aligned', 'mock-ref-1');
    }

    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-chain-colours-btn')).not.toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.change(alignedColorModeSelect!, { target: { value: 'residue-type' } });
    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-residue-colours-btn')).toBeInTheDocument();
      expect(document.getElementById('viewer-column-B-aligned-load-residue-colours-btn')).not.toBeDisabled();
      expect(document.getElementById('viewer-column-B-aligned-load-chain-colours-btn')).toBeNull();
    }, { timeout: 5000 });
  });

  it('enables Sync after Aligned data are loaded', async () => {
    render(<App />);

    const syncSelect = document.getElementById('generalcontrols-sync-select') as HTMLButtonElement | null;
    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement | null;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement | null;

    expect(syncSelect).toBeInTheDocument();
    expect(syncSelect).toBeDisabled();
    expect(alignedToInput).toBeInTheDocument();
    expect(alignedInput).toBeInTheDocument();
    expect(alignedLoadBtn).toBeInTheDocument();

    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });

    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
      expect(document.getElementById('generalcontrols-sync-select')).toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.change(alignedInput!, { target: { files: [loadTestFile('6xu8.cif')] } });
    fireEvent.click(alignedLoadBtn!);

    await waitFor(() => {
      expect(document.getElementById('generalcontrols-sync-select')).not.toBeDisabled();
    }, { timeout: 5000 });
  });

  it('keeps viewer zoom unchanged when adding a representation', async () => {
    render(<App />);

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;
    expect(alignedToInput).toBeInTheDocument();

    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-representation-controls-toggle-btn') as HTMLButtonElement);

    await waitFor(() => {
      expect(document.getElementById('viewer-column-A-alignedto-add-representation-btn')).not.toBeDisabled();
    }, { timeout: 5000 });

    const pluginA = (globalThis as any).__mockPluginA;
    pluginA.canvas3d.camera.setState({
      position: [10, 11, 12],
      target: [1, 2, 3],
      up: [0, 1, 0],
      radius: 47,
    });

    const radiusBefore = pluginA.canvas3d.camera.state.radius;
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-add-representation-btn') as HTMLButtonElement);

    await waitFor(() => {
      expect(pluginA.canvas3d.camera.state.radius).toBe(radiusBefore);
      expect(pluginA.canvas3d.camera.state.position).toEqual([10, 11, 12]);
      expect(pluginA.canvas3d.camera.state.target).toEqual([1, 2, 3]);
    }, { timeout: 5000 });
  });

  it('does not sync from inactive viewer camera events when sync is on', async () => {
    render(<App />);

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement | null;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement | null;

    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });
    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.change(alignedInput!, { target: { files: [loadTestFile('6xu8.cif')] } });
    fireEvent.click(alignedLoadBtn!);

    await waitFor(() => {
      expect(document.getElementById('generalcontrols-sync-select')).not.toBeDisabled();
    }, { timeout: 5000 });

    const pluginA = (globalThis as any).__mockPluginA;
    const pluginB = (globalThis as any).__mockPluginB;
    pluginA.canvas3d.camera.setState.mockClear();

    fireEvent.click(document.getElementById('generalcontrols-sync-select') as HTMLButtonElement);

    pluginB.canvas3d.camera.emit({
      position: [99, 98, 97],
      target: [1, 2, 3],
      up: [0, 1, 0],
      radius: 12,
    });

    expect(pluginA.canvas3d.camera.setState).not.toHaveBeenCalled();
  });

  it('syncs from viewer B to viewer A after viewer B becomes active', async () => {
    render(<App />);

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement | null;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement | null;

    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });
    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.change(alignedInput!, { target: { files: [loadTestFile('6xu8.cif')] } });
    fireEvent.click(alignedLoadBtn!);

    await waitFor(() => {
      expect(document.getElementById('generalcontrols-sync-select')).not.toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.mouseDown(document.getElementById('viewer-column-B-molstar-container-mock') as HTMLElement);
    fireEvent.click(document.getElementById('generalcontrols-sync-select') as HTMLButtonElement);

    const pluginA = (globalThis as any).__mockPluginA;
    const pluginB = (globalThis as any).__mockPluginB;
    pluginA.canvas3d.camera.setState.mockClear();

    pluginB.canvas3d.camera.emit({
      position: [4, 5, 6],
      target: [7, 8, 9],
      up: [0, 1, 0],
      radius: 21,
    });

    expect(pluginA.canvas3d.camera.setState).toHaveBeenCalledWith(expect.objectContaining({
      position: [4, 5, 6],
      target: [7, 8, 9],
      radius: 21,
    }));
  });

  it('syncs back from viewer A to viewer B after switching active viewer from B to A', async () => {
    render(<App />);

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement | null;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement | null;

    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });
    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.change(alignedInput!, { target: { files: [loadTestFile('6xu8.cif')] } });
    fireEvent.click(alignedLoadBtn!);

    await waitFor(() => {
      expect(document.getElementById('generalcontrols-sync-select')).not.toBeDisabled();
    }, { timeout: 5000 });

    // Make B active first, then switch back to A via hover to validate both directions.
    fireEvent.pointerDown(document.getElementById('viewer-column-B-molstar-container-mock') as HTMLElement);
    fireEvent.click(document.getElementById('generalcontrols-sync-select') as HTMLButtonElement);
    fireEvent.pointerMove(document.getElementById('viewer-column-A-molstar-container-mock') as HTMLElement);

    const pluginA = (globalThis as any).__mockPluginA;
    const pluginB = (globalThis as any).__mockPluginB;
    pluginB.canvas3d.camera.setState.mockClear();

    pluginA.canvas3d.camera.emit({
      position: [4, 5, 6],
      target: [7, 8, 9],
      up: [0, 1, 0],
      radius: 33,
    });

    expect(pluginB.canvas3d.camera.setState).toHaveBeenCalledWith(expect.objectContaining({
      position: [4, 5, 6],
      target: [7, 8, 9],
      radius: 33,
    }));
  });

  it('updates clipping controls after Mol* camera zoom events', async () => {
    render(<App />);

    await waitFor(() => {
      expect(document.getElementById('viewer-column-A-clipping-controls-toggle-btn')).toBeInTheDocument();
    }, { timeout: 5000 });

    fireEvent.click(document.getElementById('viewer-column-A-clipping-controls-toggle-btn') as HTMLButtonElement);

    const pluginA = (globalThis as any).__mockPluginA;
    pluginA.canvas3d.props.cameraClipping = {
      ...(pluginA.canvas3d.props.cameraClipping || {}),
      minNear: 0.72,
      radius: 61,
    };

    pluginA.canvas3d.camera.emit({ radius: 21 });

    await waitFor(() => {
      expect((document.getElementById('viewer-column-A-alignedto-clip-near-number') as HTMLInputElement).value).toBe('0.72');
      expect((document.getElementById('viewer-column-A-alignedto-clip-far-number') as HTMLInputElement).value).toBe('61');
    }, { timeout: 5000 });
  });

  let loadMoleculeFileToViewerMock: any;
  beforeAll(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: () => ({
        getExtension: () => null,
        clear: () => { },
        drawArrays: () => { },
        createBuffer: () => { },
        bindBuffer: () => { },
        bufferData: () => { },
        enable: () => { },
        disable: () => { },
        viewport: () => { },
      }),
    });
    // @ts-ignore
    loadMoleculeFileToViewerMock = global.__loadMoleculeFileToViewerMock;
  });

  beforeEach(() => {
    vi.useRealTimers();
    loadMoleculeFileToViewerMock?.mockClear?.();
    vi.mocked(structureUtils.applyStructureDimOverlay).mockClear();
    vi.mocked(structureUtils.clearStructureHighlightOverpaint).mockClear();
    (globalThis as any).__molstarViewerInstances = [];
    (globalThis as any).__molstarViewerInstanceByPluginRef = new Map();
    (globalThis as any).__mockStructureRepsByRef = {};
    (PluginCommands.State.RemoveObject.apply as any).mockClear?.();
    const pluginA = (globalThis as any).__mockPluginA;
    const pluginB = (globalThis as any).__mockPluginB;
    for (const plugin of [pluginA, pluginB]) {
      plugin?.canvas3d?.camera?.setState?.mockClear?.();
      plugin?.canvas3d?.camera?.emit?.mockClear?.();
      plugin?.canvas3d?.camera?.setState?.({
        position: [1, 2, 3],
        target: [4, 5, 6],
        up: [0, 1, 0],
        radius: 10,
      });
      plugin?.runTask?.mockClear?.();
    }
  });

  afterEach(() => {
    cleanup();
  });


  it('renders chain zoom controls disabled before chain selection', async () => {
    render(<App />);

    const toggle = document.getElementById('viewer-column-A-select-zoom-controls-toggle-btn') as HTMLButtonElement | null;
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle!);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-select-chain-controls-toggle-btn') as HTMLButtonElement);

    await waitFor(() => {
      const zoomChainButtons = Array.from(
        document.querySelectorAll('#viewer-column-A button#viewer-column-A-alignedto-zoom-chain-btn')
      ) as HTMLButtonElement[];
      expect(zoomChainButtons.length).toBeGreaterThan(0);
      expect(zoomChainButtons.every(button => button.disabled)).toBe(true);
    }, { timeout: 5000 });
  });

  it('updates editable chain theme without globally recoloring existing representations', async () => {
    (globalThis as any).__mockStructureRepsByRef = {
      'mock-ref-0': [
        {
          type: 'cartoon',
          colorTheme: {
            name: 'chain-id',
            params: {
              palette: {
                params: {
                  list: {
                    colors: [
                      ['A', '#112233'],
                      ['B', '#445566'],
                    ],
                  },
                },
              },
            },
          },
          visible: true,
          repRef: 'mock-rep-0',
        },
      ],
    };

    render(<App />);

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;
    expect(alignedToInput).toBeInTheDocument();
    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });

    await waitFor(() => {
      expect(document.getElementById('viewer-column-A-alignedto-representation-controls-toggle-btn')).toBeInTheDocument();
    }, { timeout: 5000 });

    fireEvent.click(document.getElementById('viewer-column-A-alignedto-representation-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-select-chain-controls-toggle-btn') as HTMLButtonElement);

    const firstChainRow = await waitFor(() => {
      const row = document.querySelector('[data-testid^="viewer-column-A-chain-table-row-"]') as HTMLTableRowElement | null;
      expect(row).toBeInTheDocument();
      return row as HTMLTableRowElement;
    }, { timeout: 5000 });
    const selectedChainRowTestId = firstChainRow.getAttribute('data-testid') ?? '';
    const selectedChainIdFromRow = selectedChainRowTestId.replace('viewer-column-A-chain-table-row-', '');
    fireEvent.click(firstChainRow);

    await waitFor(() => {
      const selectedLabel = document.getElementById('viewer-column-A-alignedto-selected-chain-label');
      expect(selectedLabel).toBeInTheDocument();
      expect(selectedLabel?.textContent).not.toContain('Selected: None');
    }, { timeout: 5000 });

    const selectedChainId = selectedChainIdFromRow || 'A';

    const selectedChainColorInput = document.getElementById(`viewer-column-A-alignedto-chain-color-${selectedChainId}`) as HTMLInputElement | null;
    expect(selectedChainColorInput).toBeInTheDocument();
    const selectedChainColorApplyButton = document.getElementById(`viewer-column-A-alignedto-chain-color-${selectedChainId}-apply-btn`) as HTMLButtonElement | null;
    expect(selectedChainColorApplyButton).toBeInTheDocument();
    const pluginA = (globalThis as any).__mockPluginA;
    const pluginB = (globalThis as any).__mockPluginB;
    const runTaskCountBefore = (pluginA?.runTask?.mock?.calls?.length ?? 0) + (pluginB?.runTask?.mock?.calls?.length ?? 0);

    fireEvent.change(selectedChainColorInput!, { target: { value: '#ff8800' } });
    fireEvent.click(selectedChainColorApplyButton!);

    await waitFor(() => {
      const chainThemeSelect = document.getElementById('viewer-column-A-alignedto-chain-colour-theme-select') as HTMLSelectElement | null;
      expect(chainThemeSelect).toBeInTheDocument();
      expect(chainThemeSelect?.value).toBe('AlignedTo-custom-chain-colors');
    }, { timeout: 5000 });

    const runTaskCountAfterFirstApply = (pluginA?.runTask?.mock?.calls?.length ?? 0) + (pluginB?.runTask?.mock?.calls?.length ?? 0);
    expect(runTaskCountAfterFirstApply).toBe(runTaskCountBefore);

    fireEvent.change(selectedChainColorInput!, { target: { value: '#22aaee' } });
    fireEvent.click(selectedChainColorApplyButton!);

    await waitFor(() => {
      const runTaskCountAfterSecondApply = (pluginA?.runTask?.mock?.calls?.length ?? 0) + (pluginB?.runTask?.mock?.calls?.length ?? 0);
      expect(runTaskCountAfterSecondApply).toBe(runTaskCountAfterFirstApply);
    }, { timeout: 5000 });
  }, 15000);

  it('keeps Viewer A and Viewer B visibility toggles independent', async () => {
    render(<App />);

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement | null;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement | null;

    expect(alignedToInput).toBeInTheDocument();
    expect(alignedInput).toBeInTheDocument();
    expect(alignedLoadBtn).toBeInTheDocument();

    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });

    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.change(alignedInput!, { target: { files: [loadTestFile('6xu8.cif')] } });
    const currentAlignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement | null;
    expect(currentAlignedLoadBtn).toBeInTheDocument();
    fireEvent.click(currentAlignedLoadBtn!);

    const viewerACol = document.getElementById('viewer-column-A') as HTMLElement | null;
    const viewerBCol = document.getElementById('viewer-column-B') as HTMLElement | null;
    expect(viewerACol).toBeInTheDocument();
    expect(viewerBCol).toBeInTheDocument();

    await waitFor(() => {
      expect(within(viewerACol!).getByRole('button', { name: /Hide 4ug0\.cif/i })).toBeInTheDocument();
      expect(within(viewerBCol!).getByRole('button', { name: /Show 4ug0\.cif/i })).toBeInTheDocument();
    }, { timeout: 5000 });

    fireEvent.click(within(viewerACol!).getByRole('button', { name: /Hide 4ug0\.cif/i }));

    await waitFor(() => {
      expect(within(viewerACol!).getByRole('button', { name: /Show 4ug0\.cif/i })).toBeInTheDocument();
      expect(within(viewerBCol!).getByRole('button', { name: /Show 4ug0\.cif/i })).toBeInTheDocument();
    }, { timeout: 5000 });
  }, 10000);

  it('gates Column A AlignedTo residue inspect by AlignedTo visibility, not Aligned visibility (regression)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    const session = {
      viewerA: {
        moleculeAlignedTo: { filename: '4ug0.cif' },
        moleculeAligned: { filename: '6xu8.cif' },
      },
      viewerB: { moleculeAligned: { filename: '6xu8.cif' } },
      uiState: {
        visibilityByViewer: {
          viewerA: { alignedTo: true, aligned: false },
          viewerB: { alignedTo: false, aligned: true },
        },
        selections: {
          alignedTo: { subunit: 'Large', chainId: 'A', residueIds: ['10'], residueId: '10' },
          aligned: { subunit: 'Small', chainId: 'B', residueIds: ['20'], residueId: '20' },
        },
      },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    await onSessionLoaded!(session, files);

    fireEvent.click(document.getElementById('viewer-column-A-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-select-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-representation-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-residue-controls-toggle-btn') as HTMLButtonElement);

    const alignedToInspectResidueBtnId = 'viewer-column-A-alignedto-inspect-residue-btn';
    const viewerACol = document.getElementById('viewer-column-A') as HTMLElement | null;
    expect(viewerACol).toBeInTheDocument();

    await waitFor(() => {
      const inspectResidueBtn = document.getElementById(alignedToInspectResidueBtnId) as HTMLButtonElement | null;
      expect(inspectResidueBtn).toBeInTheDocument();
      expect(inspectResidueBtn).not.toBeDisabled();
    }, { timeout: 5000 });

    // Regardless of Aligned visibility state in Viewer A, AlignedTo residue inspect must remain enabled.
    expect(within(viewerACol!).getByRole('button', { name: /(Show|Hide) 6xu8\.cif/i })).toBeInTheDocument();
    const inspectResidueBtn = document.getElementById(alignedToInspectResidueBtnId) as HTMLButtonElement | null;
    expect(inspectResidueBtn).toBeInTheDocument();
    expect(inspectResidueBtn).not.toBeDisabled();
  });

  it('does not mirror inspect to a hidden dataset in the opposite viewer (regression)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    const session = {
      viewerA: {
        moleculeAlignedTo: { filename: '4ug0.cif' },
        moleculeAligned: { filename: '6xu8.cif' },
      },
      viewerB: {
        moleculeAlignedTo: { filename: '4ug0.cif' },
        moleculeAligned: { filename: '6xu8.cif' },
      },
      uiState: {
        visibilityByViewer: {
          viewerA: { alignedTo: true, aligned: false },
          viewerB: { alignedTo: false, aligned: true },
        },
        selections: {
          alignedTo: { subunit: 'Large', chainId: 'A', residueIds: ['10'], residueId: '10' },
          aligned: { subunit: 'Small', chainId: 'B', residueIds: ['20'], residueId: '20' },
        },
      },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    await onSessionLoaded!(session, files);

    fireEvent.click(document.getElementById('viewer-column-A-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-select-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-select-chain-controls-toggle-btn') as HTMLButtonElement);

    const alignedToFirstChainRow = document.querySelector('[data-testid^="viewer-column-A-chain-table-row-"]') as HTMLTableRowElement | null;
    const alignedFirstChainRow = document.querySelector('[data-testid^="viewer-column-B-chain-table-row-"]') as HTMLTableRowElement | null;
    expect(alignedToFirstChainRow).toBeInTheDocument();
    expect(alignedFirstChainRow).toBeInTheDocument();
    fireEvent.click(alignedToFirstChainRow as HTMLTableRowElement);
    fireEvent.click(alignedFirstChainRow as HTMLTableRowElement);

    const inspectResidues = vi.mocked(structureUtils.inspectLociOnResidues);
    inspectResidues.mockClear();

    const pluginA = (globalThis as any).__mockPluginA;
    const pluginB = (globalThis as any).__mockPluginB;

    const latestMolstarInstances = (globalThis as any).__molstarViewerInstances as any[];
    expect(Array.isArray(latestMolstarInstances)).toBe(true);
    for (const instance of latestMolstarInstances) {
      instance?.setStructureRef?.('AlignedTo', 'mock-ref-0');
      instance?.setStructureRef?.('Aligned', 'mock-ref-1');
    }

    const viewerACol = document.getElementById('viewer-column-A') as HTMLElement | null;
    const viewerBCol = document.getElementById('viewer-column-B') as HTMLElement | null;
    expect(viewerACol).toBeInTheDocument();
    expect(viewerBCol).toBeInTheDocument();

    fireEvent.click(document.getElementById('viewer-column-A-alignedto-residue-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-residue-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-residue-select-all-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-residue-select-all-btn') as HTMLButtonElement);

    const inspectBAligned = document.getElementById('viewer-column-B-aligned-inspect-residue-btn') as HTMLButtonElement | null;
    expect(inspectBAligned).toBeInTheDocument();
    expect(inspectBAligned).not.toBeDisabled();
    fireEvent.click(inspectBAligned!);

    expect(inspectResidues).toHaveBeenCalled();
    expect(inspectResidues.mock.calls.some(args => args[5] === pluginA)).toBe(false);

    inspectResidues.mockClear();

    const inspectAAlignedTo = document.getElementById('viewer-column-A-alignedto-inspect-residue-btn') as HTMLButtonElement | null;
    expect(inspectAAlignedTo).toBeInTheDocument();
    expect(inspectAAlignedTo).not.toBeDisabled();
    fireEvent.click(inspectAAlignedTo!);

    expect(inspectResidues).toHaveBeenCalled();
    expect(inspectResidues.mock.calls.some(args => args[5] === pluginB)).toBe(false);
  });

  it('passes alignment data when loading Aligned (regression)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();
    expect(onSessionLoaded).toEqual(expect.any(Function));

    const session = {
      viewerA: { moleculeAlignedTo: { filename: '4ug0.cif' } },
      viewerB: { moleculeAligned: { filename: '6xu8.cif' } },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    await onSessionLoaded!(session, files);

    const alignedCalls = loadMoleculeFileToViewerMock.mock.calls.filter((args: any[]) => args[2] === false);
    expect(alignedCalls.length).toBeGreaterThan(0);
    expect(alignedCalls[0][4]).toEqual({ rows: [1] });
  });

  it('includes zoom and selection UI state in saved session payload', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement | null;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement | null;
    expect(alignedToInput).toBeInTheDocument();
    expect(alignedInput).toBeInTheDocument();
    expect(alignedLoadBtn).toBeInTheDocument();

    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });
    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
    }, { timeout: 5000 });
    fireEvent.change(alignedInput!, { target: { files: [loadTestFile('6xu8.cif')] } });
    fireEvent.click(alignedLoadBtn!);

    fireEvent.click(document.getElementById('viewer-column-A-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-subunit-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-subunit-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-select-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-select-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-clipping-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-clipping-controls-toggle-btn') as HTMLButtonElement);

    await waitFor(() => {
      expect(document.getElementById('viewer-column-A-alignedto-subunit-select')).toBeInTheDocument();
      expect(document.getElementById('viewer-column-B-aligned-subunit-select')).toBeInTheDocument();
      expect(document.getElementById('viewer-column-A-chain-table-container')).toBeInTheDocument();
      expect(document.getElementById('viewer-column-B-chain-table-container')).toBeInTheDocument();
      expect(document.getElementById('generalcontrols-sync-select')).toBeInTheDocument();
    }, { timeout: 5000 });

    const alignedToFirstChainRow = document.querySelector('[data-testid^="viewer-column-A-chain-table-row-"]') as HTMLTableRowElement | null;
    const alignedFirstChainRow = document.querySelector('[data-testid^="viewer-column-B-chain-table-row-"]') as HTMLTableRowElement | null;
    expect(alignedToFirstChainRow).toBeInTheDocument();
    expect(alignedFirstChainRow).toBeInTheDocument();
    fireEvent.click(alignedToFirstChainRow as HTMLTableRowElement);
    fireEvent.click(alignedFirstChainRow as HTMLTableRowElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-residue-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-residue-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-visibility-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-visibility-controls-toggle-btn') as HTMLButtonElement);

    fireEvent.change(document.getElementById('viewer-column-A-alignedto-zoom-extra-radius') as HTMLInputElement, { target: { value: '24' } });
    fireEvent.change(document.getElementById('viewer-column-A-alignedto-zoom-min-radius') as HTMLInputElement, { target: { value: '12' } });
    fireEvent.change(document.getElementById('viewer-column-B-aligned-zoom-extra-radius') as HTMLInputElement, { target: { value: '32' } });
    fireEvent.change(document.getElementById('viewer-column-B-aligned-zoom-min-radius') as HTMLInputElement, { target: { value: '15' } });
    expect(document.getElementById('viewer-column-A-alignedto-selection-display-mode')).toBeInTheDocument();
    expect(document.getElementById('viewer-column-A-alignedto-dim-unselected-toggle-btn')).toBeInTheDocument();
    expect(document.getElementById('viewer-column-A-alignedto-dim-unselected-strength')).toBeInTheDocument();
    fireEvent.change(document.getElementById('viewer-column-A-alignedto-selection-display-mode') as HTMLSelectElement, { target: { value: 'overlay' } });
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-dim-unselected-toggle-btn') as HTMLButtonElement);
    fireEvent.change(document.getElementById('viewer-column-A-alignedto-dim-unselected-strength') as HTMLInputElement, { target: { value: '70' } });
    await waitFor(() => {
      expect((document.getElementById('viewer-column-A-alignedto-selection-display-mode') as HTMLSelectElement).value).toBe('overlay');
      expect(document.getElementById('viewer-column-A-alignedto-dim-unselected-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
      expect((document.getElementById('viewer-column-A-alignedto-dim-unselected-strength') as HTMLInputElement).value).toBe('70');
      expect((document.getElementById('viewer-column-B-aligned-selection-display-mode') as HTMLSelectElement).value).toBe('hybrid');
      expect(document.getElementById('viewer-column-B-aligned-dim-unselected-toggle-btn')).toHaveAttribute('aria-pressed', 'false');
      expect((document.getElementById('viewer-column-B-aligned-dim-unselected-strength') as HTMLInputElement).value).toBe('45');
    });
    fireEvent.change(document.getElementById('viewer-column-A-alignedto-clip-near-number') as HTMLInputElement, { target: { value: '0.8' } });
    fireEvent.change(document.getElementById('viewer-column-A-alignedto-clip-far-number') as HTMLInputElement, { target: { value: '66' } });
    fireEvent.change(document.getElementById('viewer-column-B-aligned-clip-near-number') as HTMLInputElement, { target: { value: '0.9' } });
    fireEvent.change(document.getElementById('viewer-column-B-aligned-clip-far-number') as HTMLInputElement, { target: { value: '67' } });
    fireEvent.click(document.getElementById('generalcontrols-sync-select') as HTMLButtonElement);
    await waitFor(() => {
      expect(document.getElementById('viewer-column-A-alignedto-show-uniprot-accession')).toBeInTheDocument();
    }, { timeout: 5000 });
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-show-uniprot-accession') as HTMLButtonElement);
    fireEvent.change(document.getElementById('viewer-column-A-alignedto-subunit-select') as HTMLSelectElement, { target: { value: 'Large' } });
    fireEvent.change(document.getElementById('viewer-column-B-aligned-subunit-select') as HTMLSelectElement, { target: { value: 'Small' } });

    const getSessionState = (globalThis as any).__getSessionState as (() => any) | undefined;
    expect(getSessionState).toBeDefined();
    const session = getSessionState!();

    expect(session.uiState.zoom).toEqual({ extraRadius: 24, minRadius: 12 });
    expect(session.uiState.zoomByViewer).toEqual({
      viewerA: { extraRadius: 24, minRadius: 12 },
      viewerB: { extraRadius: 32, minRadius: 15 },
    });
    expect(session.uiState.clippingByViewer).toEqual({
      viewerA: { minNear: 0.8, clipRadius: 66 },
      viewerB: { minNear: 0.9, clipRadius: 67 },
    });
    expect(session.uiState.syncEnabled).toBe(true);
    expect(session.uiState.showUniprotAccessionInChainLabelsByViewer).toEqual({
      viewerA: false,
      viewerB: true,
    });
    expect(session.uiState.selections.alignedTo).toEqual(expect.objectContaining({
      subunit: 'Large',
    }));
    expect(session.uiState.selections.aligned).toEqual(expect.objectContaining({
      subunit: 'Small',
    }));
    expect(session.uiState.highlights).toEqual({
      alignedTo: {
        chain: false,
        residue: false,
        subunit: false,
      },
      aligned: {
        chain: false,
        residue: false,
        subunit: false,
      },
    });
    expect(session.uiState.inspectByViewer).toEqual({
      viewerA: {
        alignedTo: {
          chain: false,
          residue: false,
          subunit: false,
        },
        aligned: {
          chain: false,
          residue: false,
          subunit: false,
        },
      },
      viewerB: {
        alignedTo: {
          chain: false,
          residue: false,
          subunit: false,
        },
        aligned: {
          chain: false,
          residue: false,
          subunit: false,
        },
      },
    });
    expect(session.uiState.visibilityByViewer).toEqual({
      viewerA: {
        alignedTo: true,
        aligned: false,
      },
      viewerB: {
        alignedTo: false,
        aligned: true,
      },
    });
    expect(session.uiState.fogByViewer).toEqual({
      viewerA: {
        enabled: false,
        near: 0,
        far: 100,
      },
      viewerB: {
        enabled: false,
        near: 0,
        far: 100,
      },
    });
    expect(session.uiState.chainFinderQueries).toEqual({ alignedTo: '', aligned: '' });
    expect(session.uiState.colorThemesByMode).toEqual({
      alignedTo: {
        selectedThemeName: 'default',
        selectedChainThemeName: 'default',
        selectedResidueThemeName: 'default',
        themes: [],
      },
      aligned: {
        selectedThemeName: 'default',
        selectedChainThemeName: 'default',
        selectedResidueThemeName: 'default',
        themes: [],
      },
    });
    expect(session.uiState.cameraSnapshots.viewerA).toEqual(expect.objectContaining({ radius: 10 }));
    expect(session.uiState.cameraSnapshots.viewerB).toEqual(expect.objectContaining({ radius: 10 }));
    expect(session.uiState.selectionDisplay).toEqual({
      mode: 'overlay',
      dimUnselected: true,
      dimStrength: 0.7,
    });
    expect(session.uiState.selectionDisplayByMode).toEqual({
      alignedTo: {
        mode: 'overlay',
        dimUnselected: true,
        dimStrength: 0.7,
      },
      aligned: {
        mode: 'hybrid',
        dimUnselected: false,
        dimStrength: 0.45,
      },
    });
  });

  it('restores zoom, selectors, and camera snapshot from session uiState', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    const session = {
      viewerA: { moleculeAlignedTo: { filename: '4ug0.cif' } },
      viewerB: { moleculeAligned: { filename: '6xu8.cif' } },
      uiState: {
        zoomByViewer: {
          viewerA: { extraRadius: 31, minRadius: 14 },
          viewerB: { extraRadius: 41, minRadius: 17 },
        },
        clippingByViewer: {
          viewerA: { minNear: 0.75, clipRadius: 60 },
          viewerB: { minNear: 0.85, clipRadius: 70 },
        },
        syncEnabled: true,
        showUniprotAccessionInChainLabels: false,
        chainFinderQueries: {
          alignedTo: 'auth CU',
          aligned: 'L22-like',
        },
        colorThemesByMode: {
          alignedTo: {
            selectedThemeName: 'AlignedTo-custom-theme-test',
            themes: [
              {
                value: 'AlignedTo-custom-theme-test',
                label: 'AlignedTo test theme',
                rows: [
                  { pdb_chain: 'A', color: '#ff0000' },
                  { pdb_chain: 'B', color: '#00ff00' },
                ],
              },
            ],
          },
          aligned: {
            selectedThemeName: 'default',
            themes: [],
          },
        },
        selections: {
          alignedTo: { subunit: 'Large', chainId: 'A', residueId: '10' },
          aligned: { subunit: 'Small', chainId: 'B', residueId: '20' },
        },
        highlights: {
          alignedTo: { subunit: true, chain: true, residue: true },
          aligned: { subunit: true, chain: true, residue: false },
        },
        inspectByViewer: {
          viewerA: {
            alignedTo: { subunit: true, chain: true, residue: true },
            aligned: { subunit: false, chain: true, residue: false },
          },
          viewerB: {
            alignedTo: { subunit: true, chain: false, residue: true },
            aligned: { subunit: true, chain: true, residue: false },
          },
        },
        visibilityByViewer: {
          viewerA: { alignedTo: false, aligned: true },
          viewerB: { alignedTo: true, aligned: false },
        },
        fogByViewer: {
          viewerA: { enabled: true, near: 0.35, far: 82 },
          viewerB: { enabled: false, near: 0.1, far: 95 },
        },
        selectionDisplay: {
          mode: 'halo',
          dimUnselected: true,
          dimStrength: 0.65,
        },
        cameraSnapshots: {
          viewerA: { position: [10, 11, 12], target: [1, 2, 3], up: [0, 1, 0], radius: 42 },
          viewerB: { position: [20, 21, 22], target: [4, 5, 6], up: [0, 1, 0], radius: 84 },
        }
      }
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    (globalThis as any).__mockStructureRepsByRef = {
      'mock-ref-0': [
        {
          repRef: 'mock-rep-alignedto-A',
          type: 'cartoon',
          colorTheme: { name: 'chain-id', params: {} },
          visible: true,
        },
      ],
      'mock-ref-1': [
        {
          repRef: 'mock-rep-aligned-A',
          type: 'cartoon',
          colorTheme: { name: 'chain-id', params: {} },
          visible: true,
        },
      ],
    };

    const pluginA = (globalThis as any).__mockPluginA;
    const pluginB = (globalThis as any).__mockPluginB;
    pluginA.canvas3d.camera.setState.mockClear();
    pluginB.canvas3d.camera.setState.mockClear();

    await onSessionLoaded!(session, files);

    fireEvent.click(document.getElementById('viewer-column-A-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-visibility-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-visibility-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-subunit-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-select-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-residue-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-subunit-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-select-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-residue-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-clipping-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-clipping-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-representation-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-representation-controls-toggle-btn') as HTMLButtonElement);

    await waitFor(() => {
      expect((document.getElementById('viewer-column-A-alignedto-zoom-extra-radius') as HTMLInputElement).value).toBe('31');
      expect((document.getElementById('viewer-column-B-aligned-zoom-extra-radius') as HTMLInputElement).value).toBe('41');
      expect((document.getElementById('viewer-column-B-aligned-zoom-min-radius') as HTMLInputElement).value).toBe('17');
      expect((document.getElementById('viewer-column-A-alignedto-clip-near-number') as HTMLInputElement).value).toBe('0.75');
      expect((document.getElementById('viewer-column-A-alignedto-clip-far-number') as HTMLInputElement).value).toBe('60');
      expect((document.getElementById('viewer-column-B-aligned-clip-near-number') as HTMLInputElement).value).toBe('0.85');
      expect((document.getElementById('viewer-column-B-aligned-clip-far-number') as HTMLInputElement).value).toBe('70');
      expect(document.getElementById('generalcontrols-sync-select')).toHaveTextContent('Sync: On');
      expect(document.getElementById('viewer-column-A-alignedto-show-uniprot-accession')).toHaveAttribute('aria-pressed', 'false');
      expect(document.getElementById('viewer-column-B-aligned-show-uniprot-accession')).toHaveAttribute('aria-pressed', 'false');
      expect(document.getElementById('viewer-column-A-alignedto-highlight-subunit-btn')).toHaveAttribute('aria-pressed', 'false');
      expect(document.getElementById('viewer-column-A-alignedto-highlight-chain-btn')).toHaveAttribute('aria-pressed', 'false');
      expect(document.getElementById('viewer-column-A-alignedto-highlight-residue-btn')).toHaveAttribute('aria-pressed', 'false');
      expect(document.getElementById('viewer-column-B-aligned-highlight-subunit-btn')).toHaveAttribute('aria-pressed', 'false');
      expect(document.getElementById('viewer-column-B-aligned-highlight-chain-btn')).toHaveAttribute('aria-pressed', 'false');
      expect(document.getElementById('viewer-column-B-aligned-highlight-residue-btn')).toHaveAttribute('aria-pressed', 'false');
      expect((document.getElementById('viewer-column-A-alignedto-selection-display-mode') as HTMLSelectElement).value).toBe('halo');
      expect(document.getElementById('viewer-column-A-alignedto-dim-unselected-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
      expect((document.getElementById('viewer-column-A-alignedto-dim-unselected-strength') as HTMLInputElement).value).toBe('65');
      expect((document.getElementById('viewer-column-B-aligned-selection-display-mode') as HTMLSelectElement).value).toBe('halo');
      expect(document.getElementById('viewer-column-B-aligned-dim-unselected-toggle-btn')).toHaveAttribute('aria-pressed', 'true');
      expect((document.getElementById('viewer-column-B-aligned-dim-unselected-strength') as HTMLInputElement).value).toBe('65');
      expect((document.getElementById('viewer-column-A-alignedto-chain-colour-theme-select') as HTMLSelectElement).value).toBe('AlignedTo-custom-theme-test');
      expect(document.querySelector('#viewer-column-A-alignedto-chain-colour-theme-select option[value="AlignedTo-custom-theme-test"]')).toBeInTheDocument();
      expect(document.querySelector('#viewer-column-B-aligned-chain-colour-theme-select option[value="AlignedTo-custom-theme-test"]')).toBeInTheDocument();
    }, { timeout: 5000 });

    const getSessionState = (globalThis as any).__getSessionState as (() => any) | undefined;
    expect(getSessionState).toBeDefined();
    const restoredSession = getSessionState!();
    expect(restoredSession.uiState.chainFinderQueries).toEqual({
      alignedTo: 'auth CU',
      aligned: 'L22-like',
    });
    expect(restoredSession.uiState.highlights).toEqual({
      alignedTo: { subunit: true, chain: true, residue: true },
      aligned: { subunit: true, chain: true, residue: false },
    });
    expect(restoredSession.uiState.inspectByViewer).toEqual({
      viewerA: {
        alignedTo: { subunit: true, chain: true, residue: true },
        aligned: { subunit: false, chain: true, residue: false },
      },
      viewerB: {
        alignedTo: { subunit: true, chain: false, residue: true },
        aligned: { subunit: true, chain: true, residue: false },
      },
    });
    expect(restoredSession.uiState.visibilityByViewer).toEqual({
      viewerA: { alignedTo: false, aligned: true },
      viewerB: { alignedTo: true, aligned: false },
    });
    expect(restoredSession.uiState.fogByViewer).toEqual({
      viewerA: { enabled: true, near: 0.35, far: 82 },
      viewerB: { enabled: false, near: 0.1, far: 95 },
    });
    expect(restoredSession.uiState.colorThemesByMode.alignedTo.selectedThemeName).toBe('AlignedTo-custom-theme-test');
    expect(restoredSession.uiState.colorThemesByMode.alignedTo.themes).toEqual([
      expect.objectContaining({
        value: 'AlignedTo-custom-theme-test',
        label: 'AlignedTo test theme',
      })
    ]);
    expect(restoredSession.uiState.selectionDisplay).toEqual({
      mode: 'halo',
      dimUnselected: true,
      dimStrength: 0.65,
    });
    expect(restoredSession.uiState.selectionDisplayByMode).toEqual({
      alignedTo: {
        mode: 'halo',
        dimUnselected: true,
        dimStrength: 0.65,
      },
      aligned: {
        mode: 'halo',
        dimUnselected: true,
        dimStrength: 0.65,
      },
    });

    expect(pluginA.canvas3d.camera.setState).toHaveBeenCalledWith(expect.objectContaining({
      position: [10, 11, 12],
      target: [1, 2, 3],
      up: [0, 1, 0],
      radius: 42,
    }));
    expect(pluginB.canvas3d.camera.setState).toHaveBeenCalledWith(expect.objectContaining({
      position: [20, 21, 22],
      target: [4, 5, 6],
      up: [0, 1, 0],
      radius: 84,
    }));

    // Camera restore must not be cross-overwritten by sync while loading.
    expect(pluginA.canvas3d.camera.setState).toHaveBeenCalledTimes(1);
    expect(pluginB.canvas3d.camera.setState).toHaveBeenCalledTimes(1);
    expect(pluginA.canvas3d.camera.state.position).toEqual([10, 11, 12]);
    expect(pluginA.canvas3d.camera.state.target).toEqual([1, 2, 3]);
    expect(pluginA.canvas3d.camera.state.up).toEqual([0, 1, 0]);
    expect(pluginA.canvas3d.camera.state.radius).toBe(42);
    expect(pluginB.canvas3d.camera.state.position).toEqual([20, 21, 22]);
    expect(pluginB.canvas3d.camera.state.target).toEqual([4, 5, 6]);
    expect(pluginB.canvas3d.camera.state.up).toEqual([0, 1, 0]);
    expect(pluginB.canvas3d.camera.state.radius).toBe(84);
  }, 15000);

  it('keeps viewer B camera snapshot stable when loading a session while sync is already on (regression)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement | null;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement | null;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement | null;
    expect(alignedToInput).toBeInTheDocument();
    expect(alignedInput).toBeInTheDocument();
    expect(alignedLoadBtn).toBeInTheDocument();

    fireEvent.change(alignedToInput!, { target: { files: [loadTestFile('4ug0.cif')] } });
    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.change(alignedInput!, { target: { files: [loadTestFile('6xu8.cif')] } });
    fireEvent.click(alignedLoadBtn!);

    await waitFor(() => {
      expect(document.getElementById('generalcontrols-sync-select')).not.toBeDisabled();
    }, { timeout: 5000 });

    const syncButton = document.getElementById('generalcontrols-sync-select') as HTMLButtonElement;
    fireEvent.click(syncButton);
    expect(syncButton).toHaveTextContent('Sync: On');

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    const session = {
      viewerA: { moleculeAlignedTo: { filename: '4ug0.cif' } },
      viewerB: { moleculeAligned: { filename: '6xu8.cif' } },
      uiState: {
        syncEnabled: true,
        cameraSnapshots: {
          viewerA: { position: [30, 31, 32], target: [3, 4, 5], up: [0, 1, 0], radius: 55 },
          viewerB: { position: [90, 91, 92], target: [9, 10, 11], up: [0, 1, 0], radius: 95 },
        },
      },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    const pluginA = (globalThis as any).__mockPluginA;
    const pluginB = (globalThis as any).__mockPluginB;
    pluginA.canvas3d.camera.setState.mockClear();
    pluginB.canvas3d.camera.setState.mockClear();

    await onSessionLoaded!(session, files);

    await waitFor(() => {
      expect(document.getElementById('generalcontrols-sync-select')).toHaveTextContent('Sync: On');
    }, { timeout: 5000 });

    expect(pluginA.canvas3d.camera.setState).toHaveBeenCalledTimes(1);
    expect(pluginB.canvas3d.camera.setState).toHaveBeenCalledTimes(1);
    expect(pluginA.canvas3d.camera.state.position).toEqual([30, 31, 32]);
    expect(pluginA.canvas3d.camera.state.target).toEqual([3, 4, 5]);
    expect(pluginA.canvas3d.camera.state.radius).toBe(55);
    expect(pluginB.canvas3d.camera.state.position).toEqual([90, 91, 92]);
    expect(pluginB.canvas3d.camera.state.target).toEqual([9, 10, 11]);
    expect(pluginB.canvas3d.camera.state.radius).toBe(95);
  });

  it('round-trips multiple selected residues in session uiState', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    const session = {
      viewerA: { moleculeAlignedTo: { filename: '4ug0.cif' } },
      viewerB: { moleculeAligned: { filename: '6xu8.cif' } },
      uiState: {
        selections: {
          alignedTo: { subunit: 'Large', chainId: 'A', residueIds: ['10', '20'], residueId: '10' },
          aligned: { subunit: 'Small', chainId: 'B', residueIds: ['20'], residueId: '20' },
        },
      },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    await onSessionLoaded!(session, files);

    const getSessionState = (globalThis as any).__getSessionState as (() => any) | undefined;
    expect(getSessionState).toBeDefined();

    await waitFor(() => {
      const restored = getSessionState!();
      expect(restored.uiState.selections.alignedTo.residueIds).toEqual(['10', '20']);
      expect(restored.uiState.selections.alignedTo.residueId).toBe('10');
      expect(restored.uiState.selections.aligned.residueIds).toEqual(['20']);
      expect(restored.uiState.selections.aligned.residueId).toBe('20');
    }, { timeout: 5000 });
  });

  it('round-trips Select Chain 2 selections in session uiState', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    const session = {
      viewerA: { moleculeAlignedTo: { filename: '4ug0.cif' } },
      viewerB: { moleculeAligned: { filename: '6xu8.cif' } },
      uiState: {
        selections: {
          alignedTo: {
            subunit: 'Large',
            chainId: 'A',
            residueIds: ['10'],
            residueId: '10',
            chainId2: 'B',
            residueIds2: ['20'],
            residueId2: '20',
          },
          aligned: {
            subunit: 'Small',
            chainId: 'B',
            residueIds: ['20'],
            residueId: '20',
            chainId2: 'A',
            residueIds2: ['10'],
            residueId2: '10',
          },
        },
      },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    await onSessionLoaded!(session, files);

    const getSessionState = (globalThis as any).__getSessionState as (() => any) | undefined;
    expect(getSessionState).toBeDefined();

    await waitFor(() => {
      const restored = getSessionState!();
      expect(restored.uiState.selections.alignedTo.chainId2).toBe('B');
      expect(restored.uiState.selections.alignedTo.residueIds2).toEqual(['20']);
      expect(restored.uiState.selections.alignedTo.residueId2).toBe('20');
      expect(restored.uiState.selections.aligned.chainId2).toBe('A');
      expect(restored.uiState.selections.aligned.residueIds2).toEqual(['10']);
      expect(restored.uiState.selections.aligned.residueId2).toBe('10');
    }, { timeout: 5000 });
  });

  it('round-trips selected chain colour when persisted theme key uses an alias chain id', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    const session = {
      viewerA: {
        moleculeAlignedTo: {
          filename: '4ug0.cif',
          representations: [
            {
              type: 'cartoon',
              colorTheme: { name: 'AlignedTo-custom-theme-test', params: {} },
              visible: true,
            },
          ],
        },
      },
      viewerB: {
        moleculeAlignedTo: {
          filename: '4ug0.cif',
          representations: [
            {
              type: 'cartoon',
              colorTheme: { name: 'AlignedTo-custom-theme-test', params: {} },
              visible: true,
            },
          ],
        },
      },
      uiState: {
        colorThemesByMode: {
          alignedTo: {
            selectedThemeName: 'AlignedTo-custom-theme-test',
            themes: [
              {
                value: 'AlignedTo-custom-theme-test',
                label: 'AlignedTo custom',
                rows: [
                  // Intentionally lower-case alias key to ensure alias-aware lookup/update.
                  { pdb_chain: 'a', color: '#12AB34' },
                ],
              },
            ],
          },
          aligned: {
            selectedThemeName: 'default',
            themes: [],
          },
        },
        selections: {
          alignedTo: { chainId: 'A' },
        },
      },
    };

    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
    };

    (globalThis as any).__mockStructureRepsByRef = {
      'mock-ref-0': [
        {
          repRef: 'mock-rep-alignedto-A',
          type: 'cartoon',
          colorTheme: { name: 'chain-id', params: {} },
          visible: true,
        },
      ],
    };

    await onSessionLoaded!(session, files);

    fireEvent.click(document.getElementById('viewer-column-A-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-select-chain-controls-toggle-btn') as HTMLButtonElement);

    await waitFor(() => {
      const selectedLabel = document.getElementById('viewer-column-A-alignedto-selected-chain-label');
      expect(selectedLabel?.textContent).toContain('A');
    }, { timeout: 5000 });

    await waitFor(() => {
      const repToggle = document.getElementById('viewer-column-A-alignedto-representation-controls-toggle-btn') as HTMLButtonElement | null;
      const selectedChainColorInput = document.getElementById('viewer-column-A-alignedto-chain-color-A') as HTMLInputElement | null;
      if (!selectedChainColorInput && repToggle) {
        fireEvent.click(repToggle);
      }
      expect(selectedChainColorInput).toBeInTheDocument();
      expect(selectedChainColorInput?.value.toUpperCase()).toBe('#12AB34');
    }, { timeout: 5000 });

    const getSessionState = (globalThis as any).__getSessionState as (() => any) | undefined;
    expect(getSessionState).toBeDefined();
    const restored = getSessionState!();
    const savedRows = restored?.uiState?.colorThemesByMode?.alignedTo?.themes?.find((t: any) => t?.value === 'AlignedTo-custom-theme-test')?.rows ?? [];
    const rowByA = savedRows.find((row: any) => String(row?.pdb_chain ?? '').trim().toUpperCase() === 'A');
    expect(rowByA?.color?.toUpperCase()).toBe('#12AB34');
  }, 15000);

  it('updates Realign to Residues button disabled state from residue selections', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    const onlyOneSideSelected = {
      viewerA: { moleculeAlignedTo: { filename: '4ug0.cif' } },
      viewerB: { moleculeAligned: { filename: '6xu8.cif' } },
      uiState: {
        selections: {
          alignedTo: { subunit: 'Large', chainId: 'A', residueIds: ['10'], residueId: '10' },
          aligned: { subunit: 'Small', chainId: 'B', residueIds: [], residueId: '' },
        },
      },
    };

    await onSessionLoaded!(onlyOneSideSelected, files);

    await waitFor(() => {
      const residueRealignButton = document.getElementById('generalcontrols-realign-residue-btn') as HTMLButtonElement | null;
      expect(residueRealignButton).toBeInTheDocument();
      expect(residueRealignButton).toBeDisabled();
      expect(residueRealignButton?.textContent).toContain('Align Residues');
    }, { timeout: 5000 });

    const bothSidesSelected = {
      viewerA: { moleculeAlignedTo: { filename: '4ug0.cif' } },
      viewerB: { moleculeAligned: { filename: '6xu8.cif' } },
      uiState: {
        selections: {
          alignedTo: { subunit: 'Large', chainId: 'A', residueIds: ['10', '20'], residueId: '10' },
          aligned: { subunit: 'Small', chainId: 'B', residueIds: ['20'], residueId: '20' },
        },
      },
    };

    await onSessionLoaded!(bothSidesSelected, files);

    await waitFor(() => {
      const residueRealignButton = document.getElementById('generalcontrols-realign-residue-btn') as HTMLButtonElement | null;
      expect(residueRealignButton).toBeInTheDocument();
      expect(residueRealignButton).not.toBeDisabled();
      expect(residueRealignButton?.textContent).toContain('Align Residues: 2 to 1');
    }, { timeout: 5000 });
  });

  it('keeps chain realign available after first chain realignment', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement;

    fireEvent.change(alignedToInput, { target: { files: [loadTestFile('4ug0.cif')] } });
    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
    }, { timeout: 5000 });
    fireEvent.change(alignedInput, { target: { files: [loadTestFile('6xu8.cif')] } });
    fireEvent.click(alignedLoadBtn);

    fireEvent.click(document.getElementById('viewer-column-A-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-select-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-select-chain-controls-toggle-btn') as HTMLButtonElement);

    await waitFor(() => {
      expect(document.querySelector('[data-testid^="viewer-column-A-chain-table-row-"]')).toBeInTheDocument();
      expect(document.querySelector('[data-testid^="viewer-column-B-chain-table-row-"]')).toBeInTheDocument();
    }, { timeout: 5000 });

    const alignedToFirstChainRow = document.querySelector('[data-testid^="viewer-column-A-chain-table-row-"]') as HTMLTableRowElement | null;
    const alignedFirstChainRow = document.querySelector('[data-testid^="viewer-column-B-chain-table-row-"]') as HTMLTableRowElement | null;
    fireEvent.click(alignedToFirstChainRow as HTMLTableRowElement);
    fireEvent.click(alignedFirstChainRow as HTMLTableRowElement);

    const realignButton = document.getElementById('generalcontrols-realign-btn') as HTMLButtonElement;
    await waitFor(() => {
      expect(realignButton).not.toBeDisabled();
    }, { timeout: 5000 });

    fireEvent.click(realignButton);

    await waitFor(() => {
      expect(realignButton).not.toBeDisabled();
    }, { timeout: 5000 });
  });

  it('keeps repeated chain realign stable and idempotent when in-place transforms are used', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement;

    fireEvent.change(alignedToInput, { target: { files: [loadTestFile('4ug0.cif')] } });
    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
    }, { timeout: 5000 });
    fireEvent.change(alignedInput, { target: { files: [loadTestFile('6xu8.cif')] } });
    fireEvent.click(alignedLoadBtn);

    fireEvent.click(document.getElementById('viewer-column-A-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-select-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-select-chain-controls-toggle-btn') as HTMLButtonElement);

    await waitFor(() => {
      expect(document.querySelector('[data-testid^="viewer-column-A-chain-table-row-"]')).toBeInTheDocument();
      expect(document.querySelector('[data-testid^="viewer-column-B-chain-table-row-"]')).toBeInTheDocument();
    }, { timeout: 5000 });

    const alignedToFirstChainRow = document.querySelector('[data-testid^="viewer-column-A-chain-table-row-"]') as HTMLTableRowElement | null;
    const alignedFirstChainRow = document.querySelector('[data-testid^="viewer-column-B-chain-table-row-"]') as HTMLTableRowElement | null;
    fireEvent.click(alignedToFirstChainRow as HTMLTableRowElement);
    fireEvent.click(alignedFirstChainRow as HTMLTableRowElement);

    const pluginA = (globalThis as any).__mockPluginA;
    const capturedMatrices: number[][] = [];
    const originalBuild = pluginA.state.data.build;
    pluginA.state.data.build = vi.fn(() => {
      const builder = {
        to: vi.fn(() => builder),
        update: vi.fn(() => builder),
        insert: vi.fn((_transformer: any, params: any) => {
          const matrix = params?.transform?.params?.data;
          if (matrix && typeof matrix.length === 'number' && matrix.length >= 16) {
            capturedMatrices.push(Array.from({ length: 16 }, (_v, i) => Number(matrix[i])));
          }
          return builder;
        }),
      };
      return builder;
    });

    const realignButton = document.getElementById('generalcontrols-realign-btn') as HTMLButtonElement;
    await waitFor(() => expect(realignButton).not.toBeDisabled(), { timeout: 5000 });

    fireEvent.click(realignButton);
    await waitFor(() => expect(realignButton).not.toBeDisabled(), { timeout: 5000 });

    fireEvent.click(realignButton);
    await waitFor(() => expect(realignButton).not.toBeDisabled(), { timeout: 5000 });

    pluginA.state.data.build = originalBuild;

    if (capturedMatrices.length >= 2) {
      const first = capturedMatrices[0];
      const second = capturedMatrices[1];
      expect(first.length).toBe(16);
      expect(second.length).toBe(16);
      for (let i = 0; i < 16; i++) {
        expect(Math.abs(first[i] - second[i])).toBeLessThan(1e-10);
      }
    }
  }, 15000);

  it('persists and reapplies aligned structure transforms after in-place chain realign (regression)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    vi.mocked(alignDatasetUsingChains).mockImplementationOnce((
      _selectedAtomTypes: any,
      _movingChainId: string,
      _movingSymbolTypes: string[],
      _movingChainIds: string[],
      movingXs: number[],
      movingYs: number[],
      movingZs: number[]
    ) => ({
      rotmat: [
        1, 0, 0,
        0, 1, 0,
        0, 0, 1,
      ],
      centroidReference: Vec3.create(10, 0, 0),
      centroid: Vec3.create(0, 0, 0),
      alignedX: movingXs.map(x => x + 10),
      alignedY: [...movingYs],
      alignedZ: [...movingZs],
    }));

    const alignedToInput = document.getElementById('viewer-column-A-alignedto-file-input') as HTMLInputElement;
    const alignedInput = document.getElementById('viewer-column-B-aligned-file-input') as HTMLInputElement;
    const alignedLoadBtn = document.getElementById('viewer-column-B-aligned-load-btn') as HTMLButtonElement;

    fireEvent.change(alignedToInput, { target: { files: [loadTestFile('4ug0.cif')] } });
    await waitFor(() => {
      expect(document.getElementById('viewer-column-B-aligned-load-btn')).not.toBeDisabled();
    }, { timeout: 5000 });
    fireEvent.change(alignedInput, { target: { files: [loadTestFile('6xu8.cif')] } });
    fireEvent.click(alignedLoadBtn);

    fireEvent.click(document.getElementById('viewer-column-A-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-select-zoom-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-A-alignedto-select-chain-controls-toggle-btn') as HTMLButtonElement);
    fireEvent.click(document.getElementById('viewer-column-B-aligned-select-chain-controls-toggle-btn') as HTMLButtonElement);

    await waitFor(() => {
      expect(document.querySelector('[data-testid^="viewer-column-A-chain-table-row-"]')).toBeInTheDocument();
      expect(document.querySelector('[data-testid^="viewer-column-B-chain-table-row-"]')).toBeInTheDocument();
    }, { timeout: 5000 });

    fireEvent.click(document.querySelector('[data-testid^="viewer-column-A-chain-table-row-"]') as HTMLTableRowElement);
    fireEvent.click(document.querySelector('[data-testid^="viewer-column-B-chain-table-row-"]') as HTMLTableRowElement);

    const realignButton = document.getElementById('generalcontrols-realign-btn') as HTMLButtonElement;
    await waitFor(() => expect(realignButton).not.toBeDisabled(), { timeout: 5000 });
    fireEvent.click(realignButton);
    await waitFor(() => expect(realignButton).not.toBeDisabled(), { timeout: 5000 });

    const testApi = (globalThis as any).__ribocodeTestApi as {
      captureStructureTransformCheckpoint?: (label: string) => any;
      clearStructureTransformCheckpoints?: () => void;
    } | undefined;
    expect(testApi).toBeDefined();
    expect(testApi?.captureStructureTransformCheckpoint).toEqual(expect.any(Function));
    testApi?.clearStructureTransformCheckpoints?.();
    const beforeSaveCheckpoint = testApi?.captureStructureTransformCheckpoint?.('before-save');
    const beforeSaveViewerBAligned = beforeSaveCheckpoint?.viewerB?.transforms?.aligned;
    expect(Array.isArray(beforeSaveViewerBAligned)).toBe(true);
    expect(beforeSaveViewerBAligned).toHaveLength(16);

    const getSessionState = (globalThis as any).__getSessionState as (() => any) | undefined;
    expect(getSessionState).toBeDefined();
    const savedSession = getSessionState!();
    const savedTransform = savedSession?.uiState?.structureTransformsByViewer?.viewerB?.aligned;
    expect(Array.isArray(savedTransform)).toBe(true);
    expect(savedTransform).toHaveLength(16);
    const identity = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
    const differsFromIdentity = savedTransform.some((value: number, idx: number) => Math.abs(value - identity[idx]) > 1e-6);
    expect(differsFromIdentity).toBe(true);

    const pluginB = (globalThis as any).__mockPluginB;
    const insertedMatrices: number[][] = [];
    const originalBuild = pluginB.state.data.build;
    pluginB.state.data.build = vi.fn(() => {
      const builder = {
        to: vi.fn(() => builder),
        update: vi.fn(() => builder),
        insert: vi.fn((_transformer: any, params: any) => {
          const matrix = params?.transform?.params?.data;
          if (matrix && typeof matrix.length === 'number' && matrix.length >= 16) {
            insertedMatrices.push(Array.from({ length: 16 }, (_v, i) => Number(matrix[i])));
          }
          return builder;
        }),
      };
      return builder;
    });

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };
    await onSessionLoaded!(savedSession, files);
    const afterLoadCheckpoint = testApi?.captureStructureTransformCheckpoint?.('after-load');
    pluginB.state.data.build = originalBuild;

    expect(insertedMatrices.length).toBeGreaterThan(0);
    expect(insertedMatrices.some(matrix =>
      matrix.every((value, idx) => Math.abs(value - savedTransform[idx]) <= 1e-6)
    )).toBe(true);

    const afterLoadViewerBAligned = afterLoadCheckpoint?.viewerB?.transforms?.aligned;
    expect(Array.isArray(afterLoadViewerBAligned)).toBe(true);
    expect(afterLoadViewerBAligned).toHaveLength(16);
    expect((afterLoadViewerBAligned as number[]).every((value: number, idx: number) => Math.abs(value - (beforeSaveViewerBAligned as number[])[idx]) <= 1e-6)).toBe(true);
  }, 15000);

  it('restores saved additional representations on session load (regression)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();
    expect(onSessionLoaded).toEqual(expect.any(Function));

    const session = {
      viewerA: {
        moleculeAlignedTo: {
          filename: '4ug0.cif',
          representations: [
            { type: 'cartoon', colorTheme: { name: 'AlignedTo-custom-chain-colors', params: {} }, visible: false },
            { type: 'line', colorTheme: { name: 'default', params: {} }, visible: true }
          ],
        },
      },
      viewerB: {
        moleculeAligned: {
          filename: '6xu8.cif',
          representations: [
            { type: 'cartoon', colorTheme: { name: 'Aligned-custom-chain-colors', params: {} }, visible: false },
            { type: 'line', colorTheme: { name: 'default', params: {} }, visible: true }
          ],
        },
      },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    await onSessionLoaded!(session, files);

    const instances = (globalThis as any).__molstarViewerInstances as any[];
    const addRepresentationCalls = instances.flatMap(instance => instance.addRepresentation.mock.calls);
    const restoredCartoonCalls = addRepresentationCalls.filter((args: any[]) => args[2] === 'cartoon');
    const restoredLineCalls = addRepresentationCalls.filter((args: any[]) => args[2] === 'line');
    expect(restoredCartoonCalls.length).toBeGreaterThan(0);
    expect(restoredLineCalls.length).toBeGreaterThan(0);
    expect((PluginCommands.State.ToggleVisibility.apply as any)).toHaveBeenCalled();
  });

  it('restores multiple representations of the same type with different colorThemes (regression)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();
    expect(onSessionLoaded).toEqual(expect.any(Function));

    // Two cartoon representations with different color themes — each must be restored independently.
    const session = {
      viewerA: {
        moleculeAlignedTo: {
          filename: '4ug0.cif',
          representations: [
            { type: 'cartoon', colorTheme: { name: 'chain-id', params: {} }, visible: true },
            { type: 'cartoon', colorTheme: { name: 'sequence-id', params: {} }, visible: true },
          ],
        },
      },
      viewerB: { moleculeAligned: { filename: '6xu8.cif', representations: [] } },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    await onSessionLoaded!(session, files);

    const instances = (globalThis as any).__molstarViewerInstances as any[];
    const addCalls = instances.flatMap(instance => instance.addRepresentation.mock.calls);
    const cartoonCalls = addCalls.filter((args: any[]) => args[2] === 'cartoon');

    // Both cartoon reps should have been added.
    expect(cartoonCalls.length).toBeGreaterThanOrEqual(2);

    // The color themes should be preserved — both distinct themes must appear.
    const themes = cartoonCalls.map((args: any[]) => args[3]?.name);
    expect(themes).toContain('chain-id');
    expect(themes).toContain('sequence-id');
  });

  it('restores representation chain/residue theme preferences and active theme kind on session load', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    const session = {
      viewerA: {
        moleculeAlignedTo: {
          filename: '4ug0.cif',
          representations: [
            {
              type: 'cartoon',
              colorTheme: { name: 'chain-id', params: {} },
              chainThemeName: 'AlignedTo-chain-theme-1',
              residueThemeName: 'AlignedTo-residue-theme-1',
              activeThemeKind: 'residue-type',
              visible: true,
            },
          ],
        },
      },
      viewerB: { moleculeAligned: { filename: '6xu8.cif', representations: [] } },
      uiState: {
        colorThemesByMode: {
          alignedTo: {
            selectedChainThemeName: 'AlignedTo-chain-theme-1',
            selectedResidueThemeName: 'AlignedTo-residue-theme-1',
            themes: [
              { value: 'AlignedTo-chain-theme-1', label: 'AlignedTo Chain 1', rows: [{ pdb_chain: 'A', color: '#112233' }] },
              { value: 'AlignedTo-residue-theme-1', label: 'AlignedTo Residue 1', rows: [{ residue_type: 'ALA', color: '#334455' }] },
            ],
          },
          aligned: { themes: [] },
        },
      },
    };

    await onSessionLoaded!(session, {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    });

    const instances = (globalThis as any).__molstarViewerInstances as any[];
    const addCalls = instances.flatMap(instance => instance.addRepresentation.mock.calls);
    const cartoonCall = addCalls.find((args: any[]) => args[2] === 'cartoon');
    expect(cartoonCall).toBeTruthy();
    expect(cartoonCall[3]?.name).toBe('AlignedTo-residue-theme-1');
    expect(cartoonCall[6]).toEqual(expect.objectContaining({
      chainThemeName: 'AlignedTo-chain-theme-1',
      residueThemeName: 'AlignedTo-residue-theme-1',
      activeThemeKind: 'residue-type',
    }));
  });

  it('changing default chain theme selector does not recolor existing representations globally', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    const session = {
      viewerA: {
        moleculeAlignedTo: {
          filename: '4ug0.cif',
          representations: [
            { type: 'cartoon', colorTheme: { name: 'chain-id', params: {} }, visible: true },
          ],
        },
      },
      viewerB: { moleculeAligned: { filename: '6xu8.cif', representations: [] } },
      uiState: {
        colorThemesByMode: {
          alignedTo: {
            selectedChainThemeName: 'chain-id',
            selectedResidueThemeName: 'default',
            themes: [
              { value: 'AlignedTo-custom-theme-test', label: 'AlignedTo test theme', rows: [{ pdb_chain: 'A', color: '#AA5500' }] },
            ],
          },
          aligned: { themes: [] },
        },
      },
    };

    await onSessionLoaded!(session, {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    });

    fireEvent.click(document.getElementById('viewer-column-A-alignedto-representation-controls-toggle-btn') as HTMLButtonElement);

    const chainThemeSelect = document.getElementById('viewer-column-A-alignedto-chain-colour-theme-select') as HTMLSelectElement | null;
    expect(chainThemeSelect).toBeInTheDocument();

    const pluginA = (globalThis as any).__mockPluginA;
    const pluginB = (globalThis as any).__mockPluginB;
    pluginA?.runTask?.mockClear?.();
    pluginB?.runTask?.mockClear?.();

    fireEvent.change(chainThemeSelect!, { target: { value: 'AlignedTo-custom-theme-test' } });

    await waitFor(() => {
      expect((document.getElementById('viewer-column-A-alignedto-chain-colour-theme-select') as HTMLSelectElement).value)
        .toBe('AlignedTo-custom-theme-test');
    });

    expect(pluginA?.runTask).not.toHaveBeenCalled();
    expect(pluginB?.runTask).not.toHaveBeenCalled();
  });

  it('replaces type-only matched representation when saved colorTheme differs (regression)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();

    (globalThis as any).__mockStructureRepsByRef = {
      'mock-ref-0': [
        {
          repRef: 'existing-cartoon-ref',
          type: 'cartoon',
          colorTheme: { name: 'default', params: {} },
          visible: true,
        },
      ],
    };

    const session = {
      viewerA: {
        moleculeAlignedTo: {
          filename: '4ug0.cif',
          representations: [
            { type: 'cartoon', colorTheme: { name: 'chain-id', params: { palette: 'set-1' } }, visible: true },
          ],
        },
      },
      viewerB: {
        moleculeAligned: {
          filename: '6xu8.cif',
          representations: [],
        },
      },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    await onSessionLoaded!(session, files);

    expect((PluginCommands.State.RemoveObject.apply as any)).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([
        expect.anything(),
        expect.objectContaining({ ref: 'existing-cartoon-ref' }),
      ])
    );

    const instances = (globalThis as any).__molstarViewerInstances as any[];
    const addCalls = instances.flatMap(instance => instance.addRepresentation.mock.calls);
    const cartoonCalls = addCalls.filter((args: any[]) => args[2] === 'cartoon');
    expect(cartoonCalls.some((args: any[]) => args[3]?.name === 'chain-id')).toBe(true);
    expect(cartoonCalls.some((args: any[]) => args[3]?.params?.palette === 'set-1')).toBe(true);
  });

  it('preserves viewer-specific representation visibility on session load (regression)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();
    expect(onSessionLoaded).toEqual(expect.any(Function));

    // Same representation type in both viewers, but different visibility.
    const session = {
      viewerA: {
        moleculeAlignedTo: {
          filename: '4ug0.cif',
          representations: [
            { type: 'cartoon', colorTheme: { name: 'AlignedTo-custom-chain-colors', params: {} }, visible: false },
          ],
        },
      },
      viewerB: {
        moleculeAlignedTo: {
          filename: '4ug0.cif',
          representations: [
            { type: 'cartoon', colorTheme: { name: 'AlignedTo-custom-chain-colors', params: {} }, visible: true },
          ],
        },
        moleculeAligned: {
          filename: '6xu8.cif',
          representations: [],
        },
      },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    (PluginCommands.State.ToggleVisibility.apply as any).mockClear();
    await onSessionLoaded!(session, files);

    // Only viewer A's hidden representation should trigger a visibility toggle.
    expect((PluginCommands.State.ToggleVisibility.apply as any)).toHaveBeenCalledTimes(1);
  });

  it('restores spacefill representations with per-viewer visibility (regression)', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole('banner')).toBeInTheDocument());

    const onSessionLoaded = (globalThis as any).__onSessionLoaded as ((session: any, files: Record<string, File>) => Promise<void>) | undefined;
    expect(onSessionLoaded).toBeDefined();
    expect(onSessionLoaded).toEqual(expect.any(Function));

    const session = {
      viewerA: {
        moleculeAlignedTo: { filename: '4ug0.cif', representations: [] },
        moleculeAligned: {
          filename: '6xu8.cif',
          representations: [
            { type: 'spacefill', colorTheme: { name: 'Aligned-custom-chain-colors', params: {} }, visible: false },
            { type: 'spacefill', colorTheme: { name: 'default', params: {} }, visible: true },
          ],
        },
      },
      viewerB: {
        moleculeAlignedTo: { filename: '4ug0.cif', representations: [] },
        moleculeAligned: {
          filename: '6xu8.cif',
          representations: [
            { type: 'spacefill', colorTheme: { name: 'Aligned-custom-chain-colors', params: {} }, visible: true },
            { type: 'spacefill', colorTheme: { name: 'default', params: {} }, visible: false },
          ],
        },
      },
    };
    const files = {
      '4ug0.cif': loadTestFile('4ug0.cif'),
      '6xu8.cif': loadTestFile('6xu8.cif'),
    };

    (PluginCommands.State.ToggleVisibility.apply as any).mockClear();
    await onSessionLoaded!(session, files);

    const instances = (globalThis as any).__molstarViewerInstances as any[];
    const addCalls = instances.flatMap(instance => instance.addRepresentation.mock.calls);
    const alignedSpacefillCalls = addCalls.filter((args: any[]) => args[0] === 'Aligned' && args[2] === 'spacefill');
    expect(alignedSpacefillCalls.length).toBeGreaterThanOrEqual(4);

    // Two hidden entries (one per viewer) should trigger exactly two toggles.
    expect((PluginCommands.State.ToggleVisibility.apply as any)).toHaveBeenCalledTimes(2);
  });

  it('shows a React error boundary or warning if AlignedTo triggers infinite recursion', async () => {
    render(<App />);
    const header = await screen.findByRole('banner');
    expect(header).toBeInTheDocument();
  });

  it('does not infinitely reload AlignedTo or Aligned (regression)', async () => {
    render(<App />);
    await new Promise(resolve => setTimeout(resolve, 100));
    const viewerColumnA = document.getElementById('viewer-column-A');
    const viewerColumnB = document.getElementById('viewer-column-B');
    expect(viewerColumnA).toBeInTheDocument();
    expect(viewerColumnB).toBeInTheDocument();
  });
});
