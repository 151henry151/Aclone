// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  spaceportPoint,
  spaceportStructures,
  spaceportYardProps,
  spaceportGateRequested,
  SPACEPORT_PARKING,
} from '../shared/spaceport-site';
import type { FacilityLight } from './lighting';
import { spaceportPavingModel } from './spaceport-paving';
import { terrainHeight } from '../shared/terrain';
import type { World } from '../shared/types';

/** Static scenery is batched per installation, so distant buildings cull independently. */
export function spaceportComplex(w: World) {
  const site = w.spaceportSite!,
    root = new T.Group();
  root.name = 'Launch facility';
  const palette = {
    wall: '#c0c6c3',
    roof: '#758588',
    blue: '#284d5b',
    dark: '#202c31',
    glass: '#497985',
    metal: '#9ea8a5',
    yellow: '#d4a344',
    red: '#ab4433',
    concrete: '#85867e',
    rubber: '#25282a',
    white: '#e6e3cf',
    rust: '#a45b3b',
    green: '#547265',
    wood: '#a99063',
  };
  const materials = Object.fromEntries(
    Object.entries(palette).map(([k, color]) => [
      k,
      new T.MeshStandardMaterial({
        color,
        roughness: k === 'glass' ? 0.23 : 0.78,
        metalness: k === 'metal' ? 0.65 : 0.12,
      }),
    ]),
  ) as Record<keyof typeof palette, T.MeshStandardMaterial>;
  type Finish = keyof typeof palette;
  let parent: T.Group = root;
  function mesh(g: T.BufferGeometry, finish: Finish, x: number, y: number, z: number) {
    const m = new T.Mesh(g, materials[finish]);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (
    width: number,
    height: number,
    depth: number,
    f: Finish,
    x: number,
    y: number,
    z: number,
  ) => mesh(new T.BoxGeometry(width, height, depth), f, x, y, z);
  const cyl = (r: number, h: number, f: Finish, x: number, y: number, z: number, n = 12) =>
    mesh(new T.CylinderGeometry(r, r, h, n), f, x, y, z);
  function rod(a: T.Vector3, b: T.Vector3, r: number, f: Finish) {
    const m = cyl(r, a.distanceTo(b), f, 0, 0, 0, 6);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return m;
  }
  function luminous(m: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>, config: FacilityLight) {
    m.material = m.material.clone();
    m.userData.lightSource = 'facility';
    m.userData.facilityLight = config;
    m.castShadow = false;
    return m;
  }
  function windowPane(
    width: number,
    height: number,
    x: number,
    y: number,
    z: number,
    yaw: number,
    group: string,
    closes?: number,
  ) {
    const m = box(width, height, 0.08, 'glass', x, y, z);
    m.rotation.y = yaw;
    return luminous(m, { group, exterior: false, closes, color: '#ffd5a0', power: 22 });
  }
  function downlight(x: number, y: number, z: number, group: string, warm = false) {
    box(1.15, 0.25, 0.85, 'dark', x, y, z);
    luminous(box(0.95, 0.06, 0.65, 'white', x, y - 0.15, z), {
      group,
      exterior: true,
      color: warm ? '#ffca83' : '#dfebff',
      power: warm ? 26 : 42,
    });
  }
  function batch(g: T.Group) {
    g.updateMatrixWorld(true);
    const inverse = g.matrixWorld.clone().invert(),
      groups = new Map<T.Material, T.BufferGeometry[]>();
    const dynamic = g.children.filter((o) => o.userData.lightSource);
    g.traverse((o) => {
      if (o.userData.lightSource) return;
      if (o instanceof T.Mesh && !Array.isArray(o.material)) {
        const list = groups.get(o.material) ?? [];
        list.push(
          (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(
            inverse.clone().multiply(o.matrixWorld),
          ),
        );
        groups.set(o.material, list);
        o.geometry.dispose();
      }
    });
    g.clear();
    if (dynamic.length) g.add(...dynamic);
    for (const [m, parts] of groups) {
      const merged = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      if (merged) {
        const piece = new T.Mesh(merged, m);
        piece.castShadow = piece.receiveShadow = true;
        g.add(piece);
      }
    }
  }
  function installation(name: string, x: number, z: number, width: number, depth: number) {
    const p = spaceportPoint(site, x, z),
      heights = [];
    for (const dx of [-width / 2, 0, width / 2])
      for (const dz of [-depth / 2, 0, depth / 2]) {
        const q = spaceportPoint(site, x + dx, z + dz);
        heights.push(terrainHeight(w, q.x, q.z));
      }
    const high = Math.max(...heights) + 0.12,
      low = Math.min(...heights) - 0.2;
    parent = new T.Group();
    parent.name = name;
    parent.position.set(p.x, high, p.z);
    parent.rotation.y = Math.PI / 4;
    root.add(parent);
    box(width + 0.8, high - low, depth + 0.8, 'concrete', 0, -(high - low) / 2, 0);
    return parent;
  }
  function sign(text: string, width: number, height: number, x: number, y: number, z: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#203d48';
    c.fillRect(0, 0, 1024, 128);
    c.fillStyle = '#dec887';
    c.fillRect(0, 0, 16, 128);
    c.fillStyle = '#f1f0df';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    let size = 65;
    c.font = `600 ${size}px sans-serif`;
    while (c.measureText(text).width > 950) {
      c.font = `600 ${--size}px sans-serif`;
    }
    c.fillText(text, 520, 65);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(
      new T.BoxGeometry(width, height, 0.15),
      new T.MeshStandardMaterial({ map: texture, roughness: 0.8 }),
    );
    m.position.set(x, y, z);
    parent.add(m);
  }
  for (const b of spaceportStructures(site)) {
    const g = installation(b.name, b.x, b.z, b.width, b.depth),
      h = b.height;
    g.userData.dimensions = { width: b.width, depth: b.depth, height: h };
    box(b.width, h, b.depth, 'wall', 0, h / 2, 0);
    box(b.width + 0.3, 1, b.depth + 0.3, 'blue', 0, 1, 0);
    if (b.id === 'gatehouse') {
      box(b.width + 0.8, 0.3, b.depth + 0.8, 'blue', 0, h + 0.15, 0);
      for (const side of [-1, 1]) {
        windowPane(
          6,
          1.4,
          side * (b.width / 2 + 0.04),
          2.2,
          0,
          (side * Math.PI) / 2,
          'Gatehouse watch',
        );
        for (let z = -3; z <= 3; z += 1.5)
          box(0.1, 1.5, 0.07, 'metal', side * (b.width / 2 + 0.2), 2.2, z);
      }
      windowPane(4, 1.4, 0, 2.2, b.depth / 2 + 0.05, 0, 'Gatehouse watch');
      downlight(0, h, b.depth / 2 + 0.8, 'Gate canopy', true);
      box(1, 2.3, 0.12, 'blue', -2, 1.15, b.depth / 2 + 0.1);
      cyl(0.05, 2, 'metal', 2, h + 1, 2);
      box(0.35, 0.25, 0.7, 'white', 2, h + 2, 2);
    } else {
      const rise = b.id === 'integration' ? 5 : 2;
      for (const side of [-1, 1]) {
        const slope = Math.atan2(rise, b.width / 2),
          length = Math.hypot(b.width / 2 + 1, rise);
        box(length, 0.35, b.depth + 2, 'roof', (side * b.width) / 4, h + rise / 2, 0).rotation.z =
          -side * slope;
        // Regular structural ribs read as corrugated metal without thousands of meshes.
        for (let z = -b.depth / 2; z <= b.depth / 2; z += 4)
          box(0.16, h, 0.22, 'metal', side * (b.width / 2 + 0.2), h / 2, z);
        box(0.3, 0.45, b.depth + 2, 'blue', side * (b.width / 2 + 0.7), h - 0.1, 0);
        for (let z = -b.depth / 2 + 10; z < b.depth / 2; z += 20)
          cyl(0.12, h, 'metal', side * (b.width / 2 + 0.5), h / 2, z);
      }
      const gable = new T.BufferGeometry();
      gable.setAttribute(
        'position',
        new T.Float32BufferAttribute(
          [
            -b.width / 2,
            h,
            b.depth / 2,
            b.width / 2,
            h,
            b.depth / 2,
            0,
            h + rise,
            b.depth / 2,
            -b.width / 2,
            h,
            -b.depth / 2,
            0,
            h + rise,
            -b.depth / 2,
            b.width / 2,
            h,
            -b.depth / 2,
          ],
          3,
        ),
      );
      gable.setAttribute(
        'uv',
        new T.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1, 0, 0, 0.5, 1, 1, 0], 2),
      );
      gable.computeVertexNormals();
      mesh(gable, 'wall', 0, 0, 0);
      const bays = b.id === 'integration' ? 1 : b.id === 'workshops' ? 4 : 3;
      const doorW = b.id === 'integration' ? 64 : (b.width / (bays + 1)) * 0.78,
        doorH = b.id === 'integration' ? 56 : Math.min(9, h - 3);
      for (let i = 0; i < bays; i++) {
        const x = (i - (bays - 1) / 2) * (b.width / (bays + 1));
        box(doorW + 0.65, doorH + 0.35, 0.4, 'blue', x, doorH / 2, b.depth / 2 + 0.13);
        box(doorW, doorH, 0.12, 'roof', x, doorH / 2, b.depth / 2 + 0.5);
        for (let y = 0.6; y < doorH; y += 1.25)
          box(doorW, 0.055, 0.1, 'metal', x, y, b.depth / 2 + 0.59);
        if (b.id !== 'integration')
          windowPane(
            doorW * 0.75,
            0.6,
            x,
            doorH * 0.75,
            b.depth / 2 + 0.8,
            0,
            b.id + ' working windows',
            b.id === 'workshops' ? 21 : 22,
          );
        downlight(x, Math.min(10, doorH + 0.8), b.depth / 2 + 1.2, b.id + ' loading lights');
        for (const side of [-1, 1]) {
          cyl(0.17, 1.3, 'yellow', x + side * (doorW / 2 + 0.7), 0.65, b.depth / 2 + 1.4);
        }
      }
      box(1.1, 2.3, 0.15, 'blue', -b.width / 2 + 3, 1.15, b.depth / 2 + 0.13);
      for (let z = -b.depth / 2 + 10; z < b.depth / 2; z += 14)
        for (const side of [-1, 1])
          windowPane(
            5,
            1.3,
            side * (b.width / 2 + 0.3),
            h - 3,
            z,
            (side * Math.PI) / 2,
            b.id + (b.id === 'operations' && z < 0 ? ' night watch' : ' working windows'),
            b.id === 'operations' && z < 0
              ? undefined
              : b.id === 'workshops'
                ? 21
                : b.id === 'logistics'
                  ? 22
                  : 23,
          );
      for (const x of [-b.width * 0.25, b.width * 0.25]) {
        box(5, 1.5, 4, 'metal', x, h + rise * 0.8 + 1, 0);
        for (let i = 0; i < 5; i++)
          box(4, 0.08, 0.1, 'dark', x, h + rise * 0.8 + 0.5 + i * 0.2, 2.05);
      }
      sign(
        b.name,
        b.id === 'integration' ? 34 : Math.min(32, b.width - 5),
        2.8,
        0,
        h - 1.5,
        b.depth / 2 + 0.6,
      );
    }
    batch(g);
  }
  // Small, shielded fixtures: bright lenses and local pools, never a floodlit sky.
  for (const [x, z, height, warm] of [
    [-9, site.fence - 20, 5, 1],
    [9, site.fence - 20, 5, 1],
    [54, site.fence - 83, 7, 0],
    [114, site.fence - 83, 7, 0],
    [-45, 320, 9, 0],
    [45, 320, 9, 0],
    [165, 488, 9, 0],
    [-161, 422, 9, 0],
    [-170, 265, 9, 0],
  ]) {
    const g = installation('Shielded yard lamp', x, z, 0.7, 0.7);
    cyl(0.14, height, 'metal', 0, height / 2, 0);
    box(2.6, 0.15, 0.18, 'metal', 0, height, 0);
    for (const side of [-1, 1]) downlight(side, height, 0, 'Exterior yard lamps', !!warm);
    batch(g);
  }
  root.add(spaceportPavingModel(w));
  const parking = SPACEPORT_PARKING;
  const parkingSign = installation(
    'Visitor parking sign',
    parking.x - 30,
    site.fence - parking.fromGate - 13,
    1,
    1,
  );
  cyl(0.09, 3, 'metal', 0, 1.5, 0);
  box(2.4, 1.5, 0.16, 'blue', 0, 3, 0);
  sign('P  PARKING', 2.2, 0.7, 0, 3.2, 0.1);
  sign('VISITORS', 2.2, 0.4, 0, 2.7, 0.1);
  batch(parkingSign);

  // Independent, level monument sign on two supports, outside the security mesh.
  const monument = installation('Freestanding spaceport entrance sign', 23, site.fence + 12, 10, 2);
  for (const x of [-3.8, 3.8]) box(0.35, 4.5, 0.35, 'metal', x, 2.25, 0);
  box(10, 2.4, 0.35, 'blue', 0, 3.5, 0);
  sign('PUDDLEWICK SPACEPORT', 9.5, 1.2, 0, 3.9, 0.25);
  sign('TERMINAL  →     •     LAUNCH OPERATIONS', 9.5, 0.65, 0, 2.9, 0.25);
  downlight(-3, 5, 0.7, 'Entrance sign lamps', true);
  downlight(3, 5, 0.7, 'Entrance sign lamps', true);
  batch(monument);

  // Prime mover + modular multi-axle rocket trailer; dimensions match the large launcher.
  function truck(name: string, x: number, z: number, length: number, heavy: boolean) {
    const g = installation(name, x, z, heavy ? 15 : 7, length + 12);
    const width = heavy ? 8 : 3,
      rear = length / 2;
    box(width, 0.8, length, 'blue', 0, 2, 0);
    for (const side of [-1, 1]) box(0.5, 1.3, length, 'metal', side * (width / 2 - 0.4), 1.9, 0);
    const axles = heavy ? 22 : 3;
    for (let i = 0; i < axles; i++) {
      const az = heavy ? -rear + 5 + (i * (length - 10)) / (axles - 1) : -rear + 2 + i * 1.4;
      cyl(0.17, width + 1, 'metal', 0, 1.05, az).rotation.z = Math.PI / 2;
      for (const side of [-1, 1]) {
        cyl(heavy ? 0.95 : 0.65, 0.6, 'rubber', side * (width / 2 + 0.1), 1.05, az).rotation.z =
          Math.PI / 2;
        cyl(0.4, 0.65, 'metal', side * (width / 2 + 0.15), 1.05, az).rotation.z = Math.PI / 2;
      }
    }
    if (heavy)
      for (const z of [-length * 0.36, 0, length * 0.36]) {
        for (const side of [-1, 1]) {
          box(1.1, 3.5, 4, 'yellow', side * 3, 3.9, z);
          rod(new T.Vector3(side * 3, 5.7, z), new T.Vector3(side * 0.6, 3.2, z), 0.35, 'dark');
        }
      }
    else box(2.9, 3, Math.max(8, length - 2), 'white', 0, 3.9, 0);
    const cab = rear + 4;
    box(3.1, 1, 6, 'dark', 0, 1.6, cab);
    box(2.9, 2.4, 2.5, 'yellow', 0, 3.2, cab + 1.2);
    box(2.7, 1.5, 2.2, 'yellow', 0, 2.6, cab + 3.3);
    box(2.55, 0.95, 0.08, 'glass', 0, 3.55, cab + 2.49);
    box(0.05, 0.95, 1.8, 'glass', 1.48, 3.55, cab + 1.2);
    box(0.05, 0.95, 1.8, 'glass', -1.48, 3.55, cab + 1.2);
    box(2.5, 0.6, 0.1, 'metal', 0, 2.4, cab + 4.43);
    for (const side of [-1, 1]) {
      box(0.5, 0.25, 0.1, 'white', side * 1, 2.6, cab + 4.5);
      for (const z of [cab - 1.5, cab + 2.6])
        cyl(0.65, 0.5, 'rubber', side * 1.4, 1, z).rotation.z = Math.PI / 2;
      cyl(0.09, 2.8, 'metal', side * 1.6, 3, cab - 0.3);
    }
    batch(g);
  }
  truck('Heavy rocket transporter · 22 axle lines', -65, 245, 205, true);
  truck('Payload logistics semi-trailer', 68, 410, 17, false);
  truck('Service delivery semi-trailer', 160, 390, 20, false);
  // Tracking dishes: paraboloid reflectors with feed horns and triangulated supports.
  for (const [x, z, r] of [
    [160, 305, 7],
    [185, 325, 5],
    [160, 355, 4],
  ]) {
    const g = installation('Telemetry tracking antenna', x, z, r * 2 + 4, r * 2 + 4);
    cyl(1, 5, 'concrete', 0, 2.5, 0);
    cyl(0.6, 2, 'metal', 0, 5.5, 0);
    const dish = new T.Group();
    dish.position.y = 7;
    dish.rotation.x = 0.65;
    parent.add(dish);
    parent = dish;
    const points = Array.from({ length: 13 }, (_, i) => {
      const d = (r * i) / 12;
      return new T.Vector2(d, (d * d) / (r * 2.7));
    });
    const reflector = mesh(new T.LatheGeometry(points, 32), 'white', 0, 0, 0);
    reflector.material = materials.white.clone();
    (reflector.material as T.MeshStandardMaterial).side = T.DoubleSide;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      rod(
        new T.Vector3(Math.cos(a) * r, r / 2.7, Math.sin(a) * r),
        new T.Vector3(0, r * 0.8, 0),
        0.07,
        'metal',
      );
    }
    cyl(0.25, 0.8, 'dark', 0, r * 0.8, 0);
    parent = g;
    batch(g);
  }
  const crane = installation('Lattice-boom crawler crane', -185, 335, 22, 30);
  for (const x of [-4, 4]) {
    box(2, 2, 15, 'dark', x, 1, 0);
    for (let z = -6; z <= 6; z += 1.2) cyl(0.8, 2.1, 'rubber', x, 1, z).rotation.z = Math.PI / 2;
  }
  box(8, 2, 10, 'yellow', 0, 3, 0);
  box(4, 3, 3, 'yellow', -2, 5, -2);
  box(3.4, 1.5, 0.1, 'glass', -2, 5.5, -0.45);
  box(7, 3, 4, 'dark', 0, 5, -6);
  const base = new T.Vector3(0, 4, 3),
    tip = new T.Vector3(0, 57, 31);
  for (const dx of [-1.1, 1.1])
    for (const dz of [-1.1, 1.1])
      rod(
        base.clone().add(new T.Vector3(dx, 0, dz)),
        tip.clone().add(new T.Vector3(dx, 0, dz)),
        0.17,
        'yellow',
      );
  for (let i = 0; i < 14; i++) {
    const a = base.clone().lerp(tip, i / 14),
      b = base.clone().lerp(tip, (i + 1) / 14);
    for (const dx of [-1.1, 1.1])
      rod(
        a.clone().add(new T.Vector3(dx, 0, -1.1)),
        b.clone().add(new T.Vector3(dx, 0, 1.1)),
        0.09,
        'yellow',
      );
  }
  rod(tip, new T.Vector3(0, 12, 31), 0.05, 'dark');
  mesh(new T.TorusGeometry(0.7, 0.18, 8, 16, Math.PI * 1.5), 'metal', 0, 11.5, 31);
  batch(crane);

  // Freight and maintenance dressing, in small batches that cull with each work area.
  for (const prop of spaceportYardProps(site)) {
    const g = installation(prop.id, prop.x, prop.z, prop.width, prop.depth);
    if (prop.kind === 'containers') {
      const finishes: Finish[] = ['rust', 'blue', 'green'];
      function container(x: number, base: number, length: number, finish: Finish) {
        const h = 2.59,
          half = length / 2;
        box(2.44, h, length, finish, x, base + h / 2, 0);
        // Raised corner castings, corrugated sides and roof, double doors and locking bars.
        for (const side of [-1, 1]) {
          for (let z = -half + 0.25; z < half; z += 0.28)
            box(0.06, h - 0.28, 0.1, finish, x + side * 1.24, base + h / 2, z);
          for (const z of [-half, half]) {
            box(0.14, h, 0.16, 'metal', x + side * 1.18, base + h / 2, z);
            for (const y of [0.1, h - 0.1])
              box(0.2, 0.2, 0.2, 'metal', x + side * 1.18, base + y, z);
          }
          box(2.44, 0.12, 0.12, 'metal', x, base + (side < 0 ? 0.06 : h - 0.06), half + 0.03);
          box(1.12, h - 0.25, 0.05, finish, x + side * 0.59, base + h / 2, half + 0.08);
          for (const offset of [0.3, 0.88]) {
            cyl(0.035, 2.25, 'metal', x + side * offset, base + h / 2, half + 0.16, 6);
            box(0.22, 0.06, 0.07, 'metal', x + side * offset, base + 1.05, half + 0.2);
          }
        }
        for (let z = -half + 0.3; z < half; z += 0.4)
          box(2.2, 0.035, 0.1, finish, x, base + h + 0.01, z);
        box(0.75, 0.25, 0.02, 'white', x + 0.62, base + 2.1, half + 0.17);
        for (const z of [-half + 0.45, half - 0.45])
          box(0.02, 0.4, 0.4, 'yellow', x - 1.275, base + 0.5, z);
      }
      for (let i = 0; i < 3; i++) {
        container(-3.5 + i * 3.5, 0, prop.depth, finishes[i]);
        if (i !== 1) container(-3.5 + i * 3.5, 2.61, prop.depth, finishes[(i + 1) % 3]);
      }
    } else if (prop.kind === 'crates') {
      for (let i = 0; i < 5; i++) {
        const x = -4.8 + i * 2.4,
          h = 1.15 + (i % 3) * 0.55;
        for (const z of [-0.8, 0, 0.8]) box(1.9, 0.18, 0.18, 'wood', x, 0.12, z);
        for (let j = 0; j < 6; j++) box(0.28, 0.12, 1.9, 'wood', x - 0.8 + j * 0.32, 0.27, 0);
        box(1.65, h, 1.65, 'wood', x, 0.34 + h / 2, 0);
        for (const side of [-1, 1]) {
          box(1.72, 0.14, 0.08, 'concrete', x, 0.55, side * 0.84);
          box(1.72, 0.14, 0.08, 'concrete', x, h + 0.16, side * 0.84);
          box(0.09, h + 0.03, 1.7, 'dark', x + side * 0.52, 0.34 + h / 2, 0);
        }
        box(0.45, 0.3, 0.02, 'white', x, 0.9, 0.87);
      }
    } else if (prop.kind === 'generator') {
      box(4, 0.5, 5.8, 'dark', 0, 0.45, 0);
      box(3.5, 2.4, 5, 'green', 0, 1.9, 0);
      for (let i = 0; i < 12; i++) box(2.6, 0.06, 0.04, 'dark', 0, 1.25 + i * 0.12, 2.53);
      box(0.05, 1, 1, 'dark', 1.78, 2, 1);
      cyl(0.12, 1, 'metal', -1, 3.1, -1);
      box(0.7, 0.06, 0.7, 'metal', -1, 3.6, -1);
      for (const side of [-1, 1]) {
        cyl(0.32, 2.2, 'rust', side * 2.1, 1.2, -1);
        cyl(0.06, 0.4, 'metal', side * 2.1, 2.45, -1);
      }
    } else if (prop.kind === 'cables') {
      for (const x of [-3, 0, 3]) {
        cyl(1, 1.6, 'dark', x, 1.3, 0, 20).rotation.x = Math.PI / 2;
        for (const z of [-0.85, 0.85]) {
          cyl(1.25, 0.15, 'wood', x, 1.3, z, 20).rotation.x = Math.PI / 2;
          cyl(0.2, 0.18, 'metal', x, 1.3, z, 8).rotation.x = Math.PI / 2;
        }
        for (let z = -0.7; z <= 0.7; z += 0.14)
          mesh(new T.TorusGeometry(1.01, 0.035, 4, 20), 'metal', x, 1.3, z);
      }
    } else if (prop.kind === 'tanks') {
      for (const x of [-4.5, 0, 4.5]) {
        cyl(1.7, 5.4, 'white', x, 3.2, 0, 20);
        mesh(new T.SphereGeometry(1.7, 20, 10), 'white', x, 5.9, 0).scale.y = 0.4;
        for (const y of [0.6, 1.3, 4.8, 5.7]) cyl(1.74, 0.12, 'metal', x, y, 0, 20);
        for (const side of [-1, 1]) box(0.3, 0.8, 2.8, 'metal', x + side, 0.4, 0);
        cyl(0.08, 6, 'metal', x + 1.85, 3.1, 0, 8);
        box(0.7, 0.6, 0.1, 'blue', x, 3.4, 1.72);
      }
      rod(new T.Vector3(-5, 0.6, 2.8), new T.Vector3(5, 0.6, 2.8), 0.12, 'metal');
      for (const x of [-4.5, 0, 4.5])
        rod(new T.Vector3(x, 0.6, 2.8), new T.Vector3(x, 0.6, 0), 0.12, 'metal');
    } else {
      box(2.1, 0.6, 3.2, 'dark', 0, 0.65, -0.6);
      box(2.1, 1.3, 1.5, 'yellow', 0, 1.4, -1.4);
      box(0.8, 0.18, 0.7, 'rubber', 0, 1.5, -0.1);
      box(0.8, 0.7, 0.18, 'rubber', 0, 1.8, -0.45);
      for (const side of [-1, 1]) {
        for (const z of [-1.7, 0.5])
          cyl(0.5, 0.3, 'rubber', side * 1.05, 0.55, z).rotation.z = Math.PI / 2;
        box(0.1, 2.8, 0.1, 'yellow', side * 0.95, 2, -1);
        box(0.16, 4, 0.2, 'metal', side * 0.65, 2.1, 1.1);
        box(0.16, 1.1, 0.14, 'dark', side * 0.6, 0.8, 1.3);
        box(0.16, 0.12, 2, 'dark', side * 0.6, 0.3, 2.2);
      }
      box(2.2, 0.16, 2.2, 'yellow', 0, 3.45, -0.3);
      box(1.5, 0.16, 0.2, 'metal', 0, 1.25, 1.2);
    }
    batch(g);
  }

  // Paired lifting barriers leave the entire sixteen-metre traffic opening usable.
  const gate = spaceportPoint(site, 0, site.fence),
    gates: T.Group[] = [];
  for (const side of [-1, 1]) {
    const p = spaceportPoint(site, side * 7.7, site.fence),
      g = new T.Group();
    g.position.set(p.x, terrainHeight(w, p.x, p.z), p.z);
    g.rotation.y = Math.PI / 4;
    root.add(g);
    parent = g;
    box(0.8, 1.6, 0.8, 'yellow', 0, 0.8, 0);
    box(0.5, 0.25, 0.5, 'dark', 0, 1.72, 0);
    const pivot = new T.Group();
    pivot.position.y = 1.45;
    pivot.userData.spaceportGate = side;
    g.add(pivot);
    gates.push(pivot);
    parent = pivot;
    const length = 7.5;
    box(length, 0.22, 0.18, 'white', (-side * length) / 2, 0, 0);
    for (let i = 0; i < 8; i++) box(0.43, 0.23, 0.2, 'red', -side * (0.5 + i * 0.9), 0, 0);
    box(0.7, 0.55, 0.5, 'dark', side * 0.55, 0, 0);
    batch(pivot);
  }
  let openness = 0,
    hold = 0;
  root.userData.animateGate = (positions: readonly { x: number; z: number }[], dt: number) => {
    if (spaceportGateRequested(site, positions)) hold = 4;
    else hold = Math.max(0, hold - dt);
    const target = hold > 0 ? 1 : 0;
    openness = T.MathUtils.damp(openness, target, target ? 3 : 1.3, Math.min(dt, 0.1));
    for (const pivot of gates)
      pivot.rotation.z = -Number(pivot.userData.spaceportGate) * openness * Math.PI * 0.47;
  };
  root.userData.gatePosition = gate;
  return root;
}
