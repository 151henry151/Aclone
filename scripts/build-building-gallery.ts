// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { join } from 'node:path';
import { buildings } from '../src/shared/catalog.ts';
import { buildingArchitectures } from '../src/shared/building-architecture.ts';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function buildBuildingGallery(source: string, output: string, version: string) {
  const cards = Object.entries(buildings)
    .map(([kind, def]) => {
      const image = `/assets/buildings/${kind}.webp`;
      if (!existsSync(join(source, image))) throw Error(`Missing building gallery image: ${kind}`);
      const models = buildingArchitectures(kind)
        .map((m) => m.name)
        .join(' · ');
      return `<article id="${kind}" data-search="${escape((kind + ' ' + def.name + ' ' + models).toLocaleLowerCase())}"><div class="card-heading"><h2>${escape(def.name)}</h2><a href="#${kind}" aria-label="Link to ${escape(def.name)}">#</a></div><p class="models">${escape(models)}</p><a class="image-link" href="${image}" data-preview="${kind}" data-name="${escape(def.name)}" aria-label="Explore ${escape(def.name)} in 3D"><img src="${image}" width="1500" height="1040" loading="lazy" alt="Five ${escape(def.name)} architectural models and a size or finish comparison" /></a></article>`;
    })
    .join('\n');
  mkdirSync(join(output, 'buildings'), { recursive: true });
  const html = readFileSync(join(source, 'buildings/index.html'), 'utf8')
    .replace('__BUILDING_CARDS__', cards)
    .replaceAll('__VERSION__', version);
  writeFileSync(join(output, 'buildings/index.html'), html);
  for (const name of ['gallery.css', 'gallery.js'])
    cpSync(join(source, 'buildings', name), join(output, 'buildings', name));
}
