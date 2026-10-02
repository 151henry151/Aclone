# Implementation status

Aclone is a playable development alpha. The supplied design spec describes a
much larger historical game. This page deliberately distinguishes working
systems from unfinished fidelity work; the project is not ready to claim 1.0.

## Scheduled population and conversational agreements (0.15.0)

The opt-in roster now supports nineteen residents with varied economic preferences.
Mabel stays present; the other eighteen follow persistent real-world habits and
prepare food, stores and housing before signing off. Unprepared residents return
sooner. Offline hunger/thirst and starvation affect everyone, with stocked homes
and unexpired rooms providing ordinary automatic feeding.

Chat can record a durable goal or a concrete delivery agreement for Jev. Delivery
choices respect ownership, capacity, price and buyer funding, and receipts record
actual progress across restart and multiple loads. General goals remain guidance;
a model's promise is never treated as a completed action. Tests use deterministic
provider doubles, not a claim that real models always negotiate or act correctly.
Shared budgets remain unchanged. See [NPC guide](NPCS.md).

Saved wages now refresh independently of drafts; NPC wage context distinguishes gross, net and total payroll. AI retry/budget waits preserve visible character presence.

## Shared adaptive residents (0.14.0)

Mabel, Toby, Rowan and new resident Elias share one Jev decision system. All can
reconsider careers, purchases, business ownership, housing and leisure using
current opportunities and durable outcome feedback. OpenAI supplies Mabel's
conversation; Claude supplies the others. Conversation is addressed-only and
cannot replace the chosen gameplay plan. Configuration remains opt-in and uses
existing shared spending caps. See [NPC guide](NPCS.md).

Plans expose ordinary gameplay action families, including space journeys, but
use bounded candidate quantities and destinations; they are not an exhaustive
search or a promise of expert combat or profitable long-term play. Validation
checks legal game actions, real receipts, privacy and persistence.

## Jev farmer with Claude conversation (0.13.0)

