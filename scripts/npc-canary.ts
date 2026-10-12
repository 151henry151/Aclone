// SPDX-License-Identifier: GPL-3.0-or-later
// Explicitly paid, isolated actual-Jev experiment. No HTTP server or production writes.
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { backup } from 'node:sqlite';
import { setImmediate as yieldToHost } from 'node:timers/promises';
import { Store } from '../src/server/store.ts';
import { Universe, type Account } from '../src/server/universe.ts';
import { advance } from '../src/shared/simulation.ts';
import type { World } from '../src/shared/types.ts';
import { Residents } from '../src/server/npc/residents.ts';
import { NpcMemory, type ResidentState } from '../src/server/npc/memory.ts';
import { residentsEnvironment } from '../src/server/npc/config.ts';
import { budgetSchema } from '../src/server/npc/budget.ts';
import { JevBrain } from '../src/server/npc/jev.ts';
import { CanaryClock, CanarySpend } from '../src/server/npc/canary.ts';
import { household } from '../src/server/npc/household.ts';
import { netAssets } from '../src/server/npc/wealth.ts';
import { worldItems } from '../src/shared/world-catalogue.ts';

const arg = (key: string) =>
  process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
const directory = arg('output'),
  sourcePath = arg('source'),
  days = Number(arg('days') ?? 4),
  cap = Number(arg('max-usd'));
if (
  !directory ||
  !sourcePath ||
  !(days > 0 && days <= 21) ||
  !(cap > 0 && Number.isFinite(cap)) ||
  !process.argv.includes('--paid')
)
  throw Error(
    'Usage: node --env-file=.env --import tsx scripts/npc-canary.ts --paid --source=/private/source.json --output=/private/run --days=4 --max-usd=9.60 [--resume]',
  );
process.umask(0o077);
const dir = resolve(directory);
mkdirSync(dir, { recursive: true, mode: 0o700 });
chmodSync(dir, 0o700);
const sourceText = readFileSync(sourcePath, 'utf8');
interface Fixture {
  capturedAt: number;
  worlds: { id: string; state: string; saved: number }[];
  residents: { id: string; state: string }[];
  accounts: Account[];
  journal: { id: number; resident: string; time: number; kind: string; data: string }[];
  calls: Record<string, string | number | null>[];
  control: { resident: string; paused: number }[];
  meta: { key: string; value: string }[];
}
const fixture = JSON.parse(sourceText) as Fixture;
const configured = residentsEnvironment();
if (
  !configured ||
  !configured.residents.length ||
  configured.residents.some((r) => r.config.provider !== 'jev')
)
  throw Error('Configure Jev residents first');
if (configured.residents.some((r) => !fixture.residents.some((s) => s.id === r.config.id)))
  throw Error('Fixture is missing a configured resident');
