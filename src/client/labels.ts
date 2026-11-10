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
  const ctx = canvas.getContext('2d')!;
  ctx.font = '500 48px sans-serif';
  const measured = ctx.measureText(name.slice(0, 30))?.width;
  canvas.width = Math.max(160, Math.min(1024, Math.ceil(measured ?? 356) + 28));
  canvas.height = 80;
  ctx.fillStyle = 'rgba(20,34,37,.55)';
  ctx.beginPath();
  ctx.roundRect(4, 4, canvas.width - 8, 72, 10);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e6dfc9';
  ctx.font = '500 48px sans-serif';
  ctx.fillText(name.slice(0, 30), canvas.width / 2, 56, canvas.width - 28);
  const tag = new T.Sprite(
    new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), depthWrite: false }),
  );
  tag.scale.set((canvas.width / 80) * 1.25, 1.25, 1);
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

export interface ContextLabel {
  id: string;
  tag: T.Sprite;
  kind: 'pilot' | 'building' | 'vehicle' | 'sale';
  subject: T.Vector3;
  owner?: T.Object3D;
}
const screenPoint = new T.Vector3(),
  tagPoint = new T.Vector3(),
  worldScale = new T.Vector3();
/** A bounded set of readable names: focus first, then suppress screen-space overlap.
 * Authored course signs are deliberately not candidates. No scene triangle raycasts. */
export function updateContextLabels(
  candidates: ContextLabel[],
  viewer: { x: number; y: number; z: number },
  camera: T.PerspectiveCamera,
  r: NameTagRules,
  width: number,
  height: number,
  scenic: boolean,
  occluded?: (c: ContextLabel) => boolean,
) {
  camera.updateMatrixWorld();
  const ranked: {
    c: ContextLabel;
    score: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
  }[] = [];
  for (const c of candidates) {
    const tag = c.tag;
    tag.visible = false;
    if (scenic || (c.kind === 'pilot' ? !r.pilotNameTags : !r.worldNameTags)) continue;
    const range = c.kind === 'pilot' ? r.pilotNameTagRange : r.worldNameTagRange;
    const start = c.kind === 'pilot' ? r.pilotNameTagFadeStart : r.worldNameTagFadeStart;
    const opacity = c.kind === 'pilot' ? r.pilotNameTagOpacity : r.worldNameTagOpacity;
    const distance = Math.hypot(
      viewer.x - c.subject.x,
      viewer.y - c.subject.y,
      viewer.z - c.subject.z,
    );
    if (distance >= range || opacity <= 0) continue;
    screenPoint.copy(c.subject).project(camera);
    if (
      screenPoint.z < -1 ||
      screenPoint.z > 1 ||
      Math.abs(screenPoint.x) > 1 ||
      Math.abs(screenPoint.y) > 1
    )
      continue;
    const focus = Math.hypot((screenPoint.x * width) / height, screenPoint.y) / 2;
    if (r.focusNameTags && focus > r.nameTagFocusRadius) continue;
    const original = (tag.userData.labelScale ??= tag.scale.clone());
    tag.scale.copy(original).multiplyScalar(c.kind === 'pilot' ? r.pilotNameTagScale : 1);
    tag.matrixAutoUpdate = tag.matrixWorldAutoUpdate = true;
    tag.getWorldPosition(tagPoint);
    labelPosition.copy(tagPoint).applyMatrix4(camera.matrixWorldInverse);
    const depth = -labelPosition.z;
    if (depth <= 0) continue;
    const pixelsPerMetre = height / (2 * depth * Math.tan(T.MathUtils.degToRad(camera.fov) / 2));
    tag.getWorldScale(worldScale);
    const cap =
      c.kind === 'pilot'
        ? Math.min(r.pilotNameTagMaxPixels, r.worldNameTagMaxPixels)
        : r.worldNameTagMaxPixels;
    tag.scale.multiplyScalar(Math.min(1, cap / (worldScale.y * pixelsPerMetre)));
    tag.updateMatrixWorld();
    tag.getWorldScale(worldScale);
    tagPoint.project(camera);
    const x = ((tagPoint.x + 1) * width) / 2,
      y = ((1 - tagPoint.y) * height) / 2;
    const h = worldScale.y * pixelsPerMetre,
      w = worldScale.x * pixelsPerMetre;
    if (x - w / 2 < 0 || x + w / 2 > width || y - h / 2 < 0 || y + h / 2 > height) continue;
    tag.material.depthTest = true;
    tag.material.depthWrite = false;
    tag.material.sizeAttenuation = true;
    tag.material.opacity =
      opacity * (distance <= start ? 1 : (range - distance) / Math.max(0.001, range - start));
    ranked.push({
      c,
      score: focus,
      left: x - w / 2,
      right: x + w / 2,
      top: y - h / 2,
      bottom: y + h / 2,
    });
  }
  ranked.sort((a, b) => a.score - b.score || a.c.id.localeCompare(b.c.id));
  const accepted: typeof ranked = [];
  for (const entry of ranked.slice(0, r.nameTagMaxVisible)) {
    const pad = r.nameTagOverlapPadding;
    if (
      accepted.some(
        (a) =>
          entry.left < a.right + pad &&
          entry.right > a.left - pad &&
          entry.top < a.bottom + pad &&
          entry.bottom > a.top - pad,
      ) ||
      occluded?.(entry.c)
    )
      continue;
    entry.c.tag.visible = true;
    accepted.push(entry);
  }
  return accepted.map((e) => e.c.id);
}
/** Cache structural boxes once per model; only the few best label candidates are tested. */
export class LabelOcclusion {
  private cache = new WeakMap<T.Object3D, T.Box3[]>();
  private ray = new T.Ray();
  private hit = new T.Vector3();
  blocked(c: ContextLabel, camera: T.Camera, buildings: readonly T.Group[]) {
    const reach = camera.position.distanceTo(c.subject);
    if (!reach) return false;
    this.ray.origin.copy(camera.position);
    this.ray.direction.copy(c.subject).sub(camera.position).divideScalar(reach);
    for (const g of buildings) {
      if (g === c.owner || !g.visible) continue;
      let boxes = this.cache.get(g);
      if (!boxes) {
        g.updateMatrix();
        boxes = (g.userData.cameraVolumes ?? []).map((b: T.Box3) =>
          b.clone().applyMatrix4(g.matrix),
        );
        this.cache.set(g, boxes!);
      }
      for (const box of boxes!) {
        // A chase camera can be inside the viewer's own containing building.
        if (box.containsPoint(camera.position)) continue;
        const hit = this.ray.intersectBox(box, this.hit);
        if (hit && camera.position.distanceTo(hit) < reach) return true;
      }
    }
    return false;
  }
}
