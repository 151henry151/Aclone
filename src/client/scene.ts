import { DrunkVision } from './drunk-vision';
import { impairment } from '../shared/intoxication';
import type { RocketFlight } from './rocket-flight';
import { LivestockScene } from './livestock-scene';
import { sceneTextures, uploadTextures, yieldFrame, finishGpuWork } from './renderer-warmup';
import { waitForTextures, failedTextures } from './materials';
import { addLandscape } from './landscape-scene';
// SPDX-License-Identifier: GPL-3.0-or-later
import { creatorModel } from './creator-model';
import { GameAudio } from './audio';
import { streetLights } from '../shared/town';
import { TownLighting } from './lighting';
import { FarmFields } from './fields';
import { combatBases } from '../shared/combat';
import { calendar, worldWeather, sunAt, lightningAt, DAY_SECONDS } from '../shared/environment';
import { Precipitation } from './weather';
import { snowCover, autumnTint, seasonalMaterial } from './materials';
import * as T from 'three';
import { freezeScenery } from './static-scene';
import { countryside } from './scenery';
import { groundMaterial, surface } from './materials';
import { countrySky } from './sky';
import { celestialAt } from '../shared/astronomy';
import { twilightAt, nightIllumination } from './sky-weather';
import { tractor, TRACTOR_EYE_HEIGHT, TRACTOR_SEAT_Z } from './tractor';
import { SmokePlumes } from './smoke';
import { tractorPaint } from '../shared/appearance';
import { buildingModel } from './buildings';
import { buildingPlan } from '../shared/building-shapes';
import { fishingDock, dockHeight, travelHeight, nearFishingDock } from '../shared/dock';
import { MotionClock, MotionTrack } from './motion';
import { createHuman, type HumanFigure } from './human';
import { createRobocrow, type RobocrowFigure } from './robocrow';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight, distance } from '../shared/simulation';
import { vehicles, checkpoints, defaults } from '../shared/catalog';
import type { World, Player, Building } from '../shared/types';
const material = (color: T.ColorRepresentation) =>
  new T.MeshStandardMaterial({ color, roughness: 0.85, flatShading: false });
