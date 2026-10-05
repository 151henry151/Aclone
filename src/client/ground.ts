// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { terrainHeight, mapHalf } from '../shared/terrain';
import { groundMaterial } from './materials';

export const groundTileSize = 128;
const segments = 32;
/** Tiles load a little past the clear-weather fog and unload further out, so
 * pacing back and forth along a tile edge does not thrash the bake. */
const loadRadius = 560,
  unloadRadius = 720;

/** Streams square terrain tiles around the player on maps too large for one plane.
 * Each tile carries its own baked lane/surface mask addressed in world metres, so
 * the look matches the compact village plane exactly where they would overlap. */
export class GroundTiles {
  readonly group = new T.Group();
  private tiles = new Map<string, T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>>();
  private world?: World;
  private half = 0;
  private roughness = 1;
  reset(w: World) {
    this.clear();
    this.world = w;
    this.half = mapHalf(w);
  }
  clear() {
    for (const tile of this.tiles.values()) {
      tile.geometry.dispose();
      tile.material.dispose();
      this.group.remove(tile);
    }
    this.tiles.clear();
    this.world = undefined;
  }
  get active() {
    return !!this.world;
  }
  get meshes() {
    return [...this.tiles.values()];
  }
  setRoughness(value: number) {
    if (value === this.roughness) return;
    this.roughness = value;
    for (const tile of this.tiles.values()) tile.material.roughness = value;
  }
  /** Add tiles that came within reach of (x, z) and drop the ones left far behind. */
  update(x: number, z: number, budget = 4) {
    const w = this.world;
    if (!w) return;
    for (const [key, tile] of this.tiles) {
      const { cx, cz } = tile.userData as { cx: number; cz: number };
      if (Math.hypot(cx - x, cz - z) > unloadRadius + groundTileSize * 0.71) {
        tile.geometry.dispose();
        tile.material.dispose();
        this.group.remove(tile);
        this.tiles.delete(key);
      }
    }
    const lo = Math.floor((-this.half - 1) / groundTileSize),
      hi = Math.ceil((this.half + 1) / groundTileSize);
    const i0 = Math.max(lo, Math.floor((x - loadRadius) / groundTileSize)),
      i1 = Math.min(hi - 1, Math.floor((x + loadRadius) / groundTileSize)),
      j0 = Math.max(lo, Math.floor((z - loadRadius) / groundTileSize)),
      j1 = Math.min(hi - 1, Math.floor((z + loadRadius) / groundTileSize));
    const wanted: { i: number; j: number; d: number }[] = [];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        if (this.tiles.has(`${i}:${j}`)) continue;
        const cx = (i + 0.5) * groundTileSize,
          cz = (j + 0.5) * groundTileSize,
          d = Math.hypot(cx - x, cz - z);
        if (d <= loadRadius + groundTileSize * 0.71) wanted.push({ i, j, d });
      }
    // Nearest first, a few per frame: the horizon fills in over a handful of frames
    // instead of one long stall when arriving somewhere new.
    wanted.sort((a, b) => a.d - b.d);
    for (const { i, j } of wanted.slice(0, budget))
      this.tiles.set(`${i}:${j}`, this.build(w, i, j));
  }
  private build(w: World, i: number, j: number) {
    const x0 = i * groundTileSize,
      z0 = j * groundTileSize;
    const geometry = new T.PlaneGeometry(groundTileSize, groundTileSize, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const pos = geometry.attributes.position,
      normal = geometry.attributes.normal;
    const cx = x0 + groundTileSize / 2,
      cz = z0 + groundTileSize / 2;
    for (let k = 0; k < pos.count; k++) {
      const x = cx + pos.getX(k),
        z = cz + pos.getZ(k);
      pos.setY(k, terrainHeight(w, x, z));
      // Analytic normals agree across tile seams, unlike per-tile averaged face normals.
      const dx = terrainHeight(w, x + 0.75, z) - terrainHeight(w, x - 0.75, z),
        dz = terrainHeight(w, x, z + 0.75) - terrainHeight(w, x, z - 0.75);
      const n = new T.Vector3(-dx / 1.5, 1, -dz / 1.5).normalize();
      normal.setXYZ(k, n.x, n.y, n.z);
    }
    const material = groundMaterial(w, {
      x: x0,
      z: z0,
      size: groundTileSize,
      pixels: 256,
    });
    material.roughness = this.roughness;
    const tile = new T.Mesh(geometry, material);
    tile.position.set(cx, 0, cz);
    tile.receiveShadow = true;
    tile.userData.cx = cx;
    tile.userData.cz = cz;
    tile.userData.ground = true;
    this.group.add(tile);
    return tile;
  }
}

/** Open sea rides along under the camera so the coast always meets water, out to the fog. */
export const seaReach = 1600;
export function placeSea(sea: T.Object3D, x: number, z: number) {
  // Snap to the wave periods so the animated swell does not slide with the player.
  const px = (Math.PI * 2) / 0.15,
    pz = (Math.PI * 2) / 0.12;
  sea.position.x = Math.round(x / px) * px;
  sea.position.z = Math.round(z / pz) * pz;
}
