// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { spaceportFences, SPACEPORT_FENCE_HEIGHT } from '../shared/spaceport-site';
import { terrainHeight } from '../shared/terrain';
import type { World } from '../shared/types';
/** Batched diamond mesh fabric and posts, following the actual ground at each panel. */
export function spaceportFence(w: World) {
  const job = spaceportFenceSteps(w);
  let step = job.next();
  while (!step.done) step = job.next();
  return step.value;
}
export function* spaceportFenceSteps(w: World, root = new T.Group()): Generator<void, T.Group> {
  root.name = 'Tall chain-link perimeter with concertina razor wire';
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const wireColor = '#afbab6';
  ctx.strokeStyle = wireColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(32, 0);
  ctx.lineTo(64, 32);
  ctx.lineTo(32, 64);
  ctx.lineTo(0, 32);
  ctx.closePath();
  ctx.stroke();
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.colorSpace = T.SRGBColorSpace;
  const fabric = new T.MeshStandardMaterial({
    map: texture,
    alphaTest: 0.35,
    side: T.DoubleSide,
    roughness: 0.7,
    metalness: 0.3,
  });
  const steel = new T.MeshStandardMaterial({ color: '#7c8988', roughness: 0.6, metalness: 0.45 });
  let panels: T.BufferGeometry[] = [],
    rails: T.BufferGeometry[] = [];
  let wire: number[] = [],
    wireIndices: number[] = [];
  const razor = fabric.clone();
  razor.map = null;
  razor.alphaTest = 0;
  razor.color.set(wireColor);
  const direction = new T.Vector3(),
    across = new T.Vector3(),
    cross = new T.Vector3();
  // Crossed narrow strips have physical thickness and receive the same light as
  // the chainlink. Screen-space lines stay a bright pixel wide at any distance.
  const wireSegment = (a: T.Vector3, b: T.Vector3) => {
    direction.subVectors(b, a).normalize();
    across.set(-direction.z, 0, direction.x);
    if (across.lengthSq() < 1e-8) across.set(1, 0, 0);
    across.normalize().multiplyScalar(0.008);
    cross.crossVectors(direction, across);
    for (const offset of [across, cross]) {
      const base = wire.length / 3;
      for (const [point, sign] of [
        [a, -1],
        [a, 1],
        [b, 1],
        [b, -1],
      ] as const)
        wire.push(point.x + offset.x * sign, point.y + offset.y * sign, point.z + offset.z * sign);
      wireIndices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  };
  const rod = (a: T.Vector3, b: T.Vector3, r = 0.055) => {
    const g = new T.CylinderGeometry(r, r, a.distanceTo(b), 6);
    const m = new T.Matrix4();
    const q = new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    m.compose(a.clone().add(b).multiplyScalar(0.5), q, new T.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    rails.push(g);
  };
  const flush = () => {
    for (const [list, material] of [
      [panels, fabric],
      [rails, steel],
    ] as const) {
      if (!list.length) continue;
      const merged = mergeGeometries(list);
      const mesh = new T.Mesh(merged, material);
      root.add(mesh);
      for (const g of list) g.dispose();
    }
    if (wire.length) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(wire, 3));
      g.setIndex(wireIndices);
      g.computeVertexNormals();
      const mesh = new T.Mesh(g, razor);
      mesh.name = 'Concertina razor wire';
      mesh.userData.preserveBatch = true;
      root.add(mesh);
      wire = [];
      wireIndices = [];
    }
    panels = [];
    rails = [];
  };
  for (const [index, edge] of spaceportFences(w).entries()) {
    const n = Math.ceil(Math.hypot(edge.b.x - edge.a.x, edge.b.z - edge.a.z) / 6);
    for (let j = 0; j < n; j++) {
      yield;
      const point = (t: number) => {
        const x = edge.a.x + (edge.b.x - edge.a.x) * t,
          z = edge.a.z + (edge.b.z - edge.a.z) * t;
        return new T.Vector3(x, terrainHeight(w, x, z), z);
      };
      const a = point(j / n),
        b = point((j + 1) / n),
        h = SPACEPORT_FENCE_HEIGHT - 0.6,
        length = a.distanceTo(b);
      const g = new T.BufferGeometry();
      g.setAttribute(
        'position',
        new T.Float32BufferAttribute(
          [a.x, a.y + 0.1, a.z, b.x, b.y + 0.1, b.z, b.x, b.y + h, b.z, a.x, a.y + h, a.z],
          3,
        ),
      );
      g.setAttribute(
        'uv',
        new T.Float32BufferAttribute(
          [0, 0, length / 0.22, 0, length / 0.22, h / 0.22, 0, h / 0.22],
          2,
        ),
      );
      // Continuous helical concertina coil, with alternating blade silhouettes.
      const tangent = b.clone().sub(a).normalize(),
        normal = new T.Vector3(-tangent.z, 0, tangent.x);
      const steps = Math.ceil(length / 0.65) * 12;
      const coil = (i: number) => {
        const t = i / steps,
          angle = ((t * length) / 0.65) * Math.PI * 2;
        return a
          .clone()
          .lerp(b, t)
          .addScaledVector(normal, Math.cos(angle) * 0.28)
          .add(new T.Vector3(0, h + 0.28 + Math.sin(angle) * 0.28, 0));
      };
      for (let i = 0; i < steps; i++) {
        const p = coil(i),
          q = coil(i + 1);
        wireSegment(p, q);
        if (i % 6 === 0) {
          const d = normal.clone().multiplyScalar(0.09);
          wireSegment(
            p
              .clone()
              .sub(d)
              .add(new T.Vector3(0, -0.07, 0)),
            p
              .clone()
              .add(d)
              .add(new T.Vector3(0, 0.07, 0)),
          );
        }
      }
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      panels.push(g);
      rod(a, a.clone().add(new T.Vector3(0, h + 0.5, 0)), 0.1);
      rod(a.clone().add(new T.Vector3(0, h, 0)), b.clone().add(new T.Vector3(0, h, 0)));
      rod(a.clone().add(new T.Vector3(0, h / 2, 0)), b.clone().add(new T.Vector3(0, h / 2, 0)));
      rod(
        a.clone().add(new T.Vector3(0, 0.12, 0)),
        b.clone().add(new T.Vector3(0, 0.12, 0)),
        0.035,
      );
    }
    if (index % 16 === 15) flush();
  }
  flush();
  return root;
}
