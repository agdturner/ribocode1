/**
 * Main entry point for the Ribocode React application. This file renders the main App component into the root element of the HTML document and registers a service worker for PWA support.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner@gmail.com>
 * @version 1.0.0
 * @lastModified 2026-04-24
 * @see https://github.com/ribocode-slola/ribocode1
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'molstar/lib/mol-plugin-ui/skin/light.scss';
import './App.css';

import * as serviceWorkerRegistration from './serviceWorkerRegistration';
// Render the main App component into the root element.
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Register the service worker for PWA support
serviceWorkerRegistration.register();