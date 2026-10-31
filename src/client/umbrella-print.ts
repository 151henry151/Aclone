// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
let texture: T.CanvasTexture | undefined;
/** Native canvas artwork matched to the supplied white hot-dog-and-tomato umbrella.
 * One shared atlas: no image download, transparent sorting, or per-player textures. */
export function umbrellaPrint() {
  if (texture || typeof document === 'undefined') return texture;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#f7f7fa';
  c.fillRect(0, 0, 1024, 1024);
  // A restrained woven finish; deterministic and baked once into the atlas.
  c.fillStyle = 'rgba(135,144,157,.055)';
  for (let y = 0; y < 1024; y += 3) for (let x = y % 2; x < 1024; x += 3) c.fillRect(x, y, 1, 1);
  function ellipse(x: number, y: number, rx: number, ry: number, color: string) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    c.stroke();
  }
  function tomato() {
    c.lineWidth = 2.1;
    c.strokeStyle = '#211b19';
    ellipse(0, 3, 19, 17, '#f5291c');
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        r = i % 2 ? 3.5 : 11;
      const x = Math.cos(a) * r,
        y = -10 + Math.sin(a) * r * 0.7;
      if (i) c.lineTo(x, y);
      else c.moveTo(x, y);
    }
    c.closePath();
    c.fillStyle = '#22944b';
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(0, -11);
    c.lineTo(2, -20);
    c.stroke();
    c.fillStyle = '#ffb9a2';
    c.beginPath();
    c.ellipse(-8, -1, 4, 2.8, -0.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff1db';
    c.beginPath();
    c.arc(-10, -6, 1.8, 0, Math.PI * 2);
    c.fill();
  }
  function hotdog() {
    c.lineWidth = 2.2;
    c.strokeStyle = '#231b13';
    ellipse(0, 0, 30, 12, '#ffc75a');
    ellipse(0, 0, 33, 7.2, '#e33a20');
    c.beginPath();
    c.moveTo(-25, 1);
    for (let i = 1; i <= 10; i++) c.lineTo(-25 + i * 5, i % 2 ? -3.5 : 3.5);
    c.strokeStyle = '#812913';
    c.lineWidth = 4;
    c.lineJoin = 'round';
    c.stroke();
    c.strokeStyle = '#ffe046';
    c.lineWidth = 2.7;
    c.stroke();
    c.strokeStyle = '#231b13';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-28, 4);
    c.bezierCurveTo(-17, 7, 16, 9, 28, 3);
    c.bezierCurveTo(23, 24, -24, 23, -28, 4);
    c.fillStyle = '#ffbd43';
    c.fill();
    c.stroke();
    c.beginPath();
    c.moveTo(-21, 10);
    c.bezierCurveTo(-11, 17, 12, 17, 21, 10);
    c.strokeStyle = '#ffe299';
    c.lineWidth = 3;
    c.stroke();
  }
  for (const [ring, count, radius] of [
    [0, 8, 140],
    [1, 16, 280],
    [2, 16, 421],
  ]) {
    for (let i = 0; i < count; i++) {
      const a = ((i + 0.43 + ring * 0.17) * Math.PI * 2) / count;
      c.save();
      c.translate(512 + Math.sin(a) * radius, 512 + Math.cos(a) * radius);
      c.rotate((i * 1.73 + ring * 0.91) % (Math.PI * 2));
      if ((i + ring) % 2) hotdog();
      else tomato();
      c.restore();
    }
  }
  texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.userData.shared = true;
  return texture;
}
