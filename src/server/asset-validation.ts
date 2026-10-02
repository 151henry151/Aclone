// SPDX-License-Identifier: GPL-3.0-or-later
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
    animations: 0,
    skins: 0,
  }))
    if (doc[key] !== undefined && (!Array.isArray(doc[key]) || doc[key].length > max))
      throw Error('Model exceeds the static workshop budget: ' + key);
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
