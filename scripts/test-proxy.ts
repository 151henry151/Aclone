// SPDX-License-Identifier: GPL-3.0-or-later
// Loopback-only fixture for prefix-stripping HTTP/WebSocket deployment tests.
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
const upstream = Number(process.env.UPSTREAM_PORT ?? 3012);
const port = Number(process.env.PROXY_PORT ?? 3013);
const prefix = '/aclone';
const proxy = createServer((req, res) => {
  if (req.url === prefix) {
    res.writeHead(308, { location: prefix + '/' });
    res.end();
    return;
  }
  if (!req.url?.startsWith(prefix + '/')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const forwarded = request(
    {
      hostname: '127.0.0.1',
      port: upstream,
      path: req.url.slice(prefix.length),
      method: req.method,
      headers: req.headers,
    },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    },
  );
  forwarded.on('error', () => {
    res.writeHead(502);
    res.end();
  });
  req.pipe(forwarded);
});
proxy.on('upgrade', (req, socket, head) => {
  if (req.url !== prefix + '/ws') {
    socket.destroy();
    return;
  }
  const target = connect(upstream, '127.0.0.1', () => {
    target.write(
      `GET /ws HTTP/1.1\r\n${Object.entries(req.headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\r\n')}\r\n\r\n`,
    );
    if (head.length) target.write(head);
    socket.pipe(target).pipe(socket);
  });
  socket.on('error', () => target.destroy());
  target.on('error', () => socket.destroy());
  socket.on('close', () => target.destroy());
  target.on('close', () => socket.destroy());
});
proxy.listen(port, '127.0.0.1', () =>
  console.log(`Prefix test proxy: http://127.0.0.1:${port}/aclone/`),
);
