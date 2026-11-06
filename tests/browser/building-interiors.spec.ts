// SPDX-License-Identifier: GPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';
test('all industrial models have finite furnished interiors within their volumes and triangle budgets', async ({
  page,
}) => {
  page.on('pageerror', (e) => console.log('INTERIOR_ERROR', e.message));
  test.setTimeout(180000);
  mkdirSync('output/building-interiors', { recursive: true });
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  try {
    await page.route('**/__interiors', (r) =>
      r.fulfill({
        contentType: 'text/html',
        body: `<script>globalThis.__ACLONE_BASE__='/'</script><script type="module">
 import * as T from '/node_modules/three/build/three.module.js';
 import {createWorld,makeBuilding,addPlayer} from '/src/shared/simulation.ts';
 import {buildingModel} from '/src/client/buildings.ts';
 import {buildingArchitectures} from '/src/shared/building-architecture.ts';
 import {industrialKinds} from '/src/shared/building-facade.ts';
 import {populateInteriorModels,updateInteriorStock,refreshInteriorDisplay} from '/src/client/interior-props.ts';
 import {animateBuildingDoors} from '/src/client/building-interiors.ts';
 const w=createWorld('interiors','Interiors','owner'),p=addPlayer(w,'owner','Pilot');p.vehiclePaints={2:'plum'};w.settings.buildingDoorMode='open';
 window.fixture={T,w,p,buildingModel,makeBuilding,animateBuildingDoors,populateInteriorModels,updateInteriorStock,refreshInteriorDisplay};
 window.measure=()=>{
 const failures=[],stats=[];
 for(const kind of [...industrialKinds,'starport','hangar'])for(const architecture of kind==='hangar'?[undefined]:[undefined,...buildingArchitectures(kind).map(m=>m.id)]){
 const b=makeBuilding('fixture-'+kind,kind==='hangar'?'garage':kind,0,0);b.architecture=architecture;if(kind==='hangar')b.aircraftHangar=true;
 b.stock={hay:450,cows:2,sheep:2,pigs:2,wood:100};b.employees=['owner'];if(kind==='boathouse')b.storedBoats=[{owner:'owner',slot:33,paint:'plum'},{owner:'owner',slot:3,paint:'blue'}];
 const root=buildingModel(b),rigs=root.userData.interiors??[];
 if(!rigs.length)failures.push(kind+'/'+architecture+': missing interior');
 let triangles=0;
 for(const rig of rigs){populateInteriorModels(rig,b,w,p);updateInteriorStock(rig,b);animateBuildingDoors(root,w,b,0,0);root.updateMatrixWorld(true);
 const lift=rig.principal.children.find(o=>o.name==='lift'),tractor=rig.principal.children.find(o=>o.name==='tractor');
 if(lift&&tractor&&Math.abs(lift.position.x-tractor.position.x)>.01)failures.push(kind+'/'+architecture+': tractor is not on its lift');
 if(lift&&tractor){
 const arms=lift.getObjectByName('lift-arms');
 if(!arms)failures.push(kind+'/'+architecture+': missing adjustable lift arms');
 else {const support=new T.Box3().setFromObject(arms,true),vehicle=new T.Box3().setFromObject(tractor,true);if(Math.abs(support.max.y-vehicle.min.y)>.03)failures.push(kind+'/'+architecture+': unsupported raised tractor');}
 }

 const v=rig.volume;rig.group.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;if(!Array.from(o.geometry.attributes.position.array).every(Number.isFinite))failures.push(kind+'/'+architecture+': nonfinite');}});
 for(const group of [rig.principal,rig.detail])for(const prop of group.children){const q=new T.Box3().setFromObject(prop,true);if(q.isEmpty())continue;if(q.min.x<v.x-v.width/2+.14||q.max.x>v.x+v.width/2-.14||q.min.z<v.z-v.depth/2+.14||q.max.z>v.z+v.depth/2-.14||q.max.y>v.eaves-.16||q.min.y<.2)failures.push(kind+'/'+architecture+': outside '+(prop.userData.interiorProp??prop.name)+' '+JSON.stringify({min:q.min,max:q.max,v}));}
 }
 if(kind==='shipyard'||kind==='boathouse'){
 const repair=root.getObjectByName('hull-cradle');
 if(!repair||![3,33].includes(repair.userData.repairHullSlot)||!repair.getObjectByName('repair-staging'))failures.push(kind+'/'+architecture+': missing real repair hull or staging');
}
 if(kind==='boathouse'){const stored=[];root.traverse(o=>{if(o.userData.storedBoat)stored.push(o)});if(stored.length!==2||!stored.some(o=>o.userData.storedBoat.slot===33)||!stored.some(o=>o.userData.storedBoat.slot===3))failures.push(kind+'/'+architecture+': actual stored motorboat missing');}
 if(kind==='hangar'){
 const repair=root.getObjectByName('repair-biplane'),parked=root.getObjectByName('parked-biplane');
 if(repair?.getObjectByName('Biplane propeller')?.visible!==false)failures.push('hangar: remove the propeller with the engine under repair');
 if(!repair?.getObjectByName('repair-trestles'))failures.push('hangar: repair trestles missing');
 for(const craft of [parked,repair]) {
   const actual=new T.Box3().setFromObject(craft,true);
   if(Math.abs(actual.min.y-.28)>.02)failures.push('hangar: actual wheels or trestles float above floor '+actual.min.y);
 }
 const colors=()=>{const c=[];parked.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(m.map)c.push(m.color?.getHexString())});return JSON.stringify(c)};
 const before=colors();p.vehiclePaints[2]='rust';for(const rig of rigs)refreshInteriorDisplay(rig,b,w,p);if(colors()===before)failures.push('hangar: current paint does not refresh');p.vehiclePaints[2]='plum';
 if(!root.getObjectByName('rear-windsock'))failures.push('hangar: outdoor windsock missing');
 const holes=new T.Raycaster(new T.Vector3(0,4,-10),new T.Vector3(0,0,1),0,2.3).intersectObject(root,true);if(holes.length)failures.push('hangar: rear window is blocked');
 }
 const budget=kind==='hangar'||kind==='starport'?15000:6000;
 if(triangles>budget)failures.push(kind+'/'+architecture+': triangles '+triangles+' > '+budget);
 stats.push({kind,architecture:architecture??'legacy',triangles,interiors:rigs.length});
 }
 return {failures,stats};};window.ready=true;
 </script>`,
      }),
    );
    await page.goto(server.resolvedUrls!.local[0] + '__interiors');
    await page.waitForFunction(() => !!(window as any).ready);
    const result = await page.evaluate(() => (window as any).measure());
    writeFileSync(
      'output/building-interiors/geometry-survey.json',
      JSON.stringify(result, null, 2),
    );
    expect(result.failures).toEqual([]);
  } finally {
    await page.close();
    await server.close();
  }
});
