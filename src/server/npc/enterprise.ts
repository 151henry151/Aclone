import { herdSpec, herdNeeds, herdReady } from '../../shared/livestock.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { loanQuote } from '../../shared/loans.ts';
import { operation } from './player-operations.ts';
import { propertyQuote } from '../../shared/property.ts';
import { homecomingPlan, offlineReadiness } from './homecoming.ts';
import { recipes } from '../../shared/catalog.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import { productionStaff } from '../../shared/sound-state.ts';
import type { Building, Player, World } from '../../shared/types.ts';
import type { FarmerChoice } from './farmer.ts';
import type { Step } from './decision.ts';
import { visitBuilding } from './care.ts';
import { workplace } from './workplace.ts';
const act = (action: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action });
export function businessEstimate(w: World, b: Building) {
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  if (!recipe || b.kind === 'farm') return;
  let inputs = 0,
    revenue = 0;
  for (const [item, n] of Object.entries(recipe.inputs)) {
    const quotes = w.buildings
      .filter((s) => s.id !== b.id && !s.construction && s.stock[item] > 0 && s.sell[item] >= 0)
      .map((s) => s.sell[item]);
    if (!quotes.length && !(b.stock[item] >= n)) return;
    inputs += n * (quotes.length ? Math.min(...quotes) : (b.buy[item] ?? 0));
  }
  for (const [item, n] of Object.entries(recipe.outputs)) {
    const buyers = w.buildings.filter(
      (s) =>
        s.id !== b.id &&
        !s.construction &&
        s.buy[item] > 0 &&
        s.investment >= s.buy[item] * n &&
        (s.stock[item] ?? 0) + n <= s.capacity,
    );
    if (!buyers.length) return;
    revenue += n * Math.max(...buyers.map((s) => s.buy[item]));
  }
  const wages = b.wage * Math.max(1, productionStaff(w, b, w.time).length);
  let setup = 0;
  const herd = herdSpec(b);
  if (herd && (b.stock[herd.animal] ?? 0) < herd.minimum) {
    const sellers = w.buildings.filter(
      (s) =>
        s.sell[herd.animal] > 0 &&
        (s.stock[herd.animal] ?? 0) >= herd.minimum - (b.stock[herd.animal] ?? 0),
    );
    if (!sellers.length) return;
    setup =
      (herd.minimum - (b.stock[herd.animal] ?? 0)) *
      Math.min(...sellers.map((s) => s.sell[herd.animal]));
  }
  const reserve = Math.ceil((inputs + wages) * 6) + setup;
  return { inputs, wages, revenue, margin: revenue - inputs - wages, reserve, skill: recipe.skill };
}
/** Complete, costed operating errands precede speculative one-step purchases. */
export function enterpriseChoices(w: World, p: Player): FarmerChoice[] {
  const list: FarmerChoice[] = [];
  const add = (description: string, plan: Step[], reconsiderSeconds = 120) => {
    if (plan.length <= 12)
      list.push({ id: `enterprise_${list.length}`, description, plan, reconsiderSeconds });
  };
  const living = 20000;
  for (const loan of p.loans ?? []) {
    const bank = w.buildings.find((b) => b.id === loan.bank);
    if (!bank || loan.status === 'paid') continue;
    const amount = Math.min(
      loan.due || loan.principal + loan.interest,
      Math.max(0, p.cash - living),
    );
    if (amount > 0)
      add(
        `Repay my loan: ${amount} toward ${loan.due ? 'overdue instalments' : 'principal'}; protect my credit and collateral.`,
        visitBuilding(p, bank, [
          operation('loan', { building: bank.id, operation: 'repay', loan: loan.id, amount }),
        ]),
      );
  }
  const home = w.buildings.find((b) => b.kind === 'home' && b.owner === p.id && !b.construction);
  if (home && !offlineReadiness(w, p, 86400).stocked) {
    const pantry = homecomingPlan(w, p, 86400);
    if (
      pantry.some(
        (s) => s.kind === 'act' && (s.action.type === 'trade' || s.action.type === 'stock'),
      )
    )
      add(
        'Provision my home: buy or store a day of food and drink before optional expansion.',
        pantry,
      );
  }
  if (!home) {
    const house = w.buildings
      .filter(
        (b) =>
          b.kind === 'home' &&
          !b.construction &&
          !b.government &&
          (!b.owner || b.forSale) &&
          propertyQuote(w, b).total + living <= p.cash,
      )
      .sort(
        (a, b) =>
          propertyQuote(w, a).total - propertyQuote(w, b).total || distance(p, a) - distance(p, b),
      )[0];
    if (house)
      add(
        `Establish a home: buy ${house.name} for ${propertyQuote(w, house).total}; keep ${living} for pantry supplies. Stock and enter it before logout.`,
        visitBuilding(p, house, [act({ type: 'buyBuilding', building: house.id })]),
      );
  }
  for (const b of w.buildings.filter(
    (b) => !b.construction && (b.recipe || b.production) && b.kind !== 'farm',
  )) {
    const recipe = b.production ?? recipes[b.recipe!];
    if (!recipe) continue;
    const herd = herdSpec(b);
    if (
      herd &&
      b.owner === p.id &&
      p.skills.includes('livestock farmer') &&
      !b.breedingEnd &&
      (b.stock[herd.animal] ?? 0) >= herd.minimum &&
      (b.stock[herd.animal] ?? 0) < herd.minimum + 2 &&
      (b.herdCondition ?? 100) >= 80 &&
      b.investment > 15000 &&
      b.stock.feed >= 20 &&
      b.stock.water >= 20
    )
      add(
        `Breed a replacement ${herd.young} at my ${b.name}; invest 4 feed, 4 water and ${herd.fee} and keep the herd healthy for ${herd.seconds / 60} minutes.`,
        visitBuilding(p, b, [operation('livestock', { building: b.id, operation: 'breed' })]),
      );
    const estimate = businessEstimate(w, b);
    const job = workplace(w, p, b)!;
    const supplied =
      herdReady(b) &&
      Object.entries(recipe.inputs).every(([i, n]) => (b.stock[i] ?? 0) >= n) &&
      Object.entries(recipe.outputs).every(([i, n]) => (b.stock[i] ?? 0) + n <= b.capacity) &&
      b.investment >= job.ifYouWork.wagesRequired;
    const shortage = Object.keys(recipe.outputs).some(
      (item) =>
        w.buildings.reduce((n, s) => n + (s.sell[item] >= 0 ? (s.stock[item] ?? 0) : 0), 0) < 40,
    );
    if (
      b.owner !== p.id &&
      supplied &&
      b.employees.length < 16 &&
      (job.employedHere || job.activeEmployeesNextCycle === 0)
    ) {
      if (job.qualified)
        add(
          `${shortage ? 'Supply shortage! ' : ''}Operate ${b.name}: funded, stocked job pays ${b.wage} per ${job.intervalSeconds}s. Keep producing ${Object.keys(recipe.outputs)}.`,
          visitBuilding(p, b, [
            ...(!job.employedHere && p.job ? [act({ type: 'quit' })] : []),
            act({ type: job.employedHere ? 'work' : 'job', building: b.id }),
            { kind: 'wait', seconds: Math.min(600, job.nextCycleInSeconds + 1) },
          ]),
          600,
        );
      else if (
        !p.learning &&
        p.skills.length < w.settings.maxSkills &&
        p.cash >= living + (p.skills.length ? 16000 : 8000)
      ) {
        const school = w.buildings.find((s) => s.kind === 'school' && !s.construction);
        if (school)
          add(
            `${shortage ? 'Supply shortage! ' : ''}Train ${recipe.skill} for stocked, funded vacancy at ${b.name}; tuition ${p.skills.length ? 16000 : 8000}, duration ${p.skills.length ? 2400 : 60}s, wage ${b.wage}/cycle.`,
            visitBuilding(p, school, [
              act({ type: 'learn', building: school.id, skill: recipe.skill }),
              { kind: 'wait', seconds: Math.min(600, p.skills.length ? 2400 : 60) },
            ]),
            600,
          );
      }
    }
    if (
      b.owner !== p.id &&
      !b.government &&
      (!b.owner || b.forSale) &&
      estimate &&
      estimate.margin > 0 &&
      w.buildings.filter((s) => s.owner === p.id && !['home', 'warehouse'].includes(s.kind))
        .length < w.settings.maxBuildings
    ) {
      const deposit = Math.max(0, estimate.reserve - b.investment);
      if (deposit <= 80000 && p.cash >= propertyQuote(w, b).total + deposit + living)
        add(
          `Acquire and fund ${b.name}: price ${propertyQuote(w, b).total}, deposit ${deposit}, batch gross margin ${estimate.margin} after inputs ${estimate.inputs} and wages ${estimate.wages}. Needs a ${recipe.skill} worker; sales depend on buyers.`,
          visitBuilding(p, b, [
            act({ type: 'buyBuilding', building: b.id }),
            ...Array.from({ length: Math.ceil(deposit / 10000) }, (_, i) =>
              act({
                type: 'investment',
                building: b.id,
                direction: 'deposit',
                amount: Math.min(10000, deposit - i * 10000),
              }),
            ),
          ]),
        );
    }
    if (b.owner !== p.id) continue;
    const reserve = estimate?.reserve ?? Math.max(20000, b.wage * 6);
    const bank = w.buildings.find((s) => s.kind === 'bank' && !s.construction);
    const shortfall = Math.max(0, reserve - b.investment - Math.max(0, p.cash - living));
    if (
      bank &&
      shortfall >= 1000 &&
      shortfall <= 10000 &&
      estimate &&
      estimate.margin > 0 &&
      !p.loans?.some((l) => l.status !== 'paid')
    ) {
      const q = loanQuote(w, p, bank, shortfall, 12);
      if (q.approved && q.payment * 3 < estimate.margin * 20)
        add(
          `Finance my ${b.name}: borrow ${shortfall}, ${(q.apr * 100).toFixed(2)}% APR, ${q.payment} per bank month for 12 months. Fund production; earnings are uncertain, keep savings ready for repayments.`,
          [
            ...visitBuilding(p, bank, [
              operation('loan', {
                building: bank.id,
                operation: 'borrow',
                amount: shortfall,
                months: 12,
                apr: q.apr,
                payment: q.payment,
                accepted: true,
                autoPay: true,
              }),
            ]),
            { kind: 'travel', destination: b.id },
            act({ type: 'investment', building: b.id, direction: 'deposit', amount: shortfall }),
          ],
        );
    }
    const deposit = Math.min(
      10000,
      Math.max(0, reserve - b.investment),
      Math.max(0, p.cash - living),
    );
    if (deposit > 0)
      add(
        `Fund my ${b.name}: deposit ${deposit} toward six batches of inputs and wages.`,
        visitBuilding(p, b, [
          act({ type: 'investment', building: b.id, direction: 'deposit', amount: deposit }),
        ]),
      );
    for (const [item, perBatch] of Object.entries({
      ...recipe.inputs,
      ...(herd ? { ...herdNeeds(b), [herd.animal]: herd.minimum } : {}),
    })) {
      const seller = w.buildings
        .filter(
          (s) => s.owner !== p.id && !s.construction && s.sell[item] >= 0 && s.stock[item] > 0,
        )
        .sort((a, b) => a.sell[item] - b.sell[item])[0];
      if (!seller) continue;
      let n = Math.min(
        Math.max(0, perBatch * (item === herd?.animal ? 1 : 6) - (b.stock[item] ?? 0)),
        seller.stock[item],
        b.capacity - (b.stock[item] ?? 0),
        seller.sell[item] ? Math.floor(Math.max(0, p.cash - living) / seller.sell[item]) : 100,
      );
      while (n > 0 && !canCarry(p, item, n, w)) n--;
      if (n)
        add(
          `Supply my ${b.name}: buy and deliver ${n} ${item} for ${n * seller.sell[item]}; replenish six batches, protect meals.`,
          [
            ...visitBuilding(p, seller, [
              act({ type: 'trade', building: seller.id, direction: 'buy', item, quantity: n }),
            ]),
            { kind: 'travel', destination: b.id },
            act({ type: 'stock', building: b.id, direction: 'deposit', item, quantity: n }),
          ],
        );
    }
    for (const item of Object.keys(recipe.outputs)) {
      const buyer = w.buildings
        .filter(
          (s) =>
            s.owner !== p.id &&
            !s.construction &&
            s.buy[item] > 0 &&
            s.investment >= s.buy[item] &&
            (s.stock[item] ?? 0) < s.capacity,
        )
        .sort((a, b) => b.buy[item] - a.buy[item])[0];
      if (!buyer) continue;
      let n = Math.min(
        b.stock[item] ?? 0,
        30,
        Math.floor(buyer.investment / buyer.buy[item]),
        buyer.capacity - (buyer.stock[item] ?? 0),
      );
      while (n > 0 && !canCarry(p, item, n, w)) n--;
      if (n)
        add(
          `Sell my output: collect ${n} ${item} at ${b.name} and deliver to ${buyer.name} for ${n * buyer.buy[item]}; replenish business capital afterward.`,
          [
            ...visitBuilding(p, b, [
              act({ type: 'stock', building: b.id, direction: 'withdraw', item, quantity: n }),
            ]),
            { kind: 'travel', destination: buyer.id },
            act({ type: 'trade', building: buyer.id, direction: 'sell', item, quantity: n }),
          ],
        );
    }
  }
  return list;
}

