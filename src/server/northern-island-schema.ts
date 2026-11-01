// SPDX-License-Identifier: GPL-3.0-or-later
import { z } from 'zod';
import { maxCoordinate } from '../shared/world-limits';
const coordinate = z.number().finite().min(-maxCoordinate).max(maxCoordinate);
const level = z.number().finite().min(-100).max(2500);
const point = z.object({ x: coordinate, z: coordinate });
/** Bounded portable geography. Saved resource IDs also include the original survey. */
export const northernIslandSchema = z
  .object({
    version: z.literal(1),
    seed: z.number().finite(),
    radius: z.number().min(1000).max(24000),
    centreZ: coordinate,
    preserveZ: coordinate,
    blendZ: coordinate,
    mountain: point.extend({
      height: z.number().min(100).max(2000),
      radius: z.number().min(500).max(6000),
    }),
    regions: z
      .array(
        point.extend({
          radius: z.number().min(100).max(10000),
          relief: z.number().min(0.1).max(2),
          forest: z.number().min(0).max(1),
        }),
      )
      .max(24),
    rivers: z
      .array(
        z.object({
          id: z.string().max(80),
          name: z.string().max(100),
          points: z
            .array(
              point.extend({
                level,
                width: z.number().min(2).max(200),
                depth: z.number().min(0.1).max(20),
              }),
            )
            .min(2)
            .max(600),
        }),
      )
      .max(8),
    ponds: z
      .array(
        point.extend({
          id: z.string().max(80),
          rx: z.number().min(5).max(500),
          rz: z.number().min(5).max(500),
          level,
          depth: z.number().min(0.1).max(20),
        }),
      )
      .max(64),
    resources: z
      .array(
        point.extend({
          id: z
            .string()
            .regex(/^[a-zA-Z0-9:_-]+$/)
            .max(120),
          item: z.enum(['logs', 'stone', 'gravel', 'dirt']),
          name: z.string().min(1).max(100),
          capacity: z.number().int().min(1).max(10000),
          regrowth: z.number().int().min(10).max(86400),
        }),
      )
      .max(10000),
    previousArea: z.number().positive().max(1e10),
    area: z.number().positive().max(1e10),
  })
  .superRefine((n, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (n.blendZ >= n.preserveZ) issue('Northern blend must end south of its start');
    if (new Set(n.resources.map((r) => r.id)).size !== n.resources.length)
      issue('Duplicate northern resource IDs');
    if (new Set(n.rivers.map((r) => r.id)).size !== n.rivers.length) issue('Duplicate river IDs');
    for (const r of n.rivers)
      for (let i = 0; i < r.points.length; i++) {
        const p = r.points[i];
        if (p.z + p.width / 2 >= n.preserveZ)
          issue('Rivers must remain north of the preserved landscape');
        if (
          i &&
          (p.level > r.points[i - 1].level + 0.001 ||
            Math.hypot(p.x - r.points[i - 1].x, p.z - r.points[i - 1].z) > 250)
        )
          issue('River reaches must be connected and flow downhill');
      }
  });
