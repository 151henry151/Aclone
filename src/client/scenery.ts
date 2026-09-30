// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildingPlan, buildingBounds } from '../shared/building-shapes';
import type { World } from '../shared/types';
import { terrainHeight } from '../shared/simulation';
import { roadDistance, contactShadow, texture } from './materials';
const mat = (color: string) => new T.MeshStandardMaterial({ color, roughness: 0.96 });
function random(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
/** Crossed alpha-tested cards: crisp leaf/grass silhouettes without transparent sorting. */
function foliage(grass: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!,
    rand = random(grass ? 194 : 302);
  if (grass) {
    for (let i = 0; i < 48; i++) {
      const x = rand() * 256,
        h = 35 + rand() * 210;
      ctx.fillStyle = ['#718945', '#91a157', '#647e3c', '#adad65'][i % 4];
      ctx.beginPath();
      ctx.moveTo(x - 2, 256);
      ctx.quadraticCurveTo(x - 10, 256 - h * 0.5, x + (rand() - 0.5) * 70, 256 - h);
      ctx.quadraticCurveTo(x + 6, 256 - h * 0.35, x + 3, 256);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 500; i++) {
      const x = rand() * 256,
        y = rand() * 256,
        dx = (x - 128) / 125,
        dy = (y - 128) / 125;
      if (dx * dx + dy * dy > 1) continue;
      ctx.fillStyle = ['#788e42', '#90a253', '#58752f', '#a1ad60', '#677f3c'][i % 5];
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + rand() * 6, 2 + rand() * 3, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  const parts = [];
  for (let j = 0; j < 3; j++) {
    const p = new T.PlaneGeometry(1, 1);
    p.translate(0, 0.5, 0);
    p.rotateY((j * Math.PI) / 3);
    parts.push(p);
  }
  const geometry = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return {
    geometry,
    material: new T.MeshLambertMaterial({
      map,
      alphaTest: 0.45,
      side: T.DoubleSide,
      emissive: new T.Color(grass ? '#38451e' : '#35441d'),
      emissiveIntensity: 0.45,
    }),
  };
}
/** Seeded, instanced countryside. Roads, pitches and building entrances stay unobstructed. */
export function countryside(root: T.Group, world: World, low: boolean) {
  const rand = random(1853),
    matrix = new T.Object3D();
  const shades: T.Mesh[] = [];
  const scatter = (
    geometry: T.BufferGeometry,
    material: T.Material,
    points: number[][],
    shadow = false,
  ) => {
    const mesh = new T.InstancedMesh(geometry, material, points.length);
    points.forEach(([x, y, z, s = 1, rot = 0], i) => {
      matrix.position.set(x, y, z);
      matrix.scale.setScalar(s);
      matrix.rotation.set(0, rot, 0);
      matrix.updateMatrix();
      mesh.setMatrixAt(i, matrix.matrix);
      mesh.setColorAt(
        i,
        new T.Color().setRGB(0.8 + (i % 5) * 0.04, 0.84 + (i % 4) * 0.04, 0.75 + (i % 6) * 0.04),
      );
    });
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    root.add(mesh);
    return mesh;
  };
  const footprints = world.buildings.map((b) => {
    const bounds = buildingBounds(buildingPlan(b));
    return {
      b,
      radius: Math.hypot(
        Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)),
        Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)),
      ),
    };
  });
  const clear = (x: number, z: number, margin: number) =>
    roadDistance(x, z) > margin &&
    Math.hypot(x, z) > 16 &&
    !(x > 56 && x < 124 && z > 16 && z < 74) &&
    !(x > 45 && x < 105 && z < -55 && z > -92) &&
    footprints.every(({ b, radius }) => Math.hypot(b.x - x, b.z - z) > radius + 1 + margin);
  const grass: number[][] = [],
    flowers: number[][] = [],
    trunks: number[][] = [],
    crowns: number[][] = [],
    rocks: number[][] = [];
  for (let i = 0; i < (low ? 2600 : 10000); i++) {
    const x = (rand() - 0.5) * 480,
      z = (rand() - 0.5) * 480,
      h = terrainHeight(world, x, z);
    if (h < world.settings.seaLevel + 0.9 || !clear(x, z, 0.5)) continue;
    const s = 0.18 + rand() * 0.32;
    grass.push([x, h, z, s, rand() * 6.28]);
    // Local tufts along the roadside, not just far-away woodland.
    if (roadDistance(x, z) < 5)
      for (let j = 0; j < 4; j++)
        grass.push([x + rand() * 1.5, h, z + rand() * 1.5, s, rand() * 6.28]);
    if (i % 7 === 0) flowers.push([x, h + 0.24, z, 0.6 + rand() * 0.5]);
    if (i % 42 === 0 && clear(x, z, 5)) {
      const scale = 0.72 + rand() * 0.8;
      trunks.push([x, h, z, scale, rand() * 6]);
      for (let j = 0; j < 13; j++) {
        const a = j * 2.399,
          r = j < 4 ? 1 : 2.4;
        crowns.push([
          x + Math.sin(a) * r * scale,
          h + (3.7 + rand() * 2.5) * scale,
          z + Math.cos(a) * r * scale,
          (2.7 + rand() * 1.3) * scale,
          a,
        ]);
      }
      const shade = contactShadow(12 * scale, 11 * scale, 0.25);
      shade.position.set(x, h + 0.1, z);
      shades.push(shade);
    }
    if (i % 97 === 0) rocks.push([x, h + 0.2, z, 0.5 + rand() * 0.9, rand() * 6]);
  }
  // Deliberate shade trees frame the village approach, alongside the scattered woodland.
  for (const [x, z] of [
    [-18, -4],
    [18, -4],
    [-45, -12],
    [43, -11],
    [-18, 68],
  ]) {
    if (!clear(x, z, 3)) continue;
    const h = terrainHeight(world, x, z),
      scale = 1.35;
    if (h < world.settings.seaLevel + 0.9) continue;
    trunks.push([x, h, z, scale, 0]);
    for (let j = 0; j < 22; j++) {
      const a = j * 2.399,
        r = 2.5 * Math.sqrt((j + 1) / 22);
      crowns.push([x + Math.sin(a) * r, h + 5 + rand() * 3, z + Math.cos(a) * r, 3.4 + rand(), a]);
    }
    const shade = contactShadow(15, 14, 0.25);
    shade.position.set(x, h + 0.1, z);
    shades.push(shade);
  }
  for (let x = -85; x < 105; x += 1.7)
    for (let z = -90; z < 110; z += 1.7) {
      const px = x + rand(),
        pz = z + rand(),
        d = roadDistance(px, pz),
        h = terrainHeight(world, px, pz);
      if (d < 1 || d > 3.8 || !clear(px, pz, 0.5) || h < world.settings.seaLevel + 0.9) continue;
      grass.push([px, h, pz, 0.14 + rand() * 0.22, rand() * 6.28]);
    }
  const blades = foliage(true);
  scatter(blades.geometry, blades.material, grass);
  scatter(new T.IcosahedronGeometry(0.09, 0), mat('#f0dc98'), flowers);
  const trunk = new T.CylinderGeometry(0.15, 0.46, 5, 7);
  trunk.translate(0, 2.5, 0);
  scatter(trunk, mat('#625340'), trunks, true);
  const leaves = foliage(false);
  scatter(leaves.geometry, leaves.material, crowns, true);
  scatter(
    new T.DodecahedronGeometry(1, 0),
    new T.MeshStandardMaterial({ map: texture('stone'), color: '#a6a799', roughness: 1 }),
    rocks,
    true,
  );
  const hedges: number[][] = [],
    fence: number[][] = [],
    rails: number[][] = [];
  for (const b of world.buildings) {
    if (!['home', 'pub', 'school', 'bank', 'workhouse', 'bakery'].includes(b.kind)) continue;
    const bounds = buildingBounds(buildingPlan(b));
    const half = Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)) + 1.7;
    const front = bounds.maxZ + 1.8;
    const c = Math.cos(b.rotation),
      s = Math.sin(b.rotation);
    const point = (x: number, z: number) => [b.x + x * c + z * s, b.z - x * s + z * c];
    for (const side of [-1, 1]) {
      for (let j = 0; j < 7; j++) {
        const [x, z] = point(side * half, bounds.minZ + j * (bounds.depth / 6));
        hedges.push([x, terrainHeight(world, x, z), z, 1.15 + (j % 2) * 0.1, j]);
      }
      for (let j = 0; j < 4; j++) {
        const [x, z] = point(side * (1.8 + j * ((half - 1.8) / 3)), front);
        fence.push([x, terrainHeight(world, x, z) + 0.65, z, 1, b.rotation]);
      }
      for (const h of [0.45, 1]) {
        const [x, z] = point(side * ((half + 1.8) / 2), front);
        rails.push([x, terrainHeight(world, x, z) + h, z, (half - 1.8) / 4.4, b.rotation]);
      }
    }
    const shade = contactShadow(bounds.width + 3, bounds.depth + 3, 0.38);
    shade.position.set(b.x, terrainHeight(world, b.x, b.z) + 0.09, b.z);
    shades.push(shade);
  }
  // Reuse the leaf material without the blob-like solid hedge geometry.
  const hedgeLeaf = foliage(false);
  scatter(hedgeLeaf.geometry, hedgeLeaf.material, hedges, true);
  scatter(new T.BoxGeometry(0.15, 1.3, 0.15), mat('#c2b89b'), fence, true);
  scatter(new T.BoxGeometry(4.4, 0.12, 0.12), mat('#b2a486'), rails, true);
  const groups = new Map<number, T.Mesh[]>();
  for (const shade of shades) {
    const opacity = (shade.material as T.Material).opacity;
    const list = groups.get(opacity) ?? [];
    list.push(shade);
    groups.set(opacity, list);
  }
  for (const list of groups.values()) {
    const geos = list.map((s) => {
      s.updateMatrix();
      return s.geometry.clone().applyMatrix4(s.matrix);
    });
    const merged = new T.Mesh(mergeGeometries(geos)!, (list[0].material as T.Material).clone());
    root.add(merged);
    geos.forEach((g) => g.dispose());
    list.forEach((s) => {
      s.geometry.dispose();
      (s.material as T.Material).dispose();
    });
  }
}
