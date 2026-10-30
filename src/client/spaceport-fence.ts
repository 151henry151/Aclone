// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { spaceportFences } from '../shared/spaceport-site';
import { terrainHeight } from '../shared/terrain';
import type { World } from '../shared/types';
/** Batched diamond mesh fabric and posts, following the actual ground at each panel. */
export function spaceportFence(w: World) {
  const root = new T.Group();
  root.name = 'Spaceport chain-link security perimeter';
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#afbab6';
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
    panels = [];
    rails = [];
  };
  spaceportFences(w).forEach((edge, index) => {
    const n = Math.ceil(Math.hypot(edge.b.x - edge.a.x, edge.b.z - edge.a.z) / 6);
    for (let j = 0; j < n; j++) {
      const point = (t: number) => {
        const x = edge.a.x + (edge.b.x - edge.a.x) * t,
          z = edge.a.z + (edge.b.z - edge.a.z) * t;
        return new T.Vector3(x, terrainHeight(w, x, z), z);
      };
      const a = point(j / n),
        b = point((j + 1) / n),
        h = 2.8,
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
      g.setIndex([0, 1, 2, 0, 2, 3]);
      g.computeVertexNormals();
      panels.push(g);
      rod(a, a.clone().add(new T.Vector3(0, 3, 0)), 0.07);
      rod(a.clone().add(new T.Vector3(0, h, 0)), b.clone().add(new T.Vector3(0, h, 0)));
      rod(
        a.clone().add(new T.Vector3(0, 0.12, 0)),
        b.clone().add(new T.Vector3(0, 0.12, 0)),
        0.035,
      );
    }
    if (index % 16 === 15) flush();
  });
  flush();
  const s = w.spaceportSite!;
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 512;
  signCanvas.height = 256;
  const c = signCanvas.getContext('2d')!;
  c.fillStyle = '#e7dec4';
  c.fillRect(0, 0, 512, 256);
  c.fillStyle = '#922d25';
  c.fillRect(0, 0, 512, 64);
  c.fillStyle = 'white';
  c.textAlign = 'center';
  c.font = 'bold 36px sans-serif';
  c.fillText('LAUNCH RESERVATION', 256, 44);
  c.fillStyle = '#23342e';
  c.font = 'bold 34px sans-serif';
  c.fillText('PUDDLEWICK SPACEPORT', 256, 115);
  c.font = '26px sans-serif';
  c.fillText(`No building within ${s.exclusion / 1000} km of pad`, 256, 163);
  c.fillText('Terminal access through gate', 256, 210);
  const sign = new T.Mesh(
    new T.PlaneGeometry(5, 2.5),
    new T.MeshStandardMaterial({ map: new T.CanvasTexture(signCanvas), side: T.DoubleSide }),
  );
  const angle = Math.PI / 4 + 12 / s.fence;
  const x = s.x + Math.cos(angle) * s.fence,
    z = s.z + Math.sin(angle) * s.fence;
  sign.position.set(
    x + Math.cos(angle) * 0.3,
    terrainHeight(w, x, z) + 2,
    z + Math.sin(angle) * 0.3,
  );
  sign.rotation.y = Math.PI / 4;
  root.add(sign);
  return root;
}
