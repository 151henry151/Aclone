// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../src/shared/types';
import { terrainHeight } from '../src/shared/terrain';
/** Paired, alternating hot-query benchmark; fixture-only, never touches a server. */
export function earthworksPerformance(
  original: World,
  expanded: World,
  baseline = terrainHeight,
  baselineName = 'current without pads',
  progress = 1,
  moving = false,
) {
  return [original, expanded].map((source) => {
    const empty = structuredClone(source),
      populated = structuredClone(source);
    empty.earthworks = [];
    populated.earthworks = Array.from({ length: 200 }, (_, i) => {
      const x = 700 + (i % 20) * 128,
        z = -1400 - Math.floor(i / 20) * 256;
      return {
        id: 'profile-' + i,
        owner: 'profile',
        created: 0,
        x,
        z,
        width: 16,
        depth: 16,
        rotation: 0.4,
        target: terrainHeight(empty, x, z),
        shoulder: 12,
        shoulderGrade: 50,
        progress,
        finish: 'bare' as const,
      };
    });
    let state = 54821;
    const random = () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
    const points = Array.from({ length: 4096 }, (_, i) => {
      // Include interiors and shoulders, plus unchanged ground along travelled routes.
      if (i % 5 === 0) {
        const p = populated.earthworks![i % 200];
        return [p.x + random() * 36 - 18, p.z + random() * 36 - 18];
      }
      return [random() * 8000 - 4000, random() * 18000 - 15000];
    });
    const queries = 500000;
    let checksum = 0;
    let pass = 0;
    const measure = (w: World, sample: typeof terrainHeight, phase: number) => {
      const start = performance.now();
      let sum = 0;
      for (let i = 0; i < queries; i++) {
        const p = points[i % points.length];
        // The optional moving run changes every query, not merely every repeated lap.
        const offset = moving ? (i / queries + phase) * 0.01 : 0;
        sum += sample(w, p[0] + offset, p[1] - offset);
      }
      checksum += sum;
      return performance.now() - start;
    };
    // Warm both call paths and the pad index before any measured pair.
    for (let i = 0; i < 3; i++) {
      measure(empty, baseline, pass);
      measure(populated, terrainHeight, pass++);
    }
    const pairs = [];
    for (let i = 0; i < 15; i++) {
      let zero: number, pads: number;
      if (i % 2) {
        pads = measure(populated, terrainHeight, pass);
        zero = measure(empty, baseline, pass);
      } else {
        zero = measure(empty, baseline, pass);
        pads = measure(populated, terrainHeight, pass);
      }
      pairs.push({ zeroMs: zero, padsMs: pads, deltaMs: pads - zero });
      pass++;
    }
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    const deltas = pairs.map((p) => p.deltaMs),
      avg = mean(deltas);
    const deviation = Math.sqrt(
      deltas.reduce((n, v) => n + (v - avg) ** 2, 0) / (deltas.length - 1),
    );
    // Paired 95% confidence interval, df=14. No discretionary percentage allowance.
    const margin = (2.145 * deviation) / Math.sqrt(deltas.length);
    return {
      world: source.northernIsland ? 'expanded' : 'original',
      baseline: baselineName,
      progress,
      moving,
      queries,
      padCount: 200,
      insideOrShoulderShare: 0.2,
      pairs,
      zeroMeanMs: mean(pairs.map((p) => p.zeroMs)),
      padsMeanMs: mean(pairs.map((p) => p.padsMs)),
      deltaMeanMs: avg,
      confidence95Ms: [avg - margin, avg + margin],
      measurableRegression: avg - margin > 0,
      checksum,
    };
  });
}
