// SPDX-License-Identifier: GPL-3.0-or-later
import { readFile, stat } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Prefer a build-time representation; never spend simulation CPU compressing downloads. */
export function acceptedEncodings(header = ''): string[] {
  const qualities = new Map(
    header
      .toLowerCase()
      .split(',')
      .map((part) => {
        const [name, ...params] = part.trim().split(';');
        const q = params.find((p) => p.trim().startsWith('q='));
        const value = q ? Number(q.trim().slice(2)) : 1;
        return [name, Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0];
      }),
  );
  return ['br', 'gzip']
    .filter((name) => (qualities.get(name) ?? qualities.get('*') ?? 0) > 0)
    .sort(
      (a, b) =>
        (qualities.get(b) ?? qualities.get('*') ?? 0) -
        (qualities.get(a) ?? qualities.get('*') ?? 0),
    );
}

export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  file: string,
  type: string,
  immutable: boolean,
  headers: Record<string, string> = {},
) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end();
    return;
  }
  const original = await stat(file);
  if (!original.isFile()) throw Error('Not a file');
  let selected = file,
    info = original,
    encoding: string | undefined;
  for (const candidate of acceptedEncodings(req.headers['accept-encoding'])) {
    try {
      const path = file + (candidate === 'br' ? '.br' : '.gz');
      const compressed = await stat(path);
      if (!compressed.isFile() || compressed.mtimeMs < original.mtimeMs) continue;
      selected = path;
      info = compressed;
      encoding = candidate;
      break;
    } catch {
      /* Builds without sidecars still work. */
    }
  }
  const etag = `W/"${original.size.toString(16)}-${original.mtimeMs.toString(16)}"`;
  const notModified = req.headers['if-none-match']
    ?.split(',')
    .some((value) => value.trim() === etag || value.trim() === '*');
  // Complete disk reads before setting representation headers, so an error can
  // still be returned as ordinary JSON rather than mislabeled compressed data.
  const body = notModified || req.method === 'HEAD' ? undefined : await readFile(selected);
  res.setHeader('Content-Type', type);
  res.setHeader('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
  res.setHeader('ETag', etag);
  res.setHeader('Vary', 'Accept-Encoding');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  if (encoding) res.setHeader('Content-Encoding', encoding);
  if (notModified) {
    res.writeHead(304);
    res.end();
    return;
  }
  res.setHeader('Content-Length', info.size);
  res.writeHead(200);
  res.end(body);
}
