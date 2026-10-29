// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { createMarineInstruments, marineSurface } from './fishing-wheelhouse';
import type { Player } from '../shared/types';

/** Full-size cabin fittings; the outer boat's nonuniform scale never changes the helm. */
export function createCharterWheelhouse() {
  const group = new T.Group(),
    fixed = new T.Group();
  group.name = 'Coastal Belle wheelhouse';
  group.add(fixed);
  const timber = new T.MeshStandardMaterial({ color: '#795031', roughness: 0.7 });
  const brass = new T.MeshStandardMaterial({ color: '#c7a65a', metalness: 0.65, roughness: 0.36 });
  const dark = new T.MeshStandardMaterial({ color: '#203b37', roughness: 0.8 });
  const lining = new T.MeshStandardMaterial({ color: '#e3dcc1', roughness: 0.9 });
  function add(
    g: T.BufferGeometry,
    m: T.Material,
    x: number,
    y: number,
    z: number,
    parent = fixed,
  ) {
    const o = new T.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  const box = (w: number, h: number, d: number, m: T.Material, x: number, y: number, z: number) =>
    add(new T.BoxGeometry(w, h, d), m, x, y, z);
  box(2.55, 0.04, 2.5, timber, 0, 0.84, 3.4);
  box(2.55, 0.04, 2.5, lining, 0, 2.98, 3.4);
  for (const side of [-1, 1]) {
    box(0.045, 0.7, 2.5, lining, side * 1.3, 1.2, 3.4);
    box(0.07, 0.065, 2.5, timber, side * 1.27, 1.6, 3.4);
    box(0.055, 0.08, 2.5, timber, side * 1.27, 2.92, 3.4);
  }
  box(2.5, 0.08, 0.1, timber, 0, 1.6, 4.69);

  // Deep-green leather seats and a locker double as passenger seating behind the helm.
  box(0.56, 0.09, 0.55, dark, 0.48, 1.25, 2.5);
  box(0.55, 0.5, 0.09, dark, 0.48, 1.48, 2.24);
  box(0.09, 0.39, 0.09, brass, 0.48, 1.03, 2.5);
  box(0.65, 0.4, 0.68, timber, -0.79, 1.07, 2.72);
  box(0.67, 0.07, 0.7, dark, -0.79, 1.31, 2.72);
  // Rounded varnished console, shaded gauge faces and a proper compass binnacle.
  const shape = new T.Shape()
    .moveTo(-0.78, -0.23)
    .lineTo(0.78, -0.23)
    .lineTo(0.78, 0.14)
    .quadraticCurveTo(0.78, 0.23, 0.68, 0.23)
    .lineTo(-0.68, 0.23)
    .quadraticCurveTo(-0.78, 0.23, -0.78, 0.14)
    .closePath();
  const housing = add(
    new T.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false, curveSegments: 5 }),
    timber,
    0.25,
    1.7,
    4.16,
  );
  housing.geometry.translate(0, 0, -0.18);
  housing.rotation.set(0.38, Math.PI, 0);
  box(1.45, 0.57, 0.45, timber, 0.25, 1.19, 4.28);
  const instruments = createMarineInstruments('COASTAL BELLE / COASTAL CHARTERS', 192);
  const panel = add(new T.PlaneGeometry(1.45, 0.38), instruments.panel, 0.25, 1.7, 4.14, group);
  panel.rotation.set(0.38, Math.PI, 0);
  panel.name = 'Live marine instruments';
  const compass = add(
    new T.CircleGeometry(0.155, 32),
    instruments.compass,
    -0.45,
    1.98,
    4.3,
    group,
  );
  compass.rotation.set(0.7, Math.PI, 0);
  compass.name = 'Working nautical compass';
  const binnacle = add(new T.CylinderGeometry(0.17, 0.19, 0.16, 16), brass, -0.45, 1.85, 4.36);
  binnacle.rotation.x = -0.87;
  const wheel = new T.Group();
  wheel.name = 'Helm wheel';
  wheel.position.set(0.48, 1.57, 3.53);
  wheel.rotation.x = 0.4;
  group.add(wheel);
  add(new T.TorusGeometry(0.265, 0.027, 6, 24), timber, 0, 0, 0, wheel);
  add(new T.CylinderGeometry(0.065, 0.065, 0.09, 12).rotateX(Math.PI / 2), brass, 0, 0, 0, wheel);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const spoke = add(
      new T.BoxGeometry(0.022, 0.25, 0.022),
      brass,
      Math.sin(a) * 0.13,
      Math.cos(a) * 0.13,
      0,
      wheel,
    );
    spoke.rotation.z = -a;
  }
  box(0.08, 0.09, 0.63, brass, 0.48, 1.53, 3.85);
  box(0.27, 0.59, 0.38, timber, 1.01, 1.22, 3.49);
  box(0.3, 0.05, 0.42, brass, 1.01, 1.54, 3.49);
  box(0.025, 0.012, 0.32, dark, 1.01, 1.57, 3.49);
  const lever = new T.Group();
  lever.name = 'Engine telegraph lever';
  lever.position.set(1.01, 1.58, 3.49);
  group.add(lever);
  add(new T.CylinderGeometry(0.015, 0.015, 0.24, 8), brass, 0, 0.12, 0, lever);
  add(new T.SphereGeometry(0.045, 8, 6), dark, 0, 0.25, 0, lever);
  const radio = add(
    new T.PlaneGeometry(0.38, 0.28),
    new T.MeshStandardMaterial({ map: marineSurface('radio'), roughness: 0.8 }),
    -0.94,
    1.73,
    4.14,
  );
  radio.rotation.y = Math.PI;
  box(0.62, 0.05, 0.85, timber, -0.91, 1.48, 3.57);
  const chart = add(
    new T.PlaneGeometry(0.52, 0.7),
    new T.MeshStandardMaterial({ map: marineSurface('chart'), roughness: 1 }),
    -0.91,
    1.508,
    3.57,
  );
  chart.rotation.x = -Math.PI / 2;
  box(0.13, 0.018, 0.2, dark, -0.95, 1.53, 3.31);
  // Door, companionway handle, window wiper and ceiling fixture remain simple geometry.
  box(0.7, 1.5, 0.035, timber, 0, 1.6, 2.12);
  box(0.5, 0.45, 0.015, dark, 0, 1.97, 2.15);
  box(0.12, 0.025, 0.04, brass, 0.22, 1.5, 2.16);
  const wiper = box(0.018, 0.44, 0.02, dark, 0.62, 1.93, 4.72);
  wiper.rotation.z = 0.35;
  const cabinLightMaterial = new T.MeshStandardMaterial({
    color: '#fff1cf',
    emissive: '#fff1cf',
    emissiveIntensity: 0,
  });
  box(0.48, 0.04, 0.21, brass, 0, 2.93, 3.2);
  box(0.4, 0.015, 0.15, cabinLightMaterial, 0, 2.904, 3.2);
  batch(fixed);
  batch(wheel);
  batch(lever);
  group.userData.readings = instruments.readings;
  return {
    group,
    cabinLightMaterial,
    update(p: Player, time: number, throttle = p.boatThrottle ?? 0) {
      // Persistent marine throttle, actual fuel and compass bearing.
      instruments.update({ ...p, boatThrottle: throttle }, time);
      lever.rotation.x = T.MathUtils.clamp(throttle, -1, 1) * 0.6;
    },
    animate(turn: number) {
      wheel.rotation.z = T.MathUtils.clamp(-turn * 2.5, -0.65, 0.65);
    },
  };
}
