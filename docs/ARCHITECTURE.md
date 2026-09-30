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
- `src/client/human.ts`: shared walking/driver geometry, articulated walking and seated poses.
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
single world notice and a 60-second automatic-event pause, not a server failure.
Worker startup and Lua execution have separate bounded deadlines. See SCRIPTING.md for the smaller supported
API; the original event catalogue is not fully implemented.

This alpha is tested for six simultaneous clients. It has not been load-tested
or hardened for hundreds of untrusted public players. Development mode is not
a public hosting mode.

## Playability update

`accounts.ts` separates private credentials and recovery hashes from public
universe account state. Async scrypt work has a bounded concurrency budget.
`mail.ts` is the optional SMTP adapter; tests inject a capturing transport and
never send real mail. Reset consumption, password replacement and key revocation
share a SQLite transaction. Existing account rows receive an indexed normalized
name key without changing their IDs or saved property.

`snapshots.ts` prepares public world fields once per broadcast and keeps each
peer's previous frame. Private player state and private messages are added only
for that recipient. Protocol 1 remains available for older clients. Sockets are
bounded and slow receivers are disconnected instead of buffering indefinitely.
The load probe uses a child server process so client JSON parsing does not count
as server event-loop work.

Offline survival pauses independently of economic time. Disconnects save, restart
marks all pilots offline before catch-up, and SQLite FULL synchronization protects
acknowledged actions. The durability test exercises actual disconnect and restart;
the economy tests separately exercise long offline progression.

`materials.ts` supplies shared, base-path-aware material textures and the blended
terrain shader. `scenery.ts` supplies deterministic instanced foliage and batched
contact shading; `sky.ts` and `noise.ts` supply atmospheric clouds. `tractor.ts`
batches the detailed body and each animated wheel separately. Static scenery
batches include texture identity and surface properties. Performance mode disables
dynamic shadows and water animation, reduces plant density and uses a smaller
framebuffer without multisample antialiasing. Detected software renderers use a
30 FPS render target, matching performance mode, rather than a forced 10 FPS cap. Actual throughput depends on the device. Adaptive mode falls back after sustained
slow frames; detailed mode keeps dynamic shadows enabled. See [art documentation](ART.md)
for asset provenance, prompts, texture ownership and visual verification.

Screenshot capture defaults to adaptive mode. Set `SCREENSHOT_QUALITY=low` for
performance or `high` for detailed. The capture checks for rendering errors before
writing gameplay screenshots.

Human figures share immutable geometry and materials for the lifetime of the page.
Each walker clones only the object hierarchy so joint animation remains independent;
scene disposal respects the shared-resource flags. Seated drivers are baked into
three material draws. Walking uses displayed travel to animate two-bone legs and
counter-swinging arms, with a closer camera and a first-person eye height of 1.68 m.
The local occupant is hidden in first-person views to avoid camera clipping.

## Movement presentation

The server still simulates input at 20 Hz and broadcasts state at 5 Hz. The client
stores up to eight poses per visible pilot and renders 300 ms behind its estimate
of server simulation time. Position and vertical height are linearly interpolated;
heading follows the shortest angular path. Recent packet timestamps anchor the
clock, with drift corrections capped at 5% to avoid following arrival-time jitter.
The buffer trades some visual latency for steady travel without extra network
traffic. This is visual interpolation, not client-side physics prediction.

The camera, cockpit view, headlights and wheel rotation use displayed motion.
Large position discontinuities, vehicle/world changes and long update gaps reset
the history. Missing updates drain the buffer and hold the last authoritative
position; the client does not extrapolate through walls or continue driving after
losing its connection. Interactions, physics and persistence still use server state.
`tests/motion.test.ts` exercises steady motion at multiple frame rates, packet
jitter, angle wrapping, teleports, disconnections and clock resets.
