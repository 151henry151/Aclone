// SPDX-License-Identifier: GPL-3.0-or-later
import { buildingPlan } from '../shared/building-shapes';
import { dockPoint } from '../shared/boathouse';
import { inlandLevel } from '../shared/inland-water';
import { highWater } from '../shared/ocean';
import { terrainHeight } from '../shared/terrain';
import { waterSourceRules } from '../shared/water-source-rules';
import { waterworksSite } from '../shared/shoreline';
import type { Building, World } from '../shared/types';

/** A placement-time aid only; the shared site validators still decide permission. */
export function waterfrontPreview(w: World, b: Building, origin: { x: number; z: number }) {
  if (!['boathouse', 'pumpHouse', 'waterworks'].includes(b.kind)) return undefined;
  const rules = waterSourceRules(w.settings),
    pump = b.kind === 'pumpHouse',
    boat = b.kind === 'boathouse',
    reach = pump ? rules.pumpIntakeMaxReach : rules.desalinationIntakeMaxReach,
    intake = pump
      ? b.waterSource?.intake
      : boat
        ? undefined
        : waterworksSite(w, b, b.rotation, true)?.intake,
    end = intake ?? dockPoint(b, 0, -reach),
    plan = buildingPlan(b),
    volumes = [...plan.volumes, ...(plan.fixtures ?? []), ...(plan.waterfront ?? [])];
  const points = volumes.flatMap((v) =>
    [-1, 1].flatMap((x) =>
      [-1, 1].map((z) => dockPoint(b, v.x + (x * v.width) / 2, v.z + (z * v.depth) / 2)),
    ),
  );
  if (!boat) points.push(end);
  const extentX = Math.max(8, ...points.map((p) => Math.abs(p.x - origin.x))),
    extentZ = Math.max(8, ...points.map((p) => Math.abs(p.z - origin.z))),
    scale = Math.min(408 / (extentX * 2 + 8), 136 / (extentZ * 2 + 8));
  const directions = [
    'north',
    'north-west',
    'west',
    'south-west',
    'south',
    'south-east',
    'east',
    'north-east',
  ];
  const direction =
    directions[
      Math.round((((b.rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) / (Math.PI / 4)) % 8
    ];
  const help = boat
    ? `Keep the workshop and equipment yard on dry land; point the rear jetty toward water to the ${direction}. The dashed area shows the jetty and berth; the far end needs deep, clear water. Move along the shore or rotate if the site is refused.`
    : pump
      ? `Use a fresh-water spring, river or pond; use a desalination plant at the sea. The rear intake points toward water to the ${direction}, ${rules.pumpIntakeMinReach}–${rules.pumpIntakeMaxReach} m from the building, and needs ${rules.pumpIntakeDepth} m of depth. Keep the foundation ${rules.pumpFreeboard} m above fresh water. ${b.waterSource?.spring ? 'Spring intake connected; the foundation snaps to align with it.' : b.waterSource ? 'Fresh-water intake connected.' : 'No usable fresh-water intake at this position and bearing.'}`
      : `${rules.desalinationRequiresOcean ? 'Use the sea coast' : 'This world also permits enclosed water'}, with the rear intake toward water to the ${direction}, ${rules.desalinationIntakeMinReach}–${rules.desalinationIntakeMaxReach} m behind the building. Keep the foundation dry at high tide and the intake at least ${rules.desalinationIntakeDepth} m underwater at low tide.${intake ? ' Sea-water intake connected.' : ''}`;
  const pixel = (p: { x: number; z: number }) => ({
    x: 220 + (p.x - origin.x) * scale,
    y: 95 + (p.z - origin.z) * scale,
  });
  return {
    scale,
    help,
    background(ctx: CanvasRenderingContext2D) {
      // Fixed screen-space budget, sampled only when the player edits the design.
      ctx.fillStyle = '#2c6784';
      for (let y = 28; y < 160; y += 4)
        for (let x = 8; x < 432; x += 4) {
          const wx = origin.x + (x + 2 - 220) / scale,
            wz = origin.z + (y + 2 - 95) / scale;
          if (terrainHeight(w, wx, wz) < inlandLevel(w, wx, wz, highWater(w)))
            ctx.fillRect(x, y, 4, 4);
        }
    },
    overlay(ctx: CanvasRenderingContext2D) {
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#9adce8';
      ctx.fillStyle = '#e8e4cd';
      ctx.font = '12px sans-serif';
      if (boat) {
        ctx.setLineDash([5, 3]);
        for (const v of plan.waterfront ?? []) {
          const corners = [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([x, z]) => pixel(dockPoint(b, v.x + (x * v.width) / 2, v.z + (z * v.depth) / 2)));
          ctx.beginPath();
          corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
          ctx.closePath();
          ctx.stroke();
        }
        ctx.fillText('Dashed: jetty / berth', 12, 154);
      } else {
        const a = pixel(b),
          c = pixel(end);
        ctx.setLineDash(intake ? [] : [4, 3]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(intake ? 'Intake connected' : 'Dashed: intake search direction', 12, 154);
      }
      ctx.fillText('Blue: water at high tide', 240, 20);
      ctx.restore();
    },
  };
}
