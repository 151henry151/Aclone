// SPDX-License-Identifier: GPL-3.0-or-later
import type { World, Player } from '../../shared/types';
import { constructionRules } from '../../shared/construction-rules';
import { constructionSiteReason, foundationProfile } from '../../shared/construction-site';
import { slopeAssessment } from '../../shared/construction-slope';
import { buildingBounds, buildingPlan } from '../../shared/building-shapes';
import { surveyEarthwork } from '../../shared/earthworks-work';
import { earthworkPropertyOwners } from '../../shared/earthworks-contracts';
import { constructionBudget } from './construction-projects';
import { economyRules } from '../../shared/economy-rules';
import { taxTown } from '../../shared/town-charter';
import { operation } from './player-operations';
import type { Step } from './decision';
import { worldBuildings } from '../../shared/world-catalogue';

/** A costed ordinary player action, never a machine-driving or money-grant routine. */
export function earthworkBusinessPlan(
  w: World,
  p: Player,
  kind: string,
  at: { x: number; z: number },
): Step[] | undefined {
  const r = constructionRules(w.settings);
  const def = worldBuildings(w)[kind];
  if (
    !def ||
    def.tier > w.tier ||
    w.buildings.filter(
      (b) =>
        (b.owner === p.id || b.operatingLease?.landlord === p.id) &&
        !['home', 'warehouse'].includes(b.kind),
    ).length >= w.settings.maxBuildings
  )
    return;
  if (
    !p.npc ||
    !r.earthworksEnabled ||
    !r.earthworksContracts ||
    !r.earthworksNpcContracts ||
    (w.earthworks ?? []).filter(
      (e) =>
        e.owner === p.id &&
        e.work?.contract &&
        e.progress < 1 &&
        e.work.contract.state !== 'cancelled',
    ).length >= r.earthworksNpcMaximumContracts
  )
    return;
  const site = { id: 'construction', kind, ...at, rotation: 0 },
    profile = foundationProfile(w, site),
    slope = slopeAssessment(w, profile.surveys);
  if (!slope.reason || constructionSiteReason(w, site, p) !== slope.reason) return;
  const budget = constructionBudget(w, p, kind, at);
  if (!budget || p.cash <= budget.total) return;
  const bounds = buildingBounds(buildingPlan(site)),
    input = {
      ...at,
      width: 2 * Math.max(Math.abs(bounds.minX), Math.abs(bounds.maxX)),
      depth: 2 * Math.max(Math.abs(bounds.minZ), Math.abs(bounds.maxZ)),
      rotation: 0,
      target: profile.low,
      shoulder: r.earthworksMaximumShoulder,
    };
  if (Math.max(input.width, input.depth) > r.earthworksMaximumSide) return;
  const survey = surveyEarthwork(w, p, input);
  if (
    survey.reason ||
    survey.shortfall > 1e-8 ||
    survey.volume <= 0 ||
    earthworkPropertyOwners(w, survey.pad).length
  )
    return;
  const finished = { ...w, earthworks: [...(w.earthworks ?? []), { ...survey.pad, progress: 1 }] };
  if (constructionSiteReason(finished, site, p)) return;
  const fee = Math.ceil(survey.volume * r.earthworksNpcFeePerVolume);
  const tax = Math.round(fee * (taxTown(w, at.x, at.z)?.tax ?? 0));
  if (fee > economyRules(w.settings).cashTransferLimit || fee + tax + budget.total > p.cash) return;
  return [
    { kind: 'move', ...at },
    operation('earthwork', {
      operation: 'confirm',
      ...input,
      target: survey.pad.target,
      fee,
      fillBy: 'client',
    }),
  ];
}
