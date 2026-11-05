/**
 * AppHeader component for Ribocode Mol* Viewer.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.1.0
 * @lastModified 2026-11-05
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React from 'react';
import './AppHeader.css';
import packageJson from '../../package.json';

/**
 * Suffix for the AppHeader root id, used for consistent id construction in code and tests.
 */
export const idSuffix = 'app-header';

const appBaseUrl = import.meta.env.BASE_URL || '/';
const normalizedBaseUrl = appBaseUrl.endsWith('/') ? appBaseUrl : `${appBaseUrl}/`;

const LOCAL_DOCS_README_URL = `${normalizedBaseUrl}docs/index.html`;
const LOCAL_DOCS_USER_GUIDE_URL = `${normalizedBaseUrl}docs/documents/UserGuide.html`;
const CANONICAL_README_URL = 'https://github.com/ribocode-slola/ribocode1/?tab=readme-ov-file#ribocode';
const CANONICAL_USER_GUIDE_URL = 'https://github.com/ribocode-slola/ribocode1/blob/main/UserGuide.md';

async function openDocsLinkWithFallback(
  event: React.MouseEvent<HTMLAnchorElement>,
  docsUrl: string,
  canonicalUrl: string,
  label: string
): Promise<void> {
  event.preventDefault();

  try {
    const response = await fetch(docsUrl, { method: 'HEAD', cache: 'no-store' });
    if (response.ok) {
      window.open(docsUrl, '_blank', 'noopener,noreferrer');
      return;
    }
  } catch {
    // Fall through to fallback guidance.
  }

  alert(
    `${label} documentation is not currently available at ${docsUrl}.\n\n` +
    `This usually means docs have not been generated/deployed for this environment yet.\n\n` +
    `Opening fallback link:\n${canonicalUrl}`
  );
  window.open(canonicalUrl, '_blank', 'noopener,noreferrer');
}

/**
 * AppHeader component that displays the title and README link for the Ribocode Mol* Viewer application.
 * @returns The AppHeader component.
 */

const AppHeader: React.FC = () => (
  <header className="app-header" id={idSuffix}>
    <h1 className="app-title">
      {`RiboCode Mol* Viewer ${packageJson.version}`}
      {' ('}
      <a
        href={LOCAL_DOCS_README_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => { void openDocsLinkWithFallback(event, LOCAL_DOCS_README_URL, CANONICAL_README_URL, 'README'); }}
      >
        README
      </a>
      {' | '}
      <a
        href={LOCAL_DOCS_USER_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => { void openDocsLinkWithFallback(event, LOCAL_DOCS_USER_GUIDE_URL, CANONICAL_USER_GUIDE_URL, 'User Guide'); }}
      >
        User Guide
      </a>
      {')'}
    </h1>
  </header>
);

export default AppHeader;
