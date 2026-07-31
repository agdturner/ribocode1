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
import { makeFogSetters, makeCameraSetters, createZoomHandler, makeZoomHandler } from './viewerHelpers';
import { focusLociOnChain, focusLociOnResidue } from '../utils/structure';

vi.mock('../utils/structure', () => ({
  focusLociOnChain: vi.fn(),
  focusLociOnResidue: vi.fn(),
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

  it('makeCameraSetters returns correct setter functions', () => {
    let camera = { near: 0.1, far: 1000 };
    const setCamera = (fn: any) => { camera = fn(camera); };
    const setters = makeCameraSetters(setCamera);
    setters.setNear(5);
    expect(camera.near).toBe(5);
    setters.setFar(500);
    expect(camera.far).toBe(500);
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
});
