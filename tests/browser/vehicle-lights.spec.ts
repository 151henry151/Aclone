// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
test('all tractor lenses and nearby beams follow each players own synchronized switch', async ({
  page,
}) => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    await page.route('**/__lights-test', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<script type="module">
  globalThis.__ACLONE_BASE__='/';
  import * as T from '/node_modules/three/build/three.module.js';
  import {GameScene} from '/src/client/scene.ts';
  import {OtherVehicleLights} from '/src/client/vehicle-lights.ts';
  import {createWorld,addPlayer,act} from '/src/shared/simulation.ts';
  import {serializeFields,diffFields,applyFields} from '/src/shared/state-patch.ts';
  const w=createWorld('test','Lights','a'),a=addPlayer(w,'a','Henry'),b=addPlayer(w,'b','Steve');
  const models=new Map(),pool=new OtherVehicleLights();
  let results=[];
  for(const slot of [0,24,25,26,27,28]){
    a.vehicle=b.vehicle=slot;a.lights=false;b.lights=false;
    const own=GameScene.prototype.vehicle.call({},slot),other=GameScene.prototype.vehicle.call({},slot);other.position.set(8,0,0);models.set('a',own);models.set('b',other);
    let before=serializeFields(b);act(w,'b',{type:'lights'});const patch=diffFields(before,serializeFields(b));const copy=applyFields({...b,lights:false},patch);
    pool.update({...w,players:{a,b:copy}},models,'a',new T.Vector3());
    const on=other.userData.switchableLamps.every(m=>m.emissiveIntensity>0),ownOff=own.userData.switchableLamps.every(m=>m.emissiveIntensity===0),beamOn=pool.lights.some(l=>l.userData.player==='b' && l.intensity>0);
    before=serializeFields(b);act(w,'b',{type:'lights'});const offCopy=applyFields(copy,diffFields(before,serializeFields(b)));pool.update({...w,players:{a,b:offCopy}},models,'a',new T.Vector3());
    const off=other.userData.switchableLamps.every(m=>m.emissiveIntensity===0),beamOff=pool.lights.every(l=>l.intensity===0);
    a.lights=true;pool.update(w,models,'b',new T.Vector3());const swapped=pool.lights.some(l=>l.userData.player==='a' && l.intensity>0) && other.userData.switchableLamps.every(m=>m.emissiveIntensity===0);
    results.push({slot,on,ownOff,beamOn,off,beamOff,swapped,lamps:other.userData.switchableLamps.length});
  }
  window.result={results,lightCount:pool.lights.length,shadowFree:pool.lights.every(l=>!l.castShadow)};
  </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__lights-test');
    await page.waitForFunction(() => (window as any).result);
    const r = await page.evaluate(() => (window as any).result);
    console.log(r);
    for (const row of r.results) {
      for (const k of ['on', 'ownOff', 'beamOn', 'off', 'beamOff', 'swapped'])
        expect(row[k], row.slot + ':' + k).toBe(true);
      expect(row.lamps).toBeGreaterThanOrEqual(2);
    }
    expect(r.lightCount).toBe(2);
    expect(r.shadowFree).toBe(true);
  } finally {
    await server.close();
  }
});
