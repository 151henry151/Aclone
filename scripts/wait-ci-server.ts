// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';

/** Do not run browser actions against another application sharing the CI host. */
export async function waitForGameServer(base: string, pid: number, version: string) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      if (!Number.isInteger(pid) || pid <= 1) throw new Error('Invalid PID');
      process.kill(pid, 0);
    } catch {
      throw new Error('CI game server exited; inspect /tmp/aclone.log before running browsers.');
    }
    const response = await fetch(new URL('api/health', base), {
      signal: AbortSignal.timeout(2000),
    }).catch(() => undefined);
    if (response?.ok) {
      const health = await response.json().catch(() => null);
      if (
        health?.ok !== true ||
        health.version !== version ||
        !Number.isInteger(health.worlds) ||
        health.worlds < 0
      ) {
        throw new Error(`Unexpected service or version at ${base}; expected Aclone ${version}.`);
      }
      // The server can lose a bind race while the HTTP request is in flight.
      try {
        process.kill(pid, 0);
      } catch {
        throw new Error('CI game server exited during health verification.');
      }
      console.log(`Verified Aclone ${version} at ${base}`);
      return;
    }
    await setTimeout(1000);
  }
  throw new Error(`Aclone did not become ready at ${base}; inspect /tmp/aclone.log.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  await waitForGameServer(
    process.env.TEST_URL!,
    Number(readFileSync('/tmp/aclone-ci-server.pid', 'utf8').trim()),
    version,
  );
}
