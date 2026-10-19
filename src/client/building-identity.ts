// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Building } from '../shared/types';
import type { BuildingPlan } from '../shared/building-shapes';
import { finishSurface } from './building-finishes';
import { buildingBadge } from './building-badges';
import { buildingFacade, tradeSymbols, roofHeightAt } from '../shared/building-facade';

/** Recognisable trade equipment with low-sided vessels, textured stacks and flat painted signs. */
export function addBuildingIdentity(root: T.Group, b: Building, plan: BuildingPlan) {
  const group = new T.Group();
  group.userData.buildingIdentity = b.kind;
  root.add(group);
  let host = group;
  const mat = (color: string, metal = false) =>
    new T.MeshStandardMaterial({
      color,
      roughness: metal ? 0.55 : 0.85,
      metalness: metal ? 0.4 : 0,
    });
  const mesh = (
    g: T.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    metal = false,
  ) => {
    const o = new T.Mesh(g, mat(color, metal));
    o.position.set(x, y, z);
    host.add(o);
    return o;
  };
  const box = (w: number, h: number, d: number, color: string, x: number, y: number, z: number) =>
    mesh(new T.BoxGeometry(w, h, d), color, x, y, z);
  const cyl = (
    r: number,
    h: number,
    color: string,
    x: number,
    y: number,
    z: number,
    metal = false,
  ) => mesh(new T.CylinderGeometry(r, r, h, 12), color, x, y, z, metal);
  const cone = (r: number, h: number, color: string, x: number, y: number, z: number) =>
    mesh(new T.ConeGeometry(r, h, 12), color, x, y, z, true);
  const pipe = (a: number[], b: number[], r = 0.08, color = '#a7b5b0') => {
    const from = new T.Vector3(...(a as [number, number, number])),
      to = new T.Vector3(...(b as [number, number, number]));
    const o = cyl(r, from.distanceTo(to), color, 0, 0, 0, true);
    o.position.copy(from).add(to).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), to.sub(from).normalize());
    return o;
  };
  const panel = (kind: string, x: number, y: number, z: number, w = 1.2, h = 1.2, angle = 0) => {
    const o = new T.Mesh(
      new T.PlaneGeometry(w, h),
      new T.MeshStandardMaterial({ map: buildingBadge(kind), roughness: 0.85 }),
    );
    o.position.set(x, y, z);
    o.rotation.y = angle;
    host.add(o);
    return o;
  };
  const barrel = (x: number, z: number, y = 0.55, copper = false) => {
    const color = copper ? '#a66b43' : '#8a6544';
    cyl(0.46, 0.95, color, x, y, z, copper);
    for (const dy of [-0.3, 0.3]) cyl(0.477, 0.055, '#4e5b59', x, y + dy, z, true);
  };
  const tank = (x: number, z: number, r: number, h: number, color = '#a8bab7') => {
    cyl(r, h, color, x, h / 2 + 0.3, z, true);
    cone(r, 0.4, color, x, h + 0.5, z);
    for (const dx of [-r * 0.65, r * 0.65]) box(0.15, 0.6, 0.15, '#596968', x + dx, 0.3, z);
  };
  const crate = (x: number, z: number, y = 0.45, w = 1) => {
    const o = box(w, 0.85, 0.85, '#ffffff', x, y, z);
    finishSurface(o, 'boards', '#9a8057');
    for (const dx of [-w * 0.4, w * 0.4]) box(0.07, 0.85, 0.9, '#5d6556', x + dx, y, z);
  };
  const main = plan.volumes[0];
  const front = main.z + main.depth / 2;
  const facade = buildingFacade(b.kind, plan);
  if (facade.sign) {
    const s = facade.sign;
    const plaque = panel(tradeSymbols[b.kind], s.x, s.y, s.z, s.width, s.height);
    plaque.userData.tradeSign = true;
  }
  if (b.kind === 'factory')
    for (const dx of [-1.4, 1.4]) {
      const x = main.x + dx;
      const heights = [-0.9, 0.9].flatMap((a) =>
        [-0.7, 0.7].map((c) => roofHeightAt(main, x + a, main.z + c)),
      );
      const y = Math.max(...heights) + 0.08;
      const bottom = Math.min(...heights) - 0.12;
      box(1.9, y - bottom, 1.5, '#657572', x, (y + bottom) / 2, main.z);
      box(1.8, 0.7, 1.4, '#839b9b', main.x + dx, y + 0.35, main.z);
      for (const dz of [-0.35, 0, 0.35])
        box(1.5, 0.035, 0.06, '#394e53', main.x + dx, y + 0.72, main.z + dz);
    }
  if (b.kind === 'henhouse') {
    const coop = plan.volumes.reduce(
      (a, v) => (v.x + v.width / 2 > a.x + a.width / 2 ? v : a),
      main,
    );
    for (const dx of [-0.65, 0.65]) {
      box(0.8, 0.65, 0.5, '#a28a58', coop.x + coop.width / 2 + 0.2, 0.8, coop.z + dx);
      box(0.03, 0.4, 0.5, '#433e32', coop.x + coop.width / 2 + 0.46, 0.8, coop.z + dx);
    }
  }
  for (const f of plan.features ?? []) {
    host = new T.Group();
    host.position.set(f.x, f.y, f.z);
    host.userData.feature = f.kind;
    group.add(host);
    if (f.kind === 'clocktower') {
      const lift = main.rise;
      // A continuous shaft penetrates the roof; a flashing collar closes the join.
      finishSurface(
        box(1.7, lift + 2.4, 1.7, '#ffffff', 0, (lift + 2.4) / 2, 0),
        'limestone',
        '#d8d5c1',
      );
      box(1.95, 0.16, 1.95, '#758079', 0, lift + 0.08, 0);
      box(1.9, 0.14, 1.9, '#d0cbb7', 0, lift + 2.36, 0);
      for (const side of [-1, 1]) {
        panel('clock', 0, lift + 1.55, side * 0.86, 1.25, 1.25, side === 1 ? 0 : Math.PI);
        panel('clock', side * 0.86, lift + 1.55, 0, 1.25, 1.25, (side * Math.PI) / 2);
      }
      const cap = mesh(new T.ConeGeometry(1.35, 1.1, 4), '#46665e', 0, lift + 2.95, 0);
      cap.rotation.y = Math.PI / 4;
      pipe([0, lift + 3.5, 0], [0, lift + 4.25, 0], 0.035);
      box(0.65, 0.35, 0.025, '#bb9b4b', 0.32, lift + 4.02, 0);
      continue;
    }
    box(f.width, 0.12, f.depth, '#9b9d90', 0, 0.06, 0);
    switch (b.kind) {
      case 'refinery': {
        // Fractionation columns, pipe rack, access platform and low storage vessel.
        for (const [x, z, h, r] of [
          [-2, -1, 9.6, 0.7],
          [0.2, -1.6, 7.6, 0.65],
          [2, -1, 5.2, 0.8],
        ]) {
          tank(x, z, r, h, '#a8b7b5');
          for (let y = 1.2; y < h; y += 2) cyl(r + 0.04, 0.09, '#5f777c', x, y, z, true);
          for (const dx of [-0.22, 0.22])
            box(0.045, h, 0.045, '#42585b', x + dx, h / 2, z + r + 0.1);
          for (let y = 0.4; y < h; y += 0.5) box(0.48, 0.035, 0.04, '#647d7b', x, y, z + r + 0.12);
        }
        tank(1.4, 1.7, 1.15, 2.4, '#bac1b8');
        for (const z of [0.1, 0.55]) pipe([-3, 3, z], [3, 3, z], 0.12);
        for (const x of [-3, 3]) {
          pipe([x, 0.15, 0.3], [x, 3.3, 0.3], 0.1, '#556568');
        }
        box(3.6, 0.16, 1, '#5b7472', -1, 4.6, 0);
        pipe([-2.7, 5.4, 0.45], [0.7, 5.4, 0.45], 0.035, '#c4a14f');
        break;
      }
      case 'brewery': {
        // Copper brewhouse kettles, steam necks and a cask rack.
        for (const x of [-2, 0]) {
          tank(x, -0.6, 0.8, 2.8, '#b1764e');
          mesh(
            new T.SphereGeometry(0.8, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
            '#bd8455',
            x,
            3.1,
            -0.6,
            true,
          );
          pipe([x, 3.5, -0.6], [x, 4.5, -0.6], 0.17, '#b1764e');
          pipe([x, 4.5, -0.6], [x + 0.65, 4.5, -0.6], 0.17, '#b1764e');
        }
        for (const x of [1.4, 2.5]) for (const z of [-1, 0.2, 1.4]) barrel(x, z);
        pipe([-2, 0.65, 1], [0, 0.65, 1], 0.1, '#b1764e');
        panel('beer', -1, 2.3, 0.23, 1.2, 1.2);
        break;
      }
      case 'mine':
      case 'rareMine': {
        for (const x of [-1.4, 1.4])
          for (const z of [-1.5, 1.5])
            pipe([x * 1.25, 0.2, z], [x * 0.6, 8, z * 0.65], 0.13, '#566564');
        for (const z of [-1, 1]) {
          pipe([-1.1, 3, z], [0.9, 7.7, z], 0.08, '#7c8b80');
          pipe([1.1, 3, z], [-0.9, 7.7, z], 0.08, '#7c8b80');
        }
        box(3, 0.2, 2.5, '#727d72', 0, 7.7, 0);
        mesh(new T.TorusGeometry(0.8, 0.1, 5, 16), '#3e4e50', 0, 8.5, 0);
        pipe([-0.6, 8.5, 0], [-0.6, 0.4, 0], 0.025, '#343e3b');
        pipe([0.6, 8.5, 0], [0.6, 0.4, 0], 0.025, '#343e3b');
        for (const x of [-0.62, 0.62]) box(0.08, 0.08, 6, '#667c7a', x, 0.16, 0);
        box(1.5, 0.8, 1.7, '#68756b', 0, 0.85, 2);
        for (const x of [-0.8, 0.8])
          for (const z of [1.4, 2.6]) {
            const wheel = cyl(0.25, 0.1, '#3e4643', x, 0.36, z);
            wheel.rotation.z = Math.PI / 2;
          }
        for (const dx of [-0.35, 0.35])
          mesh(
            new T.IcosahedronGeometry(0.38, 0),
            b.kind === 'mine' ? '#79523c' : '#878070',
            dx,
            1.3,
            2,
          );
        break;
      }
      case 'concreteWorks':
      case 'feedmill':
      case 'farm':
      case 'dairy':
      case 'creamery': {
        const h = f.height - 1,
          r = Math.min(0.8, f.width * 0.19);
        for (const x of [-r - 0.1, r + 0.1]) {
          tank(x, 0, r, h, b.kind === 'farm' ? '#a8a998' : '#a7bfbc');
          cone(r, 0.6, '#a5b8b0', x, 0.5, 0).rotation.z = Math.PI;
        }
        pipe([0, h * 0.6, 0], [f.width * 0.4, 1, f.depth * 0.35], 0.14);
        break;
      }
      case 'forge':
      case 'brickworks': {
        const oven = box(2.4, 2.4, 2.8, '#ffffff', -0.5, 1.3, 0);
        finishSurface(oven, 'brick', '#a99078');
        box(1.3, 1.2, 0.03, '#302824', -0.5, 0.8, 1.43);
        box(0.95, 0.35, 0.04, '#c07b37', -0.5, 0.4, 1.46);
        finishSurface(
          cyl(0.42, f.height - 1, '#ffffff', -1, (f.height - 1) / 2, -1),
          'brick',
          '#b39683',
        );
        for (let i = 0; i < 3; i++)
          finishSurface(
            box(1.2, 0.45, 0.85, '#ffffff', 1.3, 0.35 + i * 0.46, 0.6),
            'brick',
            '#b38a65',
          );
        break;
      }
      case 'bakery': {
        finishSurface(box(2.1, 1.2, 2, '#ffffff', -0.5, 0.7, 0), 'brick', '#b98e68');
        const dome = mesh(
          new T.SphereGeometry(1.05, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          '#bca37c',
          -0.5,
          1.3,
          0,
        );
        dome.scale.z = 0.95;
        box(0.85, 0.7, 0.06, '#3e3026', -0.5, 0.95, 1.03);
        cyl(0.2, 2.7, '#9b8f7b', -0.8, 1.45, -0.7);
        panel('bread', 1.1, 0.6, 1.031, 0.8, 0.55);
        crate(1.1, 0.6);
        break;
      }
      case 'sawmill':
      case 'carpenter':
      case 'workshop': {
        box(2.3, 0.18, 1.3, '#8e7756', 0.3, 1.05, 0.3);
        for (const x of [-0.6, 1.2]) box(0.12, 1, 0.9, '#65756e', x, 0.5, 0.3);
        if (b.kind === 'sawmill') {
          mesh(
            new T.CylinderGeometry(0.65, 0.65, 0.06, 20),
            '#a8b9b4',
            0.2,
            1.15,
            0.3,
            true,
          ).rotation.x = Math.PI / 2;
          for (let i = 0; i < 3; i++)
            cyl(0.28, 3, '#886d46', -1.8, 0.45 + i * 0.55, 0).rotation.x = Math.PI / 2;
        } else if (b.kind === 'carpenter')
          for (let i = 0; i < 5; i++) box(0.15, 1.8, 0.6, '#a28d64', -1.2 + i * 0.17, 1, -0.8);
        else {
          box(0.5, 0.35, 0.4, '#426b74', 0.3, 1.3, 0.3);
          box(1.3, 0.75, 0.08, '#706247', 0, 2, -1);
          for (const x of [-0.5, 0.5]) box(0.08, 2, 0.08, '#706247', x, 1.1, -1);
          panel('tools', 0, 2, -0.954, 1.2, 0.65);
        }
        break;
      }
      case 'mason':
      case 'quarry': {
        for (let i = 0; i < 4; i++)
          finishSurface(
            box(
              1,
              0.65,
              1,
              '#ffffff',
              -1.5 + (i % 2) * 1.15,
              0.45 + Math.floor(i / 2) * 0.67,
              -0.5,
            ),
            'limestone',
            '#b8b6a3',
          );
        if (b.kind === 'quarry') {
          cone(1.2, 1.5, '#99988b', 1.3, 0.85, 0);
          box(1.3, 1, 0.9, '#6b7e76', 0.2, 2.2, -0.7);
          for (const x of [-0.3, 0.7])
            for (const z of [-1.05, -0.35]) box(0.1, 1.7, 0.1, '#4c605d', x, 0.95, z);
          pipe([0.2, 2.3, -0.7], [1.3, 1, 0], 0.25);
        } else {
          box(1.4, 0.2, 0.9, '#727d72', 1.2, 1.2, 0.2);
          pipe([0.7, 0.2, 0.2], [0.7, 1.2, 0.2], 0.08);
          pipe([1.6, 0.2, 0.2], [1.6, 1.2, 0.2], 0.08);
        }
        break;
      }
      case 'winery': {
        for (const x of [-1.4, 1.4]) for (const z of [-1, 0.25]) barrel(x, z);
        for (const x of [-0.6, 0.6]) box(0.15, 2.7, 0.15, '#706247', x, 1.4, 0.3);
        box(1.4, 0.2, 0.5, '#706247', 0, 2.7, 0.3);
        cyl(0.06, 1.6, '#68716b', 0, 1.8, 0.3);
        cyl(0.55, 0.75, '#8c6d45', 0, 0.6, 0.3);
        break;
      }
      case 'roastery': {
        const drum = cyl(0.7, 1.6, '#6b7e79', 0, 1.3, 0, true);
        drum.rotation.x = Math.PI / 2;
        box(1.4, 0.5, 1.5, '#65776a', 0, 0.4, 0);
        cone(0.5, 0.65, '#a3ada4', 0, 2.1, 0);
        pipe([0, 1.7, -0.5], [0, 2.9, -0.5], 0.15);
        crate(-1.3, 0.5);
        panel('coffee', 0, 1.3, 0.82, 0.75, 0.75);
        break;
      }
      case 'garage': {
        box(0.7, 1.5, 0.55, '#9f5740', -0.9, 0.85, 0.3);
        panel('water', -0.9, 1.2, 0.59, 0.45, 0.3);
        pipe([-0.5, 1.3, 0.4], [0, 0.3, 0.4], 0.04, '#343f3b');
        for (let i = 0; i < 3; i++)
          mesh(
            new T.TorusGeometry(0.43, 0.17, 5, 12),
            '#37413d',
            0.9,
            0.3 + i * 0.34,
            0.3,
          ).rotation.x = Math.PI / 2;
        break;
      }
      case 'shipyard': {
        const shape = new T.Shape();
        shape.moveTo(-1.2, -2.4);
        shape.lineTo(1.2, -2.4);
        shape.lineTo(1, 1.6);
        shape.lineTo(0, 3);
        shape.lineTo(-1, 1.6);
        shape.closePath();
        const hull = new T.ExtrudeGeometry(shape, { depth: 0.7, bevelEnabled: false });
        hull.rotateX(Math.PI / 2);
        mesh(hull, '#6b8583', 0, 1.9, 0);
        for (const z of [-1.6, 1.4]) box(2.6, 0.2, 0.5, '#8f7955', 0, 0.9, z);
        pipe([0, 1.9, -0.4], [0, 3.3, -0.4], 0.055);
        break;
      }
      case 'warehouse':
      case 'market': {
        for (let i = 0; i < 5; i++)
          crate(-1.4 + (i % 3) * 1.2, -0.6 + Math.floor(i / 3) * 1.2, 0.55);
        if (b.kind === 'market')
          for (let i = 0; i < 4; i++)
            mesh(
              new T.IcosahedronGeometry(0.17, 0),
              i % 2 ? '#b89b41' : '#8e5639',
              -1.7 + i * 0.22,
              1.1,
              -0.5,
            );
        break;
      }
      case 'composter':
      case 'sheepfold':
      case 'piggery': {
        for (const x of [-1.1, 1.1]) {
          box(1.6, 0.6, 1.8, '#9e8e6c', x, 0.4, 0);
          if (b.kind === 'composter') cone(0.75, 0.7, '#69543a', x, 0.8, 0);
          else if (b.kind === 'sheepfold') box(1.4, 0.55, 1.4, '#d0cbb0', x, 1, 0);
          else box(1.4, 0.04, 1.6, '#a89a62', x, 0.71, 0);
        }
        break;
      }
      case 'dairyKitchen':
      case 'teaHouse':
      case 'kitchen': {
        for (const x of [-0.9, 0.9]) {
          cyl(0.55, 0.1, '#a28a62', x, 1, 0);
          cyl(0.08, 0.9, '#65796d', x, 0.5, 0);
          box(0.45, 0.12, 0.45, '#897751', x, 0.48, 0.85);
        }
        if (b.kind === 'teaHouse') panel('tea', 0, 1.9, -0.8, 1, 0.8);
        if (b.kind === 'kitchen') {
          box(0.9, 1.4, 0.6, '#7c8f89', 0, 0.8, -0.7);
          cyl(0.12, 2.5, '#939e98', 0, 1.3, -0.7);
        }
        break;
      }
    }
  }
}
