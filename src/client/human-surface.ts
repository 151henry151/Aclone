// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import sculpt from './generated/human-mesh.json';

/** One shared atlas: work shirt, sleeves/hands, trousers/boots, and face/hair.
 * Stitching, pockets, buttons and facial features cost no extra meshes. */
let sharedMaterial: T.MeshStandardMaterial | undefined;
let sharedSurface: T.BufferGeometry | undefined;
export function humanMaterial() {
  if (sharedMaterial) return sharedMaterial;
  const width = 512,
    height = 1024,
    data = new Uint8Array(width * height * 4);
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const region = Math.floor(px / 128),
        u = ((px % 128) + 0.5) / 128,
        y = ((py + 0.5) / height) * 1.8,
        front = Math.abs(u - 0.5);
      let c = [102, 119, 88];
      const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
        ((u - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
      if (region === 3) {
        c = [191, 143, 111];
        // Hair wraps the back and temples with a tapered hairline.
        if (
          y > 1.722 + Math.cos(u * Math.PI * 2) * 0.018 ||
          (front > 0.255 && y > 1.59) ||
          (front > 0.18 && y > 1.68)
        )
          c = [61, 47, 36];
        else if (front < 0.2) {
          if (ellipse(0.5, 1.578, 0.056, 0.005)) c = [132, 81, 65];
          if (ellipse(0.5, 1.567, 0.045, 0.003)) c = [209, 155, 127];
          for (const eye of [0.429, 0.571]) {
            if (ellipse(eye, 1.672, 0.038, 0.005)) c = [73, 52, 36];
            if (ellipse(eye, 1.651, 0.032, 0.008)) c = [141, 100, 79];
            if (ellipse(eye, 1.653, 0.026, 0.0045)) c = [221, 210, 188];
            if (ellipse(eye, 1.653, 0.01, 0.005)) c = [73, 86, 65];
            if (ellipse(eye, 1.653, 0.004, 0.004)) c = [31, 32, 28];
          }
          if (ellipse(0.477, 1.61, 0.009, 0.003) || ellipse(0.523, 1.61, 0.009, 0.003))
            c = [125, 81, 60];
        }
      } else if (region === 2 || (region === 0 && y < 0.99)) {
        c = [69, 90, 105];
        if (y < 0.15) {
          c = y < 0.029 ? [43, 39, 32] : [93, 66, 43];
          if (front < 0.075 && y > 0.065 && y < 0.125 && Math.floor(y * 400) % 5 === 0)
            c = [173, 147, 109];
          if (front > 0.2 && front < 0.225) c = [115, 85, 54];
        } else {
          if (front > 0.235 && front < 0.247) c = [119, 129, 124];
          if (y > 0.935) c = [65, 52, 35];
          if (region === 0 && front < 0.025 && y > 0.944 && y < 0.967) c = [172, 149, 103];
        }
      } else if (region === 1) {
        if (y < 0.864) c = [191, 143, 111];
        else if (y < 0.89) c = [76, 91, 65];
        if (y < 0.8 && Math.floor(u * 22) % 5 === 0) c = [169, 120, 90];
      } else {
        if (y > 1.455) c = [191, 143, 111];
        else if (y > 1.38 && front < (y - 1.38) * 1.1) c = [208, 195, 159];
        else if (front < 0.011 && y > 1.0 && y < 1.41) c = [74, 90, 61];
        // Pocket edges/flaps and a subtle yoke on the back.
        for (const centre of [0.411, 0.589]) {
          if (Math.abs(u - centre) < 0.044 && y > 1.18 && y < 1.29) {
            c = [97, 113, 82];
            if (y > 1.273 || y < 1.185 || Math.abs(u - centre) > 0.039) c = [74, 90, 61];
          }
        }
        if (front < 0.007 && [1.06, 1.15, 1.24, 1.33].some((b) => Math.abs(y - b) < 0.004))
          c = [190, 174, 128];
        if (front > 0.3 && Math.abs(y - 1.32) < 0.003) c = [76, 92, 64];
      }
      const fabric =
        region !== 3 && y > 0.15 && !(region === 1 && y < 0.864) && !(region === 0 && y > 1.455);
      const weave = fabric
        ? ((px + py) % 4 < 2 ? 1 : -1) * 3 + Math.sin(py * 0.13) * 1.5
        : Math.sin(px * 17 + py * 31) * 1.2;
      const i = (py * width + px) * 4;
      data.set([...c.map((v) => Math.max(0, Math.min(255, v + weave))), 255], i);
    }
  const texture = new T.DataTexture(data, width, height);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = T.LinearFilter;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.userData.shared = true;
  texture.needsUpdate = true;
  const material = new T.MeshStandardMaterial({
    map: texture,
    roughness: 0.86,
    vertexColors: true,
  });
  material.userData.shared = true;
  sharedMaterial = material;
  return material;
}

/** Welded sculpt with smooth vertex normals; UV seams duplicate vertices only,
 * never split the surface or its weights. */
export function humanSurface(bones: T.Bone[]) {
  if (sharedSurface) return sharedSurface;
  const original = new T.BufferGeometry();
  original.setAttribute('position', new T.Float32BufferAttribute(sculpt.position, 3));
  original.setIndex(sculpt.index);
  original.computeVertexNormals();
  const g = original.toNonIndexed();
  original.dispose();
  const pos = g.attributes.position,
    uv: number[] = [],
    indices: number[] = [],
    weights: number[] = [],
    colors: number[] = [];
  const bone = (name: string) => bones.findIndex((b) => b.name === name);
  const smooth = T.MathUtils.smoothstep;
  function region(x: number, y: number) {
    if (y > 1.49) return 3;
    if (y > 0.69 && Math.abs(x) > 0.205 && (y < 1.35 || Math.abs(x) > 0.245)) return 1;
    if (y < 0.9) return 2;
    return 0;
  }
  for (let f = 0; f < pos.count; f += 3) {
    const cx = (pos.getX(f) + pos.getX(f + 1) + pos.getX(f + 2)) / 3,
      cy = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
    const r = region(cx, cy),
      us: number[] = [];
    for (let i = f; i < f + 3; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i),
        side = x < 0 ? -1 : 1;
      const center =
        r === 1 ? side * (0.221 + Math.tan(0.23) * (1.389 - y)) : r === 2 ? side * 0.105 : 0;
      us.push(Math.atan2(x - center, z) / (Math.PI * 2) + 0.5);
      // Anatomy-based blends are evaluated per position, identical across atlas seams.
      let own = bone('hips'),
        other = own,
        blend = 0;
      if (y < 0.94) {
        own = bone(`thigh-${side}`);
        other = bone(`shin-${side}`);
        blend = 1 - smooth(y, 0.43, 0.59);
        if (y < 0.23) {
          own = bone(`shin-${side}`);
          other = bone(`foot-${side}`);
          blend = 1 - smooth(y, 0.11, 0.23);
        } else if (y > 0.83) {
          own = bone(`thigh-${side}`);
          other = bone('hips');
          blend = smooth(y, 0.83, 0.94);
        }
      } else if (y < 1.12) {
        own = bone('hips');
        other = bone('spine');
        blend = smooth(y, 0.94, 1.12);
      } else if (y < 1.43) {
        own = bone('spine');
        other = bone('torso');
        blend = smooth(y, 1.12, 1.31);
      } else if (y < 1.51) {
        own = bone('torso');
        other = bone('neck');
        blend = smooth(y, 1.43, 1.51);
      } else {
        own = bone('neck');
        other = bone('head');
        blend = smooth(y, 1.51, 1.57);
      }
      // A continuous shoulder/underarm transition avoids a hard skinning boundary
      // where the sleeve meets the chest, especially in the seated driving pose.
      const sleeve = 1 - smooth(y, 1.29, 1.38);
      const arm =
        smooth(Math.abs(x), 0.205 - sleeve * smooth(y, 1.1, 1.2) * 0.02, 0.26 - sleeve * 0.035) *
        smooth(y, 0.65, 0.72) *
        (1 - smooth(y, 1.405, 1.47));
      const elbow = 1 - smooth(y, 1.05, 1.18);
      if (y < 0.89 && arm > 0.999) {
        const hand = 1 - smooth(y, 0.81, 0.89);
        indices.push(bone(`forearm-${side}`), bone(`hand-${side}`), 0, 0);
        weights.push(1 - hand, hand, 0, 0);
      } else {
        indices.push(own, other, bone(`arm-${side}`), bone(`forearm-${side}`));
        weights.push((1 - blend) * (1 - arm), blend * (1 - arm), arm * (1 - elbow), arm * elbow);
      }
      colors.push(1, 1, 1);
    }
    // Keep angular seam triangles at their own edge of the atlas tile.
    if (Math.max(...us) - Math.min(...us) > 0.5)
      for (let j = 0; j < 3; j++) if (us[j] < 0.5) us[j] += 1;
    for (let j = 0; j < 3; j++) {
      let y = pos.getY(f + j);
      // Shoulder fabric stays below the collar in the atlas, even at the raised sleeve cap.
      if ((r === 0 || r === 1) && Math.abs(pos.getX(f + j)) > 0.08) y = Math.min(y, 1.44);
      uv.push(
        (r + T.MathUtils.clamp(us[j], 0.006, 0.994)) / 4,
        T.MathUtils.clamp(y / 1.8, 0.002, 0.998),
      );
    }
  }
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.setAttribute('skinIndex', new T.Uint16BufferAttribute(indices, 4));
  g.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4));
  g.userData.shared = true;
  sharedSurface = g;
  return g;
}
