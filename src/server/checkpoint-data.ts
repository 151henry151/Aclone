// SPDX-License-Identifier: GPL-3.0-or-later
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
export const durablePragmas =
  'PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;';
export type CheckpointRow = SQLInputValue[];
export interface WorldCheckpoint {
  id: string;
  state: string;
  saved: number;
  messages: CheckpointRow[];
  ledger: CheckpointRow[];
}
/** Shared by synchronous action saves and the periodic writer. The caller owns
 * the transaction, so world state and its history always commit together. */
export function writeWorldCheckpoint(db: DatabaseSync, record: WorldCheckpoint) {
  const message = db.prepare(
    'INSERT OR IGNORE INTO public_messages (world,message_id,time,name,text,kind,npc) VALUES (?,?,?,?,?,?,?)',
  );
  const last = Number(
    db
      .prepare('SELECT COALESCE(MAX(message_id),0) AS id FROM public_messages WHERE world=?')
      .get(record.id)!.id,
  );
  for (const row of record.messages) if (Number(row[1]) > last) message.run(...row);
  const ledger = db.prepare(
    'INSERT OR IGNORE INTO ledger (world,id,time,kind,amount,sender,recipient,reason,details) VALUES (?,?,?,?,?,?,?,?,?)',
  );
  for (const row of record.ledger) ledger.run(...row);
  db.prepare('INSERT OR REPLACE INTO worlds VALUES (?,?,?)').run(
    record.id,
    record.state,
    record.saved,
  );
}
