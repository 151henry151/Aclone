// SPDX-License-Identifier: GPL-3.0-or-later
import type { World } from '../shared/types';
import { worldItems } from '../shared/world-catalogue';
import { activeTownEvents } from '../shared/world-stories';
const esc = (v: unknown) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
const input = (label: string, key: string, value: unknown, type = 'text', extra = '') =>
  `<label>${label}<input name="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const choose = (label: string, key: string, options: [string, string][], value = '') =>
  `<label>${label}<select name="${key}">${options.map(([id, name]) => `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select></label>`;
export function booksEditor(w: World, id: string) {
  const books = w.creator?.books ?? [],
    book = books.find((b) => b.id === id);
  return `<p>Bind text to a carried item. Make a custom book item in Catalogue, then give or sell it through existing rules/shops. Reading never consumes it. Eight pages of 2,000 characters each; text is displayed literally.</p><button data-do="creator:book" data-id="">New book</button>${books.map((b) => `<button data-do="creator:book" data-id="${esc(b.id)}">${esc(b.title)}</button>`).join('')}<form id="creator-book-form">${input('Book title', 'title', book?.title ?? 'A parish handbook')}${choose(
    'Carried item',
    'item',
    Object.entries(worldItems(w)).map(([id, d]) => [id, d.name]),
    book?.item,
  )}${Array.from({ length: 8 }, (_, i) => `<details ${i === 0 ? 'open' : ''}><summary>Page ${i + 1}</summary><label>Page ${i + 1} text<textarea name="page${i}" maxlength="2000">${esc(book?.pages[i] ?? '')}</textarea></label></details>`).join('')}<button>Save book</button></form>${book ? `<button data-do="creator:deleteBook" data-id="${esc(id)}">Delete book</button>` : ''}`;
}
export function eventsEditor(w: World, id: string) {
  const events = w.creator?.townEvents ?? [],
    e = events.find((e) => e.id === id);
  return `<p>Announce festivals, markets or competitions and optionally link an existing quest. Days count from world creation (600 real seconds each). Repeat 0 means once. Missed notices are not replayed after downtime. Events do not mint money or change shop prices.</p><button data-do="creator:townEvent" data-id="">New town event</button>${events.map((e) => `<button data-do="creator:townEvent" data-id="${esc(e.id)}">${esc(e.title)}</button>`).join('')}<form id="creator-event-form">${input('Event title', 'title', e?.title ?? 'Harvest gathering')}<label>Event description<textarea name="description" maxlength="1000">${esc(e?.description ?? 'Bring your neighbours together in the square.')}</textarea></label>${input('First day', 'startsDay', e?.startsDay ?? Math.ceil(w.time / 600), 'number', 'min="0" max="100000" step="any"')}${input('Repeat every days (0 for once)', 'repeatDays', e?.repeatDays ?? 7, 'number', 'min="0" max="365" step="any"')}${input('Duration days', 'durationDays', e?.durationDays ?? 1, 'number', 'min=".1" max="365" step="any"')}${choose('Associated quest', 'quest', [['', 'None'], ...(w.creator?.quests ?? []).map((q) => [q.id, q.title] as [string, string])], e?.quest)}<button>Save town event</button></form>${e ? `<button data-do="creator:deleteTownEvent" data-id="${esc(id)}">Delete town event</button>` : ''}`;
}
export function townEventsPanel(w: World) {
  return `<p>Current events in ${esc(w.name)}.</p>${
    activeTownEvents(w)
      .map(
        (e) =>
          `<article class="notice"><h3>${esc(e.title)}</h3><p style="white-space:pre-wrap">${esc(e.description)}</p>${e.quest ? '<button data-do="quests">Open associated quests</button>' : ''}</article>`,
      )
      .join('') || '<p>No active events.</p>'
  }`;
}
