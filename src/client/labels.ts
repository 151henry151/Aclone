// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { NameTagRules } from '../shared/name-tag-rules';
/**
 * Labels write no depth, so any transparent mesh drawn after them (the sea, glows, smoke)
 * would paint over them. Ordering them last keeps them on top.
 */
export const labelOrder = 10;
export function label(
  text: string,
  color = '#eee4c8',
  scale = 1,
  c = document.createElement('canvas'),
) {
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgba(27,37,30,.85)';
  ctx.fillRect(0, 8, 512, 70);
  ctx.strokeStyle = '#8c9671';
  ctx.strokeRect(1, 9, 510, 68);
  ctx.font = '600 24px monospace';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(text.slice(0, 30), 256, 53);
  const texture = new T.CanvasTexture(c);
  const s = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: false }));
  s.scale.set(15 * scale, 2.8 * scale, 1);
  s.renderOrder = labelOrder;
  return s;
}
export function pilotLabel(name: string, canvas = document.createElement('canvas')) {
  canvas.width = 384;
  canvas.height = 80;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(20,34,37,.55)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 376, 72, 10);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e6dfc9';
  ctx.font = '500 42px sans-serif';
  ctx.fillText(name.slice(0, 30), 192, 54, 348);
  const tag = new T.Sprite(
    new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), depthWrite: false }),
  );
  tag.scale.set(6, 1.25, 1);
  tag.renderOrder = labelOrder;
  return tag;
}

const labelPosition = new T.Vector3(),
  labelDirection = new T.Vector3(),
  cameraPosition = new T.Vector3();
/** Preserve metre-scale signage at distance but keep it readable beside an entrance. */
export function capWorldLabel(tag: T.Sprite, camera: T.PerspectiveCamera) {
  const original = (tag.userData.labelScale ??= tag.scale.clone());
  tag.getWorldPosition(labelPosition);
  camera.getWorldPosition(cameraPosition);
  camera.getWorldDirection(labelDirection);
  const depth = Math.max(0.001, labelPosition.sub(cameraPosition).dot(labelDirection));
  const height = 2 * depth * Math.tan(T.MathUtils.degToRad(camera.fov) / 2) * 0.035;
  tag.scale.copy(original).multiplyScalar(Math.min(1, height / original.y));
  // The building shell is frozen, but this camera-sized sprite must keep moving.
  tag.matrixAutoUpdate = tag.matrixWorldAutoUpdate = true;
  tag.updateMatrixWorld();
}

const pilotWorldScale = new T.Vector3();
/** Player proximity is independent of camera orbit; pixel caps include custom parent scaling. */
export function updatePilotLabel(
  tag: T.Sprite,
  viewer: { x: number; y: number; z: number },
  actor: { x: number; y: number; z: number },
  camera: T.PerspectiveCamera,
  rules: NameTagRules,
  viewportHeight: number,
) {
  const distance = Math.hypot(viewer.x - actor.x, viewer.y - actor.y, viewer.z - actor.z);
  tag.visible =
    rules.pilotNameTags && rules.pilotNameTagOpacity > 0 && distance < rules.pilotNameTagRange;
  if (!tag.visible) return;
  const fade =
    distance <= rules.pilotNameTagFadeStart
      ? 1
      : (rules.pilotNameTagRange - distance) /
        (rules.pilotNameTagRange - rules.pilotNameTagFadeStart);
  tag.material.opacity = rules.pilotNameTagOpacity * fade;
  const original = (tag.userData.labelScale ??= tag.scale.clone());
  tag.scale.copy(original).multiplyScalar(rules.pilotNameTagScale);
  tag.getWorldPosition(labelPosition);
  camera.getWorldPosition(cameraPosition);
  camera.getWorldDirection(labelDirection);
  const depth = Math.max(0.001, labelPosition.sub(cameraPosition).dot(labelDirection));
  const cap =
    (2 * depth * Math.tan(T.MathUtils.degToRad(camera.fov) / 2) * rules.pilotNameTagMaxPixels) /
    Math.max(1, viewportHeight);
  tag.getWorldScale(pilotWorldScale);
  tag.scale.multiplyScalar(Math.min(1, cap / Math.max(0.001, pilotWorldScale.y)));
  tag.updateMatrixWorld();
}
