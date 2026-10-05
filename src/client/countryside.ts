// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { World } from '../shared/types';
import { terrainHeight, mapHalf, woodland } from '../shared/terrain';
import { worldResources } from '../shared/resources';
import { townRoads, roadDistance } from '../shared/town';
import { buildingPlan, buildingBounds } from '../shared/building-shapes';
import { hash2 } from '../shared/noise';
import {
  evergreens,
  evergreenMaterials,
  sharedEvergreenGeometry,
  type EvergreenSite,
} from './evergreen';
import { foliage, random } from './scenery';
import { resourceScenery } from './resource-scenery';
import { contactShadow, seasonalMaterial, texture } from './materials';

export const chunkSize = 256;
const loadRadius = 480,
  unloadRadius = 640;

/** Materials and geometry shared by every streamed chunk, so arriving somewhere new
 * costs instance buffers rather than fresh textures and shader programs. */
function sharedAssets() {
  const leaves = foliage(false),
    trunk = new T.CylinderGeometry(0.15, 0.46, 5, 7),
    birch = new T.CylinderGeometry(0.13, 0.24, 6, 9);
  trunk.translate(0, 2.5, 0);
  birch.translate(0, 3, 0);
  const rand = random(7331);
  const barkCanvas = document.createElement('canvas');
  barkCanvas.width = barkCanvas.height = 128;
  const bark = barkCanvas.getContext('2d')!;
  bark.fillStyle = '#d8d3bf';
  bark.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 80; i++) {
    bark.fillStyle = i % 2 ? '#776f60' : '#aaa18c';
    bark.fillRect(rand() * 128, rand() * 128, 3 + rand() * 12, 1 + rand() * 2);
  }
  const barkMap = new T.CanvasTexture(barkCanvas);
  barkMap.colorSpace = T.SRGBColorSpace;
  const assets = {
    leaves,
    trunk,
    birch,
    rock: new T.DodecahedronGeometry(1, 0),
    trunkMaterial: new T.MeshStandardMaterial({ color: '#625340', roughness: 0.96 }),
    birchMaterial: new T.MeshStandardMaterial({ color: '#ffffff', map: barkMap, roughness: 1 }),
    rockMaterial: new T.MeshStandardMaterial({
      map: texture('stone'),
      color: '#a6a799',
      roughness: 1,
    }),
    evergreen: evergreenMaterials(),
  };
  for (const g of [leaves.geometry, trunk, birch, assets.rock]) g.userData.shared = true;
  for (const m of [
    leaves.material,
    assets.trunkMaterial,
    assets.birchMaterial,
    assets.rockMaterial,
    assets.evergreen.needles,
    assets.evergreen.wood,
  ]) {
    m.userData.shared = true;
    seasonalMaterial(m, m === leaves.material);
  }
  return assets;
}
type Assets = ReturnType<typeof sharedAssets>;
let assets: Assets | undefined;

