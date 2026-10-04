import { creatorModel } from './creator-model';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { resourceNodes } from '../shared/resources';
import { terrainHeight } from '../shared/simulation';
import type { World } from '../shared/types';

function random(seed: number) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}
type Surface =
  'rock' | 'cutStone' | 'soil' | 'gravel' | 'bark' | 'wood' | 'leaves' | 'metal' | 'rubber';
/** Authored natural silhouettes, batched by surface. Metres match tractors and people. */
export function resourceGeometry(item: string, variant: number, low: boolean) {
  const rand = random(7419 + variant * 2371 + item.length * 91);
  const parts = new Map<Surface, T.BufferGeometry[]>();
  const add = (
    surface: Surface,
    geometry: T.BufferGeometry,
    x = 0,
    y = 0,
    z = 0,
    rotation = new T.Euler(),
  ) => {
    geometry.applyMatrix4(new T.Matrix4().makeRotationFromEuler(rotation));
    geometry.translate(x, y, z);
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    // Continuous ground projection; keep each rock's native UVs so a triangle
    // never interpolates between unrelated projection axes along its edge.
    if (['soil', 'gravel'].includes(surface)) {
      const p = g.attributes.position,
        uv = [];
      for (let i = 0; i < p.count; i++) {
        uv.push(p.getX(i) / 3, p.getZ(i) / 3);
      }
      g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    }
    const list = parts.get(surface) ?? [];
    list.push(g);
    parts.set(surface, list);
  };
  const stick = (surface: Surface, from: number[], to: number[], bottom: number, top = bottom) => {
    const a = new T.Vector3(...from),
      b = new T.Vector3(...to),
      delta = b.clone().sub(a);
    const g = new T.CylinderGeometry(top, bottom, delta.length(), low ? 7 : 12);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()),
    );
    add(surface, g, ...(a.add(b).multiplyScalar(0.5).toArray() as [number, number, number]));
  };
  const stone = (x: number, z: number, sx: number, sy: number, sz: number, chipped = false) => {
    const g = new T.SphereGeometry(1, low ? 14 : 24, low ? 9 : 16),
      p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let px = p.getX(i),
        py = p.getY(i),
        pz = p.getZ(i);
      const rough =
        1 + 0.1 * Math.sin(px * 7 + pz * 4 + variant) + 0.06 * Math.sin(py * 11 - px * 5);
      px *= rough;
      py *= rough;
      pz *= rough;
      if (chipped) px = Math.min(px, 0.55 + py * 0.13);
      p.setXYZ(i, px * sx + py * 0.17, py * sy, pz * sz);
    }
    g.computeVertexNormals();
    add('rock', g, x, sy * 0.55, z, new T.Euler(0, variant * 0.57, 0));
  };
  // An irregular exposed surface with a low bank behind a worked hollow. The
  // near edge meets the terrain; there is no floating disc or smooth mound.
  const patch = (surface: Surface, radius: number, bank: number) => {
    const n = 36,
      rings = 7,
      vertices: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    for (let r = 0; r <= rings; r++)
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2,
          f = r / rings;
        const edge = 1 + 0.13 * Math.sin(a * 3 + variant) + 0.08 * Math.cos(a * 7);
        const x = Math.sin(a) * radius * f * edge,
          z = Math.cos(a) * radius * f * edge * 0.78;
        const height =
          0.045 +
          bank * Math.pow(Math.sin(f * Math.PI), 1.4) * Math.max(0.06, -Math.cos(a)) +
          0.025 * Math.sin(x * 3 + z) * Math.sin(f * Math.PI);
        vertices.push(x, height, z);
        uv.push(x / 2, z / 2);
        if (r < rings && i < n) {
          const k = r * (n + 1) + i;
          indices.push(k, k + n + 1, k + 1, k + 1, k + n + 1, k + n + 2);
        }
      }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    add(surface, g);
  };
  const log = (x: number, z: number, length: number, radius: number, angle: number) => {
    const dx = (Math.sin(angle) * length) / 2,
      dz = (Math.cos(angle) * length) / 2;
    stick('bark', [x - dx, radius, z - dz], [x + dx, radius + 0.05, z + dz], radius, radius * 0.78);
    const axis = new T.Vector3(dx * 2, 0.05, dz * 2).normalize();
    for (const sign of [-1, 1]) {
      const disc = new T.CircleGeometry(radius * (sign === 1 ? 0.77 : 0.99), low ? 12 : 20);
      disc.applyQuaternion(
        new T.Quaternion().setFromUnitVectors(
          new T.Vector3(0, 0, 1),
          axis.clone().multiplyScalar(sign),
        ),
      );
      add(
        'wood',
        disc,
        x + sign * (dx + axis.x * 0.006),
        radius + (sign === 1 ? 0.05 : 0),
        z + sign * (dz + axis.z * 0.006),
      );
    }
  };
  const shovel = (x: number, z: number) => {
    stick('wood', [x, 0.18, z], [x + 0.18, 1.33, z + 0.12], 0.035);
    add(
      'metal',
      new T.SphereGeometry(1, 8, 6).scale(0.14, 0.2, 0.025),
      x,
      0.2,
      z,
      new T.Euler(-0.2, 0.3, 0),
    );
    add('metal', new T.TorusGeometry(0.105, 0.016, 5, 10), x + 0.2, 1.39, z + 0.14);
  };
  const wheelbarrow = () => {
    const x = 3.4,
      z = 1.3;
    // Open folded-steel tray, tapered at the bottom; worn olive paint.
    const vertices = [
      -0.34, 0.67, -0.6, 0.34, 0.67, -0.6, 0.34, 0.67, 0.5, -0.34, 0.67, 0.5, -0.52, 1, -0.76, 0.52,
      1, -0.76, 0.52, 1, 0.68, -0.52, 1, 0.68,
    ];
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setIndex([
      0, 2, 1, 0, 3, 2, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7,
    ]);
    g.computeVertexNormals();
    g.setAttribute('uv', new T.Float32BufferAttribute(Array(16).fill(0), 2));
    add('metal', g, x, 0, z);
    for (const side of [-1, 1]) {
      stick('metal', [x + side * 0.32, 0.6, z - 0.5], [x + side * 0.38, 0.81, z + 1.37], 0.03);
      stick('wood', [x + side * 0.38, 0.81, z + 1.17], [x + side * 0.38, 0.83, z + 1.58], 0.043);
      stick('metal', [x + side * 0.33, 0.64, z + 0.4], [x + side * 0.4, 0.08, z + 0.62], 0.025);
    }
    add(
      'rubber',
      new T.TorusGeometry(0.25, 0.07, 8, 18),
      x,
      0.32,
      z - 0.93,
      new T.Euler(0, Math.PI / 2, 0),
    );
    stick('metal', [x - 0.43, 0.32, z - 0.93], [x + 0.43, 0.32, z - 0.93], 0.025);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      stick(
        'metal',
        [x, 0.32, z - 0.93],
        [x, 0.32 + Math.sin(a) * 0.24, z - 0.93 + Math.cos(a) * 0.24],
        0.01,
      );
    }
    add('gravel', new T.SphereGeometry(1, 14, 8).scale(0.39, 0.14, 0.55), x, 0.76, z - 0.03);
  };
  if (item === 'logs') {
    patch('soil', 4.4, 0.08);
    // Mixed-age trees surround an open working area. Crowns are branching sprays
    // of leaves, never solid geometric balls. Each site has a different lean.
    for (let t = 0; t < 4; t++) {
      const a = t * 1.68 + variant * 0.3,
        x = Math.sin(a) * (4.7 + rand()),
        z = Math.cos(a) * (4.7 + rand());
      const h = 4.8 + rand() * 2.6,
        lean = (rand() - 0.5) * 0.65;
      stick('bark', [x, 0, z], [x + lean, h, z + 0.18], 0.25 + rand() * 0.13, 0.07);
      for (let root = 0; root < 4; root++) {
        const ra = root * 1.57;
        stick(
          'bark',
          [x, 0.5, z],
          [x + Math.sin(ra) * 0.65, 0.035, z + Math.cos(ra) * 0.65],
          0.09,
          0.025,
        );
      }
      for (let b = 0; b < 7; b++) {
        const ba = b * 2.4 + t,
          y = h * (0.5 + b * 0.065),
          bx = x + Math.sin(ba) * (1.5 + b * 0.09),
          bz = z + Math.cos(ba) * (1.4 + b * 0.06);
        stick('bark', [x + (lean * y) / h, y - 0.5, z], [bx, y + 0.6, bz], 0.07, 0.015);
        const sprays = low ? 4 : 7;
        for (let f = 0; f < 7; f++) {
          const fx = bx + (rand() - 0.5) * 1.8,
            fy = y + 0.45 + rand() * 1.5,
            fz = bz + (rand() - 0.5) * 1.8,
            size = 1.4 + rand() * 0.9,
            rot = rand() * Math.PI * 2,
            pitch = (rand() - 0.5) * 0.7;
          if (f >= sprays) continue;
          add(
            'leaves',
            new T.PlaneGeometry(size, size * 0.8),
            fx,
            fy,
            fz,
            new T.Euler(pitch, rot, 0),
          );
        }
      }
    }
    // One felled trunk with a broken branch and scattered short firewood rounds.
    log(-0.6, 0.3, 4.7, 0.31, 0.72 + variant * 0.12);
    stick('bark', [-1.5, 0.32, -0.8], [-2.35, 0.7, -1.6], 0.09, 0.025);
    for (let i = 0; i < 3; i++)
      log(
        1.2 + rand() * 1.9,
        -0.3 + rand() * 2,
        0.65 + rand() * 0.5,
        0.17 + rand() * 0.07,
        rand() * 5,
      );
    stick('bark', [-2.7, 0, -1.9], [-2.7, 0.58, -1.9], 0.4, 0.32);
    add('wood', new T.CircleGeometry(0.31, 20), -2.7, 0.585, -1.9, new T.Euler(-Math.PI / 2, 0, 0));
    for (let i = 0; i < (low ? 12 : 28); i++) {
      const x = (rand() - 0.5) * 3,
        z = (rand() - 0.5) * 2;
      add(
        'wood',
        new T.BoxGeometry(0.035 + rand() * 0.07, 0.012, 0.02 + rand() * 0.06),
        x,
        0.065,
        z,
        new T.Euler(0, rand() * 6, 0),
      );
    }
  } else if (item === 'stone') {
    patch('gravel', 5.7, 0.12);
    stone(-1.25, -0.6, 2.15, 1.9, 1.7, true);
    stone(2, -1.2, 1.45, 1.4, 1.2);
    stone(0.2, 2.4, 0.7, 0.43, 0.55);
    // Fresh angular spalls contrast with weathered grey exteriors.
    for (let i = 0; i < (low ? 14 : 32); i++) {
      const a = rand() * Math.PI * 2,
        r = 1.7 + rand() * 3,
        s = 0.06 + rand() * 0.25;
      const g = new T.DodecahedronGeometry(s, 0);
      g.scale(1, 0.55, 0.75);
      add(
        i % 3 === 0 ? 'cutStone' : 'rock',
        g,
        Math.sin(a) * r,
        s * 0.45,
        Math.cos(a) * r,
        new T.Euler(rand(), rand() * 6, rand()),
      );
    }
    stick('wood', [1.1, 0.1, 1.2], [1.4, 0.65, 1.45], 0.035);
    add('metal', new T.BoxGeometry(0.38, 0.13, 0.13), 1.4, 0.65, 1.45, new T.Euler(0, 0.4, 0.5));
  } else {
    patch(item === 'gravel' ? 'gravel' : 'soil', 6.5, item === 'gravel' ? 0.85 : 1.0);
    if (item === 'gravel') wheelbarrow();
    else shovel(2.3, 0.4);
    for (let i = 0; i < (low ? 24 : 64); i++) {
      const a = rand() * Math.PI * 2,
        r = 2.1 + rand() * 3.3,
        s = 0.04 + rand() * (item === 'gravel' ? 0.17 : 0.1);
      const g = new T.DodecahedronGeometry(s, 0);
      g.scale(1, 0.55, 0.7);
      add(
        item === 'gravel' ? 'rock' : 'soil',
        g,
        Math.sin(a) * r,
        0.05 + s * 0.5,
        Math.cos(a) * r * 0.78,
        new T.Euler(rand(), rand() * 6, 0),
      );
    }
    if (item === 'dirt') {
      // Roots exposed along an eroded earth bank, plus ragged sod on its lip.
      for (let i = 0; i < 9; i++) {
        const x = -2.2 + i * 0.49;
        stick('bark', [x, 0.64, -2.25], [x + 0.22, 0.14, -1.75], 0.019, 0.009);
      }
      for (let i = 0; i < 16; i++) {
        const a = rand() * Math.PI * 2;
        add(
          'leaves',
          new T.PlaneGeometry(0.55, 0.38),
          Math.sin(a) * 5.3,
          0.22,
          Math.cos(a) * 4.1,
          new T.Euler(-0.3, a, 0),
        );
      }
    }
  }
  const result: Partial<Record<Surface, T.BufferGeometry>> = {};
  for (const [key, geometries] of parts) {
    result[key] = mergeGeometries(geometries)!;
    geometries.forEach((g) => g.dispose());
  }
  return result;
}

