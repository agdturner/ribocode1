// (Session load confirmation tests moved to session.integration.test.tsx)
/**
 * Basic test suite for App component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1 
 */
import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App, { buildAtomDataForResidueGroup, buildDimExclusionLoci, copyCameraZoomRadiusBetweenViewers, hasSelectionForDisplayDim, readClippingFromViewer, runWithTemporarySyncDisabled } from './App';

const makeZoomHandlerMock = vi.fn((config: any) => ({ handleButtonClick: vi.fn(), config }));

// Mock hooks and dependencies as needed
vi.mock('./hooks/useSessionSave', () => ({
  useSessionSave: (getSessionState: any) => vi.fn(),
}));
vi.mock('./hooks/useSessionLoadModal', () => {
  return {
    useSessionLoadModal: (onSessionLoaded: any) => ({
      handleLoadSession: vi.fn(),
      SessionLoadModal: <div data-testid="session-modal">Session Modal</div>,
    }),
  };
});
vi.mock('./utils/viewerHelpers', async () => {
  const actual = await vi.importActual<typeof import('./utils/viewerHelpers')>('./utils/viewerHelpers');
  return {
    ...actual,
    makeZoomHandler: (config: any) => makeZoomHandlerMock(config),
  };
});

describe('App session dropdown menu', () => {
  it('renders the Session dropdown and triggers Save/Load/Restart', async () => {
    render(<App />);
    // Dropdown button
    const sessionBtn = screen.getByRole('button', { name: /session/i });
    expect(sessionBtn).toBeInTheDocument();
    // Open dropdown
    fireEvent.click(sessionBtn);
    // Save
    const saveItem = screen.getByText('Save');
    expect(saveItem).toBeInTheDocument();
    fireEvent.click(saveItem);
    // Load
    fireEvent.click(sessionBtn); // reopen
    const loadItem = screen.getByText('Load');
    expect(loadItem).toBeInTheDocument();
    fireEvent.click(loadItem);
    // Modal should appear (mocked)
    await waitFor(() => expect(screen.getByTestId('session-modal')).toBeInTheDocument());
    // Restart
    fireEvent.click(sessionBtn); // reopen
    const restartItem = screen.getByText('Restart');
    expect(restartItem).toBeInTheDocument();
  });
});

describe('App zoom wiring regression guard', () => {
  it('passes zoomExtraRadius and zoomMinRadius option keys into makeZoomHandler configs', () => {
    makeZoomHandlerMock.mockClear();
    render(<App />);

    const allCalls = makeZoomHandlerMock.mock.calls.map(([config]) => config);
    const zoomCalls = allCalls.filter((config: any) => config?.property === 'residue-test');

    expect(zoomCalls.length).toBeGreaterThan(0);
    for (const config of zoomCalls) {
      expect(Object.prototype.hasOwnProperty.call(config, 'zoomExtraRadius')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(config, 'zoomMinRadius')).toBe(true);
    }
  });
});

describe('App clipping defaults', () => {
  it('reads minNear and clipRadius from Mol* cameraClipping props', () => {
    const clipping = readClippingFromViewer({
      canvas3d: {
        props: {
          cameraClipping: { minNear: 0.6, radius: 72 },
        },
      },
    });

    expect(clipping).toEqual({ minNear: 0.6, clipRadius: 72 });
  });

  it('falls back to app defaults when Mol* clipping props are missing', () => {
    const clipping = readClippingFromViewer({ canvas3d: { props: {} } });
    expect(clipping).toEqual({ minNear: 1, clipRadius: 0 });
  });
});

describe('App dim-selection predicate', () => {
  it('returns true when chain selection is present even with no highlights', () => {
    expect(hasSelectionForDisplayDim({ chainId: 'A', residueIds: [], subunitChainIds: [] })).toBe(true);
  });

  it('returns true when residue selection is present', () => {
    expect(hasSelectionForDisplayDim({ chainId: '', residueIds: ['23', '30'], subunitChainIds: [] })).toBe(true);
  });

  it('returns true when subunit chain selection is present', () => {
    expect(hasSelectionForDisplayDim({ chainId: '', residueIds: [], subunitChainIds: ['A', 'B'] })).toBe(true);
  });

  it('returns false when no selection is present', () => {
    expect(hasSelectionForDisplayDim({ chainId: '', residueIds: [], subunitChainIds: [] })).toBe(false);
    expect(hasSelectionForDisplayDim({})).toBe(false);
  });
});

