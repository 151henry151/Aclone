// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { Bridge } from '../shared/bridge-types';
import { bridgeRuleFields } from '../shared/bridge-rules';
import { maxCoordinate } from '../shared/world-limits';
import { BRIDGE_RAIL_WIDTH } from '../shared/bridge-geometry';
const point = z.object({
  x: z.number().finite().min(-maxCoordinate).max(maxCoordinate),
  z: z.number().finite().min(-maxCoordinate).max(maxCoordinate),
});
const money = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const bill = z.object({
  cash: money,
  materials: z.object({ steel: money, wood: money, gravel: money, stone: money }),
});
const height = z.number().finite().min(-1e5).max(1e5);
const age = z.number().finite().min(-1e12).max(0);
const ramp = z.object({
  rows: z
    .array(
      z.object({
        distance: z.number().finite().nonnegative().max(bridgeRuleFields.bridgeApproachLength.max),
        heights: z.array(height).min(2).max(64),
      }),
    )
    .min(2)
    .max(bridgeRuleFields.bridgeApproachLength.max + 1),
});
export const bridgeDesignSchema = z
  .object({
    id: z.string().regex(/^bridge:[1-9][0-9]{0,8}$/),
    owner: z.string().max(120),
    a: point,
    b: point,
    approachA: point,
    approachB: point,
    width: z
      .number()
      .finite()
      .min(bridgeRuleFields.bridgeNarrowWidth.min)
      .max(bridgeRuleFields.bridgeWidth.max),
    deckY: height,
    thickness: z
      .number()
      .finite()
      .min(bridgeRuleFields.bridgeDeckThickness.min)
      .max(bridgeRuleFields.bridgeDeckThickness.max),
    grade: z
      .number()
      .finite()
      .min(bridgeRuleFields.bridgeMaximumGrade.min)
      .max(bridgeRuleFields.bridgeMaximumGrade.max),
    foundationLength: z
      .number()
      .finite()
      .min(bridgeRuleFields.bridgeFoundationLength.min)
      .max(bridgeRuleFields.bridgeFoundationLength.max),
    foundations: z.tuple([height, height]),
    ramps: z.tuple([ramp, ramp]),
    river: z.string().min(1).max(120),
    highWater: height,
    bill,
    paid: bill,
    contributors: z.record(z.string().max(120), bill),
    foundedAt: age,
    completedAt: age.optional(),
    wearAt: age,
    condition: z.number().finite().min(0).max(100),
    revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .superRefine((b, ctx) => {
    try {
      validateBridgeDesign(b);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : 'Invalid bridge',
      });
    }
  });
function validateBridgeDesign(b: Bridge) {
  const check = (valid: boolean, message: string) => {
    if (!valid) throw Error('Bridge ' + message);
  };
  const span = Math.hypot(b.b.x - b.a.x, b.b.z - b.a.z),
    dx = (b.b.x - b.a.x) / span,
    dz = (b.b.z - b.a.z) / span;
  check(
    span >= 2 * b.foundationLength && span <= bridgeRuleFields.bridgeMaximumSpan.max,
    'span is invalid',
  );
  check(b.deckY - b.thickness > b.highWater, 'deck must clear high water');
  const columns = Math.ceil((b.width + 2 * BRIDGE_RAIL_WIDTH) / 2) * 2 + 1;
  for (const end of [0, 1] as const) {
    const bank = end === 0 ? b.a : b.b,
      toe = end === 0 ? b.approachA : b.approachB;
    const distance = Math.hypot(toe.x - bank.x, toe.z - bank.z),
      direction = end === 0 ? -1 : 1,
      rows = b.ramps[end].rows;
    check(
      Math.abs(toe.x - bank.x - direction * dx * distance) < 1e-6 &&
        Math.abs(toe.z - bank.z - direction * dz * distance) < 1e-6,
      'approach must align with span',
    );
    check(
      rows[0].distance === 0 &&
        Math.abs(rows.at(-1)!.distance - distance) < 1e-6 &&
        distance >= b.foundationLength,
      'ramp must reach its bank and toe',
    );
    check(
      rows[0].heights.every((y) => Math.abs(y - b.deckY) < 1e-6),
      'ramp must meet deck',
    );
    for (let i = 0; i < rows.length; i++) {
      check(rows[i].heights.length === columns, 'ramp columns do not match its width');
      if (i) {
        const step = rows[i].distance - rows[i - 1].distance;
        check(
          step > 0 &&
            rows[i].heights.every(
              (y, j) => Math.abs(y - rows[i - 1].heights[j]) <= step * b.grade + 1e-6,
            ),
          'ramp grade is invalid',
        );
      }
    }
  }
  check(
    b.foundations.every((y) => y <= b.deckY),
    'foundation must sit below the deck',
  );
  const donors = Object.values(b.contributors);
  for (const k of ['cash', 'steel', 'wood', 'gravel', 'stone'] as const) {
    const get = (v: Bridge['bill']) => (k === 'cash' ? v.cash : v.materials[k]);
    check(get(b.paid) <= get(b.bill), 'funding exceeds the bill');
    check(
      donors.reduce((sum, v) => sum + get(v), 0) === get(b.paid),
      'contributions do not match the paid bill',
    );
    check(
      b.completedAt === undefined || get(b.paid) === get(b.bill),
      'completed project is not fully funded',
    );
  }
}
export function exportBridges(bridges: Bridge[] | undefined, time: number) {
  return bridges?.map((b) => ({
    ...structuredClone(b),
    closure: undefined,
    foundedAt: Math.min(0, b.foundedAt - time),
    completedAt: b.completedAt === undefined ? undefined : Math.min(0, b.completedAt - time),
    wearAt: Math.min(0, b.wearAt - time),
  }));
}
