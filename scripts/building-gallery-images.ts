// SPDX-License-Identifier: GPL-3.0-or-later
// Refresh public screenshots from real models in a disposable world; no live data.
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildings } from '../src/shared/catalog.ts';
const output = 'output/building-architecture';
execFileSync(process.execPath, ['--import', 'tsx', 'scripts/building-architecture-preview.ts'], {
  stdio: 'inherit',
  env: { ...process.env, SCREENSHOT_OUTPUT_DIR: output },
});
mkdirSync('website/assets/buildings', { recursive: true });
for (const kind of Object.keys(buildings)) {
  execFileSync('convert', [
    join(output, kind + '.png'),
    '-quality',
    '85',
    join('website/assets/buildings', kind + '.webp'),
  ]);
}
console.log(
  'Refreshed 49 public building contact sheets. Review and commit these assets before publishing.',
);
