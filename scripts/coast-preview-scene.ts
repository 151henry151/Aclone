// SPDX-License-Identifier: GPL-3.0-or-later
export const coastPreviewHTML = `<style>body{margin:0;background:#172a32}#view{width:100vw;height:100vh}</style><div id="view"></div><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import * as T from '/node_modules/three/build/three.module.js';
 import {defaultCreator} from '/src/shared/creator.ts';
 import {GameScene} from '/src/client/scene.ts';
 import {createWorld,addPlayer} from '/src/shared/simulation.ts';
 import {ensurePuddlewickLighthouses} from '/src/server/puddlewick-lighthouses.ts';
 import {bluffPoint} from '/src/shared/coastal-bluffs.ts';
 import {waterLevel} from '/src/shared/ocean.ts';
 const w=createWorld('puddlewick','Puddlewick','server');ensurePuddlewickLighthouses(w);
 w.settings.time=43000;w.creator={...defaultCreator(),scenery:false,weather:'clear'};
 const b=w.buildings.find(b=>b.id==='parish-harbour-light'),cliff=w.coastalBluffs.find(c=>c.id==='cliff-'+b.id);
 const p=addPlayer(w,'preview','Skipper');Object.assign(p,bluffPoint(cliff,0,70),{vehicle:30,online:true,engine:false});
 const game=new GameScene(document.getElementById('view'));game.onLoading=(m)=>console.log('loading',m);game.setWorld(w,p.id);
 window.ready=()=>game.ready;window.game=game;window.world=w;window.cliff=cliff;
 window.shot=(mode,time=0)=>{
 game.renderer.setAnimationLoop(null);w.settings.time=mode==='night'?80000:43000;w.creator.weather=mode==='storm'?'storm':'clear';w.time=time;
 game.renderTime=0;game.frame(true);
 const pos=['distant','off'].includes(mode)?{x:0,z:b.z+4000}:bluffPoint(cliff,mode==='beach'?190:120,190);
 game.camera.fov=mode==='distant'?35:50;game.camera.updateProjectionMatrix();
 game.camera.position.set(pos.x,['distant','off'].includes(mode)?3:b.foundationY+25,pos.z);game.camera.lookAt(b.x,b.foundationY+9,b.z);
 game.sky.position.copy(game.camera.position);
 game.ocean.update(w,game.camera.position.x,game.camera.position.z,time,0,mode==='night'?.04:1);
 game.ocean.surf.update(w,p.x,p.z,waterLevel(w,time),time,mode==='storm'?2:mode==='calm'?.006:.65,mode==='night'?.04:1);
 const angle=Math.atan2(-(game.camera.position.z-b.z),game.camera.position.x-b.x);
 const align=(angle-b.x*.01-b.rotation)*8/Math.PI;
 game.lighthouseLights.update(w,game.camera,align+(mode==='off'?3:0),mode==='night'?0:1,mode==='storm'?1:0);
 game.renderer.render(game.scene,game.camera);
 return {bluffs:w.coastalBluffs.length,patches:game.ocean.surf.group.children.length,calls:game.renderer.info.render.calls,triangles:game.renderer.info.render.triangles, lightCount:game.lighthouseLights.group.children.filter(o=>o.isLight).length,signals:[...game.lighthouseLights.signals.entries()].map(([id,s])=>[id,s.sprite.material.opacity,s.clear])};
 };window.b=b;
</script>`;
