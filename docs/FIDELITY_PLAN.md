# Aclone fidelity implementation plan

Updated 2026-10-20. Research baseline: **0.77.2 / `418821a`**. Release: **0.78.0**.

Goal: preserve the original game's approachable controls, varied player-created
worlds and social economy while making those systems understandable and reliable.
Historical bugs, abandoned proposals and one world's rules are not universal
requirements.

## Working method

- Explain each pass plainly as it proceeds: what players will notice, why it
  helps, what connects it to the original game, and how we will verify it.
  Distinguish documented original behavior from our own design improvements.
- Complete a pass's acceptance checks before calling it finished. Record results
  here, including failures and remaining uncertainty.
- Keep each coherent fix or feature in its own logical commit, with its tests,
  changelog entry and relevant documentation. A pass can contain several commits.
- Commit, push and deploy only when requested. Work in disposable local worlds;
  no production resets, balance migrations or new paid NPC experiments are implied.
- Preserve desktop and mobile controls, authoritative server rules, configurable
  death/ownership behavior and normal offline survival.
- Ordinary NPCs use observed markets and remembered quotes. Mabel retains the
  guide's broader knowledge. Economic success must come from legal player actions.
- Reuse existing systems before adding another one: owner operation, emergency
  necessities, export clearance, surplus pricing, quests, elections and creator
  assets already exist.

## Pass 1 — Establish a trustworthy baseline

**Status: implemented and locally verified for 0.78.0.**

**For players:** menus should respond reliably and reading old chat should not
be interrupted. This is preparation for the fidelity work, not a claim of a new
historical feature.

1. Update expansion and waterworks browser tests to use the current building
   designer. Exercise actual material/rotation choices, placement and persistence,
   rather than replacing broken assertions with weaker presence checks.
2. Investigate caretaker history scrolling and fishing interaction failures.
   Fix UI lifecycle problems where reproduced; eliminate unnecessarily expensive
   scenery from functional fixtures without bypassing real input or WebSockets.
3. Run the affected tests at root and against the production `/aclone/` build.
   Run type/unit/build checks. Record what has and has not been verified.

**Exit:** affected scenarios pass with ordinary click/touch/wheel input; no forced
clicks, unconditional retries or deleted assertions. Local success is not a claim
that GitHub CI is green before a new pushed run completes.

**Commit boundaries:** designer test maintenance; caretaker interaction fix if
needed; other fixture changes; roadmap documentation.

## Pass 2 — Responsive driving and predictable loading

**Status: implemented and locally verified; startup speedup not demonstrated.**

**For players:** your tractor should react promptly when you steer, and entering
a world should feel smoother. Original-player feedback describes immediate local
movement checked against the server; we want that direct feel without allowing
the client to cheat.

1. Measure local input-to-render delay. Add input sequence acknowledgements and a
   local prediction/reconciliation path using the shared movement rules.
2. Preserve interpolation for remote players. Smooth small corrections, but reset
   prediction on teleport, death, reconnect, world changes and vehicle transitions.
3. Profile cold entry separately from network latency. Measure shader compilation,
   texture/geometry creation, long tasks, first usable input and frame times.
4. Make the measured startup bottleneck cheaper: prioritize terrain and nearby
   essentials, spread expensive preparation across frames and defer distant detail.
   Preserve the existing warmup and reduced-graphics behavior where it helps.

**Exit:** local control responds on the next eligible render frame; simulation
checks still govern collisions, fuel, damage and economic state. Test 50/150/300 ms
round trips, jitter/loss, slopes, collisions and reconnects. Report correction
distance and cold/warm startup timings on desktop and a constrained mobile profile.

**Commit boundaries:** protocol/reconciliation; prediction integration; measured
startup optimization. Never apply fuel consumption or other authoritative side
effects twice during replay.

## Pass 3 — A measurable, viable economy

**Status: implemented and locally tested; long-term economic success remains unproven.**

**For players:** useful work should keep shops supplied and businesses earning.
The original trading advice emphasizes cash, cargo costs and changing prices.
We will make those decisions clearer and test whether NPCs can follow them;
perfect autonomous NPC prosperity is our goal, not an established original feature.

1. Extend existing business statements with clear bottlenecks: cash runway,
   input coverage, output congestion, staffing and actual customer demand.
   Separate operating profit from deposits, loans, grants and stock valuation.
2. Build deterministic, disposable scenarios for 2, 5 and 19 active residents:
   missing pump fuel, saturated crops, an unfunded employer, stale trade quotes,
   costly transport and inadequate personal survival reserves.
3. Fix demonstrated decision failures in isolated steps. Compare funded net
   earnings per travel/work minute; reserve food, water and working capital;
   scale production to actual sell-through; abandon persistently unviable careers.
