# Architecture

## Runtime boundaries

One Node process hosts HTTP/WebSocket, the universe and independent world state machines; SQLite stores them transactionally. Worlds own terrain, economy, players, rules and scripts. The universe owns identities, galactic credits, ships and cargo. Clients render Three.js plus HTML and request actions; the server owns physics, money, stock, timers and damage.

Simulation/input polling run at 20 Hz; snapshots normally at 5 Hz. Protocol 3 limits each peer to three unacknowledged states and expires controls after 500 ms (older protocols: 350 ms). Slow peers catch up without stalling others. [Protocol](PROTOCOL.md) specifies deltas, input rates, privacy and limits.

Optional [federation](GALAXIES.md) uses pinned Ed25519 hosts and single-use arrival tickets. Identity travels; economies remain independent. Native home returns require native authentication. [Creator designs](WORLD_BUILDING.md) are bounded optional `World.creator` documents; exports omit private runtime state.

## Code map

- `shared/types.ts`, `shared/catalog.ts`, `data/`: saved records, defaults and tuning.
- `shared/simulation.ts`: synchronous validation, actions, accounting, survival and movement; no I/O.
- `shared/environment.ts`, `farming.ts`, `combat.ts`, `galaxy.ts`: calendar, crops, combat and travel.
- `shared/resources.ts`, `lodging.ts`, `player-aid.ts`: gathering, guest stores and player assistance.
- `shared/building-shapes.ts`: metre-scale volumes shared by visuals, picking, clearance and collision.
- `shared/creator.ts`: design validation/actions/effects; `server/world-design.ts`: portable exports.
- `server/store.ts`: schema, snapshots, durable ledger and online backups.
- `server/universe.ts`, `accounts.ts`, `mail.ts`: identities, space economy, credentials and optional SMTP.
- `server/app.ts`, `snapshots.ts`: transport, scheduling, rollback and private/public projections.
- `server/lua.ts`, `scripts.ts`, `script-worker.mjs`: bounded isolated script execution.
- `server/npc/`: providers, plans, memory, budgets, A* navigation and scheduling; [NPC guide](NPCS.md).
- `client/scene.ts`, `buildings.ts`, `tractor.ts`, `human.ts`: rendering and models; [Art](ART.md).
- `client/main.ts`, `style.css`, `panel-memory.ts`: HUD, forms and session drafts.
- `client/parish-map.ts`, `map-layout.ts`: stable map controls, shared roads/resources, labels and live markers.
- `client/mobile.ts`, `mobile.css`: pointer ownership and compact layout; [Mobile](MOBILE.md#developer-notes-and-verification).

Paths above are under `src/` unless noted.

## Economy invariants

Cash is safe integer hundredths of a denarius: 0.25d = 25, default 1s = 10,000. Quantities are integers. Round tax down once on the total transaction, not per item.

Cash changes use faucet/transfer/sink ledger entries. Trade debit = investment credit + tax; purchases/tuition are sinks, labour rewards faucets, funded wages transfers plus tax. Initial stock/capital are finite endowments. Gifts conserve cash; refuelling consumes inventory.

Validate before mutation. The server also restores a pre-action snapshot on exceptions. World changes and ledger inserts share a SQLite transaction; `(world,id)` prevents duplicate ledger rows. Only the in-memory ledger is bounded.

Production checks inputs, output room and payroll at scheduled boundaries. Active shifts cover two building cycles; unattended production uses reduced efficiency. Goods do not sell automatically. [Economy](ECONOMY.md) owns balance details.

## Persistence and time

Actions save before acknowledgement; movement/simulation autosave every five seconds and on graceful shutdown. WAL/FULL synchronization and SQLite's online backup API protect acknowledged actions. Unknown schemas are rejected. [Hosting](HOSTING.md#backups) covers restore.

Restart catch-up uses 60-second steps, capped at 30 real days. Running ticks use monotonic elapsed time capped at 250 ms. The economic calendar has 600-second days; visual day length is independent. Survival splits at food exhaustion, room expiry and death. Offline needs/damage continue; ageing and passive owned-property decay pause.

Harvests reserve plots in saved tasks, rechecking capacity, payroll and permissions at completion. Failed harvests preserve crops. Climate/yields depend on saved time. Universe writes use a copied account inside a transaction; only committed state replaces the connected account. Station stock shares that transaction. Saved wall-clock jump arrivals settle once after reconnect or a live timer.

## Security and limits

Pilot keys have 256 random bits and stored SHA-256 hashes; names use an indexed normalized case-insensitive key. One socket per pilot; world-owner authority (20) is world-local. Password scrypt concurrency is bounded; reset consumption, password replacement and key revocation share a transaction. Mail tests capture messages without real delivery.

Requests enforce payload/rate/finite-number/proximity/ownership bounds. HTML is escaped. Uploads use content hashes, allowlisted formats and size limits; CSP restricts production origins. HTTPS is supplied by the proxy. [Scripting](SCRIPTING.md) specifies worker isolation, effect validation and failure backoff. Development mode is not public hosting mode.

## Movement presentation

Each visible pilot retains eight poses. Interpolation normally runs 300 ms behind server time, increasing smoothly to 800 ms for jitter and decaying after recovery. Time never rewinds; clock correction is capped at 5%. Positions interpolate linearly and headings use the shortest arc. Camera, wheels and headlights follow displayed motion. This adds visual latency, not client physics prediction.

Teleports, vehicle/world changes and long gaps reset history. Exhausted buffers hold the last authoritative pose rather than extrapolating through walls. `tests/motion.test.ts` covers frame rates, jitter, angles and resets.

Collision checks rotated building volumes. Pilots caught inside changed footprints may move outward; outsiders cannot enter. Cached plans use kind/bounded variant, not player IDs. This is footprint collision, not mesh physics.

## Rendering and bounded work

Immutable geometry/materials are shared; walkers clone joint hierarchies, drivers batch into three draws. Static scenery is batched by surface and texture identity; animated mill subtrees remain live. Seasonal uniforms avoid rebuilding the world. Map static layers rebuild only for layout/resize/navigation; HUD nodes and chat append incrementally.

Performance mode reduces framebuffer/foliage and disables water animation and dynamic shadows. Software rendering targets 30 FPS; adaptive mode falls back on sustained slow frames. Dynamic shadows are separately opt-in outside performance mode. Device throughput varies.

Fixed pools: 128 smoke particles, 900 precipitation particles, 512 ordnance instances; town lighting uses 12 spotlights (4 in performance mode). Crop geometry changes only at growth stages. Offline catch-up expires ordnance instead of inflicting offline combat kills. [Art](ART.md) documents ownership, budgets and visual checks.

NPC actions/cursors/progress save atomically; paid calls reserve shared budgets before asynchronous dispatch. Routing caches terrain/building geometry until layout or sea level changes. Fixed-path manuals feed bounded local help lookup; credentials and other players' private conversations never enter public snapshots. See [NPC development](NPCS.md#development-and-validation).

## Validation scope

Unit, transaction, real-socket, browser and configurable 100-client movement probes cover critical behavior. They do not certify heavy production trading, hostile public scale or long-term AI/economic balance. See [Status](STATUS.md) and [capacity checks](HOSTING.md#connection-and-multiplayer-checks).
