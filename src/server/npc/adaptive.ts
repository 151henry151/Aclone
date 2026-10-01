// SPDX-License-Identifier: GPL-3.0-or-later
import { buildings as catalog, items, recipes, vehicles, weapons } from '../../shared/catalog.ts';
import { appearance } from '../../shared/appearance.ts';
import { act, canCarry, distance } from '../../shared/simulation.ts';
import type { Building, Player, World } from '../../shared/types.ts';
import type { Step } from './decision.ts';
import type { ResidentState } from './memory.ts';
import { gameplayChoices, type FarmerChoice } from './farmer.ts';
import { operation, operationAction } from './player-operations.ts';
import { blockedStep } from './recovery.ts';
import { workplace } from './workplace.ts';
const action = (a: Extract<Step, { kind: 'act' }>['action']): Step => ({ kind: 'act', action: a });

/** Shared by every personality. The model chooses; this catalog supplies executable
 * plans and current costs. No role gets privileged wages, goods or qualifications. */
export function adaptiveChoices(w: World, p: Player, state: ResidentState): FarmerChoice[] {
  const base = gameplayChoices(w, p, state, 'independent');
  if (p.task) return base;
  const groups = new Map<string, FarmerChoice[]>();
  const prep: Step[] = [
    ...(p.atHome ? [action({ type: 'outside' })] : []),
    ...(p.game ? [operation('leaveGame')] : []),
    ...(p.hitch ? [operation('detach')] : []),
    ...(p.crowBody ? [operation('crow')] : []),
    ...(p.vehicle !== 5 && p.fuel <= 0
      ? [action({ type: 'vehicle', slot: 5 })]
      : p.vehicle !== 5 && !p.engine
        ? [action({ type: 'engine' })]
        : []),
  ];
  const visit = (b: Building, steps: Step[]): Step[] => [
    ...prep,
    ...(distance(p, b) >= 14 ? [{ kind: 'travel', destination: b.id } as Step] : []),
    ...steps,
  ];
  const add = (group: string, description: string, plan: Step[], reconsiderSeconds = 300) => {
    if (plan.length > 12 || plan.some((s) => blockedStep(state.recovery, s, w.time))) return;
    // Dry-run legal checks on a private simulation copy, never on the live parish.
    // Travel is represented only for eligibility; actual movement still uses Navigator.
    const draft = structuredClone({ ...w, messages: [], ledger: [] });
    const q = draft.players[p.id];
    try {
      for (const s of plan) {
        if (s.kind === 'travel') {
          const b = draft.buildings.find((b) => b.id === s.destination);
          if (b) {
            q.x = b.x;
            q.z = b.z;
          }
        } else if (s.kind === 'move') {
          q.x = s.x;
          q.z = s.z;
        } else if (s.kind === 'act') act(draft, p.id, s.action);
        else if (s.kind === 'operation') act(draft, p.id, operationAction(s));
      }
    } catch {
      return;
    }
    const list = groups.get(group) ?? [];
    list.push({ id: '', description, plan, reconsiderSeconds });
    groups.set(group, list);
  };
  const buildings = [...w.buildings].sort((a, b) => distance(p, a) - distance(p, b));
  const shops = buildings.filter((b) => !b.construction && b.owner !== p.id);
  // Every stocked good is accessible, including tools, tackle and construction supplies.
  for (const [item, def] of Object.entries(items)) {
    const sellers = shops
      .filter((b) => Number.isSafeInteger(b.sell[item]) && b.sell[item] >= 0 && b.stock[item] > 0)
      .sort((a, b) => a.sell[item] - b.sell[item]);
    const b = sellers[0];
    if (!b) continue;
    const needed = w.buildings
      .filter((v) => v.owner === p.id)
      .reduce((n, v) => Math.max(n, v.construction?.[item] ?? 0), 0);
    const quantity = Math.min(
      Math.max(1, Math.min(needed || 3, 20)),
      b.stock[item],
      b.sell[item] ? Math.floor(Math.max(0, p.cash - 8000) / b.sell[item]) : 3,
    );
    if (
      quantity > 0 &&
      (p.inventory[item] ?? 0) < Math.max(needed, 3) &&
      canCarry(p, item, quantity)
    )
      add(
        'supplies',
        `Buy ${quantity} ${def.name} (${item}) at ${b.name} for ${b.sell[item] * quantity}; ${needed ? `construction needs ${needed}` : 'equipment, personal use or future business inputs'}.`,
        visit(b, [action({ type: 'trade', building: b.id, item, quantity, direction: 'buy' })]),
      );
    const buyer = shops
      .filter(
        (v) =>
          v.id !== b.id &&
          v.buy[item] > b.sell[item] &&
          v.investment >= v.buy[item] &&
          (v.stock[item] ?? 0) < v.capacity,
      )
      .sort((a, b) => b.buy[item] - a.buy[item])[0];
    if (buyer) {
      let n = Math.min(
        10,
        b.stock[item],
        Math.floor(buyer.investment / buyer.buy[item]),
        buyer.capacity - (buyer.stock[item] ?? 0),
        b.sell[item] ? Math.floor(Math.max(0, p.cash - 12000) / b.sell[item]) : 10,
      );
      while (n > 0 && !canCarry(p, item, n)) n--;
      if (n > 0)
        add(
          'trade',
          `Trade route: buy ${n} ${item} at ${b.name}, sell at ${buyer.name}. Quoted cash margin ${n * (buyer.buy[item] - b.sell[item])}; excludes fuel/time and prices may change.`,
          [
            ...visit(b, [
              action({ type: 'trade', building: b.id, item, quantity: n, direction: 'buy' }),
            ]),
            { kind: 'travel', destination: buyer.id },
            action({ type: 'trade', building: buyer.id, item, quantity: n, direction: 'sell' }),
          ],
        );
    }
  }
  for (const b of buildings) {
    if (b.owner !== p.id && !b.government && (!b.owner || b.forSale) && p.cash >= b.price + 20000)
      add(
        'property',
        `Buy ${b.name} (${b.kind}) for ${b.price}; keep a reserve. Ownership alone does not fund or staff a business.`,
        visit(b, [action({ type: 'buyBuilding', building: b.id })]),
      );
    if (b.owner === p.id) {
      if (b.construction) {
        if (Object.entries(b.construction).some(([i, n]) => n > 0 && p.inventory[i] > 0))
          add(
            'construction',
            `Supply materials to my ${b.name}: outstanding ${JSON.stringify(b.construction)}.`,
            visit(b, [operation('supply', { building: b.id })]),
          );
        continue;
      }
      if (b.condition < 95)
        add(
          'management',
          `Repair my ${b.name} from ${b.condition}% for ${Math.round((b.price * (100 - b.condition)) / 100)}.`,
          visit(b, [operation('repair', { building: b.id })]),
        );
      if (!b.government && !b.forSale)
        add(
          'management',
          `List my ${b.name} for sale at ${b.price}; this changes my business strategy.`,
          visit(b, [operation('listProperty', { building: b.id, price: b.price })]),
        );
      if (b.investment > 10000)
        add(
          'management',
          `Withdraw 5000 spare capital from ${b.name}; retain wages and input funding.`,
          visit(b, [
            action({ type: 'investment', building: b.id, direction: 'withdraw', amount: 5000 }),
          ]),
        );
      for (const [item, n] of Object.entries(p.inventory))
        if (
          n > 0 &&
          (items[item]?.food ||
            items[item]?.drink ||
            b.kind === 'warehouse' ||
            (b.production ?? recipes[b.recipe ?? ''])?.inputs[item])
        ) {
          const quantity = Math.min(n, 10, b.capacity - (b.stock[item] ?? 0));
          if (quantity > 0)
            add(
              'storage',
              `Store ${quantity} ${item} in my ${b.name}.`,
              visit(b, [
                action({ type: 'stock', building: b.id, direction: 'deposit', item, quantity }),
              ]),
            );
        }
      for (const [item, n] of Object.entries(b.stock))
        if (n > 0) {
          const quantity = Math.min(n, 5);
          if (canCarry(p, item, quantity))
            add(
              'storage',
              `Withdraw ${quantity} ${item} from my ${b.name}.`,
              visit(b, [
                action({ type: 'stock', building: b.id, direction: 'withdraw', item, quantity }),
              ]),
            );
        }
      if (b.recipe || b.production)
        for (const multiplier of [0.9, 1.1])
          add(
            'management',
            `Adjust ${b.name} wage to ${Math.round(b.wage * multiplier)} to balance recruitment and profitability.`,
            visit(b, [
              operation('buildingAdmin', { building: b.id, wage: Math.round(b.wage * multiplier) }),
            ]),
          );
      for (const side of ['buy', 'sell'] as const)
        for (const [item, price] of Object.entries(b[side]).slice(0, 8))
          for (const multiplier of [0.95, 1.05])
            add(
              'pricing',
              `Set ${b.name} ${side} quote for ${item} to ${Math.round(price * multiplier)}. Compare rivals and preserve margins.`,
              visit(b, [
                operation('buildingAdmin', {
                  building: b.id,
                  item,
                  side,
                  price: Math.round(price * multiplier),
                }),
              ]),
            );
      if (['bnb', 'hotel'].includes(b.kind))
        add(
          'housing',
          `${b.lodging?.open ? 'Review' : 'Open'} my ${b.name} for guests at 600 per real hour; requires innkeeper.`,
          visit(b, [
            operation('lodging', { building: b.id, operation: 'configure', open: true, rate: 600 }),
          ]),
        );
      if (b.kind === 'farm')
        for (let plot = 0; plot < 4; plot++)
          for (const op of ['drain', 'improve'] as const)
            add(
              'farming',
              `${op === 'drain' ? 'Drain with 6 gravel' : 'Improve with 6 dirt and 1 compost'} ${b.name} plot ${plot + 1}.`,
              visit(b, [action({ type: 'farm', building: b.id, operation: op, plot, crop: null })]),
            );
    }
    if (['bnb', 'hotel'].includes(b.kind)) {
      const booking = b.lodging?.guests[p.id];
      if (!booking || booking.until <= w.time)
        add(
          'housing',
          `Rent one real hour at ${b.name} for ${b.lodging?.rate ?? 600}; stock your own room with food.`,
          visit(b, [operation('lodging', { building: b.id, operation: 'rent', hours: 1 })]),
        );
      if (booking) {
        if (booking.until > w.time && !p.atHome)
          add(
            'housing',
            `Rest in my booked room at ${b.name}.`,
            visit(b, [action({ type: 'home', building: b.id }), { kind: 'wait', seconds: 300 }]),
          );
        for (const [item, def] of Object.entries(items))
          if (def.food || def.drink)
            for (const direction of ['deposit', 'withdraw'] as const) {
              const quantity = Math.min(
                3,
                (direction === 'deposit' ? p.inventory : booking.stock)[item] ?? 0,
              );
              if (quantity > 0)
                add(
                  'housing',
                  `${direction} ${quantity} ${item} at my room in ${b.name}.`,
                  visit(b, [
                    operation('lodging', {
                      building: b.id,
                      operation: 'store',
                      item,
                      quantity,
                      direction,
                    }),
                  ]),
                );
            }
        if (booking.until > w.time)
          add(
            'housing',
            `Check out of ${b.name}; stored supplies remain recoverable.`,
            visit(b, [operation('lodging', { building: b.id, operation: 'checkout' })]),
          );
      }
    }
    if (b.kind === 'garage') {
      if (p.cash > 20000)
        for (const paint of appearance.paints)
          if (p.tractorPaint !== paint.id)
            add(
              'leisure',
              `Paint my tractor ${paint.name} for ${appearance.paintPrice}; optional personal taste, no income.`,
              visit(b, [action({ type: 'paint', building: b.id, color: paint.id })]),
            );
      vehicles.forEach((v, slot) => {
        if (![p.vehicle, 6, 7].includes(slot))
          add(
            'vehicles',
            `Use ${v.name} (slot ${slot}), capacity ${v.capacity}, listed purchase price ${v.price}; owned vehicles cost nothing to select.`,
            visit(b, [operation('vehicle', { building: b.id, slot })]),
          );
      });
      add(
        'combat',
        `Refit armour/ammunition at ${b.name} for 2500.`,
        visit(b, [operation('refit', { building: b.id })]),
      );
    }
    if (b.kind === 'forge' && (p.inventory.steel ?? 0) > 0 && (p.inventory.wood ?? 0) > 0)
      add(
        'craft',
        `Make tools from personal steel and wood at ${b.name}.`,
        visit(b, [action({ type: 'task', building: b.id, task: 'craft' })]),
      );
    if (b.kind === 'town')
      for (const op of ['join', 'stand'] as const)
        if (op === 'join' ? !w.towns[0].residents.includes(p.id) : w.towns[0].mayor !== p.id)
          add(
            'social',
            `${op === 'join' ? 'Join the town' : 'Stand for mayor'} at ${b.name}.`,
            visit(b, [operation('town', { building: b.id, operation: op })]),
          );
  }
  // Construction is ordinary placement plus later purchases/deliveries, never free buildings.
  const site = [
    { x: p.x + 24, z: p.z },
    { x: p.x - 24, z: p.z },
    { x: p.x, z: p.z - 24 },
    { x: 90, z: -110 },
    { x: -90, z: -110 },
  ].find(
    (v) =>
      Math.abs(v.x) < 230 &&
      v.z > -230 &&
      v.z < 115 &&
      w.buildings.every((b) => distance(v, b) > 20) &&
      !w.zones.some((z) => z.kind === 'noBuild' && distance(v, z) < z.radius),
  );
  if (site && !buildings.some((b) => b.owner === p.id && b.construction))
    for (const [kind, def] of Object.entries(catalog))
      if (def.tier <= w.tier && p.cash > def.price + 20000)
        for (const style of kind === 'home' ? appearance.cottages.map((c) => c.id) : [undefined])
          add(
            'construction',
            `Build ${def.name}${style ? ` (${style})` : ''}: base ${def.price} plus town tax and materials ${JSON.stringify(def.materials)}; an unfinished site earns nothing.`,
            [
              ...prep,
              { kind: 'move', ...site },
              operation('construct', { kind, ...(style ? { style } : {}) }),
            ],
          );
  if (p.inventory.tackle > 0 && w.settings.fishingMode > 0)
    add(
      'leisure',
      'Fish for up to three catches, then leave fishing; fish can be eaten or sold. Actual bites and cargo limits govern success.',
      [...prep, { kind: 'fish', catches: 3 }, operation('leaveGame')],
      600,
    );
  if (p.game)
    add('leisure', 'Leave the current game and return to ordinary life.', [operation('leaveGame')]);
  for (const game of ['hornball', 'race', 'kricket'])
    if (p.game !== game)
      add('leisure', `Play ${game} for recreation; no guaranteed income.`, [
        ...prep,
        operation('joinGame', { game }),
      ]);
  if (p.game === 'kricket')
    for (const mode of ['bowl', 'bat'])
      add(
        'leisure',
        `Try to ${mode} in Ultrakricket; timing matters and missing the fuse is dangerous.`,
        [operation('kricket', { operation: mode })],
      );
  if (w.settings.fighting)
    for (const mode of ['deathmatch', 'capture', 'ctf'])
      if (p.game !== 'combat')
        add('combat', `Join consensual ${mode} combat; risks health, equipment and life.`, [
          ...prep,
          operation('joinCombat', { mode }),
        ]);
  if (p.game === 'combat')
    for (const weapon of Object.keys(weapons))
      for (const type of ['chargeWeapon', 'fire'] as const)
        add('combat', `${type === 'fire' ? 'Fire' : 'Charge'} ${weapon} in the current heading.`, [
          operation(type, { weapon }),
        ]);
  if (p.inventory.rc > 0 || p.crowBody)
    add(
      'leisure',
      p.crowBody ? 'Return from my robocrow.' : 'Explore using one disposable robocrow.',
      [operation('crow')],
    );
  for (const q of Object.values(w.players).filter(
    (q) => q.id !== p.id && q.online && distance(p, q) < 15,
  )) {
    if (!p.hitch)
      add('social', `Hitch a ride with nearby ${q.name}.`, [operation('hitch', { player: q.id })]);
    if (p.inventory.bread > 2)
      add('social', `Give one spare bread to nearby ${q.name}; a gift, not earnings.`, [
        operation('give', { player: q.id, item: 'bread', quantity: 1 }),
      ]);
  }
  if (p.hitch) add('social', 'Detach from my current ride.', [operation('detach')]);
  for (const kind of ['tribe', 'family'] as const)
    if (!p[kind])
      add('social', `Start a ${kind} named ${p.name.split(' ')[1] ?? p.name}.`, [
        operation('group', { kind, name: p.name.split(' ')[1] ?? p.name }),
      ]);
  if (p.job)
    add(
      'employment',
      'Quit my current job to free myself for a new career; no wages until new work.',
      [action({ type: 'quit' })],
    );
  for (const type of ['engine', 'lights', 'horn'] as const)
    add(
      'vehicle-controls',
      type === 'lights'
        ? `Turn headlights ${p.lights ? 'off' : 'on'} for visibility.`
        : type === 'engine'
          ? `Turn engine ${p.engine ? 'off' : 'on'}.`
          : 'Sound a brief horn; avoid disturbing neighbours.',
      [action({ type })],
    );
  if (state.recovery?.streak && state.recovery.streak >= 3)
    add('recovery', 'Use the ordinary return-to-spawn action after repeated navigation failures.', [
      operation('respawn'),
    ]);
  for (const b of buildings.filter((b) => b.kind === 'town' && w.towns[0].mayor === p.id))
    for (const tax of [0, 0.05, 0.1])
      if (w.towns[0].tax !== tax)
        add(
          'social',
          `As mayor set town tax to ${tax * 100}%. Consider effects on neighbours and trade.`,
          visit(b, [operation('town', { building: b.id, operation: 'tax', tax })]),
        );
  for (const b of buildings.filter(
    (b) =>
      b.owner === p.id &&
      !b.government &&
      !b.employees.length &&
      !Object.values(b.stock).some((n) => n > 0) &&
      b.investment === 0,
  ))
    add(
      'management',
      `Demolish my empty ${b.name}; permanently lose this property with no refund. Only useful for deliberate redevelopment.`,
      visit(b, [operation('demolish', { building: b.id })]),
    );
  // Round-robin prevents a large shop or farm from crowding out housing/leisure/enterprise.
  const extra: FarmerChoice[] = [];
  for (let i = 0; i < 80; i++) for (const list of groups.values()) if (list[i]) extra.push(list[i]);
  const choices = [...base.slice(0, 80), ...extra].slice(0, 200);
  let bytes = 0;
  return choices
    .filter((c) => {
      bytes += Buffer.byteLength(JSON.stringify(c));
      return bytes <= 48000;
    })
    .map((c, i) => ({ ...c, id: `option_${i}` }));
}

