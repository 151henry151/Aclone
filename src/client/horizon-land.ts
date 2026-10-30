// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { terrainHalf, terrainHeight, mapHalf } from '../shared/terrain';
import { nearBluff } from '../shared/coastal-bluffs';
import { refractedEarthRadius } from '../shared/marine-visibility';
import type { GroundTiles } from './ground';

/** One low-cost island mesh, without trees, textures, buildings or shadow maps.
 * Fine cells under buildings/headlands retain their supporting land. Shared
 * edge samples stitch fine/coarse cells without cracks. Preparation is yielded.
 */
export function* horizonGeometry(w: World): Generator<void, T.BufferGeometry> {
  const step = Math.max(64, Math.ceil(terrainHalf(w) / 128 / 8) * 8);
  const half = Math.ceil((terrainHalf(w) + step) / step) * step;
  const n = Math.round((2 * half) / step),
    fine = new Uint8Array(n * n);
  const buildings = new Set<string>();
  for (const b of w.buildings) {
    for (
      let z = Math.floor((b.z - 64 + half) / step);
      z <= Math.floor((b.z + 64 + half) / step);
      z++
    )
      for (
        let x = Math.floor((b.x - 64 + half) / step);
        x <= Math.floor((b.x + 64 + half) / step);
        x++
      )
        buildings.add(x + ':' + z);
  }
  for (let z = 0; z < n; z++) {
    for (let x = 0; x < n; x++)
      fine[z * n + x] = Number(
        buildings.has(x + ':' + z) ||
          nearBluff(w, -half + (x + 0.5) * step, -half + (z + 0.5) * step, step),
      );
    yield;
  }
  const positions: number[] = [],
    indices: number[] = [],
    cache = new Map<string, number>();
  const vertex = (x: number, z: number) => {
    const key = x + ':' + z;
    let i = cache.get(key);
    if (i === undefined) {
      i = positions.length / 3;
      positions.push(x, terrainHeight(w, x, z), z);
      cache.set(key, i);
    }
    return i;
  };
  const refined = (x: number, z: number) => x >= 0 && x < n && z >= 0 && z < n && fine[z * n + x];
  const divisions = Math.ceil(step / 8);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = -half + i * step,
        z = -half + j * step;
      if (fine[j * n + i]) {
        const h = step / divisions;
        for (let b = 0; b < divisions; b++) {
          for (let a = 0; a < divisions; a++) {
            const ax = x + a * h,
              bz = z + b * h;
            const p = vertex(ax, bz),
              q = vertex(ax, bz + h),
              r = vertex(ax + h, bz + h),
              s = vertex(ax + h, bz);
            indices.push(p, q, r, p, r, s);
          }
          yield;
        }
      } else {
        const centre = vertex(x + step / 2, z + step / 2),
          edge: number[] = [];
        const sides = [
          [x, z, x, z + step, refined(i - 1, j)],
          [x, z + step, x + step, z + step, refined(i, j + 1)],
          [x + step, z + step, x + step, z, refined(i + 1, j)],
          [x + step, z, x, z, refined(i, j - 1)],
        ] as const;
        for (const [ax, az, bx, bz, detail] of sides) {
          const count = detail ? divisions : 1;
          for (let k = 0; k < count; k++)
            edge.push(vertex(ax + ((bx - ax) * k) / count, az + ((bz - az) * k) / count));
        }
        for (let k = 0; k < edge.length; k++)
          indices.push(centre, edge[k], edge[(k + 1) % edge.length]);
      }
      if (i % 16 === 15) yield;
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export class HorizonLand {
  readonly group = new T.Group();
  private job?: Generator<void, T.BufferGeometry>;
  private material?: T.MeshLambertMaterial;
  private coverage?: T.DataTexture;
  private origin = 0;
  private cells = 0;
  private revision = -1;
  private sea?: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  private level = { value: 0 };
  private snow = { value: 0 };
  reset(w: World) {
    this.job?.return(undefined as never);
    this.group.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    this.coverage?.dispose();
    this.group.clear();
    this.job = horizonGeometry(w);
    this.origin = Math.floor((-mapHalf(w) - 128) / 128) * 128;
    this.cells = Math.ceil((mapHalf(w) + 128 - this.origin) / 128);
    this.coverage = new T.DataTexture(
      new Uint8Array(this.cells * this.cells),
      this.cells,
      this.cells,
      T.RedFormat,
    );
    this.coverage.needsUpdate = true;
    this.revision = -1;
    this.level.value = w.settings.seaLevel;
    const material = (this.material = new T.MeshLambertMaterial({ color: '#687350' }));
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        terrainCoverage: { value: this.coverage },
        coverageOrigin: { value: this.origin },
        coverageExtent: { value: this.cells * 128 },
        seaLevel: this.level,
        snowCover: this.snow,
      });
      shader.vertexShader =
        'varying vec3 originalPosition;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
        originalPosition=position;
        float d=length(position.xz-cameraPosition.xz);
        transformed.y-=d*d/${(2 * refractedEarthRadius).toFixed(1)};`,
        );
      shader.fragmentShader =
        'varying vec3 originalPosition;uniform sampler2D terrainCoverage;uniform float coverageOrigin;uniform float coverageExtent;uniform float seaLevel;uniform float snowCover;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        if(originalPosition.y<seaLevel-.25) discard;
        vec2 uv=(originalPosition.xz-coverageOrigin)/coverageExtent;
        if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThan(uv,vec2(1.)))&&texture2D(terrainCoverage,uv).r>.5) discard;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.84,.86,.81),snowCover);`,
        );
    };
    material.customProgramCacheKey = () => 'island-horizon-v1';
    // Curved distant sea hides the bottoms of hills first as they go over the
    // horizon. It adds no wave simulation, depth sampling or transparent pass.
    const vertices: number[] = [],
      indices: number[] = [];
    const rings = 80,
      segments = 128;
    for (let r = 0; r <= rings; r++) {
      const radius = 1100 + 69000 * (r / rings) ** 2;
      for (let a = 0; a <= segments; a++) {
        const angle = (a / segments) * Math.PI * 2;
        vertices.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        if (r < rings && a < segments) {
          const p = r * (segments + 1) + a,
            q = p + segments + 1;
          indices.push(p, p + 1, q, p + 1, q + 1, q);
        }
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    g.setIndex(indices);
    const m = new T.MeshBasicMaterial({ color: '#32727c', side: T.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed.y-=dot(position.xz,position.xz)/${(2 * refractedEarthRadius).toFixed(1)};`,
      );
    };
    m.customProgramCacheKey = () => 'curved-sea-horizon-v1';
    this.sea = new T.Mesh(g, m);
    this.sea.frustumCulled = false;
    this.group.add(this.sea);
    this.group.name = 'Distant island and geographic sea horizon';
  }
  prepare(budget = 3) {
    const deadline = performance.now() + budget;
    while (this.job) {
      const step = this.job.next();
      if (step.done) {
        const mesh = new T.Mesh(step.value, this.material!);
        mesh.frustumCulled = false;
        mesh.name = 'Island silhouette and supporting terrain';
        this.group.add(mesh);
        this.job = undefined;
        break;
      }
      if (performance.now() >= deadline) break;
    }
    return !!this.job;
  }
  update(w: World, camera: T.Camera, ground: GroundTiles, level: number, daylight: number) {
    this.prepare();
    this.level.value = level;
    this.snow.value = w.climate?.snow ?? 0;
    if (this.sea) {
      this.sea.position.set(camera.position.x, level, camera.position.z);
      this.sea.material.color.set('#32727c').multiplyScalar(0.12 + 0.88 * daylight);
    }
    if (this.coverage && this.revision !== ground.revision) {
      const pixels = this.coverage.image.data as Uint8Array;
      pixels.fill(0);
      for (const tile of ground.meshes) {
        const x = Math.floor((tile.userData.cx - this.origin) / 128),
          z = Math.floor((tile.userData.cz - this.origin) / 128);
        if (x >= 0 && x < this.cells && z >= 0 && z < this.cells) pixels[z * this.cells + x] = 255;
      }
      this.coverage.needsUpdate = true;
      this.revision = ground.revision;
    }
  }
}
