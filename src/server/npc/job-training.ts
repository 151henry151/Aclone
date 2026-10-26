// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player, Building } from '../../shared/types.ts';
import { recipes } from '../../shared/catalog.ts';
import { skillLesson } from '../../shared/world-catalogue.ts';
import { householdBudget } from './household.ts';
import { visitBuilding } from './care.ts';
import type { FarmerChoice } from './farmer.ts';

/** Keep the workplace as the goal across prerequisite lessons and restarts. */
export function jobTraining(w: World, p: Player, b: Building): FarmerChoice | undefined {
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  if (
    !recipe ||
    p.learning ||
    p.skills.includes(recipe.skill) ||
    p.skills.length >= w.settings.maxSkills
  )
    return;
  const school = w.buildings.find((s) => s.kind === 'school' && !s.construction);
  if (!school) return;
  const ordered: string[] = [],
    visiting = new Set<string>();
  const collect = (skill: string): boolean => {
    if (p.skills.includes(skill) || ordered.includes(skill)) return true;
    if (visiting.has(skill)) return false;
    visiting.add(skill);
    for (const prerequisite of skillLesson(w, p, skill).prerequisites)
      if (!collect(prerequisite)) return false;
    visiting.delete(skill);
    ordered.push(skill);
    return true;
  };
  if (!collect(recipe.skill) || ordered.length + p.skills.length > w.settings.maxSkills) return;
  const trainee = { ...p, skills: [...p.skills] };
  let totalTuition = 0;
  for (const skill of ordered) {
    totalTuition += skillLesson(w, trainee, skill).price;
    trainee.skills.push(skill);
  }
  const skill = ordered[0],
    lesson = skillLesson(w, p, skill);
  if (p.cash < householdBudget(w, p).reserve + totalTuition) return;
  const owner = b.owner === p.id;
  return {
    id: `train_job_${b.id}_${skill}`,
    careerGoal: { kind: owner ? 'business' : 'employment', target: b.id },
    description: `Learn ${skill} (${lesson.price}, ${lesson.seconds}s) toward ${recipe.skill} at ${b.name}. ${owner ? 'Operate my own business without drawing wages.' : `Then take this funded vacancy at ${b.wage} per completed batch.`} Full qualification path costs ${totalTuition} across ${ordered.length} lesson(s). Keep this workplace as my goal; recheck availability, supplies and finances after learning.`,
    plan: visitBuilding(p, school, [
      { kind: 'act', action: { type: 'learn', building: school.id, skill } },
      { kind: 'wait', seconds: Math.min(600, lesson.seconds) },
    ]),
    expectedCash: -lesson.price,
    durationSeconds: lesson.seconds,
    reconsiderSeconds: 600,
  };
}