Rowan Field is an independently enabled third resident. Jev selects bounded farm
and survival plans, with ordinary school, seasonal crops, harvest wages and farm
ownership/trading. Claude supplies addressed conversation and notebook updates;
it cannot replace Jev's actions. Both calls count separately against the shared
population budget. Browser coverage checks all three identities and private chat.
A disposable live trial used four Jev calls and two Claude calls to learn farming,
accept farm employment, plant and harvest 45 potatoes, and earn 19.8d net wages.
The successful six-call run cost an estimated $0.03027. Earlier tuning attempts
were additional; this is not a monthly-cost or long-term-autonomy benchmark.
See [farmer configuration and limitations](NPCS.md#rowans-configuration).

## Second AI resident (0.12.0)

Toby Finch is an independently enabled Claude-powered baker alongside Mabel.
The providers share bounded plans, normal game actions, recovery and a common
spending allowance; private memories and credentials remain separate. Claude
cache usage and per-call prices are accounted for. Automated tests cover school,
bakery wages, coexistence, restart persistence, provider errors and billing migration.
A three-request real Claude trial verified ordinary training, bread production,
wages and private recall; see [trial details](NPCS.md#claude-baker-trial-2026-10-01).

## Shift renewal (0.11.3)

Accepting an already-held job renews the active shift without adding duplicate
employees or paying wages early. Mabel’s workplace summaries explicitly identify
expired shifts and provide the renewal action. A controller regression reproduces
the failed mill sequence and verifies flour production and wages after renewal.

## Production status (0.11.2)

Building panels show current staffing efficiency, stock quantities and the next
production-check countdown, refreshing while open. Staffing changes do not create
an immediate batch; production still checks supplies, output space and wage
funding at the scheduled boundary. Unit and browser regressions cover this flow.

## Resident guidance and recovery (0.11.1)

Mabel receives complete FAQ/economy fundamentals, live job and production
conditions, her actual action results and wage receipts. Real-model trials
verified mill diagnosis, ordinary paid flour production, custom-recipe blockers
and common player questions. Model advice remains fallible; see [NPC validation](NPCS.md#development-and-validation).

Repeated failures persist across restarts, back off further decisions and
block recently failed steps. Duplicate autonomous announcements are suppressed;
new human questions can still wake her without removing the action blocks.
Regression tests use a deliberately repeating provider to verify this behavior.
Already-in-range service visits no longer need another path or a running engine.

## Performance and chat (0.11.0)

Compact field updates reduce repeated world, player and private-state traffic.
Each modern client has a bounded acknowledgement window; slow peers catch up
without delaying healthy peers. Driving bursts have a separate allowance from
purchases and chat. Static scenery/HUD caching, faster NPC obstacle construction
and reusable Lua runtimes reduce processing, while every Lua event retains fresh
isolated state and execution limits. Dynamic shadows default off; models,
textures, contact shading and local lights remain, with shadows available as an
opt-in outside performance mode.

Main chat supports scrolling and a jump-to-latest button for up to 100 recent
messages, preserving the reader's position and private-message filtering. It is
not an unlimited chat archive. Ping and FPS are displayed separately.

Regression coverage includes compressed WebSockets through a bandwidth/latency/
jitter-limited TCP link, mixed fast/slow peers, input bursts, parked neighbours,
audio and browser scrollback. These local tests cannot establish performance on
every device or compensate for a host with exhausted CPU, RAM or swap; see the
[hosting checks](HOSTING.md#connection-and-multiplayer-checks).

## AI resident prototype (0.10.0)

One optional OpenAI-powered economy resident with personality, chat, normal
physics/actions, durable journal and shared spending controls. Automated tests
use deterministic providers. An opt-in live OpenAI trial verified private chat,
driving to the office, three normal paid labour shifts and memory persistence
across restart. A further live test verified controls, password recovery, owner
stock transfers and coffee-growing advice using the bundled guides; see [NPCS.md](NPCS.md). It does not yet control
combat, space travel, construction or lodging bookings. Long-term independent
survival and economic success need playtesting; a 50-resident scheduler fixture
verifies concurrency limits rather than production capacity.

## Playable and covered by tests

- Enlarged parish map (M or click minimap), with named buildings/resources, live player positions, zoom, panning and clickable building details. The directory remains separate.
- Gesture-unlocked engine idle/revs, nearby multiplayer horns and motors, production-driven machinery, stereo/distance attenuation, mute and saved volume; browser tests measure actual mixed audio output.

- Player-built hotels/B&Bs, prepaid bookings, private guest stores, offline meals and safe expiry.
- Finite natural-resource gathering, eight processing businesses, materials and professions connecting crops, industry and hospitality.
- Occupied offline chimneys, varied evening windows, actual street/window illumination, dark nights, thunderstorms, persistent snow and weather-dependent driving.
- Evergreen and deciduous groves, varied tree scales and new building silhouettes. Evergreens now have irregular boughs, needle-covered shoots and original bark textures, with matching shapes in both graphics modes.

- Persistent server-owned cash, inventory, building investment and stock.
- Positive-quantity validation, transaction conservation, taxes and exact
  fractional-denarius wages.
- Input/output production, funding and storage checks, active employment,
  low-efficiency unattended production, timed skills and resource tasks.
- Buying unclaimed properties, listing and selling property to another player,
  construction materials, repair, decay, home supplies and life/death resets.
- Twenty-four vehicle slots, five primary control families, fuel/boost,
  persistent purchased vehicles, walking, disposable robocrows and ostriches.
- Safe-zone/fighting checks, energy or ammunition, charged javelins, bouncing grenades, armed mines, blast damage, armour, and balanced deathmatch/capture/CTF rounds.
- Seasonal crop plots, irrigation, fertilizer, rotation, frost and delayed-harvest quality, with reserved paid harvest shifts and offline completion.
- Seven-system route map, saved jump transit, owned-ship hangars, upgrades, shared station stocks, courier contracts, surveys and alien-ship unlocks.
- Four seasons, deterministic rain/snow, snow cover, seasonal sunlight and sunrise/sunset.
- Seasonal, rotating stars and two nearby moons with persistent phase cycles, cloud occlusion, starlight and moonlight; stronger headlights and broad streetlight pools.
- Six selectable cottage styles, garage tractor paint and occupancy-driven chimney smoke.
- Six-client Hornball, ordered race checkpoints and best laps, bite/reel fishing,
  and an original timing-based two-player Ultrakricket implementation.
- Optional password login, verified SMTP recovery, hashed pilot-key identities, multiplayer chat, command authority, world
  creation and separate per-world progress.
- SQLite persistence, transactional ledger, online backup/restore, bounded
  offline catch-up and atomic planet-cash / universe-credit conversion.
- Galaxy registry, landing, spaceports, systems, jump range, ships and cargo trade.
- Owner settings, terrain brushes, building placement, custom production recipes,
  per-world vehicle physics, safe/no-build zones, Lua and asset uploads.

Browser tests exercise the real rendered client and live server rather than a
mock game state. Unit and integration tests focus on critical invariants; they
do not establish production-scale security or long-term economic balance.

## Graphics and the current working tree

The 0.3.0 renderer uses original generated meadow, gravel, limestone and slate
materials, a detailed glazed tractor cab and treaded wheels, instanced foliage,
cloud layers, a village fountain and textured cottage gables. See [art sources](ART.md)
for prompts and implementation conventions. Adaptive, detailed and performance
modes let players trade resolution and scenery detail against GPU cost. Dynamic
shadows are a separate opt-in outside performance mode. These
are visual improvements to the existing game, not additional historical mechanics.

Version 0.3.3 replaces the placeholder human and cab driver with a smoothly shaded,
original workwear figure, detailed face and hands, and a seated driving pose.
Walking has articulated legs and arm swing driven by displayed motion, a closer
chase camera and a human-height first-person view. Figures remain stylized;
they are not photorealistic scans. Shared geometry and batched drivers keep the
additional rendering cost bounded. Browser tests cover switching to walking,
moving, changing cameras and returning to the tractor.

Version 0.3.4 adds distinct building footprints and roof forms,
consistent doors and windows, a compact tractor cab, human-scale street furniture,
and footprint-aware movement collision. It changes existing presentation and
navigation without adding historical game systems.

Version 0.4.0 adds timber siding, paint choices, occupied/working chimney smoke,
visible crop growth, seasonal foliage, snow coverage, precipitation and moving
sunlight. Effects and projectiles use bounded batches. See [the player guide](PLAYING.md)
for the new gameplay loops and their deliberately documented balance choices.

Version 0.7.0 adds the fictional night sky, broader vehicle and street lighting,
and first-person vertical mouse-look. Orbital tests cover seasonal movement,
midnight/year continuity and lunar phases; rendered captures compare near-full,
half and crescent moons, overcast skies, and the same ground view under moonlight
and starlight. The sky uses an original simplified orbital model, described in
[the art guide](ART.md).

## Implemented with a smaller scope than the spec

- Worlds are logically isolated simulations in one host process. Independent
  world-server federation and central identity trust are not implemented.
- Flight is arcade climb/descend, without a full lift/bank/pitch aerodynamic
  model. Ground collision uses simple footprints; terrain rolling, water
  buoyancy, trailer physics, balloon handling and robust lag compensation need
  further work.
- Robocrow control uses one built-in drone type rather than eight ranked types.
  Detailed per-vehicle weapon loadouts, additional reward sources and sustained
  competitive balance testing remain to be developed.
- Town membership, a first-candidate mayor and town tax exist. Full scheduled
  elections, leases, war declarations, territorial battles, turrets and
  protected town zoning do not yet have complete gameplay.
- Tribes/families currently store group names. Hitching and item gifts exist in
  the protocol; richer membership permissions, negotiated barter and their
  dedicated UI are unfinished.
- The editor changes live rules, terrain brushes, buildings, recipes and vehicle
  physics. It does not yet import arbitrary heightmaps, paint roads/forests or
  bind uploaded GLB models to building/vehicle definitions. Safe and no-build
  zones enforce rules; other zone types are stored markers.
- Uploaded image/audio assets can be previewed and GLB files downloaded.
  Automatic scene assignment, world radio, welcome images and scripted books
  remain future work.
- Lua supports PlayerLogin, TaskStart and ScriptReload with announcements,
  numeric world variables and reputation changes. The full historical event and
  command catalogue, timers, transaction cancellation and scripted OSD are not
  wired. Worker limits protect the host from runaway handlers.
- Crop plots now have dated harvests and seasonal planting windows. Perennial
  dormancy, livestock, richer diets, exact historical crop balance and precise
  historic death/estate behaviour still need fidelity work.
- Space is a functional map and trading layer, not a real-time cockpit flight
  simulation. Different world processes and public registry registration need a
  federation protocol.

## Water supply (0.16.0)

Shoreline waterworks are buildable businesses with fuel inputs, water output and
pump operator training. Shared terrain checks enforce dry foundations and a wet
intake for player, editor and NPC placement; dry/flooded sites stop producing.
NPC construction choices survey shoreline sites and use ordinary construction,
stockroom, employment and trading actions. There is no automatic waterworks in
existing worlds: a player or NPC must build and supply one. This fuel-powered
pumping abstraction is an original gameplay choice; plumbing networks, water
purity and reservoirs are not simulated.

## Deliberately not invented

The supplied spec leaves Bongosquares and Netrek rules unknown. Aclone does not
pretend a new invented game is a recovered original implementation. Historical
prices, crow tuning, civilization triggers and other uncertain numbers should
be changed in the data files as reliable evidence becomes available.

There is no copied original asset, paid membership system, invasive machine
fingerprinting, or dependency on the original game infrastructure. Reference
archives are local research material and are excluded from the public source.

## Before a stable 1.0

Complete required fidelity features above, expand game-module and rendering
boundaries, add save migrations and world export/import, soak-test offline
production and survival over long periods, load-test tens to hundreds of players,
review script/upload/auth abuse resistance and sustained trading load, and playtest the three core scenarios:
a sustainable business after days away, six-player Hornball, and a created world
that friends reach through space. Keep every remaining claim explicit in the
release notes rather than treating a successful build as completion of the spec.
