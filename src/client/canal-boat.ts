// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { createHuman } from './human';
import { createFishingLights, canalLightLayout } from './fishing-lights';

// +Z is the bow. The simulation places the model origin at the waterline.
const maps = new Map<string, T.CanvasTexture>();
function finish(kind: 'side' | 'door' | 'deck' | 'hull', color = '#ffffff') {
  const key = `${kind}:${color}`;
  const cached = maps.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext('2d')!;
  c.fillStyle = color;
  c.fillRect(0, 0, 1024, 512);
  if (kind === 'deck') {
    c.fillStyle = '#9c7950';
    c.fillRect(0, 0, 1024, 512);
    for (let x = 0; x < 1024; x += 64) {
      c.fillStyle = '#493e2d';
      c.fillRect(x, 0, 3, 512);
      for (let n = 0; n < 12; n++) {
        c.strokeStyle = n % 2 ? '#be9c6b65' : '#55452e45';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x + 6 + n * 4, 0);
        c.bezierCurveTo(x + 12 + n * 4, 170, x + 2 + n * 4, 340, x + 6 + n * 4, 512);
        c.stroke();
      }
      for (const y of [18, 490]) {
        c.fillStyle = '#403b30';
        c.fillRect(x + 10, y, 3, 3);
        c.fillRect(x + 48, y, 3, 3);
      }
    }
  } else if (kind === 'hull') {
    c.fillStyle = '#212c30';
    c.fillRect(0, 230, 1024, 282);
    c.fillStyle = '#d7bd79';
    c.fillRect(0, 80, 1024, 14);
    c.fillRect(0, 109, 1024, 4);
    for (let x = 0; x < 1024; x += 128) {
      c.fillStyle = '#15272f35';
      c.fillRect(x, 125, 2, 100);
      for (const y of [138, 208]) c.fillRect(x + 8, y, 3, 3);
    }
  } else {
    c.strokeStyle = '#c3a361';
    c.lineWidth = 5;
    c.strokeRect(15, 18, 994, 476);
    c.strokeRect(24, 28, 976, 456);
    const glass = (x: number, y: number, w: number, h: number, round = false) => {
      c.fillStyle = '#dbc995';
      c.beginPath();
      if (round) c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      else c.roundRect(x, y, w, h, 12);
      c.fill();
      c.save();
      c.beginPath();
      if (round) c.ellipse(x + w / 2, y + h / 2, w / 2 - 4, h / 2 - 8, 0, 0, Math.PI * 2);
      else c.roundRect(x + 8, y + 8, w - 16, h - 16, 6);
      c.clip();
      const g = c.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, '#69969e');
      g.addColorStop(0.5, '#243f49');
      g.addColorStop(1, '#112630');
      c.fillStyle = g;
      c.fillRect(x, y, w, h);
      c.fillStyle = '#bfd2c23d';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + w * 0.8, y);
      c.lineTo(x + w * 0.25, y + h);
      c.lineTo(x, y + h);
      c.fill();
      c.restore();
    };
    if (kind === 'side') {
      for (const x of [200, 425, 650]) {
        glass(x, 85, 172, 230);
        c.fillStyle = '#d5c18c';
        c.fillRect(x + 82, 90, 6, 220);
        c.fillRect(x + 5, 155, 162, 5);
      }
      glass(84, 126, 50, 110, true);
      glass(890, 126, 50, 110, true);
      c.fillStyle = '#e5d49b';
      c.textAlign = 'center';
      c.font = 'bold 42px Georgia';
      c.fillText('PARISH CARRIER', 512, 403);
      c.font = '17px serif';
      c.fillText('INLAND NAVIGATION  •  No. 03', 512, 450);
    } else {
      c.fillStyle = '#e0dbbd';
      c.fillRect(244, 45, 536, 440);
      c.fillStyle = '#655444';
      c.fillRect(267, 66, 490, 400);
      glass(300, 90, 424, 190);
      c.strokeStyle = '#c9ac79';
      c.lineWidth = 7;
      c.strokeRect(300, 309, 424, 127);
      c.fillStyle = '#e2c174';
      c.fillRect(680, 292, 35, 12);
      for (const x of [70, 840]) {
        c.fillStyle = '#263d42';
        for (let y = 330; y < 440; y += 17) c.fillRect(x, y, 110, 5);
      }
    }
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  map.userData.shared = true;
  maps.set(key, map);
  return map;
}

