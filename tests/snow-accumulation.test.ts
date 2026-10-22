// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { SnowAccumulation, showSnowAccumulation } from '../src/client/snow-accumulation';
import { snowDepthVisual } from '../src/client/materials';
import { createWorld } from '../src/shared/simulation';
import { creatorSchema } from '../src/shared/creator';
import { snowTrackHeight } from '../src/client/snow-surface';

function world() {
  const w = createWorld('snow-detail', 'Snow detail', 'owner');
  w.creator = creatorSchema.parse({ roads: false });
  w.roads = [{ a: { x: 0, z: -30 }, b: { x: 0, z: 30 }, width: 6 }];
  return w;
}
test('roof caps cover only upper faces and close the perimeter, not each triangle seam', () => {
  const w = world(),
    snow = new SnowAccumulation(w);
  const roof = new T.Mesh(new T.BoxGeometry(8, 0.2, 6), new T.MeshStandardMaterial());
  roof.position.set(20, 4, 10);
  roof.rotation.z = 0.2;
  roof.updateMatrixWorld();
  snow.cap(roof);
  const group = snow.finish(),
    mesh = group.children[0] as T.Mesh;
  const positions = mesh.geometry.getAttribute('position'),
    lift = mesh.geometry.getAttribute('snowLift');
  assert.equal(positions.count, 30, 'two top triangles plus eight perimeter skirt triangles');
  assert.equal(group.children.length, 1, 'one merged draw');
  const depths = new Set(Array.from(lift.array));
  assert.deepEqual([...depths].sort(), [0, 0.75]);
  assert.ok(Math.max(...Array.from({ length: positions.count }, (_, i) => positions.getY(i))) > 4);
  for (let i = 0; i < positions.count; i++) {
    assert.ok(lift.getX(i) * 0.11 <= 0.083, '11cm ground depth produces an 8cm roof layer');
  }
});
test('roadside banks never cover the driving lane and grow/melt continuously', () => {
  const w = world(),
    snow = new SnowAccumulation(w);
  snow.verges();
  const bare = snowTrackHeight({ ...w, climate: { snow: 0, snowDepth: 0, wetness: 0 } });
  assert.equal(snow.heightAt(0, 0, 0.25, bare(0, 0)), bare(0, 0));
  const a = snow.heightAt(4.4, 0, 0.04, bare(4.4, 0));
  const b = snow.heightAt(4.4, 0, 0.11, bare(4.4, 0));
  const c = snow.heightAt(4.4, 0, 0.25, bare(4.4, 0));
  assert.ok(a < b && b < c);
  assert.ok(b - bare(4.4, 0) < 0.2, 'ordinary snow does not create metre-high banks');
  assert.equal(snow.heightAt(4.4, 0, 0, bare(4.4, 0)), bare(4.4, 0));
  const mesh = snow.finish().children[0] as T.Mesh;
  const p = mesh.geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) assert.ok(Math.abs(p.getX(i)) > 3);
});
test('instanced trunks and fences collect snow at their transformed positions', () => {
  const w = world(),
    snow = new SnowAccumulation(w),
    root = new T.Group();
  const posts = new T.InstancedMesh(
    new T.BoxGeometry(0.15, 1.3, 0.15),
    new T.MeshStandardMaterial(),
    2,
  );
  Object.assign(posts.userData, { snowCap: 0.3, snowObstacle: 'post' });
  for (let i = 0; i < 2; i++)
    posts.setMatrixAt(i, new T.Matrix4().makeTranslation(20 + i * 5, 0.65, 5));
  root.add(posts);
  snow.collect(root);
  snow.collect(root);
  const bare = snowTrackHeight({ ...w, climate: { snow: 0, snowDepth: 0, wetness: 0 } });
  assert.ok(snow.heightAt(20, 5, 0.11, bare(20, 5)) > bare(20, 5) + 0.11);
  assert.ok(snow.heightAt(25, 5, 0.11, bare(25, 5)) > bare(25, 5) + 0.11);
  const mesh = snow.finish().children[0] as T.Mesh;
  assert.ok(
    mesh.geometry.getAttribute('position').count < 600,
    'collecting twice does not duplicate shells',
  );
});
test('bare ground hides snow geometry and full thaw removes it without changing other scenery', () => {
  snowDepthVisual.value = 0;
  const root = new T.Group(),
    snow = new SnowAccumulation(world()),
    other = new T.Group();
  snow.mound(20, 0, 1);
  root.add(snow.finish(), other);
  assert.equal(snow.group.visible, false);
  showSnowAccumulation(root, true);
  assert.equal(snow.group.visible, true);
  showSnowAccumulation(root, false);
  assert.equal(snow.group.visible, false);
  assert.equal(other.visible, true);
});

// Check the rendered triangle interiors, not heightAt's max-with-terrain clamp.
test('ground drifts conform to terrain triangles without intersecting the snowpack', () => {
  for (const mapSize of [500, 4000]) {
    const w = world();
    w.settings.mapSize = mapSize;
    w.terrain.push({ x: 5, z: 0, radius: 13, height: 3 });
    const snow = new SnowAccumulation(w);
    snow.verges();
    const mesh = snow.finish().children[0] as T.Mesh;
    const pos = mesh.geometry.getAttribute('position'),
      lift = mesh.geometry.getAttribute('snowLift');
    const index = mesh.geometry.index!;
    for (const depth of [0.01, 0.04, 0.11, 0.25]) {
      const surface = snowTrackHeight({ ...w, climate: { snow: 1, snowDepth: depth, wetness: 0 } });
      for (let i = 0; i < index.count; i += 3) {
        const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
        for (const weights of [
          [1 / 3, 1 / 3, 1 / 3],
          [0.8, 0.1, 0.1],
          [0.1, 0.8, 0.1],
          [0.1, 0.1, 0.8],
        ]) {
          const sum = (f: (id: number) => number) =>
            ids.reduce((n, id, j) => n + f(id) * weights[j]!, 0);
          const x = sum((id) => pos.getX(id)),
            z = sum((id) => pos.getZ(id));
          const y = sum((id) => pos.getY(id) + depth * lift.getX(id));
          assert.ok(
            y > surface(x, z) + 0.001,
            `bank intersects terrain at ${x},${z}, depth ${depth}`,
          );
        }
      }
    }
  }
});
