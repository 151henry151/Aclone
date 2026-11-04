import { boatSeaPose } from '../shared/ocean';
import { canoeVehicle } from '../shared/canoe-rules';
import type { World } from '../shared/types';
import { createHuman } from './human';
// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
/** Open tapered hull: the rim, interior and seats make inversion legible at walking distance. */
export function createCanoe(paint = '#a84e32') {
  const group = new T.Group();
  group.name = 'canoe-hull';
  const vertices: number[] = [],
    indices: number[] = [];
  const sections = [
    [-1.8, 0.025, 0.4],
    [-1.4, 0.31, 0.26],
    [-0.8, 0.43, 0.23],
    [0, 0.46, 0.23],
    [0.8, 0.43, 0.23],
    [1.4, 0.31, 0.26],
    [1.8, 0.025, 0.4],
  ];
  for (const [z, width, rim] of sections)
    for (const [x, y] of [
      [-width, rim],
      [-width * 0.72, -0.08],
      [0, -0.18],
      [width * 0.72, -0.08],
      [width, rim],
    ])
      vertices.push(x, y, z);
  for (let s = 0; s < sections.length - 1; s++)
    for (let j = 0; j < 4; j++) {
      const a = s * 5 + j,
        b = a + 5;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  // Close bow and stern below the rim without covering the cockpit.
  indices.push(0, 2, 1, 0, 3, 2, 0, 4, 3);
  const end = (sections.length - 1) * 5;
  indices.push(end, end + 1, end + 2, end, end + 2, end + 3, end, end + 3, end + 4);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const hull = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({ color: paint, side: T.DoubleSide, roughness: 0.65 }),
  );
  hull.castShadow = true;
  group.add(hull);
  const wood = new T.MeshStandardMaterial({ color: '#c39356', roughness: 0.8 });
  // Interior lining sits above the mean water plane, keeping the open hull visually dry.
  const floorVertices: number[] = [],
    floorIndices: number[] = [];
  for (let i = 0; i < sections.length; i++) {
    const top = i * 15,
      lower = top + 3,
      y = 0.1;
    const x = T.MathUtils.lerp(
      vertices[lower],
      vertices[top],
      (y - vertices[lower + 1]) / (vertices[top + 1] - vertices[lower + 1]),
    );
    floorVertices.push(x, y, sections[i][0], -x, y, sections[i][0]);
    if (i < sections.length - 1) {
      const a = i * 2;
      floorIndices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const floorGeometry = new T.BufferGeometry();
  floorGeometry.setAttribute('position', new T.Float32BufferAttribute(floorVertices, 3));
  floorGeometry.setIndex(floorIndices);
  floorGeometry.computeVertexNormals();
  const floor = new T.Mesh(
    floorGeometry,
    new T.MeshStandardMaterial({ color: '#b67546', side: T.DoubleSide, roughness: 0.85 }),
  );
  floor.name = 'canoe-floor';
  group.add(floor);

  for (const z of [-0.65, 0.65]) {
    const seat = new T.Mesh(new T.BoxGeometry(0.78, 0.05, 0.22), wood);
    seat.position.set(0, 0.18, z);
    group.add(seat);
  }
  for (const sign of [-1, 1]) {
    const curve = new T.CatmullRomCurve3(
      sections.map(([z, width, y]) => new T.Vector3(sign * width, y, z)),
    );
    group.add(new T.Mesh(new T.TubeGeometry(curve, 24, 0.025, 5, false), wood));
  }
  return group;
}
export function carriedCanoe(paint?: string) {
  const hull = createCanoe(paint);
  hull.name = 'carried-canoe';
  hull.rotation.z = Math.PI;
  hull.position.y = 2.05;
  return hull;
}

/** One seated paddler; the same hull remains empty when moored. */
export function createPaddledCanoe(paint?: string) {
  const group = createCanoe(paint),
    person = createHuman('walking').group;
  person.getObjectByName('hips')!.position.y = 0;
  for (const side of [-1, 1]) {
    person.getObjectByName(`thigh-${side}`)!.rotation.x = -1.38;
    person.getObjectByName(`shin-${side}`)!.rotation.x = 1.43;
    person.getObjectByName(`foot-${side}`)!.rotation.x = -0.05;
  }
  person.position.set(0, 0.22, -0.65);
  group.add(person);
  group.userData.driver = person;
  group.userData.eye = new T.Vector3(0, 1.1, -0.65);
  group.userData.viewPitch = -0.12;
  const paddle = new T.Group(),
    wood = new T.MeshStandardMaterial({ color: '#bf945d', roughness: 0.8 });
  const shaft = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 1.5, 8), wood);
  paddle.add(shaft);
  const blade = new T.Mesh(new T.BoxGeometry(0.16, 0.45, 0.035), wood);
  blade.position.y = -0.8;
  paddle.add(blade);
  paddle.position.set(-0.57, 0.65, -0.45);
  group.add(paddle);
  return {
    group,
    animate(time: number, speed: number) {
      const effort = Math.min(1, Math.abs(speed)),
        phase = time * 3;
      paddle.rotation.x = 0.2 + Math.sin(phase) * 0.65 * effort;
      paddle.rotation.z = -0.2;
      person.getObjectByName('arm--1')!.rotation.x = -0.8 + Math.sin(phase) * 0.2 * effort;
      person.getObjectByName('arm-1')!.rotation.x = -1.1;
      person.getObjectByName('torso')!.rotation.x = Math.sin(phase) * 0.06 * effort;
    },
  };
}

/** Use the same river slope and sea motion as an occupied hull, including tides. */
export function floatCanoe(
  model: T.Group,
  w: World,
  x: number,
  z: number,
  heading: number,
  time: number,
  amplitude: number,
) {
  const v = canoeVehicle(w.settings),
    sea = boatSeaPose(w, x, z, heading, v.length!, v.beam!, time, amplitude);
  model.position.set(x, sea.y, z);
  model.rotation.set(sea.pitch, heading, sea.roll, 'YXZ');
}
