// SPDX-License-Identifier: GPL-3.0-or-later
import type { Settings, World } from './types.ts';
export const rulesets: Record<
  string,
  { name: string; description: string; settings: Partial<Settings> }
> = {
  relaxed: {
    name: 'Relaxed owner economy',
    description:
      'No hunger or thirst; owners operate qualified businesses without taking wages. Jobs are disabled.',
    settings: {
      hungerRate: 0,
      thirstRate: 0,
      jobsEnabled: false,
      ownerOperation: true,
      activeWork: false,
      maxBuildings: 25,
      maxSkills: 12,
      loseSkillsOnDeath: false,
      losePropertyOnDeath: false,
      loseInventoryOnDeath: false,
    },
  },
  survival: {
    name: 'Harsh survival village',
    description:
      'Faster needs, no unattended production, loss of skills and property on death; one hour of needs grace after rebirth.',
    settings: { hungerRate: 3.6, thirstRate: 5, offlineEfficiency: 0, postDeathGraceSeconds: 3600 },
  },
  civilization: {
    name: 'Civilization frontier',
    description:
      'Build an industrial settlement with owner operation, employment and combat. Local combat rules still protect safe zones.',
    settings: {
      fighting: true,
      ownerOperation: true,
      maxBuildings: 12,
      maxSkills: 8,
      retainEstateContents: true,
      estateEquityShare: 0.9,
    },
  },
};
export function rulesSummary(w: Pick<World, 'settings'>): string {
  const s = w.settings;
  return [
    s.hungerRate || s.thirstRate
      ? `Needs continue offline (hunger ${s.hungerRate}/s, thirst ${s.thirstRate}/s). Stock food and water at home before leaving.`
      : 'Hunger and thirst are disabled.',
    s.jobsEnabled === false
      ? 'Paid jobs are disabled.'
      : `Paid jobs enabled; ${s.activeWork ? 'renew active shifts' : 'unattended employment allowed'}.`,
    s.ownerOperation
      ? 'Qualified owners can operate their own businesses without wages.'
      : 'Owners cannot employ themselves.',
    `Death: ${s.loseSkillsOnDeath ? 'lose' : 'keep'} skills, ${s.loseInventoryOnDeath ? 'lose' : 'keep'} inventory, ${s.losePropertyOnDeath ? 'release' : 'keep'} property; retain ${Math.round(s.deathCashRetention * 100)}% cash and ${Math.round(s.deathBankRetention * 100)}% savings.`,
    s.postDeathGraceSeconds
      ? `Rebirth pauses needs for ${s.postDeathGraceSeconds / 60} real minutes.`
      : '',
    s.maxOfflineDays ? `Absence limit: ${s.maxOfflineDays} real days.` : 'No absence-limit death.',
  ]
    .filter(Boolean)
    .join(' ');
}
