// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';

test('saved island resources reach the client map at island and cluster scale', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'aclone-resource-map-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  try {
    const port = await app.listen(),
      w = app.worlds.get('puddlewick')!;
    expect(w.additionalResources).toHaveLength(221);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.route('**/__resource-world', (r) =>
      r.fulfill({ contentType: 'application/json', body: JSON.stringify(w) }),
    );
    await page.route('**/__resource-map', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/src/client/style.css"><style>body{padding:30px}#map{width:1100px;margin:auto}</style><h1>Puddlewick · gathering grounds</h1><div id="map"></div><script type="module">
import {ParishMap} from '/src/client/parish-map.ts';import {addPlayer} from '/src/shared/simulation.ts';
const w=await(await fetch('/__resource-world')).json(),p=addPlayer(w,'surveyor','Surveyor');const map=new ParishMap(document.getElementById('map'),w,p);window.resourceMap={w,p,map};
</script>`,
      }),
    );
    await page.goto(`http://127.0.0.1:${port}/__resource-map`);
    await expect(page.locator('.map-icon')).not.toHaveCount(0);
    for (let i = 0; i < 6; i++)
      await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();
    expect(
      await page.locator('.parish-map-sheet > svg circle[fill="#a9cf86"]').count(),
    ).toBeGreaterThanOrEqual(221);
    await page.screenshot({ path: 'test-results/resource-island.png' });
    await page.getByRole('button', { name: 'Fit parish', exact: true }).click();
    await page.evaluate(() => {
      const { w, p, map } = (window as any).resourceMap,
        ns = w.additionalResources.filter((n: any) => n.id.startsWith('extra-cluster-0-'));
      p.x = ns.reduce((s: number, n: any) => s + n.x, 0) / ns.length;
      p.z = ns.reduce((s: number, n: any) => s + n.z, 0) / ns.length;
      map.update(w, p);
    });
    await page.getByRole('button', { name: 'Find me', exact: true }).click();
    const nodes = page.locator('.map-icon[data-site^="extra-cluster-0-"]');
    await expect(nodes).toHaveCount(16);
    await page.screenshot({ path: 'test-results/resource-cluster.png' });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
