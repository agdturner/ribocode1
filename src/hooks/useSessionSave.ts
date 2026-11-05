/**
 * Custom hook to generate and save the current session state as a JSON file.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import { useCallback } from 'react';
import packageJson from '../../package.json';

type SaveFilePickerAcceptType = {
  description?: string;
  accept: Record<string, string[]>;
};

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: SaveFilePickerAcceptType[];
};

type SaveFileWritable = {
  write: (data: string | Blob) => Promise<void>;
  close: () => Promise<void>;
};

type SaveFileHandle = {
  createWritable: () => Promise<SaveFileWritable>;
};

export interface SessionExportMetadata {
  appVersion: string;
  exportedAt: string;
  exportMode: 'save' | 'save-all';
}

export function buildSessionFilename(kind: 'session' | 'session-all'): string {
  const rawVersion = String(packageJson.version ?? '').trim();
  const safeVersion = rawVersion ? `v${rawVersion}` : 'v0.0.0';
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const kindSuffix = kind === 'session-all' ? 'session-all' : 'session';
  return `ribocode-${safeVersion}-${kindSuffix}-${date}-${time}.json`;
}

export function buildSessionExportMetadata(exportMode: 'save' | 'save-all'): SessionExportMetadata {
  const rawVersion = String(packageJson.version ?? '').trim();
  return {
    appVersion: rawVersion || '0.0.0',
    exportedAt: new Date().toISOString(),
    exportMode,
  };
}

export async function saveJsonWithPickerOrDownload(
  payload: string,
  filename: string
): Promise<void> {
  const showSaveFilePicker = (window as Window & {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<SaveFileHandle>;
  }).showSaveFilePicker;

  if (typeof showSaveFilePicker === 'function') {
    try {
      const fileHandle = await showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description: 'JSON file',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(payload);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      // Fallback to normal browser download flow.
    }
  }

  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

/**
 * Hook to generate and save the current session state as a JSON file.
 * @param getSessionState - Function that returns the current session state object.
 * @returns handleSaveSession - Function to trigger session save/download.
 */
export function useSessionSave(getSessionState: () => any) {
  const handleSaveSession = useCallback(async () => {
    try {
      const session = getSessionState();
      const payload = JSON.stringify({
        ...session,
        schemaVersion: 1,
        sessionMetadata: buildSessionExportMetadata('save'),
      }, null, 2);
      const defaultFilename = buildSessionFilename('session');
      await saveJsonWithPickerOrDownload(payload, defaultFilename);
    } catch (err) {
      alert('Failed to save session: ' + (err instanceof Error ? err.message : err));
    }
  }, [getSessionState]);

  return handleSaveSession;
}
