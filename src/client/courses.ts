// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../shared/types';
import { exampleCourse } from '../shared/courses';
const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function coursesPanel(w: World, p: Player, editor = false) {
  return `<p>Tractor checkpoint courses. Some checkpoints require holding position. Times are validated by the server. Weekly boards use seven real-speed days of world time. Prizes come only from sponsor escrow, at most once per pilot each week.</p>${(
    w.courses ?? []
  )
    .map(
      (c) =>
        `<article><h3>${esc(c.definition.name)}</h3><p>Opens at ${Math.round(c.definition.starts)}s · closes at ${Math.round(c.definition.ends)}s of world time. Limit ${c.definition.limit}s. Prize ${c.definition.reward / 100}d · escrow ${c.pot / 100}d.</p><button data-do="courseStart" data-id="${esc(c.definition.id)}">Start course</button><button data-do="courseWaypoint" data-id="${esc(c.definition.id)}">Next checkpoint waypoint</button>${p.courseRun?.id === c.definition.id ? `<button data-do="courseStop" data-id="${esc(c.definition.id)}">Stop course</button><p>Checkpoint ${p.courseRun.next + 1}/${c.definition.points.length} · ${Math.floor(w.time - p.courseRun.start)}s</p>` : ''}${(
          ['weekly', 'allTime'] as const
        )
          .map(
            (key) =>
              `<details><summary>${key === 'weekly' ? 'This week' : 'All-time'} scores</summary><ol>${
                Object.values(c[key])
                  .sort((a, b) => a.seconds - b.seconds)
                  .slice(0, 50)
                  .map((r) => `<li>${esc(r.name)} · ${r.seconds.toFixed(2)}s</li>`)
                  .join('') || '<li>No finishes yet</li>'
              }</ol></details>`,
          )
          .join(
            '',
          )}${c.sponsor === p.id ? `<form data-action="course"><input type="hidden" name="operation" value="fund"><input type="hidden" name="course" value="${esc(c.definition.id)}"><label>Prize deposit (hundredths of a denarius)<input type="number" name="amount" min="1" max="10000000" value="1000"></label><button>Fund prizes</button></form><button data-do="courseRefund" data-id="${esc(c.definition.id)}">Collect unused escrow after closing</button>` : ''}</article>`,
    )
    .join(
      '',
    )}${w.roundCycle ? `<p>Round ${w.roundCycle.slot + 1}: ${w.roundCycle.phase}. Archived: ${(w.roundArchive ?? w.roundCycle.history).map((h) => `round ${h.round + 1}, ${h.scores.join('–')}`).join('; ')}</p>` : w.roundArchive?.length ? `<p>Archived rounds: ${w.roundArchive.map((h) => `round ${h.round + 1}, ${h.scores.join('–')}`).join('; ')}</p>` : ''}${editor ? `<h3>Build / peace / war template</h3><p>Optional whole-world phases; safe zones still apply. Property, survival and inventories persist. Construction pauses during war. Existing arena capture/CTF objectives supply the scores; this does not reset the economy.</p><form id="creator-round-form"><label>Build seconds<input name="build" type="number" min="60" max="86400" value="600"></label><label>Peace seconds<input name="peace" type="number" min="60" max="86400" value="600"></label><label>War seconds<input name="war" type="number" min="60" max="86400" value="600"></label><button>Start cycle</button></form><form data-action="roundCycle"><input type="hidden" name="operation" value="disable"><button>Disable cycle</button></form><h3>Create or revise a course</h3><p>Each point is a map location in metres with radius and optional holdSeconds. This starter lap is inspired by the original island trials; adapt it to your terrain. Use an existing ID to revise that course. Revisions clear scoreboards and invalidate runs but never reset weekly prize claims.</p><form id="creator-course-form"><label>Course definition<textarea name="course" rows="16">${esc(JSON.stringify(exampleCourse(w), null, 2))}</textarea></label><button>Save course</button></form>` : ''}`;
}
