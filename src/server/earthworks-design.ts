import { surveyEarthwork } from '../shared/earthworks-work';
import { constructionRules } from '../shared/construction-rules';
import { BULLDOZER } from '../shared/earthmoving-definitions';
// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import type { World } from '../shared/types';
import { constructionRuleFields } from '../shared/construction-rules';
import { maxCoordinate } from '../shared/world-limits';
import { earthworkSiteReason } from '../shared/earthworks-site';
const number = z.number().finite();
export const earthworkDesignSchema = z
  .object({
    id: z.string().min(1).max(120),
    owner: z.string().min(1).max(120),
    created: number.min(-1e12).max(0),
    x: number.min(-maxCoordinate).max(maxCoordinate),
    z: number.min(-maxCoordinate).max(maxCoordinate),
    width: number.min(1).max(constructionRuleFields.earthworksMaximumSide.max),
    depth: number.min(1).max(constructionRuleFields.earthworksMaximumSide.max),
    rotation: number,
    target: number.min(-maxCoordinate).max(maxCoordinate),
    shoulder: number.positive().max(constructionRuleFields.earthworksMaximumShoulder.max),
    shoulderGrade: number.positive().max(constructionRuleFields.earthworksMaximumGrade.max),
    progress: number.min(0).max(1),
    finish: z.enum(['bare', 'gravel', 'grass']),
    worked: z.boolean().optional(),
    berm: z
      .object({
        x: number.min(-maxCoordinate).max(maxCoordinate),
        z: number.min(-maxCoordinate).max(maxCoordinate),
        radius: number.positive().max(constructionRuleFields.earthworksBermRadius.max),
        height: number.min(0).max(constructionRuleFields.earthworksBermHeight.max),
      })
      .strict()
      .optional(),
  })
  .strict();
export function exportEarthworks(w: World) {
  return w.earthworks?.map(({ work, ...p }) => ({
    ...p,
    ...(work ? { worked: true } : {}),
    created: Math.min(0, p.created - w.time),
  }));
}
export function importEarthworks(w: World, pads: z.infer<typeof earthworkDesignSchema>[] = []) {
  if (new Set(pads.map((p) => p.id)).size !== pads.length)
    throw Error('Duplicate earthwork pad IDs');
  w.earthworks = [];
  for (const input of pads) {
    const { worked, ...shape } = input;
    const p: import('../shared/earthworks-ground').Earthwork = {
      ...shape,
      created: w.time + input.created,
      owner: w.owner,
    };
    if (worked) {
      const s = surveyEarthwork(w, { id: w.owner, vehicle: BULLDOZER }, p);
      p.work = {
        cut: s.cut,
        fill: s.fill,
        volume: s.volume,
        done: s.volume * p.progress,
        delivered: Math.max(0, s.fill - s.cut) * p.progress,
        material: s.material,
        effort: s.effort,
        active: false,
        operators: [],
        seconds: 0,
        spoilProduced: Math.floor(
          Math.max(0, s.cut - s.fill) *
            p.progress *
            constructionRules(w.settings).earthworksSpoilConversion,
        ),
        spoil: {},
        published: w.time,
        weatherDays: 0,
      };
    }
    const reason = earthworkSiteReason(w, p, true);
    if (reason) throw Error(reason);
    w.earthworks = [...w.earthworks, p];
  }
}
