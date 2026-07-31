/**
 * Test suite for MolstarContainer component.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { vi } from 'vitest';
import { render, act, fireEvent, waitFor } from '@testing-library/react';

// Mock Molstar and PluginUI imports to avoid Vitest parsing errors
vi.mock('molstar/lib/mol-plugin-ui/context', () => ({}));
vi.mock('molstar/lib/mol-plugin-ui', () => ({
    createPluginUI: vi.fn(() => Promise.resolve({ dispose: vi.fn(), canvas3d: { webgl: { gl: { canvas: { addEventListener: vi.fn() } } } } }))
}));
vi.mock('molstar/lib/mol-plugin-ui/context', () => ({}));

import MolstarContainer, { idSuffix as molstarContainerIdSuffix } from './MolstarContainer';

describe('MolstarContainer', () => {
    let originalLog: any;
    beforeAll(() => {
        originalLog = console.log;
        console.log = vi.fn();
    });
    afterAll(() => {
        console.log = originalLog;
    });
    it('renders the container div and calls setViewer', async () => {
        const setViewer = vi.fn();
        await act(async () => {
            render(
                <MolstarContainer
                    viewerKey="A"
                    setViewer={setViewer}
                    idPrefix="test-molstar"
                />
            );
        });
        // The root container should be in the document
        const root = document.getElementById(`test-molstar-${molstarContainerIdSuffix}`);
        expect(root).toBeInTheDocument();
    });

    it('calls onMouseDown when the plugin root is clicked', async () => {
        const setViewer = vi.fn();
        const onMouseDown = vi.fn();
        let container: HTMLElement;
        await act(async () => {
            const rendered = render(
                <MolstarContainer
                    viewerKey="A"
                    setViewer={setViewer}
                    onMouseDown={onMouseDown}
                    idPrefix="test-molstar"
                />
            );
            container = rendered.container;
        });

        await waitFor(() => {
            expect(container.querySelector('.molstar-container-root')).not.toBeNull();
        });

        const root = container.querySelector('.molstar-container-root') as HTMLElement;
        fireEvent.pointerDown(root);
        expect(onMouseDown).toHaveBeenCalledWith('A');
    });

    it('calls onMouseDown when pointer moves over the container', async () => {
        const setViewer = vi.fn();
        const onMouseDown = vi.fn();
        let container: HTMLElement;
        await act(async () => {
            const rendered = render(
                <MolstarContainer
                    viewerKey="B"
                    setViewer={setViewer}
                    onMouseDown={onMouseDown}
                    idPrefix="test-molstar-hover"
                />
            );
            container = rendered.container;
        });

        await waitFor(() => {
            expect(container.querySelector('.molstar-container-root')).not.toBeNull();
        });

        const root = container.querySelector('.molstar-container-root') as HTMLElement;
        fireEvent.pointerMove(root);
        expect(onMouseDown).toHaveBeenCalledWith('B');
    });
});
