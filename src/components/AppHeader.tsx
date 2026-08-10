/**
 * AppHeader component for Ribocode Mol* Viewer.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React from 'react';
import './AppHeader.css';
import packageJson from '../../package.json';

/**
 * Suffix for the AppHeader root id, used for consistent id construction in code and tests.
 */
export const idSuffix = 'app-header';

/**
 * AppHeader component that displays the title and README link for the Ribocode Mol* Viewer application.
 * @returns The AppHeader component.
 */

const AppHeader: React.FC = () => (
  <header className="app-header" id={idSuffix}>
    <h1 className="app-title">
      {`RiboCode Mol* Viewer ${packageJson.version}`}
      {' ('}
      <a href="https://github.com/ribocode-slola/ribocode1/?tab=readme-ov-file#ribocode" target="_blank" rel="noopener noreferrer">README</a>
      {' | '}
      <a href="https://github.com/ribocode-slola/ribocode1/blob/main/UserGuide.md" target="_blank" rel="noopener noreferrer">User Guide</a>
      {')'}
    </h1>
  </header>
);

export default AppHeader;