describe('App dim overlay exclusion loci', () => {
  it('uses residue loci as exclusion when Theme Type is residue', () => {
    const plugin = {} as any;
    const structureRef = 'structure-ref';
    const residueLoci = { kind: 'element-loci', id: 'residue' };
    const getChainLociFn = vi.fn(() => ({ kind: 'element-loci', id: 'chain' }));
    const getResiduesLociFn = vi.fn(() => residueLoci);

    const loci = buildDimExclusionLoci(
      {
        plugin,
        structureRef,
        colorMode: 'residue-type',
        chainId: 'A',
        residueIds: ['12', '12', '37'],
        residueInsCodes: { '12': 'A', '37': '' },
        subunitChainIds: ['A', 'B'],
      },
      {
        getChainLociFn: getChainLociFn as any,
        getResiduesLociFn: getResiduesLociFn as any,
      }
    );

    expect(getResiduesLociFn).toHaveBeenCalledWith(plugin, structureRef, 'A', ['12', '37'], { '12': 'A', '37': '' });
    expect(getChainLociFn).not.toHaveBeenCalled();
    expect(loci).toBe(residueLoci);
  });

  it('uses chain loci as exclusion when Theme Type is chain', () => {
    const plugin = {} as any;
    const structureRef = 'structure-ref';
    const chainLoci = { kind: 'element-loci', id: 'chain' };
    const getChainLociFn = vi.fn(() => chainLoci);
    const getResiduesLociFn = vi.fn(() => ({ kind: 'element-loci', id: 'residue' }));

    const loci = buildDimExclusionLoci(
      {
        plugin,
        structureRef,
        colorMode: 'chain',
        chainId: 'A',
        residueIds: ['1', '2'],
        subunitChainIds: ['A', 'B'],
      },
      {
        getChainLociFn: getChainLociFn as any,
        getResiduesLociFn: getResiduesLociFn as any,
      }
    );

    expect(getChainLociFn).toHaveBeenCalledWith(plugin, structureRef, 'A');
    expect(getResiduesLociFn).not.toHaveBeenCalled();
    expect(loci).toBe(chainLoci);
  });

  it('returns null when Theme Type is residue but no residues are selected', () => {
    const loci = buildDimExclusionLoci(
      {
        plugin: {} as any,
        structureRef: 'structure-ref',
        colorMode: 'residue-type',
        chainId: 'A',
        residueIds: [],
        subunitChainIds: [],
      },
      {
        getChainLociFn: vi.fn() as any,
        getResiduesLociFn: vi.fn() as any,
      }
    );
    expect(loci).toBeNull();
  });

  it('returns null when Theme Type is chain but no chain is selected', () => {
    const loci = buildDimExclusionLoci(
      {
        plugin: {} as any,
        structureRef: 'structure-ref',
        colorMode: 'chain',
        chainId: '',
        residueIds: ['10'],
        subunitChainIds: ['A'],
      },
      {
        getChainLociFn: vi.fn() as any,
        getResiduesLociFn: vi.fn() as any,
      }
    );
    expect(loci).toBeNull();
  });
});

describe('App chain realign zoom helper', () => {
  it('copies source viewer camera snapshot (pan, orientation, zoom) to target viewer', () => {
    const sourceCamera = {
      getSnapshot: vi.fn(() => ({
        position: [10, 20, 30],
        target: [4, 5, 6],
        up: [0, 0, 1],
        radius: 37,
      })),
    };
    const targetCamera = {
      state: {
        mode: 'perspective',
        position: [1, 2, 3],
        target: [7, 8, 9],
        up: [0, 1, 0],
        radius: 11,
      },
      setState: vi.fn(),
    };
    const requestDraw = vi.fn();

    const sourceRef = {
      current: {
        canvas3d: { camera: sourceCamera }
      }
    } as any;
    const targetRef = {
      current: {
        canvas3d: {
          camera: targetCamera,
          requestDraw,
        }
      }
    } as any;

    copyCameraZoomRadiusBetweenViewers(sourceRef, targetRef);

    expect(targetCamera.setState).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'perspective',
      position: [10, 20, 30],
      target: [4, 5, 6],
      up: [0, 0, 1],
      radius: 37,
    }));
    expect(requestDraw).toHaveBeenCalled();
  });
});

