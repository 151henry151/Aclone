// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight, distance } from '../shared/simulation';
import { vehicles, checkpoints } from '../shared/catalog';
import type { World, Player, Building } from '../shared/types';
const material = (color: T.ColorRepresentation) =>
  new T.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
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
  private ambient = new T.HemisphereLight(0xdfe7d5, 0x536440, 2.1);
  private meshes = new Map<string, T.Group>();
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
  private world?: World;
  private me?: Player;
  paused = false;
  private low = localStorage.getItem('aclone.quality') === 'low';
  zoom = 1;
  cameraMode = 0;
  orbit = 0;
  onBuilding?: (id: string) => void;
  constructor(private container: HTMLElement) {
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    const low = localStorage.getItem('aclone.quality') === 'low';
    this.renderer.setPixelRatio(low ? 0.65 : Math.min(devicePixelRatio, 1.4));
    this.renderer.shadowMap.enabled = !low;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.setClearColor('#a5b4a0');
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Aclone 3D world. Use arrow keys to drive.',
    );
    this.scene.add(this.land, this.actors, this.space, this.sun, this.ambient);
    this.sun.position.set(-60, 110, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -120,
      right: 120,
      top: 120,
      bottom: -120,
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
      this.lastWorld = world.id;
      this.camera.position.set(this.me.x + 25, 30, this.me.z + 30);
      this.chase = this.me.heading;
    }
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
      mesh.userData.player = p;
    }
    for (const [id, mesh] of this.meshes)
      if (!world.players[id]) {
        this.actors.remove(mesh);
        dispose(mesh);
        this.meshes.delete(id);
      }
  }
  setSpace() {
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
    const geometry = new T.PlaneGeometry(540, 540, 128, 128);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position,
      colors: number[] = [];
    const c = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i),
        h = terrainHeight(w, x, z);
      pos.setY(i, h);
      c.set(h < w.settings.seaLevel + 0.8 ? '#b5aa7b' : h > 8 ? '#6c7955' : '#83915b');
      c.multiplyScalar(0.94 + 0.08 * Math.sin(i * 1.71));
      colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    this.terrain = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    );
    this.terrain.receiveShadow = true;
    this.land.add(this.terrain);
    const sea = new T.Mesh(
      new T.PlaneGeometry(540, 540),
      new T.MeshStandardMaterial({
        color: '#668e8c',
        roughness: 0.35,
        metalness: 0.2,
        transparent: true,
        opacity: 0.86,
      }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = w.settings.seaLevel;
    this.land.add(sea);
    const road = (x: number, z: number, width: number, depth: number) => {
      const m = new T.Mesh(new T.PlaneGeometry(width, depth), material('#b4a57c'));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.24, z);
      m.receiveShadow = true;
      this.land.add(m);
    };
    road(0, 30, 12, 175);
    road(0, 10, 120, 11);
    road(0, -36, 80, 9);
    road(-40, 60, 75, 8);
    road(35, 50, 9, 90);
    road(52, 45, 82, 7);
    const green = new T.Mesh(new T.CylinderGeometry(13, 13, 0.15, 40), material('#6f854f'));
    green.position.set(0, 0.35, 0);
    this.land.add(green);
    for (const b of w.buildings) {
      const g = this.building(b);
      g.position.set(b.x, terrainHeight(w, b.x, b.z), b.z);
      g.rotation.y = b.rotation;
      g.userData.building = b.id;
      this.buildingMeshes.push(g);
      this.land.add(g);
    }
    for (let i = 0; i < 145; i++) {
      const x = Math.sin(i * 74.77) * 230,
        z = Math.cos(i * 42.8) * 225;
      if ((Math.abs(x) < 125 && Math.abs(z) < 115) || terrainHeight(w, x, z) < w.settings.seaLevel)
        continue;
      const g = new T.Group(),
        h = 4 + (i % 5);
      cylinder(g, 0.35, h, '#6c5940', 0, h / 2, 0, 5);
      const leaves = new T.Mesh(
        new T.ConeGeometry(2.3 + (i % 3), h, 6),
        material(['#506342', '#677344', '#7b804d'][i % 3]),
      );
      leaves.position.y = h + 1;
      leaves.castShadow = true;
      g.add(leaves);
      g.position.set(x, terrainHeight(w, x, z), z);
      this.land.add(g);
    }
    for (let i = 0; i < 18; i++) {
      const x = -12,
        z = -65 + i * 9;
      if (i % 2 === 0) {
        const lamp = new T.Group();
        cylinder(lamp, 0.12, 6, '#424b3d', 0, 3, 0);
        box(lamp, 1, 0.5, 1, '#f5d995', 0, 6, 0);
        lamp.position.set(x, 0.2, z);
        this.land.add(lamp);
      }
    }
    const pitch = new T.Mesh(new T.PlaneGeometry(60, 50), material('#69894f'));
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
      const key = mat.color.getHexString();
      const batch = batches.get(key) ?? { geometries: [], material: mat.clone() };
      batch.geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
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
      cylinder(g, 4, 0.7, '#b8ad8b', 0, 0.35, 0, 20);
      cylinder(g, 1, 4, '#b0ac96', 0, 2.6, 0, 6);
      box(g, 1.5, 1.5, 1.5, '#d8d0ad', 0, 5, 0);
      return g;
    }
    const industrial = ['mill', 'forge', 'sawmill', 'quarry', 'factory', 'refinery'].includes(
      b.kind,
    );
    const base = b.government ? '#d9cfaa' : industrial ? '#b69778' : '#e0c9a2';
    box(g, 10, 5.5, 8, b.construction ? '#a2987b' : base, 0, 2.75, 0);
    if (!b.construction) {
      const roof = new T.Mesh(
        new T.ConeGeometry(7.5, 3.5, 4),
        material(industrial ? '#6c7770' : '#885343'),
      );
      roof.rotation.y = Math.PI / 4;
      roof.scale.z = 0.86;
      roof.position.y = 7;
      roof.castShadow = true;
      g.add(roof);
      box(g, 1.8, 3, 0.15, '#4c5544', 0, 1.5, 4.05);
      for (const x of [-3, 3]) {
        box(g, 1.9, 1.6, 0.15, '#64817d', x, 3, 4.06);
        box(g, 0.12, 1.6, 0.2, '#e1d4ae', x, 3, 4.2);
      }
      if (industrial) cylinder(g, 0.7, 9, '#8d7360', 3, 7, -2, 8);
      if (b.kind === 'farm') {
        for (let i = 0; i < 6; i++) box(g, 18, 0.8, 1, '#bcac56', 12, 0.4, (i - 3) * 2);
      }
      if (b.kind === 'starport') {
        const ring = new T.Mesh(new T.TorusGeometry(5, 0.6, 6, 30), material('#678989'));
        ring.position.set(0, 11, 0);
        g.add(ring);
      }
      if (b.kind === 'pub') {
        box(g, 10, 0.3, 8.1, '#5c5442', 0, 3, 0);
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
    if (slot === 5 || slot === 6) {
      const ostrich = slot === 6;
      cylinder(g, 0.22, 1.5, '#bd9971', -0.45, 0.8, 0, 5);
      cylinder(g, 0.22, 1.5, '#bd9971', 0.45, 0.8, 0, 5);
      const body = new T.Mesh(
        new T.IcosahedronGeometry(ostrich ? 1.2 : 0.7, 1),
        material(ostrich ? '#403f39' : '#5d7790'),
      );
      body.position.y = 2;
      g.add(body);
      cylinder(g, 0.2, ostrich ? 2 : 0.5, '#d7c5a1', 0, ostrich ? 3.2 : 2.6, 0.4, 5);
      box(g, 0.6, 0.6, 0.7, '#d7c5a1', 0, ostrich ? 4.2 : 3, 0.4);
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
      box(g, 2.1, 0.65, 3.8, '#424b3f', 0, 1.1, 0);
      box(g, 1.7, 1.25, 2.1, v.color, 0, 1.7, 1);
      box(g, 2.2, 0.3, 1.8, v.color, 0, 3.5, -0.8);
      box(g, 0.4, 1, 0.4, '#373f36', -0.65, 2.9, 1.3);
      box(g, 1.4, 1.4, 0.2, '#799294', 0, 2.5, -1.45);
      box(g, 0.7, 0.6, 0.7, '#d6b794', 0, 2.7, -0.65);
      box(g, 1.9, 0.5, 0.2, '#ddddbb', 0, 1.7, 2.1);
      for (const x of [-1.3, 1.3])
        for (const z of [-1.1, 1.3]) {
          const wheel = new T.Mesh(
            new T.CylinderGeometry(z < 0 ? 1 : 0.66, z < 0 ? 1 : 0.66, 0.65, 12),
            material('#31382f'),
          );
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(x, z < 0 ? 1 : 0.75, z);
          wheel.castShadow = true;
          g.add(wheel);
          const hub = new T.Mesh(new T.CylinderGeometry(0.36, 0.36, 0.68, 10), material('#c6b992'));
          hub.rotation.z = Math.PI / 2;
          hub.position.copy(wheel.position);
          g.add(hub);
        }
      if (v.mode === 5) box(g, 4, 0.6, 5, '#454d42', 0, 0.4, 0);
    }
    if (name) {
      const tag = label(name, '#f5dc9d', 0.65);
      tag.position.y = 6;
      g.add(tag);
    }
    return g;
  }
  private frame() {
    const now = performance.now();
    if (now - this.renderTime < (this.paused ? 250 : this.low ? 100 : 33)) return;
    this.renderTime = now;
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.elapsed += dt;
    if (this.world && this.me) {
      const w = this.world,
        p = this.me;
      for (const mesh of this.meshes.values()) {
        const player = mesh.userData.player as Player;
        mesh.position.lerp(new T.Vector3(player.x, player.y + 0.2, player.z), Math.min(1, dt * 12));
        let diff = player.heading - mesh.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        mesh.rotation.y += diff * Math.min(1, dt * 12);
      }
      this.headlights.visible = p.lights;
      this.headlights.position.set(p.x, p.y + 2, p.z);
      this.headlights.target.position.set(
        p.x + Math.sin(p.heading) * 20,
        p.y,
        p.z + Math.cos(p.heading) * 20,
      );
      const local = this.meshes.get(p.id);
      if (local) {
        const pos = local.position;
        this.target.copy(pos);
        this.target.y += 1.6;
        let diff = p.heading - this.chase;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.chase += diff * dt * 3;
        const heading = this.chase + this.orbit;
        const cam =
          this.cameraMode === 1
            ? new T.Vector3(pos.x, pos.y + 3, pos.z)
            : this.cameraMode === 2 || p.vehicle === 7
              ? new T.Vector3(pos.x, pos.y + 65 * this.zoom, pos.z + 3)
              : new T.Vector3(
                  pos.x - Math.sin(heading) * 23 * this.zoom,
                  pos.y + 13 * this.zoom,
                  pos.z - Math.cos(heading) * 23 * this.zoom,
                );
        cam.y = Math.max(cam.y, terrainHeight(w, cam.x, cam.z) + 3);
        this.camera.position.lerp(cam, dt * 4);
        if (this.cameraMode === 1)
          this.target.add(new T.Vector3(Math.sin(p.heading) * 30, 0, Math.cos(p.heading) * 30));
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
      this.ambient.intensity = 0.6 + daylight * 1.5;
      const sky = new T.Color('#a5b4a0').multiplyScalar(0.35 + daylight * 0.65);
      this.scene.background = sky;
      this.scene.fog = new T.Fog(sky, 130, 460);
      this.sun.position.set(p.x - 80, 110, p.z + 50);
      this.sun.target.position.set(p.x, 0, p.z);
      this.ball.position.set(
        w.ball.x,
        2.5 +
          Math.abs(Math.sin(this.elapsed * 2)) *
            Math.min(1, Math.hypot(w.ball.vx, w.ball.vz) * 0.1),
        w.ball.z,
      );
      this.ball.rotation.x += dt * w.ball.vz * 0.1;
      this.ball.rotation.z -= dt * w.ball.vx * 0.1;
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
      for (const g of this.buildingMeshes)
        for (const child of g.children)
          if (child instanceof T.Sprite) child.visible = distance(p, g.position) < 55;
      for (const obj of this.land.children)
        if (obj.userData.blades) obj.userData.blades.rotation.z += dt * 0.35;
    } else {
      this.stars.rotation.y += dt * 0.008;
      for (const p of this.planets) p.rotation.y += dt * 0.06;
    }
    this.renderer.render(this.scene, this.camera);
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
      if ('geometry' in o) o.geometry?.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m && 'map' in m) (m.map as T.Texture | undefined)?.dispose();
        m?.dispose();
      }
    }
  });
}
