// SPDX-License-Identifier: GPL-3.0-or-later
import { workerData, parentPort } from 'node:worker_threads';
import { register } from 'tsx/esm/api';
register();
const { WorldScript } = await import('./lua.ts');
const { world, source, event, data } = workerData;
try {
  const before = Object.fromEntries(Object.entries(world.players).map(([id, p]) => [id, p.kudos]));
  const script = new WorldScript(world, source);
  script.emit(event, data);
  parentPort.postMessage({
    messages: world.messages.map((m) => m.text),
    variables: world.scriptVariables,
    kudos: Object.fromEntries(
      Object.entries(world.players).map(([id, p]) => [id, p.kudos - before[id]]),
    ),
  });
  script.close();
} catch (e) {
  parentPort.postMessage({ error: e.message });
}
