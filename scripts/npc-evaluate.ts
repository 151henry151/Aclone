// SPDX-License-Identifier: GPL-3.0-or-later
// Offline integration soak. No .env, network, human intervention or live database.
// The deterministic chooser exercises the controller, not Jev's decision quality.
import { writeFileSync } from 'node:fs';
import { setImmediate as yieldToHost } from 'node:timers/promises';
import { createWorld, advance } from '../src/shared/simulation.ts';
import { completePuddlewick } from '../src/server/parish-services.ts';
import { Store } from '../src/server/store.ts';
import { Universe } from '../src/server/universe.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
import { JevBrain } from '../src/server/npc/jev.ts';
import { worldItems } from '../src/shared/world-catalogue.ts';
import { household } from '../src/server/npc/household.ts';
import { netAssets } from '../src/server/npc/wealth.ts';
import type { Brain, BrainRequest } from '../src/server/npc/decision.ts';
import type { FarmerChoice } from '../src/server/npc/farmer.ts';
const option = (name: string, fallback: number) => {
  const value = process.argv.find((a) => a.startsWith(`--${name}=`));
  return value ? Number(value.split('=')[1]) : fallback;
};
const days = option('days', 7),
  count = option('population', 4),
  seed = option('seed', 1),
  maxWallSeconds = option('max-wall-seconds', 0);
if (
  !Number.isFinite(days) ||
  days <= 0 ||
  days > 21 ||
  !Number.isInteger(count) ||
  count < 1 ||
  count > 19 ||
  !Number.isSafeInteger(seed) ||
  !Number.isFinite(maxWallSeconds) ||
  maxWallSeconds < 0
)
  throw Error(
    'Use --days=(0..21] --population=1..19 --seed=integer --max-wall-seconds=0-or-positive',
  );
const realNow = Date.now;
const started = performance.now();
let stoppedFor = 'running';
let now = Date.parse('2026-10-11T12:00:00Z');
Date.now = () => now;
const store = new Store(':memory:'),
  universe = new Universe(store);
let w = createWorld('puddlewick', 'Puddlewick', 'server');
completePuddlewick(w);
w.script = '';
const worlds = new Map([[w.id, w]]);
let decisions = 0;
const options = Array.from({ length: count }, (_, i) => {
  const validator = new JevBrain('offline-unused', 'offline-unused');
  const preference = ['trader', 'gatherer', 'owner', 'employee'][i % 4];
  const brain: Brain = {
    prepare: (r) => validator.prepare(r),
    async decide(request: BrainRequest) {
      decisions++;
      const observation = request.observation as { choices: FarmerChoice[] };
      const choices = observation.choices;
      const score = (c: FarmerChoice) => {
        let score = c.id.startsWith('survival_') ? 10000 : 0;
        if (/^Provision my home|Establish a home|Build Small cottage|Finish my/.test(c.description))
          score += 600;
        if (/^Fund my|Supply my|Sell my output/.test(c.description)) score += 500;
        if (c.careerGoal) score += 100;
        if (c.careerGoal?.kind === 'gather' && preference === 'gatherer') score += 100;
        if (c.careerGoal?.kind === 'trade' && preference === 'trader') score += 100;
        if (c.careerGoal?.kind === 'employment' && preference === 'employee') score += 100;
        if (/^Acquire and fund|Found a/.test(c.description) && preference === 'owner') score += 350;
        if (c.id.startsWith('inspect_')) score += 20;
        score += Math.min(80, Math.max(-80, (c.expectedCash ?? 0) / 1000));
        if (c.plan.every((s) => s.kind === 'wait')) score -= 100;
        return score;
      };
      const choice = [...choices].sort((a, b) => score(b) - score(a))[0];
      if (!choice) throw Error('Offline menu is empty');
      return {
        decision: {
          intent: choice.description.slice(0, 300),
          notebook: '',
          speech: null,
          plan: choice.plan,
          repeat: 1,
          reconsiderSeconds: choice.reconsiderSeconds ?? 300,
        },
        careerGoal: choice.careerGoal,
        supplyGoal: choice.supplyGoal,
        inputTokens: 0,
        outputTokens: 0,
      };
    },
  };
  return {
    config: npcConfigSchema.parse({
      id: i ? `eval${seed}_${i}` : 'mabel',
      name: `Evaluation ${i}`,
      provider: 'jev',
      presence: i ? 'scheduled' : 'always',
      activeAlone: true,
      preference,
    }),
    brain,
    rates: { inputUsdPerMillion: 0, outputUsdPerMillion: 0 },
  };
});
let controller = new Residents(store, universe, worlds, options);
const initial = new Map(
    controller
      .status()
      .filter((r) => w.players[r.playerId])
      .map((r) => [r.playerId, netAssets(w, w.players[r.playerId])]),
  ),
  start = w.time;
