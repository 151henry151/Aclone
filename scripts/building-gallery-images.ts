// SPDX-License-Identifier: GPL-3.0-or-later
// Refresh public screenshots from real models in a disposable world; no live data.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { industrialKinds } from '../src/shared/building-facade';
import { buildings } from '../src/shared/catalog.ts';
const output = 'output/building-architecture';
const openKinds = [...industrialKinds, 'starport'];
const kinds = process.argv.includes('--open') ? openKinds : Object.keys(buildings);
const closedKinds = kinds.filter((kind) => !openKinds.includes(kind));
for (const args of [closedKinds, ['--open', ...openKinds]]) {
  if (!args.length) continue;
  execFileSync(
    process.execPath,
    ['--import', 'tsx', 'scripts/building-architecture-preview.ts', ...args],
    {
      stdio: 'inherit',
      env: { ...process.env, SCREENSHOT_OUTPUT_DIR: output },
    },
  );
}
mkdirSync('website/assets/buildings', { recursive: true });
for (const kind of kinds) {
  execFileSync('convert', [
    join(output, kind + '.png'),
    '-quality',
    '85',
    join('website/assets/buildings', kind + '.webp'),
  ]);
}
console.log(
  `Refreshed ${kinds.length} public building contact sheets. Review and commit these assets before publishing.`,
);
