/**
 * SyncButton component for toggling synchronization between two Mol* viewers.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React, { useEffect, useRef } from 'react';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra/3d/vec3';
import type { ViewerKey } from '../../types/ribocode';
import GenericSelectButton from './select/Select';

/**
 * Suffix for the SyncButton id, used for consistent id construction in code and tests.
 */
export const idSuffix = 'sync-select';

/**
 * Poll interval for camera sync in milliseconds while Sync is enabled.
 * Keep this low enough to feel instantaneous while avoiding unnecessary CPU churn.
 */
const DEFAULT_SYNC_POLL_INTERVAL_MS = 20;
const MIN_SYNC_POLL_INTERVAL_MS = 5;
const MAX_SYNC_POLL_INTERVAL_MS = 100;

const getSyncPollIntervalMs = () => {
    const raw = import.meta.env.VITE_SYNC_POLL_INTERVAL_MS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return DEFAULT_SYNC_POLL_INTERVAL_MS;
    const rounded = Math.round(parsed);
    return Math.min(MAX_SYNC_POLL_INTERVAL_MS, Math.max(MIN_SYNC_POLL_INTERVAL_MS, rounded));
};

const SYNC_POLL_INTERVAL_MS = getSyncPollIntervalMs();

type CameraSnapshotLike = {
    position: [number, number, number];
    target: [number, number, number];
    up: [number, number, number];
    radius: number;
};

type CameraFrame = {
    right: [number, number, number];
    up: [number, number, number];
    forward: [number, number, number];
};

const EPS = 1e-10;

const toSnapshot = (snapshot: any): CameraSnapshotLike | null => {
    if (!snapshot) return null;
    const toVec3 = (value: any): [number, number, number] | null => {
        if (!value || value.length < 3) return null;
        const x = Number(value[0]);
        const y = Number(value[1]);
        const z = Number(value[2]);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
        return [x, y, z];
    };
    const position = toVec3(snapshot.position);
    const target = toVec3(snapshot.target);
    const up = toVec3(snapshot.up);
    const radius = Number(snapshot.radius);
    if (!position || !target || !up || !Number.isFinite(radius)) return null;
    return { position, target, up, radius };
};

const addVec3 = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
];

const subtractVec3 = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
];

const scale = (a: [number, number, number], factor: number): [number, number, number] => [
    a[0] * factor,
    a[1] * factor,
    a[2] * factor,
];

const dot = (a: [number, number, number], b: [number, number, number]) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const cross = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];

const norm = (a: [number, number, number]) => Math.sqrt(dot(a, a));

const normalize = (a: [number, number, number]): [number, number, number] | null => {
    const n = norm(a);
    if (!Number.isFinite(n) || n < EPS) return null;
    return scale(a, 1 / n);
};

const buildCameraFrame = (snapshot: CameraSnapshotLike): CameraFrame | null => {
    const forward = normalize(subtractVec3(snapshot.target, snapshot.position));
    const up = normalize(snapshot.up);
    if (!forward || !up) return null;
    const right = normalize(cross(forward, up));
    if (!right) return null;
    const orthoUp = normalize(cross(right, forward));
    if (!orthoUp) return null;
    return { right, up: orthoUp, forward };
};

const rotateBetweenFrames = (
    v: [number, number, number],
    fromFrame: CameraFrame,
    toFrame: CameraFrame
): [number, number, number] => {
    // Convert to source-local camera basis, then back into world using destination basis.
    const cRight = dot(v, fromFrame.right);
    const cUp = dot(v, fromFrame.up);
    const cForward = dot(v, fromFrame.forward);
    return addVec3(
        addVec3(scale(toFrame.right, cRight), scale(toFrame.up, cUp)),
        scale(toFrame.forward, cForward)
    );
};

/**
 * Props for SyncButton component.
 * @param viewerA The first Mol* PluginUIContext instance.
 * @param viewerB The second Mol* PluginUIContext instance.
 * @param activeViewer Indicates which viewer is the source for synchronization ('A' or 'B').
 * @param disabled Whether the sync button is disabled.
 * @param syncEnabled Whether synchronization is currently enabled.
 * @param setSyncEnabled Function to toggle synchronization state.
 */
interface SyncButtonProps {
    viewerA: PluginUIContext | null;
    viewerB: PluginUIContext | null;
    activeViewer: ViewerKey;
    disabled: boolean;
    syncEnabled: boolean;
    setSyncEnabled: (enabled: boolean) => void;
    id?: string;
}

/**
 * A button component to toggle synchronization between two Mol* viewers.
 * @param viewerA The first Mol* PluginUIContext instance.
 * @param viewerB The second Mol* PluginUIContext instance.
 * @param activeViewer Indicates which viewer is the source for synchronization ('A' or 'B').
 * @param disabled Whether the sync button is disabled.
 * @param syncEnabled Whether synchronization is currently enabled.
 * @param setSyncEnabled Function to toggle synchronization state.
 * @returns The SyncButton component.
 */