let restarted = false;
const diagnosticPath = process.argv.find((a) => a.startsWith('--diagnostics='))?.slice(14);
const deathDiagnostics: unknown[] = [];
const observedDeaths = new Map<string, number>();
const liquidAtStart = new Map(Object.values(w.players).map((p) => [p.id, p.cash + p.bank]));
const onlineSeconds = new Map<string, number>();
const moneyFlows: Record<string, { count: number; amount: number }> = {};
let ledgerCursor = 0,
  supplySamples = 0,
  localWaterSamples = 0,
  localFoodSamples = 0;
function measure() {
  const catalogue = worldItems(w);
  supplySamples++;
  // Exclude government and import outlets: stock there is not local self-sufficiency.
  const producers = w.buildings.filter(
    (b) => !b.construction && !b.government && !['market', 'starport'].includes(b.kind),
  );
  if (producers.some((b) => (b.stock.water ?? 0) > 0 && b.sell.water > 0)) localWaterSamples++;
  if (
    producers.some((b) =>
      Object.entries(b.stock).some(
        ([item, n]) => n > 0 && catalogue[item]?.food && b.sell[item] > 0,
      ),
    )
  )
    localFoodSamples++;
  for (const p of Object.values(w.players)) {
    if (!liquidAtStart.has(p.id)) liquidAtStart.set(p.id, p.cash + p.bank);
    if (p.online) onlineSeconds.set(p.id, (onlineSeconds.get(p.id) ?? 0) + 1);
  }
  for (const e of w.ledger)
    if (e.id > ledgerCursor) {
      // Group dynamic import labels, but retain transfers separately from faucets/sinks.
      const key = `${e.kind}: ${e.reason.replace(/: .*$/, '')}`;
      const group = (moneyFlows[key] ??= { count: 0, amount: 0 });
      group.count++;
      group.amount += e.amount;
    }
  ledgerCursor = w.ledgerSeq;
}

