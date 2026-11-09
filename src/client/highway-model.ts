// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { batch } from './tractor';
import { detailTexture } from './detail-textures';
import { vehicleLamp } from './vehicle-lights';
import { createHuman } from './human';
import {
  HIGHWAY_TRACTOR,
  highwayTractor,
  semitrailerDefinition,
  type SemiKind,
} from '../shared/highway-definitions';
import { automotiveConfig } from '../shared/automotive-config';
import { vehicleDef } from '../shared/vehicle-config';
import type { World, Stock, Player } from '../shared/types';

const lamp = (color: string, intensity: number) =>
  vehicleLamp(new T.MeshStandardMaterial({ color, emissive: color, roughness: 0.4 }), intensity);
function kit() {
  const group = new T.Group();
  const mat = (color: string, metalness = 0) =>
    new T.MeshStandardMaterial({ color, metalness, roughness: 0.64 });
  const steel = mat('#343e44', 0.5),
    alloy = mat('#c0c7c6', 0.65),
    rubber = mat('#272b2e');
  rubber.map = detailTexture('tyre');
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
    parent: T.Group,
    w: number,
    h: number,
    l: number,
    material: T.Material,
    x: number,
    y: number,
    z: number,
  ) => add(parent, new T.BoxGeometry(w, h, l), material, x, y, z);
  const component = (name: string) => {
    const g = new T.Group();
    g.name = name;
    group.add(g);
    return g;
  };
  const wheels: T.Group[] = [];
  const wheel = (parent: T.Group, x: number, z: number, width = 0.32) => {
    const g = new T.Group();
    g.position.set(x, 0.52, z);
    g.userData.radius = 0.52;
    parent.add(g);
    wheels.push(g);
    add(g, new T.CylinderGeometry(0.52, 0.52, width, 12).rotateZ(Math.PI / 2), rubber, 0, 0, 0);
    add(
      g,
      new T.CylinderGeometry(0.29, 0.29, width + 0.012, 8).rotateZ(Math.PI / 2),
      alloy,
      0,
      0,
      0,
    );
    add(
      g,
      new T.CylinderGeometry(0.115, 0.115, width + 0.035, 6).rotateZ(Math.PI / 2),
      steel,
      0,
      0,
      0,
    );
    // Rim and tread shading carry detail without separate bolt meshes.
    batch(g);
    return g;
  };
  group.userData.wheels = wheels;
  return { group, mat, steel, alloy, rubber, add, box, component, wheels, wheel };
}
/** Three-axle full-size semi. The same world dimensions feed physical footprints. */
export function createSemitrailer(kind: SemiKind, cargo: Stock, world?: World) {
  const k = kit(),
    { group, mat, steel, alloy, rubber, add, box, component, wheel } = k;
  const d = semitrailerDefinition(kind, world),
    rules = automotiveConfig(world).coupling;
  const l = d.length,
    w = d.width,
    h = d.height,
    floor = 1.28;
  group.name = d.name;
  const body = component('trailer-body'),
    chassis = component('chassis'),
    legs = component('landing-legs'),
    pin = component('kingpin');
  group.userData.landingLegs = legs;
  // The support foot travels up toward the fixed chassis underside.
  legs.userData.retractedY = 0.92 - 0.17;
  const paint = mat(d.color, 0.2),
    timber = mat('#a47b49'),
    red = lamp('#a73429', 1.8),
    amber = lamp('#dda050', 0.8);
  timber.map = detailTexture('siding');
  paint.map = detailTexture('paint');
  for (const side of [-1, 1]) {
    box(chassis, 0.16, 0.3, l - 0.1, steel, side * w * 0.3, 0.92, 0);
    box(chassis, 0.07, 0.3, l * 0.48, alloy, side * (w / 2 - 0.13), 0.67, 0.25);
    for (let z = -l / 2 + 0.7; z < l / 2; z += 2)
      box(chassis, 0.035, 0.075, 0.15, amber, side * (w / 2 - 0.015), floor - 0.05, z);
    box(legs, 0.12, 0.82, 0.13, steel, side * w * 0.29, 0.62, l * 0.22);
    box(legs, 0.35, 0.08, 0.35, steel, side * w * 0.29, 0.17, l * 0.22);
  }
  box(body, w, 0.12, l, steel, 0, floor - 0.06, 0);
  add(
    pin,
    new T.CylinderGeometry(0.06, 0.08, 0.18, 10),
    alloy,
    0,
    1.08,
    l / 2 - rules.kingpinInset,
  );
  const bogie = -l / 2 + rules.axleRearInset;
  for (const z of [bogie - 1.2, bogie, bogie + 1.2]) {
    box(chassis, w - 0.25, 0.13, 0.14, steel, 0, 0.52, z);
    for (const side of [-1, 1]) {
      wheel(group, side * (w / 2 - 0.18), z);
      box(chassis, 0.39, 0.07, 1.1, rubber, side * (w / 2 - 0.2), 1.08, z);
    }
  }
  box(chassis, w - 0.2, 0.15, 0.13, alloy, 0, 0.5, -l / 2 + 0.02);
  for (const side of [-1, 1])
    box(chassis, 0.3, 0.13, 0.04, red, side * (w / 2 - 0.3), 0.9, -l / 2 - 0.015);
  if (kind === 'semiStake') {
    box(body, w - 0.1, 0.1, l - 0.1, timber, 0, floor + 0.05, 0);
    for (const side of [-1, 1])
      for (let z = -l / 2 + 0.5; z < l / 2; z += 2)
        box(body, 0.09, h - floor, 0.1, steel, side * (w / 2 - 0.06), (h + floor) / 2, z);
    box(body, w - 0.1, h - floor, 0.12, paint, 0, (h + floor) / 2, l / 2 - 0.06);
    const load = component('timber-load'),
      ties = component('load-restraints');
    const amount = (cargo.logs ?? 0) + (cargo.wood ?? 0);
    if (amount > 0) {
      const rows = Math.min(4, Math.max(1, Math.ceil(amount / 100))),
        radius = (w - 0.3) / 10;
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < 5 - (row % 2); col++) {
          const x = (col - 2 + (row % 2) * 0.5) * radius * 2;
          add(
            load,
            new T.CylinderGeometry(radius * 0.9, radius, l - 0.6, 8).rotateX(Math.PI / 2),
            timber,
            x,
            floor + 0.1 + radius + row * radius * 1.8,
            0,
          );
        }
      const top = floor + 0.1 + radius * 2 + (rows - 1) * radius * 1.8;
      for (const z of [-l * 0.3, 0, l * 0.3]) {
        box(ties, w - 0.15, 0.045, 0.11, steel, 0, top, z);
        for (const side of [-1, 1])
          box(ties, 0.045, top - floor, 0.11, steel, side * (w / 2 - 0.075), (top + floor) / 2, z);
      }
    }
    batch(load);
    batch(ties);
  } else {
    for (const side of [-1, 1]) {
      box(body, 0.07, h - floor, l, paint, side * (w / 2 - 0.035), (h + floor) / 2, 0);
      box(body, 0.035, 0.07, l, alloy, side * (w / 2 - 0.025), h - 0.05, 0);
      for (let z = -l / 2 + 0.4; z < l / 2; z += 0.85)
        box(body, 0.02, h - floor - 0.15, 0.035, alloy, side * (w / 2 - 0.008), (h + floor) / 2, z);
    }
    box(body, w, 0.08, l, paint, 0, h - 0.04, 0);
    box(body, w, h - floor, 0.08, paint, 0, (h + floor) / 2, l / 2 - 0.04);
    box(body, w - 0.1, h - floor - 0.05, 0.08, paint, 0, (h + floor) / 2, -l / 2 + 0.04);
    for (const x of [-w * 0.24, w * 0.24]) {
      box(body, 0.045, h - floor - 0.2, 0.045, steel, x, (h + floor) / 2, -l / 2 - 0.005);
      for (const y of [floor + 0.4, h - 0.4])
        box(body, 0.3, 0.07, 0.05, alloy, x, y, -l / 2 - 0.02);
    }
    if (kind === 'semiRefrigerated') {
      const unit = component('refrigeration-unit');
      box(unit, w * 0.7, 1.2, 0.28, alloy, 0, h - 0.72, l / 2 - 0.19);
      for (const x of [-w * 0.17, w * 0.17])
        add(
          unit,
          new T.CylinderGeometry(0.27, 0.27, 0.03, 16).rotateX(Math.PI / 2),
          rubber,
          x,
          h - 0.65,
          l / 2 - 0.035,
        );
      for (let y = h - 1.2; y < h - 0.1; y += 0.13)
        box(unit, w * 0.62, 0.035, 0.03, steel, 0, y, l / 2 - 0.015);
      batch(unit);
    }
  }
  for (const g of [body, chassis, legs, pin]) batch(g);
  group.userData.tailLights = red;
  return group;
}
/** Forward-control cab, tandem rear axle and fifth wheel; no stretch of the farm tractor. */
export function createHighwayTractor(world: World, color?: string) {
  const v = vehicleDef(world, HIGHWAY_TRACTOR),
    k = kit(),
    { group, mat, steel, alloy, rubber, add, box, component, wheel } = k;
  const l = v.length!,
    w = v.width!,
    wheelbase = v.wheelbase!,
    front = l * 0.34375,
    rear = front - wheelbase;
  const paint = mat(color ?? v.color, 0.22),
    cream = mat('#e1ddd0'),
    glass = new T.MeshStandardMaterial({
      color: '#b7d3dd',
      transparent: true,
      opacity: 0.17,
      roughness: 0.15,
      depthWrite: false,
    });
  paint.map = detailTexture('paint');
  const chassis = component('chassis'),
    cab = component('cab'),
    interior = component('cab-interior'),
    mirrors = component('mirrors'),
    fifth = component('fifth-wheel');
  const head = lamp('#fff0c7', 1.8),
    tail = lamp('#b33228', 1.6),
    marker = lamp('#e4b458', 0.8);
  for (const side of [-1, 1]) {
    box(chassis, 0.18, 0.3, l, steel, side * w * 0.28, 0.85, 0);
    box(chassis, 0.5, 0.55, l * 0.24, alloy, side * (w / 2 - 0.34), 0.8, -0.1);
    for (const z of [rear - 0.6, rear + 0.6]) {
      wheel(group, side * (w / 2 - 0.19), z);
      box(chassis, 0.43, 0.1, 1.25, paint, side * (w / 2 - 0.22), 1.12, z);
    }
    const pivot = new T.Group();
    group.add(pivot);
    const tire = wheel(pivot, side * (w / 2 - 0.19), front);
    pivot.position.copy(tire.position);
    tire.position.set(0, 0, 0);
    (group.userData.steerPivots ??= []).push(pivot);
    for (const y of [0.5, 0.83, 1.16])
      box(chassis, 0.3, 0.09, 0.65, alloy, side * (w / 2 - 0.16), y, front - 0.8);
    box(cab, 0.12, 1.7, 0.15, paint, side * (w / 2 - 0.08), 2.75, l / 2 - 0.13);
    box(cab, 0.08, 0.7, 2.55, paint, side * (w / 2 - 0.05), 2.02, l * 0.29);
    box(cab, 0.08, 1.4, 0.13, paint, side * (w / 2 - 0.05), 2.8, l * 0.07);
    box(cab, 0.025, 0.92, 2.25, glass, side * (w / 2 - 0.025), 2.92, l * 0.29);
    box(mirrors, 0.45, 0.045, 0.06, steel, side * w * 0.53, 2.9, l * 0.4);
    box(mirrors, 0.2, 0.44, 0.09, steel, side * w * 0.59, 2.8, l * 0.4);
    box(mirrors, 0.16, 0.38, 0.015, alloy, side * w * 0.59, 2.8, l * 0.4 - 0.05);
    box(chassis, 0.36, 0.14, 0.08, head, side * w * 0.31, 1.02, l / 2 - 0.02);
    box(chassis, 0.32, 0.13, 0.08, tail, side * w * 0.31, 0.9, -l / 2 + 0.02);
    box(cab, 0.12, 0.08, 0.12, marker, side * w * 0.39, 3.65, l * 0.4);
    box(interior, 0.66, 0.15, 0.7, rubber, side * w * 0.24, 2.03, l * 0.23);
    box(interior, 0.66, 0.72, 0.15, rubber, side * w * 0.24, 2.35, l * 0.18);
  }
  box(chassis, w, 0.26, 0.3, alloy, 0, 0.78, l / 2 - 0.15);
  box(cab, w * 0.94, 0.9, 0.18, paint, 0, 1.5, l / 2 - 0.09);
  box(cab, w * 0.64, 0.5, 0.04, rubber, 0, 1.45, l / 2 + 0.005);
  for (let y = 1.25; y < 1.7; y += 0.09)
    box(cab, w * 0.6, 0.025, 0.045, alloy, 0, y, l / 2 + 0.025);
  box(cab, w * 0.96, 0.13, l * 0.44, paint, 0, highwayTractor().height - 0.065, l * 0.28);
  box(cab, w * 0.96, 2.2, 0.12, paint, 0, 2.5, l * 0.06);
  box(cab, w * 0.88, 1.02, 0.025, glass, 0, 2.91, l / 2 - 0.1);
  box(interior, w * 0.9, 0.12, l * 0.4, steel, 0, 1.65, l * 0.27);
  box(interior, w * 0.86, 0.3, 0.55, rubber, 0, 2.47, l * 0.4);
  box(interior, w * 0.82, 0.22, 0.6, cream, 0, 2.04, l * 0.1);
  const steering = new T.Group();
  steering.position.set(w * 0.24, 2.66, l * 0.34);
  steering.rotation.x = 0.7;
  group.add(steering);
  add(steering, new T.TorusGeometry(0.23, 0.025, 4, 12), rubber, 0, 0, 0);
  for (const angle of [0, 2.094, 4.189]) {
    const spoke = box(
      steering,
      0.025,
      0.24,
      0.025,
      alloy,
      Math.sin(angle) * 0.11,
      Math.cos(angle) * 0.11,
      0,
    );
    spoke.rotation.z = -angle;
  }
  batch(steering);
  const needles: T.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const x = w * 0.24 + (i - 1) * 0.19;
    add(
      interior,
      new T.CylinderGeometry(0.08, 0.08, 0.02, 16).rotateX(Math.PI / 2),
      cream,
      x,
      2.67,
      l * 0.4 - 0.29,
    );
    const needle = new T.Group();
    needle.position.set(x, 2.67, l * 0.4 - 0.315);
    group.add(needle);
    box(needle, 0.008, 0.06, 0.008, steel, 0, 0.025, 0);
    needles.push(needle);
  }
  add(
    fifth,
    new T.CylinderGeometry(0.48, 0.48, 0.12, 16),
    steel,
    0,
    1.16,
    automotiveConfig(world).coupling.fifthWheelZ,
  );
  box(fifth, 0.18, 0.14, 0.3, rubber, 0, 1.18, automotiveConfig(world).coupling.fifthWheelZ - 0.3);
  const driver = createHuman('seated');
  driver.group.position.set(w * 0.24, 2.1, l * 0.23);
  group.add(driver.group);
  group.userData.driver = driver.group;
  group.userData.eye = new T.Vector3(v.cockpit!.x, v.cockpit!.y, v.cockpit!.z);
  group.userData.viewPitch = -0.05;
  group.userData.lamp = new T.Vector3(0, 1.05, l / 2);
  group.userData.reverseLamp = new T.Vector3(0, 1.1, -l / 2);
  group.userData.contacts = [-w * 0.4, w * 0.4].flatMap((x) =>
    [rear, front].map((z) => new T.Vector3(x, 0, z)),
  );
  group.userData.highwayAnimate = (p: Player, turn: number) => {
    for (const pivot of group.userData.steerPivots as T.Group[])
      pivot.rotation.y = T.MathUtils.clamp(turn, -0.55, 0.55);
    steering.rotation.z = -turn * 2;
    const values = [
      Math.abs(p.speed) / v.speed,
      p.fuel / (v.tank ?? 1),
      (p.fleetState?.[p.vehicle]?.condition ?? 100) / 100,
    ];
    needles.forEach(
      (needle, i) => (needle.rotation.z = 2.3 - T.MathUtils.clamp(values[i], 0, 1) * 4.6),
    );
  };
  // Change the cab shell above its fixed floor, leaving the person, controls,
  // chassis and coupling at their true physical size and working heights.
  cab.scale.y = (v.height! - 1.65) / (highwayTractor().height - 1.65);
  cab.position.y = 1.65 * (1 - cab.scale.y);
  for (const g of [chassis, cab, interior, mirrors, fifth]) batch(g);
  return group;
}
