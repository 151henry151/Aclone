// SPDX-License-Identifier: GPL-3.0-or-later
// Reproducible local capacity probe. Never targets a production database.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { WebSocket } from 'ws';

const count = Number(process.env.LOAD_CLIENTS ?? 100);
const duration = Number(process.env.LOAD_SECONDS ?? 10);
const protocol = Number(process.env.LOAD_PROTOCOL ?? 3);
const parked = process.env.LOAD_PARKED === '1';
if (![2, 3].includes(protocol)) throw Error('Use LOAD_PROTOCOL=2 or 3');
if (!Number.isInteger(count) || count < 1 || count > 128 || duration < 2 || duration > 300)
  throw Error('Use 1–128 clients and 2–300 seconds');
const dir = mkdtempSync(join(tmpdir(), 'aclone-load-'));
const child = fork(new URL('./load-server.ts', import.meta.url), [], {
  env: { ...process.env, LOAD_DATA: dir, LOAD_CLIENTS: String(count) },
  stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
});
const receive = () =>
  new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Load server timed out')), 30000);
    child.once('message', (message) => {
      clearTimeout(timeout);
      resolve(message);
    });
  });
const sockets: WebSocket[] = [];
let timer: ReturnType<typeof setInterval> | undefined;

try {
  const { port, pilots } = await receive();
  let bytes = 0,
    frames = 0,
    failures = 0,
    measure = false;
  await Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const pilot = pilots[i];
      const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
      sockets.push(socket);
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(Error('Connection timeout')), 30000);
        socket.on('error', reject);
        socket.on('open', () =>
          socket.send(
            JSON.stringify({ type: 'hello', protocol, token: pilot.token, world: 'puddlewick' }),
          ),
        );
        socket.on('message', (raw) => {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'state') {
            if (msg.sequence) socket.send(JSON.stringify({ type: 'ack', sequence: msg.sequence }));
            clearTimeout(timeout);
            resolve();
            if (measure) {
              bytes += Buffer.byteLength(raw.toString());
              frames++;
            }
          }
          if (msg.type === 'result' && !msg.ok) failures++;
        });
      });
    }),
  );
  timer = setInterval(
    () =>
      sockets.forEach((ws, i) => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(
            JSON.stringify({
              type: 'input',
              input: {
                throttle: !parked && i % 3 === 0 ? 0.5 : 0,
                steer: parked ? 0 : i % 2 ? 0.1 : -0.1,
                boost: false,
              },
            }),
          );
      }),
    50,
  );
  child.send('measure');
  measure = true;
  const wireStart = sockets.reduce((sum, ws) => sum + (ws as any)._socket.bytesRead, 0);
  const start = performance.now();
  await new Promise((r) => setTimeout(r, duration * 1000));
  const seconds = (performance.now() - start) / 1000;
  if (failures || sockets.some((ws) => ws.readyState !== WebSocket.OPEN))
    throw Error('Load test lost a connection or rejected actions');
  const response = receive();
  child.send('report');
  const timing = await response;
  const wireBytes = sockets.reduce((sum, ws) => sum + (ws as any)._socket.bytesRead, 0) - wireStart;
  console.log(
    JSON.stringify(
      {
        clients: count,
        protocol,
        parked,
        seconds: +seconds.toFixed(1),
        frames,
        serverOutboundKiBPerSecond: +(bytes / 1024 / seconds).toFixed(1),
        perClientKiBPerSecond: +(bytes / 1024 / seconds / count).toFixed(1),
        wireKiBPerClientPerSecond: +(wireBytes / 1024 / seconds / count).toFixed(1),
        ...timing,
        failures,
      },
      null,
      2,
    ),
  );
} finally {
  if (timer) clearInterval(timer);
  for (const ws of sockets) ws.terminate();
  child.send('close');
  await new Promise((r) => child.once('exit', r));
  rmSync(dir, { recursive: true, force: true });
}
