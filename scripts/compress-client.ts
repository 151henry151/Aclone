// SPDX-License-Identifier: GPL-3.0-or-later
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { gzip, brotliCompress, constants } from 'node:zlib';
export async function compressClient(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await compressClient(path);
    else if (/\.(html|js|css|svg|json)$/.test(entry.name)) {
      const source = await readFile(path);
      if (source.length < 512) continue;
      for (const [suffix, body] of [
        ['.gz', await promisify(gzip)(source, { level: 6 })],
        [
          '.br',
          await promisify(brotliCompress)(source, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 6 },
          }),
        ],
      ] as const)
        if (body.length < source.length) await writeFile(path + suffix, body);
    }
  }
}
