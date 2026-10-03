// SPDX-License-Identifier: GPL-3.0-or-later
// Small original baked atlases, shared for the renderer lifetime. No image downloads or runtime noise shaders.
import * as T from 'three';
export type Detail =
  | 'window'
  | 'window-light'
  | 'door'
  | 'siding'
  | 'grille'
  | 'vents'
  | 'tyre'
  | 'rim'
  | 'paint'
  | 'livestock';
const cache = new Map<Detail, T.DataTexture>();
const fract = (n: number) => n - Math.floor(n);
const hash = (x: number, y: number) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function noise(x: number, y: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = fract(x),
    fy = fract(y),
    u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  return lerp(
    lerp(hash(ix, iy), hash(ix + 1, iy), u),
    lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), u),
    v,
  );
}
export function detailTexture(kind: Detail) {
  const saved = cache.get(kind);
  if (saved) return saved;
  const size = 256,
    width = kind === 'livestock' ? size * 4 : size,
    data = new Uint8Array(width * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < width; x++) {
      const u = (x % size) / size,
        v = y / size,
        n = hash(x, y),
        grain = noise(u * 90, v * 8);
      let c = [255, 255, 255];
      if (kind === 'window' || kind === 'window-light') {
        const border = u < 0.07 || u > 0.93 || v < 0.065 || v > 0.935,
          bar = Math.abs(u - 0.5) < 0.022 || Math.abs(v - 0.5) < 0.021;
        const pane = !border && !bar;
        if (kind === 'window-light') c = pane ? [220, 215, 190] : [0, 0, 0];
        else if (!pane) c = [205 + grain * 22, 194 + grain * 18, 165 + grain * 20];
        else {
          const reflect = Math.max(0, 1 - Math.abs(u + v - 1.1) * 4) * 32,
            curtain = u < 0.19 || u > 0.81;
          c = curtain
            ? [109 + grain * 28, 117 + grain * 25, 101 + grain * 20]
            : [38 + reflect + n * 5, 66 + reflect + n * 5, 71 + reflect + n * 5];
          if (fract(u * 2) < 0.17 || fract(v * 2) < 0.17) c = c.map((a) => a * 0.72);
        }
      } else if (kind === 'door') {
        const frame = u < 0.065 || u > 0.935 || v < 0.03 || v > 0.97;
        const panel = u > 0.2 && u < 0.8 && ((v > 0.13 && v < 0.42) || (v > 0.52 && v < 0.88));
        let a = frame ? 215 : panel ? 125 : 170;
        a += grain * 22 + Math.sin(u * 250 + noise(u * 12, v * 5) * 5) * 5;
        c = [a, a * 0.97, a * 0.88];
        if (Math.hypot(u - 0.83, (v - 0.48) * 1.7) < 0.027) c = [211, 174, 85];
        if (panel && (u < 0.22 || v < 0.15 || v > 0.86)) c = c.map((a) => a * 0.65);
      } else if (kind === 'siding') {
        const plank = fract(v * 8),
          a =
            plank < 0.06 ? 75 : plank < 0.11 ? 225 : 171 + grain * 34 + noise(u * 17, v * 80) * 15;
        c = [a, a * 0.96, a * 0.88];
        if ((u < 0.04 || u > 0.96) && plank > 0.3 && plank < 0.37) c = [90, 88, 80];
      } else if (kind === 'grille' || kind === 'vents') {
        const stripe = fract(u * (kind === 'grille' ? 16 : 8)),
          a = stripe < 0.3 ? 31 : stripe < 0.43 ? 155 : 65 + n * 16;
        c = [a, a * 1.02, a * 0.98];
        if (v < 0.05 || v > 0.95 || u < 0.03 || u > 0.97)
          c = [152 + n * 25, 157 + n * 20, 146 + n * 18];
      } else if (kind === 'tyre') {
        const tread = fract(u * 18 + Math.abs(v - 0.5) * 3.8),
          edge = Math.min(v, 1 - v),
          a = (tread < 0.25 ? 35 : tread < 0.32 ? 88 : 58) + n * 8;
        c = edge < 0.08 ? [39 + n * 7, 42 + n * 7, 37 + n * 7] : [a, a * 1.02, a * 0.92];
      } else if (kind === 'rim') {
        const dx = u - 0.5,
          dy = v - 0.5,
          r = Math.hypot(dx, dy),
          angle = Math.atan2(dy, dx),
          bolt = Math.hypot(r - 0.33, Math.sin(angle * 3) * 0.2) < 0.028;
        let a = bolt ? 60 : r > 0.44 || r < 0.17 ? 100 : 210 + n * 12;
        c = [a, a * 0.98, a * 0.89];
      } else if (kind === 'paint') {
        const scratch = n > 0.98 ? 35 : 0,
          a = 246 + noise(u * 100, v * 100) * 9 - scratch;
        c = [a, a, a];
      } else {
        const tile = Math.floor(x / size),
          detail = noise(u * 85, v * 85);
        if (tile === 0) {
          const patch = noise(u * 6, v * 5) + 0.17 * noise(u * 17, v * 15),
            blend = T.MathUtils.smoothstep(patch, 0.57, 0.595),
            a = lerp(250, 27, blend) + n * 4;
          c = [a, a, a * 0.97];
        } else if (tile === 1) {
          const curl =
              Math.sin(u * 310 + noise(u * 55, v * 55) * 7) *
              Math.cos(v * 280 + noise(u * 70, v * 70) * 6),
            a = 220 + curl * 16 + detail * 17;
          c = [a, a, a * 0.97];
        } else if (tile === 2) {
          const a = 232 + detail * 18 + (n > 0.94 ? -25 : 0);
          c = [a, a * 0.985, a * 0.975];
        } else {
          const row = fract(v * 14),
            col = fract(u * 10 + Math.floor(v * 14) * 0.5),
            edge = Math.abs(col - 0.5) * 1.5 + row,
            a = edge > 0.93 ? 170 : 221 + detail * 22;
          c = [a, a * 0.98, a * 0.93];
        }
      }
      const i = (y * width + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      data[i + 3] = 255;
    }
  const map = new T.DataTexture(data, width, size);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.anisotropy = 4;
  map.needsUpdate = true;
  map.userData.shared = true;
  cache.set(kind, map);
  return map;
}
export function detailMaterial(
  kind: Detail,
  color: T.ColorRepresentation = '#ffffff',
  bump = 0.025,
) {
  return new T.MeshStandardMaterial({
    color,
    map: detailTexture(kind),
    bumpMap: detailTexture(kind),
    bumpScale: bump,
    roughness: 0.82,
  });
}
/** Map repeated siding in metre-sized boards on all face orientations. */
export function sidingMaterial(
  mesh: T.Mesh<T.BufferGeometry, T.Material | T.Material[]>,
  color: string,
) {
  const p = mesh.geometry.attributes.position,
    n = mesh.geometry.attributes.normal,
    uv = [];
  for (let i = 0; i < p.count; i++)
    uv.push((Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) / 2, p.getY(i) / 1.76);
  mesh.geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
  mesh.material = detailMaterial('siding', color, 0.018);
  return mesh;
}
