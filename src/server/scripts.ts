// SPDX-License-Identifier: GPL-3.0-or-later
import { Worker } from 'node:worker_threads';
import type { World } from '../shared/types.ts';
import { say } from '../shared/simulation.ts';
export interface ScriptResult {
  messages: string[];
  variables: Record<string, number>;
  kudos: Record<string, number>;
}
let activeWorkers = 0;
// Startup includes loading TypeScript and Fengari; only the ready worker runs untrusted Lua.
export function collectScriptResult(
  worker: Worker,
  { startupMs = 10000, executionMs = 1500 } = {},
): Promise<ScriptResult> {
  return new Promise((resolve, reject) => {
    let settled = false,
      ready = false;
    const finish = (error?: Error, result?: ScriptResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolve(result!);
    };
    let timer = setTimeout(
      () => finish(Error('Script worker exceeded startup deadline')),
      startupMs,
    );
    worker.on('message', (result) => {
      if (settled) return;
      if (result.ready && !ready) {
        ready = true;
        clearTimeout(timer);
        timer = setTimeout(() => finish(Error('Script exceeded execution deadline')), executionMs);
        worker.postMessage({ run: true });
      } else {
        finish(result.error ? Error(result.error) : undefined, result);
      }
    });
    worker.once('error', (error) => finish(error));
    worker.once('exit', () => finish(Error('Script worker stopped without a result')));
  });
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
    workerData: { world: { ...world, messages: [], ledger: [] }, source, event, data },
    resourceLimits: { maxOldGenerationSizeMb: 32, maxYoungGenerationSizeMb: 8, stackSizeMb: 2 },
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
