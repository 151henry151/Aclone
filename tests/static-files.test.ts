import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, request } from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { acceptedEncodings, serveStatic } from '../src/server/static-files';
import { compressClient } from '../scripts/compress-client';

test('encoding negotiation honors exclusions, preferences and wildcards', () => {
  assert.deepEqual(acceptedEncodings('gzip, br'), ['br', 'gzip']);
  assert.deepEqual(acceptedEncodings('br;q=0, gzip;q=0.5'), ['gzip']);
  assert.deepEqual(acceptedEncodings('br;q=0.1, gzip;q=1'), ['gzip', 'br']);
  assert.deepEqual(acceptedEncodings('*;q=1, br;q=0'), ['gzip']);
  assert.deepEqual(acceptedEncodings(), []);
});
test('production files compress, revalidate, support HEAD and preserve decoded bytes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aclone-static-'));
  const body = 'const game = "a small persistent universe";\n'.repeat(200);
  const file = join(dir, 'index-abcdefgh.js');
  await writeFile(file, body);
  await compressClient(dir);
  const server = createServer((req, res) => {
    void serveStatic(req, res, file, 'text/javascript', req.url !== '/html').catch(() => {
      res.writeHead(500);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const get = (headers: Record<string, string> = {}, method = 'GET', path = '/') =>
    new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: Buffer }>(
      (resolve, reject) => {
        const req = request(
          { hostname: '127.0.0.1', port: address.port, path, method, headers },
          (res) => {
            const chunks: Buffer[] = [];
            res.on('data', (b) => chunks.push(b));
            res.on('end', () =>
              resolve({
                status: res.statusCode!,
                headers: res.headers,
                body: Buffer.concat(chunks),
              }),
            );
          },
        );
        req.on('error', reject);
        req.end();
      },
    );
  try {
    for (const encoding of ['br', 'gzip']) {
      const result = await get({ 'accept-encoding': encoding });
      assert.equal(result.status, 200);
      assert.equal(result.headers['content-encoding'], encoding);
      assert.equal(
        (encoding === 'br'
          ? brotliDecompressSync(result.body)
          : gunzipSync(result.body)
        ).toString(),
        body,
      );
      assert.ok(result.body.length < body.length / 2);
      assert.match(String(result.headers['cache-control']), /immutable/);
      assert.equal(result.headers.vary, 'Accept-Encoding');
      const cached = await get({ 'if-none-match': String(result.headers.etag) });
      assert.equal(cached.status, 304);
      assert.equal(cached.body.length, 0);
      const head = await get({ 'accept-encoding': encoding }, 'HEAD');
      assert.equal(head.body.length, 0);
      assert.equal(head.headers['content-length'], result.headers['content-length']);
    }
    const plain = await get();
    assert.equal(plain.body.toString(), body);
    assert.equal(plain.headers['content-encoding'], undefined);
    assert.equal((await get({}, 'GET', '/html')).headers['cache-control'], 'no-cache');
    assert.equal((await get({}, 'POST')).status, 405);
    await writeFile(file, body + '// new deployment');
    const updated = await get({
      'accept-encoding': 'br',
      'if-none-match': String(plain.headers.etag),
    });
    assert.equal(updated.status, 200);
    assert.notEqual(updated.headers.etag, plain.headers.etag);
    // An old sidecar must never replace a newer source file.
    assert.equal(updated.headers['content-encoding'], undefined);
    assert.equal(updated.body.toString(), body + '// new deployment');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
