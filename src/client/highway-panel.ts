// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
import type { Player } from '../shared/types';
import type { vehicleDef } from '../shared/vehicle-config';
type Vehicle = ReturnType<typeof vehicleDef>;
const mph = 1 / 0.44704;
export function highwayDials(v: Vehicle) {
  return [
    { label: 'MPH', max: Math.max(80, Math.ceil((v.speed * mph) / 20) * 20) },
    { label: 'FUEL %', max: 100 },
    { label: 'CONDITION %', max: 100 },
  ];
}
export function highwayNeedles(p: Player, v: Vehicle) {
  const values = [
    Math.abs(p.speed) * mph,
    (100 * p.fuel) / (v.tank ?? 1),
    p.fleetState?.[p.vehicle]?.condition ?? 100,
  ];
  return highwayDials(v).map(
    (dial, i) => Math.PI * (-0.75 + 1.5 * T.MathUtils.clamp(values[i] / dial.max, 0, 1)),
  );
}
/** Static shared scales; live needles move without repainting a texture each frame. */
export function drawHighwayPanel(
  c: CanvasRenderingContext2D,
  dials: ReturnType<typeof highwayDials>,
) {
  c.fillStyle = '#202b2c';
  c.fillRect(0, 0, 1024, 384);
  for (const [i, d] of dials.entries()) {
    const x = 172 + i * 340,
      y = 177;
    c.fillStyle = '#94a29e';
    c.beginPath();
    c.arc(x, y, 137, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#101b20';
    c.beginPath();
    c.arc(x, y, 128, 0, Math.PI * 2);
    c.fill();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let tick = 0; tick <= 16; tick++) {
      const a = Math.PI * (0.75 + (tick / 16) * 1.5),
        major = tick % 4 === 0;
      c.strokeStyle = '#f3ebd7';
      c.lineWidth = major ? 4 : 2;
      c.beginPath();
      c.moveTo(x + Math.cos(a) * 119, y + Math.sin(a) * 119);
      c.lineTo(x + Math.cos(a) * (major ? 101 : 110), y + Math.sin(a) * (major ? 101 : 110));
      c.stroke();
      if (major) {
        c.fillStyle = '#f3ebd7';
        c.font = 'bold 26px sans-serif';
        c.fillText(
          String(Math.round((tick / 16) * d.max)),
          x + Math.cos(a) * 79,
          y + Math.sin(a) * 79,
        );
      }
    }
    c.fillStyle = '#eee5cb';
    c.font = 'bold 28px sans-serif';
    c.fillText(d.label, x, 335);
  }
}
const textures = new Map<number, T.CanvasTexture>();
export function highwayPanelTexture(v: Vehicle) {
  if (typeof document === 'undefined') return null;
  const dials = highwayDials(v),
    key = dials[0].max;
  let texture = textures.get(key);
  if (!texture) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 384;
    drawHighwayPanel(canvas.getContext('2d')!, dials);
    texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    texture.anisotropy = 4;
    texture.userData.shared = true;
    textures.set(key, texture);
  }
  return texture;
}
