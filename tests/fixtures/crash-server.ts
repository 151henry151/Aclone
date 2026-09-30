// SPDX-License-Identifier: GPL-3.0-or-later
import { createApp } from '../../src/server/app.ts';
const app = await createApp({ dataDir: process.env.CRASH_DATA!, port: 0 });
process.send?.({ port: await app.listen() });
process.on('disconnect', () => process.exit(0));
