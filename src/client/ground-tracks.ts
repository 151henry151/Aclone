// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { TRACTOR_SCALE } from './tractor';

/** How long a tyre print stays visible, in real seconds. */
export const TRACK_LIFE = 150;
/** Distance from the tractor centreline to a rear tyre centre. */
export const TRACK_HALF = 1.22 * TRACTOR_SCALE;
/** Rear tyre contact width. */
export const TRACK_WIDTH = 0.58 * TRACTOR_SCALE;
export const TRACK_LENGTH = 1.45;
export const TRACK_PRINT_WIDTH = TRACK_HALF * 2 + TRACK_WIDTH;
const spacing = 1.15;
const capacity = 480;
export type TrackKind = 'snow' | 'mud';
export type TrackMark = {
  x: number;
  z: number;
  heading: number;
  kind: TrackKind;
  age: number;
  depth: number;
};
export function trackKind(climate: { snow?: number; wetness?: number }) {
  if ((climate.snow ?? 0) > 0.08) return 'snow';
  if ((climate.wetness ?? 0) > 0.18) return 'mud';
  return undefined;
}
const fract = (n: number) => n - Math.floor(n);
let printMap: T.DataTexture | undefined;
/** Two chevron tyre prints with a clear gap, used as an alpha stamp. */
export function trackPrintTexture() {
  if (printMap) return printMap;
  const width = 256,
    height = 128,
    data = new Uint8Array(width * height * 4),
    half = TRACK_WIDTH / 2 / TRACK_PRINT_WIDTH,
    centres = [0.5 - TRACK_HALF / TRACK_PRINT_WIDTH, 0.5 + TRACK_HALF / TRACK_PRINT_WIDTH];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1),
        v = y / (height - 1);
      let alpha = 0;
      for (const centre of centres) {
        const across = (u - centre) / half;
        if (Math.abs(across) > 1) continue;
        const edge = 1 - Math.abs(across);
        const chevron = fract(v * 5.5 + Math.abs(across) * 0.85);
        const groove = chevron < 0.36;
        const strength = edge * edge * (Math.min(v, 1 - v) < 0.1 ? Math.min(v, 1 - v) / 0.1 : 1);
        alpha = Math.max(alpha, (groove ? 230 : 48) * strength);
      }
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = alpha;
    }
  printMap = new T.DataTexture(data, width, height, T.RGBAFormat);
  printMap.colorSpace = T.SRGBColorSpace;
  printMap.wrapS = printMap.wrapT = T.ClampToEdgeWrapping;
  printMap.magFilter = T.LinearFilter;
  printMap.minFilter = T.LinearFilter;
  printMap.needsUpdate = true;
  return printMap;
}
let rutMaps: { color: T.DataTexture; height: T.DataTexture } | undefined;
/** A continuous compressed tyre channel with bevelled shoulders and tread on its floor.
 * Height is linear data; colours provide cavity shading when dynamic shadows are off. */
export function snowRutTextures() {
  if (rutMaps) return rutMaps;
  const width = 256,
    height = 128;
  const colors = new Uint8Array(width * height * 4);
  const heights = new Uint8Array(colors.length);
  const half = TRACK_WIDTH / 2 / TRACK_PRINT_WIDTH;
  const centres = [0.5 - TRACK_HALF / TRACK_PRINT_WIDTH, 0.5 + TRACK_HALF / TRACK_PRINT_WIDTH];
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1),
        v = y / (height - 1);
      let h = 0.8,
        alpha = 0,
        cavity = 0;
      for (const centre of centres) {
        const across = Math.abs((u - centre) / half);
        if (across > 1) continue;
        const channel = 1 - smooth(0.55, 0.94, across);
        const ends = smooth(0, 0.1, v) * (1 - smooth(0.9, 1, v));
        const tread = smooth(0.26, 0.34, fract(v * 5.5 + across * 0.85));
        h = 0.8 - channel * (0.62 + 0.08 * tread) * ends;
        cavity = channel * (0.13 + 0.06 * tread);
        alpha = (1 - smooth(0.94, 1, across)) * ends;
      }
      const i = (y * width + x) * 4;
      colors.set(
        [
          Math.round(255 * (1 - cavity)),
          Math.round(255 * (1 - cavity * 0.88)),
          Math.round(255 * (1 - cavity * 0.72)),
          Math.round(alpha * 255),
        ],
        i,
      );
      heights.set([Math.round(h * 255), 0, 0, 255], i);
    }
  const color = new T.DataTexture(colors, width, height),
    relief = new T.DataTexture(heights, width, height);
  color.colorSpace = T.SRGBColorSpace;
  for (const map of [color, relief]) {
    map.magFilter = map.minFilter = T.LinearFilter;
    map.wrapS = map.wrapT = T.ClampToEdgeWrapping;
    map.userData.shared = true;
    map.needsUpdate = true;
  }
  rutMaps = { color, height: relief };
  return rutMaps;
}

