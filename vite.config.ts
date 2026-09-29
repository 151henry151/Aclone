// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from 'vite';
const raw = process.env.BASE_PATH ?? '/';
const base = raw.endsWith('/') ? raw : `${raw}/`;
export default defineConfig({
  base,
  define: { __ACLONE_BASE__: JSON.stringify(base) },
  build: { target: 'es2023' },
  server: { host: '127.0.0.1' },
});