/** Streams woodland, outcrops and gathering grounds in 256 m chunks around the player. */
export class CountrysideChunks {
  readonly group = new T.Group();
  private chunks = new Map<string, T.Group>();
  private world?: World;
  private low = false;
  private half = 0;
  reset(w: World, low: boolean) {
    this.clear();
    this.world = w;
    this.low = low;
    this.half = mapHalf(w);
  }
  clear() {
    for (const chunk of this.chunks.values()) this.drop(chunk);
    this.chunks.clear();
    this.world = undefined;
  }
  get active() {
    return !!this.world;
  }
  private drop(chunk: T.Group) {
    chunk.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      if (o instanceof T.InstancedMesh) o.dispose();
      if (!o.geometry.userData.shared) o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (m.userData.shared) continue;
        const map = (m as T.MeshStandardMaterial).map;
        if (map && !map.userData.shared) map.dispose();
        m.dispose();
      }
    });
    this.group.remove(chunk);
  }
  update(x: number, z: number, budget = 1) {
    const w = this.world;
    if (!w) return;
    for (const [key, chunk] of this.chunks) {
      const { cx, cz } = chunk.userData as { cx: number; cz: number };
      if (Math.hypot(cx - x, cz - z) > unloadRadius + chunkSize * 0.71) {
        this.drop(chunk);
        this.chunks.delete(key);
      }
    }
    const lo = Math.floor(-this.half / chunkSize),
      hi = Math.ceil(this.half / chunkSize);
    const wanted: { i: number; j: number; d: number }[] = [];
    for (let j = Math.max(lo, Math.floor((z - loadRadius) / chunkSize)); j < hi; j++) {
      if ((j + 0.5) * chunkSize > z + loadRadius + chunkSize) break;
      for (let i = Math.max(lo, Math.floor((x - loadRadius) / chunkSize)); i < hi; i++) {
        if ((i + 0.5) * chunkSize > x + loadRadius + chunkSize) break;
        if (this.chunks.has(`${i}:${j}`)) continue;
        const d = Math.hypot((i + 0.5) * chunkSize - x, (j + 0.5) * chunkSize - z);
        if (d <= loadRadius + chunkSize * 0.71) wanted.push({ i, j, d });
      }
    }
    wanted.sort((a, b) => a.d - b.d);
    for (const { i, j } of wanted.slice(0, budget))
      this.chunks.set(`${i}:${j}`, this.build(w, i, j));
  }
  private build(w: World, i: number, j: number) {
    assets ??= sharedAssets();
    const low = this.low;
    const x0 = i * chunkSize,
      z0 = j * chunkSize;
    const chunk = new T.Group();
    chunk.name = `Countryside ${i},${j}`;
    chunk.userData.cx = x0 + chunkSize / 2;
    chunk.userData.cz = z0 + chunkSize / 2;
    const rand = random(Math.floor(hash2(i, j, 4201) * 4294967295));
    const roads = townRoads(w).filter(
      ({ a, b }) =>
        Math.max(a.x, b.x) >= x0 - 8 &&
        Math.min(a.x, b.x) <= x0 + chunkSize + 8 &&
        Math.max(a.z, b.z) >= z0 - 8 &&
        Math.min(a.z, b.z) <= z0 + chunkSize + 8,
    );
    const footprints = w.buildings
      .filter(
        (b) => Math.abs(b.x - chunk.userData.cx) < 300 && Math.abs(b.z - chunk.userData.cz) < 300,
      )
      .map((b) => {
        const bounds = buildingBounds(buildingPlan(b));
        return { b, radius: Math.max(bounds.width, bounds.depth) / 2 };
      });
    const grounds = worldResources(w).filter(
      (n) =>
        n.x >= x0 - 12 && n.x < x0 + chunkSize + 12 && n.z >= z0 - 12 && n.z < z0 + chunkSize + 12,
    );
    const clear = (x: number, z: number, margin: number) =>
      Math.max(Math.abs(x), Math.abs(z)) >= 250 &&
      (roads.length === 0 || roadDistance(roads, x, z) > margin) &&
      grounds.every((n) => Math.hypot(n.x - x, n.z - z) > 8 + margin) &&
      footprints.every(({ b, radius }) => Math.hypot(b.x - x, b.z - z) > radius + 2 + margin);
    const trunks: number[][] = [],
      crowns: number[][] = [],
      birches: number[][] = [],
      pines: EvergreenSite[] = [],
      rocks: number[][] = [],
      shades: T.Mesh[] = [];
    for (let n = 0; n < (low ? 230 : 540); n++) {
      const x = x0 + rand() * chunkSize,
        z = z0 + rand() * chunkSize,
        cover = woodland(w, x, z),
        roll = rand();
      const h = terrainHeight(w, x, z);
      if (h < w.settings.seaLevel + 0.9) continue;
      if (roll >= cover) {
        // Bare uplands show their bones.
        if (n % 9 === 0 && h > 14 && cover < 0.2 && clear(x, z, 1))
          rocks.push([x, h + 0.2, z, 0.5 + rand() * 1.1, rand() * 6]);
        continue;
      }
      if (!clear(x, z, 4)) continue;
      const scale = 0.7 + rand() * 0.9,
        species = hash2(Math.floor(x / 60), Math.floor(z / 50), 91) * 3;
      if (species < 1.25) {
        pines.push({
          x,
          y: h,
          z,
          scale,
          rotation: rand() * 6,
          variant: Math.floor(rand() * 3),
          width: 0.88 + rand() * 0.24,
          leanX: (rand() - 0.5) * 0.055,
          leanZ: (rand() - 0.5) * 0.055,
        });
        const shade = contactShadow(8 * scale, 8 * scale, 0.23);
        shade.position.set(x, h + 0.1, z);
        shades.push(shade);
        continue;
      }
      if (species < 2) birches.push([x, h, z, scale, 0]);
      else trunks.push([x, h, z, scale, rand() * 6]);
      for (let k = 0; k < 13; k++) {
        const a = k * 2.399,
          r = k < 4 ? 0.7 : species < 2 ? 1.4 : 2.4;
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
    const matrix = new T.Object3D();
    const scatter = (geometry: T.BufferGeometry, material: T.Material, points: number[][]) => {
      if (!points.length) return;
      const mesh = new T.InstancedMesh(geometry, material, points.length);
      points.forEach(([x, y, z, s = 1, rot = 0], k) => {
        matrix.position.set(x, y, z);
        matrix.scale.setScalar(s);
        matrix.rotation.set(0, rot, 0);
        matrix.updateMatrix();
        mesh.setMatrixAt(k, matrix.matrix);
        mesh.setColorAt(
          k,
          new T.Color().setRGB(0.8 + (k % 5) * 0.04, 0.84 + (k % 4) * 0.04, 0.75 + (k % 6) * 0.04),
        );
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      chunk.add(mesh);
    };
    scatter(assets.trunk, assets.trunkMaterial, trunks);
    scatter(assets.birch, assets.birchMaterial, birches);
    scatter(assets.leaves.geometry, assets.leaves.material, crowns);
    scatter(assets.rock, assets.rockMaterial, rocks);
    evergreens(chunk, pines, low, assets.evergreen, sharedEvergreenGeometry);
    resourceScenery(
      chunk,
      w,
      low,
      (n) =>
        Math.max(Math.abs(n.x), Math.abs(n.z)) >= 300 &&
        n.x >= x0 &&
        n.x < x0 + chunkSize &&
        n.z >= z0 &&
        n.z < z0 + chunkSize,
    );
    // Gathering-ground materials are fresh per chunk; snow and autumn apply to them too.
    chunk.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (
          (m instanceof T.MeshStandardMaterial || m instanceof T.MeshLambertMaterial) &&
          !m.transparent &&
          !m.userData.shared &&
          !m.userData.seasonal
        ) {
          m.userData.seasonal = true;
          seasonalMaterial(m, m.alphaTest > 0 && !m.userData.evergreen);
        }
    });
    if (shades.length) {
      const geos = shades.map((s) => {
        s.updateMatrix();
        return s.geometry.clone().applyMatrix4(s.matrix);
      });
      const merged = new T.Mesh(mergeGeometries(geos)!, (shades[0].material as T.Material).clone());
      chunk.add(merged);
      for (const g of geos) g.dispose();
      for (const s of shades) {
        s.geometry.dispose();
        (s.material as T.Material).dispose();
      }
    }
    this.group.add(chunk);
    return chunk;
  }
}
