// SPDX-License-Identifier: GPL-3.0-or-later
import { crops } from '../shared/farming';
import { farmStaffSpent, validateFarmPolicy } from '../shared/farm-policy';
import { money } from '../shared/simulation';
import type { World, Building } from '../shared/types';
export function farmPolicySummary(w: World, b: Building) {
  const p = b.farmPolicy,
    m = (v: number) => money(v, w.settings.denariiPerSheckle);
  return `Staff planting: ${p ? p.crops.map((c) => crops[c].name).join(', ') || 'paused' : 'all seasonal crops'}. Seed/fertilizer cash spent this game day: ${m(farmStaffSpent(w, b))}${p?.dailyLimit === undefined ? ' (no daily limit)' : ` of ${m(p.dailyLimit)}`}. Protected cash reserve: ${m(p?.reserve ?? 0)}.`;
}
export function farmPolicyEditor(w: World, b: Building) {
  return `<form data-farm-policy><h3>Staff planting & spending</h3><p>These rules apply to hired players and NPCs. The owner can override them by tending plots personally. The budget resets each game day (10 real minutes) and covers cash purchases of seeds and fertilizer only. Stored/carried supplies, wages and other business purchases are not limited by this setting.</p><fieldset><legend>Crops staff may plant</legend>${Object.entries(
    crops,
  )
    .map(
      ([id, c]) =>
        `<label class="check"><input type="checkbox" name="crop" value="${id}" ${!b.farmPolicy || b.farmPolicy.crops.includes(id) ? 'checked' : ''}>${c.name}</label>`,
    )
    .join(
      '',
    )}</fieldset><p>Uncheck all crops to pause new staff planting. Existing crops can still be watered, fertilized within budget and harvested.</p><label>Daily seed/fertilizer budget in denarii (blank = unlimited)<input name="dailyLimit" type="number" min="0" max="1000000" step="0.01" value="${b.farmPolicy?.dailyLimit === undefined ? '' : b.farmPolicy.dailyLimit / 100}"></label><label>Cash reserve staff must leave in the till, in denarii<input name="reserve" type="number" min="0" max="1000000" step="0.01" value="${(b.farmPolicy?.reserve ?? 0) / 100}" required></label><button>Save staff rules</button><p data-farm-policy-status>${farmPolicySummary(w, b)}</p></form>`;
}
export function farmPolicyFormValue(form: HTMLFormElement) {
  const data = new FormData(form),
    limit = String(data.get('dailyLimit') ?? '').trim();
  return validateFarmPolicy({
    crops: data.getAll('crop').map(String),
    reserve: Math.round(Number(data.get('reserve')) * 100),
    ...(limit ? { dailyLimit: Math.round(Number(limit) * 100) } : {}),
  });
}