/** Fading snow or mud prints behind moving tractors. */
export class GroundTracks {
  marks: TrackMark[] = [];
  readonly mesh: T.InstancedMesh;
  private last = new Map<string, { x: number; z: number; heading: number; kind?: TrackKind }>();
  private dummy = new T.Object3D();
  private fade: T.InstancedBufferAttribute;
  private relief: T.InstancedBufferAttribute;
  private ground: T.InstancedBufferAttribute[];
  constructor() {
    const geometry = new T.PlaneGeometry(TRACK_PRINT_WIDTH, TRACK_LENGTH, 2, 2);
    geometry.rotateX(-Math.PI / 2);
    this.fade = new T.InstancedBufferAttribute(new Float32Array(capacity), 1);
    geometry.setAttribute('instanceFade', this.fade);
    this.relief = new T.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.ground = Array.from(
      { length: 3 },
      () => new T.InstancedBufferAttribute(new Float32Array(capacity * 3), 3),
    );
    geometry.setAttribute('instanceRelief', this.relief);
    this.ground.forEach((row, i) => geometry.setAttribute(`instanceGround${i}`, row));
    const rut = snowRutTextures();
    const material = new T.MeshStandardMaterial({
      map: trackPrintTexture(),
      transparent: true,
      opacity: 1,
      bumpMap: rut.height,
      bumpScale: 1,
      roughness: 1,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    material.userData.warmTextures = [rut.color];
    material.onBeforeCompile = (shader) => {
      shader.uniforms.rutMap = { value: rut.color };
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float instanceFade; attribute float instanceRelief; attribute vec3 instanceGround0; attribute vec3 instanceGround1; attribute vec3 instanceGround2; varying float vTrackFade; varying float vRutDepth;',
        )
        .replace(
          '#include <color_vertex>',
          '#include <color_vertex>\nvTrackFade = instanceFade; vRutDepth = instanceRelief;',
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vec3 row = uv.y < .5 ? mix(instanceGround0,instanceGround1,uv.y*2.) : mix(instanceGround1,instanceGround2,(uv.y-.5)*2.);
          transformed.y += uv.x < .5 ? mix(row.x,row.y,uv.x*2.) : mix(row.y,row.z,(uv.x-.5)*2.);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying float vTrackFade; varying float vRutDepth; uniform sampler2D rutMap;',
        )
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.a *= vTrackFade;',
        )
        .replace(
          '#include <map_fragment>',
          `
          if(vRutDepth > 0.) {
            vec4 rut = texture2D(rutMap, vMapUv);
            diffuseColor.rgb *= mix(vec3(1.),rut.rgb,clamp(vRutDepth/.08,0.,1.));
            diffuseColor.a *= rut.a;
          } else {
            #include <map_fragment>
          }
        `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          `{
            // Keep derivatives in metres: normalizing them makes apparent rut depth
            // shrink with screen resolution and camera distance.
            vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
            normal = normalize(cross(dx,dy))*faceDirection;
            vec3 rx = cross(dy,normal), ry = cross(normal,dx);
            float det = dot(dx,rx) * faceDirection;
            vec2 dh = dHdxy_fwd() * (vRutDepth/.7);
            normal = normalize(abs(det)*normal-sign(det)*(dh.x*rx+dh.y*ry));
          }`,
        );
    };
    material.customProgramCacheKey = () => 'depth-aware-snow-ruts-v1';
    this.mesh = new T.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 1;
  }
  record(
    id: string,
    x: number,
    z: number,
    heading: number,
    kind: TrackKind | undefined,
    moving: boolean,
    snowDepth = 0.04,
  ) {
    const prev = this.last.get(id);
    const distance = prev ? Math.hypot(x - prev.x, z - prev.z) : 0;
    if (!kind || (!moving && (!prev || prev.kind !== kind || distance >= 40))) {
      this.last.set(id, { x, z, heading, kind });
      return;
    }
    // A snapshot can report stopped while the displayed tractor is still
    // catching up. Preserve its travelled path rather than opening a gap.
    if (prev && distance < spacing) return;
    // Fill travelled distance, not rendered frames. Do not bridge teleports,
    // dry ground, or a change between mud and snow.
    const join = prev && prev.kind === kind && distance < 40;
    const steps = join ? Math.floor(distance / spacing) : 1;
    const turn = prev
      ? Math.atan2(Math.sin(heading - prev.heading), Math.cos(heading - prev.heading))
      : 0;
    for (let step = 1; step <= steps; step++) {
      const t = join ? (step * spacing) / distance : 1;
      const point = {
        x: join ? prev.x + (x - prev.x) * t : x,
        z: join ? prev.z + (z - prev.z) * t : z,
        heading: join ? prev.heading + turn * t : heading,
      };
      this.marks.push({
        ...point,
        kind,
        age: 0,
        depth: kind === 'snow' ? Math.max(0, Math.min(0.3, snowDepth * 0.8)) : 0,
      });
      this.last.set(id, { ...point, kind });
    }
    if (this.marks.length > capacity) this.marks.splice(0, this.marks.length - capacity);
  }

