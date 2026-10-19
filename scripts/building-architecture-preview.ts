// SPDX-License-Identifier: GPL-3.0-or-later
// Contact sheets of real game geometry and materials; no live world or paid service.
import { chromium } from '@playwright/test';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.ts';
const dir = mkdtempSync(join(tmpdir(), 'aclone-design-gallery-'));
const qc = process.env.GALLERY_QC === '1';
const columns = qc ? 6 : 3,
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
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
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
      body: `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#c3ccc3;font:16px system-ui;color:#21382f}h1{margin:24px 28px 0}p{margin:4px 28px}canvas{position:absolute;left:0;top:100px}#labels{position:absolute;top:100px;display:grid;grid-template-columns:repeat(${columns},${tileW}px);pointer-events:none}.label{height:${tileH}px;box-sizing:border-box;padding:${tileH - 48}px 24px 0;background:linear-gradient(transparent 85%,#c3ccc3 95%)}b,small{display:block}small{font-size:13px}</style></head><body><h1 id="title"></h1><p>${qc ? 'Rows 1–5: models; columns: six finishes · last row: rear views and largest size · common scale' : 'Five models in one finish, at a common scale · sixth tile shows another size or finish'}</p><div id="labels"></div><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import * as T from '/node_modules/three/build/three.module.js';
 import {buildingModel} from '/src/client/buildings.ts';import {makeBuilding} from '/src/shared/simulation.ts';
 import {buildingArchitectures} from '/src/shared/building-architecture.ts';
 import {buildingStyles,buildingDesignQuote,sizesForBuilding} from '/src/shared/building-designs.ts';import {buildings} from '/src/shared/catalog.ts';import {waitForTextures} from '/src/client/materials.ts';
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(1);renderer.setSize(${columns * tileW},${rows * tileH});renderer.toneMapping=T.ACESFilmicToneMapping;document.body.prepend(renderer.domElement);renderer.setScissorTest(true);
 let groups=[];
 window.gallery=async(kind,sizes=false)=>{
  for(const group of groups)group.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});groups=[];
  const styles=buildingStyles(kind,'model-1'),models=buildingArchitectures(kind);
  const options=${qc} ? models.flatMap(model=>styles.map(style=>({model,style,size:'standard'}))) : models.map(model=>({model,style:styles[0],size:'standard'}));
  if(${qc})options.push(...models.map(model=>({model,style:styles[4],size:'standard',rear:true})));
  options.push({model:models[1],style:styles[sizesForBuilding(kind).length>1?0:5],size:sizesForBuilding(kind).at(-1).id});
  document.querySelector('#title').textContent=buildings[kind].name+' · architectural models'+(kind==='starport'?' · terminal close-ups':'');
  document.querySelector('#labels').innerHTML=options.map(({model,style,size,rear})=>{const q=buildingDesignQuote(kind,buildings[kind],style.id,size,model.id);return '<div class="label"><b>'+model.name+' · '+(rear?'rear':size)+'</b><small>'+style.name+' · '+q.capacity+' storage / good'+'</small></div>';}).join('');
  for(const {model,style,size} of options){const b=makeBuilding('construction',kind,0,0);b.architecture=model.id;b.style=style.id;b.size=size;b.stock.hay=450;const group=buildingModel(b);if(kind==='starport') for(const child of [...group.children])if(child.userData.flight)group.remove(child);groups.push(group);}
  await waitForTextures();
  const radii=groups.map(g=>new T.Box3().setFromObject(g).getSize(new T.Vector3()).length()/2);
  for(let i=0;i<options.length;i++){
   const scene=new T.Scene();scene.background=new T.Color('#c3ccc3');scene.add(new T.HemisphereLight('#edf4ff','#686c4b',2));const sun=new T.DirectionalLight('#fff1d7',2.5);sun.position.set(-8,15,12);scene.add(sun);scene.add(groups[i]);
   const bounds=new T.Box3().setFromObject(groups[i]),center=bounds.getCenter(new T.Vector3()),radius=Math.max(...radii);
   const camera=new T.PerspectiveCamera(38,${tileW}/${tileH},.1,5000);camera.position.copy(center).add(new T.Vector3(options[i].rear?-.68:.68,.42,options[i].rear?-1:1).normalize().multiplyScalar(radius/Math.sin(19*Math.PI/180)*1.12));camera.lookAt(center);
   renderer.setViewport(i%${columns}*${tileW},(${rows}-1-Math.floor(i/${columns}))*${tileH},${tileW},${tileH});renderer.setScissor(i%${columns}*${tileW},(${rows}-1-Math.floor(i/${columns}))*${tileH},${tileW},${tileH});renderer.render(scene,camera);
  }
 };window.ready=true;
 </script></body></html>`,
    }),
  );
  await page.goto(`http://127.0.0.1:${port}/__design_gallery`);
  await page.waitForFunction(() => !!(window as any).ready);
  const kinds = process.argv.slice(2);
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
