// SPDX-License-Identifier: GPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { collectScriptResult, ScriptEvents } from '../src/server/scripts.ts';
import { createWorld } from '../src/shared/simulation.ts';

const result = { messages: [], variables: {}, kudos: {} };
test('worker startup does not consume the Lua execution deadline', async () => {
  const worker = new Worker(
    `
    const { parentPort } = require('node:worker_threads');
    setTimeout(() => parentPort.postMessage({ ready: true }), 300);
    parentPort.once('message', () => parentPort.postMessage(${JSON.stringify(result)}));
  `,
    { eval: true },
  );
  assert.deepEqual(
    await collectScriptResult(worker, { startupMs: 3000, executionMs: 100 }),
    result,
  );
});
test('unresponsive startup and runaway execution both remain bounded', async () => {
  const startup = new Worker('setInterval(() => {}, 1000)', { eval: true });
  await assert.rejects(
    collectScriptResult(startup, { startupMs: 100, executionMs: 100 }),
    /startup deadline/,
  );
  const running = new Worker(
    `
    const { parentPort } = require('node:worker_threads');
    parentPort.postMessage({ ready: true });
    parentPort.once('message', () => { while (true) {} });
  `,
    { eval: true },
  );
  await assert.rejects(
    collectScriptResult(running, { startupMs: 3000, executionMs: 100 }),
    /execution deadline/,
  );
});
test('a worker that exits without a result rejects rather than leaving an event pending', async () => {
  const worker = new Worker('', { eval: true });
  await assert.rejects(collectScriptResult(worker), /without a result/);
});
test('failing automatic scripts produce one notice and pause until retry or reload', async () => {
  const world = createWorld('script', 'Script', 'owner');
  let calls = 0,
    now = 0;
  const events = new ScriptEvents(
    async () => {
      calls++;
      throw Error('Script exceeded execution deadline');
    },
    () => now,
  );
  await events.run(world, 'PlayerLogin', {}, () => true);
  await events.run(world, 'TaskStart', {}, () => true);
  assert.equal(calls, 1);
  assert.equal(world.messages.filter((m) => m.name === 'Script error').length, 1);
  now = 60000;
  await events.run(world, 'TaskStart', {}, () => true);
  assert.equal(calls, 2);
  events.reset(world);
  await events.run(world, 'PlayerLogin', {}, () => true);
  assert.equal(calls, 3);
});
test('replaced scripts cannot publish stale failures or pause their replacement', async () => {
  const world = createWorld('stale', 'Stale', 'owner');
  const events = new ScriptEvents(async () => {
    throw Error('old script error');
  });
  await events.run(world, 'PlayerLogin', {}, () => false);
  assert.equal(world.messages.filter((m) => m.name === 'Script error').length, 0);
});

test('an older successful event cannot clear backoff from a concurrent failure', async () => {
  const world = createWorld('concurrent', 'Concurrent', 'owner');
  let calls = 0;
  let complete!: (value: typeof result) => void;
  const events = new ScriptEvents(async () => {
    calls++;
    if (calls === 1)
      return new Promise<typeof result>((resolve) => {
        complete = resolve;
      });
    throw Error('Script workers busy; try again shortly');
  });
  const older = events.run(world, 'PlayerLogin', {}, () => true);
  await Promise.all([
    events.run(world, 'PlayerLogin', {}, () => true),
    events.run(world, 'TaskStart', {}, () => true),
  ]);
  complete(result);
  await older;
  await events.run(world, 'PlayerLogin', {}, () => true);
  assert.equal(calls, 3);
  assert.equal(world.messages.filter((m) => m.name === 'Script error').length, 1);
});
