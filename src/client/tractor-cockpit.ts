// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { vehicles } from '../shared/catalog';
import { fuelCapacity } from '../shared/tractors';
import { vehicleCondition } from '../shared/vehicle-services';
import type { Player, World } from '../shared/types';

// +Z is forwards: the top of the wheel must lean away from the seated driver.
export const STEERING_TILT = 0.8;
type Surface = 'floor' | 'door' | 'lining';
const surfaces = new Map<Surface, T.CanvasTexture>();
const faces = new Map<number, T.CanvasTexture>();
function texture(canvas: HTMLCanvasElement, shared = true) {
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  t.userData.shared = shared;
  return t;
}
function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
/** Handles, pedal pads, seams and insulation are pixels, not individual meshes. */
function surface(kind: Surface) {
  const existing = surfaces.get(kind);
  if (existing) return existing;
  const c = canvas(512, 256),
    x = c.getContext('2d')!;
  x.fillStyle = kind === 'lining' ? '#a49c87' : '#343b35';
  x.fillRect(0, 0, 512, 256);
  for (let row = 0; row < 256; row += 8) {
    x.fillStyle = kind === 'lining' ? '#928c7b' : '#252d28';
    x.fillRect(0, row, 512, 2);
    x.fillStyle = kind === 'lining' ? '#b7af9a' : '#485047';
    x.fillRect(0, row + 2, 512, 1);
  }
  if (kind === 'floor') {
    for (const left of [150, 285]) {
      x.fillStyle = '#121b18';
      x.fillRect(left, 22, 68, 80);
      x.strokeStyle = '#6b7266';
      x.lineWidth = 2;
      x.strokeRect(left, 22, 68, 80);
      for (let y = 28; y < 99; y += 10) {
        x.fillStyle = '#777b6c';
        x.fillRect(left + 6, y, 56, 3);
      }
    }
  } else if (kind === 'door') {
    x.strokeStyle = '#879184';
    x.lineWidth = 3;
    x.strokeRect(20, 18, 472, 220);
    x.fillStyle = '#151e19';
    x.fillRect(270, 45, 140, 34);
    x.fillStyle = '#a49f8b';
    x.fillRect(280, 48, 118, 13);
    x.fillStyle = '#1e2821';
    x.fillRect(55, 145, 380, 70);
    x.strokeStyle = '#626b5d';
    x.strokeRect(55, 145, 380, 70);
  }
  for (const px of [12, 500])
    for (const py of [12, 244]) {
      x.fillStyle = '#676f61';
      x.beginPath();
      x.arc(px, py, 3, 0, Math.PI * 2);
      x.fill();
    }
  const t = texture(c);
  surfaces.set(kind, t);
  return t;
}
const dialAngle = (fraction: number) => Math.PI * (0.75 + Math.max(0, Math.min(1, fraction)) * 1.5);
const gauges = [
  { x: 285, y: 170, r: 125, label: 'ROAD SPEED', unit: 'MPH', max: 80 },
  { x: 585, y: 170, r: 86, label: 'FUEL', unit: 'E  —  F', max: 100 },
  { x: 805, y: 170, r: 86, label: 'CONDITION', unit: '%', max: 100 },
];
function dashboard(slot: number) {
  const existing = faces.get(slot);
  if (existing) return existing;
  const c = canvas(1024, 384),
    x = c.getContext('2d')!;
  const vintage = slot === 0 || slot === 24;
  x.fillStyle = vintage ? '#343c32' : '#252e2b';
  x.fillRect(0, 0, 1024, 384);
  // Fine brushed texture, fasteners and a raised gasket painted into one atlas.
  for (let y = 0; y < 384; y += 3) {
    x.fillStyle = y % 2 ? '#ffffff04' : '#00000015';
    x.fillRect(0, y, 1024, 1);
  }
  x.strokeStyle = '#101b16';
  x.lineWidth = 12;
  x.beginPath();
  x.roundRect(8, 8, 1008, 368, [84, 84, 0, 0]);
  x.stroke();
  x.strokeStyle = '#7c8371';
  x.lineWidth = 2;
  x.beginPath();
  x.roundRect(15, 15, 994, 354, [77, 77, 0, 0]);
  x.stroke();
  for (const px of [48, 976])
    for (const py of [48, 354]) {
      x.fillStyle = '#999e8a';
      x.beginPath();
      x.arc(px, py, 6, 0, Math.PI * 2);
      x.fill();
      x.strokeStyle = '#29372c';
      x.beginPath();
      x.moveTo(px - 4, py + 2);
      x.lineTo(px + 4, py - 2);
      x.stroke();
    }
  for (const d of gauges) {
    const grad = x.createRadialGradient(d.x, d.y, d.r - 10, d.x, d.y, d.r);
    grad.addColorStop(0, '#141e19');
    grad.addColorStop(0.6, '#a4a995');
    grad.addColorStop(1, '#364438');
    x.fillStyle = grad;
    x.beginPath();
    x.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = vintage ? '#e5ddbf' : '#17241f';
    x.beginPath();
    x.arc(d.x, d.y, d.r - 10, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = vintage ? '#3d4939' : '#b8d1b0';
    x.fillStyle = x.strokeStyle;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    for (let tick = 0; tick <= 40; tick++) {
      const a = dialAngle(tick / 40),
        r = d.r - 17,
        major = tick % 5 === 0;
      x.lineWidth = major ? 3 : 1;
      x.beginPath();
      x.moveTo(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r);
      x.lineTo(
        d.x + Math.cos(a) * (r - (major ? 12 : 6)),
        d.y + Math.sin(a) * (r - (major ? 12 : 6)),
      );
      x.stroke();
      if (major && d.label === 'ROAD SPEED') {
        x.font = '16px monospace';
        x.fillText(
          String((tick * d.max) / 40),
          d.x + Math.cos(a) * (r - 27),
          d.y + Math.sin(a) * (r - 27),
        );
      }
    }
    x.font = 'bold 13px sans-serif';
    x.fillText(d.label, d.x, d.y - 30);
    x.font = '13px monospace';
    x.fillText(d.unit, d.x, d.y + 37);
  }
  x.textAlign = 'left';
  x.fillStyle = '#d6cba8';
  x.font = 'bold 17px sans-serif';
  x.fillText(vehicles[slot].name.toUpperCase(), 60, 331);
  x.font = '12px monospace';
  x.fillStyle = '#a1ad94';
  x.fillText('PARISH MOTOR WORKS', 60, 352);
  x.textAlign = 'center';
  x.font = '12px sans-serif';
  for (const [cx, name] of [
    [530, 'ENGINE'],
    [640, 'LIGHTS'],
  ] as const)
    x.fillText(name, cx, 351);
  x.fillStyle = '#111c17';
  x.fillRect(745, 315, 192, 35);
  const t = texture(c);
  faces.set(slot, t);
  return t;
}
type Cockpit = {
  panel: T.Mesh<T.ShapeGeometry, T.MeshStandardMaterial>;
  base: HTMLCanvasElement;
  live?: HTMLCanvasElement;
  last: number;
  key?: string;
};
/** Just four segments per upper corner; the lower corners remain square. */
function instrumentOutline(width: number, height: number) {
  const x = width / 2,
    y = height / 2,
    r = width * 0.09;
  return new T.Shape()
    .moveTo(-x, -y)
    .lineTo(x, -y)
    .lineTo(x, y - r)
    .absarc(x - r, y - r, r, 0, Math.PI / 2, false)
    .lineTo(-x + r, y)
    .absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false)
    .lineTo(-x, -y);
}
export function addTractorCockpit(
  g: T.Group,
  slot: number,
  seatY: number,
  seatZ: number,
  width: number,
  dark: T.Material,
  paint: T.Material,
) {
  const addBox = (
    w: number,
    h: number,
    d: number,
    material: T.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const surfaceMaterials = new Map<T.Texture, T.MeshStandardMaterial>();
  const addPanel = (w: number, h: number, map: T.Texture, x: number, y: number, z: number) => {
    let material = surfaceMaterials.get(map);
    if (!material) {
      material = new T.MeshStandardMaterial({ map, roughness: 0.87 });
      surfaceMaterials.set(map, material);
    }
    const m = new T.Mesh(new T.PlaneGeometry(w, h), material);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const floorY = seatY - 0.55;
  addBox(width, 0.07, 1.25, dark, 0, floorY, seatZ + 0.13);
  const floor = addPanel(width - 0.06, 1.18, surface('floor'), 0, floorY + 0.038, seatZ + 0.13);
  floor.rotation.x = -Math.PI / 2;
  if (slot !== 24)
    for (const side of [-1, 1]) {
      addBox(0.04, 0.54, 1.1, paint, (side * width) / 2, floorY + 0.29, seatZ + 0.04);
      const door = addPanel(
        1.03,
        0.47,
        surface('door'),
        side * (width / 2 - 0.022),
        floorY + 0.29,
        seatZ + 0.04,
      );
      door.rotation.y = (-side * Math.PI) / 2;
    }
  const roofY = ({ 0: 2.73, 25: 2.71, 26: 2.73, 27: 3.11, 28: 2.81 } as Record<number, number>)[
    slot
  ];
  if (roofY) {
    const lining = addPanel(width - 0.04, 1.08, surface('lining'), 0, roofY - 0.027, seatZ);
    lining.rotation.x = Math.PI / 2;
  }
  // One simple instrument binnacle and one flat, upward-facing printed face.
  const dashY = seatY + 0.22,
    dashZ = seatZ + 0.6;
  const panelWidth = Math.min(1.1, width * 0.89),
    panelHeight = (panelWidth * 384) / 1024;
  const cowl = new T.Mesh(
    new T.ExtrudeGeometry(instrumentOutline(panelWidth + 0.035, panelHeight + 0.025), {
      depth: 0.4,
      bevelEnabled: false,
      curveSegments: 2,
      steps: 1,
    }).translate(0, 0, -0.2),
    paint,
  );
  cowl.position.set(0, dashY - 0.015, dashZ + 0.28);
  cowl.castShadow = cowl.receiveShadow = true;
  g.add(cowl);
  const vertices = cowl.geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++)
    if (vertices.getZ(i) > 0 && vertices.getY(i) > 0) vertices.setY(i, vertices.getY(i) - 0.14);
  vertices.needsUpdate = true;
  cowl.geometry.computeVertexNormals();
  const map = dashboard(slot);
  const material = new T.MeshStandardMaterial({
    map,
    emissiveMap: map,
    emissive: '#ffe3ac',
    emissiveIntensity: 0.05,
    roughness: 0.72,
  });
  const face = new T.ShapeGeometry(instrumentOutline(panelWidth, panelHeight), 2);
  // ShapeGeometry uses model-space UVs; retain the original full dashboard atlas.
  const uv = face.attributes.uv;
  for (let i = 0; i < uv.count; i++)
    uv.setXY(i, uv.getX(i) / panelWidth + 0.5, uv.getY(i) / panelHeight + 0.5);
  const panel = new T.Mesh(face, material);
  panel.position.set(0, dashY, dashZ);
  panel.rotation.set(0.28, Math.PI, 0);
  // Keep the live face out of static geometry batching.
  const faceGroup = new T.Group();
  faceGroup.add(panel);
  g.add(faceGroup);
  g.userData.cockpit = { panel, base: map.image, last: -Infinity } satisfies Cockpit;
  const steering = new T.Group();
  steering.position.set(0, seatY + 0.2, seatZ + 0.32);
  steering.rotation.x = STEERING_TILT;
  const parts: T.BufferGeometry[] = [new T.TorusGeometry(0.23, 0.025, 5, 20).toNonIndexed()];
  for (let i = 0; i < 3; i++) {
    const spoke = new T.BoxGeometry(0.022, 0.2, 0.019).toNonIndexed();
    spoke.translate(0, 0.1, 0);
    spoke.rotateZ((i * Math.PI * 2) / 3);
    parts.push(spoke);
  }
  parts.push(new T.CylinderGeometry(0.052, 0.052, 0.04, 12).rotateX(Math.PI / 2).toNonIndexed());
  steering.add(new T.Mesh(mergeGeometries(parts)!, dark));
  parts.forEach((p) => p.dispose());
  g.add(steering);
  g.userData.steering = steering;
  const column = new T.Mesh(new T.CylinderGeometry(0.026, 0.035, 0.9, 8), dark);
  const axis = new T.Vector3(0, -Math.sin(STEERING_TILT), Math.cos(STEERING_TILT));
  column.position.copy(steering.position).addScaledVector(axis, 0.45);
  column.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), axis);
  g.add(column);
}
/** Only the local, visible cockpit uploads a texture, at most four times a second. */
export function updateTractorCockpit(g: T.Group, p: Player, time: number, w?: World) {
  const cockpit = g.userData.cockpit as Cockpit | undefined;
  if (!cockpit || time - cockpit.last < 0.25) return;
  cockpit.last = time;
  const mph = Math.abs(p.speed) * 2.237,
    fuel = p.fuel / fuelCapacity(p, w),
    condition = vehicleCondition(p);
  const km = (p.fleetState?.[p.vehicle]?.metres ?? 0) / 1000;
  const powered = p.engine && p.fuel > 0;
  const key = [
    mph.toFixed(0),
    fuel.toFixed(2),
    condition.toFixed(0),
    km.toFixed(1),
    powered,
    p.lights,
  ].join('/');
  if (key === cockpit.key) return;
  cockpit.key = key;
  if (!cockpit.live) {
    cockpit.live = canvas(1024, 384);
    const map = texture(cockpit.live, false);
    cockpit.panel.material.map = cockpit.panel.material.emissiveMap = map;
  }
  const x = cockpit.live.getContext('2d')!;
  x.drawImage(cockpit.base, 0, 0);
  for (let i = 0; i < gauges.length; i++) {
    const d = gauges[i],
      a = dialAngle([mph / 80, fuel, condition / 100][i]);
    x.lineWidth = 4;
    x.strokeStyle = '#db5e34';
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(d.x - Math.cos(a) * 10, d.y - Math.sin(a) * 10);
    x.lineTo(d.x + Math.cos(a) * (d.r - 34), d.y + Math.sin(a) * (d.r - 34));
    x.stroke();
    x.fillStyle = '#918d76';
    x.beginPath();
    x.arc(d.x, d.y, 7, 0, Math.PI * 2);
    x.fill();
  }
  for (const [cx, on] of [
    [530, powered],
    [640, p.lights],
  ] as const) {
    x.fillStyle = on ? '#9dd9a0' : '#15231c';
    x.beginPath();
    x.arc(cx, 320, 10, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = '#d0dfb2';
  x.font = '19px monospace';
  x.textAlign = 'center';
  x.fillText(km.toFixed(1).padStart(7, '0') + ' km', 841, 339);
  cockpit.panel.material.emissiveIntensity = p.lights ? 0.45 : 0.06;
  cockpit.panel.material.map!.needsUpdate = true;
}