const report = () => {
  w = worlds.get(w.id)!;
  return {
    requestedHours: days * 24,
    elapsedHours: (w.time - start) / 3600,
    completed: w.time - start >= days * 86400 - 0.1,
    stoppedFor,
    wallSeconds: (performance.now() - started) / 1000,
    speedup: (w.time - start) / Math.max(0.001, (performance.now() - started) / 1000),
    decisions,
    model: 'deterministic offline chooser; no API calls',
    limitations: [
      'Fresh world; no live player interventions or conversations',
      'Heuristic choices are not evidence of Jev decision quality',
      'World scripts disabled; no browser, network or provider load simulated',
      'Seed varies resident identities/schedules, not terrain or every random event',
    ],
    localAvailability: {
      samples: supplySamples,
      water: localWaterSamples / Math.max(1, supplySamples),
      food: localFoodSamples / Math.max(1, supplySamples),
    },
    moneyFlows,
    humanInterventions: 0,
    residents: controller.status().map((r) => {
      const p = w.players[r.playerId];
      if (!p) return { id: r.id, pendingFirstVisit: true };
      return {
        id: r.id,
        cash: p.cash,
        bank: p.bank,
        liquidChange: p.cash + p.bank - (liquidAtStart.get(p.id) ?? 0),
        onlineHours: (onlineSeconds.get(p.id) ?? 0) / 3600,
        health: p.health,
        deaths: p.deaths,
        assetChange: netAssets(w, p) - (initial.get(p.id) ?? 0),
        shelter: household(w, p)?.id ?? null,
        job: p.job ?? null,
        career: controller.memory.load(r.id)?.career?.kind ?? null,
        holdings: w.buildings
          .filter((b) => b.owner === p.id)
          .map((b) => ({
            id: b.id,
            kind: b.kind,
            unfinished: !!b.construction,
            investment: b.investment,
            salesReceipts: b.accounts?.receipts ?? 0,
          })),
      };
    }),
    failureReasons: store.db
      .prepare(
        "SELECT json_extract(data, '$.message') reason, count(*) n FROM npc_journal WHERE kind='failure' GROUP BY reason ORDER BY n DESC LIMIT 8",
      )
      .all(),
    localPlanningErrors: store.db
      .prepare("SELECT count(*) n FROM npc_journal WHERE kind='local-planning-error'")
      .get(),
    towns: w.towns.map((t) => ({
      name: t.name,
      founder: t.founder,
      mayor: t.mayor,
      residents: t.residents.length,
      candidates: t.election?.candidates.length ?? 0,
    })),
    failures: store.db.prepare("SELECT count(*) n FROM npc_journal WHERE kind='failure'").get(),
    failureExamples: store.db
      .prepare(
        "SELECT resident, json_extract(data, '$.attempted') attempted, json_extract(data, '$.message') reason, count(*) n FROM npc_journal WHERE kind='failure' GROUP BY resident,attempted,reason ORDER BY n DESC LIMIT 15",
      )
      .all(),
    deathEvents: Object.values(w.players).flatMap((p) =>
      (p.history ?? [])
        .filter((e) => e.kind === 'death')
        .map((e) => ({ resident: p.id, event: e })),
    ),
    stocks: w.buildings
      .filter((b) => ['farm', 'mill', 'bakery', 'waterworks'].includes(b.kind))
      .map((b) => ({ kind: b.kind, stock: b.stock, investment: b.investment })),
  };
};
try {
  for (let t = 0; t < Math.ceil(days * 86400 * 10); t++) {
    // A failed ordinary action replaces the world with its rollback snapshot.
    // Never keep advancing an obsolete object after that transaction.
    w = worlds.get(w.id)!;
    if (t % 10 === 0)
      for (const r of controller.status()) {
        const p = w.players[r.playerId];
        if (
          p &&
          p.health < 1000 &&
          p.health > 0 &&
          observedDeaths.get(p.id) !== (p.deaths ?? 0) + 1
        ) {
          observedDeaths.set(p.id, (p.deaths ?? 0) + 1);
          deathDiagnostics.push({
            time: w.time,
            resident: r.id,
            player: structuredClone(p),
            state: controller.memory.load(r.id),
            journal: store.db
              .prepare(
                'SELECT time,kind,data FROM npc_journal WHERE resident=? ORDER BY id DESC LIMIT 40',
              )
              .all(r.id),
            world: diagnosticPath ? structuredClone(w) : undefined,
          });
        }
      }
    advance(w, 0.1);
    now += 100;
    controller.tick(0.1, now);
    w = worlds.get(w.id)!;
    if (t % 10 === 9) measure();
    for (const p of Object.values(w.players))
      if (!initial.has(p.id)) initial.set(p.id, netAssets(w, p));
    if (t % 100 === 0) {
      await controller.settled();
      // Give signals and other processes a scheduling opportunity. Never skip
      // physics/economy steps to accelerate a long run.
      await yieldToHost();
      if (maxWallSeconds && performance.now() - started >= maxWallSeconds * 1000) {
        stoppedFor = 'wall-time limit';
        break;
      }
    }
    if (!restarted && t >= days * 43200 * 10) {
      controller.close();
      controller = new Residents(store, universe, worlds, options);
      restarted = true;
    }
    if (t > 0 && t % 864000 === 0) console.log(JSON.stringify(report()));
  }
  await controller.settled();
  if (stoppedFor === 'running') stoppedFor = 'completed';
  const summary = report();
  console.log(JSON.stringify(summary, null, 2));
  if (diagnosticPath)
    writeFileSync(
      diagnosticPath,
      JSON.stringify({
        summary,
        deathDiagnostics,
        world: w,
        residents: controller
          .status()
          .map((r) => ({ id: r.id, state: controller.memory.load(r.id) })),
      }),
      { mode: 0o600 },
    );
} finally {
  controller.close();
  store.close();
  Date.now = realNow;
}
