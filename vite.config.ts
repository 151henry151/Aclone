// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from 'vite';
import { compressClient } from './scripts/compress-client';
import { resolve } from 'node:path';
let outputDirectory = 'dist';
const raw = process.env.BASE_PATH ?? '/';
const base = raw.endsWith('/') ? raw : `${raw}/`;
export default defineConfig({
  base,
  plugins: [
    {
      name: 'compressed-client',
      apply: 'build',
      configResolved(config) {
        outputDirectory = resolve(config.root, config.build.outDir);
      },
      async closeBundle() {
        await compressClient(outputDirectory);
      },
    },
  ],
  define: { __ACLONE_BASE__: JSON.stringify(base) },
  build: { target: 'es2023' },
  server: {
    host: '127.0.0.1',
    // Playwright traces contain HTML snapshots; they must not reload the app
    // while the same browser test is capturing or interacting with it.
    watch: {
      ignored: [
        '**/output/**',
        '**/test-results/**',
        '**/playwright-report/**',
        '**/website-dist/**',
      ],
    },
  },
});
