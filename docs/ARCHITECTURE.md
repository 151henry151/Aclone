# Architecture

## Runtime boundaries

The browser renders a Three.js scene and an HTML HUD. It polls input at 20 Hz,
sends changes on the next poll, and repeats held controls at most 10 Hz (1 Hz when
idle). A blocked browser upload retains only the latest unsent controls. Normal
snapshot delivery is 5 Hz; protocol 3 permits only three unacknowledged snapshots
per client. Rendering interpolates positions and camera motion. The server updates
worlds at 20 Hz. Input expires after 500 ms in protocol 3 (350 ms in older clients),
preventing a disconnected tractor from accelerating indefinitely while tolerating
short delivery gaps.

The current self-hosted distribution runs the universe service and independent
world state machines **in one Node process**, on one HTTP/WebSocket origin. Each
world has its own players, rules, terrain, building economy, editor owner and
script. The universe owns pilot identity, ship cargo, credits and star-system
location. World selection switches the active simulation subscription.

Each host keeps its own single-process simulation and transactional SQLite economy.
Optional federation connects independently hosted galaxies with pinned Ed25519
keys, signed home passports and short-lived single-use arrival tickets. Visiting
pilots retain a canonical identity but have independent local economy/progress.
There is no distributed currency ledger or cross-server balance transfer. Native
home-account returns require native authentication. See [Galaxies](GALAXIES.md).

The creator studio stores a versioned optional `World.creator` document with
bounded models, objects, arena settings and visual behavior rules. Old saves need
no migration. Shared validation controls every edit; pure effects run in the
simulation. Lua returns a separately validated effect batch, applied in per-world
order. Design exports omit accounts, inventory and all private runtime state.
See [World building](WORLD_BUILDING.md).

## Code map

- `src/shared/types.ts`: persisted domain records and request types.
- `src/shared/catalog.ts`, `data/`: original default content and tuning.
- `src/shared/simulation.ts`: pure synchronous actions, validation, motion,
  accounting, production, survival and minigames. No network or filesystem.
- `src/shared/environment.ts`, `farming.ts`, `combat.ts`, `galaxy.ts`: calendar, crop lifecycle, match/weapon rules and route/trade calculations.
- `src/server/store.ts`: SQLite schema, transactional snapshots, append-only
  ledger, online backups.
- `src/server/universe.ts`: token hashes, pilot records, ships, jumps and trading.
- `src/server/app.ts`: HTTP endpoints, WebSocket authentication, scheduling,
  request rollback, snapshot projection and static files.
- `src/server/lua.ts`, `scripts.ts`, `script-worker.mjs`: isolated scripting.
- `src/shared/building-shapes.ts`: deterministic metre-scale building volumes shared by rendering, picking, planting and movement collision.
- `src/client/buildings.ts`: original building silhouettes and facade details.
- `src/client/scene.ts`: original models, terrain, camera and effects.
- `src/client/human.ts`: shared walking/driver geometry, articulated walking and seated poses.
- `src/client/parish-map.ts`, `map-layout.ts`: persistent map controls, SVG roads and player markers, native building buttons, bounds and deterministic label placement. Uses shared town roads and resource nodes; snapshots update player markers without replacing controls. Static layers rebuild only on property/layout changes, resize or explicit map navigation.
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
A per-server pool reuses up to two runtime workers with a bounded queue. Every
job creates and closes a fresh Lua state; errors/timeouts discard the worker,
and workers recycle after 100 jobs. Node's native type stripping loads the small
sandbox directly, without a TypeScript loader or the whole simulation graph.
Only script variables, time and player kudos cross into it. Worker startup and
Lua execution have separate bounded deadlines. See SCRIPTING.md for the smaller supported
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
peer's previous sent frame. Protocol 3 additionally patches individual fields
within buildings and players, private self state, and omits unchanged private
messages/accounts. Public entity deltas are serialized once for each shared pair
of frames, cached with weak baseline keys; private projections never enter that
cache. Protocols 1 and 2 remain available for older clients. A three-frame ACK
window skips broadcasts for an overloaded peer without advancing its baseline.
The next update compares current state with the last sent frame; no delta is
silently dropped after encoding. World changes start a full baseline, with
socket-wide monotonic sequence numbers rejecting stale/future ACKs. Send-buffer
limits remain a final bound for connections that cannot keep up.
The load probe uses a child server process so client JSON parsing does not count
as server event-loop work.

Offline hunger/thirst and starvation damage use the same survival simulation as online players; only ageing remains paused. Sheltered residents consume provisions. Disconnects save, restart
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
slow frames. Dynamic shadows default off independently of quality; the saved
shadow option enables them outside performance mode. Static countryside matrices
are baked once while animated mill subtrees remain live. Town light selection
runs on new snapshots or appreciable camera-focus movement, rather than every
frame. Unchanged HUD sections retain their nodes, and the chat log appends only
new rows while preserving scrollback. See [art documentation](ART.md)
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
stores up to eight poses per visible pilot and normally renders 300 ms behind
its estimate of server simulation time. Recent timestamp offsets and snapshot
intervals increase that buffer smoothly, up to 800 ms, on jittery or flow-controlled
connections. Buffer changes never rewind presentation time and decay gradually
back to 300 ms when delivery stabilizes. Ordinary delayed packet bursts do not
reset the entire motion history. Position and vertical height are linearly interpolated;
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