  tick(dt: number) {
    for (const mark of this.marks) mark.age += dt;
    this.marks = this.marks.filter((mark) => mark.age < TRACK_LIFE);
  }
  opacity(mark: TrackMark) {
    return Math.max(0, 1 - mark.age / TRACK_LIFE);
  }
  sync(height: (x: number, z: number) => number, snowDepth = Infinity) {
    const snow = new T.Color().setRGB(0.85, 0.91, 0.94),
      mud = new T.Color('#3a2418');
    let i = 0;
    for (const mark of this.marks) {
      const fade = this.opacity(mark) * (mark.kind === 'snow' ? Math.min(1, snowDepth / 0.01) : 1);
      const ground = height(mark.x, mark.z);
      this.dummy.position.set(mark.x, ground + 0.002, mark.z);
      const at = (x: number, z: number) =>
        height(
          mark.x + x * Math.cos(mark.heading) + z * Math.sin(mark.heading),
          mark.z - x * Math.sin(mark.heading) + z * Math.cos(mark.heading),
        ) - ground;
      // PlaneGeometry UV y=0 is its +Z edge after rotating onto the ground.
      const x = TRACK_PRINT_WIDTH / 2,
        z = TRACK_LENGTH / 2;
      // Nine samples follow terrain triangle boundaries that a single flat quad
      // can cut through, making whole stretches of a shallow rut disappear.
      for (let row = 0; row < 3; row++)
        this.ground[row]!.setXYZ(
          i,
          at(-x, z * (1 - row)),
          at(0, z * (1 - row)),
          at(x, z * (1 - row)),
        );
      this.relief.setX(i, Math.min(mark.depth, snowDepth * 0.8) * fade);
      this.dummy.rotation.set(0, mark.heading, 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, mark.kind === 'snow' ? snow : mud);
      this.fade.setX(i, fade);
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.fade.needsUpdate = true;
    this.relief.needsUpdate = true;
    for (const row of this.ground) row.needsUpdate = true;
    this.mesh.visible = i > 0;
  }
}
