/**
 * Vite configuration file for Ribocode project.
 * 
 * Copyright (c) 2024-now Ribocode contributors, licensed under MIT, See LICENSE file for more info.
 * 
 * @author Andy Turner <agdturner.gamil.com>
 */
import 'dotenv/config';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

console.log('VITE_BASE_PATH:', process.env.VITE_BASE_PATH);
const basePath = process.env.VITE_BASE_PATH || '/';
const normalizedBasePath = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
const docsPathPrefix = `${normalizedBasePath}/docs/`.replace(/\/{2,}/g, '/');
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default defineConfig({
  base: basePath, //'/ribocode1/', // Replace with your repository name
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      filename: 'service-worker.js',
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Keep docs routes out of SPA fallback so /docs/index.html serves TypeDoc.
        navigateFallbackDenylist: [
          new RegExp(`^${escapeRegExp(docsPathPrefix)}`),
        ],
      },
      includeAssets: ['favicon.ico', 'robots.txt', 'logo192.png', 'logo512.png'],
      manifest: {
        name: 'Ribocode',
        short_name: 'Ribocode',
        description: 'Ribosome structure analysis and alignment viewer.',
        start_url: basePath,
        scope: basePath,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f172a',
        icons: [
          {
            src: 'logo192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
  ],
  build: {
    outDir: 'dist', // Output directory
    sourcemap: true, // Optional: Generate source maps
    rollupOptions: {
      input: './index.html', // Entry point
    }
  },
  server: {
    open: true, // Automatically open the browser on `npm start`
  },
  resolve: {
    alias: {
      'molstar': path.resolve(__dirname, 'packages/molstar'),
    },
  },
})