let cabinMask: T.CanvasTexture;
function cabinWindowMask() {
  if (cabinMask) return cabinMask;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#000';
  c.fillRect(0, 0, 1024, 512);
  c.fillStyle = '#fff';
  for (const x of [200, 425, 650]) c.fillRect(x + 8, 93, 156, 214);
  for (const x of [84, 890]) {
    c.beginPath();
    c.ellipse(x + 25, 181, 21, 47, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = '#000';
  for (const x of [200, 425, 650]) {
    c.fillRect(x + 82, 90, 6, 220);
    c.fillRect(x + 5, 155, 162, 5);
  }
  cabinMask = new T.CanvasTexture(canvas);
  cabinMask.colorSpace = T.SRGBColorSpace;
  cabinMask.userData.shared = true;
  return cabinMask;
}

/** Rounded swim ends, flat base and flared topsides; closed, low-poly steel hull. */
function hullGeometry() {
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const rings = [
    [-0.48, 0.72, 3.55],
    [-0.25, 0.96, 4.05],
    [0.38, 1.12, 4.43],
    [0.58, 1.14, 4.5],
  ];
  const n = 32;
  for (let j = 0; j < rings.length; j++)
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2,
        [y, w, l] = rings[j];
      positions.push(
        Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.55) * w,
        y,
        Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.65) * l,
      );
      uvs.push(i / n, j / (rings.length - 1));
      if (j < rings.length - 1 && i < n) {
        const k = j * (n + 1) + i,
          b = k + n + 1;
        indices.push(k, k + 1, b, k + 1, b + 1, b);
      }
    }
  const centre = positions.length / 3;
  positions.push(0, -0.48, 0);
  uvs.push(0.5, 0);
  for (let i = 0; i < n; i++) indices.push(centre, i + 1, i);
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function deckGeometry() {
  const shape = new T.Shape();
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * Math.PI * 2,
      x = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.55) * 1.1,
      z = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 0.65) * 4.4;
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  }
  const g = new T.ShapeGeometry(shape);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position,
    u = g.attributes.uv;
  for (let i = 0; i < p.count; i++) u.setXY(i, p.getX(i) / 2.2 + 0.5, p.getZ(i) / 8.8 + 0.5);
  return g;
}
export function createCanalBoat(color = '#407983') {
  const group = new T.Group();
  group.name = 'Parish Carrier canal boat';
  const body = new T.Group();
  group.add(body);
  const paint = new T.MeshStandardMaterial({ color, roughness: 0.57, metalness: 0.22 });
  const hull = new T.MeshStandardMaterial({
    map: finish('hull', color),
    roughness: 0.67,
    metalness: 0.25,
  });
  const cream = new T.MeshStandardMaterial({ color: '#e9dfbf', roughness: 0.7 });
  const iron = new T.MeshStandardMaterial({ color: '#253338', roughness: 0.72, metalness: 0.3 });
  const brass = new T.MeshStandardMaterial({ color: '#bc9c58', roughness: 0.4, metalness: 0.65 });
  const wood = new T.MeshStandardMaterial({ map: finish('deck'), roughness: 0.88 });
  const side = new T.MeshStandardMaterial({
    map: finish('side', color),
    emissiveMap: cabinWindowMask(),
    roughness: 0.5,
  });
  const door = new T.MeshStandardMaterial({ map: finish('door'), roughness: 0.65 });
  function add(g: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0, parent = body) {
    const mesh = new T.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const box = (w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number) =>
    add(new T.BoxGeometry(w, h, d), m, x, y, z);
  function rod(a: number[], b: number[], r = 0.025, m: T.Material = brass, parent = body) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b),
      delta = to.clone().sub(from);
    const mesh = add(new T.CylinderGeometry(r, r, delta.length(), 8), m, 0, 0, 0, parent);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }
  const shell = add(hullGeometry(), hull, 0, 0, 0, group);
  shell.name = 'Waterline hull';
  add(deckGeometry(), wood, 0, 0.58, 0);
  // Slim side decks run past the cabin; its windows and panelling are textures.
  box(1.78, 1.16, 5.4, paint, 0, 1.16, 0.45);
  for (const sign of [-1, 1]) {
    const face = add(new T.PlaneGeometry(5.35, 1.14), side, sign * 0.895, 1.16, 0.45);
    face.rotation.y = (sign * Math.PI) / 2;
    rod([sign * 0.99, 0.64, -3.3], [sign * 0.99, 0.64, 3.3], 0.045, iron);
    rod([sign * 0.82, 1.97, -2.1], [sign * 0.82, 1.97, 2.9], 0.022, brass);
    for (const z of [-1.9, 0.4, 2.7])
      rod([sign * 0.82, 1.81, z], [sign * 0.82, 1.97, z], 0.018, brass);
  }
  for (const sign of [-1, 1]) {
    const end = add(new T.PlaneGeometry(1.76, 1.14), door, 0, 1.16, 0.45 + sign * 2.706);
    if (sign < 0) end.rotation.y = Math.PI;
  }
  const roof = new T.Shape()
    .moveTo(-0.98, 1.72)
    .lineTo(-0.98, 1.79)
    .quadraticCurveTo(0, 2.05, 0.98, 1.79)
    .lineTo(0.98, 1.72)
    .closePath();
  const roofGeo = new T.ExtrudeGeometry(roof, {
    depth: 5.65,
    bevelEnabled: false,
    curveSegments: 8,
    steps: 1,
  });
  add(roofGeo, cream, 0, 0, -2.375);
  // Mushroom ventilators, short stove chimney and a restrained roof hatch.
  for (const z of [-1.3, 0.6, 2.3]) {
    add(new T.CylinderGeometry(0.055, 0.055, 0.12, 8), brass, 0, 1.97, z);
    add(new T.SphereGeometry(0.14, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), brass, 0, 2.03, z);
  }
  add(new T.CylinderGeometry(0.095, 0.095, 0.48, 10), iron, -0.5, 2.11, 1.6);
  add(new T.CylinderGeometry(0.16, 0.16, 0.04, 10), iron, -0.5, 2.37, 1.6);
  box(0.65, 0.045, 0.7, paint, 0, 1.94, -0.45);
  // Bow locker and stern bench leave open working decks at either end.
  box(1.12, 0.32, 0.55, paint, 0, 0.75, 3.62);
  box(1.18, 0.055, 0.6, wood, 0, 0.93, 3.62);
  box(0.65, 0.46, 0.5, paint, -0.55, 0.81, -3.48);
  box(0.72, 0.06, 0.58, wood, -0.55, 1.07, -3.48);
  for (const z of [-3.9, 3.92])
    for (const x of [-0.48, 0.48]) {
      rod([x, 0.59, z], [x, 0.78, z], 0.04, iron);
      rod([x - 0.12, 0.76, z], [x + 0.12, 0.76, z], 0.04, iron);
    }
  // Low stern guard, rope fenders, bow lamp and lifebuoy are readable silhouettes.
  for (const sign of [-1, 1]) {
    rod([sign * 0.86, 0.6, -3.45], [sign * 0.86, 1.15, -3.45]);
    rod([sign * 0.86, 1.15, -3.45], [sign * 0.6, 1.15, -4]);
  }
  rod([-0.6, 1.15, -4], [0.6, 1.15, -4]);
  const rope = new T.MeshStandardMaterial({ color: '#a99b78', roughness: 1 });
  for (const z of [-4.43, 4.43]) {
    const f = add(new T.CapsuleGeometry(0.12, 0.26, 2, 8), rope, 0, 0.29, z);
    f.rotation.z = Math.PI / 2;
  }
  for (let i = 0; i < 3; i++) {
    const coil = add(new T.TorusGeometry(0.13 + i * 0.035, 0.015, 4, 16), rope, -0.45, 0.61, 3.1);
    coil.rotation.x = Math.PI / 2;
  }
  const lifebuoy = add(new T.TorusGeometry(0.25, 0.065, 6, 16), cream, -0.97, 1.15, -1.8);
  lifebuoy.rotation.y = Math.PI / 2;
  const orange = new T.MeshStandardMaterial({ color: '#c86b3e', roughness: 0.7 });
  for (const y of [0.9, 1.4]) box(0.15, 0.1, 0.16, orange, -0.97, y, -1.8);
  box(0.23, 0.2, 0.16, iron, 0, 0.78, 4.08);
  box(0.15, 0.12, 0.025, cream, 0, 0.78, 4.17);
  // Passenger rod-fishing decks: paired rod racks, tackle locker and cushioned seats.
  const cork = new T.MeshStandardMaterial({ color: '#b79b68', roughness: 1 });
  const line = new T.MeshStandardMaterial({ color: '#636b59', roughness: 0.9 });
  for (const sign of [-1, 1]) {
    box(0.36, 0.32, 0.78, paint, sign * 0.68, 0.76, 3.65);
    box(0.38, 0.06, 0.8, cream, sign * 0.68, 0.95, 3.65);
    for (const z of [-3.4, -3.05]) {
      rod([sign * 0.95, 0.65, z], [sign * 0.95, 1.05, z + 0.15], 0.035, brass);
      rod([sign * 0.95, 0.85, z], [sign * 1.03, 2.18, z + 0.72], 0.012, iron);
      rod([sign * 0.95, 0.85, z], [sign * 0.97, 1.2, z + 0.19], 0.022, cork);
      add(
        new T.CylinderGeometry(0.055, 0.055, 0.045, 8),
        brass,
        sign * 0.92,
        1.04,
        z + 0.1,
      ).rotation.z = Math.PI / 2;
    }
    for (const z of [-2.7, 0.4, 2.7]) {
      rod([sign * 1.11, 0.95, z], [sign * 1.11, 0.48, z], 0.012, line);
      add(new T.CapsuleGeometry(0.09, 0.24, 2, 8), cream, sign * 1.13, 0.34, z);
    }
    rod([sign * 0.91, 0.64, 3.45], [sign * 0.91, 1.1, 3.45], 0.024);
    rod([sign * 0.91, 1.1, 3.45], [sign * 0.55, 1.1, 4.05], 0.024);
  }
  rod([-0.55, 1.1, 4.05], [0.55, 1.1, 4.05], 0.024);
  box(0.55, 0.25, 0.44, cream, -0.6, 0.735, -3.3);
  box(0.57, 0.035, 0.46, iron, -0.6, 0.88, -3.3);
  // A short mast supports the high white light; rods do not carry trawling signals.
  rod([0, 1.9, 2.6], [0, 2.84, 2.6], 0.028, brass);
  box(0.12, 0.2, 0.12, iron, 0, 1.14, -4.1);
  // Tiller pivots as one separate part, without adding per-frame geometry.
  const tiller = new T.Group();
  tiller.name = 'Stern tiller';
  tiller.position.set(0, 0.6, -3.94);
  group.add(tiller);
  rod([0, 0, 0], [0, 0.94, 0], 0.035, brass, tiller);
  rod([0, 0.94, 0], [0.5, 0.94, 0.6], 0.035, brass, tiller);
  rod([0.38, 0.94, 0.46], [0.84, 0.94, 0.86], 0.045, wood, tiller);
  batch(tiller);
  // A full-size adult stands on a raised stern steering step. Scale the craft,
  // not the person, so the cabin and working decks have believable proportions.
  box(0.95, 0.32, 1.05, paint, 0.55, 0.74, -3.48);
  const dimensions = new T.Vector3(1.5, 1.4, 1.5);
  body.scale.copy(dimensions);
  shell.scale.copy(dimensions);
  tiller.position.multiply(dimensions);
  tiller.position.y += 0.45;
  tiller.scale.set(1.5, 1, 1.5);
  const skipper = createHuman().group;
  skipper.position.set(0.55 * 1.5, 0.9 * 1.4, -3.48 * 1.5);
  for (const side of [-1, 1]) {
    skipper.getObjectByName(`arm-${side}`)!.rotation.set(-0.4, 0, side * 0.08);
    skipper.getObjectByName(`forearm-${side}`)!.rotation.x = -0.65;
  }
  group.add(skipper);
  group.userData.driver = skipper;
  group.userData.eye = new T.Vector3(0.55 * 1.5, 0.9 * 1.4 + 1.69, -3.38 * 1.5);
  group.userData.viewPitch = -0.06;
  group.userData.lamp = new T.Vector3(0, 0.78 * 1.4, 4.2 * 1.5);
  const cabinLightMaterial = new T.MeshStandardMaterial({ color: '#fff0c4' });
  add(new T.BoxGeometry(0.16, 0.05, 0.12), cabinLightMaterial, 0, 1.65, -2.28);
  const lighting = createFishingLights(side, cabinLightMaterial, canalLightLayout);
  group.add(lighting.group);
  group.userData.marineLighting = lighting;
  batch(body);
  return {
    group,
    lighting,
    animate(turn: number) {
      tiller.rotation.y = T.MathUtils.clamp(-turn * 5, -0.55, 0.55);
    },
  };
}
