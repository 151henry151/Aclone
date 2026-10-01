// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';
/** Original fictional star atlas: uniform on a sphere, mostly faint stars with a few bright ones. */
export function starfield() {
  const canvas = document.createElement('canvas');
  canvas.width = 4096;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 941731;
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 4600; i++) {
    const x = random() * canvas.width,
      latitude = Math.asin(random() * 2 - 1);
    const y = (0.5 - latitude / Math.PI) * canvas.height;
    const magnitude = random() ** 5,
      radius = 0.3 + magnitude * 0.75;
    const color = ['205,222,255', '244,244,255', '255,239,215', '255,210,167'][
      Math.floor(random() * 4)
    ];
    const stretch = 1 / Math.max(0.12, Math.cos(latitude));
    for (const seam of [-canvas.width, 0, canvas.width]) {
      ctx.save();
      ctx.translate(x + seam, y);
      ctx.scale(stretch, 1);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 2);
      glow.addColorStop(0, `rgba(${color},${0.2 + magnitude * 0.8})`);
      glow.addColorStop(0.18, `rgba(${color},${0.15 + magnitude * 0.65})`);
      glow.addColorStop(0.45, `rgba(${color},${0.025 + magnitude * 0.1})`);
      glow.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(-radius * 2, -radius * 2, radius * 4, radius * 4);
      ctx.restore();
    }
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = T.RepeatWrapping;
  texture.userData.shared = true;
  return texture;
}
