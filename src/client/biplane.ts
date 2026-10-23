import { drawFlightPanel } from './biplane-panel';
import type { FlightState } from '../shared/flight';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { createHuman } from './human';
import type { Player } from '../shared/types';

/** Original country mail plane: +Z forward, metres, fabric detail baked into shared atlases. */
const atlases = new Map<string, T.CanvasTexture>();
function atlas(kind: 'wing' | 'tail' | 'body' | 'instruments' | 'wood' | 'engine') {
  const cached = atlases.get(kind);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = kind === 'instruments' ? '#26302c' : '#eee8ce';
  x.fillRect(0, 0, 1024, 512);
  if (kind === 'wood') {
    x.fillStyle = '#c28b50';
    x.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 120; i++) {
      x.strokeStyle = i % 3 ? '#77482255' : '#e2b87666';
      x.lineWidth = (i % 4) + 1;
      x.beginPath();
      x.moveTo(i * 9, 0);
      x.bezierCurveTo(i * 9 + 15, 180, i * 9 - 20, 300, i * 9, 512);
      x.stroke();
    }
    x.fillStyle = '#e7d8b6';
    x.fillRect(0, 0, 1024, 35);
  } else if (kind === 'engine') {
    x.fillStyle = '#172325';
    x.fillRect(0, 0, 1024, 512);
    for (let y = 12; y < 512; y += 12) {
      x.fillStyle = '#6e7978';
      x.fillRect(0, y, 1024, 3);
      x.fillStyle = '#080f10';
      x.fillRect(0, y + 4, 1024, 5);
    }
  } else if (kind !== 'instruments') {
    // Woven linen, rib tapes and seams remain pixels, not hundreds of little strips.
    for (let y = 0; y < 512; y += 4) {
      x.fillStyle = y % 8 ? '#625c4210' : '#ffffff25';
      x.fillRect(0, y, 1024, 1);
    }
    for (let u = 0; u < 1024; u += kind === 'body' ? 128 : 42) {
      x.fillStyle = '#8d81652a';
      x.fillRect(u, 0, 3, 512);
      x.fillStyle = '#ffffff55';
      x.fillRect(u + 3, 0, 3, 512);
    }
    x.strokeStyle = '#72694c';
    x.lineWidth = 2;
    if (kind === 'wing' || kind === 'tail') {
      x.fillStyle = '#293f47';
      x.fillRect(0, 410, 1024, 36);
      x.fillStyle = '#b78542';
      x.fillRect(0, 447, 1024, 9);
      x.setLineDash([4, 6]);
      x.strokeRect(12, 16, 1000, 480);
      x.beginPath();
      x.moveTo(12, 390);
      x.lineTo(1012, 390);
      x.stroke();
      x.setLineDash([]);
      // Matching civilian registration on the two wings; no military markings.
      x.font = 'bold 64px monospace';
      x.textAlign = 'center';
      x.fillStyle = '#293f47';
      if (kind === 'wing') {
        x.fillText('AC', 220, 220);
        x.fillText('02', 804, 220);
      }
    } else {
      for (const v of [8, 248]) {
        x.fillStyle = '#293f47';
        x.fillRect(0, v, 1024, 32);
        x.fillStyle = '#b78542';
        x.fillRect(0, v + 33, 1024, 6);
      }
      for (let u = 760; u < 1010; u += 20)
        for (const v of [56, 190, 316, 450]) {
          x.fillStyle = '#766f5f';
          x.beginPath();
          x.arc(u, v, 2, 0, Math.PI * 2);
          x.fill();
        }
    }
  } else {
    drawFlightPanel(x);
  }
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.userData.shared = true;
  atlases.set(kind, texture);
  return texture;
}