Building plans keep existing building IDs, positions, inventories and ownership.
Collision transforms movement into each building's local frame and checks its
individual volumes. A pilot already inside a newly enlarged or edited footprint
may reduce penetration to escape; outside pilots cannot enter. This is still
simple footprint collision, not a mesh physics engine. The plan cache is keyed
by building kind and bounded visual variant, not individual player or building ID.

## Expansion persistence

Crop harvests reserve a plot and complete through the existing saved task system.
Capacity, funds and permission are checked again at completion; a failed harvest
leaves the crop available. Growth and climate are derived from saved simulation
time, so catch-up tick sizes do not change yields. Offline starvation continues; ageing remains paused. Survival integration splits at food exhaustion, room expiry and death rather than applying end-of-period needs to the entire interval.

Universe mutations operate on a copy inside a SQLite transaction. The connected
account is replaced only after commit. Station stock changes share that transaction.
Jumps save their destination and wall-clock arrival before departure; reconnecting
or the live timer settles a due arrival once. Contracts and discoveries stay in the
account snapshot. No new external services or database schema are required.

Smoke (128 particles), precipitation (900 particles) and ordnance (512 instances)
use fixed render pools. Nearby crop fields rebuild only when their crop/growth stage
changes. Snow and autumn colours use shared shader uniforms, avoiding seasonal
world rebuilds. Combat simulation expires ordnance during large offline catch-up
steps instead of inflicting offline kills.

## Living-world expansion (0.5.0)

`environment.ts` integrates saved snow/wetness at exact weather boundaries.
Movement reads these authoritative surface conditions. `lodging.ts` owns room
booking, guest-stock permissions and bounded provision consumption; offline
residents cannot die or age from unattended needs. `resources.ts` owns stable
finite gathering grounds and delayed delivery. Accepted tasks and reservations
use the same immediate world-save boundary as other acknowledged actions.

`TownLighting` merges window panes per building and reuses twelve spotlights (four in performance mode), disabling the pool in daylight.
Particle counts, light counts and scenery instances remain bounded. Public
building snapshots redact guest stocks; the private pilot projection carries
only that pilot's pantries. Lodging is protected against demolition, decay and
combat destruction while guest property could otherwise become inaccessible.

## Optional resident controller

`src/server/npc/` separates provider I/O, validated plan schemas, bounded world
observations, durable memory, shared budget reservations, navigation and turn
scheduling. The native entry point configures exactly one resident when enabled.
Plans execute through the existing `act` and `move` functions. AI calls run
asynchronously behind a shared concurrency ceiling; movement does not call the
provider. Every paid call reserves estimated cost durably before dispatch.

World actions, memory cursors and resident action progress save atomically.
Chat carries monotonic world message IDs for journal deduplication, independently
of the client's bounded chat ring. Credentials never enter observations or
snapshots. Public snapshots expose only an AI flag; the authenticated NPC endpoint
provides identity/personality and generic status. Detailed design and extension
boundaries are in [the NPC guide](NPCS.md#development-and-validation).

`npc/knowledge.ts` indexes fixed bundled player manuals and current catalog
defaults. Observations include full FAQ/economy fundamentals, bounded question/activity
excerpts, public world rules and live workplace diagnostics derived from the
simulation clock and staff checks. Latest failed steps and detailed action
receipts survive restart; personal wage receipts confirm actual production.
Request/tool JSON is bounded to 96,000 bytes and the existing spending caps
remain enforced. A read-only guide step can retrieve another topic;
player text never selects a filesystem path. Manuals are included in the Docker
runtime and source archive. Update them alongside changes to game controls/rules.

`npc/recovery.ts` persists bounded failed-step and recent-speech records. After
repeated failure the controller backs off decisions, refuses plans containing
still-blocked steps before broadcasting their speech, and suppresses duplicate
autonomous announcements. Direct questions retain private routing and can wake a
resting resident without clearing the failed-step blocks. An already-in-range
service visit bypasses path-finding and stops normally; no teleport is involved.

NPC navigation rasterizes each building's conservative bounding square and keeps
exact rotated-volume collision checks within it. This avoids testing every map
cell against every property, without changing paths or collision footprints.
The terrain/obstacle grid is cached until geometry, layout or sea level changes.

WebSocket controls and acknowledgements do not use the action token bucket.
Actions permit a burst of 20, replenished at ten per second; a 512-message/second
transport ceiling closes abusive floods rather than returning an error per input.
Ping replies are limited separately. Input still expires and all action validation,
economic transactions and persistence remain authoritative.

## Mobile interface

The client layers compact HUD controls over the same simulation, snapshot and form
paths. `mobile.ts` isolates pointer capture, safe cancellation, visual viewport
changes and mobile drawers; `mobile.css` is scoped to its media-query-driven class.
Desktop panels are reused for chat/status, and building forms keep `PanelMemory`.
See [mobile architecture and test coverage](MOBILE.md#developer-notes-and-verification).
