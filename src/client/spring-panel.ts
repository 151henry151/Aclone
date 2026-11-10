// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../shared/types';
import { waterSourceRules } from '../shared/water-source-rules';
const esc = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
export function springPanel(w: World, p: Player, contextual = false) {
  const hidden = '<section data-spring-panel hidden></section>';
  const r = waterSourceRules(w.settings);
  if (!r.springsEnabled || !r.springDrinkingEnabled)
    return contextual
      ? hidden
      : '<section data-spring-panel><h3>Natural springs</h3><p>Spring drinking is disabled in this world.</p></section>';
  const spring = [...(w.springs ?? [])].sort(
    (a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
  )[0];
  if (!spring)
    return contextual
      ? hidden
      : '<section data-spring-panel><h3>Natural springs</h3><p>No springs have been surveyed in this world.</p></section>';
  const distance = Math.hypot(spring.x - p.x, spring.z - p.z),
    remaining = Math.max(
      0,
      Math.ceil(r.springDrinkCooldown - (w.time - (p.lastSpringDrink ?? -Infinity))),
    );
  if (contextual && distance > r.springDrinkRange) return hidden;
  const reason =
    distance > r.springDrinkRange
      ? `Stand within ${r.springDrinkRange} m of a spring (${Math.round(distance)} m to the nearest).`
      : p.vehicle !== 5 || p.hitch || p.atHome || p.task || p.game || Math.abs(p.speed) >= 0.5
        ? 'Stop on foot outside to drink.'
        : remaining
          ? `Wait ${remaining} seconds before drinking again.`
          : '';
  return `<section data-spring-panel><h3>${spring.river ? 'Headwater spring' : 'Natural spring'}</h3><p>${esc(reason || 'Fresh water, free to drink. One drink quenches like Water; no item is bottled.')}</p><button data-do="drinkSpring" data-id="${esc(spring.id)}" ${reason ? 'disabled' : ''}>Drink from the spring</button></section>`;
}

/** Update cooldown text without replacing the dialog or a button under the pointer. */
export function refreshSpringPanel(root: Element | null, w: World, p: Player, contextual = false) {
  if (!root) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = springPanel(w, p, contextual);
  const next = wrapper.firstElementChild!;
  root.toggleAttribute('hidden', next.hasAttribute('hidden'));
  for (const selector of ['h3', 'p', 'button']) {
    const prior = root.querySelector(selector),
      value = next.querySelector(selector);
    if (!prior && value) {
      root.append(value);
      continue;
    }
    if (prior && !value) {
      prior.remove();
      continue;
    }
    if (prior && value) {
      if (prior.textContent !== value.textContent) prior.textContent = value.textContent;
      if (prior instanceof HTMLButtonElement && value instanceof HTMLButtonElement) {
        prior.disabled = value.disabled;
        prior.dataset.id = value.dataset.id;
      }
    }
  }
}
