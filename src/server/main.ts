// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile } from 'node:fs/promises';
import { configuredResidents } from './npc/providers.ts';
import { VERSION } from '../shared/version';
import { createApp } from './app.ts';
const app = await createApp({
  npc: configuredResidents(),
  federation: process.env.GALAXY_URL
    ? {
        name: process.env.GALAXY_NAME ?? 'Aclone galaxy',
        url: process.env.GALAXY_URL,
        peers: process.env.GALAXY_PEERS_FILE
          ? JSON.parse(await readFile(process.env.GALAXY_PEERS_FILE, 'utf8'))
          : [],
      }
    : undefined,
  dataDir: process.env.DATA_DIR ?? 'var',
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '127.0.0.1',
  dev: process.argv.includes('--dev'),
});
const port = await app.listen();
console.log(
  `Aclone ${VERSION} · http://${process.env.HOST ?? '127.0.0.1'}:${port} · Ctrl+C to save and stop.`,
);
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    await app.close();
    process.exit(0);
  });