describe('App sync toggle helper', () => {
  it('temporarily disables sync around an action and restores it afterwards', async () => {
    const setSyncEnabled = vi.fn();
    const action = vi.fn(async () => 'done');

    const result = await runWithTemporarySyncDisabled(true, setSyncEnabled, action);

    expect(result).toBe('done');
    expect(action).toHaveBeenCalledTimes(1);
    expect(setSyncEnabled).toHaveBeenNthCalledWith(1, false);
    expect(setSyncEnabled).toHaveBeenNthCalledWith(2, true);
  });

  it('does not toggle sync when sync is already disabled', async () => {
    const setSyncEnabled = vi.fn();
    const action = vi.fn(async () => 'done');

    const result = await runWithTemporarySyncDisabled(false, setSyncEnabled, action);

    expect(result).toBe('done');
    expect(action).toHaveBeenCalledTimes(1);
    expect(setSyncEnabled).not.toHaveBeenCalled();
  });

  it('restores sync when action throws', async () => {
    const setSyncEnabled = vi.fn();
    const action = vi.fn(async () => {
      throw new Error('boom');
    });

    await expect(runWithTemporarySyncDisabled(true, setSyncEnabled, action)).rejects.toThrow('boom');
    expect(setSyncEnabled).toHaveBeenNthCalledWith(1, false);
    expect(setSyncEnabled).toHaveBeenNthCalledWith(2, true);
  });
});

describe('App residue atom extraction helper', () => {
  it('builds residue atom cloud from selected residue atom ids', () => {
    const structure = {
      units: [
        {
          kind: 0,
          elements: [10, 11, 12, 13],
          model: {
            atomicHierarchy: {
              atoms: {
                type_symbol: {
                  value: (atomIdx: number) => ({ 10: 'C', 11: 'N', 12: 'O', 13: 'S' }[atomIdx] || ''),
                },
              },
            },
            atomicConformation: {
              x: { 10: 1, 11: 2, 12: 3, 13: 4 },
              y: { 10: 11, 11: 12, 12: 13, 13: 14 },
              z: { 10: 21, 11: 22, 12: 23, 13: 24 },
            },
          },
        },
      ],
    } as any;

    const result = buildAtomDataForResidueGroup(
      structure,
      ['r1', 'r2'],
      {
        r1: ['10', '11'],
        r2: ['13'],
      },
      'ANY'
    );

    expect(result.symbolTypes).toEqual(['C', 'N', 'S']);
    expect(result.chainIds).toEqual(['__residue__', '__residue__', '__residue__']);
    expect(result.xs).toEqual([1, 2, 4]);
    expect(result.ys).toEqual([11, 12, 14]);
    expect(result.zs).toEqual([21, 22, 24]);
  });

  it('does not drop selected residue atoms due to chain-id filtering mismatches', () => {
    const structure = {
      units: [
        {
          kind: 0,
          elements: [200, 201],
          model: {
            atomicHierarchy: {
              atoms: {
                type_symbol: {
                  value: (atomIdx: number) => ({ 200: 'CA', 201: 'CB' }[atomIdx] || ''),
                },
              },
            },
            atomicConformation: {
              x: { 200: 10, 201: 20 },
              y: { 200: 30, 201: 40 },
              z: { 200: 50, 201: 60 },
            },
          },
        },
      ],
    } as any;

    const result = buildAtomDataForResidueGroup(
      structure,
      ['23', '24'],
      {
        '23': ['200'],
        '24': ['201'],
      },
      'w'
    );

    expect(result.xs.length).toBe(2);
    expect(result.symbolTypes).toEqual(['CA', 'CB']);
  });
});

// (Session file input trigger tests moved to session.integration.test.tsx)
