/**
 * Unit tests for viewer helper functions, including fog and camera setters, and zoom handlers.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.1
 * @lastModified 2026-06-22
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { makeFogSetters, makeClippingSetters, createZoomHandler, makeZoomHandler, createChainHighlightHandler, createChainHighlightToggleHandler, createResidueHighlightToggleHandler, createSubunitHighlightToggleHandler } from './viewerHelpers';
import { focusLociOnChain, focusLociOnResidue, focusLociOnResidues, highlightLociOnChain, highlightLociOnResidues, highlightLociOnSubunit } from '../utils/structure';

vi.mock('../utils/structure', () => ({
  focusLociOnChain: vi.fn(),
  focusLociOnResidue: vi.fn(),
  focusLociOnResidues: vi.fn(),
  focusLociOnSubunit: vi.fn(),
  highlightLociOnChain: vi.fn(),
  highlightLociOnResidues: vi.fn(),
  highlightLociOnSubunit: vi.fn(),
}));

describe('viewerHelpers', () => {
  it('makeFogSetters returns correct setter functions', () => {
    let fog = { enabled: false, near: 0, far: 100 };
    const setFog = (fn: any) => { fog = fn(fog); };
    const setters = makeFogSetters(setFog);
    setters.setEnabled(true);
    expect(fog.enabled).toBe(true);
    setters.setNear(10);
    expect(fog.near).toBe(10);
    setters.setFar(200);
    expect(fog.far).toBe(200);
  });

  it('makeClippingSetters returns correct setter functions', () => {
    let clipping = { minNear: 1, clipRadius: 100 };
    const setClipping = (fn: any) => { clipping = fn(clipping); };
    const setters = makeClippingSetters(setClipping);
    setters.setMinNear(5);
    expect(clipping.minNear).toBe(5);
    setters.setClipRadius(80);
    expect(clipping.clipRadius).toBe(80);
  });

  it('createZoomHandler returns an object with handleButtonClick', () => {
    const pluginRef = { current: null };
    const handler = createZoomHandler(pluginRef as any, null, 'chain-test', '', false);
    expect(typeof handler.handleButtonClick).toBe('function');
  });

  it('makeZoomHandler returns an object with handleButtonClick', () => {
    const pluginRef = { current: null };
    const handler = makeZoomHandler({
      pluginRef: pluginRef as any,
      structureRef: null,
      property: 'chain-test',
      chainId: '',
      sync: false
    });
    expect(typeof handler.handleButtonClick).toBe('function');
  });

  it('syncs chain zoom to the other viewer when sync is enabled', async () => {
    vi.mocked(focusLociOnChain).mockClear();
    const pluginRef = { current: { id: 'plugin-a' } };
    const syncPluginRef = { current: { id: 'plugin-b' } };
    const handler = makeZoomHandler({
      pluginRef: pluginRef as any,
      structureRef: 'struct-a',
      property: 'chain-test',
      chainId: 'A',
      sync: true,
      syncPluginRef: syncPluginRef as any,
    });

    await handler.handleButtonClick();

    // zoomExtraRadius/zoomMinRadius not supplied → undefined; syncPlugin passed
    expect(focusLociOnChain).toHaveBeenCalledWith(
      pluginRef.current,
      'struct-a',
      'A',
      syncPluginRef.current,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
  });

  it('passes zoomExtraRadius and zoomMinRadius to chain zoom handler', async () => {
    vi.mocked(focusLociOnChain).mockClear();
    const pluginRef = { current: { id: 'plugin-a' } };
    const handler = createZoomHandler(
      pluginRef as any,
      'struct-a',
      'chain-test',
      'B',
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      20,
      16
    );

    await handler.handleButtonClick();

    expect(focusLociOnChain).toHaveBeenCalledWith(
      pluginRef.current,
      'struct-a',
      'B',
      undefined,
      undefined,
      20,
      16,
      undefined,
      undefined
    );
  });

  it('syncs residue zoom with zoom options to the other viewer when sync is enabled', async () => {
    vi.mocked(focusLociOnResidue).mockClear();
    const pluginRef = { current: { id: 'plugin-a' } };
    const syncPluginRef = { current: { id: 'plugin-b' } };
    const handler = createZoomHandler(
      pluginRef as any,
      'struct-a',
      'residue-test',
      'A',
      true,
      syncPluginRef as any,
      '25',
      'A',
      undefined,
      undefined,
      undefined,
      undefined,
      5,
      2
    );

    await handler.handleButtonClick();

    expect(focusLociOnResidue).toHaveBeenCalledWith(
      pluginRef.current,
      'struct-a',
      'A',
      '25',
      'A',
      syncPluginRef.current,
      5,
      2,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
  });

  it('passes zoomExtraRadius/minRadius for residue zoom when sync is disabled', async () => {
    vi.mocked(focusLociOnResidue).mockClear();
    const pluginRef = { current: { id: 'plugin-a' } };
    const handler = makeZoomHandler({
      pluginRef: pluginRef as any,
      structureRef: 'struct-a',
      property: 'residue-test',
      chainId: 'B',
      sync: false,
      residueId: '10',
      insCode: '',
      zoomExtraRadius: 24,
      zoomMinRadius: 12,
    });

    await handler.handleButtonClick();

    expect(focusLociOnResidue).toHaveBeenCalledWith(
      pluginRef.current,
      'struct-a',
      'B',
      '10',
      '',
      undefined,
      24,
      12,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
  });

  it('uses multi-residue focus when multiple residue ids are provided', async () => {
    vi.mocked(focusLociOnResidues).mockClear();
    const pluginRef = { current: { id: 'plugin-a' } };
    const syncPluginRef = { current: { id: 'plugin-b' } };
    const handler = makeZoomHandler({
      pluginRef: pluginRef as any,
      structureRef: 'struct-a',
      property: 'residue-test',
      chainId: 'A',
      sync: true,
      syncPluginRef: syncPluginRef as any,
      syncStructureRef: 'struct-b',
      syncChainId: 'A',
      residueIds: ['10', '11'],
      syncResidueIds: ['10', '11'],
      residueInsCodes: { '10': '', '11': 'A' },
      syncResidueInsCodes: { '10': '', '11': 'A' },
      zoomExtraRadius: 24,
      zoomMinRadius: 12,
    });

    await handler.handleButtonClick();

    expect(focusLociOnResidues).toHaveBeenCalledWith(
      pluginRef.current,
      'struct-a',
      'A',
      ['10', '11'],
      { '10': '', '11': 'A' },
      syncPluginRef.current,
      24,
      12,
      'struct-b',
      'A',
      ['10', '11'],
      { '10': '', '11': 'A' }
    );
  });

  it('highlights selected chain and syncs highlight when enabled', async () => {
    vi.mocked(highlightLociOnChain).mockClear();
    const pluginRef = { current: { id: 'plugin-a' } };
    const syncPluginRef = { current: { id: 'plugin-b' } };
    const handler = createChainHighlightHandler(
      pluginRef as any,
      'struct-a',
      'A',
      true,
      syncPluginRef as any,
      'struct-b',
      'B'
    );

    await handler.handleButtonClick();

    expect(highlightLociOnChain).toHaveBeenCalledWith(
      pluginRef.current,
      'struct-a',
      'A',
      syncPluginRef.current,
      undefined,
      'struct-b',
      'B'
    );
  });

  it('toggles highlight on when currently off', async () => {
    vi.mocked(highlightLociOnChain).mockClear();
    const deselectAllA = vi.fn();
    const clearHighlightsA = vi.fn();
    const pluginRef = {
      current: {
        id: 'plugin-a',
        managers: { interactivity: { lociSelects: { deselectAll: deselectAllA }, lociHighlights: { clearHighlights: clearHighlightsA } } },
      },
    };
    const setIsHighlighted = vi.fn();
    const handler = createChainHighlightToggleHandler(
      pluginRef as any,
      'struct-a',
      'A',
      false,
      setIsHighlighted,
      false
    );

    await handler.handleButtonClick();

    expect(highlightLociOnChain).toHaveBeenCalledWith(
      pluginRef.current,
      'struct-a',
      'A',
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(setIsHighlighted).toHaveBeenCalledWith(true);
    expect(deselectAllA).not.toHaveBeenCalled();
    expect(clearHighlightsA).not.toHaveBeenCalled();
  });

  it('toggles highlight off when currently on and clears both viewers if synced', async () => {
    vi.mocked(highlightLociOnChain).mockClear();
    const deselectAllA = vi.fn();
    const clearHighlightsA = vi.fn();
    const deselectAllB = vi.fn();
    const clearHighlightsB = vi.fn();
    const pluginRef = {
      current: {
        id: 'plugin-a',
        managers: { interactivity: { lociSelects: { deselectAll: deselectAllA }, lociHighlights: { clearHighlights: clearHighlightsA } } },
      },
    };
    const syncPluginRef = {
      current: {
        id: 'plugin-b',
        managers: { interactivity: { lociSelects: { deselectAll: deselectAllB }, lociHighlights: { clearHighlights: clearHighlightsB } } },
      },
    };
    const setIsHighlighted = vi.fn();
    const handler = createChainHighlightToggleHandler(
      pluginRef as any,
      'struct-a',
      'A',
      true,
      setIsHighlighted,
      true,
      syncPluginRef as any,
      'struct-b',
      'B'
    );

    await handler.handleButtonClick();

    expect(deselectAllA).toHaveBeenCalled();
    expect(clearHighlightsA).not.toHaveBeenCalled();
    expect(deselectAllB).toHaveBeenCalled();
    expect(clearHighlightsB).not.toHaveBeenCalled();
    expect(highlightLociOnChain).not.toHaveBeenCalled();
    expect(setIsHighlighted).toHaveBeenCalledWith(false);
  });

  it('toggles residue highlight on when currently off', async () => {
    vi.mocked(highlightLociOnResidues).mockClear();
    const pluginRef = {
      current: {
        id: 'plugin-a',
        managers: { interactivity: { lociSelects: { deselectAll: vi.fn() }, lociHighlights: { clearHighlights: vi.fn() } } },
      },
    };
    const setIsHighlighted = vi.fn();
    const handler = createResidueHighlightToggleHandler(
      pluginRef as any,
      'struct-a',
      'A',
      ['10', '11'],
      { '10': '', '11': 'A' },
      false,
      setIsHighlighted,
      false
    );

    await handler.handleButtonClick();

    expect(highlightLociOnResidues).toHaveBeenCalledWith(
      pluginRef.current,
      'struct-a',
      'A',
      ['10', '11'],
      { '10': '', '11': 'A' },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    );
    expect(setIsHighlighted).toHaveBeenCalledWith(true);
  });

  it('toggles residue highlight off when currently on', async () => {
    vi.mocked(highlightLociOnResidues).mockClear();
    const deselectAll = vi.fn();
    const clearHighlights = vi.fn();
    const pluginRef = {
      current: {
        id: 'plugin-a',
        managers: { interactivity: { lociSelects: { deselectAll }, lociHighlights: { clearHighlights } } },
      },
    };
    const setIsHighlighted = vi.fn();
    const handler = createResidueHighlightToggleHandler(
      pluginRef as any,
      'struct-a',
      'A',
      ['10'],
      { '10': '' },
      true,
      setIsHighlighted,
      false
    );

    await handler.handleButtonClick();

    expect(deselectAll).not.toHaveBeenCalled();
    expect(clearHighlights).toHaveBeenCalled();
    expect(highlightLociOnResidues).not.toHaveBeenCalled();
    expect(setIsHighlighted).toHaveBeenCalledWith(false);
  });

  it('toggles subunit highlight on when currently off', async () => {
    vi.mocked(highlightLociOnSubunit).mockClear();
    const pluginRef = {
      current: {
        id: 'plugin-a',
        managers: {
          interactivity: { lociSelects: { deselectAll: vi.fn() }, lociHighlights: { clearHighlights: vi.fn() } },
          structure: { focus: { clear: vi.fn() } }
        },
      },
    };
    const setIsHighlighted = vi.fn();
    const handler = createSubunitHighlightToggleHandler(
      pluginRef as any,
      'struct-a',
      ['A', 'B'],
      false,
      setIsHighlighted,
      false
    );

    await handler.handleButtonClick();

    expect(highlightLociOnSubunit).toHaveBeenCalledWith(
      pluginRef.current,
      'struct-a',
      ['A', 'B'],
      undefined,
      undefined,
      undefined
    );
    expect(setIsHighlighted).toHaveBeenCalledWith(true);
  });

  it('toggles subunit highlight off and clears only focus channel', async () => {
    vi.mocked(highlightLociOnSubunit).mockClear();
    const deselectAll = vi.fn();
    const clearHighlights = vi.fn();
    const clearFocus = vi.fn();
    const pluginRef = {
      current: {
        id: 'plugin-a',
        managers: {
          interactivity: { lociSelects: { deselectAll }, lociHighlights: { clearHighlights } },
          structure: { focus: { clear: clearFocus } }
        },
      },
    };
    const setIsHighlighted = vi.fn();
    const handler = createSubunitHighlightToggleHandler(
      pluginRef as any,
      'struct-a',
      ['A'],
      true,
      setIsHighlighted,
      false
    );

    await handler.handleButtonClick();

    expect(clearFocus).toHaveBeenCalled();
    expect(deselectAll).not.toHaveBeenCalled();
    expect(clearHighlights).not.toHaveBeenCalled();
    expect(highlightLociOnSubunit).not.toHaveBeenCalled();
    expect(setIsHighlighted).toHaveBeenCalledWith(false);
  });
});
