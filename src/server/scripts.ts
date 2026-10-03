// SPDX-License-Identifier: GPL-3.0-or-later
import { effectSchema, validateEffect } from '../shared/creator.ts';
import { Worker } from 'node:worker_threads';
import type { World } from '../shared/types.ts';
import { say } from '../shared/simulation.ts';
export interface ScriptResult {
  playerVariables?: Record<string, { deaths: number; values: Record<string, number> }>;
  effects?: { player?: string; effect: Record<string, unknown> }[];
  messages: string[];
  variables: Record<string, number>;
  kudos: Record<string, number>;
}
let activeWorkers = 0;
// Startup and execution have separate budgets; pooled jobs reuse only the trusted
// runtime. Every invocation constructs and closes a fresh isolated Lua state.
export function collectScriptResult(
  worker: Worker,
  {
    startupMs = 10000,
    executionMs = 1500,
    ready: alreadyReady = false,
    reuse = false,
    job,
  }: {
    startupMs?: number;
    executionMs?: number;
    ready?: boolean;
    reuse?: boolean;
    job?: unknown;
  } = {},
): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    let settled = false,
      ready = false;
    const finish = (error?: Error, result?: ScriptResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.off('message', message);
      worker.off('error', failed);
      worker.off('exit', exited);
      if (error || !reuse) void worker.terminate();
      else worker.unref();
      if (error) reject(error);
      else resolve(result!);
    };
    let timer = setTimeout(
      () => finish(Error('Script worker exceeded startup deadline')),
      startupMs,
    );
    const start = () => {
      ready = true;
      clearTimeout(timer);
      timer = setTimeout(() => finish(Error('Script exceeded execution deadline')), executionMs);
      worker.postMessage(job ?? { run: true });
    };
    const message = (result: any) => {
      if (result.ready && !ready) start();
      else finish(result.error ? Error(result.error) : undefined, result);
    };
    const failed = (error: Error) => finish(error);
    const exited = () => finish(Error('Script worker stopped without a result'));
    worker.on('message', message);
    worker.once('error', failed);
    worker.once('exit', exited);
    worker.ref();
    if (alreadyReady) start();
  });
}
const workerOptions = {
  execArgv: [],
  resourceLimits: { maxOldGenerationSizeMb: 32, maxYoungGenerationSizeMb: 8, stackSizeMb: 2 },
};
function scriptJob(
  world: World,
  source: string,
  event: string,
  data: Record<string, string | number>,
) {
  // Only the event player exposes private inventory, skills and progress to Lua.
  // No terrain, building stock, account secrets or other private player state.
  return {
    world: {
      time: world.time,
      messageSeq: world.messageSeq,
      messages: [],
      scriptVariables: { ...world.scriptVariables },
      players: Object.fromEntries(
        Object.entries(world.players).map(([id, p]) => [
          id,
          {
            ...(id === data.id
              ? {
                  deaths: p.deaths,
                  inventory: { ...p.inventory },
                  skills: [...p.skills],
                  scriptState: { ...p.scriptState },
                }
              : {}),
            kudos: p.kudos,
            x: p.x,
            z: p.z,
            health: p.health,
            hunger: p.hunger,
            thirst: p.thirst,
            team: p.team,
          },
        ]),
      ),
    },
    source,
    event,
    data,
  };
}
/** Two reusable runtime workers per server; bounded waiting jobs and private Lua
 * states. A timed-out, failed or old worker is discarded, never returned to use. */