/** Bound the actual Jev menu without reducing the complete action catalogue.
 * Keep meaningful descriptions; rotate exploratory choices rather than truncating
 * 200 choices to a few words. Personality influences order, not permissions. */
export function economicMenu(
  w: World,
  p: Player,
  choices: FarmerChoice[],
  preference: string,
): FarmerChoice[] {
  const enterprises = enterpriseChoices(w, p);
  const score = (c: FarmerChoice) => {
    let n = c.id.startsWith('commitment_') ? 1000 : 0;
    if (c.id.startsWith('survival_')) n += 1200;
    if (c.id.startsWith('inspect_')) n += 70;
    if (c.description.startsWith('Explore ') || c.description.startsWith('Recheck ')) n += 70;
    if (
      c.description.startsWith('Establish a home') ||
      c.description.startsWith('Provision my home')
    )
      n += 90;
    if (c.description.startsWith('Supply shortage!')) n += 80;
    if (c.description.startsWith('Acquire and fund')) n += preference === 'owner' ? 90 : 45;
    if (c.description.startsWith('Repay my loan')) n += 98;
    if (/^(Fund my|Supply my|Sell my output)/.test(c.description)) n += 95;
    if (c.description.startsWith('Operate ')) n += preference === 'employee' ? 80 : 50;
    if (c.description.includes('[Fits my')) n += 20;
    if (c.description.startsWith('Trade route:') || c.description.startsWith('Experiment:')) n += 50;
    if (c.plan.some((s) => s.kind === 'operation' && s.operation === 'fulfilOrder'))
      n += preference === 'trader' ? 65 : 30;
    if (c.description.startsWith('Gather ')) n += preference === 'gatherer' ? 45 : 10;
    if (c.description.startsWith('Learn ')) n -= 15;
    return n;
  };
  const eligible = choices.filter((c) => {
    // Replace bare business purchases with funded, costed plans; homes remain accessible.
    if (
      c.plan.some(
        (s) =>
          s.kind === 'act' &&
          s.action.type === 'buyBuilding' &&
          w.buildings.some(
            (b) =>
              b.id === ('building' in s.action ? s.action.building : '') &&
              b.kind !== 'home' &&
              (b.recipe || b.production),
          ),
      )
    )
      return false;
    // No waiting forever at a mill without wheat, space or wages.
    if (/(Accept employment|Renew my shift|Keep my active job)/.test(c.description)) {
      const b = w.buildings.find(
        (b) =>
          b.id === p.job ||
          c.plan.some(
            (s) =>
              s.kind === 'act' &&
              (s.action.type === 'job' || s.action.type === 'work') &&
              s.action.building === b.id,
          ),
      );
      if (b) {
        const job = workplace(w, p, b);
        if (
          job &&
          (job.ifYouWork.capitalShortfall > 0 ||
            job.blockers.some((v) => !v.startsWith('No active employees')))
        )
          return false;
      }
    }
    return true;
  });
  const ranked = [...enterprises, ...eligible].sort((a, b) => score(b) - score(a));
  const selected = ranked.slice(0, 32);
  const rest = ranked.slice(32);
  const offset = rest.length ? Math.floor(w.time / 300) % rest.length : 0;
  for (let i = 0; i < Math.min(12, rest.length); i++)
    selected.push(rest[(offset + i) % rest.length]);
  return selected;
}
