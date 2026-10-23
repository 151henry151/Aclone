// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player } from '../shared/types';
import { fuelCapacity } from '../shared/tractors';
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** Six textured flight instruments. No little 3D gauge rings or moving needle meshes. */
export function drawFlightPanel(c: CanvasRenderingContext2D, p?: Player, agl = 0, seaLevel = 0) {
  c.fillStyle = '#26322f';
  c.fillRect(0, 0, 1024, 512);
  c.strokeStyle = '#b8a16d';
  c.lineWidth = 6;
  c.beginPath();
  c.roundRect(8, 8, 1008, 496, 64);
  c.stroke();
  for (let x = 28; x < 1024; x += 160) {
    c.fillStyle = '#7f8b7e';
    c.beginPath();
    c.arc(x, 26, 4, 0, Math.PI * 2);
    c.fill();
  }
  const f = p?.flight;
  const degrees = (r: number) => (r * 180) / Math.PI;
  const heading = ((degrees(p?.heading ?? 0) % 360) + 360) % 360;
  const rpm = p?.engine ? 650 + (f?.throttle ?? 0) * 2100 : 0;
  const dials = [
    { x: 184, y: 149, label: 'AIRSPEED · MPH', max: 120, value: Math.abs(p?.speed ?? 0) * 2.237 },
    { x: 512, y: 149, label: 'ATTITUDE', max: 1, value: 0 },
    { x: 840, y: 149, label: 'ALT · METRES MSL', max: 1000, value: (p?.y ?? 0) - seaLevel },
    { x: 184, y: 367, label: 'HEADING', max: 360, value: heading },
    { x: 512, y: 367, label: 'CLIMB · M/S', max: 20, value: 10 + (f?.vy ?? 0) },
    { x: 840, y: 367, label: 'RPM × 100', max: 30, value: rpm / 100 },
  ];
  for (const [i, d] of dials.entries()) {
    c.fillStyle = '#879488';
    c.beginPath();
    c.arc(d.x, d.y, 98, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#0f1e23';
    c.beginPath();
    c.arc(d.x, d.y, 90, 0, Math.PI * 2);
    c.fill();
    if (i === 1) {
      c.save();
      c.beginPath();
      c.arc(d.x, d.y, 85, 0, Math.PI * 2);
      c.clip();
      c.translate(d.x, d.y);
      c.rotate(f?.bank ?? 0);
      c.translate(0, degrees(f?.pitch ?? 0) * 2.1);
      c.fillStyle = '#6194a6';
      c.fillRect(-250, -400, 500, 400);
      c.fillStyle = '#8e694a';
      c.fillRect(-250, 0, 500, 400);
      c.strokeStyle = '#fff4d8';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-250, 0);
      c.lineTo(250, 0);
      c.stroke();
      c.font = '13px monospace';
      c.textAlign = 'left';
      for (let deg = -30; deg <= 30; deg += 10) {
        if (!deg) continue;
        const y = -deg * 2.1;
        c.beginPath();
        c.moveTo(-22, y);
        c.lineTo(22, y);
        c.stroke();
        c.fillStyle = '#fff4d8';
        c.fillText(String(Math.abs(deg)), 27, y + 4);
      }
      c.restore();
      c.strokeStyle = '#f6d075';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(d.x - 48, d.y);
      c.lineTo(d.x - 15, d.y);
      c.lineTo(d.x, d.y + 7);
      c.lineTo(d.x + 15, d.y);
      c.lineTo(d.x + 48, d.y);
      c.stroke();
    } else {
      for (let tick = 0; tick <= 20; tick++) {
        const a = Math.PI * (0.75 + (tick / 20) * 1.5);
        c.strokeStyle = '#ecedd7';
        c.lineWidth = tick % 5 ? 2 : 3;
        c.beginPath();
        c.moveTo(d.x + Math.cos(a) * 81, d.y + Math.sin(a) * 81);
        c.lineTo(
          d.x + Math.cos(a) * (tick % 5 ? 75 : 69),
          d.y + Math.sin(a) * (tick % 5 ? 75 : 69),
        );
        c.stroke();
        if (tick % 5 === 0) {
          c.font = '14px monospace';
          c.textAlign = 'center';
          c.fillStyle = '#ecedd7';
          c.fillText(
            String(Math.round((tick / 20) * d.max) - (i === 4 ? 10 : 0)),
            d.x + Math.cos(a) * 53,
            d.y + Math.sin(a) * 53 + 4,
          );
        }
      }
      const a = Math.PI * (0.75 + clamp(d.value / d.max, 0, 1) * 1.5);
      c.strokeStyle = '#dfb261';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(d.x - Math.cos(a) * 12, d.y - Math.sin(a) * 12);
      c.lineTo(d.x + Math.cos(a) * 64, d.y + Math.sin(a) * 64);
      c.stroke();
      c.fillStyle = '#c5cbb7';
      c.beginPath();
      c.arc(d.x, d.y, 6, 0, Math.PI * 2);
      c.fill();
      if (i === 2) {
        c.fillStyle = '#d7e3cf';
        c.font = '15px monospace';
        c.textAlign = 'center';
        c.fillText(String(Math.round(d.value)).padStart(4, '0'), d.x, d.y + 39);
      }
    }
    c.fillStyle = '#e4dfbb';
    c.textAlign = 'center';
    c.font = 'bold 15px monospace';
    c.fillText(d.label, d.x, d.y + 113);
  }
  const fuel = p ? clamp(p.fuel / fuelCapacity(p), 0, 1) : 0;
  c.fillStyle = '#131f20';
  c.fillRect(296, 480, 430, 16);
  c.fillStyle = '#a6b981';
  c.fillRect(296, 480, 430 * fuel, 16);
  c.fillStyle = '#ece6ce';
  c.font = '14px monospace';
  c.textAlign = 'left';
  c.fillText(`FUEL ${Math.round(fuel * 100)}%`, 166, 493);
  c.textAlign = 'right';
  c.fillText(`AGL ${Math.round(agl)} m`, 948, 493);
  if (f?.stalled) {
    c.fillStyle = '#d64d34';
    c.fillRect(425, 15, 174, 25);
    c.fillStyle = '#fff6d6';
    c.textAlign = 'center';
    c.font = 'bold 18px monospace';
    c.fillText('STALL', 512, 34);
  }
}
