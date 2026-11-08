import { alpineSnowUniforms, updateAlpineSnow } from './alpine-snow';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { landBounds, terrainHeight, mapHalf } from '../shared/terrain';
import { nearBluff } from '../shared/coastal-bluffs';
import { refractedEarthRadius } from '../shared/marine-visibility';
import type { GroundTiles } from './ground';

/** One low-cost island mesh, without trees, textures, buildings or shadow maps.
 * Towns share the countryside resolution. Coastal headlands retain their
 * supporting cliff samples for offshore navigation. Shared
 * edge samples stitch fine/coarse cells without cracks. Preparation is yielded.
 */
export function* horizonGeometry(w: World): Generator<void, T.BufferGeometry> {
  const bounds = landBounds(w);
  const step = Math.max(
    64,
    Math.ceil(Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 256 / 8) * 8,
  );
  const originX = Math.floor(bounds.minX / step) * step - step,
    originZ = Math.floor(bounds.minZ / step) * step - step;
  const nx = Math.ceil((bounds.maxX - originX) / step) + 1,
    nz = Math.ceil((bounds.maxZ - originZ) / step) + 1;
  const fine = new Uint8Array(nx * nz);
  for (let z = 0; z < nz; z++) {
    for (let x = 0; x < nx; x++)
      fine[z * nx + x] = Number(
        nearBluff(w, originX + (x + 0.5) * step, originZ + (z + 0.5) * step, step),
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
  const refined = (x: number, z: number) =>
    x >= 0 && x < nx && z >= 0 && z < nz && fine[z * nx + x];
  const divisions = Math.ceil(step / 8);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const x = originX + i * step,
        z = originZ + j * step;
      if (fine[j * nx + i]) {
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

/** Keep the existing sampled surface, but give the renderer bounded pieces to cull.
 * Copy original normals at shared borders so lighting cannot expose chunk seams. */
function* horizonSections(w: World): Generator<void, T.BufferGeometry[]> {
  const source = yield* horizonGeometry(w);
  const sections: T.BufferGeometry[] = [];
  let complete = false;
  try {
    const position = source.getAttribute('position'),
      normal = source.getAttribute('normal');
    const buckets = new Map<
      string,
      { vertices: Map<number, number>; positions: number[]; normals: number[]; indices: number[] }
    >();
    // Renderer organization only; the terrain sampling resolution stays unchanged.
    const span = 2048;
    for (let i = 0; i < source.index!.count; i += 3) {
      const ids = [source.index!.getX(i), source.index!.getX(i + 1), source.index!.getX(i + 2)];
      const x = ids.reduce((n, id) => n + position.getX(id), 0) / 3;
      const z = ids.reduce((n, id) => n + position.getZ(id), 0) / 3;
      const key = Math.floor(x / span) + ':' + Math.floor(z / span);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { vertices: new Map(), positions: [], normals: [], indices: [] };
        buckets.set(key, bucket);
      }
      for (const id of ids) {
        let mapped = bucket.vertices.get(id);
        if (mapped === undefined) {
          mapped = bucket.positions.length / 3;
          bucket.vertices.set(id, mapped);
          bucket.positions.push(position.getX(id), position.getY(id), position.getZ(id));
          bucket.normals.push(normal.getX(id), normal.getY(id), normal.getZ(id));
        }
        bucket.indices.push(mapped);
      }
      if (i % 1536 === 0) yield;
    }
    for (const bucket of buckets.values()) {
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(bucket.positions, 3));
      geometry.setAttribute('normal', new T.Float32BufferAttribute(bucket.normals, 3));
      geometry.setIndex(bucket.indices);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      sections.push(geometry);
      yield;
    }
    complete = true;
    return sections;
  } finally {
    source.dispose();
    if (!complete) for (const geometry of sections) geometry.dispose();
  }
}

export class HorizonLand {
  readonly group = new T.Group();
  private job?: Generator<void, T.BufferGeometry[]>;
  private land: T.Mesh<T.BufferGeometry, T.MeshLambertMaterial>[] = [];
  private curvedBounds = new T.Box3();
  private material?: T.MeshLambertMaterial;
  private coverage?: T.DataTexture;
  private origin = 0;
  private cells = 0;
  private revision = -1;
  private sea?: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
  private level = { value: 0 };
  private snow = { value: 0 };
  private alpine?: ReturnType<typeof alpineSnowUniforms>;
  reset(w: World) {
    this.job?.return(undefined as never);
    const materials = new Set<T.Material>();
    this.group.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        materials.add(o.material);
      }
    });
    if (this.material) materials.add(this.material);
    for (const material of materials) material.dispose();
    this.land = [];
    this.coverage?.dispose();
    this.group.clear();
    this.job = horizonSections(w);
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
    const alpine = (this.alpine = alpineSnowUniforms(w));
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, {
        terrainCoverage: { value: this.coverage },
        coverageOrigin: { value: this.origin },
        coverageExtent: { value: this.cells * 128 },
        seaLevel: this.level,
        snowCover: this.snow,
        ...alpine,
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
        'varying vec3 originalPosition;uniform sampler2D terrainCoverage;uniform float coverageOrigin;uniform float coverageExtent;uniform float seaLevel;uniform float snowCover;uniform float alpineEnabled;uniform float alpineSnowStart;uniform float alpineSnowFull;\n' +
        shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
        if(originalPosition.y<seaLevel-.25) discard;
        vec2 uv=(originalPosition.xz-coverageOrigin)/coverageExtent;
        if(all(greaterThanEqual(uv,vec2(0.)))&&all(lessThan(uv,vec2(1.)))&&texture2D(terrainCoverage,uv).r>.5) discard;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.48,.50,.49),smoothstep(750.,1120.,originalPosition.y));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.84,.86,.81),max(snowCover,alpineEnabled*smoothstep(alpineSnowStart,alpineSnowFull,originalPosition.y-seaLevel)));`,
        );
    };
    material.customProgramCacheKey = () => 'island-horizon-v3';
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
        for (const geometry of step.value) {
          const mesh = new T.Mesh(geometry, this.material!);
          // The first update supplies bounds for the shader's geographic curvature.
          mesh.frustumCulled = false;
          mesh.name = 'Island silhouette and supporting terrain';
          this.land.push(mesh);
          this.group.add(mesh);
          mesh.updateWorldMatrix(true, false);
          mesh.matrixAutoUpdate = mesh.matrixWorldAutoUpdate = false;
        }
        this.job = undefined;
        break;
      }
      if (performance.now() >= deadline) break;
    }
    return !!this.job;
  }
  update(w: World, camera: T.Camera, ground: GroundTiles, level: number, daylight: number) {
    this.prepare();
    for (const mesh of this.land) {
      const box = mesh.geometry.boundingBox!;
      const nearX = Math.max(box.min.x - camera.position.x, 0, camera.position.x - box.max.x);
      const nearZ = Math.max(box.min.z - camera.position.z, 0, camera.position.z - box.max.z);
      const farX = Math.max(
        Math.abs(box.min.x - camera.position.x),
        Math.abs(box.max.x - camera.position.x),
      );
      const farZ = Math.max(
        Math.abs(box.min.z - camera.position.z),
        Math.abs(box.max.z - camera.position.z),
      );
      // Expand around the entire curved surface, not just its undeformed mesh.
      this.curvedBounds.copy(box);
      this.curvedBounds.min.y -= (farX * farX + farZ * farZ) / (2 * refractedEarthRadius);
      this.curvedBounds.max.y -= (nearX * nearX + nearZ * nearZ) / (2 * refractedEarthRadius);
      this.curvedBounds.getBoundingSphere(mesh.geometry.boundingSphere!);
      mesh.frustumCulled = true;
    }
    this.level.value = level;
    this.snow.value = w.climate?.snow ?? 0;
    if (this.alpine) updateAlpineSnow(this.alpine, w);
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
