// SPDX-License-Identifier: GPL-3.0-or-later
import { VERSION } from '../shared/version';
import { createApp } from './app.ts';
const app = await createApp({
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
