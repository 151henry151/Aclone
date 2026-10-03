// SPDX-License-Identifier: GPL-3.0-or-later
import { workerData, parentPort } from 'node:worker_threads';
// Node 24 strips these few types natively; do not boot a TS loader and the entire game graph.
const { WorldScript } = await import('./lua.ts');
parentPort.postMessage({ ready: true });
parentPort.on('message', (job) => {
  const { world, source, event, data } = workerData ?? job;
  try {
    const before = Object.fromEntries(
      Object.entries(world.players).map(([id, p]) => [id, p.kudos]),
    );
    const script = new WorldScript(world, source, data.id);
    script.emit(event, data);
    parentPort.postMessage({
      messages: world.messages.map((m) => m.text),
      variables: world.scriptVariables,
      playerVariables:
        data.id && world.players[data.id]
          ? {
              [data.id]: {
                deaths: world.players[data.id].deaths,
                values: world.players[data.id].scriptState ?? {},
              },
            }
          : {},
      effects: script.effects,
      kudos: Object.fromEntries(
        Object.entries(world.players).map(([id, p]) => [id, p.kudos - before[id]]),
      ),
    });
    script.close();
  } catch (e) {
    parentPort.postMessage({ error: e.message });
  }
});
