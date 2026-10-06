// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import { propertyQuote } from '../shared/property';
import { money } from '../shared/simulation';
import type { Building, World } from '../shared/types';
import { labelOrder } from './labels';

/** Text for an owner-listed property's price tag; vacant estates have no seller to list them. */
export function saleTagText(w: World, b: Building) {
  if (!b.owner || !b.forSale || b.government) return undefined;
  return `For sale · ${money(propertyQuote(w, b).total, w.settings.denariiPerSheckle)}`;
}

/** A small red luggage tag that hangs from its string, so `center` is the top of the sprite. */
export function saleTag(text: string, canvas = document.createElement('canvas')) {
  const price = text.split(' · ').pop() ?? text;
  canvas.width = 512;
  canvas.height = 224;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '700 54px Georgia, serif';
  const width = Math.min(480, Math.max(260, ctx.measureText(price).width + 96)),
    left = 256 - width / 2,
    right = 256 + width / 2,
    top = 44,
    bottom = 214,
    chamfer = 30;
  // String from the hanging point down to the eyelet.
  ctx.strokeStyle = 'rgba(232,205,140,.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(244, 2);
  ctx.lineTo(256, 70);
  ctx.lineTo(268, 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(left + chamfer, top);
  ctx.lineTo(right - chamfer, top);
  ctx.lineTo(right, top + chamfer);
  ctx.lineTo(right, bottom - 14);
  ctx.quadraticCurveTo(right, bottom, right - 14, bottom);
  ctx.lineTo(left + 14, bottom);
  ctx.quadraticCurveTo(left, bottom, left, bottom - 14);
  ctx.lineTo(left, top + chamfer);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, '#c4473a');
  fill.addColorStop(1, '#8d2620');
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#e8cd8c';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Stitched inner edge.
  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = 'rgba(255,236,200,.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(left + 12, top + 34, width - 24, bottom - top - 46);
  ctx.restore();
  // Brass eyelet the string passes through.
  ctx.beginPath();
  ctx.arc(256, 70, 11, 0, Math.PI * 2);
  ctx.fillStyle = '#3a1512';
  ctx.fill();
  ctx.strokeStyle = '#e8cd8c';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f6e7c4';
  ctx.font = '600 22px monospace';
  ctx.letterSpacing = '6px';
  ctx.fillText('FOR SALE', 259, 118);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#fff6e0';
  ctx.font = '700 54px Georgia, serif';
  ctx.fillText(price, 256, 182, width - 40);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  const tag = new T.Sprite(
    new T.SpriteMaterial({ map: texture, depthTest: false, transparent: true }),
  );
  tag.center.set(0.5, 1);
  tag.scale.set(3.6, (3.6 * 224) / 512, 1);
  tag.renderOrder = labelOrder;
  tag.userData.saleText = text;
  return tag;
}