function box(
  g: T.Group,
  w: number,
  h: number,
  d: number,
  color: T.ColorRepresentation,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
function cylinder(
  g: T.Group,
  r: number,
  h: number,
  color: T.ColorRepresentation,
  x: number,
  y: number,
  z: number,
  n = 8,
) {
  const m = new T.Mesh(new T.CylinderGeometry(r, r, h, n), material(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  g.add(m);
  return m;
}
function label(text: string, color = '#eee4c8', scale = 1) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(27,37,30,.85)';
  ctx.fillRect(0, 8, 512, 70);
  ctx.strokeStyle = '#8c9671';
  ctx.strokeRect(1, 9, 510, 68);
  ctx.font = '600 24px monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text.slice(0, 30), 256, 53);
  const texture = new T.CanvasTexture(c);
  const s = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: false }));
  s.scale.set(15 * scale, 2.8 * scale, 1);
  return s;
}
function pilotLabel(name: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(20,34,37,.9)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 376, 104, 22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(180, 108);
  ctx.lineTo(192, 124);
  ctx.lineTo(204, 108);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a9dbcb';
  ctx.font = '600 19px sans-serif';
  ctx.fillText('● PILOT', 192, 36);
  ctx.fillStyle = '#fff4d8';
  ctx.font = '600 28px sans-serif';
  ctx.fillText(name.slice(0, 30), 192, 78, 348);
  const tag = new T.Sprite(
    new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), depthWrite: false }),
  );
  tag.scale.set(6, 2, 1);
  return tag;
}
export class GameScene {
  readonly audio = new GameAudio();
  readonly drunkVision = new DrunkVision();
  private audioFacing = new T.Vector3();
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(53, 1, 0.1, 950);
  private land = new T.Group();
  private actors = new T.Group();
  private space = new T.Group();
  private terrain?: T.Mesh;
  private sun = new T.DirectionalLight(0xffe9bb, 3);
  private headlights = new T.SpotLight('#fff1b5', 150, 110, Math.PI / 3.5, 0.65, 1);
  private lightning = new T.Line(
    new T.BufferGeometry().setFromPoints([
      new T.Vector3(0, 90, 0),
      new T.Vector3(-5, 72, 1),
      new T.Vector3(2, 60, 0),
      new T.Vector3(-8, 38, 2),
      new T.Vector3(-3, 27, 0),
      new T.Vector3(-14, 0, 2),
    ]),
    new T.LineBasicMaterial({ color: '#d9e5ff', toneMapped: false }),
  );
  private townLighting: TownLighting;
  private ambient = new T.HemisphereLight(0xb6cbd9, 0x7c8067, 1.1);
  private meshes = new Map<string, T.Group>();
  private motionClock = new MotionClock();
  private buildingMeshes: T.Group[] = [];
  private ball: T.Mesh;
  private projectiles = new T.InstancedMesh(
    new T.SphereGeometry(1, 8, 6),
    new T.MeshBasicMaterial({ color: '#ffffff' }),
    512,
  );
  private lastWorld = '';
  private revision = '';
  private target = new T.Vector3();
  private elapsed = 0;
  private chase = 0;
  private plumes = new SmokePlumes();
  private chimneyTime = 0;
  private smokesAt = 0;
  private stars: T.Points;
  private planets: T.Mesh[] = [];
  private lastTime = performance.now();
  private fpsSince = performance.now();
  private fpsFrames = 0;
  renderFps = 0;
  get motionBufferMs() {
    return this.motionClock.bufferMs;
  }
  private renderTime = 0;
  private slowFrames = 0;
  private adapted = false;
  get qualityLabel() {
    return this.low
      ? this.adapted
        ? 'performance (automatic)'
        : 'performance'
      : localStorage.getItem('aclone.quality') === 'high'
        ? 'detailed'
        : 'adaptive';
  }
  private shadowTime = 0;
  private shadowPosition = new T.Vector3(Infinity, Infinity, Infinity);
  private world?: World;
  private me?: Player;
  paused = false;
  ready = true;
  onLoading?: (message?: string, warning?: string) => void;
  private warmGeneration = 0;
  private sky = countrySky();
  private precipitation = new Precipitation();
  private fields = new FarmFields();
  private livestock = new LivestockScene();
  private flights: RocketFlight[] = [];
  private flightSnapshotAt = 0;
  private combatMarkers = new T.Group();
  private water?: T.Mesh;
  private waterBase?: Float32Array;
  private low = localStorage.getItem('aclone.quality') === 'low';
  private software = false;
  private labelsHidden = false;
  zoom = 1;
  cameraMode = 0;
  orbit = 0;
  private lookPitch = 0;
  onBuilding?: (id: string) => void;
  constructor(private container: HTMLElement) {
    this.renderer = new T.WebGLRenderer({
      // MSAA cannot be disabled on an existing context; keep it opt-in for fallback.
      antialias: localStorage.getItem('aclone.quality') === 'high',
      alpha: false,
      powerPreference: 'high-performance',
    });
    const gl = this.renderer.getContext(),
      debug = gl.getExtension('WEBGL_debug_renderer_info');
    this.software =
      !!debug &&
      /swiftshader|llvmpipe|softpipe|software/i.test(
        String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)),
      );
    if (this.software && localStorage.getItem('aclone.quality') !== 'high') {
      this.adapted = !this.low;
      this.low = true;
      document.documentElement.classList.add('performance');
    }
    const low = this.low;
    this.townLighting = new TownLighting(low ? 4 : 12);
    this.renderer.setPixelRatio(
      low
        ? this.software
          ? 0.65
          : 0.85
        : Math.min(
            devicePixelRatio * (localStorage.getItem('aclone.quality') === 'high' ? 1 : 1.25),
            1.5,
          ),
    );
    this.renderer.shadowMap.enabled = !low && localStorage.getItem('aclone.shadows') === 'on';
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.setClearColor('#a5b4a0');
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Aclone 3D world. Use arrow keys to drive.',
    );
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.sky.visible = false;
    this.precipitation.mesh.visible = false;
    this.scene.add(
      this.land,
      this.actors,
      this.space,
      this.sun,
      this.ambient,
      this.sky,
      this.precipitation.mesh,
    );
    this.sun.position.set(-60, 110, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -65,
      right: 65,
      top: 65,
      bottom: -65,
      near: 1,
      far: 320,
    });
    this.sun.shadow.bias = -0.0005;
    this.scene.add(
      this.sun.target,
      this.headlights,
      this.headlights.target,
      this.townLighting.group,
      this.lightning,
    );
    this.lightning.visible = false;
    this.ball = new T.Mesh(new T.IcosahedronGeometry(2.2, 1), material('#e8d4a5'));
    this.ball.castShadow = true;
    this.projectiles.count = 0;
    this.projectiles.frustumCulled = false;
    this.actors.add(this.ball, this.projectiles, this.plumes.mesh);
    const starGeo = new T.BufferGeometry();
    const coords = [];
    for (let i = 0; i < 1400; i++) {
      const n = i * 137.508,
        r = 250 + (i % 100) * 2;
      coords.push(Math.cos(n) * r, Math.sin(n * 1.3) * r, Math.sin(n) * r);
    }
    starGeo.setAttribute('position', new T.Float32BufferAttribute(coords, 3));
    this.stars = new T.Points(
      starGeo,
      new T.PointsMaterial({ color: 0xe6e6d5, size: 0.7, sizeAttenuation: true }),
    );
    this.space.add(this.stars);
    for (let i = 0; i < 3; i++) {
      const p = new T.Mesh(
        new T.IcosahedronGeometry(9 - i * 1.8, 3),
        material(['#7f9b69', '#ad7752', '#657b9b'][i]),
      );
      p.position.set((i - 1) * 35, 0, i === 1 ? -25 : 0);
      this.planets.push(p);
      this.space.add(p);
      const orbit = new T.Mesh(
        new T.TorusGeometry(15 + i * 5, 0.06, 3, 100),
        new T.MeshBasicMaterial({ color: '#627364', transparent: true, opacity: 0.45 }),
      );
      orbit.rotation.x = Math.PI / 2;
      orbit.position.copy(p.position);
      this.space.add(orbit);
    }
    this.camera.position.set(0, 30, 80);
    this.camera.lookAt(0, 0, 0);
    this.space.visible = true;
    this.land.visible = false;
    this.actors.visible = false;
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    const pointers = new Map<number, { x: number; y: number }>();
    let moved = 0;
    const span = () => {
      const [a, b] = [...pointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || this.paused) return;
      if (!pointers.size) moved = 0;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.renderer.domElement.setPointerCapture(e.pointerId);
      if (pointers.size > 1) moved = 100; // A pinch never selects a building.
    });
    const release = (e: PointerEvent) => pointers.delete(e.pointerId);
    this.renderer.domElement.addEventListener('pointerup', release);
    this.renderer.domElement.addEventListener('pointercancel', (e) => {
      moved = 100;
      release(e);
    });
    this.renderer.domElement.addEventListener('lostpointercapture', release);
    window.addEventListener('blur', () => {
      pointers.clear();
      moved = 100;
    });
    this.renderer.domElement.addEventListener('pointermove', (e) => {
      const previous = pointers.get(e.pointerId);
      if (!previous || this.paused) return;
      const before = span();
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size > 1) {
        const after = span();
        if (before > 0 && after > 0)
          this.zoom = Math.min(2.8, Math.max(0.55, (this.zoom * before) / after));
      } else {
        this.orbit += (e.clientX - previous.x) * 0.007;
        if (this.cameraMode === 1)
          this.lookPitch = Math.max(
            -1.1,
            Math.min(1.4, this.lookPitch + (previous.y - e.clientY) * 0.004),
          );
        moved += Math.abs(e.clientX - previous.x) + Math.abs(e.clientY - previous.y);
      }
    });
    this.renderer.domElement.addEventListener('click', (e) => {
      if (moved > 5 || !this.world || this.paused) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ray = new T.Raycaster();
      ray.setFromCamera(
        new T.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          (-(e.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        this.camera,
      );
      const hit = ray.intersectObjects(this.buildingMeshes, true)[0];
      if (hit) {
        let obj: T.Object3D | null = hit.object;
        while (obj && !obj.userData.building) obj = obj.parent;
        if (obj?.userData.building) this.onBuilding?.(obj.userData.building);
      }
    });
    this.renderer.domElement.addEventListener(
      'wheel',
      (e) => {
        this.zoom = Math.min(2.8, Math.max(0.55, this.zoom + e.deltaY * 0.001));
        e.preventDefault();
      },
      { passive: false },
    );
    this.renderer.setAnimationLoop(() => this.frame());
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  setWorld(world: World, me: string) {
    const entering = this.lastWorld !== world.id;
    if (entering) {
      this.ready = false;
      this.onLoading?.('Preparing the parish…');
      performance.mark('aclone-world-loading');
    }
    this.world = world;
    this.flightSnapshotAt = performance.now();
    this.me = world.players[me];
    this.audio.setWorld(world, me);
    this.sky.visible = true;
    this.space.visible = false;
    this.land.visible = true;
    this.actors.visible = true;
    const rev =
      world.id +
      ':' +
      JSON.stringify(world.terrain) +
      JSON.stringify(world.landscape ?? {}) +
      ':' +
      world.buildings
        .map(
          (b) =>
            b.id +
            b.name +
            b.x +
            ':' +
            b.z +
            ':' +
            b.rotation +
            (b.style ?? '') +
            (b.construction ? 'c' : ''),
        )
        .join(',') +
      ':' +
      world.settings.seaLevel +
      ':' +
      JSON.stringify(world.creator ?? {}) +
      ':' +
      world.buildings.map((b) => b.creatorModel ?? '').join(',');
    const rebuilt = this.revision !== rev;
    if (rebuilt) {
      this.revision = rev;
      this.buildWorld(world);
    }
    if (this.lastWorld !== world.id) {
      this.motionClock = new MotionClock();
      this.lastWorld = world.id;
      this.plumes.clear();
      this.fields.reset();
      this.livestock.reset();
      this.camera.position.set(this.me.x + 25, 30, this.me.z + 30);
      this.chase = this.me.heading;
    }
    this.fields.update(world, this.me);
    this.livestock.update(world, this.me);
    const resetMotion = this.motionClock.receive(world.time, performance.now());
    for (const p of Object.values(world.players)) {
      let mesh = this.meshes.get(p.id);
      if (mesh && (mesh.userData.vehicle !== p.vehicle || mesh.userData.paint !== p.tractorPaint)) {
        this.actors.remove(mesh);
        dispose(mesh);
        this.meshes.delete(p.id);
        mesh = undefined;
      }
      const visual = world.creator?.models.find(
        (m) => m.id === world.creator?.vehicleModels[p.vehicle],
      );
      const visualKey = JSON.stringify(visual ?? null);
      if (mesh && mesh.userData.creatorKey !== visualKey) {
        this.actors.remove(mesh);
        dispose(mesh);
        this.meshes.delete(p.id);
        mesh = undefined;
      }
      if (!mesh) {
        mesh = visual
          ? creatorModel(visual, world)
          : this.vehicle(
              p.vehicle,
              p.id === me ? undefined : p.name + (p.npc ? ' · AI' : ''),
              p.tractorPaint,
            );
        mesh.userData.creatorKey = visualKey;
        if (visual && p.id !== me) {
          const tag = label(p.name + (p.npc ? ' · AI' : ''));
          tag.position.y = visual.height + 1;
          mesh.add(tag);
        }
        mesh.userData.paint = p.tractorPaint;
        mesh.userData.vehicle = p.vehicle;
        mesh.position.set(p.x, p.y, p.z);
        this.meshes.set(p.id, mesh);
        this.actors.add(mesh);
      }
      mesh.visible = !p.atHome;
      if (resetMotion || !mesh.userData.motion) mesh.userData.motion = new MotionTrack();
      const snapped = (mesh.userData.motion as MotionTrack).receive(world.time, p);
      if (snapped) {
        mesh.position.set(p.x, p.y, p.z);
        mesh.rotation.y = p.heading;
        mesh.userData.snapCamera = true;
      }
    }
    for (const [id, mesh] of this.meshes)
      if (!world.players[id]) {
        this.actors.remove(mesh);
        dispose(mesh);
        this.meshes.delete(id);
      }
    if (entering || (rebuilt && !this.ready)) void this.prepareWorld();
  }
  private async prepareWorld() {
    const generation = ++this.warmGeneration;
    const current = () => generation === this.warmGeneration && !!this.world;
    try {
      await yieldFrame();
      if (!current()) return;
      this.onLoading?.('Loading countryside textures…');
      await waitForTextures();
      if (!current()) return;
      const done = await uploadTextures(
        sceneTextures(this.scene),
        (texture) => this.renderer.initTexture(texture),
        current,
        (i, total) =>
          this.onLoading?.(`Preparing scenery… ${Math.round((i / Math.max(1, total)) * 100)}%`),
      );
      if (!done) return;
      // Establish fog, camera and light positions before compiling the first view.
      this.renderTime = -Infinity;
      this.frame();
      this.onLoading?.('Preparing daylight and night lighting…');
      const lamps = this.townLighting.group.visible,
        headlights = this.headlights.visible;
      try {
        for (const night of [false, true])
          for (const beam of [false, true]) {
            if (!current()) return;
            this.townLighting.group.visible = night;
            this.headlights.visible = beam;
            await this.renderer.compileAsync(this.scene, this.camera);
            if (!current()) return;
            // A compiled program can still defer GPU uploads/JIT until its first draw.
            this.townLighting.group.visible = night;
            this.headlights.visible = beam;
            this.renderer.render(this.scene, this.camera);
            if (!(await finishGpuWork(this.renderer.getContext(), current))) return;
          }
      } finally {
        this.townLighting.group.visible = lamps;
        this.headlights.visible = headlights;
      }
      if (!current()) return;
      this.onLoading?.('Finishing the view…');
      this.renderTime = -Infinity;
      this.frame();
      this.renderer.render(this.scene, this.camera);
      if (!(await finishGpuWork(this.renderer.getContext(), current))) return;
      await yieldFrame();
      if (!current()) return;
      this.ready = true;
      this.lastTime = performance.now();
      this.slowFrames = 0;
      performance.mark('aclone-world-ready');
      this.onLoading?.(
        undefined,
        failedTextures.size
          ? 'Some scenery textures could not load. Plain surfaces are in use; reload to retry.'
          : undefined,
      );
    } catch (error) {
      if (!current()) return;
      console.warn('Scenery preparation failed', error);
      this.ready = true;
      this.lastTime = performance.now();
      this.onLoading?.(
        undefined,
        'Scenery preparation was interrupted. The view may take a moment to settle.',
      );
    }
  }
  setSpace() {
    ++this.warmGeneration;
    this.ready = true;
    this.onLoading?.();
    this.audio.clear();
    this.lastWorld = '';
    document.documentElement.classList.remove('scenery-view');
    this.sky.visible = false;
    this.precipitation.mesh.visible = false;
    this.headlights.visible = false;
    this.townLighting.group.visible = false;
    this.lightning.visible = false;
    this.world = undefined;
    this.me = undefined;
    this.space.visible = true;
    this.land.visible = false;
    this.actors.visible = false;
    this.scene.fog = null;
    this.scene.background = new T.Color('#101d21');
    this.camera.position.set(0, 32, 80);
    this.camera.lookAt(0, 0, -10);
  }
  private buildWorld(w: World) {
    dispose(this.land);
    this.land.clear();
    this.fields.reset();
    this.livestock.reset();
    this.buildingMeshes = [];
    this.flights = [];
    this.labelsHidden = false;
    this.renderer.shadowMap.needsUpdate = true;
    const geometry = new T.PlaneGeometry(540, 540, 128, 128);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(w, pos.getX(i), pos.getZ(i)));
    geometry.computeVertexNormals();
    this.terrain = new T.Mesh(geometry, groundMaterial(w));
    this.terrain.receiveShadow = true;
    this.land.add(this.terrain);
    const sea = new T.Mesh(
      new T.PlaneGeometry(540, 540, 48, 48),
      new T.MeshStandardMaterial({
        color: '#439ea7',
        roughness: 0.22,
        metalness: 0.2,
        transparent: true,
        opacity: 0.88,
      }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = w.settings.seaLevel;
    this.water = sea;
    this.waterBase = new Float32Array(sea.geometry.attributes.position.array);
    this.land.add(sea);
    for (const b of w.buildings) {
      const custom = w.creator?.models.find((m) => m.id === b.creatorModel);
      const g = custom ? creatorModel(custom, w) : this.building(b);
      g.position.set(b.x, terrainHeight(w, b.x, b.z), b.z);
      g.rotation.y = b.rotation;
      g.userData.building = b.id;
      this.buildingMeshes.push(g);
      this.land.add(g);
    }
    for (const { x, z } of streetLights(w)) {
      const lamp = new T.Group();
      cylinder(lamp, 0.1, 5.5, '#353e38', 0, 2.75, 0, 10);
      cylinder(lamp, 0.21, 0.3, '#353e38', 0, 0.15, 0, 10);
      cylinder(lamp, 0.16, 0.15, '#353e38', 0, 5.35, 0, 10);
      box(lamp, 0.7, 0.1, 0.7, '#353e38', 0, 5.55, 0);
      const glass = box(lamp, 0.55, 0.8, 0.55, '#c9bf95', 0, 6, 0);
      glass.material.roughness = 0.25;
      glass.userData.lightSource = 'street';
      glass.material.emissive.set('#956925');
      glass.material.emissiveIntensity = 0.25;
      for (const x of [-0.3, 0.3])
        for (const z of [-0.3, 0.3]) box(lamp, 0.06, 0.9, 0.06, '#353e38', x, 6, z);
      const cap = new T.Mesh(new T.ConeGeometry(0.56, 0.32, 4), material('#353e38'));
      cap.position.y = 6.58;
      cap.rotation.y = Math.PI / 4;
      lamp.add(cap);
      lamp.scale.setScalar(0.6);
      lamp.position.set(x, terrainHeight(w, x, z), z);
      this.land.add(lamp);
    }
    const pitch = new T.Mesh(new T.PlaneGeometry(60, 50), material('#69894f'));
    surface(pitch, 'meadow', 5, '#a8ba83');
    pitch.rotation.x = -Math.PI / 2;
    pitch.position.set(90, 0.3, 45);
    pitch.receiveShadow = true;
    this.land.add(pitch);
    const line = (pts: T.Vector3[]) => {
      const l = new T.Line(
        new T.BufferGeometry().setFromPoints(pts),
        new T.LineBasicMaterial({ color: '#e1d9b2' }),
      );
      this.land.add(l);
    };
    line(
      [
        [60, 20],
        [120, 20],
        [120, 70],
        [60, 70],
        [60, 20],
      ].map(([x, z]) => new T.Vector3(x, 0.4, z)),
    );
    line([new T.Vector3(90, 0.4, 20), new T.Vector3(90, 0.4, 70)]);
    for (const x of [60, 120]) {
      const goal = new T.Group();
      box(goal, 0.4, 7, 0.4, '#efe4c5', 0, 3.5, -9);
      box(goal, 0.4, 7, 0.4, '#efe4c5', 0, 3.5, 9);
      box(goal, 0.4, 0.4, 18, '#efe4c5', 0, 7, 0);
      goal.position.set(x, 0.3, 45);
      this.land.add(goal);
    }
    const hornSign = label('HORN BALL · RUST / MOSS');
    hornSign.position.set(90, 7, 15);
    this.land.add(hornSign);
    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i],
        g = new T.Group();
      for (const x of [-5, 5]) box(g, 0.35, 7, 0.35, i % 2 ? '#b9533c' : '#eadbaa', x, 3.5, 0);
      box(g, 10, 0.4, 0.4, '#d2bb7a', 0, 7, 0);
      const sign = label(i === 0 ? 'PUDDLEWICK CIRCUIT' : 'CHECKPOINT ' + i, '#fff1c8', 0.8);
      sign.position.y = 9;
      g.add(sign);
      g.position.set(cp.x, 0.2, cp.z);
      this.land.add(g);
    }
    for (const x of [60, 80]) {
      const g = new T.Group();
      cylinder(g, 0.6, 20, '#d4cdb5', 0, 10, 0);
      const blades = new T.Group();
      for (let i = 0; i < 3; i++) {
        const b = new T.Group();
        box(b, 0.6, 10, 0.2, '#e9dfc6', 0, 5, 0);
        b.rotation.z = (i * Math.PI * 2) / 3;
        blades.add(b);
      }
      blades.position.set(0, 20, 1);
      g.add(blades);
      g.position.set(x, terrainHeight(w, x, -100), -100);
      g.userData.blades = blades;
      this.land.add(g);
    }
    const dock = new T.Group();
    const deck = dockHeight(w);
    dock.position.set(fishingDock.x, deck, fishingDock.z);
    dock.userData.building = fishingDock.id;
    box(dock, fishingDock.width, 0.3, fishingDock.depth, '#705b43', 0, -0.18, 0);
    for (let z = -10.75; z < 11; z += 0.5)
      box(dock, fishingDock.width, 0.06, 0.47, '#938060', 0, -0.03, z);
    for (const x of [-7, 7])
      for (const z of [-9, 0, 10]) {
        const bottom = Math.min(terrainHeight(w, fishingDock.x + x, fishingDock.z + z), deck - 1);
        box(dock, 0.4, deck - bottom + 0.75, 0.4, '#705b43', x, (bottom - deck + 0.75) / 2, z);
      }
    // A sloped boardwalk joins the dry shore to exactly the same support surface as physics.
    const positions: number[] = [];
    for (let z = fishingDock.rampStart; z < fishingDock.shore; z += 0.5) {
      const a = [-8, travelHeight(w, fishingDock.x - 8, z) - deck, z - fishingDock.z];
      const b = [8, travelHeight(w, fishingDock.x + 8, z) - deck, z - fishingDock.z];
      const c = [-8, travelHeight(w, fishingDock.x - 8, z + 0.5) - deck, z + 0.5 - fishingDock.z];
      const d = [8, travelHeight(w, fishingDock.x + 8, z + 0.5) - deck, z + 0.5 - fishingDock.z];
      positions.push(...a, ...c, ...b, ...b, ...c, ...d);
    }
    const ramp = new T.BufferGeometry();
    ramp.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    ramp.computeVertexNormals();
    // Supply UVs so the ramp can join the ordinary static geometry batches.
    ramp.setAttribute(
      'uv',
      new T.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2),
    );
    dock.add(new T.Mesh(ramp, material('#938060')));
    const fishing = label('FISHING DOCK · ANGLING');
    fishing.position.y = 6;
    dock.add(fishing);
    this.land.add(dock);
    const kricket = label('ULTRAKRICKET · MIND THE FUSE');
    kricket.position.set(70, 6, -70);
    this.land.add(kricket);
    for (let i = 0; i < 3; i++) {
      const g = new T.Group();
      box(g, 0.2, 2, 0.2, '#f0dcb1', i * 0.5, 1, 0);
      g.position.set(70, 0.2, -73);
      this.land.add(g);
    }
    // Bake static geometry by material: dozens of draw calls instead of hundreds.
    this.land.updateMatrixWorld(true);
    addLandscape(this.land, w);
    this.land.updateMatrixWorld(true);
    const batches = new Map<string, { geometries: T.BufferGeometry[]; material: T.Material }>();
    const originals: T.Mesh[] = [];
    this.land.traverse((o) => {
      if (!(o instanceof T.Mesh) || o === this.terrain || Array.isArray(o.material)) return;
      const mat = o.material as T.MeshStandardMaterial;
      if (
        o.userData.lightSource ||
        mat.transparent ||
        mat.vertexColors ||
        !(mat instanceof T.MeshStandardMaterial)
      )
        return;
      let parent: T.Object3D | null = o;
      while (parent) {
        if (
          parent.userData.blades ||
          parent.userData.creatorModel ||
          parent.userData.animatedFlight
        )
          return;
        parent = parent.parent;
      }
      const key = [
        mat.color.getHexString(),
        mat.map?.uuid,
        mat.roughness,
        mat.metalness,
        mat.side,
        mat.emissive.getHexString(),
      ].join(':');
      const batch = batches.get(key) ?? { geometries: [], material: mat.clone() };
      batch.geometries.push(
        (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(
          o.matrixWorld,
        ),
      );
      batches.set(key, batch);
      originals.push(o);
    });
    for (const o of originals) {
      o.removeFromParent();
      o.geometry.dispose();
      (o.material as T.Material).dispose();
    }
    for (const batch of batches.values()) {
      const merged = mergeGeometries(batch.geometries);
      for (const g of batch.geometries) g.dispose();
      if (merged) {
        const mesh = new T.Mesh(merged, batch.material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.land.add(mesh);
      }
    }
    this.townLighting.reset(this.land);
    if (w.creator?.scenery !== false) countryside(this.land, w, this.low);
    const seasonal = new Set<T.Material>();
    this.land.traverse((o) => {
      if (o instanceof T.Mesh && o !== this.terrain && o !== this.water)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (
            (m instanceof T.MeshStandardMaterial || m instanceof T.MeshLambertMaterial) &&
            !m.transparent &&
            !seasonal.has(m)
          ) {
            seasonal.add(m);
            seasonalMaterial(m, m.alphaTest > 0 && !m.userData.evergreen);
          }
    });
    if (!this.livestock.group.parent) this.actors.add(this.livestock.group);
    if (!this.fields.group.parent) this.actors.add(this.fields.group);
    if (!this.combatMarkers.parent) this.actors.add(this.combatMarkers);

    for (const g of this.buildingMeshes) {
      const b = w.buildings.find((b) => b.id === g.userData.building)!;
      const plan = buildingPlan(b);
      for (const v of [...plan.volumes, ...(plan.fixtures ?? [])]) {
        const height = v.eaves + v.rise;
        const picker = new T.Mesh(new T.BoxGeometry(v.width, height, v.depth), material('#ffffff'));
        picker.position.set(v.x, height / 2, v.z);
        // Town geometry is scaled as a group; plans already contain final metres.
        picker.position.divide(g.scale);
        picker.scale.set(1 / g.scale.x, 1 / g.scale.y, 1 / g.scale.z);
        picker.visible = false;
        g.add(picker);
      }
    }
    // Add picking after static batching so the clickable surface survives merging.
    const dockPicker = new T.Mesh(
      new T.BoxGeometry(fishingDock.width, 0.5, fishingDock.depth),
      material('#ffffff'),
    );
    dockPicker.position.y = -0.1;
    dockPicker.visible = false;
    dock.add(dockPicker);
    this.buildingMeshes.push(dock);
    for (const o of w.creator?.objects ?? []) {
      if (!o.visible) continue;
      const model = w.creator!.models.find((m) => m.id === o.model);
      if (!model) continue;
      const g = creatorModel(model, w);
      g.position.set(o.x, terrainHeight(w, o.x, o.z) + o.y, o.z);
      g.rotation.y = (o.yaw * Math.PI) / 180;
      g.scale.setScalar(o.scale);
      g.userData.building = 'object:' + o.id;
      this.land.add(g);
      this.buildingMeshes.push(g);
      const picker = new T.Mesh(
        new T.BoxGeometry(model.width, model.height, model.depth),
        material('#ffffff'),
      );
      picker.position.y = model.height / 2;
      picker.visible = false;
      g.add(picker);
      const sign = label(o.name);
      sign.position.y = model.height + 1;
      g.add(sign);
    }

    const animated: T.Object3D[] = [];
    for (const o of this.land.children) {
      if (o.userData.blades) animated.push(o.userData.blades);
      if (o.userData.clouds) animated.push(o);
    }
    this.land.traverse((o) => {
      if (o.userData.animatedFlight) animated.push(o);
      if (o.userData.flight) this.flights.push(o.userData.flight);
    });
    freezeScenery(this.land, animated);
  }
  private building(b: Building) {
    const g = new T.Group();
    if (b.kind === 'town') {
      for (const [r, h, y] of [
        [5, 0.25, 0.125],
        [4.4, 0.3, 0.4],
        [3.7, 0.6, 0.8],
      ])
        surface(cylinder(g, r, h, '#ffffff', 0, y, 0, 48), 'stone', 4);
      const basin = new T.Mesh(new T.TorusGeometry(3.45, 0.25, 8, 48), material('#b6b3a0'));
      basin.rotation.x = Math.PI / 2;
      basin.position.y = 1.15;
      g.add(basin);
      const water = new T.Mesh(
        new T.CircleGeometry(3.4, 48),
        new T.MeshStandardMaterial({ color: '#497f7d', roughness: 0.18, metalness: 0.25 }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = 1.03;
      g.add(water);
      cylinder(g, 0.5, 2.1, '#b8b39b', 0, 2, 0, 16);
      cylinder(g, 1.6, 0.24, '#c5c1ac', 0, 3.05, 0, 32);
      cylinder(g, 0.24, 1.4, '#a9ac91', 0, 3.8, 0, 12);
      const finial = new T.Mesh(new T.SphereGeometry(0.38, 16, 12), material('#718678'));
      finial.position.y = 4.65;
      g.add(finial);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4,
          curve = new T.QuadraticBezierCurve3(
            new T.Vector3(Math.sin(a) * 1.3, 3.1, Math.cos(a) * 1.3),
            new T.Vector3(Math.sin(a) * 2.3, 3, Math.cos(a) * 2.3),
            new T.Vector3(Math.sin(a) * 2.8, 1.05, Math.cos(a) * 2.8),
          );
        const stream = new T.Mesh(
          new T.TubeGeometry(curve, 12, 0.035, 4, false),
          new T.MeshStandardMaterial({ color: '#94bab0', roughness: 0.2 }),
        );
        g.add(stream);
      }
      for (const x of [-7, 7]) {
        box(g, 2.8, 0.17, 0.85, '#796747', x, 0.85, 0);
        box(g, 2.8, 0.6, 0.14, '#796747', x, 1.22, -0.46);
        for (const dx of [-1.05, 1.05]) box(g, 0.13, 0.85, 0.7, '#434c42', x + dx, 0.42, 0);
      }
      g.scale.setScalar(0.6);
      return g;
    }
    const model = buildingModel(b);
    g.add(model);
    g.userData.chimneys = model.userData.chimneys ?? [];
    const bounds = new T.Box3().setFromObject(g);
    const sign = label(b.name, b.construction ? '#e7b36b' : '#e5ddbe', 0.65);
    // Keep the terminal name readable at the door, not above the tall spacecraft.
    sign.position.set(0, b.kind === 'starport' ? 8 : bounds.max.y + 1.1, 0);
    g.add(sign);
    return g;
  }
  private vehicle(slot: number, name?: string, paint?: string) {
    const v = vehicles[slot],
      g = new T.Group();
    if (slot === 5) {
      const human = createHuman();
      g.add(human.group);
      g.userData.human = human;
    } else if (slot === 6) {
      cylinder(g, 0.22, 1.5, '#bd9971', -0.45, 0.8, 0, 5);
      cylinder(g, 0.22, 1.5, '#bd9971', 0.45, 0.8, 0, 5);
      const body = new T.Mesh(new T.IcosahedronGeometry(1.2, 1), material('#403f39'));
      body.position.y = 2;
      g.add(body);
      cylinder(g, 0.2, 2, '#d7c5a1', 0, 3.2, 0.4, 5);
      box(g, 0.6, 0.6, 0.7, '#d7c5a1', 0, 4.2, 0.4);
    } else if (v.mode === 2) {
      box(g, 1, 1, 6, v.color, 0, 1, 0);
      box(g, 9, 0.3, 1.8, v.color, 0, 1.6, 0);
      box(g, 9, 0.3, 1.8, v.color, 0, 3, 0);
      box(g, 3, 0.2, 1, v.color, 0, 1.2, -2.5);
      box(g, 0.2, 1.7, 1.2, '#c36045', 0, 2, -2.5);
      box(g, 3, 0.15, 0.2, '#4c534a', 0, 1, 3.1);
    } else if (v.mode === 3) {
      box(g, 3, 1, 6, v.color, 0, 0.5, 0);
      box(g, 2, 1.8, 2, '#d6cfae', 0, 1.8, -1);
    } else if (v.mode === 6) {
      const crow = createRobocrow();
      g.add(crow.group);
      g.userData.robocrow = crow;
    } else {
      tractor(g, tractorPaint(paint)?.color ?? v.color);
      if (v.mode === 5) box(g, 4, 0.6, 5, '#454d42', 0, 0.4, 0);
    }
    if (name) {
      const tag = pilotLabel(name);
      tag.position.y = slot === 5 ? 2.6 : 5;
      if (slot === 5) tag.scale.set(3.5, 1.15, 1);
      g.add(tag);
    }
    return g;
  }
  private frame() {
    const now = performance.now();
    const interval = this.paused ? 250 : 1000 / (this.software || this.low ? 30 : 60);
    const sinceRender = now - this.renderTime;
    if (sinceRender < interval) return;
    // Preserve the fractional interval so a 60 Hz display can reliably deliver 30 FPS.
    this.renderTime = now - (sinceRender % interval);
    if (
      this.ready &&
      !this.low &&
      !this.paused &&
      localStorage.getItem('aclone.quality') !== 'high'
    ) {
      this.slowFrames =
        now - this.lastTime > 180 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
      if (this.slowFrames >= 6) {
        this.low = true;
        this.adapted = true;
        this.renderer.shadowMap.enabled = false;
        this.renderer.setPixelRatio(0.75);
        this.resize();
        document.documentElement.classList.add('performance');
      }
    }
    this.fpsFrames++;
    if (now - this.fpsSince >= 1000) {
      this.renderFps = Math.round((this.fpsFrames * 1000) / (now - this.fpsSince));
      this.fpsFrames = 0;
      this.fpsSince = now;
    }
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.elapsed += dt;
    if (this.world && this.me) {
      const w = this.world,
        p = this.me;
      this.livestock.animate(this.elapsed);
      for (const flight of this.flights)
        flight.update(
          w.id,
          w.time + Math.min(1, Math.max(0, (now - this.flightSnapshotAt) / 1000)),
        );
      const motionTime = this.motionClock.sample(now);
      for (const mesh of this.meshes.values()) {
        const pose = (mesh.userData.motion as MotionTrack).sample(motionTime)!;
        const travel =
          (pose.x - mesh.position.x) * Math.sin(pose.heading) +
          (pose.z - mesh.position.z) * Math.cos(pose.heading);
        mesh.position.set(pose.x, pose.y, pose.z);
        mesh.rotation.y = pose.heading;
        for (const wheel of (mesh.userData.wheels ?? []) as T.Group[])
          wheel.rotation.x += travel / (wheel.userData.radius ?? 1);
        (mesh.userData.human as HumanFigure | undefined)?.animate(travel, dt);
        (mesh.userData.robocrow as RobocrowFigure | undefined)?.animate(dt);
        // Keep the player's own face/driver out of the first-person camera.
        const occupant =
          (mesh.userData.human as HumanFigure | undefined)?.group ?? mesh.userData.driver;
        if (occupant) occupant.visible = mesh !== this.meshes.get(p.id) || this.cameraMode !== 1;
      }
      this.headlights.visible = p.lights && !p.atHome;
      const local = this.meshes.get(p.id);
      if (local) {
        const pos = local.position;
        const facing = local.rotation.y;
        this.headlights.position.set(pos.x, pos.y + (local.userData.driver ? 1.7 : 2), pos.z);
        this.headlights.target.position.set(
          pos.x + Math.sin(facing) * 35,
          pos.y,
          pos.z + Math.cos(facing) * 35,
        );
        this.target.copy(pos);
        const walking = p.vehicle === 5;
        const tractorView = !!local.userData.driver;
        this.target.y += walking ? 1.25 : 1.6;
        let diff = facing - this.chase;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.chase += diff * (1 - Math.exp(-dt * 3));
        if (local.userData.snapCamera) this.chase = facing;
        const heading = this.chase + this.orbit;
        const cam =
          this.cameraMode === 1
            ? new T.Vector3(
                pos.x + (tractorView ? Math.sin(facing) * TRACTOR_SEAT_Z : 0),
                pos.y + (walking ? 1.68 : tractorView ? TRACTOR_EYE_HEIGHT : 3),
                pos.z + (tractorView ? Math.cos(facing) * TRACTOR_SEAT_Z : 0),
              )
            : this.cameraMode === 2 || p.vehicle === 7
              ? new T.Vector3(pos.x, pos.y + 65 * this.zoom, pos.z + 3)
              : new T.Vector3(
                  pos.x - Math.sin(heading) * (walking ? 6 : 21) * this.zoom,
                  pos.y + (walking ? 3 : 8.5) * this.zoom,
                  pos.z - Math.cos(heading) * (walking ? 6 : 21) * this.zoom,
                );
        cam.y = Math.max(
          cam.y,
          terrainHeight(w, cam.x, cam.z) + (walking || tractorView ? 0.6 : 3),
        );
        if (local.userData.snapCamera || this.cameraMode === 1) this.camera.position.copy(cam);
        else this.camera.position.lerp(cam, 1 - Math.exp(-dt * 4));
        local.userData.snapCamera = false;
        if (this.cameraMode === 1)
          this.target
            .copy(this.camera.position)
            .add(
              new T.Vector3(
                Math.sin(heading) * Math.cos(this.lookPitch) * 30,
                Math.sin(this.lookPitch) * 30,
                Math.cos(heading) * Math.cos(this.lookPitch) * 30,
              ),
            );
        this.camera.lookAt(this.target);
        this.camera.getWorldDirection(this.audioFacing);
        this.audio.update(
          {
            x: pos.x,
            y: pos.y,
            z: pos.z,
            heading: Math.atan2(this.audioFacing.x, this.audioFacing.z),
          },
          (id) => this.meshes.get(id)?.position,
        );
        if (p.vehicle === 0 && Math.abs(p.speed) > 1 && this.elapsed - this.smokesAt > 0.18) {
          this.smokesAt = this.elapsed;
          this.plumes.emit(
            pos
              .clone()
              .add(
                new T.Vector3(
                  -0.57 * 0.82 * Math.cos(facing) + 0.78 * 0.82 * Math.sin(facing),
                  2.8,
                  0.57 * 0.82 * Math.sin(facing) + 0.78 * 0.82 * Math.cos(facing),
                ),
              ),
          );
        }
      }
      if (this.elapsed - this.chimneyTime > 0.55) {
        this.chimneyTime = this.elapsed;
        const smoking = new Set(w.buildings.filter((b) => b.smoking).map((b) => b.id));
        for (const g of this.buildingMeshes)
          if (smoking.has(g.userData.building) && distance(p, g.position) < 100)
            for (const at of (g.userData.chimneys as T.Vector3[]) ?? [])
              this.plumes.emit(g.localToWorld(at.clone()));
      }
      this.plumes.update(dt);
      const date = calendar(w),
        climate = worldWeather(w, date.absoluteDay),
        skyOffset = Math.max(-1, Math.min(1, motionTime - w.time)),
        clock =
          w.settings.time +
          (w.settings.dayLength > 0 ? (skyOffset * 86400) / w.settings.dayLength : 0),
        skySeconds = ((clock % 86400) + 86400) % 86400,
        // Orbital seasons/phases follow the continuous saved calendar even if
        // an owner freezes or changes the decorative clock's day length.
        skyDay =
          (w.time + skyOffset) / DAY_SECONDS + 59 + defaults.time / 86400 - skySeconds / 86400,
        astronomy = celestialAt(skyDay, skySeconds),
        solar = sunAt(skySeconds, skyDay),
        daylight = solar.daylight;
      const drift = (w.time + skyOffset) * 0.001 * climate.wind;
      const night = nightIllumination(astronomy, climate.clouds, drift);
      snowCover.value = w.climate?.snow ?? 0;
      if (this.terrain)
        (this.terrain.material as T.MeshStandardMaterial).roughness =
          1 - (w.climate?.wetness ?? 0) * 0.45;
      // Spend the limited light budget where the player is looking, not behind
      // their tractor at the chase camera (especially with four lights on low).
      this.townLighting.update(w, this.target);
      const flash = lightningAt(motionTime, climate.storm && climate.precipitation === 'rain');
      autumnTint.value = climate.season === 'Autumn' ? 0.85 : climate.season === 'Winter' ? 0.5 : 0;
      this.lightning.visible = flash > 0;
      this.lightning.position.set(p.x + 38, 0, p.z - 85);
      this.precipitation.update(
        dt,
        this.camera.position,
        climate.precipitation,
        climate.intensity,
        climate.wind,
      );
      const twilight = twilightAt(solar.direction[1], climate.clouds);
      const sunlight = daylight * (3 - climate.clouds * 1.7);
      this.sun.intensity = sunlight + night.moonlight;
      this.sun.color.set('#ffe9bb').lerp(new T.Color('#ffab65'), twilight.warmth);
      this.sun.color.lerp(
        new T.Color('#d2dfff'),
        night.moonlight / Math.max(0.001, this.sun.intensity),
      );
      this.ambient.color.set('#b6cbd9').lerp(new T.Color('#b6c5df'), night.night);
      this.ambient.groundColor.set('#7c8067').lerp(new T.Color('#657083'), night.night);
      this.ambient.intensity =
        0.002 + daylight * 1.05 + night.ambient + twilight.ambient + flash * 2.5;
      const sky = new T.Color('#b8ced9').multiplyScalar(0.001 + daylight * 0.9 + flash);
      sky.lerp(new T.Color('#ba847a'), twilight.glow * 0.22);
      this.sky.position.copy(this.camera.position);
      this.sky.material.uniforms.horizon.value.copy(sky);
      this.sky.material.uniforms.zenith.value
        .set('#458fc2')
        .multiplyScalar(0.003 + daylight * 0.9 + flash);
      this.sky.material.uniforms.daylight.value = daylight;
      this.sky.material.uniforms.twilight.value = twilight.glow;
      this.sky.material.uniforms.sunDirection.value.fromArray(solar.direction).normalize();
      this.sky.material.uniforms.clouds.value = climate.clouds;
      this.sky.material.uniforms.drift.value = drift;
      this.sky.material.uniforms.skyRotation.value.fromArray(astronomy.skyRotation);
      this.sky.material.uniforms.night.value = night.night;
      this.sky.material.uniforms.twinkle.value = w.time + skyOffset;
      this.sky.material.uniforms.moonGlow.value =
        astronomy.moons.reduce(
          (sum, moon) => sum + moon.illuminated * Math.max(0, moon.direction[1]),
          0,
        ) * night.night;
      for (const [i, key] of ['moonA', 'moonB'].entries()) {
        const moon = astronomy.moons[i];
        this.sky.material.uniforms[key].value.set(...moon.direction, moon.radius);
      }
      this.scene.background = sky;
      if (!(this.scene.fog instanceof T.Fog)) this.scene.fog = new T.Fog(sky, 125, 450);
      this.scene.fog.color.copy(sky);
      this.scene.fog.near = climate.precipitation === 'clear' ? 125 : climate.storm ? 35 : 70;
      this.scene.fog.far = climate.precipitation === 'clear' ? 450 : climate.storm ? 140 : 260;
      // The nearby pair shares the existing shadow-casting directional light.
      // Its weighted direction follows both moons without increasing the light budget.
      this.sun.position.fromArray(solar.direction).multiplyScalar(sunlight);
      this.sun.position.addScaledVector(new T.Vector3(...night.direction), night.moonlight);
      this.sun.position.normalize().multiplyScalar(110);
      this.sun.position.y = Math.max(2, this.sun.position.y);
      this.sun.position.add(new T.Vector3(p.x, 0, p.z));
      this.sun.target.position.set(p.x, 0, p.z);
      if (
        this.renderer.shadowMap.enabled &&
        now - this.shadowTime > 200 &&
        (now - this.shadowTime > 2000 ||
          this.shadowPosition.distanceTo(new T.Vector3(p.x, p.y, p.z)) > 0.2 ||
          Object.values(w.players).some(
            (q) => !q.atHome && Math.abs(q.speed) > 0.1 && distance(q, p) < 100,
          ))
      ) {
        this.renderer.shadowMap.needsUpdate = true;
        this.shadowTime = now;
        this.shadowPosition.set(p.x, p.y, p.z);
      }
      const bases = combatBases(w);
      const mode = w.combat?.mode ?? '';
      const markerKey = mode + JSON.stringify(w.creator?.arena ?? {});
      if (this.combatMarkers.userData.mode !== markerKey) {
        dispose(this.combatMarkers);
        this.combatMarkers.clear();
        this.combatMarkers.userData.mode = markerKey;
        if (mode)
          for (let i = 0; i < 3; i++) {
            const at = i < 2 ? bases[i] : (w.creator?.arena.capture ?? { x: 0, z: -110 });
            const marker = new T.Group();
            const ring = new T.Mesh(
              new T.RingGeometry(
                i === 2 ? (w.creator?.arena.capture.radius ?? 12) - 0.5 : 7.5,
                i === 2 ? (w.creator?.arena.capture.radius ?? 12) : 8,
                48,
              ),
              new T.MeshBasicMaterial({
                color: i === 0 ? '#dd7455' : i === 1 ? '#9ab976' : '#ecd998',
                side: T.DoubleSide,
              }),
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.05;
            marker.add(ring);
            if (i < 2) {
              cylinder(marker, 0.08, 4, '#e7dfc8', 0, 2, 0);
              box(marker, 1.8, 1.1, 0.07, i === 0 ? '#b6533e' : '#70924f', 0.9, 3.4, 0);
            }
            const sign = label(
              i === 2
                ? 'CAPTURE POINT'
                : (w.creator?.arena.teams[i] ?? (i === 0 ? 'Rust' : 'Moss')) + ' BASE',
            );
            sign.position.y = 5;
            marker.add(sign);
            marker.position.set(at.x, terrainHeight(w, at.x, at.z), at.z);
            this.combatMarkers.add(marker);
          }
      }
      this.combatMarkers.visible = w.settings.fighting && !!mode;
      if (mode === 'ctf')
        this.combatMarkers.children.slice(0, 2).forEach((m, i) => {
          const f = w.combat!.flags[i];
          for (const index of [1, 2])
            m.children[index].position.set(
              f.x - bases[i].x + (index === 2 ? 0.9 : 0),
              terrainHeight(w, f.x, f.z) - m.position.y + (index === 2 ? 3.4 : 2),
              f.z - bases[i].z,
            );
        });
      this.ball.position.set(
        w.ball.x,
        2.5 +
          Math.abs(Math.sin(this.elapsed * 2)) *
            Math.min(1, Math.hypot(w.ball.vx, w.ball.vz) * 0.1),
        w.ball.z,
      );
      this.ball.rotation.x += dt * w.ball.vz * 0.1;
      this.ball.rotation.z -= dt * w.ball.vx * 0.1;
      if (this.projectiles.userData.state !== w.projectiles) {
        this.projectiles.userData.state = w.projectiles;
        this.projectiles.count = Math.min(512, w.projectiles.length);
        const matrix = new T.Matrix4();
        w.projectiles.slice(0, 512).forEach((shot, i) => {
          const scale = shot.weapon === 'machine' ? 0.12 : shot.weapon === 'mine' ? 0.35 : 0.28;
          matrix.makeScale(scale, scale, scale);
          matrix.setPosition(shot.x, shot.y, shot.z);
          this.projectiles.setMatrixAt(i, matrix);
          this.projectiles.setColorAt(
            i,
            new T.Color(
              shot.weapon === 'plasma' ? '#78dfee' : shot.weapon === 'mine' ? '#676b44' : '#ffbc68',
            ),
          );
        });
        this.projectiles.instanceMatrix.needsUpdate = true;
        if (this.projectiles.instanceColor) this.projectiles.instanceColor.needsUpdate = true;
      }
      const scenic = document.documentElement.classList.contains('scenery-view');
      if (scenic !== this.labelsHidden) {
        this.land.traverse((o) => {
          if (o instanceof T.Sprite) o.visible = !scenic;
        });
        this.labelsHidden = scenic;
      }
      for (const g of this.buildingMeshes)
        for (const child of g.children)
          if (child instanceof T.Sprite) child.visible = !scenic && distance(p, g.position) < 32;
      for (const obj of this.land.children) {
        if (obj.userData.blades) obj.userData.blades.rotation.z += dt * 0.35;
        if (obj.userData.clouds) obj.position.x = Math.sin(this.elapsed * 0.006) * 25;
      }
      if (this.water && this.waterBase && !this.low) {
        const pos = this.water.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++)
          pos.setZ(
            i,
            Math.sin(this.waterBase[i * 3] * 0.15 + this.elapsed) *
              Math.cos(this.waterBase[i * 3 + 1] * 0.12 + this.elapsed * 0.6) *
              0.12,
          );
        pos.needsUpdate = true;
      }
    } else {
      this.stars.rotation.y += dt * 0.008;
      for (const p of this.planets) p.rotation.y += dt * 0.06;
    }
    if (!this.ready) return;
    this.drunkVision.render(
      this.renderer,
      this.scene,
      this.camera,
      this.world && this.me
        ? impairment(this.me, this.world.time + Math.min(1, (now - this.flightSnapshotAt) / 1000))
        : 0,
      dt,
    );

    this.renderer.domElement.dataset.drawCalls = String(this.renderer.info.render.calls);
    this.renderer.domElement.dataset.triangles = String(this.renderer.info.render.triangles);
  }
  nearest() {
    if (!this.world || !this.me) return undefined;
    return [
      ...this.world.buildings,
      ...(this.world.creator?.objects
        .filter((o) => o.visible)
        .map((o) => ({ ...o, id: 'object:' + o.id })) ?? []),
      ...(nearFishingDock(this.world, this.me) ? [fishingDock] : []),
    ]
      .filter((b) => distance(b, this.me!) < 18)
      .sort((a, b) => distance(a, this.me!) - distance(b, this.me!))[0];
  }
}
function dispose(root: T.Object3D) {
  root.traverse((o) => {
    o.userData.disposed = true;
    if (o instanceof T.Mesh || o instanceof T.Sprite || o instanceof T.Line) {
      if (o instanceof T.InstancedMesh) o.dispose();
      if ('geometry' in o && !o.geometry?.userData.shared) o.geometry?.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m?.userData.shared) continue;
        if (m && 'map' in m) {
          const map = m.map as T.Texture | undefined;
          if (!map?.userData.shared) map?.dispose();
        }
        m?.dispose();
      }
    }
  });
}
