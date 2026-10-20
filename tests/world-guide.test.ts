// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { buildWorldGuide } from '../scripts/build-world-guide.ts';

test('published guide has complete screenshots, working chapter anchors and repository links', () => {
  const output = mkdtempSync(join(tmpdir(), 'aclone-guide-'));
  try {
    buildWorldGuide(resolve(import.meta.dirname, '..'), output, '0.78.0');
    const html = readFileSync(join(output, 'world-building/index.html'), 'utf8');
    assert.doesNotMatch(html, /__GUIDE_|__VERSION__/);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length);
    for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) {
      assert.ok(ids.includes(anchor), `missing anchor: ${anchor}`);
    }
    const images = [...html.matchAll(/<img src="([^"]+)"/g)];
    assert.equal(images.length, 18);
    for (const [, image] of images) assert.ok(existsSync(join(output, image)));
    assert.match(
      html,
      /href="https:\/\/github.com\/151henry151\/Aclone\/blob\/main\/docs\/SCRIPTING.md"/,
    );
    assert.ok(existsSync(join(output, 'world-building/guide.css')));
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
