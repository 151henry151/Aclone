// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('a mature road network keeps every segment and width in bounded SVG batches', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    await page.route('**/__road-map', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `
      <link rel="stylesheet" href="/src/client/style.css"><div id="map" style="width:1100px"></div><script type="module">
      import {ParishMap} from '/src/client/parish-map.ts';
      import {createWorld,addPlayer} from '/src/shared/simulation.ts';
      import {townRoads} from '/src/shared/town.ts';
      import {inBounds} from '/src/client/map-layout.ts';
      const w=createWorld('mature-map','Mature map','owner');
      w.roads=Array.from({length:1479},(_,i)=>({a:{x:i%40*4-80,z:Math.floor(i/40)*4-80},b:{x:i%40*4-76,z:Math.floor(i/40)*4-77},width:5+i%3*2}));
      const p=addPlayer(w,'owner','Pilot'),map=new ParishMap(document.getElementById('map'),w,p);
      window.fixture={w,p,map,townRoads,inBounds};</script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__road-map');
    await page.waitForFunction(() => !!(window as any).fixture);
    const result = await page.evaluate(() => {
      const { w, map, townRoads, inBounds } = (window as any).fixture;
      const roads = townRoads(w).filter(
        (r: any) => inBounds(map.bounds, r.a, 30) || inBounds(map.bounds, r.b, 30),
      );
      const paths = [...map.sheet.querySelectorAll('path[stroke="#c5b88e"]')] as SVGPathElement[];
      const data = paths.map((p) => p.getAttribute('d')!).join('');
      return {
        paths: paths.length,
        widths: new Set(roads.map((r: any) => Math.max(2, r.width * map.scale))).size,
        segments: (data.match(/M/g) || []).length,
        expected: roads.length,
        allIncluded: roads.every((r: any) =>
          data.includes(
            'M' + map.x(r.a.x) + ' ' + map.y(r.a.z) + 'L' + map.x(r.b.x) + ' ' + map.y(r.b.z),
          ),
        ),
      };
    });
    expect(result.allIncluded).toBe(true);
    expect(result.segments).toBe(result.expected);
    expect(result.paths).toBe(result.widths);
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect(page.locator('.map-load-status')).toBeHidden();
    await page.screenshot({ path: 'test-results/mature-map-road-batches.png' });
    await page.evaluate(() => (window as any).fixture.map.dispose());
  } finally {
    await page.close();
    await server.close();
  }
});