4. Benchmark emergency necessities against available wages and consumption.
   Only add bounded population-sensitive policies if the tests justify them.
   Price changes remain visible and configurable; avoid login-based price exploits.
5. Validate with a separately authorized, budgeted real-Jev experiment, without
   manual rescue. Keep deterministic evaluation and actual model performance
   distinct.

**Exit:** the pump chain can recover through ordinary training/delivery/work;
owners do not spend their last survival cash on unusable inputs; profitable
routes survive quantity/capacity checks; existing businesses sustain operations.
Report deaths, cash flow, shortages, completed commercial buildings, productivity,
subsidies and human interventions over time. A single good day is not proof of
three-week autonomy.

**Commit boundaries:** accounting/diagnostics; scenario fixtures; each demonstrated
NPC failure; any explicitly approved world-price migration.

## Pass 4 — Help players find useful things to do

**Status: implemented and locally tested; limitations recorded below.**

**For players:** a new world should make its rules and useful activities clear.
Historical feedback describes a confusing first experience, while later original
updates added easier gathering and controls. We will preserve the freedom to
choose a career while making it easier to find a worthwhile first step.

1. Generate a concise world-specific introduction and three to five first actions
   from current rules: provisions, earning, shelter and logout preparation.
2. Show qualified jobs and useful destinations with waypoints and honest
   availability. Do not promise stocked goods or funded wages from stale data.
3. Improve world discovery with theme, population, survival/round rules, recent
   destinations and a reliable way home when a remote host is unavailable.
4. Add explicit repeat gathering with a visible stop control. Use the existing
   server task pipeline; stop on movement, depletion, capacity, missing tools,
   disconnect or cancellation.
5. Add controller input and menu focus navigation, remapping, dead zones and
   device-loss handling. Cover purchasing and building, not just steering.

**Exit:** a new player can find food, income and a safe logout path without
external chat. Complete a buy/work/build/rotate flow with keyboard, touch and
controller. Repeated gathering cannot duplicate yields or continue invisibly.

**Commit boundaries:** world introduction; job/opportunity UI; travel discovery;
repeat gathering; controller support.

## Pass 5 — Construction and creator assets that behave consistently

**Status: implemented and locally tested; limitations recorded below.**

**For players:** buildings should sit properly on hills, and creators should be
able to save terrain and bring in suitable models reliably. Player-made worlds
and assets were central to the original; consistent placement and importing
make that creativity practical.

1. Validate grade/clearance across a rotated footprint. Show foundation supports
   or reject unsuitable slopes before charging. Keep preview and actual collision
   in agreement; do not flatten neighbouring terrain or reposition existing homes.
2. Add terrain save/reload invariants covering roads, resource markers, buildings
   and collision samples. Define origin, axes, metres per cell and vertical scale.
3. Audit current asset import validation and scale previews. If permitted sample
   files are available, investigate an **offline** ATM conversion tool using the
   public engine as a format reference. Do not claim compatibility without samples.

**Exit:** doors and corners are neither buried nor floating at accepted sites;
ten terrain save/load cycles do not shift objects; malformed/oversized assets
fail safely. Historical engine licensing does not grant rights to all game art.

**Commit boundaries:** slope/foundation rules and preview; terrain round-trip
regressions; optional asset-conversion prototype.

## Pass 6 — Complete, replayable competitions

**Status: implemented and locally tested; limitations recorded below.**

**For players:** worlds can offer races and other competitions with clear rules,
scores and rewards, alongside the economy. Historical courses and round-based
worlds show that the original was more varied than a trading simulation.

1. Extend the existing race/quest/event systems with configurable timed
   checkpoint/capture courses and an Iridis-inspired example.
2. Add weekly and all-time boards, visible start/end times, validated completion
   and durable, exactly-once settlement. Specify portal/shortcut rules.
3. Add an optional creator build/peace/war round template with safe zones,
   objectives and archived results. Keep Puddlewick persistent.

**Exit:** scores survive restart; invalid routes and duplicate submissions cannot
win rewards; transitions respect PvP restrictions. Reward funding/caps are
explicit rather than an unrestricted economy faucet.

**Commit boundaries:** scoring/settlement framework; course editor and example;
round lifecycle and archive.

## Pass 7 — Optional historical depth and operations

**Status: implemented and locally tested; leases/auctions default off, space scope evaluated below.**

**For players and hosts:** some worlds could offer temporary business operation,
different round rules or more space activities. Hosts could pause a world safely
for maintenance. These draw on particular historical versions and worlds; they
will be optional rather than changing every world's rules.

1. Design business operating leases and fixed-term auctions, distinct from
   existing sales, room rental and mayoral elections. Specify escrow, rent,
   operating capital, employees/tenants, death/default and expiry.
