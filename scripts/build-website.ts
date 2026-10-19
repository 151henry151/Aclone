// SPDX-License-Identifier: GPL-3.0-or-later
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { build } from 'vite';
import { buildBuildingGallery } from './build-building-gallery.ts';
const root = resolve(import.meta.dirname, '..');
const source = join(root, 'website'),
  output = join(root, 'website-dist');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const html = readFileSync(join(source, 'index.html'), 'utf8').replaceAll('__VERSION__', version);
// Catch broken documentation and local asset links before publishing.
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const href = match[1];
  if (href.startsWith('./') && !existsSync(join(source, href)))
    throw Error('Missing website asset: ' + href);
  const doc = href.match(/^https:\/\/github\.com\/151henry151\/Aclone\/blob\/main\/(.+?)(?:#.*)?$/);
  if (doc && !existsSync(join(root, doc[1]))) throw Error('Missing documentation: ' + href);
}
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'index.html'), html);
for (const file of ['site.css', 'site.js', 'assets'])
  cpSync(join(source, file), join(output, file), { recursive: true });
const viewerDir = join(output, 'assets/building-viewer');
await build({
  configFile: false,
  publicDir: false,
  base: '/assets/building-viewer/',
  define: { __ACLONE_BASE__: JSON.stringify('/assets/building-viewer/') },
  build: {
    target: 'es2023',
    outDir: viewerDir,
    emptyOutDir: true,
    lib: {
      entry: join(root, 'src/client/building-gallery-viewer.ts'),
      formats: ['es'],
      fileName: () => 'viewer.js',
    },
  },
});
cpSync(join(root, 'public/textures'), join(viewerDir, 'textures'), { recursive: true });
buildBuildingGallery(source, output, version);
console.log(`Built Aclone ${version} marketing site in website-dist/`);
