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
