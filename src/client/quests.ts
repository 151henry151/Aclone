// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../shared/types';
import { items, skills, buildings } from '../shared/catalog';
import { resourceNodes } from '../shared/resources';
import { objectives, currentProgress, type Quest } from '../shared/quests';
const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const field = (label: string, key: string, value: unknown, type = 'text', extra = '') =>
  `<label>${esc(label)}<input name="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const select = (label: string, key: string, options: [string, string][], value = '') =>
  `<label>${esc(label)}<select name="${key}">${options.map(([id, label]) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>`;
const itemOptions: [string, string][] = [
  ['', 'Any / none'],
  ...Object.entries(items).map(([id, i]): [string, string] => [id, i.name]),
];
function targets(w: World): [string, string][] {
  return [
    ['', 'Any'],
    ...w.buildings.map((b) => [b.id, 'Building: ' + b.name] as [string, string]),
    ...(w.creator?.objects ?? []).map((o) => [o.id, 'Object: ' + o.name] as [string, string]),
    ...resourceNodes.map(
      (n) => [n.id, 'Gathering ground: ' + n.name + ' (' + n.id + ')'] as [string, string],
    ),
    ...skills.map((s) => [s, 'Qualification: ' + s] as [string, string]),
    ...Object.entries(buildings).map(
      ([id, b]) => [id, 'Building type: ' + b.name] as [string, string],
    ),
  ];
}
function targetLabel(w: World, target: string) {
  return (
    w.buildings.find((b) => b.id === target)?.name ??
    w.creator?.objects.find((o) => o.id === target)?.name ??
    resourceNodes.find((n) => n.id === target)?.name ??
    buildings[target]?.name ??
    target
  );
}
export function questList(w: World, p: Player) {
  return `<p>Follow objectives in order. Only actions after accepting count. Revised quests start fresh; each lists whether progress resets on death.</p>${
    (w.creator?.quests ?? [])
      .map((q) => {
        const state = currentProgress(p, q);
        return `<article class="notice"><h3>${esc(q.title)}</h3><p style="white-space:pre-wrap">${esc(q.description)}</p><ol>${q.steps.map((s, i) => `<li>${state && i < state.step ? '✓ ' : ''}${esc({ buy: 'Buy', sell: 'Sell', study: 'Learn', job: 'Take a job', build: 'Complete construction', gather: 'Gather', interact: 'Interact' }[s.event])} ${s.quantity} ${esc(s.item ? items[s.item]?.name : '')} ${esc(s.target ? 'at / with ' + targetLabel(w, s.target) : '')}${state?.step === i ? ` · ${state.count}/${s.quantity}` : ''}</li>`).join('')}</ol><p>Reward: ${
          Object.entries(q.rewards)
            .map(([id, n]) => `${n} ${esc(items[id].name)}`)
            .join(', ') || 'no items'
        } · ${q.kudos} kudos. ${q.resetOnDeath ? 'Resets on death.' : 'Retained across lives.'}</p>${state?.claimed ? 'Reward collected.' : `<form data-action="quest"><input type="hidden" name="quest" value="${esc(q.id)}"><input type="hidden" name="operation" value="${state ? 'claim' : 'accept'}"><button ${state && state.step < q.steps.length ? 'disabled' : ''}>${state ? 'Collect reward' : 'Accept quest'}</button></form>`}</article>`;
      })
      .join('') || '<p>This world has no quests yet.</p>'
  }`;
}
export function questEditor(w: World, id: string) {
  const list = w.creator?.quests ?? [],
    q = list.find((q) => q.id === id);
  return `<p>Create ordered objectives with item/reputation rewards. Choose a target building or object, gathering ground, qualification for study, or building type for construction. Any matches all targets. Editing a definition resets its progress. Rewards are creator grants, not funded shop payments.</p><div class="button-row"><button data-do="creator:quest" data-id="">New quest</button>${list.map((q) => `<button data-do="creator:quest" data-id="${esc(q.id)}">${esc(q.title)}</button>`).join('')}</div><form id="creator-quest-form">${field('Title', 'title', q?.title ?? 'Getting established')}<label>Story / instructions<textarea name="description" maxlength="2000">${esc(q?.description ?? '')}</textarea></label><label class="check"><input name="resetOnDeath" type="checkbox" ${q?.resetOnDeath !== false ? 'checked' : ''}>Reset on death</label>${Array.from(
    { length: 8 },
    (_, i) => {
      const s = q?.steps[i];
      return `<details ${i === 0 ? 'open' : ''}><summary>Objective ${i + 1}</summary>${select('Action', `event${i}`, [['', 'Unused'], ...objectives.map((s) => [s, s] as [string, string])], s?.event ?? (i === 0 ? 'gather' : ''))}${select('Target (optional)', `target${i}`, targets(w), s?.target ?? '')}${select('Item', `item${i}`, itemOptions, s?.item ?? '')}${field('Quantity', `quantity${i}`, s?.quantity ?? 1, 'number', 'min="1" max="10000"')}</details>`;
    },
  ).join('')}<h3>Rewards</h3>${Array.from({ length: 8 }, (_, i) => {
    const r = Object.entries(q?.rewards ?? {})[i];
    return `<details ${i === 0 ? 'open' : ''}><summary>Item reward ${i + 1}</summary>${select('Item', `reward${i}`, itemOptions, r?.[0] ?? '')}${field('Quantity', `amount${i}`, r?.[1] ?? 1, 'number', 'min="1" max="100"')}</details>`;
  }).join(
    '',
  )}${field('Reputation reward', 'kudos', q?.kudos ?? 1, 'number', 'min="0" max="20"')}<button>Save quest</button></form>${q ? `<button data-do="creator:deleteQuest" data-id="${esc(id)}">Remove quest</button>` : ''}`;
}
export function questForm(form: HTMLFormElement, id: string): Quest {
  const d = new FormData(form),
    str = (k: string) => String(d.get(k) ?? '');
  return {
    id: id || crypto.randomUUID(),
    title: str('title'),
    description: str('description'),
    resetOnDeath: d.has('resetOnDeath'),
    kudos: Number(d.get('kudos')),
    steps: Array.from({ length: 8 }, (_, i) => ({
      event: str(`event${i}`) as Quest['steps'][number]['event'],
      target: str(`target${i}`),
      item: str(`item${i}`),
      quantity: Number(d.get(`quantity${i}`)),
    })).filter((s) => s.event),
    rewards: Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [str(`reward${i}`), Number(d.get(`amount${i}`))]).filter(
        ([id]) => id,
      ),
    ),
  };
}
export function guardsEditor(w: World, id: string) {
  const list = w.creator?.guards ?? [],
    g = list.find((g) => g.id === id);
  return `<p>These requirements cancel an action before money, inventory or employment changes. All selected requirements must pass. Lua can unlock an action by setting the player's progress variable.</p><div class="button-row"><button data-do="creator:guard" data-id="">New requirement</button>${list.map((g) => `<button data-do="creator:guard" data-id="${esc(g.id)}">${esc(g.message)}</button>`).join('')}</div><form id="creator-guard-form">${select(
    'Action',
    'action',
    ['trade', 'job', 'learn', 'build', 'interactObject'].map((s) => [s, s]),
    g?.action ?? 'trade',
  )}${select('Target', 'target', targets(w), g?.target ?? '')}${select('Required qualification', 'skill', [['', 'None'], ...skills.map((s) => [s, s] as [string, string])], g?.skill ?? '')}${select('Required carried item', 'item', itemOptions, g?.item ?? '')}${field('Item quantity', 'quantity', g?.quantity ?? 1, 'number', 'min="1" max="1000"')}${field('Player variable (optional)', 'variable', g?.variable ?? '')}${field('Minimum variable value', 'minimum', g?.minimum ?? 1, 'number')}${field('Explain the restriction', 'message', g?.message ?? 'Complete the introduction first.')}<button>Save requirement</button></form>${g ? `<button data-do="creator:deleteGuard" data-id="${esc(id)}">Remove requirement</button>` : ''}`;
}
