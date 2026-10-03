// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { spaceportApron, spaceportHardware, spaceportScale } from '../shared/building-shapes';

let hullTexture: T.DataTexture | undefined;
/** Subtle brushed metal and runoff streaks, generated once without a canvas or asset download. */
function metalWeathering() {
  if (hullTexture) return hullTexture;
  const width = 128,
    height = 256;
  const data = new Uint8Array(width * height * 4);
  let seed = 713;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const streaks = Array.from({ length: width }, () => noise());
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const runoff = Math.max(0, streaks[x] - 0.65) * 40 * (0.5 + 0.5 * Math.cos(y / 28));
      const shade = Math.round(247 - noise() * 8 - runoff);
      const offset = (y * width + x) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = shade;
      data[offset + 3] = 255;
    }
  hullTexture = new T.DataTexture(data, width, height);
  hullTexture.colorSpace = T.SRGBColorSpace;
  hullTexture.wrapS = hullTexture.wrapT = T.RepeatWrapping;
  hullTexture.magFilter = T.LinearFilter;
  hullTexture.minFilter = T.LinearMipmapLinearFilter;
  hullTexture.generateMipmaps = true;
  hullTexture.needsUpdate = true;
  return hullTexture;
}

/** Original metre-scale cargo launcher and ground equipment. All geometry is static,
 * opaque and batchable; no extra lights, downloads or per-frame machinery updates. */
