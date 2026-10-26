// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// +Z points toward the bow. The mouth faces the vessel; the closed codend trails aft.
// See docs/ART.md for photographic and gear references. All dimensions are metres.
const RINGS = 25,
  SIDES = 32;
export const TRAWL_HAUL_SECONDS = 12;
const clamp = T.MathUtils.clamp;
const mix = T.MathUtils.lerp;
const smooth = (a: number, b: number, x: number) => T.MathUtils.smoothstep(x, a, b);
let twine: T.CanvasTexture | undefined;
function netTexture() {
  if (twine) return twine;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d')!;
  // Knotted diamond twine, with a dark braided edge rather than a flat wire grid.
  for (const [width, color] of [
    [7, '#284944'],
    [4, '#a4b39a'],
    [1, '#e3d8ae'],
  ] as const) {
    g.lineWidth = width;
    g.strokeStyle = color;
    g.beginPath();
    for (const x of [-128, 0, 128]) {
      g.moveTo(x, 0);
      g.lineTo(x + 128, 128);
      g.moveTo(x, 0);
      g.lineTo(x - 128, 128);
    }
    g.stroke();
  }
  g.fillStyle = '#c6bd92';
  for (const [x, y] of [
    [0, 0],
    [128, 0],
    [64, 64],
    [0, 128],
    [128, 128],
  ]) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  twine = new T.CanvasTexture(canvas);
  twine.colorSpace = T.SRGBColorSpace;
  twine.wrapS = twine.wrapT = T.RepeatWrapping;
  twine.anisotropy = 4;
  twine.userData.shared = true;
  return twine;
}

/** Shape of the complete net, including a rounded, tied catch bag rather than a cone apex. */
export function trawlSection(t: number, activity: number) {
  const load = clamp(activity, 0, 4) / 4;
  if (t < 0.68) {
    const narrow = Math.pow(1 - t / 0.68, 1.25);
    return { width: 0.68 + 4.32 * narrow, height: 0.58 + 0.77 * narrow };
  }
  const bag = Math.sin(((t - 0.68) / 0.32) * Math.PI);
  const tied = 1 - smooth(0.94, 1, t);
  return {
    width: (0.68 + bag * (0.2 + load * 0.6)) * tied,
    height: (0.58 + bag * (0.16 + load * 0.44)) * tied,
  };
}

/** A small complete otter-trawl rig. Textured panels replace per-strand geometry.
 * Uses only coarse public activity cues, never hidden catch quantities or RNG. */
