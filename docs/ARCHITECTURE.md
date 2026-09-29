# Architecture

## Runtime boundaries

The browser renders a Three.js scene and an HTML HUD. It sends input at 20 Hz and
receives snapshots at 5 Hz. Rendering interpolates positions and camera motion.
The server updates worlds at 20 Hz. A stalled browser's input expires after
350 ms, preventing a disconnected tractor from accelerating indefinitely.

The current self-hosted distribution runs the universe service and independent
world state machines **in one Node process**, on one HTTP/WebSocket origin. Each
world has its own players, rules, terrain, building economy, editor owner and
script. The universe owns pilot identity, ship cargo, credits and star-system
location. World selection switches the active simulation subscription.

This deliberately makes installation a single command and lets the local/world
credit exchange share a database. It is **not** federation with independently
hosted world processes. Splitting the universe into a separate service requires
signed session tickets, explicit trust between operators and transactional
cross-service exchange; it is tracked as a remaining specification gap.

## Code map

- `src/shared/types.ts`: persisted domain records and request types.
- `src/shared/catalog.ts`, `data/`: original default content and tuning.
- `src/shared/simulation.ts`: pure synchronous actions, validation, motion,
  accounting, production, survival and minigames. No network or filesystem.
- `src/server/store.ts`: SQLite schema, transactional snapshots, append-only
  ledger, online backups.
- `src/server/universe.ts`: token hashes, pilot records, ships, jumps and trading.
- `src/server/app.ts`: HTTP endpoints, WebSocket authentication, scheduling,
  request rollback, snapshot projection and static files.
- `src/server/lua.ts`, `scripts.ts`, `script-worker.mjs`: isolated scripting.
- `src/client/scene.ts`: original models, terrain, camera and effects.
- `src/client/main.ts`, `style.css`: input, panels, connection and responsive HUD.

## Economy invariants

Cash uses safe integer **hundredths of a denarius**. A wage of 0.25d is 25 units;
1s at the default 100d/s rate is 10,000 units. Item counts are positive integers.
Tax is rounded down once on the total transaction. Never round each item and
multiply afterward.

Every cash change has a faucet, transfer or sink ledger entry. A trade debit
must equal its investment credit plus tax sink. Building purchases and tuition
are sinks; task wages are faucets; funded employee wages are transfers plus a
tax sink. A world's initial seeded stock and building capital are startup
endowments, not ongoing production. Real inventory scarcity applies after that.

Requests validate before mutation. The server also snapshots the world before
an action and restores it if an action throws. SQLite saves world snapshots and
new ledger rows in one transaction, with `(world,id)` uniqueness preventing
ledger duplication. The recent in-memory ledger is bounded; the durable ledger
is not silently truncated.

Production uses fixed world-clock boundaries. Recipes consume their inputs only
when all inputs, output storage and wage funds are available. Active work gives
a funded employee two production cycles; an unattended building progresses at
its configurable low-efficiency rate. Owners collect sales receipts from the
investment pot. Goods do not spontaneously sell while everyone is offline.

## Persistence and time

The schema has an explicit version. Incompatible versions are rejected rather
than silently interpreted. World snapshots save each action, periodically, and
at graceful shutdown. WAL allows consistent online backup through Node's SQLite
backup API. Restore is an operator action with the server stopped.

Restart catch-up advances in 60-second increments for up to 30 real days. This
bounds long-outage work and avoids applying an entire month of home food and
survival as one giant step. During normal operation the world clock is advanced
with elapsed monotonic time, with a 250 ms bound per tick to protect against
extreme stalls. Game dates use a 600-second day; visual day length is separately
tunable and can be frozen.

## Security and limits

A pilot key is 256 random bits. Only its SHA-256 hash is stored server-side.
Display names are reserved case-insensitively. A new WebSocket must authenticate;
only one active connection per pilot is allowed. Clients cannot claim authority.
Created-world owners are assigned level 20 in that world only.

Requests have payload, rate, coordinate, quantity and finite-number limits.
The server enforces building proximity and owner/admin checks. HTML text is
escaped. Uploads use generated content-hash filenames, an allowlist, size limits
and no executable formats. Production responses restrict resource origins with
CSP. Supply HTTPS at the reverse proxy for non-local use.

Lua runs in a separate worker heap with instruction and deadline limits. It has
no OS, files, modules, JavaScript bridge or network. A script failure becomes a
world message, not a server failure. See SCRIPTING.md for the smaller supported
API; the original event catalogue is not fully implemented.

This alpha is tested for six simultaneous clients. It has not been load-tested
or hardened for hundreds of untrusted public players. Development mode is not
a public hosting mode.