export class ScriptPool {
  private slots: { worker: Worker; busy: boolean; ready: boolean; jobs: number }[] = [];
  private waiting: {
    job: ReturnType<typeof scriptJob>;
    resolve: (r: ScriptResult) => void;
    reject: (e: Error) => void;
  }[] = [];
  private closed = false;
  run(
    world: World,
    source: string,
    event: string,
    data: Record<string, string | number>,
  ): Promise<ScriptResult> {
    if (this.closed) return Promise.reject(Error('Script pool closed'));
    if (!source.trim())
      return Promise.resolve({ messages: [], variables: { ...world.scriptVariables }, kudos: {} });
    if (this.waiting.length >= 32)
      return Promise.reject(Error('Script workers busy; try again shortly'));
    return new Promise((resolve, reject) => {
      this.waiting.push({ job: scriptJob(world, source, event, data), resolve, reject });
      this.drain();
    });
  }
  private drain() {
    if (this.closed) return;
    while (this.waiting.length) {
      let slot = this.slots.find((s) => !s.busy);
      if (!slot && this.slots.length < 2) {
        const worker = new Worker(new URL('./script-worker.mjs', import.meta.url), workerOptions);
        slot = { worker, busy: false, ready: false, jobs: 0 };
        this.slots.push(slot);
        // An idle runtime has no pending promise; still discard an unexpected exit.
        const current = slot;
        worker.on('error', () => {});
        worker.on('exit', () => {
          this.slots = this.slots.filter((s) => s !== current);
          this.drain();
        });
      }
      if (!slot) return;
      const task = this.waiting.shift()!,
        current = slot;
      current.busy = true;
      const finish = (error?: Error, result?: ScriptResult) => {
        current.busy = false;
        current.ready = true;
        if (error || ++current.jobs >= 100) {
          this.slots = this.slots.filter((s) => s !== current);
          void current.worker.terminate();
        }
        this.drain();
        if (error) task.reject(error);
        else task.resolve(result!);
      };
      void collectScriptResult(current.worker, {
        reuse: true,
        ready: current.ready,
        job: task.job,
      }).then(
        (result) => finish(undefined, result),
        (error) => finish(error),
      );
    }
  }
  async close() {
    this.closed = true;
    for (const task of this.waiting.splice(0)) task.reject(Error('Script pool closed'));
    const slots = this.slots.splice(0);
    await Promise.all(slots.map((s) => s.worker.terminate()));
  }
}
// Untrusted world scripts run off the simulation thread with a hard deadline and a private heap.
export function runScript(
  world: World,
  source: string,
  event: string,
  data: Record<string, string | number>,
): Promise<ScriptResult> {
  if (!source.trim())
    return Promise.resolve({ messages: [], variables: { ...world.scriptVariables }, kudos: {} });
  if (activeWorkers >= 4) return Promise.reject(Error('Script workers busy; try again shortly'));
  const worker = new Worker(new URL('./script-worker.mjs', import.meta.url), {
    ...workerOptions,
    workerData: scriptJob(world, source, event, data),
  });
  activeWorkers++;
  worker.once('exit', () => activeWorkers--);
  return collectScriptResult(worker);
}

/** Back off broken automatic events without suppressing explicit editor validation. */
export class ScriptEvents {
  private failures = new WeakMap<World, { source: string; retryAt: number }>();
  constructor(
    private execute = runScript,
    private now = Date.now,
  ) {}
  reset(world: World) {
    this.failures.delete(world);
  }
  async run(
    world: World,
    event: string,
    data: Record<string, string | number>,
    isCurrent: () => boolean,
  ) {
    const source = world.script;
    const failure = this.failures.get(world);
    if (failure?.source === source && this.now() < failure.retryAt) return;
    try {
      const result = await this.execute(world, source, event, data);
      for (const e of result.effects ?? []) validateEffect(world, e.effect);
      if (!isCurrent() || source !== world.script) return;
      // An older in-flight success must not undo a newer failure’s backoff.
      if (this.failures.get(world) === failure) this.reset(world);
      return result;
    } catch (error) {
      if (!isCurrent() || source !== world.script) return;
      // Several events can already be in flight when the first failure arrives.
      const previous = this.failures.get(world);
      if (previous?.source === source && this.now() < previous.retryAt) return;
      this.failures.set(world, { source, retryAt: this.now() + 60000 });
      say(
        world,
        'Script error',
        String((error as Error).message).slice(0, 160) +
          '. Automatic scripts paused for 60 seconds; the world owner can validate and reload to retry now.',
      );
    }
  }
}

/** A worker finishing after death must never resurrect progress from the old life. */
export function applyPlayerVariables(world: World, result: ScriptResult) {
  for (const [id, update] of Object.entries(result.playerVariables ?? {})) {
    const p = world.players[id];
    if (p && p.deaths === update.deaths) p.scriptState = { ...update.values };
  }
}