export function createTrawlRig() {
  const group = new T.Group();
  group.name = 'Otter trawl, towing warps and catch';
  const gear = new T.Group();
  gear.name = 'Complete trawl net';
  gear.visible = false;
  group.add(gear);
  const positions = new Float32Array(RINGS * (SIDES + 1) * 3);
  const uv: number[] = [],
    indices: number[] = [];
  for (let j = 0; j < RINGS; j++)
    for (let i = 0; i <= SIDES; i++) {
      uv.push((i / SIDES) * 40, (j / (RINGS - 1)) * 32);
      if (j < RINGS - 1 && i < SIDES) {
        const k = j * (SIDES + 1) + i;
        indices.push(k, k + SIDES + 1, k + 1, k + 1, k + SIDES + 1, k + SIDES + 2);
      }
    }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    'position',
    new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const net = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({
      map: netTexture(),
      alphaTest: 0.22,
      side: T.DoubleSide,
      roughness: 0.94,
    }),
  );
  net.name = 'Open mouth, tapered belly and closed codend';
  net.frustumCulled = false;
  gear.add(net);

  // The two spreading boards and their steel shoes remain clearly separate from the net.
  const doorPanel = new T.BoxGeometry(0.16, 1.25, 1.9);
  const shoe = new T.BoxGeometry(0.23, 0.12, 2).translate(0, -0.61, 0);
  for (const [geo, color] of [
    [doorPanel, '#5d736c'],
    [shoe, '#b2aa87'],
  ] as const) {
    const tint = new T.Color(color),
      colors = [];
    for (let i = 0; i < geo.attributes.position.count; i++) colors.push(tint.r, tint.g, tint.b);
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  }
  const doors = new T.InstancedMesh(
    mergeGeometries([doorPanel, shoe]),
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.3 }),
    2,
  );
  doorPanel.dispose();
  shoe.dispose();
  doors.name = 'Port and starboard otter boards';
  gear.add(doors);
  const floats = new T.InstancedMesh(
    new T.SphereGeometry(0.17, 8, 5),
    new T.MeshStandardMaterial({ color: '#e49b4b', roughness: 0.7 }),
    9,
  );
  floats.name = 'Headline floats';
  const weights = new T.InstancedMesh(
    new T.SphereGeometry(0.13, 8, 5),
    new T.MeshStandardMaterial({ color: '#384a47', roughness: 0.9 }),
    11,
  );
  weights.name = 'Weighted footrope';
  gear.add(floats, weights);
  for (const inst of [doors, floats, weights]) {
    inst.frustumCulled = false;
    inst.instanceMatrix.setUsage(T.DynamicDrawUsage);
  }

  const linePositions = new Float32Array(4096 * 3);
  const lineGeo = new T.BufferGeometry();
  lineGeo.setAttribute(
    'position',
    new T.BufferAttribute(linePositions, 3).setUsage(T.DynamicDrawUsage),
  );
  const lines = new T.LineSegments(lineGeo, new T.LineBasicMaterial({ color: '#c9b78b' }));
  lines.name = 'Warps, bridles, headline and reinforcing seams';
  lines.frustumCulled = false;
  gear.add(lines);
  let lineCount = 0;
  function segment(a: T.Vector3, b: T.Vector3) {
    a.toArray(linePositions, lineCount * 3);
    b.toArray(linePositions, lineCount * 3 + 3);
    lineCount += 2;
  }
  const a = new T.Vector3(),
    b = new T.Vector3(),
    c = new T.Vector3(),
    d = new T.Vector3();
  function cable(from: T.Vector3, to: T.Vector3, sag: number) {
    a.copy(from);
    for (let i = 1; i <= 12; i++) {
      const t = i / 12;
      b.lerpVectors(from, to, t);
      b.y -= Math.sin(t * Math.PI) * sag;
      segment(a, b);
      a.copy(b);
    }
  }

  const fishBody = new T.SphereGeometry(1, 8, 4);
  fishBody.scale(0.12, 0.1, 0.35);
  const tail = new T.ConeGeometry(0.15, 0.23, 3);
  tail.rotateX(Math.PI / 2);
  tail.translate(0, 0, -0.39);
  const fishGeo = mergeGeometries([fishBody, tail]);
  fishBody.dispose();
  tail.dispose();
  const fish = new T.InstancedMesh(
    fishGeo,
    new T.MeshStandardMaterial({ color: '#d0d9cf', roughness: 0.34, metalness: 0.25 }),
    100,
  );
  fish.name = 'Catch glimpses, pouring fish and deck piles';
  fish.count = 0;
  fish.visible = false;
  fish.frustumCulled = false;
  fish.instanceMatrix.setUsage(T.DynamicDrawUsage);
  group.add(fish);
  const drops = new T.InstancedMesh(
    new T.SphereGeometry(1, 4, 3),
    new T.MeshBasicMaterial({
      color: '#a5c9cb',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
    24,
  );
  drops.name = 'Water draining from lifted codend';
  drops.visible = false;
  drops.frustumCulled = false;
  group.add(drops);
  const pose = new T.Object3D(),
    point = new T.Vector3();
  let payout = 0,
    previousTime: number | undefined,
    turnLag = 0,
    lastActivity = 0,
    haulActivity = 0,
    previousHaulAge = Infinity;
  const bagCenter = new T.Vector3();
  let lastHauling = false,
    lastDeckLoad = 0,
    priorDeckLoad = 0;
  return {
    group,
    animate(
      deployed: boolean,
      activity = 0,
      time = 0,
      haulAge = Infinity,
      deckLoad = 0,
      speed = 2.4,
      turn = 0,
      dt = 1 / 60,
    ) {
      const hauling = !deployed && haulAge >= 0 && haulAge < TRAWL_HAUL_SECONDS;
      const enteredHaul = hauling && (!lastHauling || haulAge < previousHaulAge);
      if (enteredHaul) {
        haulActivity = Math.max(lastActivity, activity);
        priorDeckLoad = lastDeckLoad;
      }
      lastDeckLoad = deckLoad;
      // A fresh connection may see an already-running haul, but must not invent an exact catch.
      if (enteredHaul && previousTime === undefined) haulActivity = 2;
      lastActivity = activity;
      lastHauling = hauling;
      previousHaulAge = haulAge;
      const elapsed = clamp(dt, 0, 0.1);
      if (previousTime === undefined) payout = deployed || activity > 0 || hauling ? 1 : 0;
      previousTime = time;
      const target = deployed || activity > 0 ? 1 : 0;
      if (!hauling) payout = T.MathUtils.damp(payout, target, 0.8, elapsed);
      else payout = 1 - smooth(9, 12, haulAge);
      if (!hauling && Math.abs(payout - target) < 0.001) payout = target;
      const visible = hauling || payout > 0.005;
      gear.visible = visible;
      const slack = deployed ? 1 - clamp(speed / 2.4, 0, 1) : 1;
      turnLag = T.MathUtils.damp(
        turnLag,
        clamp((-turn / Math.max(0.01, dt)) * 0.7, -0.3, 0.3),
        1.4,
        elapsed,
      );
      // Apply lag to the net only; warps still start exactly at the boat's fairleads.
      const lag = turnLag + Math.sin(time * 0.65) * 0.018;
      const retrieve = hauling ? smooth(0, 3.8, haulAge) : 1 - payout;
      const lift = hauling ? smooth(3, 6, haulAge) : 0;
      const empty = hauling ? smooth(6.3, 9, haulAge) : 0;
      const stow = hauling ? smooth(9, 12, haulAge) : 0;
      const load = hauling ? haulActivity * (1 - empty) : activity;
      function ringPoint(t: number, angle: number, dest: T.Vector3) {
        const section = trawlSection(t, load);
        const flutter = Math.sin(time * 1.5 - t * 7 + angle * 2) * 0.035 * Math.sin(Math.PI * t);
        const x = Math.cos(angle) * section.width * (1 + flutter);
        const y =
          -1.65 +
          Math.sin(angle) * section.height * (1 + flutter) -
          slack * 0.4 * Math.sin(Math.PI * t);
        // Extended wings curve forward at the sides of the mouth, not a rigid circular hoop.
        const z = -25 - t * 15 + Math.pow(Math.abs(Math.cos(angle)), 3) * 3 * Math.pow(1 - t, 5);
        const gather = 1 - retrieve * 0.88;
        dest.set(
          x * gather + Math.sin(lag) * (z + 10) * (1 - retrieve),
          y + flutter,
          mix(z, -11.8 - t * 3.2, retrieve),
        );
        if (lift > 0) {
          const radius =
            (0.08 + Math.sin(t * Math.PI) ** 2 * (0.55 + load * 0.13)) * (1 - smooth(0.96, 1, t)) +
            empty * smooth(0.92, 1, t) * 0.25;
          dest.lerp(
            point.set(Math.cos(angle) * radius, 4.85 - t * 2.5, -5.9 + Math.sin(angle) * radius),
            lift,
          );
        }
        // At rest the whole net is wound onto the deck drum instead of vanishing offshore.
        const wound = hauling ? stow : 1 - payout;
        dest.lerp(
          point.set(Math.cos(angle) * 0.55, 1.78 + Math.sin(angle) * 0.45, -4.57 - t * 0.5),
          wound,
        );
        return dest;
      }
      lineCount = 0;
      if (visible) {
        for (let j = 0; j < RINGS; j++)
          for (let i = 0; i <= SIDES; i++) {
            ringPoint(j / (RINGS - 1), (i / SIDES) * Math.PI * 2, c).toArray(
              positions,
              (j * (SIDES + 1) + i) * 3,
            );
          }
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        // Six load-bearing seams and both edges of the mouth, all attached to the deforming skin.
        for (let i = 0; i < 8; i++) {
          ringPoint(0, (i * Math.PI) / 4, a);
          for (let j = 1; j < RINGS; j++) {
            ringPoint(j / (RINGS - 1), (i * Math.PI) / 4, b);
            segment(a, b);
            a.copy(b);
          }
        }
        for (let i = 0; i < SIDES; i++) {
          ringPoint(0, (i / SIDES) * Math.PI * 2, a);
          ringPoint(0, ((i + 1) / SIDES) * Math.PI * 2, b);
          segment(a, b);
        }
        const boardsIn = hauling ? smooth(0, 3, haulAge) : 1 - payout;
        for (let i = 0; i < 2; i++) {
          const side = i ? 1 : -1;
          c.set(
            mix(side * 6.7, side * 3.35, boardsIn),
            mix(-1.45, 1.8, boardsIn),
            mix(-18, -7.6, boardsIn),
          );
          c.x += Math.sin(lag) * -8 * (1 - boardsIn);
          pose.position.copy(c);
          pose.rotation.set(0, side * 0.4, side * -0.1);
          pose.scale.setScalar(1);
          pose.updateMatrix();
          doors.setMatrixAt(i, pose.matrix);
          d.set(side * 1.2, 4.97, -6.09);
          cable(d, c, 0.25 + slack * 0.7);
          for (const angle of [
            side > 0 ? 0.35 : Math.PI - 0.35,
            side > 0 ? -0.35 : Math.PI + 0.35,
          ]) {
            ringPoint(0, angle, d);
            cable(c, d, 0.12 + slack * 0.25);
          }
        }
        for (const [inst, offset] of [
          [floats, 0],
          [weights, Math.PI],
        ] as const) {
          for (let i = 0; i < inst.count; i++) {
            ringPoint(0, offset + ((i + 0.5) / inst.count) * Math.PI, pose.position);
            pose.rotation.set(0, 0, 0);
            pose.scale.setScalar(1 - lift * 0.8);
            pose.updateMatrix();
            inst.setMatrixAt(i, pose.matrix);
          }
        }
        if (lift > 0) {
          c.set(0, 5.13, -5.98);
          ringPoint(0, 0, d);
          cable(c, d, 0.03);
        }
        for (const inst of [doors, floats, weights]) inst.instanceMatrix.needsUpdate = true;
        lineGeo.setDrawRange(0, lineCount);
        lineGeo.attributes.position.needsUpdate = true;
      }
      ringPoint(mix(0.83, 0.64, lift), 0, c);
      ringPoint(mix(0.83, 0.64, lift), Math.PI, d);
      bagCenter.copy(c).add(d).multiplyScalar(0.5);
      let count = 0;
      const cue = clamp(Math.round(hauling ? haulActivity : activity), 0, 4);
      const glimpses = [0, 3, 8, 16, 28][cue];
      for (let i = 0; i < glimpses && visible; i++) {
        const angle = i * 2.39996;
        const r = (0.2 + (i % 4) * 0.13) * (0.6 + cue * 0.1);
        pose.position
          .copy(bagCenter)
          .add(
            c.set(
              Math.sin(angle) * r * (1 - lift * 0.5),
              Math.cos(angle) * r * 0.7,
              Math.sin(i * 3.7) * mix(0.65, 0.18, lift),
            ),
          );
        const release = hauling ? smooth(6.3 + (i % 7) * 0.16, 7.2 + (i % 7) * 0.16, haulAge) : 0;
        if (release > 0) {
          pose.position.set(
            Math.sin(angle) * r,
            mix(2.4, 1.35, release) + Math.sin(release * Math.PI) * 0.12,
            -5.9 + Math.cos(angle) * r,
          );
        }
        if (hauling && haulAge > 8.5 + (i % 7) * 0.1) continue;
        pose.rotation.set(
          mix(Math.sin(time * 5 + i) * 0.2, Math.PI / 2, lift * (1 - release)),
          angle + Math.sin(time * 6 + i) * 0.3,
          Math.sin(time * 8 + i) * 0.3 + release * 1.5,
        );
        pose.scale.setScalar(1);
        pose.updateMatrix();
        fish.setMatrixAt(count++, pose.matrix);
      }
      // Hold fullness is deliberately coarse; these are visual piles, never a fish counter.
      const landed = Math.round(
        clamp(hauling ? mix(priorDeckLoad, deckLoad, smooth(6.3, 9.5, haulAge)) : deckLoad, 0, 1) *
          60,
      );
      for (let i = 0; i < landed; i++) {
        const side = i % 2 ? 1 : -1,
          row = Math.floor(i / 2);
        pose.position.set(
          side * (1.6 + (row % 3) * 0.3),
          1.72 + Math.floor(row / 9) * 0.18,
          -1.3 - (Math.floor(row / 3) % 3) * 0.65,
        );
        pose.rotation.set(0, i * 2.4, Math.PI / 2);
        pose.scale.setScalar(1.2);
        pose.updateMatrix();
        fish.setMatrixAt(count++, pose.matrix);
      }
      fish.count = count;
      fish.visible = count > 0;
      fish.instanceMatrix.needsUpdate = true;
      drops.visible = hauling && haulAge > 4 && haulAge < 9;
      if (drops.visible)
        for (let i = 0; i < drops.count; i++) {
          const fall = (time * 1.6 + i * 0.137) % 1;
          pose.position.set(
            Math.sin(i * 2.4) * 0.6,
            2.7 - fall * 1.4,
            -5.9 + Math.cos(i * 2.4) * 0.6,
          );
          pose.rotation.set(0, 0, 0);
          pose.scale.set(0.016, 0.055 + fall * 0.09, 0.016);
          pose.updateMatrix();
          drops.setMatrixAt(i, pose.matrix);
        }
      if (drops.visible) drops.instanceMatrix.needsUpdate = true;
      group.userData.phase = hauling
        ? haulAge < 3
          ? 'retrieving'
          : haulAge < 6
            ? 'lifting'
            : haulAge < 9
              ? 'emptying'
              : 'stowing'
        : deployed
          ? 'towing'
          : activity
            ? 'paused'
            : 'stowed';
      return hauling || (payout > 0.005 && payout < 0.995);
    },
  };
}
