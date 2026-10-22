// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { mapHalf } from '../shared/terrain';
import { groundMaterial } from './materials';
import { prepareSnowSurface } from './snow-surface';

import { groundGeometry, groundTileSize } from './ground-geometry';
export { groundTileSize } from './ground-geometry';
// Detail stays local; the cheaper outer band supports everything the camera sees.
export const groundLoadRadius = 1040;
const loadRadius = groundLoadRadius,
  unloadRadius = 1200;
const detailRadius = 560,
  detailUnloadRadius = 680;

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
    const wanted: { i: number; j: number; d: number; detailed: boolean }[] = [];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const existing = this.tiles.get(`${i}:${j}`);
        const cx = (i + 0.5) * groundTileSize,
          cz = (j + 0.5) * groundTileSize,
          d = Math.hypot(cx - x, cz - z);
        const detailed = d <= (existing?.userData.detailed ? detailUnloadRadius : detailRadius);
        if (existing && existing.userData.detailed === detailed) continue;
        if (d <= loadRadius + groundTileSize * 0.71) wanted.push({ i, j, d, detailed });
      }
    // Nearest first, a few per frame: the horizon fills in over a handful of frames
    // instead of one long stall when arriving somewhere new.
    wanted.sort((a, b) => a.d - b.d);
    for (const { i, j, detailed } of wanted.slice(0, budget)) {
      const old = this.tiles.get(`${i}:${j}`);
      this.tiles.set(`${i}:${j}`, this.build(w, i, j, detailed));
      if (old) {
        this.group.remove(old);
        old.geometry.dispose();
        old.material.dispose();
      }
    }
    return wanted.length > budget;
  }
  private build(w: World, i: number, j: number, detailed: boolean) {
    const x0 = i * groundTileSize,
      z0 = j * groundTileSize;
    const cx = x0 + groundTileSize / 2,
      cz = z0 + groundTileSize / 2;
    const geometry = groundGeometry(w, cx, cz, detailed);
    prepareSnowSurface(geometry, w, cx, cz);
    const material = groundMaterial(w, {
      x: x0,
      z: z0,
      size: groundTileSize,
      pixels: detailed ? 256 : 64,
    });
    material.roughness = this.roughness;
    const tile = new T.Mesh(geometry, material);
    tile.position.set(cx, 0, cz);
    tile.receiveShadow = detailed;
    tile.userData.detailed = detailed;
    tile.userData.cx = cx;
    tile.userData.cz = cz;
    tile.userData.ground = true;
    this.group.add(tile);
    return tile;
  }
}

/** Open sea rides along under the camera so the coast always meets water, out to the fog. */
export const seaReach = 2300;
export function placeSea(sea: T.Object3D, x: number, z: number) {
  // Snap to the wave periods so the animated swell does not slide with the player.
  const px = (Math.PI * 2) / 0.15,
    pz = (Math.PI * 2) / 0.12;
  sea.position.x = Math.round(x / px) * px;
  sea.position.z = Math.round(z / pz) * pz;
}
