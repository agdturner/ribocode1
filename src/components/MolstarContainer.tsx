/**
 * MolstarContainer component that integrates the Mol* plugin within a React application.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React, { memo, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as PluginUI from 'molstar/lib/mol-plugin-ui';
const createPluginUI = PluginUI.createPluginUI;
import type { ViewerKey } from '../types/ribocode';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { PluginBehaviors } from 'molstar/lib/mol-plugin/behavior';
import { Binding } from 'molstar/lib/mol-util/binding';
import RibocodeViewer from './RibocodeViewer';

/**
 * Suffix for the MolstarContainer root id, used for consistent id construction in code and tests.
 */
export const idSuffix = 'molstar-container';

/**
 * Props for MolstarContainer component.
 * @param viewerKey Unique key for the viewer instance.
 * @param setViewer Function to set the PluginUIContext instance.
 * @param onMouseDown Optional callback for viewer activation events.
 * @param onReady Optional callback when the viewer is ready.
 */
type MolstarContainerProps = {
    viewerKey: ViewerKey;
    setViewer: (plugin: PluginUIContext) => void;
    onMouseDown?: (viewerKey: ViewerKey) => void;
    onReady?: () => void;
    idPrefix?: string;
    showAdvancedControls?: boolean;
};

/**
 * MolstarContainer component manages the lifecycle of the Mol* plugin instance.
 * @param viewerKey Unique key for the viewer instance.
 * @param setViewer Function to set the PluginUIContext instance.
 * @param onMouseDown Optional callback for viewer activation events.
 * @param onReady Optional callback when the viewer is ready.
 * @param ref Forwarded ref to expose methods to parent components.
 * @returns The MolstarContainer component.
 */
const MolstarContainer = React.forwardRef(({ viewerKey, setViewer, onMouseDown, onReady, idPrefix, showAdvancedControls = false }: MolstarContainerProps, ref) => {
    // Use a ref callback to track when the container is mounted and ref is set
    const [containerReady, setContainerReady] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const setContainerRef = (el: HTMLDivElement | null) => {
        containerRef.current = el;
        if (el) setContainerReady(true);
        else setContainerReady(false);
    };
    const pluginRef = useRef<PluginUIContext | null>(null);
    const [plugin, setPlugin] = useState<PluginUIContext | null>(null);
    const rootRef = useRef<ReactDOM.Root | null>(null);
    useEffect(() => {
        const container = containerRef.current;
        if (!container || !onMouseDown) return;

        const activateViewer = () => onMouseDown(viewerKey);
        container.addEventListener('pointerenter', activateViewer, true);
        container.addEventListener('pointermove', activateViewer, true);
        container.addEventListener('wheel', activateViewer, true);
        container.addEventListener('pointerdown', activateViewer, true);

        return () => {
            container.removeEventListener('pointerenter', activateViewer, true);
            container.removeEventListener('pointermove', activateViewer, true);
            container.removeEventListener('wheel', activateViewer, true);
            container.removeEventListener('pointerdown', activateViewer, true);
        };
    }, [onMouseDown, viewerKey, containerReady]);

    // Plugin lifecycle: initialization and cleanup
    React.useLayoutEffect(() => {
        const container = containerRef.current;
        console.log(`[MolstarContainer ${viewerKey}] Plugin init effect. containerRef.current:`, container);
        if (!containerReady || !container) {
            // Wait until the container is mounted and ref is set
            return;
        }
        // Cleanup previous plugin/root
        if (pluginRef.current) {
            pluginRef.current.dispose();
            pluginRef.current = null;
        }
        if (rootRef.current) {
            rootRef.current.unmount();
            rootRef.current = null;
        }
        // Async plugin initialization
        const initializePlugin = async () => {
            try {
                const pluginInstance = await createPluginUI({
                    target: container,
                    render: (component: React.ReactNode, container: HTMLElement) => {
                        if (!rootRef.current) {
                            rootRef.current = ReactDOM.createRoot(container);
                        }
                        rootRef.current.render(component);
                    },
                });
                if (typeof pluginInstance.state?.updateBehavior === 'function') {
                    await pluginInstance.state.updateBehavior(PluginBehaviors.Camera.FocusLoci, params => {
                        params.bindings = {
                            ...params.bindings,
                            clickResetCameraOnEmpty: Binding.Empty,
                            clickResetCameraOnEmptySelectMode: Binding.Empty,
                        };
                    });
                }
                // WebGL context loss handling
                const gl = pluginInstance.canvas3d?.webgl?.gl;
                if (gl) {
                    gl.canvas.addEventListener('webglcontextlost', (event: WebGLContextEvent) => {
                        event.preventDefault();
                        console.error('WebGL context lost.');
                    });
                    gl.canvas.addEventListener('webglcontextrestored', () => {
                        (async () => {
                            if (pluginRef.current) {
                                pluginRef.current.dispose();
                                pluginRef.current = null;
                            }
                            await initializePlugin();
                        })();
                    });
                }
                // Set the plugin instance on the ref.
                pluginRef.current = pluginInstance;
                // Also set the plugin instance on the forwarded ref, if present
                if (ref && typeof ref === 'object' && 'current' in ref) {
                    ref.current = pluginInstance;
                }
                setPlugin(pluginInstance);
                setViewer(pluginInstance);
                if (onReady) onReady();
            } catch (err) {
                console.error(`[MolstarContainer ${viewerKey}] Plugin creation failed:`, err);
            }
        };
        // Start.
        initializePlugin();
        // Cleanup on unmount.
        return () => {
            if (pluginRef.current) {
                pluginRef.current.dispose();
                pluginRef.current = null;
            }
            if (rootRef.current) {
                rootRef.current.unmount();
                rootRef.current = null;
            }
        };
    }, [viewerKey, containerReady]);
    // Update setViewer when plugin changes.
    useEffect(() => {
        if (plugin && setViewer) {
            setViewer(plugin);
        }
    }, [plugin, setViewer]);
    // Expose forceMolstarUIRefresh via ref (triggers a React re-render of the Molstar UI only)
    React.useImperativeHandle(ref, () => ({
        forceMolstarUIRefresh: () => {
            setPlugin(p => p); // Triggers a re-render of the Molstar UI without breaking prototype
        }
    }), []);

    // Return the container with a dedicated plugin root for Mol*
    // Render RibocodeViewer and pass idPrefix
        return (
            <div
                id={idPrefix ? `${idPrefix}-${idSuffix}` : idSuffix}
                className={`molstar-container-root ${showAdvancedControls ? 'molstar-advanced-controls-visible' : 'molstar-advanced-controls-hidden'}`}
                ref={setContainerRef}
            >
                <RibocodeViewer
                    plugin={plugin}
                    viewerKey={viewerKey}
                    onReady={onReady}
                    idPrefix={idPrefix}
                />
            </div>
        );
});

/**
 * Memoized MolstarContainer to prevent unnecessary re-renders.
 * @param prevProps Previous props.
 * @param nextProps Next props.
 * @returns Whether the props are equal.
 */
export default memo(
    MolstarContainer,
    (prevProps: MolstarContainerProps, nextProps: MolstarContainerProps) =>
    prevProps.viewerKey === nextProps.viewerKey
    && prevProps.idPrefix === nextProps.idPrefix
    && prevProps.showAdvancedControls === nextProps.showAdvancedControls
);