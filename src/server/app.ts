// SPDX-License-Identifier: GPL-3.0-or-later
import { leaveCombat } from '../shared/combat.ts';
import { VERSION } from '../shared/version';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { readFile, stat, mkdir, writeFile, readdir, unlink } from 'node:fs/promises';
import { resolve, join, extname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { Store } from './store.ts';
import { Universe, type Account } from './universe.ts';
import {
  createWorld,
  addPlayer,
  act,
  advance,
  move,
  say,
  distance,
  log,
} from '../shared/simulation.ts';
import { galaxy } from '../shared/catalog.ts';
import type { World, Input, Action } from '../shared/types.ts';
import { runScript, ScriptEvents } from './scripts.ts';
import { DeltaStream, prepareFrame, type Frame } from './snapshots.ts';
import { Accounts, type Mailer } from './accounts.ts';
import { configuredMailer } from './mail.ts';
import { clientAddress } from './client-address.ts';
const inputSchema = z
  .object({
    throttle: z.number().min(-1).max(1),
    steer: z.number().min(-1).max(1),
    boost: z.boolean(),
    lift: z.number().min(-1).max(1).optional(),
  })
  .strict();
const messageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    token: z.string().max(100),
    world: z.string().max(80).optional(),
    protocol: z.literal(2).optional(),
  }),
  z.object({ type: z.literal('input'), input: inputSchema }),
  z.object({
    type: z.literal('action'),
    request: z.number().int().optional(),
    action: z.record(z.string(), z.unknown()),
  }),
  z.object({ type: z.literal('ping'), at: z.number() }),
]);
interface Peer {
  socket: WebSocket;
  account?: Account;
  world?: string;
  input: Input;
  inputAt: number;
  count: number;
  window: number;
  alive: boolean;
  born: number;
  delta?: boolean;
  stream?: DeltaStream;
}
export interface AppOptions {
  dataDir: string;
  port?: number;
  host?: string;
  dev?: boolean;
  tick?: boolean;
  mailer?: Mailer;
  publicOrigin?: string;
  maxPeers?: number;
}
export async function createApp(options: AppOptions) {
  const dataDir = resolve(options.dataDir),
    store = new Store(join(dataDir, 'aclone.sqlite')),
    universe = new Universe(store),
    worlds = new Map<string, World>();
  for (const { world, saved } of store.loadWorlds()) {
    for (const p of Object.values(world.players)) p.online = false;
    let remaining = Math.min(Math.max(0, Date.now() / 1000 - saved), 86400 * 30);
    while (remaining > 0) {
      const step = Math.min(60, remaining);
      advance(world, step);
      remaining -= step;
    }
    worlds.set(world.id, world);
  }
  if (!worlds.size) {
    for (const [id, name, type] of [
      ['puddlewick', 'Puddlewick', 'economy'],
      ['brass', 'Brass & bother', 'combat'],
      ['meadow', 'Sunday meadow', 'playground'],
    ]) {
      const w = createWorld(id, name, 'server', type);
      worlds.set(id, w);
      store.saveWorld(w);
    }
  }
  const accounts = new Accounts(
    store,
    universe,
    options.mailer ?? configuredMailer(),
    options.publicOrigin ?? process.env.PUBLIC_ORIGIN,
  );
  const peers = new Set<Peer>();
  const revoke = (id: string) => {
    for (const peer of peers)
      if (peer.account?.id === id) {
        leave(peer);
        peer.account = undefined;
        peer.socket.close(4004, 'Sign in again to continue');
      }
  };
  const auth = (req: IncomingMessage) => {
    const token = req.headers.authorization?.replace(/^Bearer /, '') ?? '';
    const a = universe.authenticate(token);
    if (!a) throw Error('Sign in with your pilot key');
    return a;
  };
  const send = (p: Peer, data: unknown) => {
    if (p.socket.readyState === WebSocket.OPEN && p.socket.bufferedAmount < 1024 * 1024)
      p.socket.send(typeof data === 'string' ? data : JSON.stringify(data));
  };
  const registry = () =>
    [...worlds.values()].map((w) => ({
      id: w.id,
      name: w.name,
      template: w.template,
      system: w.id === 'brass' ? 'brindle' : w.id === 'meadow' ? 'farthing' : 'hearth',
      players: Object.values(w.players).filter((p) => p.online).length,
      owner: w.owner,
      locked: w.settings.locked,
    }));
  const snapshot = (p: Peer, frames = new Map<string, Frame>()) => {
    const w = p.world && worlds.get(p.world);
    if (!w || !p.account) return;
    const me = w.players[p.account.id];
    if (p.delta) {
      if (p.socket.bufferedAmount > 256 * 1024) {
        p.socket.close(4005, 'Connection too slow; reconnecting');
        return;
      }
      let frame = frames.get(w.id);
      if (!frame) {
        frame = prepareFrame(w);
        frames.set(w.id, frame);
      }
      p.stream ??= new DeltaStream();
      send(p, p.stream.encode(w, p.account, frame));
      return;
    }
    const players = Object.fromEntries(
      Object.entries(w.players)
        .filter(([id, q]) => q.online || id === me.id)
        .map(([id, q]) => [
          id,
          id === me.id
            ? q
            : {
                id: q.id,
                name: q.name,
                x: q.x,
                y: q.y,
                z: q.z,
                heading: q.heading,
                speed: q.speed,
                vehicle: q.vehicle,
                tractorPaint: q.tractorPaint,
                atHome: q.atHome,
                lights: q.lights,
                team: q.team,
                game: q.game,
                health: q.health,
                kudos: q.kudos,
                online: q.online,
                kills: q.kills,
                age: Math.floor(q.age),
                lastHorn: q.lastHorn,
              },
        ]),
    );
    const state = {
      ...w,
      players,
      ledger: me.authority >= 20 ? w.ledger.slice(-30) : [],
      script: me.authority >= 20 ? w.script : '',
      scriptVariables: {},
      messages: w.messages.filter((m) => !m.to || m.to === me.id || m.name === me.name),
    };
    send(p, { type: 'state', world: state, me: me.id, account: p.account });
  };
  const leave = (p: Peer) => {
    if (p.world && p.account) {
      const w = worlds.get(p.world)!;
      const me = w.players[p.account.id];
      if (me) {
        leaveCombat(w, me);
        me.speed = 0;
        me.online = false;
        me.lastSeen = w.time;
        say(w, 'Parish notice', me.name + ' has left.');
        store.saveWorld(w);
      }
      delete p.world;
      delete p.stream;
    }
    p.input = { throttle: 0, steer: 0, boost: false };
  };
  const enter = (p: Peer, id: string) => {
    if (p.account?.transit) throw Error('Wait until your jump arrives before landing');
    const w = worlds.get(id);
    if (!w) throw Error('World not found');
    if (w.settings.locked && w.owner !== p.account!.id) throw Error('World is locked');
    const registered = registry().find((r) => r.id === id)!;
    if (registered.system !== p.account!.system) throw Error('Jump to this system before landing');
    if (p.world === id) return;
    leave(p);
    const me = addPlayer(w, p.account!.id, p.account!.name);
    me.online = true;
    p.world = id;
    for (const other of peers)
      if (other !== p && other.account?.id === p.account!.id) {
        leave(other);
        other.socket.close(4001, 'Connected elsewhere');
      }
    me.online = true;
    say(w, 'Parish notice', me.name + ' arrived.');
    store.saveWorld(w);
    snapshot(p);
    void scriptEvent(w, 'PlayerLogin', { id: me.id, name: me.name });
  };
  const scriptEvents = new ScriptEvents();
  const scriptEvent = async (w: World, event: string, data: Record<string, string | number>) => {
    const result = await scriptEvents.run(w, event, data, () => worlds.get(w.id) === w);
    if (!result) return;
    for (const message of result.messages) say(w, 'World script', message);
    w.scriptVariables = result.variables;
    for (const [id, kudos] of Object.entries(result.kudos)) {
      if (w.players[id]) w.players[id].kudos += kudos;
    }
  };
  const json = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    });
    res.end(JSON.stringify(data));
  };
  const body = async (req: IncomingMessage, max = 8192) => {
    let n = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      n += chunk.length;
      if (n > max) throw Error('Request too large');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  };
  const rate = new Map<string, { time: number; count: number }>();
  const server = createServer(async (req, res) => {
    let path: string;
    try {
      path = new URL(req.url ?? '/', 'http://localhost').pathname;
    } catch {
      return json(res, 400, { error: 'Invalid request URL' });
    }
    if (rate.size > 10000) rate.delete(rate.keys().next().value!);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    try {
      if (req.headers.origin && !allowedOrigin(req))
        return json(res, 403, { error: 'Origin not allowed' });
      if (path === '/api/health')
        return json(res, 200, { ok: true, version: VERSION, worlds: worlds.size });
      if (path.startsWith('/api/auth/')) {
        if (path === '/api/auth/status' && req.method === 'GET')
          return json(res, 200, accounts.status(auth(req).id));
        const ip = clientAddress(req.socket.remoteAddress, req.headers['x-real-ip']?.toString());
        const key = 'auth:' + ip,
          now = Date.now();
        let r = rate.get(key);
        if (!r || now - r.time > 60000) r = { time: now, count: 0 };
        rate.set(key, r);
        if (++r.count > 60)
          return json(res, 429, { error: 'Too many account requests. Try again in a minute.' });
        if (path === '/api/auth/status' && req.method === 'GET')
          return json(res, 200, accounts.status(auth(req).id));
        if (req.method !== 'POST') return json(res, 405, { error: 'POST required' });
        const data = JSON.parse((await body(req)).toString());
        if (path === '/api/auth/login') {
          const result = await accounts.login(String(data.name ?? ''), String(data.password ?? ''));
          revoke(result.account.id);
          return json(res, 200, result);
        }
        if (path === '/api/auth/configure') {
          const a = auth(req);
          const status = await accounts.configure(a.id, data);
          return json(res, 200, status);
        }
        if (path === '/api/auth/resend') {
          await accounts.resend(auth(req).id);
          return json(res, 200, { ok: true });
        }
        if (path === '/api/auth/forgot') {
          // Do not reveal whether an address exists, is verified, or failed delivery.
          if (!accounts.status('').recoveryAvailable)
            return json(res, 503, { error: 'Email recovery is not configured on this server' });
          void accounts
            .requestReset(String(data.email ?? ''))
            .catch(() => console.error('Recovery delivery failed'));
          return json(res, 200, {
            message: 'If that verified address belongs to a pilot, a reset link is on its way.',
          });
        }
        if (path === '/api/auth/verify') {
          accounts.verify(String(data.token ?? ''));
          return json(res, 200, { ok: true });
        }
        if (path === '/api/auth/reset') {
          const id = await accounts.reset(String(data.token ?? ''), String(data.password ?? ''));
          revoke(id);
          return json(res, 200, { ok: true });
        }
        if (path === '/api/auth/logout') {
          const a = auth(req);
          accounts.rotate(a.id);
          revoke(a.id);
          return json(res, 200, { ok: true });
        }
        return json(res, 404, { error: 'Endpoint not found' });
      }
      if (path === '/api/register' && req.method === 'POST') {
        const ip = clientAddress(req.socket.remoteAddress, req.headers['x-real-ip']?.toString()),
          r = rate.get(ip) ?? { time: Date.now(), count: 0 };
        if (Date.now() - r.time > 3600000) {
          r.time = Date.now();
          r.count = 0;
        }
        if (++r.count > 20)
          return json(res, 429, { error: 'Pilot registration limit. Try again later.' });
        rate.set(ip, r);
        const data = JSON.parse((await body(req)).toString());
        return json(res, 201, universe.register(String(data.name ?? '')));
      }
      if (path === '/api/session') return json(res, 200, { account: auth(req) });
      if (path === '/api/galaxy') return json(res, 200, { ...galaxy, worlds: registry() });
      if (path === '/api/worlds' && req.method === 'POST') {
        const a = auth(req),
          data = JSON.parse((await body(req)).toString());
        const name = z.string().trim().min(2).max(48).parse(data.name),
          template = z.enum(['economy', 'combat', 'playground']).parse(data.template);
        if (worlds.size >= 100 || [...worlds.values()].filter((w) => w.owner === a.id).length >= 8)
          throw Error('World creation limit reached');
        const id = randomUUID(),
          w = createWorld(id, name, a.id, template);
        worlds.set(id, w);
        store.saveWorld(w);
        return json(res, 201, { id, name });
      }
      if (path.startsWith('/api/assets/') && req.method === 'POST') {
        const a = auth(req),
          id = path.split('/')[3],
          w = worlds.get(id);
        if (!w || w.owner !== a.id) throw Error('World owner required');
        if (w.assets.length >= 32) throw Error('Asset limit reached');
        const buf = await body(req, 2 * 1024 * 1024),
          type = String(req.headers['content-type']);
        const types: Record<string, string> = {
          'image/png': '.png',
          'image/jpeg': '.jpg',
          'audio/mpeg': '.mp3',
          'model/gltf-binary': '.glb',
        };
        if (!types[type]) throw Error('Only PNG, JPEG, MP3 and GLB files supported');
        if (
          type === 'image/png' &&
          !buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        )
          throw Error('Invalid PNG');
        if (type === 'image/jpeg' && (buf[0] !== 255 || buf[1] !== 216))
          throw Error('Invalid JPEG');
        if (type === 'model/gltf-binary' && buf.subarray(0, 4).toString() !== 'glTF')
          throw Error('Invalid GLB');
        const hash = createHash('sha256').update(buf).digest('hex'),
          file = hash + types[type];
        await mkdir(join(dataDir, 'assets'), { recursive: true });
        await writeFile(join(dataDir, 'assets', file), buf);
        const asset = {
          id: hash,
          name: decodeURIComponent(String(req.headers['x-asset-name'] ?? 'World asset')).slice(
            0,
            80,
          ),
          type,
          url: '/world-assets/' + file,
        };
        w.assets.push(asset);
        w.revision++;
        store.saveWorld(w);
        return json(res, 201, asset);
      }
      if (path.startsWith('/api/ledger/')) {
        const a = auth(req),
          id = path.split('/')[3],
          w = worlds.get(id);
        if (!w || w.owner !== a.id) throw Error('World owner required');
        return json(
          res,
          200,
          store.db
            .prepare('SELECT * FROM ledger WHERE world=? ORDER BY id DESC LIMIT 10000')
            .all(id),
        );
      }
      if (path.startsWith('/api/')) return json(res, 404, { error: 'Endpoint not found' });
      if (path.startsWith('/world-assets/')) {
        if (!/^\/world-assets\/[a-f0-9]{64}\.(png|jpg|mp3|glb)$/.test(path))
          return json(res, 404, { error: 'Asset not found' });
        const file = join(dataDir, 'assets', path.split('/').at(-1)!),
          buf = await readFile(file);
        res.writeHead(200, {
          'content-type': mime(file),
          'cache-control': 'public,max-age=31536000,immutable',
        });
        res.end(buf);
        return;
      }
      if (vite) {
        vite.middlewares(req, res);
        return;
      }
      const file = resolve('dist', '.' + decodeURIComponent(path === '/' ? '/index.html' : path));
      if (!file.startsWith(resolve('dist') + '/')) return json(res, 403, { error: 'Forbidden' });
      try {
        if (!(await stat(file)).isFile()) throw Error();
        res.writeHead(200, {
          'content-type': mime(file),
          'content-security-policy':
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        });
        res.end(await readFile(file));
      } catch {
        json(res, 404, { error: 'Build the client with npm run build first.' });
      }
    } catch (e) {
      json(res, 400, { error: (e as Error).message });
    }
  });
  function allowedOrigin(req: IncomingMessage) {
    if (!req.headers.origin) return true;
    try {
      return (
        new URL(req.headers.origin).host === req.headers.host ||
        (!!(options.publicOrigin ?? process.env.PUBLIC_ORIGIN) &&
          req.headers.origin ===
            new URL((options.publicOrigin ?? process.env.PUBLIC_ORIGIN)!).origin)
      );
    } catch {
      return false;
    }
  }
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 32768,
    perMessageDeflate: {
      threshold: 1024,
      serverNoContextTakeover: true,
      clientNoContextTakeover: true,
      concurrencyLimit: 4,
      zlibDeflateOptions: { level: 1 },
    },
  });
  server.on('upgrade', (req, socket, head) => {
    if (req.url?.split('?')[0] !== '/ws' || !allowedOrigin(req)) {
      socket.destroy();
      return;
    }
    if (peers.size >= (options.maxPeers ?? 128)) {
      socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  wss.on('connection', (socket) => {
    const p: Peer = {
      socket,
      input: { throttle: 0, steer: 0, boost: false },
      inputAt: 0,
      count: 0,
      window: Date.now(),
      alive: true,
      born: Date.now(),
    };
    peers.add(p);
    socket.on('pong', () => (p.alive = true));
    socket.on('message', async (raw) => {
      let request: number | undefined;
      try {
        const now = Date.now();
        if (now - p.window > 1000) {
          p.window = now;
          p.count = 0;
        }
        if (++p.count > 65) throw Error('Too many requests');
        const m = messageSchema.parse(JSON.parse(raw.toString()));
        if (m.type === 'hello') {
          if (p.account) throw Error('Already signed in');
          const a = universe.authenticate(m.token);
          if (!a) throw Error('Invalid pilot key');
          for (const other of peers)
            if (other !== p && other.account?.id === a.id) {
              leave(other);
              other.account = undefined;
              other.socket.close(4001, 'Connected elsewhere');
            }
          p.account = a;
          p.delta = m.protocol === 2;
          if (m.world) {
            try {
              enter(p, m.world);
            } catch (e) {
              send(p, { type: 'result', ok: false, message: (e as Error).message });
            }
          }
          send(p, {
            type: 'welcome',
            account: p.account,
            market: universe.market(p.account!.system),
            galaxy: { ...galaxy, worlds: registry() },
          });
          return;
        }
        if (!p.account) throw Error('Authenticate first');
        if (m.type === 'ping') {
          send(p, { type: 'pong', at: m.at });
          return;
        }
        if (m.type === 'input') {
          if (p.world) {
            p.input = m.input;
            p.inputAt = now;
          }
          return;
        }
        request = m.request;
        const a = m.action as Action;
        if (a.type === 'land') {
          enter(p, z.string().parse(a.world));
          send(p, { type: 'result', request, ok: true, message: 'Welcome planetside.' });
          return;
        }
        if (a.type === 'takeoff') {
          const w = p.world ? worlds.get(p.world) : undefined,
            me = w?.players[p.account.id];
          if (!w || !me || !w.buildings.some((b) => b.kind === 'starport' && distance(me, b) < 18))
            throw Error('Drive to the spaceport to take off');
          leave(p);
          send(p, {
            type: 'space',
            account: p.account,
            market: universe.market(p.account!.system),
            galaxy: { ...galaxy, worlds: registry() },
          });
          return;
        }
        if (
          ['jump', 'ship', 'spaceTrade', 'upgrade', 'courier', 'survey', 'rescue'].includes(a.type)
        ) {
          if (p.world) throw Error('Take off first');
          if (a.type === 'upgrade') universe.upgrade(p.account, z.string().parse(a.kind));
          if (a.type === 'courier') universe.courier(p.account, z.string().parse(a.operation));
          if (a.type === 'survey') universe.survey(p.account);
          if (a.type === 'rescue') universe.rescue(p.account);
          if (a.type === 'jump') universe.travel(p.account, z.string().parse(a.system));
          if (a.type === 'ship') universe.buyShip(p.account, z.string().parse(a.ship));
          if (a.type === 'spaceTrade')
            universe.trade(
              p.account,
              z.string().parse(a.item),
              z.number().int().positive().parse(a.quantity),
              z.boolean().parse(a.buy),
            );
          send(p, {
            type: 'space',
            account: p.account,
            market: universe.market(p.account!.system),
            galaxy: { ...galaxy, worlds: registry() },
          });
          return;
        }
        const w = p.world && worlds.get(p.world);
        if (!w) throw Error('Land on a world first');
        if (a.type === 'script') {
          if (w.owner !== p.account.id) throw Error('World owner required');
          const source = z.string().max(16384).parse(a.source);
          await runScript(w, source, 'ScriptReload', {});
          w.script = source;
          scriptEvents.reset(w);
          store.saveWorld(w);
          send(p, {
            type: 'result',
            request,
            ok: true,
            message: 'Script validated and installed.',
          });
          return;
        }
        const before = structuredClone(w);
        const accountBefore = structuredClone(p.account);
        let message: string;
        try {
          if (a.type === 'exchange') {
            const me = w.players[p.account.id];
            if (!w.buildings.some((b) => b.kind === 'starport' && distance(me, b) < 18))
              throw Error('Visit the spaceport');
            const n = z.number().int().positive().max(w.settings.exchangeCap).parse(a.amount);
            const day = Math.floor(w.time / 86400),
              record = p.account.exchanged[w.id] ?? { day, amount: 0 };
            if (record.day !== day) {
              record.day = day;
              record.amount = 0;
            }
            if (record.amount + n > w.settings.exchangeCap)
              throw Error('Daily exchange limit reached');
            const cost = n * w.settings.exchangeRate * 100;
            if (me.cash < cost) throw Error('Not enough local cash');
            me.cash -= cost;
            log(w, 'sink', cost, me.id, 'universe', 'credit conversion');
            record.amount += n;
            p.account.exchanged[w.id] = record;
            p.account.credits += n;
            message = `Converted to ${n} galactic credits.`;
          } else message = act(w, p.account.id, a);
          store.saveWorld(
            w,
            Date.now() / 1000,
            a.type === 'exchange' ? () => universe.save(p.account!) : undefined,
          );
        } catch (e) {
          p.account = accountBefore;
          worlds.set(w.id, before);
          throw e;
        }
        send(p, { type: 'result', request, ok: true, message });
        snapshot(p);
        if (a.type === 'task') void scriptEvent(w, 'TaskStart', { id: p.account.id });
      } catch (e) {
        send(p, { type: 'result', request, ok: false, message: (e as Error).message });
      }
    });
    socket.on('close', () => {
      leave(p);
      peers.delete(p);
    });
    socket.on('error', () => socket.close());
  });
  let vite: Awaited<ReturnType<(typeof import('vite'))['createServer']>> | undefined;
  if (options.dev) {
    const module = await import('vite');
    vite = await module.createServer({ server: { middlewareMode: true }, appType: 'spa' });
  }
  let counter = 0,
    last = performance.now();
  const timer =
    options.tick === false
      ? undefined
      : setInterval(() => {
          const now = performance.now(),
            dt = Math.min((now - last) / 1000, 0.25);
          last = now;
          for (const p of peers) {
            if (p.account?.transit && p.account.transit.arrives <= Date.now() / 1000) {
              try {
                if (universe.arrive(p.account))
                  send(p, {
                    type: 'space',
                    account: p.account,
                    market: universe.market(p.account.system),
                    galaxy: { ...galaxy, worlds: registry() },
                  });
              } catch (e) {
                console.error('Could not persist ship arrival:', (e as Error).message);
              }
            }
            if (p.world && p.account) {
              const w = worlds.get(p.world)!;
              const player = w.players[p.account.id];
              if (!player.online) {
                p.socket.close(4003, 'Removed by moderator');
                continue;
              }
              if (Date.now() - p.inputAt > 350) p.input = { throttle: 0, steer: 0, boost: false };
              move(w, player, p.input, dt);
            }
          }
          for (const w of worlds.values()) advance(w, dt);
          counter++;
          if (counter % 4 === 0) {
            const frames = new Map<string, Frame>();
            for (const p of peers) snapshot(p, frames);
          }
          if (counter % 100 === 0) for (const w of worlds.values()) store.saveWorld(w);
          if (counter % 600 === 0) {
            for (const [key, entry] of rate)
              if (Date.now() - entry.time > 3600000) rate.delete(key);
            for (const p of peers) {
              if (!p.alive || (!p.account && Date.now() - p.born > 10000)) p.socket.terminate();
              else {
                p.alive = false;
                p.socket.ping();
              }
            }
          }
        }, 50);
  let backingUp = false;
  const backupTimer = setInterval(async () => {
    if (backingUp) return;
    backingUp = true;
    try {
      const dir = join(dataDir, 'backups');
      await store.backup(join(dir, `snapshot-${Date.now()}.sqlite`));
      const files = (await readdir(dir)).filter((f) => /^snapshot-\d+\.sqlite$/.test(f)).sort();
      for (const old of files.slice(0, -24)) await unlink(join(dir, old));
    } catch (e) {
      console.error('Backup failed:', (e as Error).message);
    } finally {
      backingUp = false;
    }
  }, 3600000);
  const listen = () =>
    new Promise<number>((resolvePort, reject) => {
      server.once('error', reject);
      server.listen(options.port ?? 3000, options.host ?? '127.0.0.1', () =>
        resolvePort((server.address() as { port: number }).port),
      );
    });
  const close = async () => {
    if (timer) clearInterval(timer);
    clearInterval(backupTimer);
    for (const p of peers) {
      leave(p);
      p.socket.terminate();
    }
    for (const w of worlds.values()) store.saveWorld(w);
    await vite?.close();
    await new Promise<void>((r) => wss.close(() => r()));
    if (server.listening) await new Promise<void>((r) => server.close(() => r()));
    store.close();
  };
  return { server, worlds, store, universe, accounts, listen, close };
}
function mime(path: string) {
  return (
    (
      {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.jpg': 'image/jpeg',
        '.mp3': 'audio/mpeg',
        '.glb': 'model/gltf-binary',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
      } as Record<string, string>
    )[extname(path)] ?? 'application/octet-stream'
  );
}