function hull() {
  // Open the upper shell at the pilot's station instead of placing a seat on a solid body.
  const sections = [
    [-3.25, 1.46, 0.045, 0.07],
    [-2.7, 1.46, 0.2, 0.2],
    [-1.4, 1.52, 0.38, 0.32],
    [-0.85, 1.57, 0.49, 0.4],
    [0.25, 1.6, 0.54, 0.43],
    [0.8, 1.62, 0.58, 0.46],
    [1.9, 1.62, 0.52, 0.46],
    [2.45, 1.62, 0.42, 0.42],
  ];
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  sections.forEach(([z, y, rx, ry], i) => {
    for (let j = 0; j <= 12; j++) {
      const a = (j / 12) * Math.PI * 2;
      positions.push(Math.cos(a) * rx, y + Math.sin(a) * ry, z);
      uv.push((z + 3.25) / 5.7, j / 12);
      if (i && j < 12 && !(i === 4 && j >= 1 && j < 5)) {
        const a = (i - 1) * 13 + j,
          b = i * 13 + j;
        indices.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function wing(span: number, chord: number, notch = false) {
  const a = span / 2,
    b = chord / 2;
  const shape = new T.Shape()
    .moveTo(-a + 0.35, -b)
    .lineTo(a - 0.35, -b)
    .quadraticCurveTo(a, -b, a, -b + 0.3)
    .lineTo(a, b - 0.3)
    .quadraticCurveTo(a, b, a - 0.35, b)
    .lineTo(-a + 0.35, b)
    .quadraticCurveTo(-a, b, -a, b - 0.3)
    .lineTo(-a, -b + 0.3)
    .quadraticCurveTo(-a, -b, -a + 0.35, -b);
  // Upper trailing-edge cutout affords an upward view from the open cockpit.
  if (notch) {
    shape.curves = [];
    shape
      .moveTo(-a + 0.35, -b)
      .lineTo(-0.65, -b)
      .lineTo(-0.48, -b + 0.34)
      .lineTo(0.48, -b + 0.34)
      .lineTo(0.65, -b)
      .lineTo(a - 0.35, -b)
      .quadraticCurveTo(a, -b, a, -b + 0.3)
      .lineTo(a, b - 0.3)
      .quadraticCurveTo(a, b, a - 0.35, b)
      .lineTo(-a + 0.35, b)
      .quadraticCurveTo(-a, b, -a, b - 0.3)
      .lineTo(-a, -b + 0.3)
      .quadraticCurveTo(-a, -b, -a + 0.35, -b);
  }
  const g = new T.ExtrudeGeometry(shape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSize: 0.045,
    bevelThickness: 0.025,
    bevelSegments: 1,
    curveSegments: 3,
    steps: 1,
  });
  g.translate(0, 0, -0.04);
  g.rotateX(Math.PI / 2);
  const p = g.attributes.position,
    u = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    // Opposite faces need opposite U directions to keep registration lettering readable.
    const face = g.attributes.normal.getY(i) > 0 ? -1 : 1;
    u.setXY(i, (face * p.getX(i)) / span + 0.5, p.getZ(i) / chord + 0.5);
  }
  return g;
}
export interface BiplaneFigure {
  group: T.Group;
  animate(dt: number, running: boolean, heightAboveGround?: number, flight?: FlightState): void;
}
export function createBiplane(color = '#e5c979'): BiplaneFigure {
  const group = new T.Group();
  group.name = 'Parish air mail biplane';
  const linen = new T.MeshStandardMaterial({ color, map: atlas('wing'), roughness: 0.86 });
  const shell = new T.MeshStandardMaterial({
    color,
    map: atlas('body'),
    roughness: 0.72,
    side: T.DoubleSide,
  });
  const navy = new T.MeshStandardMaterial({ color: '#293f47', roughness: 0.48, metalness: 0.22 });
  const steel = new T.MeshStandardMaterial({ color: '#7b8585', roughness: 0.45, metalness: 0.65 });
  const rubber = new T.MeshStandardMaterial({ color: '#242825', roughness: 0.94 });
  const leather = new T.MeshStandardMaterial({ color: '#795039', roughness: 0.9 });
  const wood = new T.MeshStandardMaterial({ map: atlas('wood'), roughness: 0.65 });
  function add(geo: T.BufferGeometry, mat: T.Material, x = 0, y = 0, z = 0, parent = group) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (w: number, h: number, d: number, mat: T.Material, x: number, y: number, z: number) =>
    add(new T.BoxGeometry(w, h, d), mat, x, y, z);
  function rod(a: number[], b: number[], radius: number, mat: T.Material) {
    const start = new T.Vector3(...a),
      end = new T.Vector3(...b),
      delta = end.clone().sub(start);
    const m = add(new T.CylinderGeometry(radius, radius, delta.length(), 6), mat);
    m.position.copy(start).add(end).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
    return m;
  }
  add(hull(), shell);
  add(wing(9, 1.65, true), linen, 0, 2.95, 0.62);
  add(wing(8.4, 1.6), linen, 0, 1.35, 0.28);
  add(
    wing(3, 1.12),
    new T.MeshStandardMaterial({ color, map: atlas('tail'), roughness: 0.86 }),
    0,
    1.53,
    -2.6,
  );
  // Rounded upright fin with a painted rudder seam; the same atlas provides fabric detail.
  const fin = new T.Shape()
    .moveTo(-3.18, 1.5)
    .lineTo(-3.18, 2.38)
    .quadraticCurveTo(-3.15, 2.9, -2.8, 2.83)
    .quadraticCurveTo(-2.35, 2.73, -1.95, 1.5)
    .closePath();
  const finGeo = new T.ExtrudeGeometry(fin, { depth: 0.07, bevelEnabled: false, curveSegments: 5 });
  finGeo.translate(0, 0, -0.035);
  finGeo.rotateY(-Math.PI / 2);
  add(finGeo, navy);
  // Two N-shaped interplane struts, cabane struts, and understated tension wires.
  for (const side of [-1, 1]) {
    for (const z of [-0.26, 0.95])
      rod([side * 2.95, 1.42, z], [side * 3.05, 2.9, z + 0.35], 0.035, navy);
    rod([side * 2.95, 1.42, -0.26], [side * 3.05, 2.9, 1.3], 0.032, navy);
    for (const z of [0.15, 1.1])
      rod([side * 0.44, 1.85, z], [side * 0.85, 2.9, z + 0.12], 0.027, steel);
    rod([side * 0.7, 1.43, -0.2], [side * 3.05, 2.9, 1.3], 0.009, steel);
    rod([side * 0.8, 2.9, 0.3], [side * 2.95, 1.42, 0.95], 0.009, steel);
    rod([side * 0.38, 1.3, 0.95], [side * 1, 0.43, 1.05], 0.055, navy);
    rod([side * 0.4, 1.32, -0.05], [side * 1, 0.43, 1.05], 0.04, steel);
    const wheel = add(new T.CylinderGeometry(0.42, 0.42, 0.19, 20), rubber, side * 1, 0.42, 1.05);
    wheel.rotation.z = Math.PI / 2;
    const hub = add(new T.CylinderGeometry(0.18, 0.18, 0.21, 16), steel, side * 1, 0.42, 1.05);
    hub.rotation.z = Math.PI / 2;
  }
  rod([-1, 0.42, 1.05], [1, 0.42, 1.05], 0.055, steel);
  rod([0, 1.35, -2.9], [0, 1.07, -3], 0.045, navy);
  const tailWheel = add(new T.CylinderGeometry(0.17, 0.17, 0.13, 12), rubber, 0, 1.07, -3);
  tailWheel.rotation.z = Math.PI / 2;
  // Nose cowling, dark radiator face and short exhaust. Cooling detail uses a texture face.
  const cowl = add(new T.CylinderGeometry(0.43, 0.51, 0.62, 16), navy, 0, 1.62, 2.25);
  cowl.rotation.x = Math.PI / 2;
  const face = add(
    new T.CircleGeometry(0.39, 20),
    new T.MeshStandardMaterial({ map: atlas('engine'), roughness: 0.65, metalness: 0.35 }),
    0,
    1.62,
    2.565,
  );
  face.name = 'Engine face';
  rod([0.4, 1.4, 2.05], [0.52, 1.21, 1.55], 0.045, steel);
  // Low tub, saddle seat and padded coaming surround a real opening in the fuselage.
  box(0.65, 0.12, 0.92, rubber, 0, 1.53, -0.3);
  box(0.49, 0.1, 0.48, leather, 0, 1.65, -0.45);
  box(0.5, 0.35, 0.08, leather, 0, 1.85, -0.71);
  const rimGeometry = new T.TorusGeometry(0.43, 0.036, 5, 28);
  // Dip the forward lip below the dashboard so padding cannot cover the gauges.
  const rimPositions = rimGeometry.attributes.position;
  for (let i = 0; i < rimPositions.count; i++) {
    const forward = T.MathUtils.clamp(rimPositions.getY(i) / 0.43, 0, 1);
    rimPositions.setZ(i, rimPositions.getZ(i) + 0.24 * forward);
  }
  rimGeometry.computeVertexNormals();
  const rim = add(rimGeometry, leather, 0, 1.95, -0.3);
  rim.rotation.x = Math.PI / 2;
  rim.scale.y = 1.26;
  const pilot = createHuman('seated').group;
  pilot.scale.setScalar(0.82);
  pilot.position.set(0, 1.71, -0.43);
  group.add(pilot);
  group.userData.driver = pilot;
  group.userData.eye = new T.Vector3(0, 2.27, -0.68);
  group.userData.viewPitch = -0.08;
  const dash = new T.MeshStandardMaterial({
    map: atlas('instruments'),
    emissiveMap: atlas('instruments'),
    emissive: '#ffffff',
    emissiveIntensity: 0.35,
    roughness: 0.7,
  });
  const panelShape = new T.Shape()
    .moveTo(-0.365, -0.18)
    .lineTo(0.365, -0.18)
    .lineTo(0.365, 0.11)
    .quadraticCurveTo(0.365, 0.18, 0.295, 0.18)
    .lineTo(-0.295, 0.18)
    .quadraticCurveTo(-0.365, 0.18, -0.365, 0.11)
    .closePath();
  const panelGeo = new T.ShapeGeometry(panelShape, 4),
    panelUV = panelGeo.attributes.uv;
  for (let i = 0; i < panelUV.count; i++)
    panelUV.setXY(i, panelUV.getX(i) / 0.73 + 0.5, panelUV.getY(i) / 0.36 + 0.5);
  const panel = add(panelGeo, dash, 0, 1.94, 0.23);
  panel.rotation.y = Math.PI;
  // Keep the locally animated instrument texture outside the static batches.
  const panelHolder = new T.Group();
  group.remove(panel);
  panelHolder.add(panel);
  group.add(panelHolder);
  // A U-shaped aircraft yoke and a left-hand quadrant replace the old straight stick.
  rod([0, 1.61, -0.12], [0, 1.82, -0.02], 0.028, navy);
  const yoke = new T.Group();
  yoke.name = 'Biplane yoke';
  yoke.position.set(0, 1.83, -0.06);
  group.add(yoke);
  for (const side of [-1, 1]) {
    add(new T.BoxGeometry(0.18, 0.035, 0.045), navy, side * 0.085, 0, 0, yoke);
    add(new T.BoxGeometry(0.04, 0.14, 0.05), leather, side * 0.17, 0.05, 0, yoke);
  }
  const throttle = new T.Group();
  throttle.name = 'Biplane throttle';
  throttle.position.set(0.32, 1.83, -0.25);
  group.add(throttle);
  add(new T.BoxGeometry(0.09, 0.06, 0.28), navy, 0.32, 1.8, -0.25);
  add(new T.CylinderGeometry(0.016, 0.016, 0.19, 6), steel, 0, 0.095, 0, throttle);
  add(new T.SphereGeometry(0.045, 8, 5), leather, 0, 0.2, 0, throttle);
  batch(yoke);
  batch(throttle);
  const glass = new T.MeshStandardMaterial({
    color: '#b5d7da',
    transparent: true,
    opacity: 0.24,
    roughness: 0.12,
    side: T.DoubleSide,
    depthWrite: false,
  });
  const windscreen = add(new T.PlaneGeometry(0.73, 0.34), glass, 0, 2.25, 0.32);
  windscreen.rotation.x = 0.25;
  for (const side of [-1, 1])
    rod([side * 0.37, 2.08, 0.28], [side * 0.37, 2.42, 0.36], 0.016, steel);
  rod([-0.37, 2.42, 0.36], [0.37, 2.42, 0.36], 0.016, steel);
  // A separate two-blade propeller is the only continuously moving assembly.
  const prop = new T.Group();
  prop.name = 'Biplane propeller';
  prop.position.set(0, 1.62, 2.79);
  group.add(prop);
  const bladeShape = new T.Shape()
    .moveTo(-0.07, 0.06)
    .lineTo(-0.13, 0.9)
    .quadraticCurveTo(-0.12, 1.15, 0, 1.17)
    .quadraticCurveTo(0.13, 1.12, 0.12, 0.9)
    .lineTo(0.06, 0.06)
    .closePath();
  const bladeGeo = new T.ExtrudeGeometry(bladeShape, {
    depth: 0.045,
    bevelEnabled: false,
    curveSegments: 4,
  });
  const bladeUV = bladeGeo.attributes.uv,
    bladePosition = bladeGeo.attributes.position;
  for (let i = 0; i < bladeUV.count; i++)
    bladeUV.setXY(i, bladePosition.getX(i) / 0.3 + 0.5, bladePosition.getY(i) / 1.17);
  for (const angle of [0, Math.PI]) {
    const blade = add(bladeGeo.clone(), wood, 0, 0, 0, prop);
    blade.rotation.z = angle;
  }
  bladeGeo.dispose();
  const boss = add(new T.CylinderGeometry(0.09, 0.14, 0.22, 16), steel, 0, 0, 0.04, prop);
  boss.rotation.x = Math.PI / 2;
  batch(group);
  batch(prop);
  // Taildragger stance: short tail-wheel leg, nose up on the ground, level in flight.
  // Keep the axle at its tyre radius above the origin and transform the pilot's eye with it.
  const root = new T.Group();
  root.name = group.name;
  group.name = 'Biplane airframe';
  root.add(group);
  root.userData.driver = pilot;
  root.userData.eye = new T.Vector3();
  root.userData.flightPanel = { panel, last: -Infinity };
  root.userData.cameraAttitude = new T.Quaternion();
  function attitude(height: number, flight?: FlightState) {
    const pitch = flight ? -flight.pitch : -0.22 * (1 - T.MathUtils.clamp(height / 2, 0, 1));
    group.rotation.set(pitch, 0, flight ? -flight.bank : 0, 'YXZ');
    group.position.y =
      !flight || flight.grounded ? Math.sin(pitch) * 1.05 + 0.42 * (1 - Math.cos(pitch)) : 0;
    root.userData.cameraAttitude.copy(group.quaternion);
    yoke.rotation.z = -(flight?.rollRate ?? 0) * 0.5;
    yoke.position.z = -0.06 - (flight?.pitchRate ?? 0) * 0.2;
    throttle.rotation.x = -0.4 + (flight?.throttle ?? 0) * 0.8;
    root.userData.eye.copy(group.userData.eye).applyEuler(group.rotation).add(group.position);
    root.userData.viewPitch = -0.24 - pitch;
  }
  attitude(0);
  return {
    group: root,
    animate(dt, running, heightAboveGround = 0, flight) {
      attitude(heightAboveGround, flight);
      if (running)
        prop.rotation.z =
          (prop.rotation.z +
            Math.min(0.1, Math.max(0, dt)) * (flight ? 12 + flight.throttle * 45 : 39)) %
          (Math.PI * 2);
    },
  };
}

/** Only the visible local cockpit needs a private, throttled instrument texture. */
export function updateBiplaneInstruments(
  group: T.Group,
  p: Player,
  altitude: number,
  time: number,
  seaLevel = 0,
) {
  const state = group.userData.flightPanel;
  if (!state || time - state.last < 0.1) return;
  state.last = time;
  const f = p.flight;
  const key = [
    p.speed,
    p.fuel,
    p.y ?? 0,
    p.heading ?? 0,
    altitude,
    f?.pitch ?? 0,
    f?.bank ?? 0,
    f?.vy ?? 0,
    f?.throttle ?? 0,
    +(f?.stalled ?? false),
    +!!p.engine,
  ]
    .map((v) => v.toFixed(2))
    .join('/');
  if (key === state.key) return;
  state.key = key;
  if (!state.canvas) {
    state.canvas = document.createElement('canvas');
    state.canvas.width = 1024;
    state.canvas.height = 512;
    const map = new T.CanvasTexture(state.canvas);
    map.colorSpace = T.SRGBColorSpace;
    state.panel.material.map = map;
    state.panel.material.emissiveMap = map;
  }
  drawFlightPanel(state.canvas.getContext('2d'), p, altitude, seaLevel);
  state.panel.material.map.needsUpdate = true;
}
