import { vehicleLamp } from './vehicle-lights';
// SPDX-License-Identifier: GPL-3.0-or-later
import { addTractorCockpit } from './tractor-cockpit';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { vehicles } from '../shared/catalog';
import { detailMaterial, detailTexture } from './detail-textures';
import { contactShadow } from './materials';
import { createHuman } from './human';
import { batch } from './tractor';

/** Dimensions are metres. Each design has its own chassis, bonnet, cab and wheelbase. */
export const tractorShapes: Record<
  number,
  {
    half: number;
    rear: number;
    front: number;
    rr: number;
    fr: number;
    tyre: number;
    seatY: number;
    seatZ: number;
  }
> = {
  0: { half: 1, rear: -1, front: 1.18, rr: 0.82, fr: 0.55, tyre: 0.48, seatY: 1.72, seatZ: -0.82 },
  24: {
    half: 0.84,
    rear: -0.86,
    front: 1.02,
    rr: 0.67,
    fr: 0.43,
    tyre: 0.38,
    seatY: 1.35,
    seatZ: -0.65,
  },
  25: {
    half: 0.98,
    rear: -1.05,
    front: 1.42,
    rr: 0.76,
    fr: 0.6,
    tyre: 0.43,
    seatY: 1.62,
    seatZ: -0.62,
  },
  26: {
    half: 1.15,
    rear: -1.58,
    front: 1.38,
    rr: 0.87,
    fr: 0.63,
    tyre: 0.56,
    seatY: 1.64,
    seatZ: 0.7,
  },
  27: {
    half: 1.12,
    rear: -1.28,
    front: 1.27,
    rr: 0.82,
    fr: 0.82,
    tyre: 0.68,
    seatY: 1.98,
    seatZ: -0.15,
  },
  28: {
    half: 1,
    rear: -1.32,
    front: 1.16,
    rr: 0.68,
    fr: 0.68,
    tyre: 0.48,
    seatY: 1.66,
    seatZ: 0.65,
  },
};
const badges = new Map<number, T.CanvasTexture>();
function badge(slot: number) {
  let texture = badges.get(slot);
  if (texture) return texture;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e6ddba';
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = '#303b36';
  ctx.fillRect(6, 6, 500, 116);
  ctx.strokeStyle = '#ba9c59';
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, 484, 100);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#efe6c9';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(vehicles[slot].name.toUpperCase(), 256, 61, 465);
  ctx.font = '14px monospace';
  ctx.fillText('PARISH MOTOR WORKS  /  ' + String(slot + 1).padStart(2, '0'), 256, 91);
  texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  texture.userData.shared = true;
  badges.set(slot, texture);
  return texture;
}
export function fleetTractor(
  g: T.Group,
  slot: number,
  color = vehicles[slot].color,
  shadow = contactShadow,
) {
  const d = tractorShapes[slot];
  const paint = new T.MeshStandardMaterial({
    color,
    map: detailTexture('paint'),
    roughness: 0.48,
    metalness: 0.22,
  });
  const trim = new T.MeshStandardMaterial({
    color: slot === 25 ? '#dba44f' : '#e2d5b3',
    roughness: 0.65,
    metalness: 0.15,
  });
  const dark = new T.MeshStandardMaterial({ color: '#293632', roughness: 0.7, metalness: 0.25 });
  const rubber = detailMaterial('tyre', '#b8b8b8', 0.025),
    rim = detailMaterial('rim', '#e0d5b9', 0.015);
  const glass = new T.MeshStandardMaterial({
    color: '#95c4cc',
    roughness: 0.16,
    metalness: 0.2,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const lens = vehicleLamp(
    new T.MeshStandardMaterial({
      color: '#fff3c9',
      emissive: '#ffdb87',
      emissiveIntensity: 0.5,
      roughness: 0.2,
    }),
    0.9,
  );
  const rearLens = vehicleLamp(
    new T.MeshStandardMaterial({
      color: '#b83d29',
      emissive: '#771b12',
      emissiveIntensity: 0.25,
    }),
    0.4,
  );
  const wood = detailMaterial('siding', '#ab8561', 0.02);
  const grille = detailMaterial('grille'),
    vents = detailMaterial('vents');
  const label = new T.MeshStandardMaterial({ map: badge(slot), roughness: 0.65 });
  const add = (
    parent: T.Group,
    geometry: T.BufferGeometry,
    material: T.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new T.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = !material.transparent;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (
    w: number,
    h: number,
    l: number,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    round = 0,
  ) =>
    add(
      g,
      round ? new RoundedBoxGeometry(w, h, l, 1, round) : new T.BoxGeometry(w, h, l),
      mat,
      x,
      y,
      z,
    );
  const panel = (
    w: number,
    h: number,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    yaw = 0,
  ) => {
    const m = add(g, new T.PlaneGeometry(w, h), mat, x, y, z);
    m.rotation.y = yaw;
    return m;
  };
  const cyl = (r: number, h: number, mat: T.Material, x: number, y: number, z: number) =>
    add(g, new T.CylinderGeometry(r, r, h, 10), mat, x, y, z);
  const cab = (
    cx: number,
    cz: number,
    width: number,
    depth: number,
    base: number,
    height: number,
    open = false,
    swept = false,
  ) => {
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        if (open && z > 0) continue;
        const post = box(
          0.055,
          height,
          0.055,
          trim,
          cx + (x * width) / 2,
          base + height / 2,
          cz + (z * depth) / 2,
        );
        if (swept && z > 0) post.rotation.x = -0.13;
      }
      if (!open)
        box(0.018, height - 0.16, depth - 0.1, glass, cx + (x * width) / 2, base + height / 2, cz);
    }
    if (!open)
      for (const z of [-1, 1]) {
        const pane = box(
          width - 0.1,
          height - 0.15,
          0.018,
          glass,
          cx,
          base + height / 2,
          cz + (z * depth) / 2,
        );
        if (swept && z > 0) pane.rotation.x = -0.13;
        box(width, 0.065, 0.07, trim, cx, base + 0.02, cz + (z * depth) / 2);
      }
    if (!open) box(width + 0.23, 0.11, depth + 0.21, trim, cx, base + height + 0.03, cz, 0.045);
    else box(width + 0.07, 0.07, 0.1, dark, cx, base + height, cz - depth / 2); // open roll bar
  };
  const hood = (
    width: number,
    height: number,
    length: number,
    y: number,
    z: number,
    round = 0.06,
  ) => {
    box(width, height, length, paint, 0, y, z, round);
    box(width + 0.05, height * 0.8, 0.06, trim, 0, y, z + length / 2 + 0.01, 0.02);
    panel(width * 0.82, height * 0.66, grille, 0, y, z + length / 2 + 0.049);
    for (const side of [-1, 1]) {
      panel(
        length * 0.72,
        0.22,
        vents,
        side * (width / 2 + 0.006),
        y - 0.12,
        z,
        (side * Math.PI) / 2,
      );
      panel(
        Math.min(1.05, length * 0.8),
        0.27,
        label,
        side * (width / 2 + 0.009),
        y + height * 0.3,
        z,
        (side * Math.PI) / 2,
      );
    }
  };
  box(d.half * 1.43, 0.28, d.front - d.rear + 1.1, dark, 0, 0.78, (d.front + d.rear) / 2);
  // Silhouettes are intentionally not the same cab with six paint jobs.
  if (slot === 0) {
    hood(1.28, 0.88, 1.82, 1.46, 0.91, 0.16);
    cab(0, -0.77, 1.23, 1.2, 1.7, 1.03);
  } else if (slot === 24) {
    hood(1.02, 0.62, 1.64, 1.16, 0.77, 0.12);
    cab(0, -0.61, 1.03, 0.85, 1.35, 1.05, true);
    box(0.92, 0.1, 0.8, trim, 0, 1.23, -1.16, 0.03);
  } else if (slot === 25) {
    // Narrow prow and sloping bonnet panels form the courier's long nose.
    const body = box(1.29, 0.73, 2.13, paint, 0, 1.43, 1.05, 0.15);
    body.rotation.x = 0.07;
    hood(1.09, 0.53, 0.45, 1.32, 2.01, 0.08);
    for (const side of [-1, 1]) {
      panel(1.72, 0.22, label, side * 0.651, 1.52, 0.95, (side * Math.PI) / 2);
      box(0.025, 0.09, 1.95, trim, side * 0.655, 1.21, 0.91);
    }
    cab(0, -0.55, 1.21, 1.3, 1.62, 1.09, false, true);
  } else if (slot === 26) {
    // Forward driving cab and long open load bed, rather than an agricultural bonnet.
    hood(1.63, 0.65, 0.56, 1.23, 1.77, 0.035);
    cab(0, 0.7, 1.55, 1.24, 1.6, 1.13);
    box(1.88, 0.16, 2.3, wood, 0, 1.28, -1.14);
    for (const side of [-1, 1]) box(0.065, 0.43, 2.3, wood, side * 0.91, 1.58, -1.14);
    box(1.85, 0.43, 0.07, wood, 0, 1.58, -2.25);
    for (const side of [-1, 1])
      panel(0.98, 0.25, label, side * 0.95, 1.6, -1.05, (side * Math.PI) / 2);
  } else if (slot === 27) {
    hood(1.43, 0.69, 1.2, 1.81, 1.12, 0.035);
    cab(0, -0.18, 1.38, 1.37, 1.95, 1.16);
    box(1.92, 0.14, 0.22, dark, 0, 1.14, 1.88);
    for (const side of [-1, 1]) box(0.08, 0.75, 0.09, dark, side * 0.8, 1.53, 1.86);
    box(1.67, 0.07, 0.09, dark, 0, 1.91, 1.86);
    box(1.4, 0.36, 0.65, paint, 0, 1.3, -1.35, 0.035);
  } else {
    hood(1.48, 0.58, 0.38, 1.3, 1.48, 0.07);
    cab(0, 0.65, 1.43, 1.28, 1.62, 1.19);
    box(1.65, 0.14, 1.61, dark, 0, 1.18, -1.03);
    box(1.42, 0.53, 1.1, paint, 0, 1.47, -0.91, 0.05);
    for (const side of [-1, 1]) {
      panel(0.84, 0.23, label, side * 0.72, 1.53, -0.91, (side * Math.PI) / 2);
      box(0.2, 0.18, 0.22, dark, side * 0.56, 2.95, 1.21, 0.02);
      panel(0.15, 0.12, lens, side * 0.56, 2.95, 1.328);
    }
    box(1.4, 0.09, 0.2, dark, 0, 2.85, 1.21);
  }
  const frontZ =
    slot === 25
      ? 2.25
      : slot === 26
        ? 2.1
        : slot === 27
          ? 1.76
          : slot === 28
            ? 1.71
            : slot === 24
              ? 1.61
              : 1.86;
  for (const side of [-1, 1]) {
    const lamp = cyl(
      0.13,
      0.12,
      trim,
      side * (slot === 24 ? 0.42 : 0.55),
      slot === 27 ? 1.96 : 1.53,
      frontZ,
    );
    lamp.rotation.x = Math.PI / 2;
    add(g, new T.CircleGeometry(0.105, 12), lens, lamp.position.x, lamp.position.y, frontZ + 0.065);
    box(0.18, 0.1, 0.04, rearLens, side * d.half, Math.max(1.2, d.rr * 2), d.rear - 0.56);
    // Fenders follow each wheel pair; side steps and cab mirrors give a human scale cue.
    for (const [z, r] of [
      [d.rear, d.rr],
      [d.front, d.fr],
    ])
      box(d.tyre + 0.12, 0.09, r * 1.64, paint, side * d.half, 2 * r + 0.06, z, 0.04);
    box(0.32, 0.09, 0.56, dark, side * (d.half - 0.05), 0.65, d.seatZ);
    if (slot !== 24) {
      box(0.42, 0.035, 0.035, dark, side * (d.half - 0.14), d.seatY + 0.82, d.seatZ + 0.65);
      box(0.22, 0.16, 0.055, dark, side * (d.half + 0.04), d.seatY + 0.82, d.seatZ + 0.65);
      box(0.17, 0.12, 0.016, glass, side * (d.half + 0.04), d.seatY + 0.82, d.seatZ + 0.684);
    }
  }
  box(0.64, 0.13, 0.57, dark, 0, d.seatY - 0.05, d.seatZ - 0.2);
  box(0.64, 0.46, 0.1, dark, 0, d.seatY + 0.16, d.seatZ - 0.46, 0.03);
  const human = createHuman('seated');
  human.group.position.set(0, d.seatY, d.seatZ - 0.2);
  g.add(human.group);
  g.userData.driver = human.group;
  const exhaustZ = slot === 26 || slot === 28 ? -0.17 : 0.72;
  cyl(0.055, 0.97, dark, -0.48, d.seatY + 0.35, exhaustZ);
  box(0.16, 0.055, 0.13, dark, -0.48, d.seatY + 0.85, exhaustZ);
  g.userData.exhaust = new T.Vector3(-0.48, d.seatY + 0.88, exhaustZ);
  g.userData.viewPitch = -0.12;
  g.userData.eye = new T.Vector3(0, d.seatY + 0.65, d.seatZ - 0.28);
  g.userData.lamp = new T.Vector3(0, slot === 28 ? 2.95 : 1.53, frontZ);
  g.userData.contacts = [];
  g.userData.tyreFootprints = [];
  for (const side of [-1, 1])
    for (const [z, r] of [
      [d.rear, d.rr],
      [d.front, d.fr],
    ]) {
      const wheel = new T.Group();
      wheel.position.set(side * d.half, r, z);
      wheel.userData.radius = r;
      g.add(wheel);
      (g.userData.wheels ??= []).push(wheel);
      const contact = new T.Vector3(side * d.half, 0, z);
      g.userData.contacts.push(contact);
      g.userData.tyreFootprints.push({ position: contact, width: d.tyre });
      const t = add(wheel, new T.CylinderGeometry(r, r, d.tyre, 20), rubber, 0, 0, 0);
      t.rotation.z = Math.PI / 2;
      for (const face of [-1, 1]) {
        const disc = add(
          wheel,
          new T.CircleGeometry(r * 0.53, 16),
          rim,
          face * (d.tyre / 2 + 0.003),
          0,
          0,
        );
        disc.rotation.y = (face * Math.PI) / 2;
        const hub = add(
          wheel,
          new T.CylinderGeometry(r * 0.17, r * 0.17, 0.08, 10),
          paint,
          face * d.tyre * 0.53,
          0,
          0,
        );
        hub.rotation.z = Math.PI / 2;
      }
      batch(wheel);
    }
  addTractorCockpit(
    g,
    slot,
    d.seatY,
    d.seatZ,
    ({ 0: 1.23, 24: 1.03, 25: 1.21, 26: 1.55, 27: 1.38, 28: 1.43 } as Record<number, number>)[slot],
    dark,
    paint,
  );
  batch(g);
  const shade = shadow(d.half * 2 + 1.1, d.front - d.rear + 2.1, 0.45);
  shade.position.y = 0.025;
  g.add(shade);
  g.userData.snowShadow = shade;
}
