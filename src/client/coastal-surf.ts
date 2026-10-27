// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import { terrainHeight } from '../shared/terrain';
import { bluffPoint, bluffEdge } from '../shared/coastal-bluffs';
import { smoothstep } from '../shared/noise';
type Breaker = {
  x: number;
  z: number;
  nx: number;
  nz: number;
  cliff: boolean;
  phase: number;
  mesh: T.Mesh<T.PlaneGeometry, T.ShaderMaterial>;
};
/** Bounded local surf meshes: a rolling lip followed by wash, or a cliff impact
 * with ballistic fall-back. No fluid simulation or offscreen render targets. */
export class CoastalSurf {
  readonly group = new T.Group();
  private patches: Breaker[] = [];
  private sprayPositions = new Float32Array(36 * 18 * 3);
  private spray = new T.Points(
    new T.BufferGeometry(),
    new T.PointsMaterial({
      color: '#e2eeeb',
      size: 0.4,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    }),
  );
  constructor() {
    this.spray.geometry.setAttribute('position', new T.BufferAttribute(this.sprayPositions, 3));
    this.spray.frustumCulled = false;
    this.spray.name = 'Cliff spray droplets';
    this.spray.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        'diffuseColor.a*=1.-smoothstep(.1,.5,length(gl_PointCoord-.5));\n#include <opaque_fragment>',
      );
    };
    this.group.add(this.spray);
  }
  private x = Infinity;
  private z = Infinity;
  private level = Infinity;
  private material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    uniforms: { light: { value: 1 } },
    vertexShader:
      'varying vec2 uvSurf; varying float foam; attribute float crestFoam; void main(){uvSurf=uv;foam=crestFoam;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 uvSurf; varying float foam; uniform float light;
      void main(){float edge=smoothstep(0.,.13,uvSurf.x)*(1.-smoothstep(.87,1.,uvSurf.x));
      float bubbles=.72+.28*sin(uvSurf.x*193.+sin(uvSurf.y*79.)*3.)*sin(uvSurf.y*121.);
      float alpha=edge*foam*bubbles; if(alpha<.015)discard;
      gl_FragColor=vec4(mix(vec3(.08,.34,.36),vec3(.88,.96,.94),clamp(foam,0.,1.))*light,alpha*.88);}`,
  });
  reset() {
    for (const p of this.patches) p.mesh.geometry.dispose();
    this.patches = [];
    this.group.clear();
    this.group.add(this.spray);
    this.x = Infinity;
    this.level = Infinity;
  }
  private rebuild(w: World, x: number, z: number, level: number) {
    this.reset();
    this.x = x;
    this.z = z;
    this.level = level;
    const candidates: { x: number; z: number; nx: number; nz: number; cliff: boolean }[] = [];
    for (const b of w.coastalBluffs ?? []) {
      if (Math.hypot(b.x - x, b.z - z) > 650) continue;
      for (let u = -b.width * 0.82; u < b.width * 0.82; u += 24) {
        const p = bluffPoint(b, u, bluffEdge(b, u) + 1.2);
        candidates.push({ ...p, nx: -Math.sin(b.angle), nz: -Math.cos(b.angle), cliff: true });
      }
    }
    // Marching shoreline crossings, sampled from the same height function used
    // by boats. Tide changes rebuild at 25cm steps; distant sea has no surf cost.
    const startX = Math.floor(x / 32) * 32,
      startZ = Math.floor(z / 32) * 32;
    for (let dz = -320; dz < 320; dz += 32)
      for (let dx = -320; dx < 320; dx += 32) {
        const ax = startX + dx,
          az = startZ + dz,
          ha = terrainHeight(w, ax, az) - level;
        for (const [bx, bz] of [
          [ax + 32, az],
          [ax, az + 32],
        ]) {
          const hb = terrainHeight(w, bx, bz) - level;
          if (ha * hb > 0 || Math.abs(ha - hb) < 0.01) continue;
          let lo = 0,
            hi = 1;
          for (let i = 0; i < 8; i++) {
            const t = (lo + hi) / 2,
              h = terrainHeight(w, ax + (bx - ax) * t, az + (bz - az) * t) - level;
            if (h > 0 === ha > 0) lo = t;
            else hi = t;
          }
          const t = (lo + hi) / 2,
            px = ax + (bx - ax) * t,
            pz = az + (bz - az) * t;
          if (candidates.some((p) => Math.hypot(p.x - px, p.z - pz) < 22)) continue;
          const gx = terrainHeight(w, px + 4, pz) - terrainHeight(w, px - 4, pz),
            gz = terrainHeight(w, px, pz + 4) - terrainHeight(w, px, pz - 4),
            n = Math.hypot(gx, gz);
          if (n < 0.01) continue;
          candidates.push({ x: px, z: pz, nx: gx / n, nz: gz / n, cliff: n > 12 });
        }
      }
    candidates.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    for (const c of candidates.slice(0, 36)) {
      const geometry = new T.PlaneGeometry(1, 1, 16, 10);
      geometry.setAttribute(
        'crestFoam',
        new T.BufferAttribute(new Float32Array(geometry.attributes.position.count), 1),
      );
      const mesh = new T.Mesh(geometry, this.material);
      mesh.frustumCulled = false;
      mesh.name = c.cliff
        ? 'Cliff impact and falling spray'
        : 'Overturning shore breaker and foamy wash';
      this.group.add(mesh);
      this.patches.push({ ...c, mesh, phase: Math.sin(c.x * 0.033 + c.z * 0.027) * 3 });
    }
  }
  update(
    w: World,
    x: number,
    z: number,
    level: number,
    time: number,
    amplitude: number,
    light: number,
  ) {
    this.group.visible = amplitude > 0.035;
    if (!this.group.visible) return;
    if (Math.hypot(x - this.x, z - this.z) > 128 || Math.abs(level - this.level) > 0.25)
      this.rebuild(w, x, z, level);
    this.material.uniforms.light.value = Math.max(0.04, light);
    const strength = smoothstep(0.035, 0.45, amplitude),
      height = Math.min(4, amplitude * 1.4);
    let sprayCount = 0;
    this.spray.material.color.setScalar(Math.max(0.04, light));
    for (const p of this.patches) {
      const pos = p.mesh.geometry.attributes.position,
        uv = p.mesh.geometry.attributes.uv,
        foam = p.mesh.geometry.attributes.crestFoam;
      for (let i = 0; i < pos.count; i++) {
        const u = uv.getX(i),
          v = uv.getY(i),
          along = (u - 0.5) * 36;
        const phase = (((time / 6.4 + p.phase + along * 0.008) % 1) + 1) % 1;
        let travel: number, y: number, white: number;
        if (p.cliff) {
          // Uprush bursts against rock, then falls back outward in broken sheets.
          const t = phase * 2.7,
            jet = Math.max(0, (height * 3 + 2) * t - 4.9 * t * t);
          travel = -1.5 - v * (2 + t * 3);
          y = level + 0.05 + jet * Math.sin(v * Math.PI * 0.8);
          white =
            strength *
            Math.max(0, 1 - phase) *
            (0.45 + 0.55 * Math.sin(v * Math.PI)) *
            Math.min(1, jet + 0.2);
        } else {
          const breaking = smoothstep(0.25, 0.55, phase),
            collapse = smoothstep(0.6, 0.85, phase);
          const front = -12 + phase * 16;
          // The lip genuinely overturns: the upper front projects beyond its
          // foot, then folds down, rather than remaining a sine-wave heightfield.
          const rear = Math.min(1, v / 0.55),
            theta = Math.max(0, (v - 0.55) / 0.45) * Math.PI;
          const bx = v <= 0.55 ? -5 + rear * 6 : 1 + Math.sin(theta) * height * 0.85;
          const by = v <= 0.55 ? Math.sin((rear * Math.PI) / 2) : 0.55 + 0.45 * Math.cos(theta);
          travel = front + (v - 0.5) * 8 * (1 - breaking) + bx * breaking;
          y =
            level +
            0.08 +
            (Math.sin(v * Math.PI) * (1 - breaking) + by * breaking) * height * (1 - collapse);
          white =
            strength *
            (0.15 + breaking * 0.85) *
            (1 - smoothstep(0.88, 1, phase)) *
            (0.3 + 0.7 * Math.sin(v * Math.PI));
        }
        const px = p.x + p.nz * along + p.nx * travel,
          pz = p.z - p.nx * along + p.nz * travel;
        // Height sampling is cached per vertex at rebuild for beach run-up.
        if (!p.mesh.userData.ground) p.mesh.userData.ground = new Float32Array(pos.count).fill(NaN);
        const floors = p.mesh.userData.ground as Float32Array;
        if (Number.isNaN(floors[i]))
          floors[i] = terrainHeight(
            w,
            p.x + p.nz * along + p.nx * 2,
            p.z - p.nx * along + p.nz * 2,
          );
        if (!p.cliff && travel > 0)
          y = Math.max(y, level + (floors[i] - level) * Math.min(1, travel / 2) + 0.07);
        pos.setXYZ(i, px, y, pz);
        foam.setX(i, white);
      }
      pos.needsUpdate = true;
      foam.needsUpdate = true;
      if (p.cliff)
        for (let j = 0; j < 18; j++) {
          const along = (j / 17 - 0.5) * 32;
          const phase = (((time / 6.4 + p.phase + along * 0.008) % 1) + 1) % 1,
            t = phase * 2.7;
          const jet = Math.max(0, (height * 3 + 2) * t - 4.9 * t * t);
          const travel = -1.5 - t * (2 + (j % 4));
          this.sprayPositions[sprayCount * 3] = p.x + p.nz * along + p.nx * travel;
          this.sprayPositions[sprayCount * 3 + 1] =
            jet > 0.1 ? level + jet * (0.75 + (j % 5) * 0.12) : level - 5;
          this.sprayPositions[sprayCount * 3 + 2] = p.z - p.nx * along + p.nz * travel;
          sprayCount++;
        }
    }
    this.spray.geometry.setDrawRange(0, sprayCount);
    this.spray.geometry.attributes.position.needsUpdate = true;
  }
}
