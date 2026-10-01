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

## Gameplay expansion actions

- `construct` accepts an optional `style` from `data/appearance.json` for homes.
- `paint`: `{building, color}` at a garage; `refit`: `{building}` for ammunition.
- `farm`: `{building, plot, operation, crop?}`. Plot is 0–3; operations are
  `plant`, `water`, `fertilize`, `harvest`. A harvest starts a saved 15-second task.
- `joinCombat`: `{mode}` where mode is `deathmatch`, `capture`, or `ctf`.
  `leaveGame` exits. `chargeWeapon`: `{weapon: "javelin"}` begins a server timer;
  `fire`: `{weapon}` releases it. Client-supplied damage or charge duration is ignored.
- Space-only `upgrade`: `{kind: "drive" | "hold"}`, `courier`:
  `{operation: "accept" | "deliver" | "cancel"}`, `survey`, and `rescue`.

`welcome` and `space` include current station `market` stock. Accounts may include
`transit: {destination, arrives}`; the server sends another `space` after committing
arrival. Timestamps are Unix seconds. Planetside state includes optional crop plots,
building `smoking`, public `tractorPaint` and `atHome`, and world combat state.
All new records are saved server-side; older saves acquire defaults lazily.

## Gathering and lodging (0.5.0)

- `gather`: `node` is a stable ID from the shared resource catalog. The server checks
  proximity, tools, activity, cargo and remaining shared reserve, then saves a task.
- `lodging`: `building`, `operation`. `configure` needs owner/innkeeper, integer
  `rate` (hundredths of a denarius per hour), and boolean `open`. `rent` needs integer
  `hours` from 1 to 24. `store` uses `item`, positive integer `quantity`, and
  `direction: deposit|withdraw`. `checkout` expires only that pilot's booking.
- `home` now accepts a currently paid room as well as an owned cottage.
- `farm` adds `drain` and `improve` operations on an empty previously cultivated plot.

Shared snapshots include saved surface conditions and resource depletion. Guest
pantry contents are stripped from buildings in both legacy and delta snapshots;
only `self.roomPantries` (or the legacy recipient player) contains the pilot's stores.

## Optional AI resident (0.10.0)

Authenticated `GET /api/npc` returns `{ residents: [...] }`. Entries expose
`id`, `playerId`, `name`, `personality`, `world`, `online`, `status`, `model` and `provider` (`openai`, `anthropic` or `jev`; `jev` uses Claude for conversation);
no notebook, private journal, API key or spending details are returned. An empty
array means the server integration is disabled. Snapshots and chat messages can
include `npc: true` for visible AI labels. Chat also carries an optional monotonic
world message `id`; older saves are upgraded by the resident controller.

Use the ordinary `{type: "chat", text, to: playerId}` action for private NPC chat,
or omit `to` for parish chat. Existing recipient filtering remains in force.
NPC accounts cannot sign in through a pilot key. Operator pause and memory
inspection are filesystem/CLI operations, not player-accessible API actions.

## Compact delivery: protocol 3 (0.11.0)

The current browser requests `protocol: 3`. Protocols 1 and 2 remain supported.
Initial state and every world/reconnection baseline remain complete, including
`self`, `account`, `world.players` and `world.buildings`. Each protocol 3 state
also contains a socket-wide monotonic integer `sequence`. After merging and
handling it, the browser sends `{ "type": "ack", "sequence": 123 }`.
Acknowledgements are cumulative; stale or unsent sequence numbers are ignored.

Later states use `partial: true` with these changes:

- Changed top-level `world` fields replace their previous values. Unchanged chat,
  script and ledger fields are omitted; changed arrays replace previous arrays.
  Recipient filtering happens before comparison, including loss of authority.
- `entities.buildings` and `entities.players` are ID maps. A null entry removes
  that entity. Otherwise `{set: {field: value}, unset: ["removedField"]}` applies
  shallow field replacements/deletions. Missing `set` or `unset` means no changes
  of that kind. Nested objects/arrays replace as a whole. Actual JSON null values
  are distinct from absent fields. New IDs start with an empty record.
- `buildingOrder`, when present, lists all building IDs in authoritative order.
  It accompanies additions, removals or reordering; `world.buildings` remains an
  array in client state. It is not necessary to resend every building's contents.
- `selfPatch` updates the recipient's previous **private** player record. Ignore
  public entity changes for that player; their rounded pose must not replace
  precise private state. The initial `self` remains a complete replacement.
- `account` is omitted when unchanged; retain the previously delivered account.

No more than three states are outstanding per client. When that window is full,
the server skips generating further states for that peer and keeps its last sent
baseline. After an ACK, the next regular broadcast includes all changes since
that baseline, coalescing intermediate states. Other players retain their normal
cadence. Actions still execute and return results immediately; they are never
coalesced, replayed or acknowledged by snapshot ACKs. A new world's full baseline
resets the window but never reuses sequence numbers on the same socket.

The browser polls controls every 50 ms, sending changed input immediately on that
poll and repeating unchanged active controls every 100 ms (idle every second).
It skips input sends while `bufferedAmount` is nonzero, sending only current input
when the upload clears. The protocol 3 dead-man timeout is 500 ms. Actual key
release still sends on the next available poll. No client physics or financial
authority is introduced. All negotiated WebSocket messages of at least 256 bytes
are eligible for compression; no-context-takeover remains enabled.

Driving and ACK packets have a separate transport ceiling from discrete actions.
Action requests use a burst allowance of 20, replenished at ten per second;
rejections retain the request correlation ID. Excessive total traffic (over 512
messages in one second) closes the connection with code 4008. Ping responses are
capped at four per second. Ordinary queued controls never generate one rate-limit
error per packet, and the newest valid controls replace previous input.
