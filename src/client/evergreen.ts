// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type EvergreenSite = {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
  variant: number;
  width: number;
  leanX: number;
  leanZ: number;
};
function random(seed: number) {
  return () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
}

/** A whole feathered bough, with needles growing along lateral shoots, not a circular leaf stamp. */
function needleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!,
    rand = random(84923);
  const line = (x: number, y: number, tx: number, ty: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  };
  ctx.lineCap = 'round';
  const needle = (x: number, y: number, angle: number, length: number) => {
    const green = ['#59765d', '#678562', '#7c9268', '#8e9e70', '#456b56'];
    line(
      x,
      y,
      x + Math.cos(angle) * length,
      y + Math.sin(angle) * length,
      green[Math.floor(rand() * green.length)],
      1.6 + rand() * 1.0,
    );
  };
  // Irregular woody shoots with needles all around each axis: no fern-like rows of leaflets.
  const shoot = (x: number, y: number, tx: number, ty: number, thickness: number) => {
    const dx = tx - x,
      dy = ty - y,
      length = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx),
      bend = (rand() - 0.5) * 20;
    let previous = { x, y };
    const steps = Math.ceil(length / 2.6);
    for (let j = 1; j <= steps; j++) {
      const f = j / steps;
      const px = x + dx * f + Math.sin(f * Math.PI) * bend;
      const py = y + dy * f;
      line(previous.x, previous.y, px, py, '#685a43', thickness * (1 - f * 0.6));
      if (f > 0.07)
        for (let n = 0; n < 5; n++) {
          const spread = (rand() - 0.5) * 2.6;
          needle(
            px + (rand() - 0.5) * 3,
            py + (rand() - 0.5) * 3,
            angle + spread,
            (9 + rand() * 17) * (1 - f * 0.3),
          );
        }
      previous = { x: px, y: py };
    }
  };
  for (let tier = 0; tier < 6; tier++) {
    const f = 0.14 + tier * 0.125;
    for (const side of [-1, 1]) {
      const y = 478 - f * 410 + (rand() - 0.5) * 30;
      const length = (1 - f) * (140 + rand() * 65);
      shoot(255 + f * 7, y, 258 + side * length, y - (65 + rand() * 100), 2.5);
    }
  }
  shoot(254, 493, 270, 26, 3.6);
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function barkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!,
    rand = random(1293);
  ctx.fillStyle = '#716658';
  ctx.fillRect(0, 0, 128, 512);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = ['#514a40', '#857564', '#645849', '#9a8971'][i % 4];
    ctx.fillRect(rand() * 128, rand() * 512, 1 + rand() * 4, 4 + rand() * 28);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  return map;
}

