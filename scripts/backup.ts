// SPDX-License-Identifier: GPL-3.0-or-later
import { Store } from '../src/server/store.ts';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
const root = resolve(process.env.DATA_DIR ?? 'var');
const db = join(root, 'aclone.sqlite');
if (!existsSync(db)) throw Error('No saved world database at ' + db);
const target = resolve(process.argv[2] ?? join(root, 'backups', `manual-${Date.now()}.sqlite`));
const store = new Store(db);
try {
  await store.backup(target);
  console.log('Saved consistent SQLite backup: ' + target);
} finally {
  store.close();
}
