// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';

test('flight terrain uses slant range, returns fine ground before landing and retains ground hysteresis', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    await page.route('**/__flight-terrain', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<script type="module">
        globalThis.__ACLONE_BASE__='/';
        import {createWorld} from '/src/shared/simulation.ts';
        import {GroundTiles} from '/src/client/ground.ts';
        const w=createWorld('island','Island','server');w.settings.mapSize=5000;
        const ground=new GroundTiles();ground.reset(w);
        window.fixture={w,ground};
        </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__flight-terrain');
    await page.waitForFunction(() => !!(window as any).fixture);
    const result = await page.evaluate(async () => {
      const { ground } = (window as any).fixture;
      const settle = async (height: number, x = 64, z = 64) => {
        for (let i = 0; i < 3000; i++) {
          if (!ground.update(x, z, 4, { height, vx: 0, vz: 0, vy: 0 })) return;
          if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
        }
        throw Error('terrain did not settle');
      };
      await settle(800);
      const highDetailed = ground.meshes.filter((m: any) => m.userData.detailed).length;
      let height = 800;
      // Thirty frames/second, 8 m/s descent, preserving the real work-time cap.
      while (height > 20) {
        height -= 8 / 30;
        ground.update(64, 64, 4, { height, vx: 0, vz: 0, vy: -8 });
      }
      const beneath = ground.meshes.find((m: any) => m.userData.cx === 64 && m.userData.cz === 64);
      const descentDetailed = beneath?.userData.detailed;
      await settle(0);
      const groundDisc = ground.meshes.every((m: any) => {
        const d = Math.hypot(m.userData.cx - 64, m.userData.cz - 64);
        return d > 560 || m.userData.detailed;
      });
      // The original centre remains detailed at 600 m, but is coarse past 680 m.
      await settle(0, 664);
      const retained =
        beneath &&
        ground.meshes.find((m: any) => m.userData.cx === 64 && m.userData.cz === 64)?.userData
          .detailed;
      await settle(0, 764);
      const released = ground.meshes.find((m: any) => m.userData.cx === 64 && m.userData.cz === 64)
        ?.userData.detailed;
      ground.reset((window as any).fixture.w);
      await settle(120);
      let x = 64,
        longestGap = 0,
        gap = 0;
      for (const direction of [1, -1]) {
        for (let frame = 0; frame < 45 * 30; frame++) {
          x += (direction * 66 * 0.44704) / 30;
          ground.update(x, 64, 4, { height: 120, vx: direction * 66 * 0.44704, vz: 0, vy: 0 });
          const tiles = new Map(
            ground.meshes.map((m: any) => [
              `${m.userData.cx}:${m.userData.cz}`,
              m.userData.detailed,
            ]),
          );
          let missing = false;
          for (let i = Math.floor((x - 390) / 128); i <= Math.floor((x + 390) / 128); i++)
            for (let j = -3; j <= 3; j++) {
              const cx = (i + 0.5) * 128,
                cz = (j + 0.5) * 128;
              if (Math.hypot(cx - x, cz - 64) <= 390 && !tiles.get(`${cx}:${cz}`)) missing = true;
            }
          gap = missing ? gap + 1 / 30 : 0;
          longestGap = Math.max(longestGap, gap);
          if (frame % 30 === 0) await new Promise((r) => setTimeout(r, 0));
        }
      }
      ground.clear();
      return { highDetailed, descentDetailed, groundDisc, retained, released, longestGap };
    });
    expect(result.highDetailed, 'above the retain radius every loaded tile is coarse').toBe(0);
    expect(result.descentDetailed, 'fine terrain must return before touchdown').toBe(true);
    expect(result.groundDisc).toBe(true);
    expect(result.retained).toBe(true);
    expect(result.released).toBe(false);
    expect(
      result.longestGap,
      '66 mph forward and reversed paths keep detailed ground within 300 m',
    ).toBeLessThanOrEqual(2);
  } finally {
    await page.close();
    await server.close();
  }
});
