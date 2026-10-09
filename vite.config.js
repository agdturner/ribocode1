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

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/', //'/ribocode1/', // Replace with your repository name
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      filename: 'service-worker.js',
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      includeAssets: ['favicon.ico', 'robots.txt', 'logo192.png', 'logo512.png'],
      manifest: {
        name: 'Ribocode',
        short_name: 'Ribocode',
        description: 'Ribosome structure analysis and alignment viewer.',
        start_url: process.env.VITE_BASE_PATH || '/',
        scope: process.env.VITE_BASE_PATH || '/',
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