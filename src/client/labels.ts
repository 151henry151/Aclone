// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
/**
 * Labels write no depth, so any transparent mesh drawn after them (the sea, glows, smoke)
 * would paint over them. Ordering them last keeps them on top.
 */
const labelOrder = 10;
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
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(20,34,37,.9)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 376, 104, 22);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(180, 108);
  ctx.lineTo(192, 124);
  ctx.lineTo(204, 108);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#a9dbcb';
  ctx.font = '600 19px sans-serif';
  ctx.fillText('● PILOT', 192, 36);
  ctx.fillStyle = '#fff4d8';
  ctx.font = '600 28px sans-serif';
  ctx.fillText(name.slice(0, 30), 192, 78, 348);
  const tag = new T.Sprite(
    new T.SpriteMaterial({ map: new T.CanvasTexture(canvas), depthWrite: false }),
  );
  tag.scale.set(6, 2, 1);
  tag.renderOrder = labelOrder;
  return tag;
}
