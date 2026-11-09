// SPDX-License-Identifier: GPL-3.0-or-later
import { constructionRules } from './construction-rules';
import { terrainHeight } from './terrain';
import type { Player, World } from './types';
export type SlopeUse = 'building' | 'field' | 'pasture';
/** Placement-time survey only. Rows/columns detect interior humps as well as tilted planes. */
export function surveySlope(
  w: World,
  x: number,
  z: number,
  width: number,
  depth: number,
  rotation: number,
) {
  const nx = Math.max(1, Math.ceil(width / 2)),
    nz = Math.max(1, Math.ceil(depth / 2));
  const c = Math.cos(rotation),
    s = Math.sin(rotation);
  const samples: { x: number; z: number; height: number }[] = [];
  const rows = Array.from({ length: nx + 1 }, () => ({ low: Infinity, high: -Infinity }));
  const columns = Array.from({ length: nz + 1 }, () => ({ low: Infinity, high: -Infinity }));
  let low = Infinity,
    high = -Infinity;
  for (let ix = 0; ix <= nx; ix++)
    for (let iz = 0; iz <= nz; iz++) {
      const dx = (ix / nx - 0.5) * width,
        dz = (iz / nz - 0.5) * depth;
      const sx = x + dx * c + dz * s,
        sz = z - dx * s + dz * c;
      const height = terrainHeight(w, sx, sz);
      samples.push({ x: sx, z: sz, height });
      low = Math.min(low, height);
      high = Math.max(high, height);
      for (const axis of [rows[ix], columns[iz]]) {
        axis.low = Math.min(axis.low, height);
        axis.high = Math.max(axis.high, height);
      }
    }
  return {
    samples,
    low,
    high,
    rise: high - low,
    width,
    depth,
    riseX: Math.max(...columns.map((r) => r.high - r.low)),
    riseZ: Math.max(...rows.map((r) => r.high - r.low)),
  };
}
export type SlopeSurvey = ReturnType<typeof surveySlope>;
export function slopeBypass(w: World, actor?: Pick<Player, 'authority'>) {
  return (
    constructionRules(w.settings).constructionOwnerSlopeBypass && (actor?.authority ?? 0) >= 20
  );
}
export function slopeAssessment(w: World, surveys: SlopeSurvey[], use: SlopeUse = 'building') {
  const r = constructionRules(w.settings);
  const grade =
    use === 'field'
      ? r.farmMaximumGrade
      : use === 'pasture'
        ? r.pastureMaximumGrade
        : r.constructionMaximumGrade;
  const ceiling =
    use === 'field'
      ? r.farmMaximumRise
      : use === 'pasture'
        ? r.pastureMaximumRise
        : r.constructionMaximumRise;
  const low = Math.min(...surveys.map((s) => s.low)),
    high = Math.max(...surveys.map((s) => s.high));
  let measuredGrade = 0,
    offender: { rise: number; allowed: number; grade: number } | undefined;
  for (const s of surveys)
    for (const [rise, span] of [
      [s.riseX, s.width],
      [s.riseZ, s.depth],
    ]) {
      const percent = (rise / span) * 100,
        allowed = Math.min(ceiling, (span * grade) / 100 + r.constructionSlopeAllowance);
      measuredGrade = Math.max(measuredGrade, percent);
      if (rise > allowed + 1e-8 && (!offender || rise - allowed > offender.rise - offender.allowed))
        offender = { rise, allowed, grade: percent };
    }
  if (high - low > ceiling + 1e-8)
    offender = { rise: high - low, allowed: ceiling, grade: measuredGrade };
  const reason = offender
    ? `Ground rises ${offender.rise.toFixed(1)} m (${Math.round(offender.grade)}%) across this footprint; level it to within ${offender.allowed.toFixed(1)} m with earthworks, or choose a flatter site`
    : undefined;
  return {
    reason,
    grade: measuredGrade,
    target: (low + high) / 2,
    rise: high - low,
    ceiling,
    gradeLimit: grade,
    allowance: r.constructionSlopeAllowance,
  };
}
