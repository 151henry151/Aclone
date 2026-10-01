// SPDX-License-Identifier: GPL-3.0-or-later
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { Store } from '../src/server/store.ts';
import { NpcMemory } from '../src/server/npc/memory.ts';
import { NpcBudget, budgetSchema } from '../src/server/npc/budget.ts';
const path = join(resolve(process.env.DATA_DIR ?? 'var'), 'aclone.sqlite');
if (!existsSync(path)) throw Error('No game database at ' + path);
const store = new Store(path),
  memory = new NpcMemory(store);
try {
  const [command = 'status', id = 'mabel', query = '', before] = process.argv.slice(2);
  if (command === 'status') {
    const residents = store.db
      .prepare('SELECT id,state FROM npc_residents')
      .all()
      .map((row) => {
        const s = JSON.parse(String(row.state));
        return {
          id: row.id,
          name: s.name,
          world: s.world,
          status: s.status,
          paused: memory.paused(String(row.id)),
          intent: s.intent,
          presence: s.presence,
          memories: memory.count(String(row.id)),
        };
      });
    console.log(
      JSON.stringify(
        {
          residents,
          usage: new NpcBudget(
            memory,
            budgetSchema.parse(
              JSON.parse(
                String(
                  store.db.prepare("SELECT value FROM meta WHERE key='npc-budget-config'").get()
                    ?.value ?? '{}',
                ),
              ),
            ),
          ).usage(),
        },
        null,
        2,
      ),
    );
  } else {
    if (!memory.load(id)) throw Error('Unknown resident: ' + id);
    if (command === 'pause' || command === 'resume') {
      memory.pause(id, command === 'pause');
      console.log(
        id +
          ' ' +
          (command === 'pause' ? 'paused' : 'resumed') +
          '. The running server notices within one second.',
      );
    } else if (command === 'memory')
      console.log(
        JSON.stringify(
          query ? memory.search(id, query, before ? Number(before) : null) : memory.recent(id, 30),
          null,
          2,
        ),
      );
    else
      throw Error(
        'Usage: npm run npc -- status | pause ID | resume ID | memory ID [query] [before-ID]',
      );
  }
} finally {
  store.close();
}
