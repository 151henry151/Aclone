// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { tractor } from '../src/client/tractor.ts';
import { buildingModel } from '../src/client/buildings.ts';
import { makeBuilding } from '../src/shared/simulation.ts';
import { animalModel } from '../src/client/animal-model.ts';
function count(root: T.Object3D) {
  let triangles = 0,
    meshes = 0;
  root.traverse((o) => {
    if (o instanceof T.Mesh) {
      meshes++;
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    }
  });
  return { triangles, meshes };
}
const results: Record<string, unknown> = {};
for (const k of ['cows', 'sheep', 'pigs', 'chickens'] as const)
  results[k] = {
    triangles: animalModel(k).reduce((n, p) => n + p.geometry.attributes.position.count / 3, 0),
  };
const g = new T.Group();
tractor(g, '#aa3322', () => new T.Mesh(new T.PlaneGeometry(0, 0), new T.MeshBasicMaterial()));
results.tractor = count(g);
results.driver = count(g.userData.driver);
for (const k of ['home', 'dairy', 'henhouse', 'mill'])
  results[k] = count(buildingModel(makeBuilding('demo', k, 0, 0), (m) => m));
console.log(JSON.stringify(results, null, 2));
