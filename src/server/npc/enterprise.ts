import { pricingChoices } from './pricing.ts';
import { housingChoices } from './housing.ts';
import { household } from './household.ts';
import { ownerWithdrawable, remainingClaim } from '../../shared/stakes.ts';
import { capitalChoices } from './prosperity.ts';
import { hayMerchantChoices } from './hay-merchant.ts';
import { livestockInputs, livestockSupplyInputs } from '../../shared/livestock.ts';
import { farmEnterprises } from './farm-enterprise.ts';
import { constructionChoices } from './construction-projects.ts';
import { careerChoices } from './projects.ts';
import { productionBudget, usefulShift, inputStockTarget } from './business-policy.ts';
import { householdBudget } from './household.ts';
import { herdSpec, herdReady, acceptsHay } from '../../shared/livestock.ts';
// SPDX-License-Identifier: GPL-3.0-or-later
import { loanQuote } from '../../shared/loans.ts';
import { operation } from './player-operations.ts';
import { propertyQuote } from '../../shared/property.ts';
import { homecomingPlan, offlineReadiness } from './homecoming.ts';
import { recipes } from '../../shared/catalog.ts';
import { worldItems } from '../../shared/world-catalogue.ts';
import { canCarry, distance } from '../../shared/simulation.ts';
import { productionStaff } from '../../shared/sound-state.ts';
import type { Building, Player, World } from '../../shared/types.ts';
import type { FarmerChoice } from './farmer.ts';
import type { Step } from './decision.ts';
import { visitBuilding } from './care.ts';
import { workplace, shiftBlocker } from './workplace.ts';
const act = (action: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action });
export function businessEstimate(w: World, b: Building) {
  const recipe = b.production ?? recipes[b.recipe ?? ''];
  if (!recipe || b.kind === 'farm') return;
  const catalogue = worldItems(w);
  let inputs = 0,
    revenue = 0;
  for (const [item, n] of Object.entries(livestockSupplyInputs(w, b, recipe.inputs))) {
    const quotes = w.buildings
      .filter((s) => s.id !== b.id && !s.construction && s.stock[item] > 0 && s.sell[item] >= 0)
      .map((s) => s.sell[item]);
    const fallback = b.buy[item] || catalogue[item]?.price || 0;
    if (!quotes.length && !(b.stock[item] >= n) && !fallback) return;
    inputs += n * (quotes.length ? Math.min(...quotes) : fallback);
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
    const implicit = (b.sell[item] > 0 ? b.sell[item] : 0) || catalogue[item]?.price || 0;
    if (!buyers.length && !implicit) return;
    revenue += n * (buyers.length ? Math.max(...buyers.map((s) => s.buy[item])) : implicit);
  }
  const wages =
    b.wage *
    Math.max(productionBudget(w, b)?.idealWorkers ?? 1, productionStaff(w, b, w.time).length);
  // Implicit shelf sales pay local/world sales tax. Export bids above are net player receipts.
  const budget = productionBudget(w, b);
  if (budget) revenue = Math.min(revenue, budget.retailReceipts);
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
  const list: FarmerChoice[] = [
    ...pricingChoices(w, p),
    ...constructionChoices(w, p),
    ...housingChoices(w, p),
    ...capitalChoices(w, p),
    ...farmEnterprises(w, p),
    ...hayMerchantChoices(w, p),
  ];
  const add = (description: string, plan: Step[], reconsiderSeconds = 120) => {
    const action = plan.filter((s) => s.kind === 'act' && 'building' in s.action).at(-1);
    const target =
      action?.kind === 'act' && 'building' in action.action ? action.action.building : undefined;
    const property = target && w.buildings.find((b) => b.id === target);
    const careerGoal =
      property &&
      /^(Acquire and fund|Fund my|Supply my|Sell my output|Establish a home|Provision my home)/.test(
        description,
      )
        ? {
            kind: property.kind === 'home' ? ('housing' as const) : ('business' as const),
            target: property.id,
          }
        : undefined;
    if (plan.length <= 12)
      list.push({
        id: `enterprise_${list.length}`,
        description,
        plan,
        reconsiderSeconds,
        careerGoal,
      });
  };
  const living = householdBudget(w, p, 86400).reserve;
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
  const home = household(w, p);
  if (home && !offlineReadiness(w, p, 86400).stocked) {
    const pantry = homecomingPlan(w, p, 86400, undefined, false);
    if (pantry.length && pantry.length <= 12)
      list.push({
        id: `household_${home.id}`,
        description:
          'Provision my home: stock a day of food and drink; stay outside while playing and enter only when leaving or resting. A completed household ends repeated emergency visits.',
        plan: pantry,
        careerGoal: { kind: 'housing', target: home.id },
        reconsiderSeconds: 600,
      });
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
      (b.stock.feed ?? 0) + (acceptsHay(b) ? (b.stock.hay ?? 0) : 0) >= 20 &&
      b.stock.water >= 20
    )
      add(
        `Breed a replacement ${herd.young} at my ${b.name}; invest 4 ${acceptsHay(b) ? 'hay or feed' : 'feed'}, 4 water and ${herd.fee} and keep the herd healthy for ${herd.seconds / 60} minutes.`,
        visitBuilding(p, b, [operation('livestock', { building: b.id, operation: 'breed' })]),
      );
    const estimate = businessEstimate(w, b);
    const job = workplace(w, p, b)!;
    const supplied =
      herdReady(b) &&
      Object.entries(livestockInputs(b, recipe.inputs)).every(([i, n]) => (b.stock[i] ?? 0) >= n) &&
      Object.entries(recipe.outputs).every(([i, n]) => (b.stock[i] ?? 0) + n <= b.capacity) &&
      b.investment >= job.ifYouWork.wagesRequired;
    const shortage = Object.keys(recipe.outputs).some(
      (item) =>
        w.buildings.reduce((n, s) => n + (s.sell[item] >= 0 ? (s.stock[item] ?? 0) : 0), 0) < 40,
    );
    if (b.owner !== p.id && supplied && b.employees.length < 16 && usefulShift(w, p, b)) {
      if (job.qualified)
        add(
          `${shortage ? 'Supply shortage! ' : ''}Operate ${b.name}: funded, stocked job pays ${b.wage} per completed batch, checks every ${job.intervalSeconds}s at ${Math.round(job.efficiencyIfYouWork * 100)}% speed (ideal crew ${job.idealEmployees}). Keep producing ${Object.keys(recipe.outputs)}.`,
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
      if (deposit <= 10_000_000 && p.cash >= propertyQuote(w, b).total + deposit + living)
        add(
          `Acquire and fund ${b.name}: price ${propertyQuote(w, b).total}, deposit ${deposit}, estimated batch margin ${estimate.margin}; purchase payback at least ${Math.ceil(propertyQuote(w, b).total / estimate.margin)} SOLD batches. Keep ${living} household reserve. Needs a ${recipe.skill} worker; sales depend on buyers.`,
          visitBuilding(p, b, [
            act({ type: 'buyBuilding', building: b.id }),
            ...Array.from({ length: Math.ceil(deposit / 10_000_000) }, (_, i) =>
              act({
                type: 'investment',
                building: b.id,
                direction: 'deposit',
                amount: Math.min(10_000_000, deposit - i * 10_000_000),
              }),
            ),
          ]),
        );
    }
    if (b.owner !== p.id) continue;
    const operating = productionBudget(w, b);
    const reserve = operating?.reserve ?? Math.max(20000, b.wage * 6);
    const bank = w.buildings.find((s) => s.kind === 'bank' && !s.construction);
    const shortfall = Math.max(0, reserve - b.investment - Math.max(0, p.cash - living));
    if (
      bank &&
      shortfall >= 1000 &&
      shortfall <= 10000 &&
      estimate &&
      estimate.margin > 0 &&
      (!operating || operating.margin >= 0) &&
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
      10_000_000,
      Math.max(0, reserve - b.investment),
      Math.max(0, p.cash - living),
    );
    if (deposit > 0 && estimate && estimate.margin >= 0 && (!operating || operating.margin >= 0))
      add(
        `Fund my ${b.name}: deposit ${deposit} for missing inputs and protected payroll; stock already held needs no replacement purchase.`,
        visitBuilding(p, b, [
          act({ type: 'investment', building: b.id, direction: 'deposit', amount: deposit }),
        ]),
      );
    for (const [item, perBatch] of Object.entries({
      ...livestockSupplyInputs(w, b, recipe.inputs),
      ...(herd ? { [herd.animal]: herd.minimum } : {}),
    })) {
      const target = inputStockTarget(b, item) ?? perBatch * (item === herd?.animal ? 1 : 6);
      const keep = item === 'water' ? 6 : item === 'bread' ? 3 : 0;
      const held = Math.min(
        Math.max(0, (p.inventory[item] ?? 0) - keep),
        Math.max(0, target - (b.stock[item] ?? 0)),
        b.capacity - (b.stock[item] ?? 0),
      );
      if (held > 0) {
        add(
          `Supply my ${b.name}: deliver ${held} ${item} already aboard.`,
          visitBuilding(p, b, [
            act({ type: 'stock', building: b.id, item, quantity: held, direction: 'deposit' }),
          ]),
        );
        continue;
      }
      // Transfer between one's own businesses through stock actions. Keep the
      // source's production inputs and breeding herd; never raid a home pantry.
      const supplies = w.buildings
        .flatMap((s) => {
          if (s.id === b.id || s.construction || s.kind === 'home' || !!s.lodging) return [];
          const own = s.owner === p.id;
          if (!own && !(s.sell[item] >= 0)) return [];
          const sourceRecipe = s.production ?? recipes[s.recipe ?? ''];
          const sourceHerd = herdSpec(s);
          const keep = own
            ? Math.max(
                3 *
                  (sourceRecipe
                    ? (livestockSupplyInputs(w, s, sourceRecipe.inputs)[item] ?? 0)
                    : 0),
                sourceHerd?.animal === item ? sourceHerd.minimum : 0,
              )
            : 0;
          const available = Math.max(0, (s.stock[item] ?? 0) - keep);
          return available ? [{ shop: s, own, available, price: own ? 0 : s.sell[item] }] : [];
        })
        .sort((a, b) => a.price - b.price);
      const source = supplies[0];
      if (!source) continue;
      const { shop: seller, own, available, price } = source;
      const payrollReserve =
        3 * b.wage * Math.max(job.idealEmployees, job.activeEmployeesNextCycle);
      const procurementCash = Math.min(
        10_000_000,
        ownerWithdrawable(w, b),
        Math.max(0, b.investment - remainingClaim(b) - payrollReserve),
      );
      const personalSurplus = Math.max(0, p.cash - living);
      let n = Math.min(
        Math.max(0, target - (b.stock[item] ?? 0)),
        available,
        b.capacity - (b.stock[item] ?? 0),
        price ? Math.floor((personalSurplus + procurementCash) / price) : 100,
      );
      while (n > 0 && !canCarry(p, item, n, w)) n--;
      const draw = Math.max(0, n * price - personalSurplus);
      if (n)
        add(
          own
            ? `Supply my ${b.name}: transfer ${n} ${item} from my ${seller.name}; no sale or new profit. Preserve the source's operating stock.`
            : `Supply my ${b.name}: buy and deliver ${n} ${item} for ${n * price}${draw ? ` using ${draw} of its input-purchasing capital` : ''}; protect meals, payroll and investor claims.`,
          [
            ...(draw
              ? visitBuilding(p, b, [
                  act({ type: 'investment', building: b.id, direction: 'withdraw', amount: draw }),
                ])
              : []),
            ...(draw
              ? [{ kind: 'travel' as const, destination: seller.id }]
              : visitBuilding(p, seller, [])),
            act(
              own
                ? { type: 'stock', building: seller.id, direction: 'withdraw', item, quantity: n }
                : { type: 'trade', building: seller.id, direction: 'buy', item, quantity: n },
            ),
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
            { kind: 'travel', destination: b.id },
            act({
              type: 'investment',
              building: b.id,
              direction: 'deposit',
              amount: Math.min(10_000_000, n * buyer.buy[item]),
            }),
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
  busyVisit = false,
  state?: import('./memory.ts').ResidentState,
): FarmerChoice[] {
  const enterprises = [...(state ? careerChoices(w, p, state) : []), ...enterpriseChoices(w, p)];
  const score = (c: FarmerChoice) => {
    let n = c.id.startsWith('commitment_') ? 1000 : 0;
    if (c.careerGoal)
      n +=
        100 +
        (c.careerGoal.kind === 'gather' && preference === 'gatherer' ? 40 : 0) +
        (c.careerGoal.kind === 'trade' && preference === 'trader' ? 40 : 0) +
        (c.careerGoal.kind === 'employment' && preference === 'employee' ? 40 : 0);
    if (c.id.startsWith('survival_')) n += 1200;
    if (c.id.startsWith('inspect_')) n += 70;
    if (c.id.startsWith('surplus_price_')) n += 105;
    if (c.description.startsWith('Explore ') || c.description.startsWith('Recheck '))
      n += busyVisit ? 15 : 70;
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
    if (c.description.startsWith('Found a')) n += 110;
    if (c.id.startsWith('finish_')) n += 140;
    if (
      c.plan.some(
        (s) =>
          s.kind === 'operation' &&
          s.operation === 'construct' &&
          s.parameters.some((v) => v.name === 'kind' && v.value === 'home'),
      )
    )
      n += 160;
    if (c.description.startsWith('Close the')) n += 100;
    if (c.description.startsWith('Trade route:') || c.description.startsWith('Experiment:'))
      n += 50;
    if (c.plan.some((s) => s.kind === 'operation' && s.operation === 'fulfilOrder'))
      n += preference === 'trader' ? 65 : 30;
    if (c.description.startsWith('Gather ')) n += preference === 'gatherer' ? 45 : 10;
    if (c.description.startsWith('Learn ')) n -= 15;
    if (busyVisit) {
      if (/labour shift/.test(c.description)) n += 55;
      if (c.description.startsWith('Gather ')) n += 35;
      if (c.description.startsWith('Trade route:') || c.description.startsWith('Experiment:'))
        n += 25;
      if (c.description.startsWith('Rest in my home') || c.description.startsWith('Play ')) n -= 80;
      if (c.description.startsWith('Keep my active job')) n -= 90;
    }
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
    return true;
  });
  const ranked = [...enterprises, ...eligible]
    .filter(
      (c) =>
        !c.plan.some((s) => {
          if (s.kind !== 'act' || (s.action.type !== 'job' && s.action.type !== 'work'))
            return false;
          const id = s.action.building;
          const b = w.buildings.find((b) => b.id === id);
          return (
            !b ||
            !!shiftBlocker(w, p, b) ||
            (s.action.type === 'work' &&
              b.kind !== 'farm' &&
              !!workplace(w, p, b)?.workActiveNextCycle)
          );
        }),
    )
    .sort((a, b) => score(b) - score(a));
  const selected: FarmerChoice[] = [];
  // Keep a few alternatives from each domain visible even in large markets.
  const domain = (c: FarmerChoice) => {
    if (c.id.startsWith('survival_') || c.id.startsWith('commitment_')) return 'urgent';
    if (c.ambition) return 'saving';
    if (c.id.startsWith('capital_')) return 'capital';
    if (c.plan.some((s) => s.kind === 'operation' && s.operation === 'foundTown'))
      return 'settlement';
    if (c.plan.some((s) => s.kind === 'operation' && s.operation === 'town')) return 'civic';
    if (c.plan.some((s) => s.kind === 'operation' && ['construct', 'supply'].includes(s.operation)))
      return 'construction';
    if (c.plan.some((s) => s.kind === 'operation' && s.operation === 'livestock'))
      return 'livestock';
    if (
      c.plan.some(
        (s) => s.kind === 'act' && s.action.type === 'farm' && s.action.operation === 'expand',
      )
    )
      return 'farm-expansion';
    if (c.plan.some((s) => s.kind === 'act' && s.action.type === 'buyBuilding'))
      return 'acquisition';
    return c.careerGoal?.kind ?? 'other';
  };
  const groups = new Map<string, FarmerChoice[]>();
  for (const c of ranked) groups.set(domain(c), [...(groups.get(domain(c)) ?? []), c]);
  for (let i = 0; i < 3; i++)
    for (const group of groups.values())
      if (group[i] && selected.length < 24) selected.push(group[i]);
  for (const c of ranked) if (selected.length < 32 && !selected.includes(c)) selected.push(c);
  const rest = ranked.filter((c) => !selected.includes(c));
  const offset = rest.length ? Math.floor(w.time / 300) % rest.length : 0;
  for (let i = 0; i < Math.min(12, rest.length); i++)
    selected.push(rest[(offset + i) % rest.length]);
  return selected;
}
