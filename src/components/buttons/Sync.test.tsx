/**
 * Test suite for SyncButton component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import SyncButton from './Sync';
import { idSuffix as syncSelectIdSuffix } from './Sync';

function createMockCamera(initialRadius = 10) {
    const listeners = new Set<() => void>();
    const snapshot = {
        position: [1, 2, 3],
        target: [4, 5, 6],
        up: [0, 1, 0],
        radius: initialRadius,
    };

    return {
        state: { mode: 'perspective' },
        stateChanged: {
            subscribe: (cb: () => void) => {
                listeners.add(cb);
                return {
                    unsubscribe: () => listeners.delete(cb),
                };
            },
        },
        getSnapshot: vi.fn(() => ({
            position: [...snapshot.position],
            target: [...snapshot.target],
            up: [...snapshot.up],
            radius: snapshot.radius,
        })),
        setState: vi.fn((next: any) => {
            snapshot.position = [...next.position];
            snapshot.target = [...next.target];
            snapshot.up = [...next.up];
            snapshot.radius = next.radius;
            listeners.forEach(listener => listener());
        }),
        emit: (next: Partial<typeof snapshot>) => {
            if (next.position) snapshot.position = [...next.position];
            if (next.target) snapshot.target = [...next.target];
            if (next.up) snapshot.up = [...next.up];
            if (typeof next.radius === 'number') snapshot.radius = next.radius;
            listeners.forEach(listener => listener());
        },
        setSnapshotSilently: (next: Partial<typeof snapshot>) => {
            if (next.position) snapshot.position = [...next.position];
            if (next.target) snapshot.target = [...next.target];
            if (next.up) snapshot.up = [...next.up];
            if (typeof next.radius === 'number') snapshot.radius = next.radius;
        },
    };
}

function createMockViewer(camera: ReturnType<typeof createMockCamera>) {
    return {
        canvas3d: {
            camera,
            requestDraw: vi.fn(),
        },
    };
}

describe('SyncButton', () => {
    it('renders with correct label and options', () => {
        const { getByLabelText, getByText } = render(
            <SyncButton
                viewerA={null}
                viewerB={null}
                activeViewer={'A'}
                disabled={false}
                syncEnabled={false}
                setSyncEnabled={() => {}}
                id={syncSelectIdSuffix}
            />
        );
        expect(getByLabelText('Select Sync')).toBeInTheDocument();
        expect(getByText('On')).toBeInTheDocument();
        expect(getByText('Off')).toBeInTheDocument();
    });

    it('shows correct selected value based on syncEnabled', () => {
        const { getByLabelText, rerender } = render(
            <SyncButton
                viewerA={null}
                viewerB={null}
                activeViewer={'A'}
                disabled={false}
                syncEnabled={false}
                setSyncEnabled={() => {}}
                id={syncSelectIdSuffix}
            />
        );
        expect((getByLabelText('Select Sync') as HTMLSelectElement).value).toBe('Off');
        rerender(
            <SyncButton
                viewerA={null}
                viewerB={null}
                activeViewer={'A'}
                disabled={false}
                syncEnabled={true}
                setSyncEnabled={() => {}}
                id="test-sync-select"
            />
        );
        expect((getByLabelText('Select Sync') as HTMLSelectElement).value).toBe('On');
    });

    it('calls setSyncEnabled when option is changed', () => {
        const setSyncEnabled = vi.fn();
        const { getByLabelText } = render(
            <SyncButton
                viewerA={null}
                viewerB={null}
                activeViewer={'A'}
                disabled={false}
                syncEnabled={false}
                setSyncEnabled={setSyncEnabled}
                id={syncSelectIdSuffix}
            />
        );
        fireEvent.change(getByLabelText('Select Sync'), { target: { value: 'On' } });
        expect(setSyncEnabled).toHaveBeenCalledWith(true);
        fireEvent.change(getByLabelText('Select Sync'), { target: { value: 'Off' } });
        expect(setSyncEnabled).toHaveBeenCalledWith(false);
    });

    it('is disabled when disabled prop is true', () => {
        const { getByLabelText } = render(
            <SyncButton
                viewerA={null}
                viewerB={null}
                activeViewer={'A'}
                disabled={true}
                syncEnabled={false}
                setSyncEnabled={() => {}}
                id={syncSelectIdSuffix}
            />
        );
        expect(getByLabelText('Select Sync')).toBeDisabled();
    });

    it('syncs active viewer camera changes as deltas to the other viewer', () => {
        const cameraA = createMockCamera(10);
        const cameraB = createMockCamera(20);
        const viewerA = createMockViewer(cameraA);
        const viewerB = createMockViewer(cameraB);

        act(() => {
            cameraB.setSnapshotSilently({
                position: [41, 50, 60],
                target: [40, 50, 60],
                up: [0, 1, 0],
                radius: 30,
            });
        });

        render(
            <SyncButton
                viewerA={viewerA as any}
                viewerB={viewerB as any}
                activeViewer={'A'}
                disabled={false}
                syncEnabled={true}
                setSyncEnabled={() => {}}
                id={syncSelectIdSuffix}
            />
        );

        act(() => {
            cameraA.emit({ position: [11, 12, 13], target: [14, 15, 16], up: [0, 1, 0], radius: 20 });
        });

        expect(cameraB.setState).toHaveBeenCalled();
        const syncState = cameraB.setState.mock.calls.at(-1)?.[0];
        expect(syncState.target[0]).toBeCloseTo(50, 7);
        expect(syncState.target[1]).toBeCloseTo(60, 7);
        expect(syncState.target[2]).toBeCloseTo(70, 7);
        expect(syncState.position[0]).toBeCloseTo(51, 7);
        expect(syncState.position[1]).toBeCloseTo(60, 7);
        expect(syncState.position[2]).toBeCloseTo(70, 7);
        expect(syncState.up[0]).toBeCloseTo(0, 7);
        expect(syncState.up[1]).toBeCloseTo(1, 7);
        expect(syncState.up[2]).toBeCloseTo(0, 7);
        expect(syncState.radius).toBeCloseTo(60, 7);
        expect(viewerB.canvas3d.requestDraw).toHaveBeenCalled();
    });

    it('does not sync changes from the inactive viewer', () => {
        const cameraA = createMockCamera(10);
        const cameraB = createMockCamera(20);
        const viewerA = createMockViewer(cameraA);
        const viewerB = createMockViewer(cameraB);

        render(
            <SyncButton
                viewerA={viewerA as any}
                viewerB={viewerB as any}
                activeViewer={'A'}
                disabled={false}
                syncEnabled={true}
                setSyncEnabled={() => {}}
                id={syncSelectIdSuffix}
            />
        );

        act(() => {
            cameraB.emit({ position: [3, 2, 1], target: [1, 2, 3], up: [1, 0, 0], radius: 77 });
        });

        expect(cameraA.setState).not.toHaveBeenCalled();
        expect(viewerA.canvas3d.requestDraw).not.toHaveBeenCalled();
    });

    it('syncs camera changes from viewer B to viewer A when viewer B is active', () => {
        const cameraA = createMockCamera(10);
        const cameraB = createMockCamera(20);
        const viewerA = createMockViewer(cameraA);
        const viewerB = createMockViewer(cameraB);

        act(() => {
            cameraA.setSnapshotSilently({
                position: [81, 90, 100],
                target: [80, 90, 100],
                up: [0, 1, 0],
                radius: 15,
            });
        });

        render(
            <SyncButton
                viewerA={viewerA as any}
                viewerB={viewerB as any}
                activeViewer={'B'}
                disabled={false}
                syncEnabled={true}
                setSyncEnabled={() => {}}
                id={syncSelectIdSuffix}
            />
        );

        act(() => {
            cameraB.emit({ position: [6, 7, 8], target: [9, 10, 11], up: [0, 1, 0], radius: 30 });
        });

        expect(cameraA.setState).toHaveBeenCalled();
        const syncState = cameraA.setState.mock.calls.at(-1)?.[0];
        expect(syncState.target[0]).toBeCloseTo(85, 7);
        expect(syncState.target[1]).toBeCloseTo(95, 7);
        expect(syncState.target[2]).toBeCloseTo(105, 7);
        expect(syncState.position[0]).toBeCloseTo(86, 7);
        expect(syncState.position[1]).toBeCloseTo(95, 7);
        expect(syncState.position[2]).toBeCloseTo(105, 7);
        expect(syncState.up[0]).toBeCloseTo(0, 7);
        expect(syncState.up[1]).toBeCloseTo(1, 7);
        expect(syncState.up[2]).toBeCloseTo(0, 7);
        expect(syncState.radius).toBeCloseTo(22.5, 7);
        expect(viewerA.canvas3d.requestDraw).toHaveBeenCalled();
    });

    it('does not propagate a no-op source camera event', () => {
        const cameraA = createMockCamera(10);
        const cameraB = createMockCamera(20);
        const viewerA = createMockViewer(cameraA);
        const viewerB = createMockViewer(cameraB);

        render(
            <SyncButton
                viewerA={viewerA as any}
                viewerB={viewerB as any}
                activeViewer={'A'}
                disabled={false}
                syncEnabled={true}
                setSyncEnabled={() => {}}
                id={syncSelectIdSuffix}
            />
        );

        act(() => {
            // Emit without any state change; this should not trigger a target update.
            cameraA.emit({});
        });

        expect(cameraB.setState).not.toHaveBeenCalled();
    });

    it('propagates source camera changes on animation frame even without stateChanged event', () => {
        const cameraA = createMockCamera(10);
        const cameraB = createMockCamera(20);
        const viewerA = createMockViewer(cameraA);
        const viewerB = createMockViewer(cameraB);

        act(() => {
            cameraB.setSnapshotSilently({
                position: [201, 300, 400],
                target: [200, 300, 400],
                up: [0, 1, 0],
                radius: 50,
            });
        });

        const frameCallbacks = new Map<number, FrameRequestCallback>();
        let nextFrameId = 1;
        vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
            const id = nextFrameId++;
            frameCallbacks.set(id, cb);
            return id;
        }));
        vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
            frameCallbacks.delete(id);
        }));

        try {
            render(
                <SyncButton
                    viewerA={viewerA as any}
                    viewerB={viewerB as any}
                    activeViewer={'A'}
                    disabled={false}
                    syncEnabled={true}
                    setSyncEnabled={() => {}}
                    id={syncSelectIdSuffix}
                />
            );

            act(() => {
                // Update source snapshot without emitting stateChanged.
                cameraA.setSnapshotSilently({
                    position: [4, 5, 6],
                    target: [7, 8, 9],
                    up: [0, 1, 0],
                    radius: 20,
                });
            });

            act(() => {
                const callbacks = Array.from(frameCallbacks.values());
                callbacks.forEach(cb => cb(16));
            });

            act(() => {
                const callbacks = Array.from(frameCallbacks.values());
                callbacks.forEach(cb => cb(40));
            });

            expect(cameraB.setState).toHaveBeenCalled();
            const syncState = cameraB.setState.mock.calls.at(-1)?.[0];
            expect(syncState.target[0]).toBeCloseTo(203, 7);
            expect(syncState.target[1]).toBeCloseTo(303, 7);
            expect(syncState.target[2]).toBeCloseTo(403, 7);
            expect(syncState.position[0]).toBeCloseTo(204, 7);
            expect(syncState.position[1]).toBeCloseTo(303, 7);
            expect(syncState.position[2]).toBeCloseTo(403, 7);
            expect(syncState.up[0]).toBeCloseTo(0, 7);
            expect(syncState.up[1]).toBeCloseTo(1, 7);
            expect(syncState.up[2]).toBeCloseTo(0, 7);
            expect(syncState.radius).toBeCloseTo(100, 7);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it('propagates zoom when source distance changes but radius is unchanged', () => {
        const cameraA = createMockCamera(10);
        const cameraB = createMockCamera(20);
        const viewerA = createMockViewer(cameraA);
        const viewerB = createMockViewer(cameraB);

        act(() => {
            cameraB.setSnapshotSilently({
                position: [101, 200, 300],
                target: [100, 200, 300],
                up: [0, 1, 0],
                radius: 20,
            });
        });

        render(
            <SyncButton
                viewerA={viewerA as any}
                viewerB={viewerB as any}
                activeViewer={'A'}
                disabled={false}
                syncEnabled={true}
                setSyncEnabled={() => {}}
                id={syncSelectIdSuffix}
            />
        );

        act(() => {
            // Move the source camera farther from its target without changing radius.
            cameraA.emit({
                position: [-5, 5, 6],
                target: [7, 8, 9],
                up: [0, 1, 0],
                radius: 10,
            });
        });

        expect(cameraB.setState).toHaveBeenCalled();
        const syncState = cameraB.setState.mock.calls.at(-1)?.[0];

        // The source offset length changed from 3 to sqrt(162), scale factor sqrt(18).
        expect(syncState.target[0]).toBeCloseTo(103, 7);
        expect(syncState.target[1]).toBeCloseTo(203, 7);
        expect(syncState.target[2]).toBeCloseTo(303, 7);

        const offset = [
            syncState.position[0] - syncState.target[0],
            syncState.position[1] - syncState.target[1],
            syncState.position[2] - syncState.target[2],
        ];
        const propagatedDistance = Math.sqrt(
            offset[0] * offset[0] + offset[1] * offset[1] + offset[2] * offset[2]
        );
        // Source offset length changed from sqrt(27) to sqrt(162), so distance scale is sqrt(6).
        expect(propagatedDistance).toBeCloseTo(Math.sqrt(6), 7);

        // Radius remains unchanged in source, so target radius should remain unchanged too.
        expect(syncState.radius).toBeCloseTo(20, 7);
    });
});
