import { sceneryChunk, sceneryChunkSize } from '../shared/scenery-obstacles';
import { sceneryInstances } from './scenery-instances';
import { SnowAccumulation } from './snow-accumulation';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { World } from '../shared/types';
import { mapHalf } from '../shared/terrain';
import { evergreens, evergreenMaterials, sharedEvergreenGeometry } from './evergreen';
import { foliage, random } from './scenery';
import { resourceScenery, updateResourceScenery } from './resource-scenery';
import { fadeSceneryIntoFog } from './scenery-fog';
import { contactShadow, seasonalMaterial, texture } from './materials';

export const chunkSize = sceneryChunkSize;
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
    fadeSceneryIntoFog(m);
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
  private pending?: { key: string; cx: number; cz: number; job: Generator<void, T.Group> };
  private low = false;
  private dirty = new Set<string>();
  private half = 0;
  reset(w: World, low: boolean) {
    this.clear();
    this.world = w;
    this.low = low;
    this.half = mapHalf(w);
  }
  refresh(w: World) {
    this.pending?.job.return(undefined as never);
    this.pending = undefined;
    this.world = w;
    this.dirty = new Set(this.chunks.keys());
  }
  clear() {
    this.dirty.clear();
    this.pending?.job.return(undefined as never);
    this.pending = undefined;
    for (const chunk of this.chunks.values()) this.drop(chunk);
    this.chunks.clear();
    this.world = undefined;
  }
  setWorld(w: World) {
    if (!this.world) return;
    this.world = w;
    for (const chunk of this.chunks.values()) updateResourceScenery(chunk, w);
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
    const deadline = performance.now() + 4;
    if (
      this.pending &&
      Math.hypot(this.pending.cx - x, this.pending.cz - z) > unloadRadius + chunkSize * 0.71
    ) {
      this.pending.job.return(undefined as never);
      this.pending = undefined;
    }
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
        if (this.chunks.has(`${i}:${j}`) && !this.dirty.has(`${i}:${j}`)) continue;
        const d = Math.hypot((i + 0.5) * chunkSize - x, (j + 0.5) * chunkSize - z);
        if (d <= loadRadius + chunkSize * 0.71) wanted.push({ i, j, d });
      }
    }
    wanted.sort((a, b) => a.d - b.d);
    let completed = 0;
    while (completed < budget) {
      if (!this.pending) {
        const next = wanted.find(
          ({ i, j }) => !this.chunks.has(`${i}:${j}`) || this.dirty.has(`${i}:${j}`),
        );
        if (!next) break;
        const { i, j } = next;
        this.pending = {
          key: `${i}:${j}`,
          cx: (i + 0.5) * chunkSize,
          cz: (j + 0.5) * chunkSize,
          job: this.build(w, i, j),
        };
      }
      const step = this.pending.job.next();
      if (step.done) {
        updateResourceScenery(step.value, this.world!);
        const old = this.chunks.get(this.pending.key);
        if (old) this.drop(old);
        this.chunks.set(this.pending.key, step.value);
        this.dirty.delete(this.pending.key);
        this.pending = undefined;
        completed++;
      }
      if (performance.now() >= deadline) break;
    }
    return (
      !!this.pending ||
      wanted.some(({ i, j }) => !this.chunks.has(`${i}:${j}`) || this.dirty.has(`${i}:${j}`))
    );
  }
  snowHeight(x: number, z: number, depth: number, base: number) {
    if (!this.world || Math.max(Math.abs(x), Math.abs(z)) < 240) return base;
    // Only query a neighbouring chunk when a trunk apron can cross its edge.
    let height = base;
    for (let a = Math.floor((x - 2) / chunkSize); a <= Math.floor((x + 2) / chunkSize); a++)
      for (let b = Math.floor((z - 2) / chunkSize); b <= Math.floor((z + 2) / chunkSize); b++) {
        const snow = this.chunks.get(`${a}:${b}`)?.userData.snowDetails as
          SnowAccumulation | undefined;
        if (snow) height = snow.heightAt(x, z, depth, height);
      }
    return height;
  }
  private *build(w: World, i: number, j: number) {
    assets ??= sharedAssets();
    const low = this.low;
    const x0 = i * chunkSize,
      z0 = j * chunkSize;
    const chunk = new T.Group();
    chunk.name = `Countryside ${i},${j}`;
    chunk.userData.cx = x0 + chunkSize / 2;
    chunk.userData.cz = z0 + chunkSize / 2;
    const objects = sceneryChunk(w, i, j).filter((o) => o.source === 'woodland');
    const {
      trunks,
      crowns,
      birches,
      pines,
      rocks,
      shades: shadowSites,
    } = sceneryInstances(objects, low);
    const shades: T.Mesh[] = [];
    let installed = false;
    try {
      for (const [n, site] of shadowSites.entries()) {
        if (n % 16 === 0) yield;
        const shade = contactShadow(site.size, site.size, site.opacity);
        shade.position.set(site.x, site.y, site.z);
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
            new T.Color().setRGB(
              0.8 + (k % 5) * 0.04,
              0.84 + (k % 4) * 0.04,
              0.75 + (k % 6) * 0.04,
            ),
          );
        });
        if (geometry === assets!.trunk || geometry === assets!.birch)
          mesh.userData.snowObstacle = 'tree';
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        chunk.add(mesh);
      };
      scatter(assets.trunk, assets.trunkMaterial, trunks);
      yield;
      scatter(assets.birch, assets.birchMaterial, birches);
      yield;
      scatter(assets.leaves.geometry, assets.leaves.material, crowns);
      yield;
      scatter(assets.rock, assets.rockMaterial, rocks);
      yield;
      evergreens(chunk, pines, low, assets.evergreen, sharedEvergreenGeometry);
      yield;
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
        loadRadius,
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
        const merged = new T.Mesh(
          mergeGeometries(geos)!,
          (shades[0].material as T.Material).clone(),
        );
        chunk.add(merged);
        for (const g of geos) g.dispose();
        for (const s of shades) {
          s.geometry.dispose();
          (s.material as T.Material).dispose();
        }
      }
      shades.length = 0;
      yield;
      const snow = new SnowAccumulation(w);
      yield* snow.collectSteps(chunk);
      chunk.add(yield* snow.finishSteps());
      chunk.userData.snowDetails = snow;
      // Fade individual trees/rocks before the streaming edge, not whole square chunks.
      chunk.traverse((object) => {
        if (object instanceof T.Mesh)
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            fadeSceneryIntoFog(material, loadRadius);
      });
      this.group.add(chunk);
      installed = true;
      return chunk;
    } finally {
      if (!installed) {
        for (const shade of shades) {
          shade.geometry.dispose();
          (shade.material as T.Material).dispose();
        }
        this.drop(chunk);
      }
    }
  }
}
