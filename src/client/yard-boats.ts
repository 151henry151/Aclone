// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';

type Craft = {
  name: string;
  length: number;
  beam: number;
  color: string;
  kind: 'row' | 'sail' | 'launch' | 'work' | 'sport' | 'canal';
  cabin?: number;
};
/** Each yard has its own work in progress, rather than recolouring three repeated boats. */
export const yardFleets: Craft[][] = [
  [
    {
      name: 'Canal restoration',
      length: 13.5,
      beam: 3.4,
      color: '#356b73',
      kind: 'canal',
      cabin: 1.8,
    },
    { name: 'Clinker rowing boat', length: 5.8, beam: 1.8, color: '#985443', kind: 'row' },
    { name: 'Fishing skiff', length: 4.3, beam: 1.5, color: '#c4a45b', kind: 'work' },
  ],
  [
    { name: 'Cruising sailboat', length: 10.5, beam: 3.1, color: '#ede6ce', kind: 'sail' },
    {
      name: 'Harbour launch',
      length: 7.2,
      beam: 2.3,
      color: '#355b78',
      kind: 'launch',
      cabin: 1.7,
    },
    { name: 'Tender', length: 3.8, beam: 1.4, color: '#8a724c', kind: 'row' },
  ],
  [
    {
      name: 'Inshore fishing launch',
      length: 11.5,
      beam: 3.3,
      color: '#476e67',
      kind: 'work',
      cabin: 2.0,
    },
    { name: 'Work punt', length: 6.3, beam: 2.5, color: '#ad7943', kind: 'work' },
    { name: 'Outboard runabout', length: 4.8, beam: 1.9, color: '#677c9a', kind: 'sport' },
  ],
  [
    {
      name: 'Timber motor launch',
      length: 9.3,
      beam: 2.7,
      color: '#9d6b42',
      kind: 'launch',
      cabin: 1.2,
    },
    { name: 'Gaff-rig dayboat', length: 7.5, beam: 2.4, color: '#376459', kind: 'sail' },
    { name: 'Double-ended rowing boat', length: 5.4, beam: 1.6, color: '#bcad82', kind: 'row' },
  ],
  [
    {
      name: 'Cabin cruiser',
      length: 10.8,
      beam: 3.2,
      color: '#e9e5d7',
      kind: 'launch',
      cabin: 2.2,
    },
    { name: 'Sports runabout', length: 6.8, beam: 2.4, color: '#763d37', kind: 'sport' },
    { name: 'Small sailing dinghy', length: 4.4, beam: 1.8, color: '#d3b84c', kind: 'sail' },
  ],
];
const maps = new Map<string, T.DataTexture>();
function planks(color: string) {
  let t = maps.get(color);
  if (t) return t;
  const rgb = new T.Color(color).convertLinearToSRGB(),
    data = new Uint8Array(256 * 128 * 4);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 256; x++) {
      const seam = y % 16 < 1,
        rivet = x % 24 === 8 && y % 16 === 4;
      const light = seam || rivet ? 0.45 : 1 + Math.sin(x * 0.7 + Math.sin(y) * 2) * 0.035;
      const i = (y * 256 + x) * 4;
      data[i] = Math.min(255, rgb.r * 255 * light);
      data[i + 1] = Math.min(255, rgb.g * 255 * light);
      data[i + 2] = Math.min(255, rgb.b * 255 * light);
      data[i + 3] = 255;
    }
  t = new T.DataTexture(data, 256, 128);
  t.colorSpace = T.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.magFilter = T.LinearFilter;
  t.needsUpdate = true;
  t.userData.shared = true;
  maps.set(color, t);
  return t;
}
export function yardBoat(spec: Craft) {
  const root = new T.Group();
  root.name = spec.name;
  const steel = new T.MeshStandardMaterial({ color: '#434f4c', roughness: 0.8 });
  const wood = new T.MeshStandardMaterial({ map: planks('#b59869'), roughness: 0.8 });
  const cream = new T.MeshStandardMaterial({ color: '#e3dccc', roughness: 0.7 });
  const glass = new T.MeshStandardMaterial({ color: '#38576a', roughness: 0.3, metalness: 0.2 });
  const paint = new T.MeshStandardMaterial({
    map: planks(spec.color),
    roughness: 0.68,
    side: T.DoubleSide,
  });
  function box(w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number) {
    const o = new T.Mesh(new T.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    root.add(o);
    return o;
  }
  function rod(a: number[], b: number[], r: number, m: T.Material) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b),
      v = to.clone().sub(from);
    const o = new T.Mesh(new T.CylinderGeometry(r, r, v.length(), 4), m);
    o.position.copy(from).add(to).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), v.normalize());
    root.add(o);
  }
  {
    const n = 16,
      p: number[] = [],
      uv: number[] = [],
      ix: number[] = [];
    const rings = [
      [-0.55, 0.5, 0.82],
      [-0.22, 0.82, 0.94],
      [0.5, 1, 1],
    ];
    for (let j = 0; j < 3; j++)
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2,
          cz = Math.cos(a),
          [y, wide, long] = rings[j];
        const x =
          (spec.kind === 'canal'
            ? Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.55)
            : Math.sin(a)) *
          spec.beam *
          0.5 *
          wide *
          (cz > 0
            ? 1 - cz * 0.3
            : spec.kind === 'row'
              ? 1
              : Math.pow(Math.max(0.07, 1 - cz * cz), -0.16));
        p.push(
          x,
          y + 1.15 + Math.pow(Math.max(0, cz), 3) * 0.15,
          (spec.kind === 'canal' ? Math.sign(cz) * Math.pow(Math.abs(cz), 0.65) : cz) *
            spec.length *
            0.5 *
            long,
        );
        uv.push(i / n, j / 2);
        if (j < 2 && i < n) {
          const k = j * (n + 1) + i;
          ix.push(k, k + 1, k + n + 1, k + 1, k + n + 2, k + n + 1);
        }
      }
    const center = p.length / 3;
    p.push(0, 0.6, 0);
    uv.push(0.5, 0);
    for (let i = 0; i < n; i++) ix.push(center, i + 1, i);
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geo.setIndex(ix);
    geo.computeVertexNormals();
    root.add(new T.Mesh(geo, paint));
    box(spec.beam * 0.62, 0.08, spec.length * 0.66, wood, 0, 0.93, -0.1);
    for (let i = 0; i < n; i++)
      rod(
        p.slice(2 * (n + 1) * 3 + i * 3, 2 * (n + 1) * 3 + i * 3 + 3),
        p.slice(2 * (n + 1) * 3 + (i + 1) * 3, 2 * (n + 1) * 3 + (i + 1) * 3 + 3),
        0.045,
        wood,
      );
    if (spec.kind === 'row' || (spec.kind === 'work' && !spec.cabin)) {
      for (const z of [-0.22, 0, 0.22])
        box(spec.beam * 0.82, 0.1, 0.3, wood, 0, 1.42, z * spec.length);
      rod([-0.35, 1.5, -spec.length * 0.3], [0.35, 1.5, spec.length * 0.3], 0.025, wood);
      box(0.22, 0.04, 0.7, wood, 0.35, 1.5, spec.length * 0.3);
    }
    if (spec.kind === 'sail') {
      box(spec.beam * 0.6, 0.45, spec.length * 0.34, cream, 0, 1.5, 0.1);
      box(0.14, 0.55, spec.length * 0.28, steel, 0, 0.45, 0.1); // visible keel above the cradle
      rod([0, 1.75, 0.45], [0, 1.75 + spec.length * 0.67, 0.45], 0.055, wood);
      rod([0, 2.1, 0.45], [0, 2.1, -spec.length * 0.3], 0.045, wood);
      for (const x of [-spec.beam * 0.38, spec.beam * 0.38])
        rod([x, 1.6, -spec.length * 0.1], [0, 1.75 + spec.length * 0.6, 0.45], 0.009, steel);
    }
    if (spec.cabin) {
      const d = spec.length * (spec.kind === 'canal' ? 0.7 : 0.34),
        h = spec.cabin,
        z = spec.kind === 'work' ? spec.length * 0.16 : 0;
      box(spec.beam * 0.68, h, d, cream, 0, 1.43 + h / 2, z);
      box(spec.beam * 0.77, 0.1, d + 0.24, wood, 0, 1.5 + h, z);
      for (const side of [-1, 1])
        for (const offset of [-0.25, 0.25])
          box(
            0.02,
            h * 0.48,
            d * 0.36,
            glass,
            side * (spec.beam * 0.34 + 0.012),
            1.6 + h * 0.62,
            z + offset * d,
          );
      box(spec.beam * 0.55, h * 0.48, 0.025, glass, 0, 1.6 + h * 0.62, z + d / 2 + 0.015);
      if (spec.kind === 'work') {
        for (const x of [-spec.beam * 0.32, spec.beam * 0.32])
          rod([x, 1.6, -spec.length * 0.28], [x, 3.6, -spec.length * 0.28], 0.055, steel);
        rod(
          [-spec.beam * 0.32, 3.6, -spec.length * 0.28],
          [spec.beam * 0.32, 3.6, -spec.length * 0.28],
          0.055,
          steel,
        );
        box(1, 0.5, 0.7, wood, 0, 1.15, -spec.length * 0.22);
      }
    }
    if (spec.kind === 'sport') {
      const screen = box(spec.beam * 0.74, 0.55, 0.05, glass, 0, 1.8, spec.length * 0.05);
      screen.rotation.x = -0.25;
      for (const side of [-1, 1])
        box(spec.beam * 0.32, 0.4, 0.7, cream, side * spec.beam * 0.22, 1.18, -spec.length * 0.08);
      box(0.45, 0.7, 0.3, steel, 0, 1.1, -spec.length * 0.47);
    }
  }
  // Adjustable cradle and diagonal props visibly support the hull, with keel blocks.
  const long = spec.length;
  for (const z of [-long * 0.24, long * 0.24]) {
    box(spec.beam + 1, 0.16, 0.4, steel, 0, 0.14, z);
    box(0.5, 0.48, 0.6, wood, 0, 0.38, z);
    for (const side of [-1, 1]) {
      rod(
        [side * (spec.beam * 0.5 + 0.35), 0.2, z],
        [side * spec.beam * 0.3, 0.95, z],
        0.055,
        steel,
      );
      const pad = box(0.4, 0.12, 0.4, wood, side * spec.beam * 0.3, 0.98, z);
      pad.rotation.z = -side * 0.25;
    }
  }
  batch(root);
  root.traverse((o) => {
    if (o instanceof T.Mesh) o.castShadow = o.receiveShadow = true;
  });
  return root;
}
