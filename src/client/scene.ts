// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { countryside } from './scenery';
import { groundMaterial, surface } from './materials';
import { countrySky } from './sky';
import { tractor } from './tractor';
import { MotionClock, MotionTrack } from './motion';
import { createHuman, type HumanFigure } from './human';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight, distance } from '../shared/simulation';
import { vehicles, checkpoints } from '../shared/catalog';
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
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(53, 1, 0.1, 950);
  private land = new T.Group();
  private actors = new T.Group();
  private space = new T.Group();
  private terrain?: T.Mesh;
  private sun = new T.DirectionalLight(0xffe9bb, 3);
  private headlights = new T.SpotLight('#fff1b5', 45, 45, Math.PI / 5, 0.65, 1);
  private ambient = new T.HemisphereLight(0xb6cbd9, 0x7c8067, 1.1);
  private meshes = new Map<string, T.Group>();
  private motionClock = new MotionClock();
  private buildingMeshes: T.Group[] = [];
  private ball: T.Mesh;
  private projectiles = new T.Group();
  private lastWorld = '';
  private revision = '';
  private target = new T.Vector3();
  private elapsed = 0;
  private chase = 0;
  private smoke: T.Mesh[] = [];
  private smokesAt = 0;
  private stars: T.Points;
  private planets: T.Mesh[] = [];
  private lastTime = performance.now();
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
  private sky = countrySky();
  private water?: T.Mesh;
  private waterBase?: Float32Array;
  private low = localStorage.getItem('aclone.quality') === 'low';
  private software = false;
  private labelsHidden = false;
  zoom = 1;
  cameraMode = 0;
  orbit = 0;
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
    this.renderer.shadowMap.enabled = !low;
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
    this.scene.add(this.land, this.actors, this.space, this.sun, this.ambient, this.sky);
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
    this.scene.add(this.sun.target, this.headlights, this.headlights.target);
    this.ball = new T.Mesh(new T.IcosahedronGeometry(2.2, 1), material('#e8d4a5'));
    this.ball.castShadow = true;
    this.actors.add(this.ball, this.projectiles);
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
    let dragging = false,
      lastX = 0,
      moved = 0;
    this.renderer.domElement.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      moved = 0;
    });
    window.addEventListener('pointerup', () => (dragging = false));
    this.renderer.domElement.addEventListener('pointermove', (e) => {
      if (dragging) {
        this.orbit += (e.clientX - lastX) * 0.007;
        moved += Math.abs(e.clientX - lastX);
        lastX = e.clientX;
      }
    });
    this.renderer.domElement.addEventListener('click', (e) => {
      if (moved > 5 || !this.world) return;
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
    this.world = world;
    this.me = world.players[me];
    this.sky.visible = true;
    this.space.visible = false;
    this.land.visible = true;
    this.actors.visible = true;
    const rev =
      world.id +
      ':' +
      JSON.stringify(world.terrain) +
      ':' +
      world.buildings.map((b) => b.id + b.name + (b.construction ? 'c' : '')).join(',') +
      ':' +
      world.settings.seaLevel;
    if (this.revision !== rev) {
      this.revision = rev;
      this.buildWorld(world);
    }
    if (this.lastWorld !== world.id) {
      this.motionClock = new MotionClock();
      this.lastWorld = world.id;
      this.camera.position.set(this.me.x + 25, 30, this.me.z + 30);
      this.chase = this.me.heading;
    }
    const resetMotion = this.motionClock.receive(world.time, performance.now());
    for (const p of Object.values(world.players)) {
      let mesh = this.meshes.get(p.id);
      if (mesh && mesh.userData.vehicle !== p.vehicle) {
        this.actors.remove(mesh);
        dispose(mesh);
        this.meshes.delete(p.id);
        mesh = undefined;
      }
      if (!mesh) {
        mesh = this.vehicle(p.vehicle, p.id === me ? undefined : p.name);
        mesh.userData.vehicle = p.vehicle;
        mesh.position.set(p.x, p.y, p.z);
        this.meshes.set(p.id, mesh);
        this.actors.add(mesh);
      }
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
  }
  setSpace() {
    this.lastWorld = '';
    document.documentElement.classList.remove('scenery-view');
    this.sky.visible = false;
    this.headlights.visible = false;
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
    this.buildingMeshes = [];
    this.labelsHidden = false;
    this.renderer.shadowMap.needsUpdate = true;
    const geometry = new T.PlaneGeometry(540, 540, 128, 128);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(w, pos.getX(i), pos.getZ(i)));
    geometry.computeVertexNormals();
    this.terrain = new T.Mesh(geometry, groundMaterial(w.settings.seaLevel));
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
      const g = this.building(b);
      g.position.set(b.x, terrainHeight(w, b.x, b.z), b.z);
      g.rotation.y = b.rotation;
      g.userData.building = b.id;
      this.buildingMeshes.push(g);
      this.land.add(g);
    }
    for (let i = 0; i < 18; i++) {
      const x = -12,
        z = -65 + i * 9;
      if (i % 2 === 0) {
        const lamp = new T.Group();
        cylinder(lamp, 0.1, 5.5, '#353e38', 0, 2.75, 0, 10);
        cylinder(lamp, 0.21, 0.3, '#353e38', 0, 0.15, 0, 10);
        cylinder(lamp, 0.16, 0.15, '#353e38', 0, 5.35, 0, 10);
        box(lamp, 0.7, 0.1, 0.7, '#353e38', 0, 5.55, 0);
        const glass = box(lamp, 0.55, 0.8, 0.55, '#c9bf95', 0, 6, 0);
        glass.material.roughness = 0.25;
        glass.material.emissive.set('#956925');
        glass.material.emissiveIntensity = 0.25;
        for (const x of [-0.3, 0.3])
          for (const z of [-0.3, 0.3]) box(lamp, 0.06, 0.9, 0.06, '#353e38', x, 6, z);
        const cap = new T.Mesh(new T.ConeGeometry(0.56, 0.32, 4), material('#353e38'));
        cap.position.y = 6.58;
        cap.rotation.y = Math.PI / 4;
        lamp.add(cap);
        lamp.position.set(x, 0.2, z);
        this.land.add(lamp);
      }
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
    box(dock, 16, 0.5, 22, '#938060', 0, 0, 0);
    for (let i = -1; i <= 1; i++) box(dock, 0.4, 5, 0.4, '#705b43', i * 7, -2, 10);
    dock.position.set(20, 0.1, 151);
    const fishing = label('ANGLING · AMBITION OPTIONAL');
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
    const batches = new Map<string, { geometries: T.BufferGeometry[]; material: T.Material }>();
    const originals: T.Mesh[] = [];
    this.land.traverse((o) => {
      if (!(o instanceof T.Mesh) || o === this.terrain || Array.isArray(o.material)) return;
      const mat = o.material as T.MeshStandardMaterial;
      if (mat.transparent || mat.vertexColors || !(mat instanceof T.MeshStandardMaterial)) return;
      let parent: T.Object3D | null = o;
      while (parent) {
        if (parent.userData.blades) return;
        parent = parent.parent;
      }
      const key = [
        mat.color.getHexString(),
        mat.map?.uuid,
        mat.roughness,
        mat.metalness,
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
    countryside(this.land, w, this.low);
    for (const g of this.buildingMeshes) {
      const picker = new T.Mesh(new T.BoxGeometry(11, 9, 9), material('#ffffff'));
      picker.position.y = 4.5;
      picker.visible = false;
      g.add(picker);
    }
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
      return g;
    }
    const industrial = ['mill', 'forge', 'sawmill', 'quarry', 'factory', 'refinery'].includes(
      b.kind,
    );
    const base = b.government ? '#d9cfaa' : industrial ? '#b69778' : '#e0c9a2';
    const wall = box(g, 10, 5.5, 8, b.construction ? '#a2987b' : base, 0, 2.75, 0);
    if (!b.construction)
      surface(wall, 'stone', 4, b.kind === 'pub' ? '#f5ead8' : industrial ? '#b0a793' : '#e8dfc8');
    if (!b.construction) {
      box(g, 10.5, 0.55, 8.5, '#8f9180', 0, 0.28, 0);
      box(g, 10.4, 0.25, 8.4, '#eee0bd', 0, 5.45, 0);
      for (const x of [-4.85, 4.85])
        for (const z of [-3.9, 3.9]) box(g, 0.35, 5.2, 0.35, '#b8aa8b', x, 2.9, z);
      for (const x of [-3, 3]) {
        box(g, 2.5, 0.2, 0.65, '#e6d7b3', x, 2.1, 4.3);
        box(g, 2.5, 0.3, 0.65, '#7a694f', x, 1.8, 4.3);
        for (let i = 0; i < 5; i++) {
          cylinder(
            g,
            0.16,
            0.4,
            ['#edc165', '#c87568', '#d6d7aa'][i % 3],
            x - 0.8 + i * 0.4,
            2.15,
            4.35,
            5,
          );
        }
        for (const side of [-1, 1]) box(g, 0.42, 1.85, 0.18, '#52796d', x + side * 1.17, 3, 4.15);
        box(g, 1.9, 0.1, 0.2, '#e1d4ae', x, 3, 4.21);
      }
      box(g, 2.3, 0.25, 1.1, '#afa88e', 0, 0.2, 4.7);
      box(g, 0.13, 0.13, 0.16, '#edc270', 0.55, 1.6, 4.2);
      const roofShape = new T.Shape();
      roofShape.moveTo(-5.7, 0);
      roofShape.lineTo(0, 3.3);
      roofShape.lineTo(5.7, 0);
      roofShape.closePath();
      const roofGeometry = new T.ExtrudeGeometry(roofShape, { depth: 9, bevelEnabled: false });
      roofGeometry.translate(0, 0, -4.5);
      const roof = new T.Mesh(roofGeometry, material('#ffffff'));
      surface(roof, 'roof', 4, industrial ? '#a4b8bd' : '#ffffff');
      roof.position.y = 5.5;
      if (!industrial) {
        box(g, 0.8, 2.4, 0.8, '#ac8467', 3, 7.5, -2.2);
        box(g, 1, 0.25, 1, '#d2bc94', 3, 8.8, -2.2);
      }
      // Stone gables sit behind the slate eaves, with exposed ridge framing.
      for (const side of [-1, 1]) {
        const face = new T.Mesh(new T.ShapeGeometry(roofShape), material('#ffffff'));
        surface(face, 'stone', 4, '#ede1ca');
        face.position.set(0, 5.5, side * 4.51);
        if (side < 0) face.rotation.y = Math.PI;
        g.add(face);
        box(g, 0.18, 2.75, 0.16, '#594d3c', 0, 6.87, side * 4.59);
        box(g, 10.4, 0.18, 0.16, '#594d3c', 0, 5.65, side * 4.59);
        for (const x of [-2.5, 2.5]) {
          const beam = box(g, 0.18, 4.9, 0.16, '#594d3c', x, 6.96, side * 4.59);
          beam.rotation.z = x < 0 ? -1.04 : 1.04;
        }
      }
      roof.castShadow = true;
      g.add(roof);
      box(g, 1.8, 3, 0.15, '#4c5544', 0, 1.5, 4.05);
      for (const x of [-3, 3]) {
        const pane = box(g, 1.9, 1.6, 0.15, '#496266', x, 3, 4.06);
        pane.material.roughness = 0.2;
        pane.material.metalness = 0.25;
        box(g, 0.12, 1.6, 0.2, '#e1d4ae', x, 3, 4.2);
      }
      // Gable timber and roof ridge make each cottage read clearly at driving height.
      box(g, 0.25, 0.16, 9.15, '#67594b', 0, 8.86, 0);
      if (b.kind === 'shop' || b.kind === 'workhouse') {
        box(g, 6, 0.2, 2.4, '#748f6b', 0, 3.8, 5.1);
        for (const x of [-2.8, 2.8]) cylinder(g, 0.1, 3.8, '#67594b', x, 1.9, 6, 6);
      }
      if (industrial) {
        surface(cylinder(g, 0.7, 9, '#ffffff', 3, 7, -2, 12), 'stone', 3, '#918b7d');
        surface(box(g, 5, 3.4, 7, '#ffffff', 7, 1.7, 0), 'stone', 4, '#b4b0a0');
        const awning = box(g, 5.7, 0.2, 8, '#ffffff', 7, 3.6, 0);
        surface(awning, 'roof', 4);
        awning.rotation.z = -0.14;
        for (const x of [6, 8]) box(g, 1.3, 2.5, 0.13, '#555b4d', x, 1.3, 3.58);
      }
      if (b.kind === 'farm') {
        for (let i = 0; i < 6; i++) box(g, 18, 0.8, 1, '#bcac56', 12, 0.4, (i - 3) * 2);
      }
      if (b.kind === 'starport') {
        const ring = new T.Mesh(new T.TorusGeometry(5, 0.6, 6, 30), material('#678989'));
        ring.position.set(0, 11, 0);
        g.add(ring);
      }
      if (b.kind === 'pub') {
        box(g, 10.12, 0.3, 8.12, '#5c5442', 0, 3, 0);
        for (const x of [-4.8, 0, 4.8]) box(g, 0.3, 5.5, 8.1, '#5c5442', x, 2.75, 0);
      }
    } else
      for (const x of [-6, 6]) for (const z of [-5, 5]) box(g, 0.25, 9, 0.25, '#a98456', x, 4.5, z);
    const sign = label(b.name, b.construction ? '#e7b36b' : '#e5ddbe', 0.85);
    sign.position.set(0, 10, 0);
    g.add(sign);
    return g;
  }
  private vehicle(slot: number, name?: string) {
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
      const body = new T.Mesh(new T.OctahedronGeometry(1.2), material('#768b8d'));
      g.add(body);
      box(g, 4, 0.1, 1, '#555f65', 0, 0, 0);
    } else {
      tractor(g, v.color);
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
    if (!this.low && !this.paused && localStorage.getItem('aclone.quality') !== 'high') {
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
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.elapsed += dt;
    if (this.world && this.me) {
      const w = this.world,
        p = this.me;
      const motionTime = this.motionClock.sample(now);
      for (const mesh of this.meshes.values()) {
        const pose = (mesh.userData.motion as MotionTrack).sample(motionTime)!;
        const travel =
          (pose.x - mesh.position.x) * Math.sin(pose.heading) +
          (pose.z - mesh.position.z) * Math.cos(pose.heading);
        mesh.position.set(pose.x, pose.y, pose.z);
        mesh.rotation.y = pose.heading;
        for (const wheel of (mesh.userData.wheels ?? []) as T.Group[]) wheel.rotation.x += travel;
        (mesh.userData.human as HumanFigure | undefined)?.animate(travel, dt);
        // Keep the player's own face/driver out of the first-person camera.
        const occupant =
          (mesh.userData.human as HumanFigure | undefined)?.group ?? mesh.userData.driver;
        if (occupant) occupant.visible = mesh !== this.meshes.get(p.id) || this.cameraMode !== 1;
      }
      this.headlights.visible = p.lights;
      const local = this.meshes.get(p.id);
      if (local) {
        const pos = local.position;
        const facing = local.rotation.y;
        this.headlights.position.set(pos.x, pos.y + 2, pos.z);
        this.headlights.target.position.set(
          pos.x + Math.sin(facing) * 20,
          pos.y,
          pos.z + Math.cos(facing) * 20,
        );
        this.target.copy(pos);
        const walking = p.vehicle === 5;
        this.target.y += walking ? 1.25 : 1.6;
        let diff = facing - this.chase;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.chase += diff * (1 - Math.exp(-dt * 3));
        if (local.userData.snapCamera) this.chase = facing;
        const heading = this.chase + this.orbit;
        const cam =
          this.cameraMode === 1
            ? new T.Vector3(pos.x, pos.y + (walking ? 1.68 : 3), pos.z)
            : this.cameraMode === 2 || p.vehicle === 7
              ? new T.Vector3(pos.x, pos.y + 65 * this.zoom, pos.z + 3)
              : new T.Vector3(
                  pos.x - Math.sin(heading) * (walking ? 6 : 21) * this.zoom,
                  pos.y + (walking ? 3 : 8.5) * this.zoom,
                  pos.z - Math.cos(heading) * (walking ? 6 : 21) * this.zoom,
                );
        cam.y = Math.max(cam.y, terrainHeight(w, cam.x, cam.z) + (walking ? 0.6 : 3));
        if (local.userData.snapCamera || this.cameraMode === 1) this.camera.position.copy(cam);
        else this.camera.position.lerp(cam, 1 - Math.exp(-dt * 4));
        local.userData.snapCamera = false;
        if (this.cameraMode === 1)
          this.target.add(new T.Vector3(Math.sin(facing) * 30, 0, Math.cos(facing) * 30));
        this.camera.lookAt(this.target);
        if (p.vehicle === 0 && Math.abs(p.speed) > 1 && this.elapsed - this.smokesAt > 0.18) {
          this.smokesAt = this.elapsed;
          const puff = new T.Mesh(
            new T.IcosahedronGeometry(0.35, 0),
            new T.MeshBasicMaterial({ color: '#c3c0a8', transparent: true, opacity: 0.4 }),
          );
          puff.position.copy(pos).add(new T.Vector3(0, 3.5, 0));
          puff.userData.life = 2;
          this.smoke.push(puff);
          this.actors.add(puff);
        }
      }
      for (const s of this.smoke) {
        s.userData.life -= dt;
        s.position.y += dt * 1.6;
        s.scale.multiplyScalar(1 + dt);
        (s.material as T.MeshBasicMaterial).opacity = s.userData.life * 0.2;
        if (s.userData.life < 0) {
          this.actors.remove(s);
          dispose(s);
        }
      }
      this.smoke = this.smoke.filter((s) => s.userData.life > 0);
      const daylight =
        0.3 + Math.max(0, Math.sin((w.settings.time / 86400) * Math.PI * 2 - Math.PI / 2)) * 0.7;
      this.sun.intensity = daylight * 3;
      this.ambient.intensity = 0.45 + daylight * 1.05;
      const sky = new T.Color('#d0dddf').multiplyScalar(0.35 + daylight * 0.65);
      this.sky.position.copy(this.camera.position);
      this.sky.material.uniforms.horizon.value.copy(sky);
      this.sky.material.uniforms.zenith.value.set('#458fc2').multiplyScalar(0.25 + daylight * 0.75);
      this.sky.material.uniforms.daylight.value = daylight;
      this.scene.background = sky;
      this.scene.fog = new T.Fog(sky, 125, 450);
      this.sun.position.set(p.x - 80, 70, p.z + 50);
      this.sun.target.position.set(p.x, 0, p.z);
      if (
        now - this.shadowTime > 200 &&
        (this.shadowPosition.distanceTo(new T.Vector3(p.x, p.y, p.z)) > 0.2 ||
          Object.values(w.players).some((q) => Math.abs(q.speed) > 0.1))
      ) {
        this.renderer.shadowMap.needsUpdate = true;
        this.shadowTime = now;
        this.shadowPosition.set(p.x, p.y, p.z);
      }
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
        dispose(this.projectiles);
        this.projectiles.clear();
        for (const shot of w.projectiles) {
          const m = new T.Mesh(
            new T.IcosahedronGeometry(0.6, 0),
            new T.MeshBasicMaterial({ color: '#ffbc68' }),
          );
          m.position.set(shot.x, shot.y, shot.z);
          this.projectiles.add(m);
        }
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
    this.renderer.render(this.scene, this.camera);
    this.renderer.domElement.dataset.drawCalls = String(this.renderer.info.render.calls);
    this.renderer.domElement.dataset.triangles = String(this.renderer.info.render.triangles);
  }
  nearest() {
    if (!this.world || !this.me) return undefined;
    return this.world.buildings
      .filter((b) => distance(b, this.me!) < 18)
      .sort((a, b) => distance(a, this.me!) - distance(b, this.me!))[0];
  }
}
function dispose(root: T.Object3D) {
  root.traverse((o) => {
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
