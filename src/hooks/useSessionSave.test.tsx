import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSessionSave } from './useSessionSave';
import packageJson from '../../package.json';

describe('useSessionSave', () => {
  const expectedVersion = `v${packageJson.version}`;

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window as any).showSaveFilePicker;
  });

  it('uses showSaveFilePicker with suggested filename containing version and timestamp when available', async () => {
    const getSessionState = vi.fn(() => ({
      viewerA: { moleculeAlignedTo: { filename: 'alignedToA.cif' } },
    }));
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const showSaveFilePicker = vi.fn().mockResolvedValue({ createWritable });
    (window as any).showSaveFilePicker = showSaveFilePicker;

    function TestComponent() {
      const save = useSessionSave(getSessionState);
      return <button data-testid="save-btn" onClick={() => void save()}>Save</button>;
    }

    render(<TestComponent />);
    fireEvent.click(screen.getByTestId('save-btn'));

    await waitFor(() => {
      expect(showSaveFilePicker).toHaveBeenCalled();
      expect(createWritable).toHaveBeenCalled();
      expect(write).toHaveBeenCalled();
      expect(close).toHaveBeenCalled();
    });

    const pickerArg = showSaveFilePicker.mock.calls[0]?.[0];
    expect(pickerArg?.suggestedName).toMatch(new RegExp(`^ribocode-${expectedVersion}-session-\\d{4}-\\d{2}-\\d{2}-\\d{6}\\.json$`));
    const savedJson = write.mock.calls[0][0];
    const payload = JSON.parse(savedJson);
    expect(payload.schemaVersion).toBe(1);
    expect(payload.sessionMetadata).toEqual(expect.objectContaining({
      appVersion: packageJson.version,
      exportMode: 'save',
      exportedAt: expect.any(String),
    }));
    expect(payload).toEqual(expect.objectContaining({
      viewerA: expect.objectContaining({
        moleculeAlignedTo: expect.objectContaining({ filename: 'alignedToA.cif' }),
      }),
    }));
  });

  it('falls back to anchor download with versioned timestamp filename when showSaveFilePicker is unavailable', async () => {
    const getSessionState = vi.fn(() => ({ viewerA: { moleculeAlignedTo: { filename: 'alignedToA.cif' } } }));
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    function TestComponent() {
      const save = useSessionSave(getSessionState);
      return <button data-testid="save-btn" onClick={() => void save()}>Save</button>;
    }

    render(<TestComponent />);
    fireEvent.click(screen.getByTestId('save-btn'));

    await waitFor(() => {
      expect(createObjectUrlSpy).toHaveBeenCalled();
      expect(anchorClickSpy).toHaveBeenCalled();
    });
    const appendedAnchor = appendChildSpy.mock.calls.find(([node]) => node instanceof HTMLAnchorElement)?.[0] as HTMLAnchorElement | undefined;
    expect(appendedAnchor).toBeDefined();
    expect(appendedAnchor?.download).toMatch(new RegExp(`^ribocode-${expectedVersion}-session-\\d{4}-\\d{2}-\\d{2}-\\d{6}\\.json$`));
    expect(appendChildSpy).toHaveBeenCalled();
    await waitFor(() => expect(removeChildSpy).toHaveBeenCalled());
  });
});
