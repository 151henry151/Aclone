// SPDX-License-Identifier: GPL-3.0-or-later
import { buildingArchitectures } from '../shared/building-architecture';
import { sizesForBuilding } from '../shared/building-designs';
import { buildingPlan, buildingBounds } from '../shared/building-shapes';
const frames = new Map<string, { radius: number; horizontal: number; vertical: number }>();
export const previewDirection = { x: 0.6, y: 0.46, z: 1 };
/** One orthographic frame per built-in type. The full horizontal diagonal allows every
 * rotation; projected height includes the view's elevation and roof-equipment clearance. */
export function buildingPreviewFrame(kind: string) {
  const cached = frames.get(kind);
  if (cached) return cached;
  const length = Math.hypot(previewDirection.x, previewDirection.y, previewDirection.z);
  const sinElevation = previewDirection.y / length,
    cosElevation = Math.hypot(previewDirection.x, previewDirection.z) / length;
  const frame = { radius: 2, horizontal: 2, vertical: 2 };
  for (const architecture of buildingArchitectures(kind))
    for (const size of sizesForBuilding(kind)) {
      const b = buildingBounds(
        buildingPlan({ id: 'preview', kind, architecture: architecture.id, size: size.id }),
      );
      const horizontal = Math.hypot(b.width + 2, b.depth + 2) / 2,
        height = (b.height + 3) / 2;
      frame.radius = Math.max(frame.radius, Math.hypot(horizontal, height));
      frame.horizontal = Math.max(frame.horizontal, horizontal);
      frame.vertical = Math.max(frame.vertical, horizontal * sinElevation + height * cosElevation);
    }
  frames.set(kind, frame);
  return frame;
}
export function buildingPreviewRadius(kind: string) {
  return buildingPreviewFrame(kind).radius;
}
