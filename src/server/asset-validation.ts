// SPDX-License-Identifier: GPL-3.0-or-later
import { parseObj } from '../shared/obj.ts';
/** Only self-contained, bounded visual media may be rendered as world objects. */
export function validateVisualAsset(buf: Buffer, type: string) {
  const dimensions = (width: number, height: number) => {
    if (!width || !height || width > 2048 || height > 2048)
      throw Error('Images must be between 1 and 2048 pixels on each side');
  };
  if (type === 'image/png') {
    if (
      buf.length < 33 ||
      buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      buf.toString('ascii', 12, 16) !== 'IHDR' ||
      buf.readUInt32BE(8) !== 13
    )
      throw Error('Malformed PNG');
    dimensions(buf.readUInt32BE(16), buf.readUInt32BE(20));
  }
  if (type === 'image/jpeg') {
    let pos = 2,
      found = false;
    if (buf.readUInt16BE(0) !== 0xffd8) throw Error('Malformed JPEG');
    while (pos + 4 < buf.length) {
      if (buf[pos] !== 255) break;
      const marker = buf[pos + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const len = buf.readUInt16BE(pos + 2);
      if (len < 2 || pos + 2 + len > buf.length) break;
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        if (len < 8) break;
        dimensions(buf.readUInt16BE(pos + 7), buf.readUInt16BE(pos + 5));
        found = true;
        break;
      }
      pos += len + 2;
    }
    if (!found) throw Error('Unsupported or malformed JPEG');
  }
  if (type === 'model/obj') {
    parseObj(new TextDecoder('utf-8', { fatal: true }).decode(buf));
    return;
  }
  if (type !== 'model/gltf-binary') return;
  if (
    buf.length < 24 ||
    buf.toString('ascii', 0, 4) !== 'glTF' ||
    buf.readUInt32LE(4) !== 2 ||
    buf.readUInt32LE(8) !== buf.length ||
    buf.readUInt32LE(16) !== 0x4e4f534a
  )
    throw Error('Use a valid glTF 2 binary model');
  const length = buf.readUInt32LE(12);
  if (length > 256000 || length % 4 || length + 20 > buf.length)
    throw Error('GLB metadata is too large or malformed');
  const doc = JSON.parse(buf.subarray(20, 20 + length).toString());
  if (doc.asset?.version !== '2.0') throw Error('Use glTF 2.0');
  if (doc.extensionsRequired?.length || doc.extensionsUsed?.length)
    throw Error('Export a plain GLB without extensions or compression');
  for (const [key, max] of Object.entries({
    nodes: 256,
    meshes: 128,
    materials: 32,
    textures: 8,
    images: 8,
    accessors: 512,
    bufferViews: 512,
    buffers: 1,
    scenes: 8,
    animations: 8,
    skins: 4,
  }))
    if (doc[key] !== undefined && (!Array.isArray(doc[key]) || doc[key].length > max))
      throw Error('Model exceeds the workshop budget: ' + key);
  const index = (n: unknown, list: any[]) =>
    Number.isInteger(n) && Number(n) >= 0 && Number(n) < list.length;
  const nodes = doc.nodes ?? [],
    parent = new Set<number>(),
    visiting = new Set<number>(),
    visited = new Set<number>();
  function visit(i: number, depth = 0) {
    if (depth > 32 || visiting.has(i)) throw Error('GLB node hierarchy is cyclic or too deep');
    if (visited.has(i)) return;
    visiting.add(i);
    const n = nodes[i];
    if (!n || typeof n !== 'object') throw Error('Invalid node');
    if (n.mesh !== undefined && !index(n.mesh, doc.meshes ?? []))
      throw Error('Invalid mesh reference');
    if (n.children !== undefined && (!Array.isArray(n.children) || n.children.length > 256))
      throw Error('Invalid node children');
    for (const child of n.children ?? []) {
      if (!index(child, nodes) || parent.has(child)) throw Error('Invalid or repeated node parent');
      parent.add(child);
      visit(child, depth + 1);
    }
    visiting.delete(i);
    visited.add(i);
  }
  nodes.forEach((_: unknown, i: number) => visit(i));
  for (const scene of doc.scenes ?? []) {
    if (
      !Array.isArray(scene.nodes) ||
      scene.nodes.length > 256 ||
      new Set(scene.nodes).size !== scene.nodes.length ||
      scene.nodes.some((i: unknown) => !index(i, nodes) || parent.has(Number(i)))
    )
      throw Error('Invalid scene roots');
  }
  let primitives = 0;
  for (const mesh of doc.meshes ?? []) {
    if (!Array.isArray(mesh.primitives)) throw Error('Missing mesh primitives');
    primitives += mesh.primitives.length;
    for (const p of mesh.primitives) {
      if (p.targets?.length) throw Error('Morph targets are not supported');
      if (
        !p.attributes ||
        Object.values(p.attributes).some((a) => !index(a, doc.accessors ?? [])) ||
        (p.indices !== undefined && !index(p.indices, doc.accessors ?? []))
      )
        throw Error('Invalid geometry accessor');
    }
  }
  if (
    primitives > 128 ||
    (doc.accessors ?? []).reduce(
      (n: number, a: any) => n + (Number.isSafeInteger(a.count) && a.count > 0 ? a.count : 1e9),
      0,
    ) > 300000
  )
    throw Error('Model geometry exceeds the workshop budget');
  const binHeader = 20 + length,
    binStart = binHeader + 8;
  let binLength = 0;
  if (binHeader < buf.length) {
    if (binStart > buf.length || buf.readUInt32LE(binHeader + 4) !== 0x004e4942)
      throw Error('Invalid GLB binary chunk');
    binLength = buf.readUInt32LE(binHeader);
    if (binLength % 4 || binStart + binLength !== buf.length)
      throw Error('Invalid GLB binary length');
  }
  for (const b of doc.buffers ?? [])
    if (
      b.uri ||
      !Number.isSafeInteger(b.byteLength) ||
      b.byteLength < 0 ||
      b.byteLength > binLength
    )
      throw Error('GLB buffers must be embedded');
  for (const view of doc.bufferViews ?? []) {
    if (
      view.buffer !== 0 ||
      !Number.isSafeInteger(view.byteLength) ||
      view.byteLength <= 0 ||
      !Number.isSafeInteger(view.byteOffset ?? 0) ||
      (view.byteOffset ?? 0) < 0 ||
      (view.byteOffset ?? 0) + view.byteLength > binLength
    )
      throw Error('Invalid embedded buffer view');
  }
  for (const a of doc.accessors ?? [])
    if (
      a.sparse ||
      !index(a.bufferView, doc.bufferViews ?? []) ||
      ![5120, 5121, 5122, 5123, 5125, 5126].includes(a.componentType) ||
      !['SCALAR', 'VEC2', 'VEC3', 'VEC4', 'MAT2', 'MAT3', 'MAT4'].includes(a.type)
    )
      throw Error('Use dense standard geometry accessors');
  const accessors = doc.accessors ?? [];
  const components: Record<string, number> = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16,
  };
  for (const a of accessors) {
    const view = doc.bufferViews[a.bufferView],
      bytes =
        a.componentType === 5126 || a.componentType === 5125
          ? 4
          : a.componentType === 5122 || a.componentType === 5123
            ? 2
            : 1;
    const packed = components[a.type] * bytes,
      stride = view.byteStride ?? packed,
      offset = a.byteOffset ?? 0;
    if (
      !Number.isInteger(offset) ||
      offset < 0 ||
      !Number.isInteger(stride) ||
      stride < packed ||
      stride > 252 ||
      stride % bytes ||
      offset % bytes ||
      offset + (a.count - 1) * stride + packed > view.byteLength
    )
      throw Error('Accessor exceeds its binary view');
    if (a.componentType === 5126)
      for (let i = 0; i < a.count; i++)
        for (let j = 0; j < components[a.type]; j++)
          if (
            !Number.isFinite(
              buf.readFloatLE(binStart + (view.byteOffset ?? 0) + offset + i * stride + j * 4),
            )
          )
            throw Error('Non-finite model data');
  }
  const times = (a: any) => {
    const v = doc.bufferViews[a.bufferView];
    let previous = -1;
    for (let i = 0; i < a.count; i++) {
      const t = buf.readFloatLE(
        binStart + (v.byteOffset ?? 0) + (a.byteOffset ?? 0) + i * (v.byteStride ?? 4),
      );
      if (t < 0 || t > 300 || t <= previous)
        throw Error('Animation times must increase within five minutes');
      previous = t;
    }
  };
  for (const animation of doc.animations ?? []) {
    if (
      !Array.isArray(animation.channels) ||
      !Array.isArray(animation.samplers) ||
      animation.channels.length > 64 ||
      animation.samplers.length > 64
    )
      throw Error('Animation channel budget exceeded');
    const targets = new Set<string>();
    for (const channel of animation.channels) {
      const target = channel.target,
        sampler = animation.samplers[channel.sampler];
      if (
        !target ||
        !index(target.node, nodes) ||
        !['translation', 'rotation', 'scale'].includes(target.path) ||
        !sampler ||
        nodes[target.node].matrix
      )
        throw Error('Use node translation, rotation or scale animation');
      const key = target.node + ':' + target.path;
      if (targets.has(key)) throw Error('Duplicate animation target');
      targets.add(key);
      const input = accessors[sampler.input],
        output = accessors[sampler.output],
        interpolation = sampler.interpolation ?? 'LINEAR';
      if (
        !input ||
        !output ||
        input.componentType !== 5126 ||
        input.type !== 'SCALAR' ||
        input.count > 2000 ||
        output.componentType !== 5126 ||
        output.type !== (target.path === 'rotation' ? 'VEC4' : 'VEC3') ||
        !['LINEAR', 'STEP', 'CUBICSPLINE'].includes(interpolation) ||
        output.count !== input.count * (interpolation === 'CUBICSPLINE' ? 3 : 1)
      )
        throw Error('Invalid animation sampler');
      times(input);
    }
  }
  for (const skin of doc.skins ?? []) {
    if (
      !Array.isArray(skin.joints) ||
      !skin.joints.length ||
      skin.joints.length > 64 ||
      new Set(skin.joints).size !== skin.joints.length ||
      skin.joints.some((i: unknown) => !index(i, nodes)) ||
      (skin.skeleton !== undefined && !index(skin.skeleton, nodes))
    )
      throw Error('Invalid skeleton joints');
    if (skin.inverseBindMatrices !== undefined) {
      const a = accessors[skin.inverseBindMatrices];
      if (!a || a.type !== 'MAT4' || a.componentType !== 5126 || a.count !== skin.joints.length)
        throw Error('Invalid bind matrices');
    }
  }
  for (const node of nodes) {
    for (const [key, length] of Object.entries({
      translation: 3,
      rotation: 4,
      scale: 3,
      matrix: 16,
    })) {
      const value = node[key];
      if (
        value !== undefined &&
        (!Array.isArray(value) ||
          value.length !== length ||
          value.some((n: unknown) => typeof n !== 'number' || !Number.isFinite(n)))
      )
        throw Error('Invalid node transform');
    }
    if (node.skin === undefined) continue;
    if (!index(node.skin, doc.skins ?? []) || !index(node.mesh, doc.meshes ?? []))
      throw Error('Invalid skin reference');
    const skin = doc.skins[node.skin];
    for (const primitive of doc.meshes[node.mesh].primitives) {
      const joints = accessors[primitive.attributes.JOINTS_0],
        weights = accessors[primitive.attributes.WEIGHTS_0],
        positions = accessors[primitive.attributes.POSITION];
      if (
        !joints ||
        !weights ||
        !positions ||
        joints.type !== 'VEC4' ||
        weights.type !== 'VEC4' ||
        ![5121, 5123].includes(joints.componentType) ||
        ![5121, 5123, 5126].includes(weights.componentType) ||
        (weights.componentType !== 5126 && !weights.normalized) ||
        joints.count !== positions.count ||
        weights.count !== positions.count
      )
        throw Error('Skinned meshes require matching joint and weight attributes');
      const view = doc.bufferViews[joints.bufferView],
        bytes = joints.componentType === 5121 ? 1 : 2;
      for (let i = 0; i < joints.count; i++)
        for (let j = 0; j < 4; j++) {
          const offset =
            binStart +
            (view.byteOffset ?? 0) +
            (joints.byteOffset ?? 0) +
            i * (view.byteStride ?? bytes * 4) +
            j * bytes;
          if (buf.readUIntLE(offset, bytes) >= skin.joints.length)
            throw Error('Joint index exceeds skeleton');
        }
    }
  }
  for (const img of doc.images ?? []) {
    if (img.uri || !['image/png', 'image/jpeg'].includes(img.mimeType))
      throw Error('GLB images must use embedded PNG/JPEG buffer views');
    const view = doc.bufferViews?.[img.bufferView];
    if (!view) throw Error('Invalid embedded image');
    validateVisualAsset(
      buf.subarray(
        binStart + (view.byteOffset ?? 0),
        binStart + (view.byteOffset ?? 0) + view.byteLength,
      ),
      img.mimeType,
    );
  }
}
