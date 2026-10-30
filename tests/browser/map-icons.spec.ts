// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';

test('the map icon catalogue renders every symbol at actual map size', async ({ page }) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-map-icons-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen();
    await page.setViewportSize({ width: 1200, height: 1100 });
    await page.route('**/__map-icons', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8"><title>Aclone map symbols</title><style>
body{background:#172b22;color:#efe4c3;font:14px sans-serif;margin:32px}h1{margin:0 0 10px}p{margin:0 0 24px;color:#bbc5a3}main{display:grid;grid-template-columns:repeat(6,1fr);gap:10px}article{background:#2a4031;border:1px solid #657455;border-radius:5px;padding:12px;min-height:68px;display:flex;align-items:center;gap:10px}svg{flex-shrink:0}small{display:block;color:#b6c4aa;margin-top:5px}
</style><h1>Aclone · map symbols</h1><p>Each card shows the actual 18 px map symbol alongside a larger detail view.</p><main></main><script type="module">
import {buildings} from '/src/shared/catalog.ts';import {mapIcon} from '/src/client/map-icons.ts';
const kinds=[...Object.keys(buildings),'aircraftHangar','Wood / logs','stone','gravel','Dirt','Playing field','Race checkpoints'];
for(const kind of kinds){const card=document.createElement('article');card.dataset.kind=kind;const path=mapIcon(kind,{aircraftHangar:kind==='aircraftHangar'});for(const size of [18,36]){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width',size);svg.setAttribute('height',size);const p=document.createElementNS(svg.namespaceURI,'path');for(const [k,v]of Object.entries({d:path,fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linejoin':'round','stroke-linecap':'round'}))p.setAttribute(k,v);svg.append(p);card.append(svg)}const label=document.createElement('span');label.textContent=kind==='aircraftHangar'?'Aircraft hangar':buildings[kind]?.name??kind;card.append(label);document.querySelector('main').append(card)}
</script>`,
      }),
    );
    await page.goto(`http://127.0.0.1:${port}/__map-icons`);
    await expect(page.locator('article')).toHaveCount(57);
    const valid = await page.locator('path').evaluateAll((paths) =>
      paths.every((p) => {
        const path = p as SVGPathElement,
          b = path.getBBox();
        return (
          path.getTotalLength() > 0 &&
          b.x >= -1 &&
          b.y >= -1 &&
          b.x + b.width <= 25 &&
          b.y + b.height <= 25
        );
      }),
    );
    expect(valid).toBe(true);
    await page.screenshot({ path: 'test-results/map-icon-catalogue.png', fullPage: true });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
