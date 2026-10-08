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
/** Fading snow or mud prints behind moving tractors. */
export class GroundTracks {
  marks: TrackMark[] = [];
  readonly mesh: T.InstancedMesh;
  private last?: { x: number; z: number };
  private dummy = new T.Object3D();
  private fade: T.InstancedBufferAttribute;
  constructor() {
    const geometry = new T.PlaneGeometry(TRACK_PRINT_WIDTH, TRACK_LENGTH);
    geometry.rotateX(-Math.PI / 2);
    this.fade = new T.InstancedBufferAttribute(new Float32Array(capacity), 1);
    geometry.setAttribute('instanceFade', this.fade);
    const material = new T.MeshBasicMaterial({
      map: trackPrintTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute float instanceFade;\nvarying float vTrackFade;',
        )
        .replace('#include <color_vertex>', '#include <color_vertex>\nvTrackFade = instanceFade;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vTrackFade;')
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.a *= vTrackFade;',
        );
    };
    this.mesh = new T.InstancedMesh(geometry, material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = 1;
  }
  record(x: number, z: number, heading: number, kind: TrackKind | undefined, moving: boolean) {
    if (!kind || !moving) {
      this.last = { x, z };
      return;
    }
    if (this.last && Math.hypot(x - this.last.x, z - this.last.z) < spacing) return;
    this.last = { x, z };
    this.marks.push({ x, z, heading, kind, age: 0 });
    if (this.marks.length > capacity) this.marks.shift();
  }
  tick(dt: number) {
    for (const mark of this.marks) mark.age += dt;
    this.marks = this.marks.filter((mark) => mark.age < TRACK_LIFE);
  }
  opacity(mark: TrackMark) {
    return Math.max(0, 1 - mark.age / TRACK_LIFE);
  }
  sync(height: (x: number, z: number) => number) {
    const snow = new T.Color('#6d7582'),
      mud = new T.Color('#3a2418');
    let i = 0;
    for (const mark of this.marks) {
      const fade = this.opacity(mark);
      this.dummy.position.set(mark.x, height(mark.x, mark.z) + 0.04, mark.z);
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
    this.mesh.visible = i > 0;
  }
}
