// SPDX-License-Identifier: GPL-3.0-or-later
// Local-only static preview, separate from the game and its saves.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
export async function serveWebsite(port = 4174) {
  const root = resolve(import.meta.dirname, '../website-dist');
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
  };
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url!, 'http://localhost').pathname);
      const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!path.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const content = await readFile(path);
      res
        .writeHead(200, {
          'content-type': types[extname(path)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        })
        .end(content);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  await new Promise<void>((ok, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', ok);
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await serveWebsite();
  console.log(
    'Website preview: http://127.0.0.1:4174 (game links point to /aclone/ on the live host)',
  );
}