const SyncButton: React.FC<SyncButtonProps> = ({
    viewerA,
    viewerB,
    activeViewer,
    disabled,
    syncEnabled,
    setSyncEnabled,
    id
}) => {
    const isApplyingSync = useRef(false);
    const animationFrameRef = useRef<number | null>(null);
    const lastPollTimeRef = useRef<number>(0);
    const lastSourceSnapshotRef = useRef<{
        position: [number, number, number];
        target: [number, number, number];
        up: [number, number, number];
        radius: number;
    } | null>(null);

    const snapshotsEqual = (
        a: { position: number[]; target: number[]; up: number[]; radius: number } | null,
        b: { position: number[]; target: number[]; up: number[]; radius: number } | null
    ) => {
        if (!a || !b) return false;
        const tol = 1e-7;
        const sameVec = (va: number[], vb: number[]) =>
            va.length === vb.length && va.every((value, idx) => Math.abs(value - vb[idx]) <= tol);
        return sameVec(a.position, b.position)
            && sameVec(a.target, b.target)
            && sameVec(a.up, b.up)
            && Math.abs(a.radius - b.radius) <= tol;
    };

    useEffect(() => {
        if (!syncEnabled || !viewerA || !viewerB) return;

        const sourceViewer = activeViewer === 'A' ? viewerA : viewerB;
        const targetViewer = activeViewer === 'A' ? viewerB : viewerA;
        lastPollTimeRef.current = 0;

        const syncCameraState = () => {
            if (isApplyingSync.current) return;

            const sourceCamera = sourceViewer?.canvas3d?.camera;
            const targetCamera = targetViewer?.canvas3d?.camera;
            if (!sourceCamera || !targetCamera) return;

            const state = toSnapshot(sourceCamera.getSnapshot());
            if (!state) return;
            const previousSource = lastSourceSnapshotRef.current;
            if (snapshotsEqual(state as any, previousSource)) return;

            lastSourceSnapshotRef.current = state;
            if (!previousSource) return;

            const targetSnapshot = toSnapshot(targetCamera.getSnapshot());
            if (!targetSnapshot) return;

            const sourceFromFrame = buildCameraFrame(previousSource);
            const sourceToFrame = buildCameraFrame(state);

            const panDelta = subtractVec3(state.target, previousSource.target);
            const translatedTarget = addVec3(targetSnapshot.target, panDelta);

            const targetOffset = subtractVec3(targetSnapshot.position, targetSnapshot.target);
            const previousSourceOffset = subtractVec3(previousSource.position, previousSource.target);
            const currentSourceOffset = subtractVec3(state.position, state.target);
            const previousSourceDistance = norm(previousSourceOffset);
            const currentSourceDistance = norm(currentSourceOffset);
            const rotatedOffset = sourceFromFrame && sourceToFrame
                ? rotateBetweenFrames(targetOffset, sourceFromFrame, sourceToFrame)
                : targetOffset;

            const distanceScale = previousSourceDistance > EPS
                ? currentSourceDistance / previousSourceDistance
                : 1;
            const scaledOffset = Number.isFinite(distanceScale)
                ? scale(rotatedOffset, distanceScale)
                : rotatedOffset;

            const rotatedUp = sourceFromFrame && sourceToFrame
                ? rotateBetweenFrames(targetSnapshot.up, sourceFromFrame, sourceToFrame)
                : targetSnapshot.up;
            const normalizedUp = normalize(rotatedUp) ?? targetSnapshot.up;

            const radiusScale = Math.abs(previousSource.radius) > EPS
                ? state.radius / previousSource.radius
                : 1;
            const nextRadius = Number.isFinite(radiusScale)
                ? targetSnapshot.radius * radiusScale
                : targetSnapshot.radius;

            const nextPosition = addVec3(translatedTarget, scaledOffset);

            isApplyingSync.current = true;
            try {
                targetCamera.setState({
                    ...targetCamera.state,
                    position: Vec3.clone(nextPosition),
                    target: Vec3.clone(translatedTarget),
                    up: Vec3.clone(normalizedUp),
                    radius: nextRadius,
                });
                targetViewer.canvas3d?.requestDraw?.();
            } finally {
                isApplyingSync.current = false;
            }
        };

        const initialSourceSnapshot = toSnapshot(sourceViewer?.canvas3d?.camera?.getSnapshot?.());
        if (initialSourceSnapshot) {
            lastSourceSnapshotRef.current = initialSourceSnapshot;
        }

        // Keep camera propagation responsive during drag interactions where
        // stateChanged events may be sparse.
        const tick = (timeMs: number) => {
            if (lastPollTimeRef.current === 0 || timeMs - lastPollTimeRef.current >= SYNC_POLL_INTERVAL_MS) {
                lastPollTimeRef.current = timeMs;
                syncCameraState();
            }
            if (typeof requestAnimationFrame === 'function') {
                animationFrameRef.current = requestAnimationFrame(tick);
            }
        };
        if (typeof requestAnimationFrame === 'function') {
            animationFrameRef.current = requestAnimationFrame(tick);
        }

        const subscription = sourceViewer?.canvas3d?.camera?.stateChanged.subscribe(() => syncCameraState());

        return () => {
            subscription?.unsubscribe?.();
            if (animationFrameRef.current !== null && typeof cancelAnimationFrame === 'function') {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [syncEnabled, viewerA, viewerB, activeViewer]);

    // Return the sync select button.
    return (
        <GenericSelectButton
            label="Select Sync"
            options={['On', 'Off']}
            selected={syncEnabled ? 'On' : 'Off'}
            onSelect={option => setSyncEnabled(option === 'On')}
            disabled={disabled}
            id={id}
        />
    );
};

export default SyncButton;