const budget = budgetSchema.parse(
  JSON.parse(fixture.meta.find((r) => r.key === 'npc-budget-config')?.value ?? '{}'),
);
const digest = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
// Fingerprint every source/test/script input, including untracked implementation files.
const sourceFiles = execFileSync(
  'git',
  ['ls-files', '-co', '--exclude-standard', 'src', 'scripts', 'tests', 'package.json'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n');
const codeHash = digest(
  [...new Set(sourceFiles)]
    .sort()
    .map((p) => `${p}:${digest(readFileSync(p))}`)
    .join('\n'),
);
const configuration = configured.residents.map(({ config, rates }) => ({ config, rates }));
const manifest = {
  sourceHash: digest(sourceText),
  codeHash,
  configuration,
  budget,
  days,
  cap,
  startedAt: fixture.capturedAt,
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
};
const manifestPath = join(dir, 'manifest.json'),
  dbPath = join(dir, 'world.sqlite'),
  checkpointPath = join(dir, 'checkpoint.sqlite');
const resume = process.argv.includes('--resume');
if (existsSync(manifestPath)) {
  if (!resume) throw Error('Existing experiment: use --resume; never overwrite a paid run');
  if (JSON.stringify(JSON.parse(readFileSync(manifestPath, 'utf8'))) !== JSON.stringify(manifest))
    throw Error('Code, fixture, duration, cap or configuration changed; cannot mix experiments');
  if (!existsSync(checkpointPath)) throw Error('No resumable checkpoint');
  copyFileSync(checkpointPath, dbPath);
} else {
  if (resume) throw Error('No existing experiment');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}
const realNow = Date.now,
  started = performance.now();
const store = new Store(dbPath),
  memory = new NpcMemory(store);
if (!resume)
  store.transaction(() => {
    for (const row of fixture.worlds) {
      const w = JSON.parse(row.state) as World;
      // No connected humans in the experiment; their offline needs still run normally.
      for (const p of Object.values(w.players)) {
        p.online = false;
        p.speed = 0;
      }
      w.script = '';
      store.saveWorld(w, fixture.capturedAt / 1000);
    }
    for (const a of fixture.accounts)
      store.db
        .prepare('INSERT INTO accounts(id,name,token_hash,state,name_key) VALUES (?,?,?,?,?)')
        .run(
          a.id,
          a.name,
          `non-authenticating-canary:${a.id}`,
          JSON.stringify(a),
          a.name.normalize('NFKC').toLocaleLowerCase('en-US'),
        );
    for (const row of fixture.residents) {
      const s = JSON.parse(row.state) as ResidentState;
      // Already accepted gameplay commitments remain. No human-chat model is attached.
      delete s.helpQuestion;
      delete s.questionFrom;
      delete s.replyTo;
      delete s.guideQuery;
      delete s.pendingAgreementReply;
      delete s.dialogueAttempt;
      s.publicConversations = [];
      s.cursor =
        (JSON.parse(fixture.worlds.find((w) => w.id === s.world)!.state) as World).messageSeq ??
        s.cursor;
      memory.save(row.id, s);
    }
    for (const row of fixture.journal)
      store.db
        .prepare('INSERT INTO npc_journal(id,resident,time,kind,data) VALUES (?,?,?,?,?)')
        .run(row.id, row.resident, row.time, row.kind, row.data);
    for (const row of fixture.calls) {
      const keys = Object.keys(row);
      if (
        keys.some(
          (k) =>
            ![
              'id',
              'resident',
              'at',
              'reserved',
              'charged',
              'input_tokens',
              'output_tokens',
              'status',
              'rates',
              'cache_write_tokens',
              'cache_read_tokens',
            ].includes(k),
        )
      )
        throw Error('Unknown call schema');
      store.db
        .prepare(
          `INSERT INTO npc_calls(${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
        )
        .run(...keys.map((k) => row[k]));
    }
    for (const row of fixture.control) memory.pause(row.resident, !!row.paused);
    for (const row of fixture.meta)
      store.db.prepare('INSERT OR REPLACE INTO meta VALUES (?,?)').run(row.key, row.value);
  });
const worlds = new Map(store.loadWorlds().map(({ world }) => [world.id, world]));
const prior = store.db.prepare("SELECT value FROM meta WHERE key='canary-checkpoint'").get();
let now = prior ? JSON.parse(String(prior.value)).now : fixture.capturedAt;
Date.now = () => now;
const clock = new CanaryClock(() => now),
  spend = new CanarySpend(join(dir, 'spend.sqlite'), cap);
const options = configured.residents.map((r) => ({
  config: r.config,
  rates: r.rates,
  brain: clock.wrap(spend.wrap(r.config.id, new JevBrain(r.apiKey, r.config.model), r.rates)),
}));
const controller = new Residents(store, new Universe(store), worlds, options, budget);
const sourceWorld = JSON.parse(fixture.worlds.find((w) => w.id === 'puddlewick')!.state) as World;
const initial = new Map(
  Object.values(sourceWorld.players).map((p) => [
    p.id,
    { cash: p.cash + p.bank, assets: netAssets(sourceWorld, p), deaths: p.deaths ?? 0 },
  ]),
);
const importedJournalMax = Math.max(0, ...fixture.journal.map((r) => r.id));
let stopped = '',
  ticks = 0;
const maxWall = Number(arg('max-wall-seconds') ?? 0);
process.on('SIGINT', () => {
  stopped = 'Interrupted; checkpoint saved';
});
process.on('SIGTERM', () => {
  stopped = 'Interrupted; checkpoint saved';
});
const totals = prior
  ? JSON.parse(String(prior.value)).totals
  : { samples: 0, water: 0, food: 0, onlineSeconds: {} as Record<string, number> };
function sample() {
  const w = worlds.get('puddlewick')!,
    catalogue = worldItems(w);
  const local = w.buildings.filter(
    (b) => !b.construction && !b.government && !['market', 'starport'].includes(b.kind),
  );
  totals.samples++;
  if (local.some((b) => (b.stock.water ?? 0) > 0 && b.sell.water > 0)) totals.water++;
  if (
    local.some((b) =>
      Object.entries(b.stock).some(
        ([item, n]) => n > 0 && catalogue[item]?.food && b.sell[item] > 0,
      ),
    )
  )
    totals.food++;
  for (const r of controller.status())
    if (r.online) totals.onlineSeconds[r.id] = (totals.onlineSeconds[r.id] ?? 0) + 60;
}
function report() {
  const w = worlds.get('puddlewick')!;
  return {
    requestedHours: days * 24,
    elapsedHours: (now - fixture.capturedAt) / 3600000,
    completed: now >= fixture.capturedAt + days * 86400000,
    stoppedFor: stopped || 'running',
    wallSeconds: (performance.now() - started) / 1000,
    spend: spend.usage(),
    capUsd: cap,
    localAvailability: {
      samples: totals.samples,
      water: totals.water / Math.max(1, totals.samples),
      food: totals.food / Math.max(1, totals.samples),
    },
    residents: controller.status().map((r) => {
      const state = memory.load(r.id)!,
        world = worlds.get(state.world)!,
        p = world.players[r.playerId];
      if (!p) return { id: r.id, inSpace: state.inSpace ?? false };
      const start = initial.get(p.id);
      return {
        id: r.id,
        name: r.name,
        onlineHours: (totals.onlineSeconds[r.id] ?? 0) / 3600,
        health: p.health,
        deaths: (p.deaths ?? 0) - (start?.deaths ?? 0),
        cash: p.cash,
        bank: p.bank,
        liquidChange: p.cash + p.bank - (start?.cash ?? 0),
        assetChange: netAssets(world, p) - (start?.assets ?? 0),
        hunger: p.hunger,
        thirst: p.thirst,
        shelter: household(world, p)?.id ?? null,
        job: p.job ?? null,
        career: state.career?.kind ?? null,
        intent: state.intent,
        holdings: world.buildings
          .filter((b) => b.owner === p.id)
          .map((b) => ({
            id: b.id,
            kind: b.kind,
            unfinished: !!b.construction,
            investment: b.investment,
            stock: b.stock,
            receipts: b.accounts?.receipts ?? 0,
            batches: b.accounts?.batches ?? 0,
          })),
      };
    }),
    buildings: w.buildings.map((b) => ({
      id: b.id,
      kind: b.kind,
      owner: b.owner,
      investment: b.investment,
      stock: b.stock,
      accounts: b.accounts,
      unfinished: !!b.construction,
    })),
    towns: w.towns.map((t) => ({
      name: t.name,
      founder: t.founder,
      mayor: t.mayor,
      residents: t.residents,
      candidates: t.election?.candidates ?? [],
    })),
    failures: store.db
      .prepare(
        "SELECT kind,json_extract(data,'$.message') reason,count(*) n FROM npc_journal WHERE id>? AND kind IN ('failure','local-planning-error') GROUP BY kind,reason ORDER BY n DESC LIMIT 25",
      )
      .all(importedJournalMax),
    limitations: [
      'One actual-Jev snapshot run; not proof of indefinite stability or a controlled comparison',
      'No human interventions or conversation-model calls; accepted gameplay commitments retained',
      'Normal 0.1-second game steps, real response latency rounded up to a step; throttle delay included',
      'World login announcement scripts and rendering/network load excluded',
      'Provider charges estimated from returned usage; uncertain calls retain byte-bound reservations',
      'Normal schedules and existing provider budgets retained; historical human interventions remain in starting state',
      'Resume models a controller restart; mechanical randomness and API decisions are not reproducible',
    ],
  };
}
async function checkpoint() {
  // Only checkpoint with no held responses; all world and NPC state shares one instant.
  if (clock.pending) return;
  store.transaction(() => {
    for (const w of worlds.values()) store.saveWorld(w, now / 1000);
    store.db
      .prepare("INSERT OR REPLACE INTO meta VALUES ('canary-checkpoint',?)")
      .run(JSON.stringify({ now, totals }));
  });
  await backup(store.db, join(dir, 'checkpoint.tmp.sqlite'));
  renameSync(join(dir, 'checkpoint.tmp.sqlite'), checkpointPath);
  writeFileSync(join(dir, 'report.json'), JSON.stringify(report(), null, 2));
}
try {
  await checkpoint();
  let lastProgress = performance.now(),
    nextCheckpoint = now + 900000,
    nextSample = now + 60000;
  const end = fixture.capturedAt + days * 86400000;
  while (now < end) {
    // Complete transports before advancing time, then release only due responses.
    await controller.dispatched();
    await clock.synchronize();
    if ((stopped || spend.stopped) && !clock.pending) break;
    for (const w of worlds.values()) advance(w, 0.1);
    now += 100;
    ticks++;
    if (!stopped && !spend.stopped) controller.tick(0.1, now);
    if (now >= nextSample) {
      sample();
      nextSample += 60000;
    }
    if (now >= nextCheckpoint && !clock.pending) {
      await checkpoint();
      nextCheckpoint = now + 900000;
    }
    if (ticks % 100 === 0) {
      await yieldToHost();
      if (maxWall && performance.now() - started >= maxWall * 1000)
        stopped = 'Wall-time limit; checkpoint saved';
      if (performance.now() - lastProgress > 30000) {
        console.log(
          JSON.stringify({
            elapsedHours: (now - fixture.capturedAt) / 3600000,
            spend: spend.usage(),
            wallSeconds: (performance.now() - started) / 1000,
          }),
        );
        lastProgress = performance.now();
      }
    }
  }
  // Requests dispatched before the finish may still be in flight. Their measured
  // latency is shorter than a normal step window, but never discard paid results.
  while (clock.pending) {
    await clock.synchronize();
    if (clock.pending) {
      for (const w of worlds.values()) advance(w, 0.1);
      now += 100;
    }
  }
  stopped = spend.stopped || stopped || 'completed';
  await checkpoint();
  const final = report();
  writeFileSync(join(dir, 'report.json'), JSON.stringify(final, null, 2));
  appendFileSync(
    join(dir, 'segments.jsonl'),
    JSON.stringify({
      at: realNow(),
      elapsedHours: final.elapsedHours,
      wallSeconds: final.wallSeconds,
      stopped,
    }) + '\n',
  );
  console.log(JSON.stringify(final, null, 2));
} finally {
  controller.close();
  store.close();
  spend.db.close();
  Date.now = realNow;
}
