// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { createHuman } from './human';

const textures = new Map<string, T.CanvasTexture>();
function texture(kind: 'hull' | 'deck' | 'cabin' | 'net' | 'instruments', color: string) {
  const key = kind + color;
  if (textures.has(key)) return textures.get(key)!;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = color;
  g.fillRect(0, 0, 1024, 512);
  if (kind === 'hull') {
    g.fillStyle = '#18343a';
    g.fillRect(0, 300, 1024, 212);
    g.fillStyle = '#ecd8a0';
    g.fillRect(0, 90, 1024, 18);
    for (let x = 0; x < 1024; x += 64) {
      g.fillStyle = '#172e333a';
      g.fillRect(x, 112, 2, 186);
      g.fillStyle = '#f3cc8a66';
      for (const y of [135, 280]) g.fillRect(x + 9, y, 4, 4);
    }
  } else if (kind === 'deck') {
    for (let x = 0; x < 1024; x += 64) {
      g.fillStyle = '#514b3b';
      g.fillRect(x, 0, 3, 512);
      for (let y = 0; y < 512; y += 64) {
        g.fillStyle = '#d0b57d';
        g.fillRect(x + 9, y + 8, 2, 22);
        g.fillStyle = '#333c34';
        g.fillRect(x + 8, y, 3, 3);
      }
    }
  } else if (kind === 'cabin') {
    g.strokeStyle = '#9e9a83';
    g.lineWidth = 3;
    g.strokeRect(10, 10, 1004, 492);
    for (const x of [55, 355, 655]) {
      g.fillStyle = '#b5b49c';
      g.fillRect(x, 35, 270, 270);
      const shade = g.createLinearGradient(x, 40, x + 260, 290);
      shade.addColorStop(0, '#a2b6b0');
      shade.addColorStop(0.4, '#466c7a');
      shade.addColorStop(1, '#182d35');
      g.fillStyle = shade;
      g.fillRect(x + 10, 45, 250, 250);
      g.strokeStyle = '#c8ddcd88';
      g.beginPath();
      g.moveTo(x + 30, 80);
      g.lineTo(x + 200, 130);
      g.stroke();
    }
    g.fillStyle = '#273d42';
    g.textAlign = 'center';
    g.font = 'bold 54px Georgia';
    g.fillText('NORTH STAR', 512, 400);
    g.font = '24px sans-serif';
    g.fillText('PW 30  •  FISHING', 512, 452);
  } else if (kind === 'net') {
    g.clearRect(0, 0, 1024, 512);
    g.strokeStyle = '#8eaa8a';
    g.lineWidth = 3;
    for (let x = -512; x < 1536; x += 32) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + 512, 512);
      g.moveTo(x, 0);
      g.lineTo(x - 512, 512);
      g.stroke();
    }
  } else {
    g.fillStyle = '#183b32';
    g.fillRect(30, 30, 350, 300);
    g.strokeStyle = '#6b9c7e';
    g.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(205, 180, 35 + i * 32, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(205, 180);
    g.lineTo(330, 90);
    g.stroke();
    for (let i = 0; i < 3; i++) {
      const x = 490 + i * 180;
      g.fillStyle = '#bbc3af';
      g.beginPath();
      g.arc(x, 150, 70, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#202e32';
      g.beginPath();
      g.arc(x, 150, 63, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#e9bc62';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x, 150);
      g.lineTo(x + 40, 120);
      g.stroke();
      g.fillStyle = '#e9dfbd';
      g.font = '22px sans-serif';
      g.textAlign = 'center';
      g.fillText(['RPM', 'FUEL', 'TEMP'][i], x, 255);
    }
    g.fillStyle = '#e8ddbd';
    g.font = '32px sans-serif';
    g.textAlign = 'center';
    g.fillText('NORTH STAR • MARINE DIESEL', 512, 405);
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  textures.set(key, t);
  return t;
}
/** Rounded, flared displacement hull: pointed high bow and broad working stern. */
function hull() {
  const p: number[] = [],
    uv: number[] = [],
    ix: number[] = [];
  const rings = [
    [-0.65, 0.7, 3.5],
    [-0.25, 1.25, 4.1],
    [0.8, 1.65, 4.7],
    [1.1, 1.67, 4.7],
  ];
  for (let j = 0; j < rings.length; j++)
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2,
        [y, w, l] = rings[j],
        z = Math.cos(a);
      const bow = z > 0;
      p.push(
        Math.sin(a) * w * (bow ? 1 - z * 0.45 : Math.pow(Math.max(0.05, 1 - z * z), -0.2)),
        y + (bow ? Math.pow(z, 4) * 0.35 : 0),
        z * l,
      );
      uv.push(i / 32, j / 3);
      if (j < 3 && i < 32) {
        const k = j * 33 + i;
        ix.push(k, k + 1, k + 33, k + 1, k + 34, k + 33);
      }
    }
  const c = p.length / 3;
  p.push(0, -0.65, 0);
  uv.push(0.5, 1);
  for (let i = 0; i < 32; i++) ix.push(c, i + 1, i);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(ix);
  geo.computeVertexNormals();
  return geo;
}
export function createFishingBoat(color = '#356c87') {
  const group = new T.Group(),
    body = new T.Group();
  group.name = 'North Star commercial fishing boat';
  body.name = 'Fishing hull and fittings';
  group.add(body);
  const helm = new T.Group();
  group.add(helm);
  let host = body;
  const paint = new T.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.2 });
  const cream = new T.MeshStandardMaterial({ color: '#e4dfc9', roughness: 0.7 });
  const iron = new T.MeshStandardMaterial({ color: '#263a3e', roughness: 0.7, metalness: 0.4 });
  const rope = new T.MeshStandardMaterial({ color: '#a9996b', roughness: 1 });
  const orange = new T.MeshStandardMaterial({ color: '#df793d', roughness: 0.75 });
  const timber = new T.MeshStandardMaterial({ map: texture('deck', '#96865e'), roughness: 0.9 });
  const panel = new T.MeshStandardMaterial({ map: texture('cabin', '#e4dfc9'), roughness: 0.55 });
  const netMat = new T.MeshStandardMaterial({
    map: texture('net', '#7e9981'),
    alphaTest: 0.35,
    side: T.DoubleSide,
    roughness: 1,
  });
  function add(geo: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0, parent = host) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (w: number, h: number, d: number, mat: T.Material, x: number, y: number, z: number) =>
    add(new T.BoxGeometry(w, h, d), mat, x, y, z);
  function rod(a: number[], b: number[], r = 0.035, mat: T.Material = iron, parent = host) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b),
      delta = to.clone().sub(from);
    const m = add(new T.CylinderGeometry(r, r, delta.length(), 8), mat, 0, 0, 0, parent);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return m;
  }
  add(
    hull(),
    new T.MeshStandardMaterial({ map: texture('hull', color), roughness: 0.65, metalness: 0.25 }),
  );
  // The deck follows the topside outline, with raised bulwarks and a working stern.
  const shape = new T.Shape();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2,
      z = Math.cos(a),
      x = Math.sin(a) * 1.57 * (z > 0 ? 1 - z * 0.45 : Math.pow(Math.max(0.05, 1 - z * z), -0.2));
    if (!i) shape.moveTo(x, -z * 4.65);
    else shape.lineTo(x, -z * 4.65);
  }
  const deck = new T.ShapeGeometry(shape);
  deck.rotateX(-Math.PI / 2);
  const pos = deck.attributes.position,
    u = deck.attributes.uv;
  for (let i = 0; i < pos.count; i++) u.setXY(i, pos.getX(i) / 3.2 + 0.5, pos.getZ(i) / 9.4 + 0.5);
  add(deck, timber, 0, 0.84, 0);
  // Wheelhouse forward, open aft working deck. Windows are texture faces; a real
  // empty interior and slender pillars leave the first-person view unobstructed.
  box(2.05, 0.75, 2.5, cream, 0, 1.23, 1.2);
  box(2.32, 0.16, 2.8, paint, 0, 2.92, 1.2);
  for (const x of [-1.02, 1.02])
    for (const z of [-0.05, 2.45]) box(0.09, 1.35, 0.09, cream, x, 2.22, z);
  for (const sign of [-1, 1]) {
    const face = add(new T.PlaneGeometry(2.47, 1.25), panel, sign * 1.025, 2.22, 1.2);
    face.rotation.y = (sign * Math.PI) / 2;
  }
  const front = add(new T.PlaneGeometry(2.04, 1.25), panel, 0, 2.22, 2.456);
  // Hide the exterior glazing from the helm, like a one-sided window skin.
  const back = add(new T.PlaneGeometry(2.04, 1.25), panel, 0, 2.22, -0.056);
  back.rotation.y = Math.PI;
  host = helm;
  box(1.65, 0.12, 0.48, iron, 0, 1.84, 2.04);
  const instruments = add(
    new T.PlaneGeometry(1.45, 0.43),
    new T.MeshStandardMaterial({ map: texture('instruments', '#273b3c') }),
    0,
    1.91,
    1.83,
  );
  instruments.rotation.x = -0.55;
  instruments.rotation.y = Math.PI;
  const wheel = add(new T.TorusGeometry(0.25, 0.025, 6, 16), rope, 0, 1.85, 1.59);
  wheel.rotation.x = 0.25;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    rod([0, 1.85, 1.59], [Math.sin(a) * 0.25, 1.85 + Math.cos(a) * 0.25, 1.59], 0.012, iron);
  }
  box(0.5, 0.08, 0.45, rope, 0, 1.27, 0.85);
  box(0.09, 0.4, 0.09, iron, 0, 1.03, 0.85);
  host = body;
  // Mast, lights, exhaust and gantry form a recognisable trawler silhouette.
  rod([0, 2.94, 1], [0, 4.55, 1], 0.065, cream);
  rod([-0.7, 4.05, 1], [0.7, 4.05, 1], 0.04, cream);
  rod([0, 4.5, 1], [0, 5.2, 1], 0.015);
  box(0.5, 0.1, 0.15, cream, 0, 4.6, 1);
  add(new T.CylinderGeometry(0.11, 0.11, 1.2, 8), iron, -0.8, 3.4, 0.2);
  for (const sign of [-1, 1]) {
    rod([sign * 1.22, 0.9, -3.3], [sign * 1.05, 3.3, -3.05], 0.075, paint);
    rod([sign * 1.05, 3.3, -3.05], [sign * 0.65, 3.8, -2.75], 0.055, paint);
    for (const z of [-3.7, -1.5, 3.2]) {
      const t = z / 4.7;
      const x = Math.sqrt(1 - t * t) * 1.67 * (t > 0 ? 1 - t * 0.45 : Math.pow(1 - t * t, -0.2));
      const tyre = add(new T.TorusGeometry(0.22, 0.075, 6, 12), iron, sign * (x + 0.06), 0.8, z);
      tyre.rotation.y = Math.PI / 2;
      rod([sign * x, 1.17, z], [sign * (x + 0.06), 0.9, z], 0.018, rope);
    }
    rod([sign * 1.54, 1.14, -3.6], [sign * 1.54, 1.14, -0.4], 0.04, cream);
    for (const z of [-3.6, -2, -0.4])
      rod([sign * 1.54, 0.85, z], [sign * 1.54, 1.14, z], 0.025, cream);
    const ring = add(new T.TorusGeometry(0.25, 0.065, 6, 16), orange, sign * 1.09, 1.31, 0.1);
    ring.rotation.y = Math.PI / 2;
  }
  rod([-0.65, 3.8, -2.75], [0.65, 3.8, -2.75], 0.065, paint);
  // Net drum and winch ahead of the stern gate.
  const drum = add(new T.CylinderGeometry(0.36, 0.36, 1.3, 12), rope, 0, 1.32, -2.1);
  drum.rotation.z = Math.PI / 2;
  for (const x of [-0.7, 0.7]) {
    const flange = add(new T.CylinderGeometry(0.43, 0.43, 0.06, 12), iron, x, 1.32, -2.1);
    flange.rotation.z = Math.PI / 2;
    box(0.12, 0.5, 0.55, paint, x, 1.04, -2.1);
  }
  const netRoll = add(new T.CylinderGeometry(0.39, 0.39, 1.24, 12), netMat, 0, 1.32, -2.1);
  netRoll.rotation.z = Math.PI / 2;
  // Insulated fish boxes, hatch, ropes and bow anchor stay simple geometry.
  box(1.3, 0.12, 1.35, cream, 0, 0.94, -0.8);
  for (const x of [-0.95, 0.95])
    for (const z of [-0.8, -1.4]) {
      box(0.48, 0.3, 0.44, orange, x, 1.05, z);
      box(0.4, 0.02, 0.36, iron, x, 1.21, z);
    }
  for (const x of [-0.65, 0.65]) {
    rod([x, 0.9, 3.1], [x, 1.09, 3.1], 0.04);
    rod([x - 0.14, 1.08, 3.1], [x + 0.14, 1.08, 3.1], 0.04);
  }
  add(new T.TorusGeometry(0.25, 0.07, 6, 14), rope, 0.5, 1.02, 3.25).rotation.x = Math.PI / 2;
  rod([0, 1.2, 4.1], [0, 0.65, 4.65], 0.05);
  rod([-0.3, 0.65, 4.65], [0.3, 0.65, 4.65], 0.04);
  batch(body);
  // A lightweight mesh net trails aft below the surface; no per-fibre geometry.
  const gear = new T.Group();
  group.add(gear);
  gear.visible = false;
  rod([-0.55, 3.68, -2.8], [-1.4, -0.2, -7], 0.018, rope, gear);
  rod([0.55, 3.68, -2.8], [1.4, -0.2, -7], 0.018, rope, gear);
  const net = add(new T.ConeGeometry(1.6, 4, 12, 1, true), netMat, 0, -0.3, -8.7, gear);
  net.rotation.x = Math.PI / 2;
  batch(gear);
  body.scale.set(2.175, 1.35, 2.175);
  gear.scale.copy(body.scale);
  // Controls and crew stay human-sized in the enlarged wheelhouse.
  helm.position.set(0, 1.3 * 0.35, 2.45 * 1.175);
  batch(helm);
  const driver = createHuman('seated').group;
  driver.position.set(0, 1.3 * 1.35, 0.85 + helm.position.z);
  group.add(driver);
  group.userData.driver = driver;
  group.userData.eye = new T.Vector3(0, 1.3 * 1.35 + 0.92, 0.85 + helm.position.z);
  group.userData.viewPitch = -0.04;
  group.userData.lamp = new T.Vector3(0, 3 * 1.35, 2.5 * 2.175);
  return {
    group,
    animate(deployed: boolean) {
      gear.visible = deployed;
    },
  };
}
