// SPDX-License-Identifier: GPL-3.0-or-later
// Original metre-scale livestock. Smooth anatomy, coloured coat geometry, seven rig parts.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { AnimalKind } from '../shared/livestock';
export interface AnimalPart {
  geometry: T.BufferGeometry;
  pivot: T.Vector3;
  motion: 'body' | 'head' | 'leg' | 'tail';
  phase: number;
}
export function animalModel(kind: AnimalKind): AnimalPart[] {
  const cow = kind === 'cows',
    sheep = kind === 'sheep',
    pig = kind === 'pigs',
    bird = kind === 'chickens';
  const coat = cow ? '#eee9d9' : sheep ? '#cfc8b1' : pig ? '#d9a89b' : '#95612e';
  const skin = sheep ? '#493f33' : pig ? '#ca948a' : cow ? '#e4c5b6' : '#d6a04d';
  const hoof = '#302c27',
    black = '#171b19';
  const parts: AnimalPart[] = [];
  let pieces: T.BufferGeometry[] = [];
  function add(g: T.BufferGeometry, color: string, patch = false, wool = false) {
    const pos = g.getAttribute('position'),
      colors = [],
      coatData = [],
      base = new T.Color(color),
      dark = new T.Color('#272b26');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      const n =
        Math.sin(x * 6 + Math.sin(z * 4)) * Math.cos(y * 5 - z * 3) +
        0.35 * Math.sin(z * 10 + x * 3);
      const c = base.clone();
      coatData.push(
        x,
        y,
        z,
        patch
          ? 1
          : wool
            ? 2
            : pig && color === coat
              ? 3
              : bird && ![skin, black].includes(color)
                ? 4
                : 0,
      );
      // Dense short fleece follows the underlying body instead of separate leaf-like balls.
      if (wool) {
        const ripple = 1 + 0.007 * Math.sin(x * 65 + z * 31) * Math.sin(y * 51 - z * 27);
        pos.setXYZ(i, x * ripple, y * ripple, z * ripple);
        c.multiplyScalar(0.93 + 0.06 * Math.sin(x * 43 + z * 57) * Math.cos(y * 53));
      } else c.multiplyScalar(0.97 + 0.025 * Math.sin(x * 31 + y * 37 + z * 29));
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('coatData', new T.Float32BufferAttribute(coatData, 4));
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    if (wool) g.computeVertexNormals();
    pieces.push(g.index ? g.toNonIndexed() : g);
    if (g.index) g.dispose();
  }
  function oval(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color = coat,
    patch = false,
    wool = false,
    rx = 0,
    rz = 0,
  ) {
    const g = new T.SphereGeometry(1, wool ? 36 : 20, wool ? 24 : 12);
    g.scale(sx, sy, sz);
    g.rotateX(rx);
    g.rotateZ(rz);
    g.translate(x, y, z);
    add(g, color, patch, wool);
  }
  function bone(a: number[], b: number[], r1: number, r2: number, color: string) {
    const from = new T.Vector3(...a),
      to = new T.Vector3(...b),
      g = new T.CylinderGeometry(r2, r1, from.distanceTo(to), 10);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        to.clone().sub(from).normalize(),
      ),
    );
    g.translate(...from.add(to).multiplyScalar(0.5).toArray());
    add(g, color);
  }
  function curve(points: number[][], r: number, color: string) {
    add(
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        16,
        r,
        6,
        false,
      ),
      color,
    );
  }
  function finish(motion: AnimalPart['motion'], pivot: number[], phase = 0) {
    const geometry = mergeGeometries(pieces)!;
    for (const g of pieces) g.dispose();
    pieces = [];
    geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
    geometry.computeBoundingSphere();
    parts.push({ geometry, pivot: new T.Vector3(...pivot), motion, phase });
  }
  const h = cow ? 1.13 : sheep ? 0.73 : pig ? 0.56 : 0.34;
  const length = cow ? 1.04 : sheep ? 0.69 : pig ? 0.8 : 0.26;
  const width = cow ? 0.39 : sheep ? 0.29 : pig ? 0.33 : 0.17;
  oval(0, h, 0, width, cow ? 0.47 : sheep ? 0.34 : pig ? 0.35 : 0.23, length, coat, cow, sheep);
  if (!bird) {
    if (cow) {
      oval(0, 0.63, -0.46, 0.22, 0.17, 0.29, '#ceaaa1');
      for (const x of [-0.1, 0.1])
        for (const z of [-0.32, -0.56])
          bone([x, 0.55, z], [x, 0.43, z + 0.01], 0.027, 0.018, '#b68c84');
      // Shoulder ridge and dewlap give cattle a long, angular profile.
      oval(0, 1.24, 0.63, 0.29, 0.38, 0.3, coat, true);
      oval(0, 1.05, 0.85, 0.15, 0.24, 0.28, coat, false, false, -0.5);
    }
  } else {
    // Overlapping flight feathers and swept tail, not a cartoon spherical bird.
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++)
        oval(
          side * (0.15 + i * 0.002),
          0.33 - i * 0.012,
          -0.02 - i * 0.027,
          0.055,
          0.08,
          0.19 - i * 0.008,
          i % 2 ? '#805029' : '#b18343',
          false,
          false,
          -0.22,
          side * 0.18,
        );
    for (let i = 0; i < 5; i++)
      oval(
        (i - 2) * 0.032,
        0.48,
        -0.27,
        0.036,
        0.19,
        0.055,
        i % 2 ? '#423d32' : '#685440',
        false,
        false,
        -0.58,
        (i - 2) * 0.13,
      );
    oval(0, 0.52, 0.13, 0.1, 0.2, 0.1, '#bb8b43', false, false, -0.27);
  }
  finish('body', [0, h, 0]);
  const headY = cow ? 1.34 : sheep ? 0.87 : pig ? 0.62 : 0.65;
  const headZ = cow ? 1.08 : sheep ? 0.72 : pig ? 0.81 : 0.22;
  oval(
    0,
    headY,
    headZ,
    cow ? 0.2 : sheep ? 0.125 : pig ? 0.23 : 0.077,
    cow ? 0.3 : sheep ? 0.21 : pig ? 0.23 : 0.1,
    cow ? 0.35 : sheep ? 0.24 : pig ? 0.28 : 0.095,
    cow ? coat : sheep ? '#50483b' : pig ? coat : '#b18443',
    cow,
    false,
    cow ? 0.35 : 0,
  );
  if (bird) {
    const beak = new T.ConeGeometry(0.039, 0.09, 8);
    beak.rotateX(Math.PI / 2);
    beak.translate(0, 0.64, 0.338);
    add(beak, '#d4ad62');
    for (let i = 0; i < 4; i++)
      oval(0, 0.749 + Math.sin(i) * 0.018, 0.17 + i * 0.033, 0.008, 0.026, 0.024, '#9c3025');
    oval(0, 0.558, 0.273, 0.029, 0.045, 0.022, '#b53b2a');
  } else {
    oval(
      0,
      headY - (cow ? 0.19 : sheep ? 0.09 : 0.065),
      headZ + (cow ? 0.27 : sheep ? 0.17 : 0.23),
      cow ? 0.18 : sheep ? 0.1 : 0.16,
      cow ? 0.12 : sheep ? 0.1 : 0.12,
      cow ? 0.14 : sheep ? 0.09 : 0.06,
      skin,
    );
    for (const side of [-1, 1]) {
      // Small nostrils and mouth line.
      oval(
        side * (cow ? 0.087 : pig ? 0.066 : 0.047),
        headY - (cow ? 0.18 : sheep ? 0.08 : 0.045),
        headZ + (cow ? 0.382 : sheep ? 0.247 : 0.284),
        0.018,
        0.012,
        0.008,
        '#63514b',
      );
      const earX = cow ? 0.27 : sheep ? 0.17 : 0.22;
      oval(
        side * earX,
        headY + 0.16,
        headZ - 0.06,
        cow ? 0.17 : sheep ? 0.12 : 0.1,
        0.045,
        pig ? 0.17 : 0.073,
        coat,
        false,
        false,
        pig ? -0.5 : 0,
        side * (pig ? 0.7 : 0.2),
      );
      oval(
        side * earX,
        headY + 0.19,
        headZ - 0.045,
        cow ? 0.12 : sheep ? 0.08 : 0.065,
        0.013,
        pig ? 0.11 : 0.04,
        skin,
        false,
        false,
        pig ? -0.5 : 0,
        side * (pig ? 0.7 : 0.2),
      );
      if (cow)
        curve(
          [
            [side * 0.13, 1.57, 0.96],
            [side * 0.22, 1.64, 0.93],
            [side * 0.28, 1.72, 0.94],
          ],
          0.026,
          '#b9ad8f',
        );
    }
    curve(
      [
        [-0.08, headY - (cow ? 0.27 : 0.12), headZ + 0.25],
        [0, headY - (cow ? 0.285 : 0.13), headZ + (cow ? 0.37 : 0.28)],
        [0.08, headY - (cow ? 0.27 : 0.12), headZ + 0.25],
      ],
      0.007,
      '#79665a',
    );
  }
  for (const side of [-1, 1]) {
    const eyeX = cow ? 0.178 : sheep ? 0.112 : pig ? 0.188 : 0.065;
    oval(
      side * eyeX,
      headY + 0.045,
      headZ + (bird ? 0.024 : 0.08),
      bird ? 0.009 : 0.024,
      bird ? 0.01 : 0.019,
      bird ? 0.012 : 0.03,
      black,
    );
    oval(
      side * (eyeX + 0.005),
      headY + 0.049,
      headZ + (bird ? 0.03 : 0.09),
      0.003,
      0.003,
      0.004,
      '#d9d2b9',
    );
  }
  finish('head', [0, headY - 0.11, headZ - 0.18]);
  const zs = bird ? [0.005] : [-length * 0.66, length * 0.66];
  for (const z of zs)
    for (const side of [-1, 1]) {
      const x = side * width * 0.7,
        top = bird ? 0.24 : h - 0.06,
        joint = bird ? 0.105 : cow ? 0.47 : sheep ? 0.28 : 0.21;
      if (!bird)
        oval(
          x,
          top - 0.06,
          z,
          cow ? 0.12 : 0.085,
          cow ? 0.25 : 0.16,
          cow ? 0.16 : 0.12,
          sheep ? skin : coat,
          cow,
        );
      bone(
        [x, top, z],
        [x, joint, z - (z < 0 ? 0.09 : 0)],
        bird ? 0.024 : cow ? 0.09 : 0.05,
        bird ? 0.016 : cow ? 0.052 : 0.04,
        bird || sheep ? skin : coat,
      );
      oval(
        x,
        joint,
        z - (z < 0 ? 0.09 : 0),
        bird ? 0.018 : cow ? 0.047 : 0.033,
        bird ? 0.027 : cow ? 0.06 : 0.045,
        bird ? 0.018 : cow ? 0.045 : 0.033,
        bird || sheep ? skin : coat,
      );
      bone(
        [x, joint, z - (z < 0 ? 0.09 : 0)],
        [x, 0.085, z + 0.02],
        bird ? 0.016 : cow ? 0.045 : 0.03,
        bird ? 0.012 : cow ? 0.04 : 0.03,
        bird || sheep ? skin : coat,
      );
      if (bird) {
        for (let t = -1; t <= 1; t++)
          bone([x, 0.045, z], [x + t * 0.038, 0.018, z + 0.08], 0.01, 0.004, skin);
        bone([x, 0.04, z], [x, 0.02, z - 0.048], 0.009, 0.004, skin);
      } else
        for (const toe of [-1, 1])
          oval(
            x + toe * (cow ? 0.032 : 0.021),
            0.063,
            z + 0.048,
            cow ? 0.03 : 0.021,
            0.046,
            cow ? 0.088 : 0.054,
            hoof,
          );
      finish('leg', [x, top, z], side * (z < 0 ? -1 : 1));
    }
  if (pig) {
    curve(
      Array.from({ length: 20 }, (_, i) => [
        Math.sin(i * 0.55) * 0.064,
        0.7 + Math.cos(i * 0.55) * 0.065,
        -0.78 - i * 0.009,
      ]),
      0.017,
      skin,
    );
  } else if (!bird) {
    const y = h + 0.13;
    curve(
      [
        [0, y, -length * 0.85],
        [0.04, y - 0.25, -length * 1.03],
        [0.06, y - 0.57, -length * 0.98],
      ],
      cow ? 0.019 : 0.028,
      coat,
    );
    oval(
      0.06,
      y - 0.62,
      -length * 0.98,
      cow ? 0.051 : 0.052,
      cow ? 0.15 : 0.065,
      0.05,
      cow ? '#474435' : coat,
    );
  } else oval(0, 0.48, -0.3, 0.04, 0.15, 0.04, '#5c4c32', false, false, -0.5);
  finish('tail', [0, h + 0.13, -length * 0.85]);
  return parts;
}

