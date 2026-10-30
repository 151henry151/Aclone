// SPDX-License-Identifier: GPL-3.0-or-later
/** Contour water at height zero, interpolating shoreline crossings between samples.
 * Coordinates are map pixels; the caller samples the world's actual terrain minus
 * sea level. One filled path avoids seams between adjacent cells and stays crisp
 * at any display density, without sampling terrain once per screen pixel. */
type TerrainGrid = { xs: number[]; ys: number[]; heights: number[][] };
function sampleGrid(
  width: number,
  height: number,
  elevation: (x: number, y: number) => number,
  cell: number,
): TerrainGrid {
  const xs = Array.from({ length: Math.ceil(width / cell) + 1 }, (_, i) =>
    Math.min(width, i * cell),
  );
  const ys = Array.from({ length: Math.ceil(height / cell) + 1 }, (_, i) =>
    Math.min(height, i * cell),
  );
  return { xs, ys, heights: ys.map((y) => xs.map((x) => elevation(x, y))) };
}
export function mapWaterPath(
  width: number,
  height: number,
  elevation: (x: number, y: number) => number,
  cell = 6,
) {
  return waterPath(sampleGrid(width, height, elevation, cell));
}
function waterPath({ xs, ys, heights }: TerrainGrid) {
  const columns = xs.length - 1,
    rows = ys.length - 1;
  let upper = heights[0];
  const paths: string[] = [];
  type Vertex = { x: number; y: number; h: number };
  const n = (v: number) => Math.round(v * 1000) / 1000;
  const triangle = (vertices: Vertex[]) => {
    const polygon: Vertex[] = [];
    for (let i = 0; i < 3; i++) {
      const a = vertices[i],
        b = vertices[(i + 1) % 3];
      if (a.h < 0) polygon.push(a);
      if (a.h < 0 !== b.h < 0) {
        const t = a.h / (a.h - b.h);
        polygon.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, h: 0 });
      }
    }
    if (polygon.length >= 3)
      paths.push(polygon.map((v, i) => `${i ? 'L' : 'M'}${n(v.x)} ${n(v.y)}`).join('') + 'Z');
  };
  for (let row = 0; row < rows; row++) {
    const lower = heights[row + 1];
    let run = -1;
    const flush = (end: number) => {
      if (run < 0) return;
      paths.push(`M${xs[run]} ${ys[row]}H${xs[end]}V${ys[row + 1]}H${xs[run]}Z`);
      run = -1;
    };
    for (let column = 0; column < columns; column++) {
      const heights = [upper[column], upper[column + 1], lower[column + 1], lower[column]];
      if (heights.every((h) => h < 0)) {
        if (run < 0) run = column;
        continue;
      }
      flush(column);
      if (heights.every((h) => h >= 0)) continue;
      const vertices = [
        { x: xs[column], y: ys[row], h: heights[0] },
        { x: xs[column + 1], y: ys[row], h: heights[1] },
        { x: xs[column + 1], y: ys[row + 1], h: heights[2] },
        { x: xs[column], y: ys[row + 1], h: heights[3] },
      ];
      triangle([vertices[0], vertices[1], vertices[2]]);
      triangle([vertices[0], vertices[2], vertices[3]]);
    }
    flush(columns);
    upper = lower;
  }
  return paths.join('');
}

/** Heights are relative to sea level. Negative contours stay off the land map. */
export function mapTerrainPaths(
  width: number,
  height: number,
  elevation: (x: number, y: number) => number,
  contours = true,
  tide = 0,
) {
  // Bound terrain work for pannable sheets as well as the original viewport-sized map.
  const cell = Math.max(6, Math.sqrt((width * height) / 16000));
  const grid = sampleGrid(width, height, elevation, cell);
  const minor: string[] = [],
    major: string[] = [];
  const labels: { x: number; y: number; height: number }[] = [];
  const candidates: typeof labels = [];
  const labelCells = new Set<string>();
  if (contours) {
    const { xs, ys, heights } = grid;
    const n = (v: number) => Math.round(v * 1000) / 1000;
    for (let j = 0; j < ys.length - 1; j++)
      for (let i = 0; i < xs.length - 1; i++) {
        const v = [
          { x: xs[i], y: ys[j], h: heights[j][i] },
          { x: xs[i + 1], y: ys[j], h: heights[j][i + 1] },
          { x: xs[i + 1], y: ys[j + 1], h: heights[j + 1][i + 1] },
          { x: xs[i], y: ys[j + 1], h: heights[j + 1][i] },
        ];
        for (const triangle of [
          [v[0], v[1], v[2]],
          [v[0], v[2], v[3]],
        ]) {
          const min = Math.min(...triangle.map((p) => p.h)),
            max = Math.max(...triangle.map((p) => p.h));
          for (let level = Math.max(10, Math.ceil(min / 10) * 10); level <= max; level += 10) {
            const crossings: { x: number; y: number }[] = [];
            for (let e = 0; e < 3; e++) {
              const a = triangle[e],
                b = triangle[(e + 1) % 3];
              if (a.h < level === b.h < level) continue;
              const t = (level - a.h) / (b.h - a.h);
              crossings.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
            }
            if (crossings.length !== 2) continue;
            const [a, b] = crossings;
            (level % 50 === 0 ? major : minor).push(`M${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}`);
            if (
              level % 50 === 0 &&
              Math.hypot(a.x - b.x, a.y - b.y) > 1 &&
              a.x > 30 &&
              a.y > 20 &&
              a.x < width - 40 &&
              a.y < height - 20
            ) {
              const cell = `${level}:${Math.floor(a.x / 80)}:${Math.floor(a.y / 80)}`;
              if (!labelCells.has(cell)) {
                labelCells.add(cell);
                candidates.push({ x: a.x, y: a.y, height: level });
              }
            }
          }
        }
      }
  }
  // Label higher hills before coastal contours can occupy every label position.
  for (const candidate of candidates.sort((a, b) => b.height - a.height))
    if (labels.every((p) => Math.hypot(p.x - candidate.x, p.y - candidate.y) > 180))
      labels.push(candidate);
  return {
    water: waterPath(
      tide ? { ...grid, heights: grid.heights.map((row) => row.map((h) => h - tide)) } : grid,
    ),
    deepWater: waterPath({
      ...grid,
      heights: grid.heights.map((row) => row.map((h) => h + 100 - tide)),
    }),
    minor: minor.join(''),
    major: major.join(''),
    labels,
  };
}
