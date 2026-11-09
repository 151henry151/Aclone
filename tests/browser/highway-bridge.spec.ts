// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../../src/server/app';
import { addPlayer } from '../../src/shared/simulation';
import { travelHeight } from '../../src/shared/dock';
import { blueprintSchema } from '../../src/shared/creator';
import { automotiveConfig } from '../../src/shared/automotive-config';
import { completedBridgeSite } from '../fixtures/bridge-site';
import { waitForWorld } from './fixtures/ready';

test.use({ video: { mode: 'on', size: { width: 1440, height: 900 } } });
test('drive the complete loaded highway rig over a real river bridge and refuse a narrow approach gate', async ({
  page,
}) => {
  test.setTimeout(180000);
  const dir = mkdtempSync(join(tmpdir(), 'aclone-highway-bridge-'));
  const app = await createApp({ dataDir: dir, port: 0, dev: true });
  const evidence = 'output/automotive-factory/bridge-browser';
  mkdirSync(evidence, { recursive: true });
  try {
    const { w, bridge } = completedBridgeSite();
    const { account, token } = app.universe.register('Bridge haulier');
    w.owner = account.id;
    w.name = 'Highway bridge crossing';
    w.script = '';
    w.creator!.weather = 'clear';
    w.creator!.models = [
      blueprintSchema.parse({
        id: 'post',
        name: 'Gate post',
        width: 0.4,
        depth: 0.4,
        height: 3,
        parts: [{ shape: 'box', color: '#d9ae49', x: 0, y: 1.5, z: 0, sx: 0.4, sy: 3, sz: 0.4 }],
      }),
    ];
    Object.assign(w.settings, {
      dayLength: 0,
      time: 43200,
      hungerRate: 0,
      thirstRate: 0,
      roadGrowthPerDay: 0,
      cityPaving: false,
      arrivalAnimation: 'off',
    });
    const dx = bridge.b.x - bridge.a.x,
      dz = bridge.b.z - bridge.a.z;
    const length = Math.hypot(dx, dz),
      ux = dx / length,
      uz = dz / length;
    const start = { x: bridge.approachA.x - ux * 24, z: bridge.approachA.z - uz * 24 };
    const end = { x: bridge.approachB.x + ux * 35, z: bridge.approachB.z + uz * 35 };
    w.roads = [{ a: start, b: end, width: bridge.width }];
    w.pavedRoads = [{ ...w.roads[0], town: '', kind: 'trunk' }];
    const p = addPlayer(w, account.id, account.name);
    Object.assign(p, start, {
      y: travelHeight(w, start.x, start.z),
      heading: Math.atan2(dx, dz),
      vehicle: 37,
      fleet: [0, 5, 37],
      engine: true,
      fuel: 320,
      fuelVehicle: 37,
      inventory: {},
      skills: ['driver'],
    });
    const r = automotiveConfig(w);
    const offset = r.semitrailers.box.length / 2 - r.coupling.kingpinInset - r.coupling.fifthWheelZ;
    const t = {
      id: 'bridge-load',
      kind: 'semiBox' as const,
      owner: p.id,
      attached: p.id,
      x: p.x - ux * offset,
      z: p.z - uz * offset,
      heading: p.heading,
      cargo: { steel: 1500 },
    };
    w.trailers = { [t.id]: t };
    app.worlds.set(w.id, w);
    await page.addInitScript(
      ({ token, id }) => {
        localStorage.setItem('aclone.pilot', token);
        localStorage.setItem('aclone.world', id);
        localStorage.setItem('aclone.quality', 'low');
        localStorage.setItem('aclone.sound', 'off');
      },
      { token, id: w.id },
    );
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://127.0.0.1:' + (await app.listen()));
    await waitForWorld(page);
    await page.getByRole('button', { name: 'Hide chat', exact: true }).click();
    // A real, solid 2.4 m gate blocks the 2.55/2.6 m rig before the bridge.
    const gate = { x: bridge.approachA.x - ux * 8, z: bridge.approachA.z - uz * 8 };
    w.creator!.objects = [-1, 1].map((side) => ({
      id: 'gate-' + side,
      name: 'Gate post',
      yaw: 0,
      prompt: '',
      model: 'post',
      x: gate.x + uz * side * 1.4,
      z: gate.z - ux * side * 1.4,
      y: 0,
      radius: 0.2,
      scale: 1,
      solid: true,
      visible: true,
    }));
    await page.keyboard.down('w');
    const along = () => (p.x - gate.x) * ux + (p.z - gate.z) * uz;
    await expect.poll(along, { timeout: 30000 }).toBeGreaterThan(-6);
    await expect.poll(() => Math.abs(p.speed), { timeout: 10000 }).toBeLessThan(0.05);
    expect(along()).toBeLessThan(-2);
    await page.keyboard.up('w');
    await page.screenshot({ path: evidence + '/narrow-gate-refusal.png' });
    w.creator!.objects = [];
    await page.keyboard.down('w');
    await expect
      .poll(() => (p.x - bridge.a.x) * ux + (p.z - bridge.a.z) * uz, { timeout: 30000 })
      .toBeGreaterThan(8);
    await page.keyboard.up('w');
    await page.keyboard.down('b');
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.05);
    await page.keyboard.up('b');
    await page.mouse.move(750, 450);
    await page.mouse.down();
    await page.mouse.move(980, 450, { steps: 20 });
    await page.mouse.up();
    await page.waitForTimeout(750);
    await page.screenshot({ path: evidence + '/loaded-bridge-crossing.png' });
    await page.keyboard.down('w');
    await expect
      .poll(() => (t.x - bridge.approachB.x) * ux + (t.z - bridge.approachB.z) * uz, {
        timeout: 60000,
      })
      .toBeGreaterThan(8);
    await page.keyboard.up('w');
    await page.keyboard.down('b');
    await expect.poll(() => Math.abs(p.speed)).toBeLessThan(0.05);
    await page.keyboard.up('b');
    expect(t.cargo.steel).toBe(1500);
    expect(p.fuel).toBeLessThan(320);
    expect(errors).toEqual([]);
    await page.screenshot({ path: evidence + '/complete-rig-across.png' });
  } finally {
    await page.close();
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
