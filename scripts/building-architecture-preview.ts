// SPDX-License-Identifier: GPL-3.0-or-later
// Contact sheets of real game geometry and materials; no live world or paid service.
import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-design-gallery-'));
const qc = process.env.GALLERY_QC === '1';
const openMode = process.argv.includes('--open');
const low = process.env.GALLERY_QUALITY === 'low';
const insideAudit = process.env.GALLERY_INTERIORS === '1';
const compare = process.env.GALLERY_COMPARE === '1';
const columns = compare ? 5 : qc ? 6 : 3,
  rows = qc ? 6 : 2,
  tileW = qc ? 450 : 500,
  tileH = qc ? 380 : 450;
const output = process.env.SCREENSHOT_OUTPUT_DIR ?? 'output/building-architecture';
mkdirSync(output, { recursive: true });
const app = await createApp({ dataDir: dir, port: 0, dev: true }),
  port = await app.listen();
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH,
  args: [
    '--no-sandbox',
    ...(process.env.PREVIEW_GPU
      ? ['--enable-gpu', '--use-angle=gl', '--ignore-gpu-blocklist']
      : ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
  ],
});
try {
  const page = await browser.newPage({
      viewport: { width: columns * tileW, height: rows * tileH + 140 },
    }),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/__design_gallery', (r) =>
    r.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#c3ccc3;font:16px system-ui;color:#21382f}h1{margin:24px 28px 0}p{margin:4px 28px}canvas{position:absolute;left:0;top:100px}#labels{position:absolute;top:100px;display:grid;grid-template-columns:repeat(${columns},${tileW}px);pointer-events:none}.label{height:${tileH}px;box-sizing:border-box;padding:${tileH - 48}px 24px 0;background:linear-gradient(transparent 85%,#c3ccc3 95%)}b,small{display:block}small{font-size:13px}</style></head><body><h1 id="title"></h1><p>${compare ? 'Full interiors above · reduced interiors below' : qc ? 'Rows 1–5: models; columns: six finishes · last row: rear views and largest size · common scale' : openMode ? 'Five models with open bays · sixth tile looks inside at human height' : 'Five models in one finish, at a common scale · sixth tile shows another size or finish'}</p><div id="labels"></div><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import * as T from '/node_modules/three/build/three.module.js';
 import {buildingModel} from '/src/client/buildings.ts';import {makeBuilding,createWorld,addPlayer} from '/src/shared/simulation.ts';
 import {buildingArchitectures} from '/src/shared/building-architecture.ts';
 import {buildingStyles,buildingDesignQuote,sizesForBuilding} from '/src/shared/building-designs.ts';import {buildings} from '/src/shared/catalog.ts';import {waitForTextures} from '/src/client/materials.ts';
 import {batchInteriorProps} from '/src/client/interior-batching.ts';
 import {populateInteriorModels} from '/src/client/interior-props.ts';import {animateBuildingDoors} from '/src/client/building-interiors.ts';
 const w=createWorld('gallery','Gallery','owner'),p=addPlayer(w,'owner','Pilot');w.settings.buildingDoorMode='open';
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(1);renderer.setSize(${columns * tileW},${rows * tileH});renderer.toneMapping=T.ACESFilmicToneMapping;document.body.prepend(renderer.domElement);renderer.setScissorTest(true);
 const sheetDescription=document.querySelector('body>p').textContent;
 let groups=[];
 window.gallery=async(kind,sizes=false)=>{
  for(const group of groups)group.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});groups=[];
  const styles=buildingStyles(kind,'model-1'),models=buildingArchitectures(kind);
  const fixed=models.length===0;
  const options=${compare} ? [false,true].flatMap(lowDetail=>models.map(model=>({model,style:styles[0],size:'standard',inside:true,lowDetail}))) : ${qc} ? models.flatMap(model=>styles.map(style=>({model,style,size:'standard'}))) : models.map(model=>({model,style:styles[0],size:'standard'}));
  if(${qc})options.push(...models.map(model=>({model,style:styles[4],size:'standard',rear:true})));
  if(fixed)options.push({model:{id:undefined,name:'Fixed design'},style:{id:undefined,name:'As modelled'},size:'standard'});
  else if(!${compare}) options.push(${openMode} ? {model:models[0],style:styles[0],size:'standard',inside:true} : {model:models[1]??models[0],style:styles[sizesForBuilding(kind).length>1?0:5],size:sizesForBuilding(kind).at(-1).id});
  if(${insideAudit})for(const option of options)option.inside=true;
  const cols=fixed?1:${columns},countRows=fixed?1:${rows},width=fixed?${columns * tileW}:${tileW},height=fixed?${rows * tileH}:${tileH};
  document.querySelector('#labels').style.gridTemplateColumns='repeat('+cols+','+width+'px)';
  document.querySelector('body>p').textContent=fixed?'Fixed infrastructure design · actual game geometry and materials':sheetDescription;
  document.querySelector('#title').textContent=buildings[kind].name+(fixed?' · fixed design':' · architectural models')+(kind==='starport'?' · terminal close-ups':'');
  document.querySelector('#labels').innerHTML=options.map(({model,style,size,rear,inside,lowDetail})=>{const q=buildingDesignQuote(kind,buildings[kind],style.id,size,model.id);return '<div class="label" style="height:'+height+'px;padding-top:'+(height-48)+'px"><b>'+model.name+' · '+(${compare}?(lowDetail?'reduced interior':'full interior'):inside?'inside':rear?'rear':size)+'</b><small>'+style.name+' · '+q.capacity+' storage / good'+'</small></div>';}).join('');
  for(const {model,style,size,lowDetail} of options){const b=makeBuilding('construction',kind,0,0);b.architecture=model.id;b.style=style.id;b.size=size;b.stock={hay:b.capacity,cows:2,sheep:2,pigs:2,wood:100};if(kind==='boathouse'){p.fleet=[0,3,33];p.fleetState={3:{storedAt:b.id},33:{storedAt:b.id}};}const group=buildingModel(b);if(${openMode}){for(const rig of group.userData.interiors??[]){populateInteriorModels(rig,b,w,p);batchInteriorProps(rig);}animateBuildingDoors(group,w,b,0,0,${low}||!!lowDetail);}if(kind==='starport') for(const child of [...group.children])if(child.userData.flight)group.remove(child);groups.push(group);}
  await waitForTextures();
  const radii=groups.map(g=>new T.Box3().setFromObject(g).getSize(new T.Vector3()).length()/2);
  for(let i=0;i<options.length;i++){
   const scene=new T.Scene();scene.background=new T.Color('#c3ccc3');scene.add(new T.HemisphereLight('#edf4ff','#686c4b',2));const sun=new T.DirectionalLight('#fff1d7',2.5);sun.position.set(-8,15,12);scene.add(sun);scene.add(groups[i]);
   const bounds=new T.Box3().setFromObject(groups[i]),center=bounds.getCenter(new T.Vector3()),radius=Math.max(...radii);
   const camera=new T.PerspectiveCamera(38,width/height,.1,5000);camera.position.copy(center).add(new T.Vector3(options[i].rear?-.68:.68,.42,options[i].rear?-1:1).normalize().multiplyScalar(radius/Math.sin(19*Math.PI/180)*1.12));camera.lookAt(center);
   if(options[i].inside && groups[i].userData.interiors?.length){
    const rig=(${process.env.GALLERY_ROOM === 'water'} && groups[i].userData.interiors.find(r=>r.group.userData.waterSideStorage)) || groups[i].userData.interiors[0],bay=rig.doors[0].bay,side=bay.rear?-1:1;
    camera.fov=70;camera.updateProjectionMatrix();camera.position.set(bay.x+.3,1.7,bay.z+side*2.8);camera.lookAt(bay.x,1.2,bay.z-side*3);
   }
   renderer.setViewport(i%cols*width,(countRows-1-Math.floor(i/cols))*height,width,height);renderer.setScissor(i%cols*width,(countRows-1-Math.floor(i/cols))*height,width,height);renderer.render(scene,camera);
  }
 };window.ready=true;
 </script></body></html>`,
    }),
  );
  await page.goto(`http://127.0.0.1:${port}/__design_gallery`);
  await page.waitForFunction(() => !!(window as any).ready);
  const kinds = process.argv.slice(2).filter((arg) => arg !== '--open');
  for (const kind of kinds.length
    ? kinds
    : Object.keys((await import('../src/shared/catalog.ts')).buildings)) {
    await page.evaluate((k) => (window as any).gallery(k), kind);
    await page.screenshot({ path: join(output, kind + '.png') });
    console.log(kind);
  }
  if (errors.length) throw Error(errors.join('\n'));
} finally {
  await browser.close();
  await app.close();
  rmSync(dir, { recursive: true, force: true });
}