/** Three stable silhouettes. All visible green volume comes from branches; there is no solid crown. */
export function evergreenGeometry(variant: number, low: boolean) {
  const rand = random(9127 + variant * 2317),
    wood: T.BufferGeometry[] = [];
  const positions: number[] = [],
    uvs: number[] = [],
    colors: number[] = [];
  const height = [8.8, 9.6, 8.3][variant],
    radius = [2.8, 2.5, 3.1][variant];
  const driftX = (rand() - 0.5) * 0.45,
    driftZ = (rand() - 0.5) * 0.45;
  const stem = (y: number) =>
    new T.Vector3(driftX * (y / height) ** 2, y, driftZ * (y / height) ** 2);
  const limb = (a: T.Vector3, b: T.Vector3, base: number, tip: number, sides = 5) => {
    const g = new T.CylinderGeometry(tip, base, a.distanceTo(b), sides, 1, true);
    const q = new T.Quaternion().setFromUnitVectors(
      new T.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    g.applyQuaternion(q);
    g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
    wood.push(g);
  };
  for (let i = 0; i < 12; i++) {
    const a = i / 12,
      b = (i + 1) / 12;
    limb(
      stem(height * a),
      stem(height * b),
      0.23 * (1 - a) ** 1.2 + 0.009,
      0.23 * (1 - b) ** 1.2 + 0.009,
      low ? 7 : 9,
    );
  }
  for (let i = 0; i < 5; i++) {
    const a = i * 2.399;
    limb(new T.Vector3(Math.sin(a) * 0.34, -0.025, Math.cos(a) * 0.34), stem(0.22), 0.04, 0.08);
  }
  // Slightly drooping lower limbs, ascending upper shoots, and staggered incomplete whorls.
  for (let level = 0; level < 15; level++) {
    const t = level / 15,
      y = 1.5 + t * (height - 1.75);
    const count = level < 11 ? 7 : 6;
    const offset = level * 2.399 + rand() * 0.5;
    for (let branch = 0; branch < count; branch++) {
      if (level < 4 && rand() < 0.1) continue;
      const angle = offset + (branch / count) * Math.PI * 2 + (rand() - 0.5) * 0.4;
      const length = radius * (1 - t) ** 0.78 * (0.76 + rand() * 0.34) * (level === 0 ? 0.8 : 1);
      const origin = stem(y + (rand() - 0.5) * 0.42);
      const dx = Math.sin(angle),
        dz = Math.cos(angle);
      const sag = (0.28 + rand() * 0.25) * (1 - t);
      const point = (f: number) =>
        origin
          .clone()
          .add(
            new T.Vector3(
              dx * length * f,
              -Math.sin(f * Math.PI * 0.88) * sag + f * f * (0.1 + t * 0.32),
              dz * length * f,
            ),
          );
      const sections = low ? 2 : 3;
      for (let j = 0; j < sections; j++)
        limb(
          point(j / sections),
          point((j + 1) / sections),
          (0.035 * (1 - t) + 0.008) * (1 - j / sections),
          0.007,
          low ? 4 : 5,
        );
      // Many small side shoots, not one giant green card for the whole bough.
      // Every random draw is shared between quality modes to preserve branch architecture.
      for (let shoot = 0; shoot < 8; shoot++) {
        const terminal = shoot === 7;
        const f = terminal ? 0.72 : 0.16 + shoot * 0.13;
        for (const side of terminal ? [1] : [-1, 1]) {
          const turn = angle + (terminal ? (rand() - 0.5) * 0.3 : side * (0.7 + rand() * 0.65));
          const shootLength =
            length * (terminal ? 0.46 : 0.4 * (1 - f) + 0.2) * (0.85 + rand() * 0.35);
          const shootWidth = shootLength * (0.65 + rand() * 0.18);
          const root = point(f);
          const fall = shootLength * (0.12 + rand() * 0.38) * (1 - t * 0.7);
          const tip = root
            .clone()
            .add(
              new T.Vector3(
                Math.sin(turn) * shootLength,
                -fall + t * 0.16,
                Math.cos(turn) * shootLength,
              ),
            );
          const shade = 0.88 + rand() * 0.12;
          for (let face = 0; face < 2; face++) {
            const roll = (face ? 1.2 : -0.3) + (rand() - 0.5) * 0.45;
            if (low && (shoot === 1 || shoot === 4)) continue;
            const across = new T.Vector3(
              Math.cos(turn) * Math.cos(roll),
              Math.sin(roll),
              -Math.sin(turn) * Math.cos(roll),
            ).multiplyScalar(shootWidth * 0.5);
            for (const [along, edge] of [
              [0, -1],
              [1, -1],
              [1, 1],
              [0, -1],
              [1, 1],
              [0, 1],
            ]) {
              const pos = root.clone().lerp(tip, along).addScaledVector(across, edge);
              // Twisted sprays scatter their highlights rather than reflecting as one flat sheet.
              pos.y += edge * along * shootWidth * 0.13;
              positions.push(...pos.toArray());
              uvs.push((edge + 1) / 2, along);
              const c = shade * (0.88 + along * 0.12);
              colors.push(c * 0.97, c, c * 0.97);
            }
          }
        }
      }
    }
  }
  // Short upright sprays form a fine leader instead of a blunt polygonal cap.
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI) / 5;
    const side = new T.Vector3(Math.cos(angle), 0, Math.sin(angle)).multiplyScalar(0.22);
    const bottom = stem(height - 0.9),
      top = stem(height + 0.18);
    for (const [base, sign, u, v] of [
      [bottom, -1, 0, 0],
      [bottom, 1, 1, 0],
      [top, 1, 1, 1],
      [bottom, -1, 0, 0],
      [top, 1, 1, 1],
      [top, -1, 0, 1],
    ] as const) {
      positions.push(...base.clone().addScaledVector(side, sign).toArray());
      uvs.push(u, v);
      colors.push(0.94, 1, 0.94);
    }
  }
  const needles = new T.BufferGeometry();
  needles.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  needles.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  needles.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  needles.computeVertexNormals();
  const trunk = mergeGeometries(wood)!;
  wood.forEach((g) => g.dispose());
  return { wood: trunk, needles };
}

