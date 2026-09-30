# HTTP and WebSocket protocol (alpha)

The protocol is a development API and may change before 1.0. All endpoints share
the static client origin. HTTP bodies and WebSocket messages are JSON unless
noted. Errors are structured as `{ "error": "message" }` over HTTP and
`{ "type": "result", "ok": false, "message": "..." }` over WebSocket.

## HTTP

- `GET /api/health`: health and version.
- `POST /api/register` with `{ "name": "Ada" }`: returns a pilot account and a
  one-time bearer key. Names are unique ignoring case.
- `GET /api/session` with `Authorization: Bearer KEY`: restore a pilot.
- `GET /api/galaxy`: systems, ships and public world registry.
- `POST /api/worlds` (authenticated), `{ "name": "My parish", "template":
"economy" }`: create a world. Templates: economy, combat, playground.
- `POST /api/assets/WORLD_ID` (owner): raw PNG/JPEG/MP3/GLB bytes and matching
  Content-Type. Optional percent-encoded `X-Asset-Name`. Maximum 2 MiB, 32 assets.
- `GET /api/ledger/WORLD_ID` (owner): latest 10,000 persisted money entries.

## WebSocket

Connect to `/ws`, then send:

```json
{ "type": "hello", "token": "YOUR_PRIVATE_KEY", "world": "puddlewick" }
```

Omit `world` to remain in space. The server replies with `welcome`, and with
`state` snapshots when planetside. The private key must not be in the URL.

Drive by sending normalized input, up to 20 times per second:

```json
{ "type": "input", "input": { "throttle": 1, "steer": 0, "boost": false, "lift": 0 } }
```

Perform a discrete action:

```json
{
  "type": "action",
  "request": 1,
  "action": {
    "type": "trade",
    "building": "b0",
    "item": "bread",
    "quantity": 1,
    "direction": "buy"
  }
}
```

`request` is optional and is echoed in result messages. It is a correlation ID,
not a replay/idempotency key. The client does not automatically resend actions
after reconnecting; it requests fresh state instead. Do not retry a timed-out
purchase blindly.

Action families are implemented in `act` in `src/shared/simulation.ts`:
trade, use, buyBuilding, investment, stock, buildingAdmin, job, quit, work, learn,
task, home, outside, bank, vehicle, engine, lights, crow, joinGame, leaveGame,
horn, reel, kricket, fire, construct, supply, repair, demolish, settings, terrain,
zone, place, town, group, hitch, detach, give, chat, command and respawn.

The universe additionally handles land, takeoff, jump, ship, spaceTrade, exchange
and script. Example action objects are visible in the client form handlers and
network integration tests. The server derives identities from the socket;
passing another player's ID cannot change who is performing the action.

`ping` with a numeric `at` gets a `pong` echo. Binary frames are not a separate
protocol. Snapshot data for other players excludes their private inventory,
cash, bank, skills and account credentials.

## Account endpoints and compact state (0.3.0)

Authenticated `GET /api/auth/status` reports password/email configuration for the
current pilot only. JSON POST endpoints are `/api/auth/login` (name, password),
`/api/auth/configure` (bearer key, password, currentPassword when already set,
optional email), `/api/auth/resend` (bearer key; resends verification), `/api/auth/forgot` (email), `/api/auth/verify` (token),
`/api/auth/reset` (token, password), and `/api/auth/logout` (bearer key).
Reset requests never disclose whether an email belongs to an account. SMTP
configuration belongs to the server, not the client.

A hello message may include `protocol: 2`. Its first `state` has `partial: false`
and a complete world. Later states use `partial: true`: merge changed top-level
world fields; merge `world.players` by ID and remove entries with null values.
The `self` field always contains the recipient's complete private player record
and overrides that player's public entry. Arrays in changed fields replace old
arrays. A new socket/world starts with a full snapshot. Do not merge a partial
state into a different world. Without `protocol: 2`, full-state delivery remains
available. WebSocket compression is negotiated automatically.

Close code 4004 requires signing in again after key revocation. Code 4005 means
the client could not keep up; reconnect with a fresh full snapshot. The server
permits only one active socket per pilot, including pilots in space.
