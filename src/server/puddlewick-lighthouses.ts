// SPDX-License-Identifier: GPL-3.0-or-later
import { makeBuilding } from '../shared/simulation';
import { foundationProfile, constructionSiteReason } from '../shared/construction-site';
import { terrainHalf, terrainHeight } from '../shared/terrain';
import { bluffPoint, type CoastalBluff } from '../shared/coastal-bluffs';
import type { World } from '../shared/types';

/** Persistent, versioned coastal work. Never reshapes occupied property or rerolls on restart. */
export function ensurePuddlewickLighthouses(w: World) {
  if (
    w.id !== 'puddlewick' ||
    (w.owner !== 'server' && !w.publicParishVersion) ||
    w.template !== 'economy' ||
    (w.lighthouseVersion ?? 0) >= 2 ||
    terrainHalf(w) < 1000
  )
    return false;
  const base = { ...w, coastalBluffs: undefined },
    sea = w.settings.seaLevel;
  w.coastalBluffs ??= [];
  const ids = ['parish-west-light', 'parish-east-light', 'parish-harbour-light'];
  const safe = (b: CoastalBluff, ignore?: string) => {
    const reach = Math.hypot(b.width, b.inland) + 60;
    return (
      !w.buildings.some((o) => o.id !== ignore && Math.hypot(o.x - b.x, o.z - b.z) < reach) &&
      !Object.values(w.players).some(
        (p) => !p.atHome && Math.hypot(p.x - b.x, p.z - b.z) < reach,
      ) &&
      !w.coastalBluffs!.some(
        (o) =>
          o.id !== b.id && Math.hypot(o.x - b.x, o.z - b.z) < reach + Math.max(o.width, o.inland),
      )
    );
  };
  function site(x: number, z: number, id: string, seed: number): CoastalBluff | undefined {
    const h = (x: number, z: number) => terrainHeight(base, x, z);
    const dx = h(x - 8, z) - h(x + 8, z),
      dz = h(x, z - 8) - h(x, z + 8);
    if (Math.hypot(dx, dz) < 0.01) return;
    const angle = Math.atan2(dx, dz),
      sx = Math.sin(angle),
      sz = Math.cos(angle);
    let lo = -120,
      hi = 120;
    if (h(x + sx * lo, z + sz * lo) < sea || h(x + sx * hi, z + sz * hi) > sea) return;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (h(x + sx * mid, z + sz * mid) > sea) lo = mid;
      else hi = mid;
    }
    return {
      id,
      x: x + (sx * (lo + hi)) / 2,
      z: z + (sz * (lo + hi)) / 2,
      angle,
      width: 135 + (seed % 4) * 12,
      inland: 260 + (seed % 3) * 25,
      height: 28 + (seed % 5) * 4,
      seed,
    };
  }
  let changed = false;
  for (let i = 0; i < 3; i++) {
    const id = ids[i],
      bluffId = 'cliff-' + id;
    if (w.coastalBluffs.some((b) => b.id === bluffId)) continue;
    const old = w.buildings.find((b) => b.id === id);
    const candidates: { x: number; z: number; score: number }[] = [];
    const half = terrainHalf(w),
      target = Math.hypot(
        w.towns.find((t) => t.id === 'mabel-s-reach')?.x ?? 770,
        w.towns.find((t) => t.id === 'mabel-s-reach')?.z ?? 92,
      );
    if (i < 2 && old) candidates.push({ ...old, score: -1e6 });
    const step = i === 2 ? 16 : 64;
    for (let x = i === 2 ? -1000 : half * 0.35; x <= (i === 2 ? 1000 : half * 0.9); x += step)
      for (let z = i === 2 ? 350 : half * 0.65; z <= (i === 2 ? 1000 : half * 0.93); z += step) {
        const px = i === 0 ? -x : x,
          h = terrainHeight(base, px, z);
        if (Math.abs(h - sea) < 6)
          candidates.push({
            x: px,
            z,
            score: i === 2 ? Math.abs(Math.hypot(px, z) - target) + (px > 0 ? 100 : 0) : -z,
          });
      }
    candidates.sort((a, b) => a.score - b.score);
    for (const c of candidates) {
      const bluff = site(c.x, c.z, bluffId, 3 + i);
      if (!bluff || !safe(bluff, id)) continue;
      const at = bluffPoint(bluff, 0, -42),
        b = old ? { ...old } : makeBuilding(id, 'lighthouse', at.x, at.z);
      Object.assign(b, at, {
        rotation: bluff.angle,
        architecture: old?.architecture ?? ['model-1', 'model-4', 'model-2'][i],
        style: old?.style ?? 'stone-gable',
      });
      const proposal = {
        ...w,
        coastalBluffs: [...w.coastalBluffs, bluff],
        buildings: w.buildings.filter((o) => o.id !== id),
      };
      if (constructionSiteReason(proposal, b)) continue;
      b.foundationY = foundationProfile(proposal, b).level;
      if (!old)
        Object.assign(b, {
          name: ['West Cape lighthouse', 'East Cape lighthouse', 'Puddlewick harbour light'][i],
          owner: 'treasury',
          government: false,
          forSale: true,
          investment: 0,
        });
      w.coastalBluffs.push(bluff);
      if (old) Object.assign(old, b);
      else w.buildings.push(b);
      for (const p of Object.values(w.players))
        if (p.atHome && p.home === id) {
          p.x = b.x;
          p.z = b.z;
          p.y = b.foundationY;
          p.speed = 0;
        }
      changed = true;
      break;
    }
  }
  // Twelve additional headlands distributed around the outer coast. Extra
  // candidate bearings let us skip occupied shore and existing lighthouse sites.
  let count = w.coastalBluffs.filter((b) => b.id.startsWith('natural-headland-')).length;
  for (let i = 0; i < 48 && count < 12; i++) {
    const angle = (((i * 13) % 48) / 48) * Math.PI * 2,
      sx = Math.sin(angle),
      sz = Math.cos(angle);
    const half = terrainHalf(w);
    let last: { x: number; z: number } | undefined;
    for (let r = 500; r < half * 1.3; r += 40) {
      const x = sx * r,
        z = sz * r;
      if (terrainHeight(base, x, z) > sea && terrainHeight(base, x + sx * 40, z + sz * 40) <= sea)
        last = { x, z };
    }
    if (!last) continue;
    const b = site(last.x, last.z, 'natural-headland-' + count, 10 + i);
    if (!b || !safe(b)) continue;
    w.coastalBluffs.push(b);
    count++;
    changed = true;
  }
  if (ids.every((id) => w.coastalBluffs!.some((b) => b.id === 'cliff-' + id)) && count >= 12) {
    w.lighthouseVersion = 2;
    changed = true;
  }
  if (changed) w.revision++;
  return changed;
}
