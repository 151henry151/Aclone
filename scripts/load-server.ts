// SPDX-License-Identifier: GPL-3.0-or-later
// Child process keeps synthetic client parsing out of server timing measurements.
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { createApp } from '../src/server/app.ts';
const app = await createApp({ dataDir: process.env.LOAD_DATA!, port: 0 });
const pilots = Array.from({ length: Number(process.env.LOAD_CLIENTS) }, (_, i) =>
  app.universe.register('Load ' + i),
);
const port = await app.listen();
const delay = monitorEventLoopDelay({ resolution: 10 });
process.send?.({ port, pilots });
process.on('message', async (message: string) => {
  if (message === 'measure') {
    delay.enable();
    delay.reset();
  }
  if (message === 'report')
    process.send?.({
      eventLoopP99Ms: +(delay.percentile(99) / 1e6).toFixed(1),
      eventLoopMaxMs: +(delay.max / 1e6).toFixed(1),
    });
  if (message === 'close') {
    delay.disable();
    await app.close();
    process.exit(0);
  }
});
process.on('disconnect', async () => {
  await app.close();
  process.exit(0);
});
