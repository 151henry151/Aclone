// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { createHuman } from './human';
import { fuelCapacity } from '../shared/tractors';
import type { Player } from '../shared/types';

// Small civilian marsh courier. +Z forward. Physics carries its origin 0.5 m above the surface.
const textures = new Map<string, T.CanvasTexture>();
function texture(kind: 'skirt' | 'deck' | 'panels' | 'grille' | 'instruments') {
  const cached = textures.get(kind);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext('2d')!;
  c.fillStyle = kind === 'skirt' ? '#343d40' : kind === 'deck' ? '#586467' : '#ebeee4';
  c.fillRect(0, 0, 1024, 512);
  if (kind === 'skirt') {
    for (let i = 0; i < 32; i++) {
      const x = i * 32;
      const g = c.createLinearGradient(x, 0, x + 32, 0);
      g.addColorStop(0, '#141c20');
      g.addColorStop(0.3, '#4d5759');
      g.addColorStop(1, '#293237');
      c.fillStyle = g;
      c.fillRect(x, 0, 32, 512);
      c.strokeStyle = '#88909065';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(x + 6, 0);
      c.lineTo(x + 6, 390);
      c.lineTo(x + 16, 490);
      c.stroke();
    }
    c.strokeStyle = '#111a20';
    c.lineWidth = 9;
    for (const y of [36, 72]) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(1024, y);
      c.stroke();
    }
  } else if (kind === 'deck') {
    for (let y = 0; y < 512; y += 20)
      for (let x = 0; x < 1024; x += 20) {
        c.strokeStyle = '#8f9996';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x + (y % 40 ? 10 : 0), y + 3);
        c.lineTo(x + (y % 40 ? 10 : 0) + 6, y + 9);
        c.stroke();
      }
    c.strokeStyle = '#303c40';
    c.lineWidth = 5;
    c.strokeRect(8, 8, 1008, 496);
  } else if (kind === 'panels') {
    c.strokeStyle = '#5f6f6d';
    c.lineWidth = 2;
    c.strokeRect(8, 8, 1008, 496);
    c.fillStyle = '#263e44';
    c.fillRect(0, 350, 1024, 62);
    c.fillStyle = '#d4aa52';
    c.fillRect(0, 417, 1024, 12);
    for (let x = 22; x < 1024; x += 54)
      for (const y of [24, 488]) {
        c.fillStyle = '#71817e';
        c.beginPath();
        c.arc(x, y, 3, 0, Math.PI * 2);
        c.fill();
      }
    c.fillStyle = '#253d43';
    c.font = 'bold 62px sans-serif';
    c.fillText('MARSH COURIER', 65, 225);
    c.font = '26px monospace';
    c.fillText('AC-04   /   AIR CUSHION UTILITY', 68, 282);
  } else if (kind === 'grille') {
    c.clearRect(0, 0, 1024, 512);
    c.strokeStyle = '#526569';
    c.lineWidth = 3;
    for (let x = 0; x < 1024; x += 64) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x, 512);
      c.stroke();
    }
    for (let y = 0; y < 512; y += 32) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(1024, y);
      c.stroke();
    }
  } else {
    c.fillStyle = '#182d34';
    c.fillRect(0, 0, 1024, 512);
    c.strokeStyle = '#a6b5ac';
    c.lineWidth = 5;
    c.beginPath();
    c.roundRect(12, 12, 1000, 488, 40);
    c.stroke();
    for (const [x, label] of [
      [280, 'SPEED · MPH'],
      [725, 'FUEL · %'],
    ] as const) {
      c.fillStyle = '#aab6b0';
      c.beginPath();
      c.arc(x, 240, 152, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#10242c';
      c.beginPath();
      c.arc(x, 240, 143, 0, Math.PI * 2);
      c.fill();
      for (let i = 0; i <= 20; i++) {
        const a = Math.PI * (0.75 + (i / 20) * 1.5);
        c.strokeStyle = '#e8e8ce';
        c.lineWidth = i % 5 ? 3 : 5;
        c.beginPath();
        c.moveTo(x + Math.cos(a) * 132, 240 + Math.sin(a) * 132);
        c.lineTo(x + Math.cos(a) * (i % 5 ? 123 : 113), 240 + Math.sin(a) * (i % 5 ? 123 : 113));
        c.stroke();
        if (i % 5 === 0) {
          c.fillStyle = '#e8e8ce';
          c.font = '22px monospace';
          c.textAlign = 'center';
          c.fillText(
            String((i / 20) * (x === 280 ? 50 : 100)),
            x + Math.cos(a) * 91,
            248 + Math.sin(a) * 91,
          );
        }
      }
      c.font = 'bold 22px sans-serif';
      c.textAlign = 'center';
      c.fillText(label, x, 300);
    }
    c.fillStyle = '#e2c373';
    c.font = '22px monospace';
    c.textAlign = 'center';
    c.fillText('MARSH COURIER  /  AIR CUSHION DRIVE', 512, 465);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  map.userData.shared = true;
  textures.set(kind, map);
  return map;
}

/** Rounded rectangle sampled around a continuous perimeter, with a narrower bow. */
function outline(angle: number, width: number, length: number) {
  const x = Math.sin(angle),
    z = Math.cos(angle);
  return new T.Vector2(
    Math.sign(x) * Math.pow(Math.abs(x), 0.45) * width * (z > 0 ? 1 - 0.12 * z : 1),
    Math.sign(z) * Math.pow(Math.abs(z), 0.45) * length,
  );
}
function cushion() {
  const p: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const rings = [
    [-0.43, 1.48, 2.68],
    [-0.34, 1.64, 2.88],
    [-0.12, 1.8, 3.01],
    [0.12, 1.84, 3.05],
    [0.34, 1.74, 2.96],
    [0.48, 1.58, 2.8],
  ];
  const segments = 48;
  for (let j = 0; j < rings.length; j++)
    for (let i = 0; i <= segments; i++) {
      const [y, w, l] = rings[j],
        v = outline((i / segments) * Math.PI * 2, w, l);
      p.push(v.x, y, v.y);
      uv.push(i / segments, j / (rings.length - 1));
      if (j < rings.length - 1 && i < segments) {
        const a = j * (segments + 1) + i,
          b = a + segments + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function deck(width: number, length: number, depth: number) {
  const s = new T.Shape();
  for (let i = 0; i < 48; i++) {
    const v = outline((i / 48) * Math.PI * 2, width, length);
    if (i === 0) s.moveTo(v.x, v.y);
    else s.lineTo(v.x, v.y);
  }
  s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: false, steps: 1 });
  g.rotateX(Math.PI / 2);
  return g;
}
function roof(width: number, length: number, depth: number) {
  const x = width / 2,
    z = length / 2,
    r = 0.12;
  const shape = new T.Shape()
    .moveTo(-x + r, -z)
    .lineTo(x - r, -z)
    .quadraticCurveTo(x, -z, x, -z + r)
    .lineTo(x, z - r)
    .quadraticCurveTo(x, z, x - r, z)
    .lineTo(-x + r, z)
    .quadraticCurveTo(-x, z, -x, z - r)
    .lineTo(-x, -z + r)
    .quadraticCurveTo(-x, -z, -x + r, -z)
    .closePath();
  const g = new T.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 3,
    steps: 1,
  });
  g.rotateX(Math.PI / 2);
  return g;
}
export interface HovercraftFigure {
  group: T.Group;
  animate(dt: number, running: boolean): void;
}
export function createHovercraft(color = '#759782'): HovercraftFigure {
  const root = new T.Group();
  root.name = 'Marsh Courier hovercraft';
  const body = new T.Group();
  body.name = 'Hovercraft body';
  root.add(body);
  const paint = new T.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.18 });
  const cream = new T.MeshStandardMaterial({ color: '#e9e4cd', roughness: 0.5 });
  const dark = new T.MeshStandardMaterial({ color: '#24383e', roughness: 0.65, metalness: 0.2 });
  const steel = new T.MeshStandardMaterial({ color: '#738787', roughness: 0.45, metalness: 0.6 });
  const rubber = new T.MeshStandardMaterial({ map: texture('skirt'), roughness: 0.92 });
  const tread = new T.MeshStandardMaterial({ map: texture('deck'), roughness: 0.85 });
  const panelFinish = new T.MeshStandardMaterial({
    color,
    map: texture('panels'),
    roughness: 0.58,
  });
  const glass = new T.MeshStandardMaterial({
    color: '#b6d8dc',
    transparent: true,
    opacity: 0.18,
    roughness: 0.18,
    side: T.DoubleSide,
    depthWrite: false,
  });
  function add(g: T.BufferGeometry, m: T.Material, x = 0, y = 0, z = 0, parent = body) {
    const mesh = new T.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = !m.transparent;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const box = (
    w: number,
    h: number,
    d: number,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    parent = body,
  ) => add(new T.BoxGeometry(w, h, d), m, x, y, z, parent);
  function rod(a: number[], b: number[], radius = 0.035, m: T.Material = steel) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b),
      delta = to.clone().sub(from);
    const mesh = add(new T.CylinderGeometry(radius, radius, delta.length(), 6), m);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  }
  function quad(points: number[][], m: T.Material) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3));
    g.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return add(g, m);
  }
  const skirt = add(cushion(), rubber, 0, 0, 0, root);
  skirt.name = 'Inflatable skirt';
  add(deck(1.48, 2.68, 0.02), dark, 0, -0.43, 0);
  add(deck(1.58, 2.8, 0.22), paint, 0, 0.66, 0);
  const top = add(deck(1.52, 2.72, 0.035), tread, 0, 0.7, 0);
  const tp = top.geometry.attributes.position,
    tu = top.geometry.attributes.uv;
  for (let i = 0; i < tp.count; i++) tu.setXY(i, tp.getX(i) / 3.04 + 0.5, tp.getZ(i) / 5.44 + 0.5);
  // Rounded bow bumper and a low hull make the skirt the dominant silhouette.
  for (const side of [-1, 1]) {
    rod([side * 1.46, 0.72, 1.8], [side * 1.53, 0.72, -1.8], 0.07, dark);
    // Walkways and boarding handles, not tractor wheels or axles.
    rod([side * 1.33, 0.78, 0.15], [side * 1.33, 1.05, 0.15], 0.03);
    rod([side * 1.33, 1.05, 0.15], [side * 1.33, 1.05, -0.48], 0.03);
    rod([side * 1.33, 1.05, -0.48], [side * 1.33, 0.78, -0.48], 0.03);
  }
  box(1.94, 0.64, 2.36, paint, 0, 1.02, 0.55);
  // Side panels carry maker lettering, seams and fasteners in one texture each.
  for (const side of [-1, 1]) {
    const panel = add(new T.PlaneGeometry(2.2, 0.59), panelFinish, side * 0.976, 1.03, 0.55);
    panel.rotation.y = (side * Math.PI) / 2;
  }
  // Canopy: sloped front glass, wide side windows and a chamfered roof.
  const front = [
    [-0.91, 1.36, 1.74],
    [0.91, 1.36, 1.74],
    [0.86, 2.29, 1.25],
    [-0.86, 2.29, 1.25],
  ];
  quad(front, glass);
  for (let i = 0; i < 4; i++) rod(front[i], front[(i + 1) % 4], 0.042, dark);
  rod([0, 1.36, 1.74], [0, 2.29, 1.25], 0.024, dark);
  for (const side of [-1, 1]) {
    const a = [side * 0.91, 1.36, -0.57],
      b = [side * 0.91, 1.36, 1.74],
      c = [side * 0.86, 2.29, 1.25],
      d = [side * 0.86, 2.29, -0.57];
    quad([a, b, c, d], glass);
    rod(a, d, 0.045, dark);
    rod(d, c, 0.04, dark);
    rod(a, b, 0.04, dark);
    rod([side * 0.9, 1.36, -0.22], [side * 0.86, 2.29, -0.22], 0.026, dark);
    box(0.06, 0.045, 0.24, dark, side * 0.995, 1.17, -0.17);
  }
  quad(
    [
      [0.91, 1.36, -0.57],
      [-0.91, 1.36, -0.57],
      [-0.86, 2.29, -0.57],
      [0.86, 2.29, -0.57],
    ],
    glass,
  );
  add(roof(2.04, 2.1, 0.1), cream, 0, 2.4, 0.36);
  add(roof(1.94, 2.0, 0.015), paint, 0, 2.415, 0.36);
  // Bow lamps, towing eye and recognisable port/starboard navigation lamps.
  for (const side of [-1, 1]) {
    box(0.38, 0.2, 0.15, dark, side * 0.65, 1.0, 1.81);
    box(
      0.28,
      0.12,
      0.025,
      new T.MeshStandardMaterial({
        color: '#eee8bd',
        emissive: '#74684c',
        emissiveIntensity: 0.18,
      }),
      side * 0.65,
      1.0,
      1.9,
    );
    box(
      0.13,
      0.09,
      0.18,
      new T.MeshStandardMaterial({ color: side < 0 ? '#b94b3b' : '#58a887' }),
      side * 0.98,
      2.34,
      0.8,
    );
  }
  const tow = add(new T.TorusGeometry(0.09, 0.026, 5, 12), steel, 0, 0.76, 2.64);
  tow.rotation.y = Math.PI / 2;
  // A rear engine bay and cargo lockers sit under the fan supports.
  box(1.15, 0.47, 1.05, dark, 0, 0.95, -1.4);
  for (const side of [-1, 1]) {
    box(0.53, 0.34, 0.96, paint, side * 1.05, 0.88, -1.56);
    box(0.57, 0.06, 1.0, cream, side * 1.05, 1.08, -1.56);
    box(0.2, 0.04, 0.04, dark, side * 1.05, 1.06, -1.03);
  }
  const fan = new T.Group();
  fan.name = 'Hovercraft fan';
  fan.position.set(0, 1.91, -1.9);
  body.add(fan);
  const duct = new T.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.2,
    side: T.DoubleSide,
  });
  const ductShell = add(new T.CylinderGeometry(1.08, 1.08, 0.56, 32, 1, true), duct, 0, 1.91, -1.9);
  ductShell.rotation.x = Math.PI / 2;
  for (const z of [-2.18, -1.62]) add(new T.TorusGeometry(1.08, 0.065, 6, 32), cream, 0, 1.91, z);
  for (const side of [-1, 1]) rod([side * 0.78, 0.75, -1.9], [side * 0.7, 1.15, -1.9], 0.075, dark);
  const bladeShape = new T.Shape()
    .moveTo(-0.06, 0.13)
    .lineTo(-0.17, 0.78)
    .quadraticCurveTo(-0.12, 0.98, 0.02, 0.98)
    .lineTo(0.12, 0.78)
    .lineTo(0.06, 0.13)
    .closePath();
  for (let i = 0; i < 6; i++) {
    const blade = add(
      new T.ExtrudeGeometry(bladeShape, { depth: 0.035, bevelEnabled: false, curveSegments: 3 }),
      dark,
      0,
      0,
      0,
      fan,
    );
    blade.rotation.z = (i * Math.PI) / 3;
  }
  const hub = add(new T.CylinderGeometry(0.15, 0.19, 0.3, 16), steel, 0, 0, 0, fan);
  hub.rotation.x = Math.PI / 2;
  // Safety mesh is one alpha-tested surface, not hundreds of crossing rods.
  const guard = new T.MeshStandardMaterial({
    map: texture('grille'),
    alphaTest: 0.45,
    side: T.DoubleSide,
    roughness: 0.6,
  });
  for (const z of [-2.22, -1.58]) add(new T.CircleGeometry(1.03, 32), guard, 0, 1.91, z);
  for (const side of [-1, 1]) {
    box(0.035, 1.66, 0.38, paint, side * 0.43, 1.91, -2.35);
    rod([side * 0.43, 1.09, -2.35], [side * 0.43, 2.73, -2.35], 0.025, steel);
  }
  // Interior: open sight lines, textured console and simple control yoke.
  box(1.72, 0.07, 1.95, tread, 0, 0.83, 0.46);
  box(0.55, 0.13, 0.5, dark, 0, 1.21, 0.12);
  box(0.57, 0.54, 0.1, dark, 0, 1.48, -0.15);
  const human = createHuman('seated').group;
  human.scale.setScalar(0.8);
  human.position.set(0, 1.26, 0.18);
  body.add(human);
  root.userData.driver = human;
  root.userData.eye = new T.Vector3(0, 1.98, 0.18);
  root.userData.viewPitch = -0.09;
  box(1.66, 0.16, 0.33, dark, 0, 1.17, 1.23);
  const dashboardMaterial = new T.MeshStandardMaterial({
    map: texture('instruments'),
    roughness: 0.7,
  });
  const panelShape = new T.Shape()
    .moveTo(-0.725, -0.275)
    .lineTo(0.725, -0.275)
    .lineTo(0.725, 0.195)
    .quadraticCurveTo(0.725, 0.275, 0.645, 0.275)
    .lineTo(-0.645, 0.275)
    .quadraticCurveTo(-0.725, 0.275, -0.725, 0.195)
    .closePath();
  const panelGeometry = new T.ShapeGeometry(panelShape, 4),
    panelUV = panelGeometry.attributes.uv;
  for (let i = 0; i < panelUV.count; i++)
    panelUV.setXY(i, panelUV.getX(i) / 1.45 + 0.5, panelUV.getY(i) / 0.55 + 0.5);
  const panel = add(panelGeometry, dashboardMaterial, 0, 1.54, 1.16);
  panel.rotation.set(-0.25, Math.PI, 0);
  const instrumentGroup = new T.Group();
  body.remove(panel);
  instrumentGroup.add(panel);
  body.add(instrumentGroup);
  rod([0, 1.12, 0.61], [0, 1.48, 0.87], 0.035, dark);
  rod([-0.21, 1.47, 0.81], [0.21, 1.47, 0.81], 0.035, dark);
  for (const side of [-1, 1]) rod([side * 0.21, 1.47, 0.81], [side * 0.21, 1.61, 0.8], 0.035, dark);
  batch(body);
  batch(fan);
  root.userData.hoverPanel = { panel, last: -Infinity };
  return {
    group: root,
    animate(dt, running) {
      if (running)
        fan.rotation.z = (fan.rotation.z + Math.min(0.1, Math.max(0, dt)) * 30) % (Math.PI * 2);
    },
  };
}
export function updateHovercraftInstruments(group: T.Group, p: Player, time: number) {
  const state = group.userData.hoverPanel;
  if (!state || time - state.last < 0.25) return;
  state.last = time;
  const values = [
    Math.min(1, (Math.abs(p.speed) * 2.237) / 50),
    T.MathUtils.clamp(p.fuel / fuelCapacity(p), 0, 1),
  ];
  const key = values.map((v) => v.toFixed(2)).join('/');
  if (state.key === key) return;
  state.key = key;
  if (!state.canvas) {
    state.canvas = document.createElement('canvas');
    state.canvas.width = 1024;
    state.canvas.height = 512;
    const map = new T.CanvasTexture(state.canvas);
    map.colorSpace = T.SRGBColorSpace;
    state.panel.material.map = map;
  }
  const c = state.canvas.getContext('2d')!;
  c.drawImage(texture('instruments').image, 0, 0);
  values.forEach((v, i) => {
    const a = Math.PI * (0.75 + v * 1.5),
      x = i ? 725 : 280;
    c.strokeStyle = '#e7b65d';
    c.lineWidth = 7;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x - Math.cos(a) * 20, 240 - Math.sin(a) * 20);
    c.lineTo(x + Math.cos(a) * 108, 240 + Math.sin(a) * 108);
    c.stroke();
    c.fillStyle = '#bac4b8';
    c.beginPath();
    c.arc(x, 240, 11, 0, Math.PI * 2);
    c.fill();
  });
  state.panel.material.map.needsUpdate = true;
}