const maps = new Map<string, T.CanvasTexture>();
function resourceTexture(kind: 'rock' | 'soil' | 'gravel' | 'bark' | 'wood' | 'leaves') {
  const cached = maps.get(kind);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d')!,
    rand = random(9123 + kind.length * 93);
  if (kind === 'leaves') {
    ctx.lineCap = 'round';
    for (let spray = 0; spray < 9; spray++) {
      const baseX = 110 + rand() * 220,
        baseY = 250 + rand() * 200,
        angle = -Math.PI / 2 + (rand() - 0.5) * 2.5,
        length = 140 + rand() * 120;
      ctx.strokeStyle = '#6c6741';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(baseX + Math.cos(angle) * length, baseY + Math.sin(angle) * length);
      ctx.stroke();
      for (let leaf = 0; leaf < 28; leaf++) {
        const f = leaf / 28,
          side = leaf % 2 ? 1 : -1,
          spread = 18 + rand() * 26;
        const x = baseX + Math.cos(angle) * length * f + Math.cos(angle + 1.57) * side * spread,
          y = baseY + Math.sin(angle) * length * f + Math.sin(angle + 1.57) * side * spread;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + side * 0.65);
        ctx.fillStyle = ['#526838', '#708447', '#879454', '#5f763e', '#9b9f62'][leaf % 5];
        ctx.beginPath();
        ctx.ellipse(0, 0, 10 + rand() * 9, 5 + rand() * 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#a0a776';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(-9, 0);
        ctx.lineTo(10, 0);
        ctx.stroke();
        ctx.restore();
      }
    }
  } else if (kind === 'wood') {
    ctx.fillStyle = '#b39c72';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 1; i < 36; i++) {
      ctx.strokeStyle = i % 4 === 0 ? '#756548' : '#95805b';
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      ctx.ellipse(245, 266, i * 9, i * 8.5, 0.12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#514334';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(256 + Math.cos(a) * 125, 256 + Math.sin(a) * 125);
      ctx.lineTo(256 + Math.cos(a) * 255, 256 + Math.sin(a) * 255);
      ctx.stroke();
    }
  } else {
    const data = ctx.createImageData(512, 512);
    const base =
      kind === 'rock'
        ? [116, 119, 110]
        : kind === 'soil'
          ? [95, 73, 49]
          : kind === 'gravel'
            ? [116, 112, 100]
            : [85, 72, 55];
    // Seamless, smoothly interpolated random mineral/earth mottling. Periodic
    // sine stripes turn into conspicuous plaid when the ground repeats them.
    const layers = [8, 16, 32].map((size) => ({
      size,
      values: Array.from({ length: size * size }, () => rand() - 0.5),
    }));
    const mottle = (x: number, y: number) =>
      layers.reduce((sum, { size, values }, i) => {
        const gx = (x * size) / 512,
          gy = (y * size) / 512;
        const ix = Math.floor(gx),
          iy = Math.floor(gy);
        const smooth = (v: number) => v * v * (3 - 2 * v);
        const fx = smooth(gx - ix),
          fy = smooth(gy - iy);
        const at = (dx: number, dy: number) =>
          values[((iy + dy) % size) * size + ((ix + dx) % size)];
        return (
          sum +
          ((at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) +
            (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy) *
            (26 / (i + 1))
        );
      }, 0);
    for (let y = 0; y < 512; y++)
      for (let x = 0; x < 512; x++) {
        const noise = (rand() - 0.5) * (kind === 'rock' ? 58 : 33) + mottle(x, y);
        const fleck = kind === 'rock' && rand() < 0.025 ? 35 : 0;
        const at = (y * 512 + x) * 4;
        for (let k = 0; k < 3; k++) data.data[at + k] = base[k] + noise + fleck;
        data.data[at + 3] = 255;
      }
    ctx.putImageData(data, 0, 0);
    if (kind === 'gravel') {
      for (let i = 0; i < 4200; i++) {
        const x = rand() * 512,
          y = rand() * 512,
          radius = 1.3 + rand() * 3,
          tone = 100 + Math.floor(rand() * 65);
        ctx.fillStyle = `rgb(${tone},${tone},${tone - 9})`;
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * 0.65, rand() * 6.28, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'bark') {
      for (let i = 0; i < 100; i++) {
        const x = rand() * 512,
          y = rand() * 512;
        ctx.strokeStyle = i % 3 ? '#443a2e' : '#a2987b';
        ctx.lineWidth = 1 + rand() * 5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + rand() * 8, y + 25, x - rand() * 12, y + 65, x + rand() * 6, y + 130);
        ctx.stroke();
      }
    } else if (kind === 'rock') {
      ctx.strokeStyle = 'rgba(202,201,176,.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        const y = rand() * 512;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(170, y + 60, 290, y - 55, 512, y + 5);
        ctx.stroke();
      }
    }
  }
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.anisotropy = 4;
  map.userData.shared = true;
  maps.set(kind, map);
  return map;
}
export function resourceScenery(root: T.Group, world: World, low: boolean) {
  const materials: Record<Surface, T.Material> = {
    rock: new T.MeshStandardMaterial({ map: resourceTexture('rock'), roughness: 1 }),
    cutStone: new T.MeshStandardMaterial({
      map: resourceTexture('rock'),
      color: '#cbd0c7',
      roughness: 0.95,
    }),
    soil: new T.MeshStandardMaterial({ map: resourceTexture('soil'), roughness: 1 }),
    gravel: new T.MeshStandardMaterial({ map: resourceTexture('gravel'), roughness: 1 }),
    bark: new T.MeshStandardMaterial({ map: resourceTexture('bark'), roughness: 1 }),
    wood: new T.MeshStandardMaterial({ map: resourceTexture('wood'), roughness: 0.96 }),
    leaves: new T.MeshLambertMaterial({
      map: resourceTexture('leaves'),
      alphaTest: 0.42,
      side: T.DoubleSide,
    }),
    metal: new T.MeshStandardMaterial({
      color: '#586357',
      roughness: 0.84,
      metalness: 0.18,
      side: T.DoubleSide,
    }),
    rubber: new T.MeshStandardMaterial({ color: '#292a25', roughness: 1 }),
  };
  for (const node of resourceNodes) {
    if (
      world.buildings.some((b) => Math.hypot(b.x - node.x, b.z - node.z) < 12) ||
      terrainHeight(world, node.x, node.z) < world.settings.seaLevel + 0.1
    )
      continue;
    const custom = world.creator?.models.find(
      (m) => m.id === world.creator?.resourceModels?.[node.item as 'logs'],
    );
    if (custom) {
      const group = creatorModel(custom, world);
      group.position.set(node.x, terrainHeight(world, node.x, node.z), node.z);
      group.userData.resource = node.id;
      root.add(group);
      continue;
    }
    const variant = Number(node.id.split('-').at(-1));
    const group = new T.Group();
    group.name = `Gathering ground ${node.id}`;
    group.userData.resource = node.id;
    for (const [surface, g] of Object.entries(resourceGeometry(node.item, variant, low))) {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + node.x,
          z = p.getZ(i) + node.z;
        p.setXYZ(i, x, p.getY(i) + terrainHeight(world, x, z), z);
      }
      g.computeBoundingSphere();
      const mesh = new T.Mesh(g, materials[surface as Surface]);
      mesh.name = `${node.id} ${surface}`;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    root.add(group);
  }
}