/** Fragment coat detail avoids angular vertex-painted markings at close range. */
export function animalMaterial() {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  m.customProgramCacheKey = () => 'livestock-coat-v1';
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = 'attribute vec4 coatData; varying vec4 vCoat;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvCoat=coatData;',
    );
    shader.fragmentShader = 'varying vec4 vCoat;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
   vec3 q=vCoat.xyz;
   float grain=sin(q.x*230.0+sin(q.z*83.0))*sin(q.y*190.0+q.z*91.0);
   float detail=1.0-smoothstep(.01,.045,length(fwidth(q)));
   if(vCoat.w>.5 && vCoat.w<1.5){
     float marking=sin(q.x*6.0+sin(q.z*4.0))*cos(q.y*5.0-q.z*3.0)+.35*sin(q.z*10.0+q.x*3.0);
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.018,.021,.016),smoothstep(.14,.22,marking));
     diffuseColor.rgb*=1.0+grain*.035*detail;
   } else if(vCoat.w>1.5 && vCoat.w<2.5){
     float curl=sin(q.x*170.0+sin(q.y*90.0))*cos(q.z*150.0+sin(q.x*100.0));
     diffuseColor.rgb*=.88+detail*(curl*.1+grain*.04);
   } else if(vCoat.w>2.5 && vCoat.w<3.5){
     float mud=(1.0-smoothstep(.08,.5,q.y))*(.3+.15*sin(q.z*17.0+q.x*24.0));
     diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.14,.095,.065),mud);
     diffuseColor.rgb*=1.0+grain*.04*detail;
   } else if(vCoat.w>3.5){
     float feathers=pow(abs(sin(q.y*65.0+sin(q.z*38.0)*1.8)),10.0);
     diffuseColor.rgb*=1.0-detail*(feathers*.2+grain*.045);
   }
  `,
    );
  };
  return m;
}
