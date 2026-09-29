// SPDX-License-Identifier: GPL-3.0-or-later
import { Worker } from 'node:worker_threads';
import type { World } from '../shared/types.ts';
export interface ScriptResult {
  messages: string[];
  variables: Record<string, number>;
  kudos: Record<string, number>;
}
let activeWorkers = 0;
// Untrusted world scripts run off the simulation thread with a hard deadline and a private heap.
export function runScript(
  world: World,
  source: string,
  event: string,
  data: Record<string, string | number>,
): Promise<ScriptResult> {
  if (activeWorkers >= 4) return Promise.reject(Error('Script workers busy; try again shortly'));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./script-worker.mjs', import.meta.url), {
      workerData: { world: { ...world, messages: [], ledger: [] }, source, event, data },
      resourceLimits: { maxOldGenerationSizeMb: 32, maxYoungGenerationSizeMb: 8, stackSizeMb: 2 },
    });
    activeWorkers++;
    worker.once('exit', () => activeWorkers--);
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(Error('Script exceeded execution deadline'));
    }, 1500);
    worker.once('message', (result) => {
      clearTimeout(timer);
      void worker.terminate();
      if (result.error) reject(Error(result.error));
      else resolve(result);
    });
    worker.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    worker.once('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0) reject(Error('Script worker stopped'));
    });
  });
}
