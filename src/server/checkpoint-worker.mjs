// SPDX-License-Identifier: GPL-3.0-or-later
import { parentPort, workerData } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { writeWorldCheckpoint, durablePragmas } from './checkpoint-data.ts';
const db = new DatabaseSync(workerData.path);
db.exec(durablePragmas);
parentPort.on('message', ({ worlds, playtime, close }) => {
  if (close) {
    db.close();
    parentPort.close();
    return;
  }
  let transaction = false;
  try {
    db.exec('BEGIN IMMEDIATE');
    transaction = true;
    for (const world of worlds) writeWorldCheckpoint(db, world);
    if (playtime.length) {
      const write = db.prepare(
        'INSERT INTO player_playtime VALUES (?,?,?,?) ON CONFLICT(account) DO UPDATE SET recorded=excluded.recorded',
      );
      for (const row of playtime) write.run(...row);
    }
    db.exec('COMMIT');
    parentPort.postMessage({ ok: true });
  } catch (error) {
    if (transaction) db.exec('ROLLBACK');
    parentPort.postMessage({ ok: false, error: error.message });
  }
});
