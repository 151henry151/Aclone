// SPDX-License-Identifier: GPL-3.0-or-later
// Child process keeps synthetic client parsing out of server timing measurements.
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { createApp } from '../src/server/app.ts';
import { npcConfigSchema } from '../src/server/npc/config.ts';
const withNpc = process.env.LOAD_NPC === '1';
const app = await createApp({
  dataDir: process.env.LOAD_DATA!,
  port: 0,
  npc: withNpc
    ? {
        residents: [
          {
            config: npcConfigSchema.parse({}),
            brain: {
              async decide() {
                const office = app.worlds
                  .get('puddlewick')!
                  .buildings.find((b) => b.kind === 'workhouse')!;
                return {
                  inputTokens: 100,
                  outputTokens: 100,
                  decision: {
                    intent: 'Exercise normal travel, paid shifts and script events',
                    notebook: '',
                    speech: null,
                    plan: [
                      { kind: 'travel' as const, destination: office.id },
                      {
                        kind: 'act' as const,
                        action: {
                          type: 'task' as const,
                          building: office.id,
                          task: 'labour' as const,
                        },
                      },
                    ],
                    repeat: 30,
                    reconsiderSeconds: 1800,
                  },
                };
              },
            },
          },
        ],
      }
    : undefined,
});
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
      npc: withNpc,
      residentStatus: app.residents?.status().map((r) => r.status),
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