/** Six draws for the entire woodland, rather than one mesh per branch or tree. */
export interface EvergreenMaterials {
  needles: T.MeshLambertMaterial;
  wood: T.MeshStandardMaterial;
}
export function evergreenMaterials(): EvergreenMaterials {
  const needles = new T.MeshLambertMaterial({
    map: needleTexture(),
    color: '#f0f3e8',
    vertexColors: true,
    alphaTest: 0.28,
    side: T.DoubleSide,
  });
  needles.userData.evergreen = true;
  needles.customProgramCacheKey = () => 'evergreen-needles-v1';
  // Needle sprays transmit some light through their backs; never add emissive night glow.
  needles.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_lambert_pars_fragment>',
      T.ShaderChunk.lights_lambert_pars_fragment.replace(
        'saturate( dot( geometryNormal, directLight.direction ) )',
        '(0.35 * abs(dot(geometryNormal, directLight.direction)) + 0.65 * saturate(dot(geometryNormal, directLight.direction)))',
      ),
    );
  };
  const wood = new T.MeshStandardMaterial({ map: barkTexture(), roughness: 1 });
  return { needles, wood };
}
const sharedGeometry = new Map<string, ReturnType<typeof evergreenGeometry>>();
/** Streamed woodland reuses one geometry per variant; the village keeps its own copies. */
export function sharedEvergreenGeometry(variant: number, low: boolean) {
  const key = `${variant}:${low}`;
  let geometry = sharedGeometry.get(key);
  if (!geometry) {
    geometry = evergreenGeometry(variant, low);
    for (const g of Object.values(geometry)) g.userData.shared = true;
    sharedGeometry.set(key, geometry);
  }
  return geometry;
}
export function evergreens(
  root: T.Group,
  sites: EvergreenSite[],
  low: boolean,
  materials: EvergreenMaterials = evergreenMaterials(),
  geometryFor: typeof evergreenGeometry = evergreenGeometry,
) {
  const { needles, wood } = materials;
  const matrix = new T.Object3D();
  for (let variant = 0; variant < 3; variant++) {
    const trees = sites.filter((site) => site.variant === variant);
    if (!trees.length) continue;
    const geometry = geometryFor(variant, low);
    for (const kind of ['wood', 'needles'] as const) {
      const mesh = new T.InstancedMesh(
        geometry[kind],
        kind === 'wood' ? wood : needles,
        trees.length,
      );
      mesh.name = `Evergreen ${kind} ${variant}`;
      trees.forEach((site, i) => {
        matrix.position.set(site.x, site.y, site.z);
        matrix.rotation.set(site.leanX, site.rotation, site.leanZ);
        matrix.scale.set(site.scale * site.width, site.scale, site.scale * site.width);
        matrix.updateMatrix();
        mesh.setMatrixAt(i, matrix.matrix);
        mesh.setColorAt(
          i,
          new T.Color().setRGB(
            0.87 + (i % 4) * 0.035,
            0.9 + (i % 3) * 0.025,
            0.85 + (i % 5) * 0.03,
          ),
        );
      });
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
  }
}
