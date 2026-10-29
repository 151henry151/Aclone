// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { vehicles } from '../shared/catalog';
import { FISHING_BOAT } from '../shared/boats';
import type { Player } from '../shared/types';
import { nauticalHeading } from './nautical-heading';
export { nauticalHeading } from './nautical-heading';

type Reading = Pick<Player, 'heading' | 'speed' | 'fuel' | 'engine' | 'boatThrottle' | 'trawl'>;
const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
function canvas(width: number, height: number) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}
function map(c: HTMLCanvasElement, shared = true) {
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.shared = shared;
  return t;
}
const surfaces = new Map<string, T.CanvasTexture>();
/** Seams, switches, chart markings and fasteners are painted, not tiny meshes. */
export function marineSurface(kind: 'lining' | 'floor' | 'chart' | 'radio') {
  const old = surfaces.get(kind);
  if (old) return old;
  const c = canvas(512, 512),
    x = c.getContext('2d')!;
  x.fillStyle = { lining: '#c9c5ac', floor: '#323e3d', chart: '#d9d5b5', radio: '#233336' }[kind];
  x.fillRect(0, 0, 512, 512);
  if (kind === 'lining' || kind === 'floor') {
    for (let y = 0; y < 512; y += kind === 'floor' ? 12 : 128) {
      x.fillStyle = kind === 'floor' ? '#65706b' : '#9e9e88';
      x.fillRect(0, y, 512, 2);
      if (kind === 'lining')
        for (const px of [14, 498]) {
          x.fillStyle = '#626e66';
          x.fillRect(px, y + 12, 4, 4);
        }
    }
  } else if (kind === 'chart') {
    x.strokeStyle = '#829c97';
    x.lineWidth = 1;
    for (let i = 32; i < 512; i += 48) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i, 512);
      x.moveTo(0, i);
      x.lineTo(512, i);
      x.stroke();
    }
    x.fillStyle = '#a3b4a0';
    x.beginPath();
    x.moveTo(0, 20);
    x.lineTo(190, 20);
    x.bezierCurveTo(420, 100, 180, 170, 230, 245);
    x.bezierCurveTo(190, 300, 310, 390, 70, 512);
    x.lineTo(0, 512);
    x.fill();
    x.strokeStyle = '#716f59';
    x.lineWidth = 3;
    x.stroke();
    x.fillStyle = '#344d51';
    x.font = 'bold 18px serif';
    x.fillText('COASTAL PASSAGE NOTES', 30, 40);
    x.font = '14px serif';
    x.fillText('Reference chart • not a live map', 210, 480);
    x.translate(402, 122);
    x.strokeStyle = '#485f60';
    x.beginPath();
    x.arc(0, 0, 40, 0, Math.PI * 2);
    x.moveTo(0, -50);
    x.lineTo(0, 50);
    x.moveTo(-50, 0);
    x.lineTo(50, 0);
    x.stroke();
    x.fillText('N', -5, -56);
  } else {
    x.fillStyle = '#121e20';
    x.fillRect(24, 34, 464, 196);
    x.fillStyle = '#8eae8c';
    x.fillRect(42, 54, 310, 155);
    x.fillStyle = '#172c27';
    x.font = 'bold 66px monospace';
    x.fillText('VHF 16', 58, 151);
    x.font = '17px sans-serif';
    x.fillText('MARINE RADIO', 58, 186);
    for (let i = 0; i < 7; i++) {
      x.fillStyle = '#101b1b';
      x.fillRect(36, 280 + i * 20, 335, 7);
    }
    for (const y of [111, 350]) {
      x.fillStyle = '#82918b';
      x.beginPath();
      x.arc(426, y, 34, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#20302d';
      x.fillRect(422, y - 26, 8, 22);
    }
    x.fillStyle = '#b9c1ad';
    x.font = '18px sans-serif';
    x.fillText('WATCH CHANNEL', 38, 470);
  }
  const t = map(c);
  surfaces.set(kind, t);
  return t;
}
let base: HTMLCanvasElement | undefined;
function panelBase() {
  if (base) return base;
  base = canvas(1024, 512);
  const x = base.getContext('2d')!;
  x.fillStyle = '#233b3c';
  x.fillRect(0, 0, 1024, 512);
  for (let y = 0; y < 512; y += 4) {
    x.fillStyle = '#ffffff06';
    x.fillRect(0, y, 1024, 1);
  }
  x.strokeStyle = '#101e20';
  x.lineWidth = 16;
  x.beginPath();
  x.roundRect(9, 9, 1006, 494, 36);
  x.stroke();
  for (const px of [29, 995])
    for (const py of [29, 483]) {
      x.fillStyle = '#a4aa96';
      x.beginPath();
      x.arc(px, py, 6, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#334543';
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(px - 4, py);
      x.lineTo(px + 4, py);
      x.stroke();
    }
  for (let i = 0; i < 3; i++) {
    const cx = 190 + i * 320,
      cy = 192,
      r = 126;
    x.fillStyle = '#9ba295';
    x.beginPath();
    x.arc(cx, cy, r + 7, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#10292c';
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
    for (let n = 0; n <= 20; n++) {
      const a = Math.PI * (0.75 + (n / 20) * 1.5),
        len = n % 5 === 0 ? 17 : 8;
      x.strokeStyle = '#d7d7b9';
      x.lineWidth = n % 5 === 0 ? 3 : 1.5;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
      x.lineTo(cx + Math.cos(a) * (r - 12 - len), cy + Math.sin(a) * (r - 12 - len));
      x.stroke();
      if (n % 5 === 0) {
        x.fillStyle = '#d7d7b9';
        x.textAlign = 'center';
        x.font = '18px sans-serif';
        x.fillText(String(i === 0 ? n : n * 5), cx + Math.cos(a) * 82, cy + Math.sin(a) * 82 + 6);
      }
    }
    x.fillStyle = '#d7d7b9';
    x.font = 'bold 19px sans-serif';
    x.textAlign = 'center';
    x.fillText(['SPEED · KNOTS', 'THROTTLE', 'FUEL · %'][i], cx, 357);
    if (i === 1) {
      x.font = '14px sans-serif';
      x.fillText('DIESEL COMMAND · %', cx, 383);
    }
  }
  x.textAlign = 'left';
  x.font = '18px sans-serif';
  x.fillStyle = '#bdc5ae';
  x.fillText('NORTH STAR  /  WHEELHOUSE', 44, 470);
  return base;
}
function drawPanel(
  c: HTMLCanvasElement,
  p: Reading,
  tank = vehicles[FISHING_BOAT].tank!,
  label = 'NORTH STAR  /  WHEELHOUSE',
) {
  const x = c.getContext('2d')!;
  x.drawImage(panelBase(), 0, 0);
  x.fillStyle = '#233b3c';
  x.fillRect(35, 435, 510, 46);
  x.fillStyle = '#bdc5ae';
  x.font = '18px sans-serif';
  x.textAlign = 'left';
  x.fillText(label, 44, 470, 495);
  const fuel = clamp(p.fuel / tank),
    throttle = Math.abs(p.boatThrottle ?? 0);
  const values = [clamp((Math.abs(p.speed) * 1.94384) / 20), clamp(throttle), fuel];
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * (0.75 + values[i] * 1.5),
      cx = 190 + i * 320,
      cy = 192;
    x.strokeStyle = '#efaa66';
    x.lineWidth = 5;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(cx - Math.cos(a) * 17, cy - Math.sin(a) * 17);
    x.lineTo(cx + Math.cos(a) * 94, cy + Math.sin(a) * 94);
    x.stroke();
    x.fillStyle = '#a7b3a5';
    x.beginPath();
    x.arc(cx, cy, 9, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = '#0b2224';
  x.fillRect(550, 422, 430, 59);
  x.font = '22px monospace';
  x.textAlign = 'center';
  x.fillStyle = p.fuel <= 0 ? '#f8b07c' : '#ccdbb6';
  x.fillText(
    `${p.fuel <= 0 ? 'NO FUEL' : p.engine ? 'ENGINE ON' : 'ENGINE OFF'}  ·  ${(p.boatThrottle ?? 0) < 0 ? 'ASTERN' : 'AHEAD'}`,
    765,
    458,
  );
}
function drawCompass(c: HTMLCanvasElement, heading: number) {
  const x = c.getContext('2d')!;
  x.clearRect(0, 0, 512, 512);
  x.fillStyle = '#927b4e';
  x.beginPath();
  x.arc(256, 256, 252, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#102a2b';
  x.beginPath();
  x.arc(256, 256, 233, 0, Math.PI * 2);
  x.fill();
  for (let deg = 0; deg < 360; deg += 5) {
    const a = ((deg - heading - 90) * Math.PI) / 180;
    x.strokeStyle = '#d8d8b7';
    x.lineWidth = deg % 30 === 0 ? 4 : 2;
    x.beginPath();
    x.moveTo(256 + Math.cos(a) * 218, 256 + Math.sin(a) * 218);
    x.lineTo(
      256 + Math.cos(a) * (deg % 30 === 0 ? 194 : 206),
      256 + Math.sin(a) * (deg % 30 === 0 ? 194 : 206),
    );
    x.stroke();
    if (deg % 30 === 0) {
      x.textAlign = 'center';
      x.font = deg % 90 === 0 ? 'bold 38px serif' : '22px sans-serif';
      x.fillStyle = deg === 0 ? '#efb46e' : '#d8d8b7';
      x.fillText(
        deg % 90 === 0 ? ['N', 'E', 'S', 'W'][deg / 90] : String(deg),
        256 + Math.cos(a) * 164,
        268 + Math.sin(a) * 164,
      );
    }
  }
  x.fillStyle = '#e4ad68';
  x.beginPath();
  x.moveTo(246, 29);
  x.lineTo(266, 29);
  x.lineTo(256, 72);
  x.fill();
  x.fillStyle = '#dce1be';
  x.textAlign = 'center';
  x.font = 'bold 60px monospace';
  x.fillText(`${Math.round(heading) % 360}`.padStart(3, '0') + '°', 256, 270);
  x.font = '21px sans-serif';
  x.fillText('HEADING', 256, 305);
}

/** Per-boat instrument textures, redrawn only for changed readings at at most 10 Hz. */
export function createMarineInstruments(label: string, tank: number) {
  const panelCanvas = canvas(1024, 512),
    compassCanvas = canvas(512, 512);
  const panelMap = map(panelCanvas, false),
    compassMap = map(compassCanvas, false);
  const material = (texture: T.Texture) =>
    new T.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: '#ffffff',
      emissiveIntensity: 0.32,
      roughness: 0.8,
    });
  let last = -Infinity,
    key = '';
  const readings = { heading: 0, speedKnots: 0, fuel: 0, throttle: 0 };
  function update(p: Reading, time: number) {
    if (time - last < 0.1) return;
    last = time;
    const heading = nauticalHeading(p.heading);
    const next = [
      heading.toFixed(1),
      p.speed.toFixed(1),
      p.fuel.toFixed(1),
      p.engine,
      (p.boatThrottle ?? 0).toFixed(2),
    ].join('/');
    if (next === key) return;
    key = next;
    drawPanel(panelCanvas, p, tank, label);
    drawCompass(compassCanvas, heading);
    panelMap.needsUpdate = compassMap.needsUpdate = true;
    Object.assign(readings, {
      heading,
      speedKnots: Math.abs(p.speed) * 1.94384,
      fuel: p.fuel,
      throttle: p.boatThrottle ?? 0,
    });
  }
  update({ heading: 0, speed: 0, fuel: 0, engine: false }, 0);
  return { panel: material(panelMap), compass: material(compassMap), readings, update };
}

/** Human-scale fittings in the enlarged hull; static parts batch by material. */
export function createFishingWheelhouse() {
  const group = new T.Group(),
    fixed = new T.Group();
  group.name = 'North Star wheelhouse';
  group.add(fixed);
  const metal = new T.MeshStandardMaterial({ color: '#304a4b', roughness: 0.65, metalness: 0.25 });
  const wood = new T.MeshStandardMaterial({ color: '#766049', roughness: 0.8 });
  const brass = new T.MeshStandardMaterial({ color: '#a68b53', roughness: 0.4, metalness: 0.55 });
  const rubber = new T.MeshStandardMaterial({ color: '#202d2f', roughness: 0.95 });
  const lining = new T.MeshStandardMaterial({ map: marineSurface('lining'), roughness: 0.9 });
  function add(
    geo: T.BufferGeometry,
    mat: T.Material,
    x: number,
    y: number,
    z: number,
    parent = fixed,
  ) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const box = (w: number, h: number, d: number, mat: T.Material, x: number, y: number, z: number) =>
    add(new T.BoxGeometry(w, h, d), mat, x, y, z);
  const floor = new T.MeshStandardMaterial({ map: marineSurface('floor'), roughness: 1 });
  box(4.28, 0.045, 5.25, floor, 0, 1.15, 2.6);
  box(4.28, 0.06, 5.25, lining, 0, 3.82, 2.6);
  for (const side of [-1, 1]) {
    box(0.06, 1, 5.2, lining, side * 2.16, 1.65, 2.6);
    box(0.09, 0.07, 5.3, wood, side * 2.12, 2.18, 2.6);
    box(0.055, 1.65, 0.07, lining, side * 0.74, 3, 5.3);
    box(0.08, 0.07, 5.2, wood, side * 2.12, 3.71, 2.6);
    for (const z of [1.2, 3.5]) box(0.07, 1.55, 0.06, lining, side * 2.18, 2.96, z);
  }
  box(4.3, 0.07, 0.14, wood, 0, 2.18, 5.26);
  box(4.3, 0.11, 0.16, wood, 0, 3.72, 5.26);
  // Rear cabin door and stowage, visible when looking back from the helm.
  box(4.28, 2.6, 0.06, lining, 0, 2.46, -0.06);
  box(0.92, 1.85, 0.07, wood, 0.65, 2.1, 0.01);
  box(0.72, 0.66, 0.02, metal, 0.65, 2.49, 0.055);
  box(0.12, 0.035, 0.05, brass, 0.98, 2, 0.09);
  box(1.1, 0.48, 0.48, rubber, -1.25, 1.55, 0.55);
  box(1.1, 0.65, 0.12, rubber, -1.25, 1.99, 0.3);
  // Rounded console edge; the panel carries the instrument detail.
  const consoleShape = new T.Shape();
  consoleShape.moveTo(-1.36, -0.38);
  consoleShape.lineTo(1.36, -0.38);
  consoleShape.lineTo(1.36, 0.26);
  consoleShape.quadraticCurveTo(1.36, 0.38, 1.24, 0.38);
  consoleShape.lineTo(-1.24, 0.38);
  consoleShape.quadraticCurveTo(-1.36, 0.38, -1.36, 0.26);
  consoleShape.closePath();
  const housing = add(
    new T.ExtrudeGeometry(consoleShape, {
      depth: 0.18,
      bevelEnabled: false,
      curveSegments: 5,
    }).translate(0, 0, -0.18),
    metal,
    0,
    2.23,
    4.7,
  );
  housing.rotation.set(0.48, Math.PI, 0);
  box(2.45, 0.65, 0.65, metal, 0, 1.5, 4.84);
  const panelCanvas = canvas(1024, 512),
    compassCanvas = canvas(512, 512);
  const panelMap = map(panelCanvas, false),
    compassMap = map(compassCanvas, false);
  const lit = (t: T.Texture) =>
    new T.MeshStandardMaterial({
      map: t,
      emissiveMap: t,
      emissive: '#ffffff',
      emissiveIntensity: 0.38,
      roughness: 0.75,
    });
  const panel = add(new T.PlaneGeometry(2.52, 0.65), lit(panelMap), 0, 2.23, 4.68, group);
  panel.rotation.set(0.48, Math.PI, 0);
  panel.name = 'Live marine instruments';
  box(0.49, 0.12, 0.38, wood, -0.95, 2.51, 5.03);
  const compass = add(new T.CircleGeometry(0.215, 40), lit(compassMap), -0.95, 2.75, 4.965, group);
  compass.rotation.set(0.86, Math.PI, 0);
  compass.name = 'Working nautical compass';
  const binnacle = add(new T.CylinderGeometry(0.23, 0.23, 0.07, 32), brass, -0.95, 2.72, 4.99);
  binnacle.rotation.x = -0.71;
  // Wheel axis leans away; all spokes share the same tilted parent.
  const wheel = new T.Group();
  wheel.position.set(0, 2.02, 3.28);
  wheel.rotation.x = 0.45;
  group.add(wheel);
  wheel.name = 'Helm wheel';
  add(new T.TorusGeometry(0.29, 0.026, 6, 24), wood, 0, 0, 0, wheel);
  add(new T.CylinderGeometry(0.075, 0.075, 0.09, 12).rotateX(Math.PI / 2), brass, 0, 0, 0, wheel);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3,
      m = add(
        new T.BoxGeometry(0.019, 0.27, 0.019),
        brass,
        Math.sin(a) * 0.135,
        Math.cos(a) * 0.135,
        0,
        wheel,
      );
    m.rotation.z = -a;
  }
  box(0.12, 0.12, 1.32, metal, 0, 1.99, 3.99);
  box(0.5, 0.09, 0.48, rubber, 0, 1.72, 2.6);
  box(0.48, 0.48, 0.08, rubber, 0, 1.98, 2.37);
  box(0.1, 0.55, 0.1, metal, 0, 1.43, 2.6);
  // Starboard engine control with an animated lever and radio above it.
  box(0.48, 0.15, 0.67, wood, 0.65, 2.05, 3.22);
  box(0.34, 0.82, 0.48, metal, 0.65, 1.57, 3.22);
  box(0.05, 0.02, 0.46, metal, 0.65, 2.135, 3.22);
  const lever = new T.Group();
  lever.position.set(0.65, 2.14, 3.22);
  group.add(lever);
  lever.name = 'Engine telegraph lever';
  add(new T.CylinderGeometry(0.017, 0.017, 0.25, 8), brass, 0, 0.125, 0, lever);
  add(new T.SphereGeometry(0.055, 8, 6), rubber, 0, 0.26, 0, lever);
  box(0.6, 0.4, 0.15, metal, 1.7, 2.4, 4.91);
  const radio = add(
    new T.PlaneGeometry(0.56, 0.36),
    new T.MeshStandardMaterial({ map: marineSurface('radio'), roughness: 0.9 }),
    1.7,
    2.4,
    4.828,
  );
  radio.rotation.y = Math.PI;
  box(0.1, 0.22, 0.09, rubber, 1.31, 2.38, 4.84);
  // Port chart desk, folded logbook and pencil. The chart is decorative, not fish radar.
  box(0.9, 0.08, 1.14, wood, -1.64, 2, 3.82);
  for (const z of [3.5, 4.15]) box(0.12, 0.38, 0.08, metal, -2, 1.78, z);
  const chart = add(
    new T.PlaneGeometry(0.76, 0.88),
    new T.MeshStandardMaterial({ map: marineSurface('chart'), roughness: 1 }),
    -1.64,
    2.047,
    3.82,
  );
  chart.rotation.x = -Math.PI / 2;
  box(0.22, 0.035, 0.32, metal, -1.66, 2.065, 3.48);
  box(0.012, 0.012, 0.25, brass, -1.26, 2.06, 3.86);
  const cabinLightMaterial = new T.MeshStandardMaterial({
    color: '#e9dfbe',
    emissive: '#e9dfbe',
    emissiveIntensity: 0,
  });
  // Roof liner, small overhead light, visor and wiper arms framing clear glazing.
  box(0.62, 0.035, 0.22, rubber, 0, 3.73, 3.67);
  box(0.49, 0.02, 0.16, cabinLightMaterial, 0, 3.705, 3.67);
  for (const side of [-1, 1]) {
    const arm = box(0.024, 0.64, 0.025, rubber, side * 0.43, 2.52, 5.29);
    arm.rotation.z = side * 0.35;
    const blade = box(0.027, 0.43, 0.028, rubber, side * 0.32, 2.83, 5.28);
    blade.rotation.z = side * 0.35;
  }
  batch(fixed);
  batch(wheel);
  let last = -Infinity,
    key = '';
  function update(p: Reading, time: number) {
    if (time - last < 0.1) return;
    last = time;
    const bearing = nauticalHeading(p.heading);
    const next = [
      bearing.toFixed(1),
      p.speed.toFixed(1),
      Math.round(p.fuel),
      p.engine,
      (p.boatThrottle ?? 0).toFixed(2),
    ].join('/');
    if (next === key) return;
    key = next;
    drawPanel(panelCanvas, p);
    drawCompass(compassCanvas, bearing);
    panelMap.needsUpdate = compassMap.needsUpdate = true;
    lever.rotation.x = clamp(p.boatThrottle ?? 0, -1, 1) * 0.65;
    group.userData.readings = {
      heading: bearing,
      speedKnots: Math.abs(p.speed) * 1.94384,
      fuel: p.fuel,
      throttle: p.boatThrottle ?? 0,
    };
  }
  update({ heading: 0, speed: 0, fuel: 0, engine: false }, 0);
  return { group, cabinLightMaterial, update };
}
