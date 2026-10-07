// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
/** How long a tyre mark stays visible, in seconds. */
export const TRACK_LIFE = 12;
const spacing = 1.6;
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
/** Fading snow or mud marks behind moving tractors. */
export class GroundTracks {
  marks: TrackMark[] = [];
  readonly mesh: T.InstancedMesh;
  private last?: { x: number; z: number };
  private dummy = new T.Object3D();
  constructor() {
    const geometry = new T.PlaneGeometry(0.5, 1.2);
    geometry.rotateX(-Math.PI / 2);
    this.mesh = new T.InstancedMesh(
      geometry,
      new T.MeshBasicMaterial({
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
      144,
    );
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
    if (this.marks.length > 72) this.marks.shift();
  }
  tick(dt: number) {
    for (const mark of this.marks) mark.age += dt;
    this.marks = this.marks.filter((mark) => mark.age < TRACK_LIFE);
  }
  opacity(mark: TrackMark) {
    return Math.max(0, 1 - mark.age / TRACK_LIFE);
  }
  sync(height: (x: number, z: number) => number) {
    const snow = new T.Color('#8b93a0'),
      mud = new T.Color('#3d2a1c');
    let i = 0;
    for (const mark of this.marks) {
      const fade = this.opacity(mark),
        colour = (mark.kind === 'snow' ? snow : mud).clone().multiplyScalar(0.35 + fade * 0.65);
      for (const side of [-0.4, 0.4]) {
        this.dummy.position.set(
          mark.x + Math.cos(mark.heading) * side,
          height(mark.x, mark.z) + 0.05,
          mark.z - Math.sin(mark.heading) * side,
        );
        this.dummy.rotation.y = mark.heading;
        this.dummy.scale.setScalar(0.7 + fade * 0.3);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this.dummy.matrix);
        this.mesh.setColorAt(i, colour);
        i++;
      }
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.visible = i > 0;
  }
}
