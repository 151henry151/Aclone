// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { buildingPlan } from '../shared/building-shapes';
import { townRoads, roadDistance } from '../shared/town';
import { terrainHeight } from '../shared/terrain';
import { snowTrackHeight } from './snow-surface';
import { snowDepthVisual } from './materials';

type Vertex = { x: number; y: number; z: number; lift: number; opacity?: number };
type Triangle = [Vertex, Vertex, Vertex];
const cellSize = 4;

/** Static, low-poly snow shells. Only the depth uniform changes during snowfall/thaw.
 * Roof edges are closed; ground drifts have a small footprint and meet the terrain.
 * Two shared batches cover a town; streamed groves need only one. Both hide on bare ground. */
export class SnowAccumulation {
  readonly group = new T.Group();
  private positions: number[] = [];
  private lifts: number[] = [];
  private opacity: number[] = [];
  private smooth: boolean[] = [];
  private ground = new Map<string, Triangle[]>();
  private seen = new WeakSet<T.Object3D>();
  private bare: (x: number, z: number) => number;
  private snowy: (x: number, z: number) => number;
  private roads;
  constructor(private world: World) {
    this.group.name = 'Accumulated snow';
    this.group.userData.snowAccumulation = true;
    this.group.visible = snowDepthVisual.value > 0.001;
    this.bare = snowTrackHeight({ ...world, climate: { snow: 0, snowDepth: 0, wetness: 0 } });
    this.snowy = snowTrackHeight({ ...world, climate: { snow: 1, snowDepth: 1, wetness: 0 } });
    this.roads = townRoads(world);
  }
  private triangle(a: Vertex, b: Vertex, c: Vertex, ground = false) {
    // Consistent upward winding for ground; closed roof skirts supply their own.
    if (ground && (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z) < 0) [b, c] = [c, b];
    for (const p of [a, b, c]) {
      this.positions.push(p.x, p.y, p.z);
      this.lifts.push(p.lift);
      this.opacity.push(p.opacity ?? 1);
      this.smooth.push(ground);
    }
    if (!ground) return;
    const tri: Triangle = [a, b, c];
    for (
      let x = Math.floor(Math.min(a.x, b.x, c.x) / cellSize);
      x <= Math.floor(Math.max(a.x, b.x, c.x) / cellSize);
      x++
    )
      for (
        let z = Math.floor(Math.min(a.z, b.z, c.z) / cellSize);
        z <= Math.floor(Math.max(a.z, b.z, c.z) / cellSize);
        z++
      ) {
        const key = `${x}:${z}`,
          list = this.ground.get(key) ?? [];
        list.push(tri);
        this.ground.set(key, list);
      }
  }
  private surface(x: number, z: number, extra: number): Vertex {
    const y = this.bare(x, z);
    return {
      x,
      z,
      y: y + 0.002,
      lift: this.snowy(x, z) - y + extra,
      opacity: Math.min(1, extra / 0.15),
    };
  }
  private allowed(x: number, z: number) {
    return (
      terrainHeight(this.world, x, z) > this.world.settings.seaLevel + 0.2 &&
      roadDistance(this.roads, x, z) > 0.08
    );
  }
  /** Query the same triangles the GPU lifts so tyres/shadows don't sink into a bank. */
  heightAt(x: number, z: number, depth: number, base: number) {
    if (depth <= 0.001) return base;
    let height = base;
    for (const [a, b, c] of this.ground.get(
      `${Math.floor(x / cellSize)}:${Math.floor(z / cellSize)}`,
    ) ?? []) {
      const det = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
      if (Math.abs(det) < 1e-8) continue;
      const u = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / det;
      const v = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / det;
      if (u < 0 || v < 0 || u + v > 1) continue;
      height = Math.max(
        height,
        u * (a.y + a.lift * depth) +
          v * (b.y + b.lift * depth) +
          (1 - u - v) * (c.y + c.lift * depth),
      );
    }
    return height;
  }
  /** Shallow wind-packed apron around a trunk or fence post. */
  mound(x: number, z: number, radius: number) {
    if (!this.allowed(x, z)) return;
    const rings = [0, 0.3, 0.65, 1];
    const at = (r: number, a: number) => {
      const px = x + Math.cos(a) * r * radius,
        pz = z + Math.sin(a) * r * radius;
      return this.surface(px, pz, 0.6 * (1 - r) * (1 - r));
    };
    for (let row = 0; row < rings.length - 1; row++)
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6,
          b = ((i + 1) * Math.PI) / 6;
        const p = at(rings[row]!, a),
          q = at(rings[row + 1]!, a),
          r = at(rings[row + 1]!, b),
          s = at(rings[row]!, b);
        if (![p, q, r, s].every((v) => this.allowed(v.x, v.z))) continue;
        this.triangle(p, q, r, true);
        this.triangle(p, r, s, true);
      }
  }
  /** Extract upward roof faces and close their exposed perimeter with a snow lip. */
  cap(mesh: T.Mesh, matrix = mesh.matrixWorld, retention = 0.75) {
    if (Array.isArray(mesh.material)) return;
    const source = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const p = source.getAttribute('position');
    const edges = new Map<string, { a: T.Vector3; b: T.Vector3; count: number }>();
    const key = (v: T.Vector3) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
    const vertex = (v: T.Vector3, lift: number): Vertex => ({
      x: v.x,
      y: v.y + 0.002,
      z: v.z,
      lift,
    });
    for (let i = 0; i < p.count; i += 3) {
      let [a, b, c] = [0, 1, 2].map((j) =>
        new T.Vector3().fromBufferAttribute(p, i + j).applyMatrix4(matrix),
      ) as [T.Vector3, T.Vector3, T.Vector3];
      let normal = new T.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
      if (normal.y < 0 && mesh.material.side === T.DoubleSide) {
        [b, c] = [c, b];
        normal.negate();
      }
      if (normal.y < 0.25) continue;
      this.triangle(vertex(a, retention), vertex(b, retention), vertex(c, retention));
      for (const [u, v] of [
        [a, b],
        [b, c],
        [c, a],
      ]) {
        const k = [key(u!), key(v!)].sort().join('|'),
          old = edges.get(k);
        if (old) old.count++;
        else edges.set(k, { a: u!, b: v!, count: 1 });
      }
    }
    for (const { a, b, count } of edges.values())
      if (count === 1) {
        this.triangle(vertex(a, 0), vertex(b, 0), vertex(b, retention));
        this.triangle(vertex(a, 0), vertex(b, retention), vertex(a, retention));
      }
    if (source !== mesh.geometry) source.dispose();
  }
  collect(root: T.Object3D) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!(o instanceof T.Mesh) || this.seen.has(o)) return;
      const cap = o.userData.snowCap as number | undefined;
      const obstacle = o.userData.snowObstacle as 'tree' | 'post' | undefined;
      if (!cap && !obstacle) return;
      this.seen.add(o);
      const matrices: T.Matrix4[] = [];
      if (o instanceof T.InstancedMesh)
        for (let i = 0; i < o.count; i++) {
          const m = new T.Matrix4();
          o.getMatrixAt(i, m);
          matrices.push(m.premultiply(o.matrixWorld));
        }
      else matrices.push(o.matrixWorld);
      for (const m of matrices) {
        if (cap) this.cap(o, m, cap);
        if (obstacle) {
          const position = new T.Vector3().setFromMatrixPosition(m);
          const radius =
            obstacle === 'tree'
              ? Math.min(2, Math.max(0.6, new T.Vector3().setFromMatrixScale(m).x * 1.15))
              : 0.45;
          this.mound(position.x, position.z, radius);
        }
      }
    });
  }
  foundations() {
    for (const b of this.world.buildings) {
      if (b.construction || b.creatorModel) continue;
      const volumes = buildingPlan(b).volumes;
      const world = (x: number, z: number) => ({
        x: b.x + x * Math.cos(b.rotation) + z * Math.sin(b.rotation),
        z: b.z - x * Math.sin(b.rotation) + z * Math.cos(b.rotation),
      });
      for (const v of volumes)
        for (const side of [-1, 1])
          for (const axis of ['x', 'z'] as const) {
            const length = axis === 'x' ? v.depth : v.width,
              half = (axis === 'x' ? v.width : v.depth) / 2;
            const steps = Math.ceil(length / 2);
            const point = (along: number, out: number) => {
              const x = v.x + (axis === 'x' ? side * (half + out) : along),
                z = v.z + (axis === 'z' ? side * (half + out) : along);
              return { ...world(x, z), localX: x, localZ: z };
            };
            for (let i = 0; i < steps; i++) {
              const lo = -length / 2 + (i * length) / steps,
                hi = -length / 2 + ((i + 1) * length) / steps,
                mid = point((lo + hi) / 2, 0.2);
              // Leave a clear doorway and don't create buried aprons between joined wings.
              if (axis === 'z' && side === 1 && Math.abs((lo + hi) / 2) < 1.6) continue;
              if (
                volumes.some(
                  (other) =>
                    other !== v &&
                    Math.abs(mid.localX - other.x) < other.width / 2 + 0.1 &&
                    Math.abs(mid.localZ - other.z) < other.depth / 2 + 0.1,
                )
              )
                continue;
              const rows = [0.03, 0.4, 1.1];
              for (let j = 0; j < 2; j++) {
                const points = [
                  [lo, rows[j]!],
                  [hi, rows[j]!],
                  [hi, rows[j + 1]!],
                  [lo, rows[j + 1]!],
                ].map(([a, d]) => {
                  const p = point(a!, d!);
                  return this.surface(p.x, p.z, 0.65 * Math.pow(1 - d! / 1.1, 2));
                });
                if (!points.every((p) => this.allowed(p.x, p.z))) continue;
                this.triangle(points[0]!, points[1]!, points[2]!, true);
                this.triangle(points[0]!, points[2]!, points[3]!, true);
              }
            }
          }
    }
  }
  verges() {
    for (const road of this.roads) {
      const dx = road.b.x - road.a.x,
        dz = road.b.z - road.a.z,
        length = Math.hypot(dx, dz);
      if (length < 0.1) continue;
      const steps = Math.ceil(length / 3),
        offsets = [0.1, 0.35, 0.75, 1.4, 2.3, 3.3];
      for (const side of [-1, 1])
        for (let i = 0; i < steps; i++)
          for (let j = 0; j < offsets.length - 1; j++) {
            const at = (t: number, out: number) => {
              const d = side * (road.width / 2 + out);
              const x = road.a.x + dx * t + (dz / length) * d,
                z = road.a.z + dz * t - (dx / length) * d;
              const bulge = 0.85 * Math.sin((Math.PI * out) / 3.3) * Math.exp(-out * 0.35);
              return this.surface(x, z, bulge);
            };
            const a = at(i / steps, offsets[j]!),
              b = at((i + 1) / steps, offsets[j]!),
              c = at((i + 1) / steps, offsets[j + 1]!),
              d = at(i / steps, offsets[j + 1]!);
            if (![a, b, c, d].every((v) => this.allowed(v.x, v.z))) continue;
            this.triangle(a, b, c, true);
            this.triangle(a, c, d, true);
          }
    }
  }
  finish() {
    if (!this.positions.length) return this.group;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('snowLift', new T.Float32BufferAttribute(this.lifts, 1));
    geometry.setAttribute('snowOpacity', new T.Float32BufferAttribute(this.opacity, 1));
    // Area-weighted normals are linear in vertical snow displacement. Smooth
    // ground patches across triangles, while retaining crisp roof-edge normals.
    const count = this.lifts.length,
      baseNormals = new Float32Array(count * 3),
      deltaNormals = new Float32Array(count * 3);
    const sums = new Map<string, { base: T.Vector3; delta: T.Vector3 }>(),
      keys: string[] = [];
    const point = (i: number, depth: number) =>
      new T.Vector3(
        this.positions[i * 3],
        this.positions[i * 3 + 1]! + this.lifts[i]! * depth,
        this.positions[i * 3 + 2],
      );
    for (let i = 0; i < count; i += 3) {
      const normal = (depth: number) =>
        new T.Vector3().crossVectors(
          point(i + 1, depth).sub(point(i, depth)),
          point(i + 2, depth).sub(point(i, depth)),
        );
      const base = normal(0),
        delta = normal(1).sub(base);
      for (let j = i; j < i + 3; j++) {
        const key = this.smooth[j]
          ? `${this.positions[j * 3]!.toFixed(4)}:${this.positions[j * 3 + 1]!.toFixed(4)}:${this.positions[j * 3 + 2]!.toFixed(4)}:${this.lifts[j]!.toFixed(4)}`
          : `face:${j}`;
        keys.push(key);
        const sum = sums.get(key) ?? { base: new T.Vector3(), delta: new T.Vector3() };
        sum.base.add(base);
        sum.delta.add(delta);
        sums.set(key, sum);
      }
    }
    for (let i = 0; i < count; i++) {
      const n = sums.get(keys[i]!)!;
      n.base.toArray(baseNormals, i * 3);
      n.delta.toArray(deltaNormals, i * 3);
    }
    geometry.setAttribute('normal', new T.BufferAttribute(baseNormals, 3));
    geometry.setAttribute('snowNormal', new T.BufferAttribute(deltaNormals, 3));
    const material = new T.MeshStandardMaterial({
      color: new T.Color().setRGB(0.85, 0.91, 0.94),
      roughness: 0.98,
      flatShading: false,
      side: T.DoubleSide,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.snowDepthVisual = snowDepthVisual;
      shader.vertexShader =
        'uniform float snowDepthVisual; attribute float snowLift; attribute vec3 snowNormal; attribute float snowOpacity; varying float snowAlpha; varying vec3 snowPoint;\n' +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.y += snowDepthVisual*snowLift; snowPoint=transformed; snowAlpha=snowOpacity;',
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        '#include <beginnormal_vertex>\nobjectNormal=normalize(normal+snowDepthVisual*snowNormal);',
      );
      shader.fragmentShader =
        'varying vec3 snowPoint; varying float snowAlpha;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nfloat grain=sin(snowPoint.x*3.1+sin(snowPoint.z*2.3))*sin(snowPoint.z*3.7); diffuseColor.rgb *= .96+grain*.025; diffuseColor.a *= snowAlpha;',
      );
    };
    material.customProgramCacheKey = () => 'accumulated-snow-v1';
    // Roof shells stay opaque and self-occlude. Ground skirts fade into the
    // existing snow surface instead of leaving rectangular, differently lit tiles.
    for (const ground of [false, true]) {
      const indices: number[] = [];
      for (let i = 0; i < count; i++) if (this.smooth[i] === ground) indices.push(i);
      if (!indices.length) continue;
      const g = geometry.clone();
      g.setIndex(indices);
      const m = material.clone();
      m.onBeforeCompile = material.onBeforeCompile;
      m.customProgramCacheKey = material.customProgramCacheKey;
      m.transparent = ground;
      m.depthWrite = !ground;
      const mesh = new T.Mesh(g, m);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      this.group.add(mesh);
    }
    geometry.dispose();
    material.dispose();
    this.positions = [];
    this.lifts = [];
    this.opacity = [];
    this.smooth = [];
    return this.group;
  }
}

/** Called only when snow appears/disappears; new chunks use the current uniform. */
export function showSnowAccumulation(root: T.Object3D, visible: boolean) {
  root.traverse((o) => {
    if (o.userData.snowAccumulation) o.visible = visible;
  });
}
