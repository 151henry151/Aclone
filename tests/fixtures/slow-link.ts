// SPDX-License-Identifier: GPL-3.0-or-later
import { createServer, createConnection, type Socket } from 'node:net';
/** TCP shaping includes real WebSocket compression and framing. Each direction
 * preserves byte order, limits bandwidth and applies deterministic latency/jitter.
 * For local test servers only; never binds a public interface. No packet-loss model. */
export async function slowLink(
  upstreamPort: number,
  profile: {
    downBytesPerSecond: number;
    upBytesPerSecond: number;
    oneWayMs: number;
    jitterMs: number;
  },
) {
  const sockets = new Set<Socket>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const metrics = { downBytes: 0, upBytes: 0, maxQueueMs: 0 };
  const server = createServer((downstream) => {
    const upstream = createConnection({ host: '127.0.0.1', port: upstreamPort });
    sockets.add(upstream);
    sockets.add(downstream);
    for (const socket of [upstream, downstream]) {
      socket.setNoDelay(true);
      socket.on('error', () => {
        upstream.destroy();
        downstream.destroy();
      });
      socket.on('close', () => {
        sockets.delete(socket);
        upstream.destroy();
        downstream.destroy();
      });
    }
    const pipe = (
      source: Socket,
      target: Socket,
      bytesPerSecond: number,
      direction: 'downBytes' | 'upBytes',
    ) => {
      let due = 0,
        index = 0;
      source.on('data', (data) => {
        const now = performance.now();
        const ready =
          now + profile.oneWayMs + [0, 0.8, 0.2, 1, 0.4][index++ % 5] * profile.jitterMs;
        // Small chunks permit continuous flow instead of artificial whole-buffer bursts.
        for (let offset = 0; offset < data.length; offset += 256) {
          const chunk = Buffer.from(data.subarray(offset, offset + 256));
          due = Math.max(due, ready) + (chunk.length / bytesPerSecond) * 1000;
          metrics.maxQueueMs = Math.max(metrics.maxQueueMs, due - now);
          const timer = setTimeout(
            () => {
              timers.delete(timer);
              if (!target.destroyed) {
                target.write(chunk);
                metrics[direction] += chunk.length;
              }
            },
            Math.max(0, due - performance.now()),
          );
          timers.add(timer);
        }
      });
    };
    pipe(upstream, downstream, profile.downBytesPerSecond, 'downBytes');
    pipe(downstream, upstream, profile.upBytesPerSecond, 'upBytes');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: (server.address() as { port: number }).port,
    metrics,
    async close() {
      for (const timer of timers) clearTimeout(timer);
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
