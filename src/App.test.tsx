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
import App, { copyCameraZoomRadiusBetweenViewers, readClippingFromViewer, runWithTemporarySyncDisabled } from './App';

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
});

// (Session file input trigger tests moved to session.integration.test.tsx)
