// SPDX-License-Identifier: GPL-3.0-or-later
import * as T from 'three';

export const flarePosition = new T.Vector3(-0.79, 1.03, 0.83);
export function flareStrength(time: number) {
  return 0.88 + 0.07 * Math.sin(time * 17) + 0.05 * Math.sin(time * 29);
}
/** A small visual distress flare; it has no inventory, duration or activation state. */
export function createRescueFlare() {
  const group = new T.Group();
  group.name = 'Automatic emergency flare';
  group.position.copy(flarePosition);
  const casing = new T.Mesh(
    new T.CylinderGeometry(0.035, 0.04, 0.33, 8),
    new T.MeshStandardMaterial({ color: '#b82212', roughness: 0.7 }),
  );
  casing.position.y = -0.19;
  group.add(casing);
  const flame = new T.Mesh(
    new T.ConeGeometry(0.065, 0.26, 7),
    new T.MeshBasicMaterial({ color: '#ffb26b', toneMapped: false }),
  );
  flame.position.y = 0.09;
  group.add(flame);
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      const r = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
      pixels.set([255, 255, 255, Math.round(255 * Math.max(0, 1 - r) ** 2)], (y * 32 + x) * 4);
    }
  const map = new T.DataTexture(pixels, 32, 32);
  map.needsUpdate = true;
  const glow = new T.Sprite(
    new T.SpriteMaterial({
      map,
      color: '#ff3915',
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  glow.position.y = 0.08;
  group.add(glow);
  const positions = new Float32Array(10 * 3);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  const smoke = new T.Points(
    geometry,
    new T.PointsMaterial({
      map,
      color: '#a87d71',
      size: 0.2,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  smoke.frustumCulled = false;
  group.add(smoke);
  function animate(time: number) {
    const strength = flareStrength(time);
    flame.scale.set(0.9 + strength * 0.1, strength, 0.9 + strength * 0.1);
    glow.scale.setScalar(0.62 + strength * 0.12);
    for (let i = 0; i < 10; i++) {
      const age = (((time * 0.55 + i / 10) % 1) + 1) % 1;
      positions[i * 3] = age * 0.28 + Math.sin(i * 3 + time) * age * 0.05;
      positions[i * 3 + 1] = 0.18 + age * 0.85;
      positions[i * 3 + 2] = age * 0.18;
    }
    geometry.attributes.position.needsUpdate = true;
  }
  animate(0);
  return { group, animate };
}
