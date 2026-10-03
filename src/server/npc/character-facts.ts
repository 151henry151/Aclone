// SPDX-License-Identifier: GPL-3.0-or-later
import type { Player, World } from '../../shared/types.ts';

/** Only volatile identity/qualification changes invalidate an in-flight reply;
 * movement, hunger and ordinary income must not cause repeated model calls. */
export function characterRevision(p: Player) {
  return JSON.stringify([p.deaths, [...p.skills].sort(), p.job ?? null, p.learning ?? null]);
}

export function characterFacts(w: World, p: Player) {
  return {
    source:
      'Authoritative current character state. Overrides all memories, earlier chat and catalogues.',
    deaths: p.deaths,
    acquiredSkills: [...p.skills],
    qualificationSummary: p.skills.length
      ? `My only current qualifications are: ${p.skills.join(', ')}.`
      : 'I currently have NO qualifications. I must learn a skill before taking a qualified job.',
    currentJob: p.job ? { id: p.job, name: w.buildings.find((b) => b.id === p.job)?.name } : null,
    studying: p.learning
      ? {
          skill: p.learning.skill,
          secondsRemaining: Math.max(0, Math.ceil(p.learning.end - w.time)),
        }
      : null,
    firstCourse: p.skills.length === 0,
    nextCourse: { costDenarii: p.skills.length ? 160 : 80, seconds: p.skills.length ? 2400 : 60 },
    rule: 'A past-life qualification or a course in the school catalogue is NOT an acquired skill. Death may remove skills and jobs. A completed past employment agreement does not prove I still have that job. Correct an earlier mistaken claim plainly; do not ask the player to use the interface for me.',
  };
}
