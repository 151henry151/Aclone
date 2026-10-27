// SPDX-License-Identifier: GPL-3.0-or-later
/** Disposable local fixture using the full production GameScene, terrain, boat and weather. */
export const oceanPreviewHTML = `<!doctype html><meta charset="utf-8"><style>body{margin:0}#view{width:100vw;height:100vh}header{position:absolute;top:20px;left:25px;color:#fff7da;font:22px Georgia;text-shadow:0 1px 5px black}</style><div id="view"></div><header id="caption">Aclone · calm ocean · actual game renderer</header><script type="module">
 globalThis.__ACLONE_BASE__='/';
 import {GameScene} from '/src/client/scene.ts';
 import {createWorld,addPlayer} from '/src/shared/simulation.ts';
 import {defaultCreator} from '/src/shared/creator.ts';
 import {waterLevel,boatSeaPose} from '/src/shared/ocean.ts';
 const w=createWorld('puddlewick','Puddlewick','server');w.settings.mapSize=18500;w.terrainMapSize=12500;w.settings.tidalRange=.6;w.settings.oceanWaves=1;w.settings.time=43200;w.buildings=[];w.roads=[];
 w.creator={...defaultCreator(),scenery:false,weather:'clear'};
 const p=addPlayer(w,'ocean','Skipper');Object.assign(p,{vehicle:30,x:0,z:6500,y:waterLevel(w),online:true,engine:true,fuel:2500,speed:6,boatThrottle:1});
 p.trawl={seconds:200,fuelUsed:10,deployed:true,catch:{},activity:3};
 const game=new GameScene(document.getElementById('view'));game.setWorld(w,p.id);game.cameraMode=0;game.zoom=2.2;game.orbit=2.1;
 window.ready=()=>game.ready;
 window.showOcean=(mode,phase=0)=>{
 game.renderer.setAnimationLoop(null);w.creator.weather=mode==='storm'||mode==='shore'||mode==='cockpit'?'thunderstorm':'clear';w.time=phase;
 game.motionClock.sample=()=>w.time;game.prediction.sample=()=>({x:p.x,y:waterLevel(w),z:p.z,heading:0,speed:6});
 game.cameraMode=mode==='cockpit'?1:0;game.zoom=mode==='shore'?3:2.2;game.orbit=mode==='cockpit'?0:mode==='shore'?1.1:2.1;
 if(mode==='shore'){p.x=20;p.z=190;}else{p.x=0;p.z=6500;}
 game.renderTime=0;game.lastTime=performance.now()-33;game.meshes.get(p.id).userData.snapCamera=true;game.frame(true);
 const boat=game.meshes.get(p.id),ocean=game.ocean;
 document.getElementById('caption').textContent='Aclone · '+mode+' ocean · actual game renderer (local)';
 return {amplitude:ocean.amplitude.value,level:ocean.level.value,height:boat.position.y,pitch:boat.rotation.x,roll:boat.rotation.z,camera:game.camera.position.y,surface:ocean.height(game.camera.position.x,game.camera.position.z),triangles:game.renderer.info.render.triangles,calls:game.renderer.info.render.calls};
 };
 window.prepareOcean=()=>{const boat=game.meshes.get(p.id).userData.fishingBoat;for(let i=0;i<220;i++)boat.animate(true,3,i/30,Infinity,0,6,0,1/30);};
 window.game=game;
 </script>`;
