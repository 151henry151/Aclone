// SPDX-License-Identifier: GPL-3.0-or-later
/** Bounded static Wavefront geometry. No external files or MTL directives execute.
 * Export triangulated faces, normals and a UV atlas from the modelling program. */
export function parseObj(text: string) {
  if (text.length > 2 * 1024 * 1024 || text.includes('\0')) throw Error('Invalid or oversized OBJ');
  const vertices: number[][] = [],
    uvs: number[][] = [],
    normals: number[][] = [];
  const position: number[] = [],
    uv: number[] = [],
    normal: number[] = [];
  let allNormals = true,
    allUvs = true,
    triangles = 0;
  const values = (parts: string[], min: number, max: number) => {
    const n = parts.map(Number);
    if (n.length < min || n.length > max || n.some((v) => !Number.isFinite(v) || Math.abs(v) > 1e6))
      throw Error('Invalid OBJ coordinate');
    return n;
  };
  const ref = (text: string, count: number) => {
    if (!/^-?\d+$/.test(text)) throw Error('Invalid OBJ index');
    const n = Number(text),
      index = n < 0 ? count + n : n - 1;
    if (!Number.isSafeInteger(n) || n === 0 || index < 0 || index >= count)
      throw Error('OBJ index outside available geometry');
    return index;
  };
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (raw.length > 16384) throw Error('OBJ line too long');
    const line = raw.split('#', 1)[0].trim();
    if (!line) continue;
    const [kind, ...parts] = line.split(/\s+/);
    if (kind === 'v') {
      const v = values(parts, 3, 7);
      if (![3, 4, 6, 7].includes(v.length)) throw Error('Invalid OBJ vertex');
      if (v.length === 4 && v[3] !== 1) throw Error('Export Cartesian OBJ vertices');
      vertices.push(v.slice(0, 3));
    } else if (kind === 'vt') uvs.push(values(parts, 2, 3).slice(0, 2));
    else if (kind === 'vn') normals.push(values(parts, 3, 3));
    else if (kind === 'f') {
      if (parts.length < 3 || parts.length > 64)
        throw Error('OBJ faces need 3–64 vertices; triangulate before export');
      triangles += parts.length - 2;
      if (triangles > 50000) throw Error('OBJ exceeds 50,000 triangles');
      const face = parts.map((token) => {
        const indices = token.split('/');
        if (indices.length > 3) throw Error('Invalid OBJ face');
        const v = ref(indices[0], vertices.length);
        const t = indices[1] ? ref(indices[1], uvs.length) : undefined;
        const n = indices[2] ? ref(indices[2], normals.length) : undefined;
        return { v, t, n };
      });
      for (let i = 1; i < face.length - 1; i++)
        for (const { v, t, n } of [face[0], face[i], face[i + 1]]) {
          position.push(...vertices[v]);
          uv.push(...(t === undefined ? [0, 0] : uvs[t]));
          normal.push(...(n === undefined ? [0, 0, 0] : normals[n]));
          if (n === undefined) allNormals = false;
          if (t === undefined) allUvs = false;
        }
    } else if (!['o', 'g', 's', 'usemtl', 'mtllib'].includes(kind))
      throw Error('Unsupported OBJ record: ' + kind.slice(0, 20));
    if (vertices.length > 60000 || uvs.length > 60000 || normals.length > 60000)
      throw Error('OBJ exceeds 60,000 coordinate records');
  }
  if (!triangles) throw Error('OBJ needs polygon faces');
  return {
    position: new Float32Array(position),
    uv: new Float32Array(uv),
    normal: allNormals ? new Float32Array(normal) : undefined,
    triangles,
    hasUvs: allUvs,
  };
}
