import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import packageJson from '../../package.json';
import { useSessionSaveAll } from './useSessionSaveAll';

describe('useSessionSaveAll', () => {
  const expectedVersion = `v${packageJson.version}`;
  let createdBlob: Blob | null = null;

  beforeEach(() => {
    createdBlob = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: any) => {
      createdBlob = blob;
      return 'blob:mock';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).showSaveFilePicker;
  });

  it('uses showSaveFilePicker with a versioned timestamp default name and writes schemaVersion 2 payload', async () => {
    const getSessionState = vi.fn(() => ({
      viewerA: { moleculeAlignedTo: { filename: 'alignedToA.cif' } },
      viewerB: { moleculeAligned: { filename: 'alignedB.cif' } },
    }));
    const getEmbeddedFiles = vi.fn(() => ({
      'alignedToA.cif': new File(['alpha'], 'alignedToA.cif', { type: 'chemical/x-cif' }),
      'alignedB.cif': new File(['beta'], 'alignedB.cif', { type: 'chemical/x-cif' }),
    }));
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable });
    (window as any).showSaveFilePicker = showSaveFilePicker;

    function TestComponent() {
      const save = useSessionSaveAll(getSessionState, getEmbeddedFiles);
      return <button data-testid="saveall-btn" onClick={() => void save()}>Save All</button>;
    }

    render(<TestComponent />);
    fireEvent.click(screen.getByTestId('saveall-btn'));

    await waitFor(() => {
      expect(showSaveFilePicker).toHaveBeenCalled();
      expect(createWritable).toHaveBeenCalled();
      expect(write).toHaveBeenCalled();
      expect(close).toHaveBeenCalled();
    });

    const pickerArg = showSaveFilePicker.mock.calls[0]?.[0];
    expect(pickerArg?.suggestedName).toMatch(new RegExp(`^ribocode-${expectedVersion}-session-all-\\d{4}-\\d{2}-\\d{2}-\\d{6}\\.json$`));

    const payload = JSON.parse(write.mock.calls[0][0]);
    expect(payload.schemaVersion).toBe(2);
    expect(payload.sessionMetadata).toEqual(expect.objectContaining({
      appVersion: packageJson.version,
      exportMode: 'save-all',
      exportedAt: expect.any(String),
    }));
    expect(payload.embeddedFiles['alignedToA.cif']).toEqual(expect.objectContaining({ mime: 'chemical/x-cif' }));
    expect(payload.embeddedFiles['alignedB.cif']).toEqual(expect.objectContaining({ mime: 'chemical/x-cif' }));
  });

  it('falls back to anchor download when showSaveFilePicker is unavailable', async () => {
    const getSessionState = vi.fn(() => ({
      viewerA: { moleculeAlignedTo: { filename: 'alignedToA.cif' } },
    }));
    const getEmbeddedFiles = vi.fn(() => ({
      'alignedToA.cif': new File(['alpha'], 'alignedToA.cif', { type: 'chemical/x-cif' }),
    }));

    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    function TestComponent() {
      const save = useSessionSaveAll(getSessionState, getEmbeddedFiles);
      return <button data-testid="saveall-btn" onClick={() => void save()}>Save All</button>;
    }

    render(<TestComponent />);
    fireEvent.click(screen.getByTestId('saveall-btn'));

    await waitFor(() => {
      expect(createdBlob).toBeTruthy();
      expect(anchorClickSpy).toHaveBeenCalled();
    });
    const appendedAnchor = appendChildSpy.mock.calls.find(([node]) => node instanceof HTMLAnchorElement)?.[0] as HTMLAnchorElement | undefined;
    expect(appendedAnchor).toBeDefined();
    expect(appendedAnchor?.download).toMatch(new RegExp(`^ribocode-${expectedVersion}-session-all-\\d{4}-\\d{2}-\\d{2}-\\d{6}\\.json$`));
    expect(appendChildSpy).toHaveBeenCalled();

    const payload = JSON.parse(await createdBlob!.text());
    expect(payload.schemaVersion).toBe(2);
    expect(payload.sessionMetadata).toEqual(expect.objectContaining({
      appVersion: packageJson.version,
      exportMode: 'save-all',
      exportedAt: expect.any(String),
    }));
    await waitFor(() => expect(removeChildSpy).toHaveBeenCalled());
  });
});
