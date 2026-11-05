// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { mapHalf } from '../shared/terrain';
import { groundMaterial } from './materials';
import { prepareSnowSurfaceSteps } from './snow-surface';

import { groundGeometrySteps, groundTileSize } from './ground-geometry';
export { groundTileSize } from './ground-geometry';
// Detail stays local; the cheaper outer band supports everything the camera sees.
export const groundLoadRadius = 1040;
const loadRadius = groundLoadRadius,
  unloadRadius = 1200;
export interface GroundView {
  height: number;
  vx: number;
  vz: number;
  vy: number;
}
type Detail = boolean | 'medium';
const detailRadius = 560,
  detailUnloadRadius = 680;

/** Streams square terrain tiles around the player on maps too large for one plane.
 * Each tile carries its own baked lane/surface mask addressed in world metres, so
 * the look matches the compact village plane exactly where they would overlap. */
export class GroundTiles {
  constructor(private decorate: (mesh: T.Mesh) => void = () => {}) {}
  readonly group = new T.Group();
  revision = 0;
  private tiles = new Map<string, T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>>();
  private world?: World;
  private pending?: {
    key: string;
    cx: number;
    cz: number;
    detail: Detail;
    coarseFeatures: boolean;
    job: Generator<void, T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>>;
  };
  private dirty = new Set<string>();
  private half = 0;
  private roughness = 1;
  reset(w: World) {
    this.clear();
    this.world = w;
    this.half = mapHalf(w);
  }
  refresh(w: World) {
    this.pending?.job.return(undefined as never);
    this.pending = undefined;
    this.world = w;
    this.dirty = new Set(this.tiles.keys());
  }
  clear() {
    this.dirty.clear();
    this.revision++;
    this.pending?.job.return(undefined as never);
    this.pending = undefined;
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
  update(x: number, z: number, budget = 4, view?: GroundView) {
    const w = this.world;
    if (!w) return;
    const deadline = performance.now() + 4;
    const height = Math.max(0, view?.height ?? 0);
    const coarseFeatures = height > detailUnloadRadius;
    const aheadX = x + (view?.vx ?? 0) * 4,
      aheadZ = z + (view?.vz ?? 0) * 4;
    const detailAt = (cx: number, cz: number, existing?: T.Mesh): Detail => {
      const slant = Math.min(
        Math.hypot(cx - x, height, cz - z),
        Math.hypot(cx - aheadX, height, cz - aheadZ),
      );
      if (slant <= (existing?.userData.detailed ? detailUnloadRadius : detailRadius)) return true;
      // Only flight needs an intermediate band. Ground detail/hysteresis is unchanged.
      if (
        height > 0 &&
        height <= detailUnloadRadius &&
        slant <= (existing?.userData.detail === 'medium' ? 950 : 850)
      )
        return 'medium';
      return false;
    };
    if (
      this.pending &&
      (Math.hypot(this.pending.cx - x, this.pending.cz - z) >
        unloadRadius + groundTileSize * 0.71 ||
        this.pending.coarseFeatures !== coarseFeatures ||
        this.pending.detail !==
          detailAt(this.pending.cx, this.pending.cz, this.tiles.get(this.pending.key)))
    ) {
      this.pending.job.return(undefined as never);
      this.pending = undefined;
    }
    for (const [key, tile] of this.tiles) {
      const { cx, cz } = tile.userData as { cx: number; cz: number };
      if (Math.hypot(cx - x, cz - z) > unloadRadius + groundTileSize * 0.71) {
        tile.geometry.dispose();
        tile.material.dispose();
        this.group.remove(tile);
        this.tiles.delete(key);
        this.revision++;
      }
    }
    const lo = Math.floor((-this.half - 1) / groundTileSize),
      hi = Math.ceil((this.half + 1) / groundTileSize);
    const i0 = Math.max(lo, Math.floor((x - loadRadius) / groundTileSize)),
      i1 = Math.min(hi - 1, Math.floor((x + loadRadius) / groundTileSize)),
      j0 = Math.max(lo, Math.floor((z - loadRadius) / groundTileSize)),
      j1 = Math.min(hi - 1, Math.floor((z + loadRadius) / groundTileSize));
    const wanted: { i: number; j: number; d: number; detailed: Detail }[] = [];
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const existing = this.tiles.get(`${i}:${j}`);
        const cx = (i + 0.5) * groundTileSize,
          cz = (j + 0.5) * groundTileSize,
          d = Math.hypot(cx - x, cz - z);
        const detailed = detailAt(cx, cz, existing);
        if (
          existing &&
          existing.userData.detail === detailed &&
          existing.userData.coarseFeatures === coarseFeatures &&
          !this.dirty.has(`${i}:${j}`)
        )
          continue;
        if (d <= loadRadius + groundTileSize * 0.71) {
          // Landing ground wins over outward streaming; otherwise prepare towards velocity.
          const priority =
            view && view.vy < 0 && d < 200
              ? d - 1000
              : Math.min(d, Math.hypot(cx - aheadX, cz - aheadZ) + 80);
          wanted.push({ i, j, d: priority, detailed });
        }
      }
    // Retain the old LOD until its replacement is complete. Bound CPU work by
    // elapsed time as well as tile count; one dense cliff tile spans many frames.
    wanted.sort((a, b) => a.d - b.d);
    let completed = 0;
    while (completed < budget) {
      if (!this.pending) {
        const next = wanted.find(({ i, j, detailed }) => {
          const tile = this.tiles.get(`${i}:${j}`);
          return (
            this.dirty.has(`${i}:${j}`) ||
            tile?.userData.detail !== detailed ||
            tile?.userData.coarseFeatures !== coarseFeatures
          );
        });
        if (!next) break;
        const { i, j, detailed } = next;
        this.pending = {
          key: `${i}:${j}`,
          cx: (i + 0.5) * groundTileSize,
          cz: (j + 0.5) * groundTileSize,
          detail: detailed,
          coarseFeatures,
          job: this.build(w, i, j, detailed, coarseFeatures),
        };
      }
      const step = this.pending.job.next();
      if (step.done) {
        const old = this.tiles.get(this.pending.key);
        this.tiles.set(this.pending.key, step.value);
        this.dirty.delete(this.pending.key);
        this.revision++;
        this.pending = undefined;
        if (old) {
          this.group.remove(old);
          old.geometry.dispose();
          old.material.dispose();
        }
        completed++;
      }
      if (performance.now() >= deadline) break;
    }
    return (
      !!this.pending ||
      wanted.some(({ i, j, detailed }) => {
        const tile = this.tiles.get(`${i}:${j}`);
        return (
          this.dirty.has(`${i}:${j}`) ||
          tile?.userData.detail !== detailed ||
          tile?.userData.coarseFeatures !== coarseFeatures
        );
      })
    );
  }
  private *build(w: World, i: number, j: number, detailed: Detail, coarseFeatures: boolean) {
    const x0 = i * groundTileSize,
      z0 = j * groundTileSize;
    const cx = x0 + groundTileSize / 2,
      cz = z0 + groundTileSize / 2;
    const geometry = yield* groundGeometrySteps(w, cx, cz, detailed, coarseFeatures);
    let installed = false;
    try {
      yield* prepareSnowSurfaceSteps(geometry, w, cx, cz);
      yield;
      const material = groundMaterial(w, {
        x: x0,
        z: z0,
        size: groundTileSize,
        pixels: 256,
      });
      material.roughness = this.roughness;
      const tile = new T.Mesh(geometry, material);
      tile.position.set(cx, 0, cz);
      tile.receiveShadow = detailed === true;
      tile.userData.detailed = detailed === true;
      tile.userData.detail = detailed;
      tile.userData.coarseFeatures = coarseFeatures;
      tile.userData.cx = cx;
      tile.userData.cz = cz;
      tile.userData.ground = true;
      this.decorate(tile);
      this.group.add(tile);
      installed = true;
      return tile;
    } finally {
      if (!installed) geometry.dispose();
    }
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
