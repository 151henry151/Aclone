// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { detailTexture } from './detail-textures';
import type { BuildingPlan } from '../shared/building-shapes';

export type WallFinish =
  'brick' | 'limestone' | 'stone' | 'rubble' | 'clapboard' | 'limewash' | 'boards' | 'metal';
export type RoofFinish = 'slate' | 'clay' | 'zinc';
export type WindowFinish = 'cottage' | 'bakery' | 'stores' | 'workshop' | 'civic';
export type PanelFinish =
  'barn-door' | 'roller-door' | 'service-door' | 'shop-door' | 'awning-rust' | 'awning-green';
type Finish =
  | Exclude<WallFinish, 'stone'>
  | RoofFinish
  | PanelFinish
  | `window-${Exclude<WindowFinish, 'cottage'>}`;
export interface BuildingFinish {
  wall: WallFinish;
  roof: RoofFinish;
  window: WindowFinish;
  door: 'house' | 'service-door' | 'shop-door';
  bay: 'barn-door' | 'roller-door';
  tint: string;
  accent: string;
}
/** A finite, shared material library; IDs and player names never allocate textures. */
export function buildingFinish(kind: string, plan: BuildingPlan): BuildingFinish {
  const f: BuildingFinish = {
    wall: plan.siding === 'wood' ? 'boards' : 'stone',
    roof: 'slate',
    window: 'cottage',
    door: 'house',
    bay: 'barn-door',
    tint: plan.wall,
    accent: plan.trim,
  };
  const set = (p: Partial<BuildingFinish>) => Object.assign(f, p);
  if (['bank', 'town', 'hotel'].includes(kind))
    set({ wall: 'limestone', window: 'civic', tint: '#e5dfce', accent: '#344c59' });
  if (['school', 'workhouse', 'brewery', 'roastery'].includes(kind))
    set({ wall: 'brick', tint: '#f0dbcd', accent: kind === 'school' ? '#395d60' : '#605043' });
  if (['bakery', 'pub', 'winery', 'teaHouse', 'kitchen', 'creamery', 'dairyKitchen'].includes(kind))
    set({ wall: 'limewash', tint: '#eee1c5', roof: 'clay' });
  if (kind === 'bakery') set({ window: 'bakery', door: 'shop-door', accent: '#8d4937' });
  if (['creamery', 'dairyKitchen', 'waterworks'].includes(kind))
    set({
      wall: 'limewash',
      roof: 'zinc',
      window: 'workshop',
      door: 'service-door',
      tint: '#d8e5df',
      accent: '#3d787d',
    });
  if (['market', 'shop'].includes(kind))
    set({ wall: 'brick', tint: '#dbd3bd', window: 'stores', door: 'shop-door', accent: '#3c6961' });
  if (
    [
      'farm',
      'haybarn',
      'sawmill',
      'carpenter',
      'henhouse',
      'dairy',
      'sheepfold',
      'piggery',
    ].includes(kind)
  )
    set({
      wall: 'boards',
      roof: 'zinc',
      tint: ['farm', 'haybarn'].includes(kind) ? '#a76c57' : plan.wall,
      window: 'workshop',
    });
  if (
    [
      'garage',
      'workshop',
      'factory',
      'warehouse',
      'shipyard',
      'refinery',
      'starport',
      'mine',
      'rareMine',
      'concreteWorks',
    ].includes(kind)
  )
    set({
      wall: 'metal',
      roof: 'zinc',
      window: 'workshop',
      bay: 'roller-door',
      door: 'service-door',
      tint: '#a8b5b0',
      accent: '#4c6466',
    });
  if (['forge', 'brickworks'].includes(kind))
    set({
      wall: 'brick',
      roof: 'zinc',
      window: 'workshop',
      door: 'service-door',
      tint: '#a49b90',
      accent: '#494c4b',
    });
  if (['mill', 'feedmill'].includes(kind))
    set({ wall: 'stone', tint: '#d2c7af', accent: '#66747a' });
  if (['mason', 'quarry'].includes(kind))
    set({
      wall: 'limestone',
      roof: 'zinc',
      window: 'workshop',
      door: 'service-door',
      tint: '#bbbcb3',
      accent: '#666b64',
    });
  if (plan.finish)
    set({
      wall: plan.finish,
      tint: plan.wall,
      accent: plan.trim,
      roof: plan.finish === 'metal' ? 'zinc' : plan.finish === 'brick' ? 'clay' : 'slate',
    });
  // Explicit material selection remains authoritative over the business palette.
  return f;
}
const maps = new Map<Finish, T.DataTexture>();
const fract = (x: number) => x - Math.floor(x);
const hash = (x: number, y: number) => {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
/** Original baked colour/relief maps: masonry joints, grain, fasteners and wear.
 * Generated only on first use, mipmapped, and shared across all world rebuilds. */
export function buildingTexture(kind: Finish): T.DataTexture {
  const cached = maps.get(kind);
  if (cached) return cached;
  const panel = kind.includes('door') || kind.startsWith('window-') || kind.startsWith('awning-');
  const size = panel ? 256 : 512,
    data = new Uint8Array(size * size * 4);
  const baseWindow = kind.startsWith('window-')
    ? (detailTexture('window').image.data as Uint8Array)
    : undefined;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        n = hash(x, y),
        fine = (n - 0.5) * 15;
      let c: number[] = [200, 195, 182];
      if (['brick', 'limestone', 'slate', 'clay'].includes(kind)) {
        const roof = kind === 'slate' || kind === 'clay';
        const rows = kind === 'brick' ? 16 : roof ? 12 : kind === 'limestone' ? 6 : 9;
        const row = Math.floor(v * rows),
          fy = fract(v * rows);
        const cols = kind === 'brick' ? 8 : kind === 'limestone' ? 4 : roof ? 10 : 5 + (row % 3);
        const xx = u * cols + (row % 2) * 0.5,
          col = Math.floor(xx),
          fx = fract(xx);
        const edge = 0.028;
        const joint = fx < edge || fy < (kind === 'brick' ? 0.07 : 0.045);
        const shade = hash(col, row) * 27 + fine;
        const bevel = fx < edge + 0.03 || fy < 0.095 ? -21 : fx > 0.96 || fy > 0.94 ? 10 : 0;
        if (kind === 'brick')
          c = joint
            ? [106, 100, 85]
            : [155 + shade + bevel, 88 + shade * 0.8 + bevel, 65 + shade * 0.7 + bevel];
        if (kind === 'limestone')
          c = joint
            ? [107, 108, 99]
            : [185 + shade + bevel, 180 + shade + bevel, 160 + shade + bevel];
        if (kind === 'slate')
          c = joint ? [40, 45, 47] : [69 + shade + bevel, 78 + shade + bevel, 83 + shade + bevel];
        if (kind === 'clay')
          c = joint
            ? [72, 47, 36]
            : [147 + shade + bevel, 83 + shade * 0.8 + bevel, 57 + shade * 0.7 + bevel];
        // Fine mineral flecks, worn edges and occasional narrow hairline cracks.
        if (!roof && !joint && n > 0.987) c = c.map((a) => a - 28);
      } else if (kind === 'rubble') {
        const row = Math.floor(v * 8),
          fy = fract(v * 8);
        const xx = u * (5 + (row % 2)) + (row % 2) * 0.43,
          col = Math.floor(xx),
          fx = fract(xx);
        const joint = fx < 0.045 + Math.sin(v * 95) * 0.012 || fy < 0.07 + Math.sin(u * 120) * 0.02;
        const shade = 172 + hash(col, row) * 42 + fine;
        c = joint ? [92, 91, 79] : [shade, shade * 0.97, shade * 0.86];
        if (!joint && (fx < 0.08 || fy < 0.12)) c = c.map((a) => a - 22);
      } else if (kind === 'clapboard') {
        const course = Math.floor(v * 16),
          local = fract(v * 16);
        const grain = Math.sin(u * 160 + Math.sin(v * 400) * 2) * 3;
        const value = 224 + fine * 0.4 + grain - (local < 0.08 ? 80 : local < 0.2 ? 24 : 0);
        c = [value, value * 0.99, value * 0.95];
        if (Math.abs(fract(u * 4 + (course % 2) * 0.5)) < 0.007) c = c.map((a) => a - 25);
      } else if (kind === 'boards') {
        const plank = Math.floor(u * 12),
          local = fract(u * 12);
        const grain = Math.sin(u * 960 + Math.sin(v * 20 + plank) * 3) * 9;
        let value = 188 + hash(plank, 3) * 25 + fine + grain;
        if (local < 0.055) value = 73;
        else if (local < 0.1) value = 225;
        const knot = Math.hypot((local - 0.5) * 0.8, (v - hash(plank, 8)) * 8);
        if (knot < 0.24) value -= (1 - knot / 0.24) * 75;
        if (
          (local < 0.18 || local > 0.82) &&
          (Math.abs(v - 0.15) < 0.006 || Math.abs(v - 0.85) < 0.006)
        )
          value = 137;
        c = [value, value * 0.95, value * 0.85];
      } else if (kind === 'metal' || kind === 'zinc') {
        const rib = fract(u * (kind === 'metal' ? 16 : 10));
        const relief = rib < 0.13 ? -48 : rib < 0.23 ? 16 : rib < 0.35 ? -15 : 0;
        const streak = Math.sin(u * 150) * Math.sin(v * 5) * 8;
        let value = 173 + relief + fine * 0.4 + streak;
        if (
          Math.abs(fract(u * 8) - 0.5) < 0.035 &&
          (Math.abs(v - 0.15) < 0.008 || Math.abs(v - 0.85) < 0.008)
        )
          value = 66;
        c = [value, value + 5, value + 3];
        if (rib < 0.12 && v > 0.75) c = [value + 7, value - 10, value - 20];
      } else if (kind === 'limewash') {
        const mottling = Math.sin(u * 40 + Math.sin(v * 29)) * 4 + Math.sin(v * 75) * 2;
        const a = 223 + mottling + fine * 0.65;
        c = [a, a * 0.985, a * 0.94];
        if (Math.abs(u - 0.28 - Math.sin(v * 18) * 0.016) < 0.0015 && v > 0.4 && v < 0.68)
          c = [151, 146, 130];
      } else if (baseWindow) {
        const i = (y * size + x) * 4;
        c = [baseWindow[i], baseWindow[i + 1], baseWindow[i + 2]];
        const glass =
          u > 0.075 &&
          u < 0.925 &&
          v > 0.07 &&
          v < 0.93 &&
          Math.abs(u - 0.5) > 0.024 &&
          Math.abs(v - 0.5) > 0.023;
        if (glass) {
          if (kind === 'window-civic') {
            c = [45 + fine * 0.2, 65 + fine * 0.2, 71 + fine * 0.2];
            if (
              Math.abs(fract(u * 8 + v * 4) - 0.5) < 0.025 ||
              Math.abs(fract(u * 8 - v * 4) - 0.5) < 0.025
            )
              c = [115, 123, 111];
          } else if (kind === 'window-workshop') {
            const grime = Math.max(0, 0.3 - v) * 60;
            c = [74 + fine - grime, 100 + fine - grime, 103 + fine - grime];
            if (v < 0.17) c = [44, 53, 48];
          } else {
            c = [30 + fine * 0.2, 43 + fine * 0.2, 38 + fine * 0.2];
            if ((v > 0.22 && v < 0.25) || (v > 0.68 && v < 0.71)) c = [121, 93, 61];
            const cell = fract(u * 6),
              row = v < 0.5 ? 0.3 : 0.76;
            if (
              kind === 'window-bakery' &&
              Math.pow((cell - 0.5) / 0.44, 2) + Math.pow((v - row) / 0.05, 2) < 1
            ) {
              c = [194 + fine, 141 + fine, 72 + fine];
              if (Math.abs(fract(cell * 3) - 0.5) < 0.07) c = [231, 192, 123];
            }
            if (
              kind === 'window-stores' &&
              cell > 0.18 &&
              cell < 0.8 &&
              v > row - 0.045 &&
              v < row + 0.09
            )
              c = [111 + hash(Math.floor(u * 6), Math.floor(v * 2)) * 64, 97 + fine, 64 + fine];
          }
        }
      } else if (kind.startsWith('awning-')) {
        const stripe = Math.floor(u * 12) % 2;
        const a = (stripe ? 239 : 116) + fine * 0.3 - Math.sin(v * Math.PI) * 12;
        c = stripe
          ? [a, a * 0.96, a * 0.84]
          : kind === 'awning-rust'
            ? [a * 1.3, a * 0.65, a * 0.45]
            : [a * 0.5, a * 0.83, a * 0.7];
      } else {
        const frame = u < 0.055 || u > 0.945 || v < 0.035 || v > 0.965;
        const plank = fract(u * 12),
          slat = fract(v * 24);
        let value = 179 + fine * 0.5;
        if (kind === 'barn-door') {
          value += Math.sin(v * 5 + u * 400) * 8;
          if (plank < 0.07 || Math.abs(u - 0.5) < 0.012) value = 75;
          if (
            Math.abs(v - u) < 0.024 ||
            Math.abs(v - (1 - u)) < 0.024 ||
            Math.abs(v - 0.16) < 0.023 ||
            Math.abs(v - 0.83) < 0.023
          )
            value = 211 + fine;
        } else if (kind === 'roller-door')
          value = slat < 0.16 ? 71 : slat < 0.28 ? 220 : 163 + fine * 0.4;
        else if (kind === 'service-door') {
          if (u > 0.19 && u < 0.81 && v > 0.65 && v < 0.87) value = fract(v * 65) < 0.35 ? 55 : 125;
          if (Math.abs(u - 0.12) < 0.005 || Math.abs(u - 0.88) < 0.005) value = 95;
        } else if (kind === 'shop-door') {
          if (u > 0.16 && u < 0.84 && v > 0.42 && v < 0.88)
            value = 60 + Math.max(0, 1 - Math.abs(u + v - 1.2) * 7) * 45;
          if (u > 0.17 && u < 0.83 && v > 0.13 && v < 0.34) value = 129;
        }
        if (frame) value = 222 + fine;
        c = [value, value * 0.97, value * 0.89];
        if (Math.hypot((u - 0.84) * 1.7, v - 0.48) < 0.026) c = [200, 163, 81];
      }
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) data[i + k] = Math.max(0, Math.min(255, Math.round(c[k])));
      data[i + 3] = 255;
    }
  const t = new T.DataTexture(data, size, size);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.magFilter = T.LinearFilter;
  t.minFilter = T.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.userData.shared = true;
  t.userData.buildingFinish = kind;
  t.needsUpdate = true;
  maps.set(kind, t);
  return t;
}
export function finishMaterial(kind: Finish, tint = '#ffffff') {
  return new T.MeshStandardMaterial({
    map: buildingTexture(kind),
    bumpMap: buildingTexture(kind),
    bumpScale: kind === 'metal' || kind === 'zinc' ? 0.02 : 0.035,
    color: tint,
    roughness: kind === 'metal' || kind === 'zinc' ? 0.67 : 0.9,
    metalness: kind === 'metal' || kind === 'zinc' ? 0.18 : 0,
  });
}
/** Metre-scaled UVs, matching all walls including triangular roof infills. */
export function finishSurface(
  mesh: T.Mesh<T.BufferGeometry, T.Material | T.Material[]>,
  kind: Exclude<WallFinish, 'stone'> | RoofFinish,
  tint = '#ffffff',
) {
  if (['slate', 'clay', 'zinc'].includes(kind)) mesh.userData.snowCap = 0.75;
  const g = mesh.geometry,
    p = g.attributes.position,
    n = g.attributes.normal,
    uv = [];
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)),
      ay = Math.abs(n.getY(i)),
      az = Math.abs(n.getZ(i));
    const roof = kind === 'slate' || kind === 'clay' || kind === 'zinc';
    if (roof && ay > ax && ay > az) {
      const acrossX = ax > az;
      uv.push(
        (acrossX ? p.getZ(i) + mesh.position.z : p.getX(i) + mesh.position.x) / 3.2,
        (acrossX ? p.getX(i) : p.getZ(i)) / Math.max(0.1, ay) / 3.2,
      );
    } else {
      uv.push(
        (ax > ay && ax > az ? p.getZ(i) + mesh.position.z : p.getX(i) + mesh.position.x) / 3.2,
        (ay > ax && ay > az ? p.getZ(i) + mesh.position.z : p.getY(i) + mesh.position.y) / 3.2,
      );
    }
  }
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
  mesh.material = finishMaterial(kind, tint);
  return mesh;
}
