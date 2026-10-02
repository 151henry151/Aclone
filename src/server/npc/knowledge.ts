// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { items, buildings, recipes, vehicles, weapons } from '../../shared/catalog.ts';
import crops from '../../../data/crops.json';
import { VERSION } from '../../shared/version.ts';
interface Entry {
  id: string;
  title: string;
  source: string;
  text: string;
}
let entries: Entry[] | undefined;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
function corpus() {
  if (entries) return entries;
  const all: Entry[] = [];
  // Fixed, shipped player-facing sources only. Queries never become paths or URLs.
  for (const file of ['FAQ', 'PLAYING', 'ECONOMY']) {
    const markdown = readFileSync(new URL(`../../../docs/${file}.md`, import.meta.url), 'utf8');
    for (const section of markdown.split(/^## /m).slice(1)) {
      const newline = section.indexOf('\n'),
        title = section.slice(0, newline).trim();
      const paragraphs = section
        .slice(newline + 1)
        .trim()
        .split(/\n\s*\n/);
      let part = '',
        n = 0;
      const add = () => {
        if (!part) return;
        all.push({
          id: `${file.toLowerCase()}:${slug(title)}${n++ ? ':' + n : ''}`,
          title,
          source: `docs/${file}.md#${slug(title)}`,
          text: part.trim(),
        });
        part = '';
      };
      for (const paragraph of paragraphs) {
        if (part.length + paragraph.length > 3000) add();
        part += paragraph + '\n\n';
      }
      add();
    }
  }
  for (const [kind, file, data] of [
    ['item', 'items', items],
    ['building', 'buildings', buildings],
    ['recipe', 'recipes', recipes],
    ['vehicle', 'vehicles', vehicles],
    ['weapon', 'weapons', weapons],
    ['crop', 'crops', crops],
  ] as const) {
    for (const [id, value] of Object.entries(data)) {
      // Farms use seasonal plots, not the retained legacy automatic recipe.
      if (kind === 'recipe' && id === 'farm') continue;
      const name = 'name' in value ? value.name : id;
      all.push({
        id: `${kind}:${id}`,
        title: `${kind} ${name} ${id}`,
        source: `data/${file}.json`,
        text: `Default ${kind} ${name} (${id}). Currency is internal hundredths of a denarius; 100=1d. Durations are real seconds except crop days (game days). Live world values override defaults. ${JSON.stringify(value)}`,
      });
    }
  }
  entries = all;
  return all;
}
const stop = new Set(
  'a an the and or to of for in on at is are was be do does did can could would should i me my you your it this that how what why where when with please mabel help tell about have get not'.split(
    ' ',
  ),
);
const tokens = (s: string) => [
  ...new Set(
    (s.toLowerCase().match(/[a-z0-9]+/g) ?? [])
      .filter((t) => t.length > 1 && !stop.has(t))
      .map((t) => (t.length > 4 && t.endsWith('s') ? t.slice(0, -1) : t)),
  ),
];
export function searchGuide(query: string): Entry[] {
  const q = query
    .trim()
    .slice(0, 600)
    .toLowerCase()
    .replace(/https?:\/\/\S+|(?:\.\.\/)+\S+/g, '');
  const terms = tokens(q);
  if (!terms.length) return [];
  const scored = corpus()
    .map((entry) => {
      const title = new Set(tokens(entry.title + ' ' + entry.id));
      const body = new Set(tokens(entry.text));
      const score =
        (entry.id === q ? 1000 : 0) +
        terms.reduce((sum, term) => sum + (title.has(term) ? 5 : 0) + (body.has(term) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter((v) => v.score > 0)
    .sort((a, b) => b.score - a.score);
  const found: Entry[] = [];
  let remaining = 6500;
  for (const { entry } of scored.slice(0, 3)) {
    const text = entry.text.slice(0, remaining);
    if (!text) break;
    found.push({ ...entry, text });
    remaining -= text.length;
  }
  return found;
}
export function gameGuide(query: string, activityQuery = '') {
  const docs = corpus().filter((e) => e.source.startsWith('docs/'));
  const excerpts = searchGuide(query);
  const activityExcerpts = (activityQuery ? searchGuide(activityQuery) : []).filter(
    (e) => !excerpts.some((match) => match.id === e.id),
  );
  // Every selected rule stays available, but avoid paying for the same section
  // in controls, fundamentals and retrieved help as the manual grows.
  const separate = new Set([
    'faq:controls',
    ...excerpts.map((e) => e.id),
    ...activityExcerpts.map((e) => e.id),
  ]);
  return {
    version: VERSION,
    // Core rules must not depend on the agent knowing which question to search for.
    fundamentals: docs.filter(
      (e) =>
        !separate.has(e.id) &&
        (e.source.startsWith('docs/FAQ.md') || e.source.startsWith('docs/ECONOMY.md')),
    ),
    controls: docs.find((e) => e.id === 'faq:controls')!.text,
    topics: docs.map(({ id, title }) => ({ id, title })),
    catalogLookup:
      'Search item, recipe, building, vehicle, weapon or crop names; exact IDs such as recipe:sawmill also work. All catalog values are defaults, not live quotes.',
    excerpts,
    activityExcerpts,
  };
}