export function spaceportModel() {
  const root = new T.Group();
  root.name = 'Spaceport landing apron';
  root.scale.setScalar(spaceportScale);
  const colors = {
    shell: '#aaaead',
    paint: '#c4c3b9',
    panel: '#969d9e',
    steel: '#69777b',
    dark: '#30373a',
    tile: '#484a49',
    pad: '#72736e',
    seam: '#555953',
    yellow: '#b89a55',
    pipe: '#887b68',
  };
  type Finish = keyof typeof colors;
  const materials = Object.fromEntries(
    Object.entries(colors).map(([key, color]) => [
      key,
      new T.MeshStandardMaterial({
        color,
        map: ['shell', 'paint', 'panel'].includes(key) ? metalWeathering() : null,
        roughness: key === 'pad' || key === 'tile' ? 0.96 : key === 'paint' ? 0.7 : 0.48,
        metalness: ['shell', 'steel', 'pipe', 'panel'].includes(key) ? 0.55 : 0.08,
      }),
    ]),
  ) as Record<Finish, T.MeshStandardMaterial>;
  const beacon = new T.MeshStandardMaterial({ color: '#efca75', emissive: '#b68e41' });
  let parent = root;
  const mesh = (
    g: T.BufferGeometry,
    finish: Finish | T.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new T.Mesh(g, typeof finish === 'string' ? materials[finish] : finish);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, finish: Finish, x: number, y: number, z: number) =>
    mesh(new T.BoxGeometry(w, h, d), finish, x, y, z);
  const cylinder = (
    top: number,
    bottom: number,
    h: number,
    finish: Finish,
    x: number,
    y: number,
    z: number,
    segments = 48,
  ) => mesh(new T.CylinderGeometry(top, bottom, h, segments), finish, x, y, z);
  const strut = (a: T.Vector3, b: T.Vector3, radius: number, finish: Finish) => {
    const m = mesh(new T.CylinderGeometry(radius, radius, a.distanceTo(b), 8), finish, 0, 0, 0);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };
  const ring = (r: number, y: number, tube: number, finish: Finish, x: number, z: number) => {
    const m = mesh(new T.TorusGeometry(r, tube, 4, 48), finish, x, y, z);
    m.rotation.x = Math.PI / 2;
  };
  const lathe = (points: number[][], finish: Finish, x: number, z: number) =>
    mesh(
      new T.LatheGeometry(
        points.map(([r, y]) => new T.Vector2(r, y)),
        48,
      ),
      finish,
      x,
      0,
      z,
    );
  const x = spaceportApron.x / spaceportScale,
    z = spaceportApron.z / spaceportScale,
    radius = spaceportApron.radius / spaceportScale;
  cylinder(radius, radius, 0.18, 'pad', x, 0.09, z, 80);
  // Concrete expansion joints, a scorched blast plate and a restrained safety boundary.
  for (let d = -8; d <= 8; d += 4) {
    const length = 2 * Math.sqrt(radius * radius - d * d);
    box(length, 0.012, 0.045, 'seam', x, 0.187, z + d);
    box(0.045, 0.012, length, 'seam', x + d, 0.187, z);
  }
  cylinder(4.5, 4.5, 0.025, 'dark', x, 0.202, z);
  const boundary = mesh(new T.RingGeometry(8.7, 8.8, 80), 'paint', x, 0.205, z);
  boundary.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 32; i++) {
    const angle = (i * Math.PI) / 16;
    const mark = box(
      0.18,
      0.025,
      0.55,
      i % 2 ? 'dark' : 'yellow',
      x + Math.sin(angle) * 9.3,
      0.2,
      z + Math.cos(angle) * 9.3,
    );
    mark.rotation.y = angle;
    if (i % 4 === 0) {
      cylinder(
        0.16,
        0.22,
        0.16,
        'dark',
        x + Math.sin(angle) * 9.6,
        0.26,
        z + Math.cos(angle) * 9.6,
        8,
      );
      mesh(
        new T.BoxGeometry(0.17, 0.06, 0.17),
        beacon,
        x + Math.sin(angle) * 9.6,
        0.37,
        z + Math.cos(angle) * 9.6,
      );
    }
  }

  const rocket = new T.Group();
  rocket.name = 'Cargo rocket';
  root.add(rocket);
  parent = rocket;
  // A cylindrical tank stack, structural interstage and blunt cargo fairing. The
  // load-bearing core stays balanced; external systems create purposeful asymmetry.
  cylinder(2.7, 2.45, 2.3, 'dark', x, 4.15, z);
  cylinder(2.7, 2.7, 14.2, 'shell', x, 12.4, z);
  cylinder(2.72, 2.72, 1.3, 'dark', x, 20.15, z);
  cylinder(2.75, 2.72, 1.2, 'panel', x, 21.4, z);
  lathe(
    [
      [2.75, 22],
      [2.9, 23],
      [2.9, 27.2],
      [2.75, 28.4],
      [2.35, 29.6],
      [1.65, 30.8],
      [0.8, 31.7],
      [0.25, 32],
      [0, 32.04],
    ],
    'paint',
    x,
    z,
  );
  for (const y of [5.4, 7.6, 9.8, 12, 14.2, 16.4, 18.6, 19.5, 20.8, 22, 24.8, 27.2])
    ring(y > 23 ? 2.905 : 2.715, y, 0.025, 'steel', x, z);
  // Longitudinal welds, fastened interstage ribs and individual removable panels.
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const px = x + Math.sin(a) * 2.72,
      pz = z + Math.cos(a) * 2.72;
    const rib = box(0.035, 14.1, 0.025, 'panel', px, 12.4, pz);
    rib.rotation.y = a;
    const beam = box(0.12, 1.16, 0.09, 'steel', px, 20.15, pz);
    beam.rotation.y = a;
    for (const y of [5.6, 19.25, 21.8]) {
      const bolt = box(0.09, 0.09, 0.06, 'steel', px, y, pz);
      bolt.rotation.y = a;
    }
  }
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 5; col++) {
      const a = -1.45 + col * 0.19;
      const tile = box(
        0.48,
        0.75,
        0.045,
        (row + col) % 4 === 0 ? 'dark' : 'tile',
        x + Math.sin(a) * 2.92,
        23.5 + row * 0.81,
        z + Math.cos(a) * 2.92,
      );
      tile.rotation.y = a;
    }
  }
  // Offset equipment spine, two insulated feed pipes and their support brackets.
  box(0.65, 10.8, 0.45, 'panel', x + 2.12, 12, z + 1.82);
  for (const dx of [1.45, 1.76]) {
    cylinder(0.095, 0.095, 14, 'pipe', x + dx, 12.4, z + 2.36, 12);
    for (const y of [6, 9, 12, 15, 18]) ring(0.12, y, 0.035, 'dark', x + dx, z + 2.36);
  }
  box(0.95, 2.7, 0.6, 'steel', x + 0.8, 7.5, z + 2.67);
  for (let i = 0; i < 9; i++) box(0.77, 0.07, 0.065, 'dark', x + 0.8, 6.5 + i * 0.25, z + 3);
  // Human-sized access hatch, hinges and short maintenance steps; no giant portholes.
  const accessStart = rocket.children.length;
  box(1.24, 2.23, 0.15, 'dark', x, 24.15, z + 2.9);
  box(1.02, 2.02, 0.16, 'panel', x, 24.15, z + 3).name = 'Crew access hatch';
  for (const y of [23.6, 24.6]) box(0.18, 0.24, 0.13, 'steel', x - 0.55, y, z + 3.13);
  box(0.22, 0.055, 0.08, 'dark', x + 0.28, 24.1, z + 3.13);
  for (let y = 21.5; y <= 23; y += 0.32) box(0.48, 0.045, 0.2, 'steel', x, y, z + 2.91);
  // Keep crew equipment human-sized even though the cargo launch vehicle grew.
  const access = new T.Group();
  const anchor = new T.Vector3(x, 24.15, z + 2.9);
  for (const child of rocket.children.slice(accessStart)) {
    child.position.sub(anchor);
    access.add(child);
  }
  access.position.copy(anchor);
  access.scale.setScalar(1 / spaceportScale);
  rocket.add(access);
  // Unequal service covers and vertical identification bars break up the fairing.
  box(0.8, 1.2, 0.1, 'shell', x + 1.35, 26.8, z + 2.61).rotation.y = 0.47;
  for (const [dx, h] of [
    [-0.5, 1.3],
    [-0.18, 0.75],
    [0.14, 1],
    [0.46, 0.55],
  ])
    box(0.12, h, 0.05, 'dark', x + dx, 28.1, z + 2.8);

  // Five open engine bells, each with a throat, cooling ribs and feed hardware.
  for (const [dx, dz] of [
    [0, 0],
    [-1.3, -1.3],
    [1.3, -1.3],
    [-1.3, 1.3],
    [1.3, 1.3],
  ]) {
    lathe(
      [
        [0.35, 3.1],
        [0.26, 2.8],
        [0.34, 2.45],
        [0.56, 1.95],
        [0.83, 1.45],
        [0.77, 1.45],
        [0.49, 2.05],
        [0.2, 2.8],
      ],
      'steel',
      x + dx,
      z + dz,
    );
    cylinder(0.2, 0.2, 0.04, 'dark', x + dx, 2.8, z + dz, 16);
    for (const [r, y] of [
      [0.81, 1.5],
      [0.65, 1.8],
      [0.47, 2.2],
    ])
      ring(r, y, 0.035, 'pipe', x + dx, z + dz);
    cylinder(0.12, 0.12, 1.4, 'pipe', x + dx + 0.37, 3.05, z + dz, 10);
  }
  // Braced hydraulic landing gear, not decorative fins. Flat pads spread the load.
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const point = (r: number, y: number) =>
      new T.Vector3(x + Math.sin(a) * r, y, z + Math.cos(a) * r);
    strut(point(2.5, 6.4), point(5, 0.65), 0.19, 'steel');
    strut(point(2.45, 3.6), point(5, 0.65), 0.12, 'shell');
    strut(point(2.65, 5), point(4.4, 1.9), 0.24, 'dark');
    const foot = point(5, 0.35);
    box(1.5, 0.28, 1.35, 'dark', foot.x, foot.y, foot.z).rotation.y = a;
    const joint = point(2.5, 6.4);
    box(0.6, 0.75, 0.55, 'steel', joint.x, joint.y, joint.z).rotation.y = a;
  }

  parent = root;
  const tower = {
    x: spaceportHardware.tower.x / spaceportScale,
    z: spaceportHardware.tower.z / spaceportScale,
    height: spaceportHardware.tower.height / spaceportScale,
  };
  const tank = {
    x: spaceportHardware.tank.x / spaceportScale,
    z: spaceportHardware.tank.z / spaceportScale,
  };
  // One side-mounted steel service tower: open trusswork, grated platforms and
  // handrails. Its offset silhouette is deliberately different from the rocket.
  for (const dx of [-1.2, 1.2])
    for (const dz of [-1.2, 1.2]) {
      box(0.22, tower.height, 0.22, 'steel', tower.x + dx, tower.height / 2, tower.z + dz);
      box(0.8, 0.3, 0.8, 'pad', tower.x + dx, 0.15, tower.z + dz);
    }
  for (let y = 1; y < 25; y += 4) {
    for (const side of [-1.2, 1.2]) {
      strut(
        new T.Vector3(tower.x - 1.2, y, tower.z + side),
        new T.Vector3(tower.x + 1.2, y + 4, tower.z + side),
        0.085,
        'steel',
      );
      strut(
        new T.Vector3(tower.x + side, y, tower.z - 1.2),
        new T.Vector3(tower.x + side, y + 4, tower.z + 1.2),
        0.085,
        'steel',
      );
    }
    box(2.6, 0.12, 2.6, 'dark', tower.x, y, tower.z);
    for (const dx of [-1.2, 1.2]) {
      box(0.05, 1.1, 0.05, 'yellow', tower.x + dx, y + 0.55, tower.z + 1.2);
      box(0.045, 0.045, 2.5, 'yellow', tower.x + dx, y + 1.1, tower.z);
    }
    box(2.5, 0.045, 0.045, 'yellow', tower.x, y + 1.1, tower.z + 1.2);
  }
  // Lift cage, counterweight guide, and an offset cable tray instead of solid walls.
  box(1.4, 2.3, 1.3, 'panel', tower.x, 13.25, tower.z);
  for (const dx of [-0.85, 0.85]) box(0.08, 25, 0.08, 'dark', tower.x + dx, 12.5, tower.z);
  box(0.45, 23, 0.25, 'pipe', tower.x + 1.4, 11.5, tower.z);
  for (const y of [8, 18, 23.1]) {
    const a = new T.Vector3(tower.x, y, tower.z + 1);
    const b = new T.Vector3(x + 2, y, z - 1.6);
    strut(a, b, 0.18, 'steel');
    strut(
      a.clone().add(new T.Vector3(0, 0.8, 0)),
      b.clone().add(new T.Vector3(0, 0.8, 0)),
      0.065,
      'yellow',
    );
  }
  mesh(new T.BoxGeometry(0.2, 0.22, 0.2), beacon, tower.x, tower.height + 0.15, tower.z);
  // Ground-side cryogenic tank and pump cabinet, deliberately on only one flank.
  cylinder(1, 1, 3.5, 'paint', tank.x, 2.3, tank.z, 32);
  const cap = mesh(new T.SphereGeometry(1, 24, 12), 'paint', tank.x, 4.05, tank.z);
  cap.scale.y = 0.45;
  for (const y of [0.6, 2, 3.7]) ring(1.02, y, 0.06, 'steel', tank.x, tank.z);
  for (const dz of [-0.7, 0.7]) box(1.4, 0.55, 0.14, 'steel', tank.x, 0.28, tank.z + dz);
  box(1.3, 1.5, 1.1, 'panel', tank.x, 0.9, tank.z + 2);
  for (let i = 0; i < 6; i++) box(0.9, 0.06, 0.025, 'dark', tank.x, 0.6 + i * 0.15, tank.z + 2.56);
  strut(new T.Vector3(tank.x, 0.6, tank.z), new T.Vector3(x + 2.8, 0.6, z + 1), 0.13, 'pipe');
  return root;
}
