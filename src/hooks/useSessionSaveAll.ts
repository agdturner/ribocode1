import { useCallback } from 'react';
import { fileToEmbeddedSessionFile, type EmbeddedSessionFiles } from '../utils/session';
import { buildSessionExportMetadata, buildSessionFilename, saveJsonWithPickerOrDownload } from './useSessionSave';

/**
 * Hook to generate and save the current session state as a JSON file with embedded file data.
 */
export function useSessionSaveAll(
  getSessionState: () => any,
  getEmbeddedFiles: () => Record<string, File | null | undefined>
) {
  const handleSaveSessionAll = useCallback(async () => {
    try {
      const session = getSessionState();
      const embeddedFiles: EmbeddedSessionFiles = {};
      const fileEntries = Object.entries(getEmbeddedFiles());
      for (const [filename, file] of fileEntries) {
        if (!file) continue;
        embeddedFiles[filename] = await fileToEmbeddedSessionFile(file);
      }
      const payload = {
        ...session,
        schemaVersion: 2,
        sessionMetadata: buildSessionExportMetadata('save-all'),
        embeddedFiles,
      };
      const payloadJson = JSON.stringify(payload, null, 2);
      const defaultFilename = buildSessionFilename('session-all');
      await saveJsonWithPickerOrDownload(payloadJson, defaultFilename);
    } catch (err) {
      alert('Failed to save session: ' + (err instanceof Error ? err.message : err));
    }
  }, [getSessionState, getEmbeddedFiles]);

  return handleSaveSessionAll;
}