2. Add explicit persisted maintenance pause/resume boundaries with audit history.
   Freeze game clocks consistently while preserving normal offline hunger.
3. Evaluate richer regional space cargo/mining and return-beacon behavior only
   after destination discovery works. Keep host-local economies and cross-host
   reward trust separate.

**Exit:** no double refunds or settlements across restarts; no free lease profit,
unfunded rewards or cross-host money creation; maintenance catch-up runs exactly
once under the chosen policy. Document optional rules before enabling them.

**Commit boundaries:** each feature separately. These are adaptations inspired by
specific worlds and versions, not mandatory Puddlewick rules.

## Evidence and deliberate exclusions

- [Games For May discussion](https://discord.com/channels/1084112511713943593/1084112512213061634):
  archive reviewed through 2026-10-20 03:22 UTC; 1,066 authored messages,
  81 attached images, five game/model video timelines and the developer podcast.
  Raw research remains local and ignored; do not publish other people's media.
- [Original engine and model tools](https://github.com/OldAntelopes/Antiquated-Engine):
  a reference for formats and terrain, not the entire original game server.
- [Original 2005 trading guide](https://web.archive.org/web/20051223215122id_/http://www.theuniversal.net/newstext.php?id=144):
  cash reserves, affordable cargo, changing quotes and travel time.
- [Official historical news](https://store.steampowered.com/news/app/779050):
  changing employment rules, gathering, competitions and outage behavior.

Do not recreate infinite terrain on the strength of distant-hill screenshots:
the new evidence describes finite, scalable heightmaps. Do not restore an old
world's death-time stock wipe, hard-coded cargo bugs or unlimited auction stipends.
Do not add another surplus-pricing engine or another emergency supplier.

## Progress log

- **2026-10-20:** established this seven-pass plan from the Discord review.
  Pass 1 replaced obsolete designer selectors in expansion and waterworks tests,
  checks finish/model persistence and intake rotation, and verifies the selected
  design's construction materials. Fishing fixtures use compact worlds without
  scenery and the normal test deadline, retaining desktop click and phone tap
  assertions.
- **2026-10-20:** reproduced the caretaker wheel-scroll failure. Archived chat now
  stays mounted during live census updates; the regression checks wheel scrolling,
  focus, element identity, scroll preservation and older-message pagination.
- **Validation:** all six affected root browser scenarios passed; three caretaker
  and expansion scenarios passed against the production `/aclone/` build through
  the prefix proxy. Waterworks and fishing use their own isolated root servers.
  Type checking, production build, 804 unit tests, changed-file formatting and
  whitespace checks passed. The build retains its existing large-chunk warning.
  The entire browser suite and a new GitHub CI run have not been run.
- **Pass 2, 2026-10-20:** local movement now predicts using a private player copy
  and shared collision/slope rules. Server input sequence/duration acknowledgements
  support bounded replay; reconnects, deaths and mode changes reset it. Remote
  pilots retain their interpolation. Targeted movement/transport tests and real
  socket checks passed, including the existing slow compressed-link test.
  Browser driving/recovery and walking/vehicle-change scenarios both passed.
  Simulated 50/150/300 ms RTT with jitter and delayed snapshots gave maximum
  corrections of 0.146/0.171/0.715 m; input moves on the next sampled frame.
- **Pass 2 loading:** terrain preparation yields between small batches and emits
  stage timings. SwiftShader desktop entry took 22.72 s cold / 22.44 s warm;
  touch phone viewport took 20.31 / 20.08 s. The desktop baseline was 22.63 s.
  Longest tasks varied around 2.1–2.7 s: these samples do **not** establish a total
  startup speedup. Shader preparation and synchronous town geometry remain
  expensive. These are software-renderer measurements, not physical phone results.
  Profiles are in `/tmp/aclone-pass2-startup-{before,after,desktop,phone}`.
- **Pass 3:** private statements and owner briefings now expose supply coverage,
  output congestion, staffing, funded replacement batches, recorded sales and
  cash runway. Owner deposits and financing are separate from operating cash
  flow; catalogue stock value is labelled as an estimate. Legacy job/input plans
  now reject unfunded/congested work and retain survival cash. Resource depletion
  gets a first-failure, ten-minute cooldown instead of a free immediate retry.
  Existing pump recovery, trade guards, affordable reserves and output-congestion
  fixtures passed alongside new 2/5/19-resident candidate tests.
- **Active-population checks:** deterministic local runs of 28.8 simulated minutes
  completed with 2, 5 and 19 residents (5.1 / 12.3 / 43.9 seconds wall time).
  All had zero deaths and zero planner exceptions. Action failures were 0 / 15 /
  151 respectively; the 19-resident run had 119 depleted-resource attempts,
  17 unfunded transactions, 14 stock shortages and one travel timeout. Failure
  counts include different residents trying the same limited grounds; per-node
  cooldown does not solve town-wide scarcity. Local water was available throughout;
  local food was available only about 21% of samples. The 2-resident run finished
  no new buildings; the 5-resident run finished two cottages and one brickworks;
  the 19-resident run finished one brickworks. These counts compare surviving
  buildings against the initial parish and do not imply profitable operation.
  The evaluator now reports this distinction explicitly. These short, heuristic runs
  do not demonstrate self-sufficiency, sustainable profits or Jev competence.
  The earlier 19-resident 72-minute request hit its 35-second CPU limit after
  22.7 simulated minutes and is explicitly incomplete.
- **Pass 4:** rule-aware first steps and waypoint destinations, directory rule
  summaries/recent worlds, repeat gathering with cancellation/refund, and gamepad
  driving/menu focus/remapping are implemented. A real-browser test buys goods,
  changes architectural model/rotation with D-pad input, reads guidance and saves
  a creator course. Desktop and phone resource HUD checks passed. Text entry
  still uses a keyboard; cross-host recovery still uses the existing home-host
  account/key workflow, never a fabricated emergency transfer.
- **Pass 5:** new rotated construction sites accept at most 2 m ground variation,
  with persisted level foundations, low-detail plinths and entrance steps shared
  by the designer and live renderer. Existing buildings are not relocated.
  Ten SQLite save/load cycles preserve sampled terrain, roads/resources and
  building transforms. Existing bounded OBJ/texture validation tests pass.
  The waterworks browser scenario passes with shoreline placement and production.
  This does not certify every building/terrain combination visually. ATM conversion
  was conditional on permitted samples; none were available, so it is not built.
- **Pass 6:** configurable timed checkpoint/hold courses, weekly/all-time results,
  sponsor escrow with once-per-week prizes, and a starter island lap are implemented.
  Route revisions invalidate runs without resetting prize claims; teleports and
  offline catch-up cannot win. JSON course editing is available, not a visual
  route-drawing editor. Optional build/peace/war phases archive scores without
  resetting property or survival; arena victories persist until phase settlement.
  Tests cover score persistence, invalid runs, permissions, escrow and archives.
- **Pass 7:** opt-in prepaid operating leases with asset bonds and fixed-deadline
  funded auctions use ordinary cash, property and death rules. Expiry, outbid,
  destruction and restart tests guard settlement/refunds. Saved maintenance
  freezes world clocks, actions, movement, scripts and NPC planning; resumed time
  is not replayed. Socket checks cover exchange/takeoff paths as well as shared
  actions. Existing contracts settle even when new offers are disabled.
- **Space evaluation:** regional quotes, finite cargo holds, fuel/range costs,
  courier contracts, survey discoveries, rescue and home-host visitor recovery
  already exist. They cover the supported historical travel loop. We did not add
  an unvalidated mining-income faucet or a second return/transfer protocol.
  A richer extractive-space economy needs finite deposits, replenishment rules,
  transport costs and conservation tests before implementation; it was an
  evaluation item in this pass, not a promised new mining mode.
- **Delivery:** prepared as release 0.78.0 with user-authorized commit, push and
  deployment. No resets, price migrations, player grants or AI budget changes;
  no paid provider experiments. Preserve logical boundaries:
  reliability, prediction/loading, business diagnostics/NPC guards, guidance,
  foundations, courses/phases, contracts and maintenance should not be lumped
  into one unrelated commit.

## Remaining validation

The final full type/unit check passed 834 tests, including socket-pause,
maintenance-command, contract ownership/limits and arena-archive regressions.
Each logical commit was also type-checked independently before release.
The production build succeeds with the existing large-bundle warning. New browser coverage is focused; the entire browser suite,
GitHub CI, physical gamepads/phones and a budgeted real-Jev long-run experiment
have not been run. GPU warmup and town construction remain startup bottlenecks.
These are explicit limits, not successful acceptance results.

**Final browser verification:** the gamepad purchase/build-selection, first-steps,
course-authoring and maintenance scenario passed again after the final changes
(50.2 seconds). Desktop/phone resource gathering and shoreline waterworks passed
(three scenarios). Changed-file formatting, whitespace checks and the review
canvas syntax check passed. The updated website passed checks at four screen
widths, including keyboard navigation, the 48-building gallery, interactive
previews and WebGL/no-JavaScript fallbacks. Release 0.78.0 includes these changes; the dated
changelog and release guide record the upgrade. Deployment verification is reported
separately from these local tests.
