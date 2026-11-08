// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { World } from '../shared/types';
import type { Bridge } from '../shared/bridge-types';
import type { RoadWork } from '../shared/road-work';
import { terrainHeight } from '../shared/terrain';
import { BRIDGE_RAIL_WIDTH, bridgeRampHeight } from '../shared/bridge-geometry';
import { batch } from './tractor';

/** Render the saved ramp triangles used by physical wheel support. */
export function* createBridgeModelSteps(w: World, b: Bridge): RoadWork<T.Group> {
  const g = new T.Group();
  const length = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z),
    dx = (b.b.x - b.a.x) / length,
    dz = (b.b.z - b.a.z) / length;
  const before = Math.hypot(b.a.x - b.approachA.x, b.a.z - b.approachA.z),
    after = Math.hypot(b.b.x - b.approachB.x, b.b.z - b.approachB.z);
  const width = b.width + BRIDGE_RAIL_WIDTH * 2;
  const point = (side: number, along: number) => ({
    x: b.a.x + dx * along + dz * side,
    z: b.a.z + dz * along - dx * side,
  });
  const top = (side: number, along: number) =>
    along < 0
      ? bridgeRampHeight(b, 0, -along, side)
      : along > length
        ? bridgeRampHeight(b, 1, along - length, side)
        : b.deckY;
  const steel = new T.MeshStandardMaterial({ color: '#52666a', roughness: 0.8, metalness: 0.25 });
  const deck = new T.MeshStandardMaterial({ color: '#77766b', roughness: 1 });
  const concrete = new T.MeshStandardMaterial({ color: '#a09b89', roughness: 1 });
  const warning = new T.MeshStandardMaterial({ color: '#cfaa48', roughness: 0.9 });
  const box = (
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    material: T.Material,
  ) => {
    const m = new T.Mesh(new T.BoxGeometry(sx, sy, sz), material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const beam = (a: T.Vector3, c: T.Vector3, thickness: number, material: T.Material) => {
    const delta = c.clone().sub(a),
      m = box(0, 0, 0, thickness, delta.length(), thickness, material);
    m.position.copy(a).add(c).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize());
  };
  if (b.completedAt === undefined) {
    // Empty construction is marked on the dry banks; there is no deceptive deck over water.
    for (const z of [-before, 0, length, length + after]) {
      yield;
      for (const side of [-1, 1]) {
        const x = (side * width) / 2,
          q = point(x, z),
          y = terrainHeight(w, q.x, q.z);
        box(x, y + 0.8, z, 0.16, 1.6, 0.16, warning);
      }
    }
  } else {
    box(0, b.deckY - b.thickness / 2, length / 2, width, b.thickness, length, deck);
    for (const end of [0, 1] as const) {
      const rows = b.ramps[end].rows,
        nx = rows[0].heights.length - 1,
        positions: number[] = [],
        indices: number[] = [];
      for (let iz = 0; iz < rows.length; iz++) {
        yield;
        const distance = rows[iz].distance + (iz === rows.length - 1 ? 0.0001 : 0);
        const z = end === 0 ? -distance : length + distance;
        for (let ix = 0; ix <= nx; ix++)
          positions.push((ix / nx - 0.5) * width, rows[iz].heights[ix], z);
      }
      for (let iz = 0; iz < rows.length - 1; iz++)
        for (let ix = 0; ix < nx; ix++) {
          const a = iz * (nx + 1) + ix,
            c = a + nx + 1;
          if (end === 0) indices.push(a, a + 1, c, a + 1, c + 1, c);
          else indices.push(a, c, a + 1, a + 1, c, c + 1);
        }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      geometry.setAttribute(
        'uv',
        new T.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const ramp = new T.Mesh(geometry, deck);
      ramp.receiveShadow = ramp.castShadow = true;
      g.add(ramp);
    }
    for (const end of [0, 1] as const) {
      yield;
      const z = end === 0 ? 0 : length,
        bottom = b.foundations[end],
        height = Math.max(0.1, b.deckY - b.thickness - bottom);
      box(
        0,
        bottom + height / 2,
        z + ((z === 0 ? -1 : 1) * b.foundationLength) / 2,
        width,
        height,
        b.foundationLength,
        concrete,
      );
    }
    const parts = Math.ceil((before + length + after) / 6);
    for (let i = 0; i < parts; i++) {
      yield;
      const z1 = -before + ((before + length + after) * i) / parts,
        z2 = -before + ((before + length + after) * (i + 1)) / parts;
      for (const side of [-1, 1]) {
        const x = side * (b.width / 2 + BRIDGE_RAIL_WIDTH / 2),
          y1 = top(x, z1),
          y2 = top(x, z2);
        beam(new T.Vector3(x, y1, z1), new T.Vector3(x, y1 + 1.2, z1), BRIDGE_RAIL_WIDTH, steel);
        for (const rise of [0.35, 1.15])
          beam(
            new T.Vector3(x, y1 + rise, z1),
            new T.Vector3(x, y2 + rise, z2),
            BRIDGE_RAIL_WIDTH,
            steel,
          );
      }
    }
    // Open-top trusses leave tall road vehicles an unobstructed lane.
    const panels = Math.ceil(length / 8);
    for (let i = 0; i < panels; i++) {
      yield;
      const z1 = (length * i) / panels,
        z2 = (length * (i + 1)) / panels;
      for (const side of [-1, 1]) {
        const x = side * (b.width / 2 + BRIDGE_RAIL_WIDTH / 2);
        beam(
          new T.Vector3(x, b.deckY + 3, z1),
          new T.Vector3(x, b.deckY + 3, z2),
          BRIDGE_RAIL_WIDTH,
          steel,
        );
        beam(
          new T.Vector3(x, b.deckY, z1),
          new T.Vector3(x, b.deckY + 3, z1),
          BRIDGE_RAIL_WIDTH,
          steel,
        );
        beam(
          new T.Vector3(x, b.deckY + (i % 2 ? 3 : 0), z1),
          new T.Vector3(x, b.deckY + (i % 2 ? 0 : 3), z2),
          BRIDGE_RAIL_WIDTH,
          steel,
        );
      }
    }
  }
  yield;
  batch(g);
  const used = new Set(
    g.children
      .filter((o): o is T.Mesh => o instanceof T.Mesh)
      .flatMap((o) => (Array.isArray(o.material) ? o.material : [o.material])),
  );
  for (const m of [steel, deck, concrete, warning]) if (!used.has(m)) m.dispose();
  g.name = `Bridge ${b.id}`;
  g.userData.bridge = b.id;
  g.position.set(b.a.x, 0, b.a.z);
  g.rotation.y = Math.atan2(dx, dz);
  return g;
}