/** Quoted potential is deliberately separate from actual receipts and expenses. */
export function parishSurvey(w: World, p: Player) {
  return {
    objective:
      'Long healthy life, sustainable net wealth, relationships and affordable leisure. Interests are preferences, never career restrictions. Re-evaluate shortages and opportunities without needless job hopping.',
    cashUnits:
      '100 = 1 denarius; all estimates exclude travel, living costs and competition unless stated.',
    jobs: w.buildings
      .filter((b) => !b.construction && (b.recipe || b.production))
      .slice(0, 60)
      .map((b) => {
        const diagnosis = workplace(w, p, b),
          recipe = b.production ?? recipes[b.recipe ?? ''];
        return {
          id: b.id,
          kind: b.kind,
          distance: Math.round(distance(p, b)),
          owned: b.owner === p.id,
          skill: recipe?.skill,
          wage: b.wage,
          investment: b.investment,
          qualified: diagnosis?.qualified,
          blockers: diagnosis?.blockers,
          estimatedNetPerHour:
            b.kind === 'farm'
              ? null
              : Math.round(
                  (b.wage * (1 - w.settings.wageTax) * 3600) / (diagnosis?.intervalSeconds ?? 600),
                ),
        };
      }),
    property: w.buildings
      .filter((b) => b.owner === p.id || !b.owner || b.forSale)
      .slice(0, 40)
      .map((b) => ({
        id: b.id,
        kind: b.kind,
        owned: b.owner === p.id,
        price: b.price,
        construction: b.construction,
        investment: b.investment,
      })),
    actualReceipts: w.ledger
      .filter((e) => e.to === p.id || e.from === p.id)
      .slice(-16)
      .map((e) => ({
        time: e.time,
        amount: e.amount,
        direction: e.to === p.id ? 'received' : 'spent',
        reason: e.reason,
      })),
  };
}
