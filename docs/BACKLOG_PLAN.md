# Backlog implementation plan

Source: [BACKLOG.md](BACKLOG.md), read in full before changes. Base: `main` at
`1423116eae06134ebbc2b90dc3fd72cd3a216b0c`. Work branch: `backlog-implementation`.
The implementation phase kept changes unreleased, with no version bump, pull
request, deployment, live server edits or player grants. Henry authorized release
and deployment of this checkpoint on 2026-11-04; the release record below
supersedes those restrictions for that cut. Later authorizations and operations are recorded below. Piloted spaceflight is excluded and remains pending.

## Current priority — player-built bridges, 2026-11-08

Item 19 stages 2–3 are released: ford-aware dirt routes (0.133.0), useful
alternate routes (0.134.0), and city qualification/gradual paving (0.135.0).
The focused calendar/climate allocation improvement is released as 0.135.1.
Resume item 19 stage 4, paid player bridge construction and road integration,
with all recorded criteria. Preserve the populated-world responsiveness gate;
remaining client rendering costs and occasional slow frames are still open.
Automotive manufacturing and highway trucks follow bridges in dependency order.

## Completion protocol

Before each implementation slice, transcribe its acceptance criteria here as
specific assertions, commands and player-visible browser steps. Run a new or
extended regression test and record the actual failure before production edits.
Use the existing world rule/catalogue as the single source for gameplay values;
new gameplay defaults require validation, creation, summary, editor and portable
design coverage. Flight graphics follow client graphics settings instead.

Henry reaffirmed on 2026-11-05 that this applies to **the entire backlog**, not
only the new regional-industry entries. Prefer world-builder control for every
meaningful gameplay switch, limit, price, cost, rate, capacity, eligibility rule,
permission and policy. Reuse existing catalogues and town/creator rules rather
than adding duplicate settings. Record defaults and validation, expose clear
editor help, preserve saved state, include design export/import and NPC use, and
test both default and changed values before declaring an item done. Configure
art/model choices through the existing creator/catalogue system where supported.
Keep technical safety bounds and client graphics/performance preferences in their
appropriate layer; do not turn implementation details into meaningless world
sliders. Each upcoming slice's completion criteria must include this audit.

Every finished slice requires its acceptance checks, relevant tests selected from
the `npm test` suite with its `tsx --test` runner, clean `npx tsc --noEmit`, and
`npx prettier --write <explicit changed paths>`. UI/rendering slices also require
the affected real browser flow, including specified empty/refusal states. Record
commands and outcomes below. Commit explicit paths only, excluding `output/` and
`docs/NPC_STATUS*.md`, push this branch, then mark the slice done in this plan.
Stop at a failed completion criterion; do not weaken it or move on.

Henry revised the testing policy during the reserve-rules slice: run tests only
when the change could reasonably make them fail, rather than the full suite after
every change. Select the changed behavior and direct consumers; record the scope
and results. Keep failing-first tests, TypeScript, formatting and affected browser
flows. Broaden testing when shared behavior, a failure or an unresolved concern
justifies it. This policy supersedes the whole-suite gates in older slice records;
historical results remain recorded accurately.

## Release checkpoint — Lightmun freeze takes priority

**Checkpoint ready for Henry's deployment decision (2026-11-04).** The Lightmun
fix (`f88efd6`), plain river landing bill (`72c84c9`), initial-snapshot gate
(`1d19a0c`), and final river/populated-travel audit (`5fc18b8`) are committed,
pushed and remote-SHA verified. All included slice gates pass; the current
performance limits and completed/remaining scope are recorded at the end of this
plan. Stop new backlog implementation here until Henry decides to deploy and
resume. The branch remains unreleased at version 0.114.5; no deployment, live
server change, player grant or pull request has occurred.

Henry requested a stable deployment checkpoint on 2026-11-04. Pause new backlog
features after the already finished rules slices. First fix the confirmed scene
freeze in `output/performance-lightmun-2026-11-04/investigation.txt`, finish the
confirmed river construction bill gap, and finish focused river/render checks.
Do not deploy until Henry approves the concrete verified checkpoint. Remaining
climate/calendar and later Planned sections stay pending; no partial new system
will be included. The 20 shipped claims have been assessed (three gaps fixed);
seven of 25 eligible Planned sections are complete, plus the finished rules
subsections. Section counts are not an estimate of remaining engineering effort.

**Freeze completion criteria (before production changes):** reproduce a mature
world road addition in the actual browser renderer, using a generated 77-building,
1,479-road fixture and optionally the private diagnostic snapshot locally. Keep
private world/player data out of commits and published evidence. A single road
addition and a building/construction change must return from `setWorld` in under
50 ms, keep existing visible terrain until replacements are complete, and finish
rendering the new revision. Exercise successive revisions (cancel obsolete work),
movement, map open, bare ground, snowfall and thaw. Scene preparation must yield
between bounded pieces instead of draining snow generators synchronously. Record
main-thread durations, frame tails and screenshots; investigate any update-related
long task above 100 ms. Run `tsx scripts/world-revision-performance.ts`, relevant
terrain/snow/static-scene tests, TypeScript and changed-file Prettier. The captured
released baseline was 8,286–8,948 ms per road-triggered rebuild. No production
edits preceded the new regression below. The new browser regression failed at
8,522.2 ms for the snapshot and `retained: false` (existing terrain cleared).
The snow-yield parity test also failed because the foundation/verge generators
were missing; after adding yielding wrappers, all six snow accumulation tests
passed with byte-for-byte mesh attribute parity. The first staged rebuild reduced
the snapshot to 30.1 ms and retained terrain, but still exposed 397/166/146 ms
preparation tasks. Those stalls remain part of this fix, not an accepted result.
The follow-up CPU profile identified spaceport generation, gathering sites and
shader initialization; yielding those steps removed the bare-road stalls over
100 ms. Snowy rebuilds still exposed 162–204 ms tasks: duplicated full-world snow
attribute buffers and their first GPU upload. Added failing criteria: keep each
snow upload within a 16-bit vertex batch while preserving all roof triangles;
warm geometry incrementally without reparenting/disposal, restoring the renderer
on cancellation/failure. Both new tests failed for the intended missing behavior. The complete mature-world
run then found a separate map-opening task of 104 ms, repeated at 153 ms with
profiling. Layout was processing one SVG element per road per outline layer.
A new browser test preserves every visible road segment and width but requires
one path per effective stroke width; it fails before the map change. Keep map
opening, zooming and navigation checks in the release gate. A cold-winter-entry
unit test also fails with the old world's zero-depth GPU uniform; use the arriving
world's climate for initial snow visibility. Subsequent dense-winter
runs exposed GC pauses after successive revisions (heap grew to 1,060 MiB).
Replace retained snow triangle objects and normal-vector maps with compact
numeric storage, preserving exact height queries and byte-for-byte mesh
attributes against the pre-change fixture. The same run then used 87 MiB but
exposed a 113 ms shader setup batch: `compileAsync` does its material traversal
synchronously. Add a failing incremental shader/cancellation test and compile
individual objects before the atomic swap. Keep all original performance gates.

**Freeze verification:** `PROFILE_START_SNOW=1 PROFILE_CASES=road,building,supersede,thaw,snow,snow-road,move,map PROFILE_OUT=output/world-revision-release-check tsx scripts/world-revision-performance.ts`
passes all eight scenarios on the isolated generated mature-world fixture. Road,
building, superseded and snowy-road snapshot handling takes 2.8–5.8 ms; existing
terrain stays visible and only the latest revision is published. Across these
scenarios, frame p95 is 35.8–47.2 ms, maximum frame is 92.7 ms, and the only recorded
long tasks are 50/54 ms. Heap ranges from 64–239 MiB across the run. Full dense
winter replacements still take 18–21 seconds in the background; this removes the
blocking freeze, not all scenery regeneration work. The private captured-world
run also passes road/building/cancellation/snow/thaw/movement checks, with the map
rechecked after SVG batching (77 ms longest task). Keep those private inputs local.

Relevant unit coverage: 55 tests pass for terrain, snow, lighting, static scenery,
gathering sites, textures/building finishes and map layout/worker jobs. After the
last numeric-storage and shader-batching changes, all 13 snow/warmup tests pass;
exact pre-change snow mesh attributes and contact-height parity also pass. The
affected browser run passes nine checks (flight streaming, map batching/worker,
desktop/mobile map controls, snow rendering and live winter, startup missing
texture/input neutrality, graphics switch and terrain refresh). The thaw check
initially captures the previous climate snapshot: its generic “Snow” label wait
is already true at all three depths. Require the exact rendered depth before
capture, retaining every pixel threshold; the recheck passes in 30.1 seconds.
All ten flows now pass. Inspect mobile map, winter tracks and 1 cm thaw screenshots;
retain evidence under `output/world-revision-evidence/browser/`. TypeScript,
changed-file Prettier and `git diff --check` pass. No release/deployment performed.

**Lightmun freeze slice done and pushed:** `f88efd6` (remote SHA verified).

## Shipped-claim review

Verdicts below compare each of the **20** shipped bullets with the implementation
and its existing tests. “Matches” means leave the shipped feature intact; it is
not a request to implement it again. Test sources were read as evidence, not
counted as new browser executions. A whole-suite baseline is recorded separately.

### Release 0.114.4

1. **Matches — captain qualification and defaults.** `shared/captain.ts` resolves
   length and `requiresCaptain`; `simulation.ts` checks purchase and movement;
   `server/captain-rules.ts` preserves missing-rule compatibility for other saved
   worlds. `tests/captain.test.ts` checks new worlds, exemptions, overrides,
   purchase and helm refusal. Default setting is in `data/settings.json`.
2. **Matches — rename and one-time owner qualification.**
   `server/captain-rules.ts` folds held and in-progress `boatmaster` skills and
   recognises fleet, active, moored and rescued hulls. The migration version
   preserves later edits. `tests/captain.test.ts` covers Puddlewick and another
   saved world, including repeat migration.
3. **Matches — passengers, school refusals and resident tuition.** Passenger
   movement returns before the helm check; charter/deckhand acceptance does not
   require captain. `server/npc/strategy.ts` obtains tuition from `skillLesson`;
   resident routines do not introduce boat purchases. Captain, charter and
   fishing-expedition tests cover these paths.

### Release 0.109.0

1. **Gap G1 — fuel readout remains on foot and in the emergency raft.**
   `client/main.ts` unconditionally inserts Fuel into `#needs`, although
   `hasMotor`, action visibility, the driving label and the hand-mounted torch
   already distinguish walking/rowing correctly. `personal-controls.test.ts`
   checks actions and torch geometry but misses this HUD. Fix only the missing
   readout/control presentation; retain the existing flashlight.
2. **Matches — lifeboat capacity and nearby reboarding.** Slot 29 has capacity
   10; `boat-rescue.ts` uses `reboardReason` for stopped, nearby, clear-water
   transfers (and legitimate dock deliveries). `personal-controls.test.ts`,
   `motorboat.test.ts` and `towing.test.ts` cover near/far and recovery cases.
3. **Matches — vessel scale and long voyages.** `data/vehicles.json`,
   `client/fishing-boat.ts`, `tugboat.ts` and `motorboat.ts` supply the claimed
   24.5/16.8/4.3 m hulls; fishing crew and cockpit are outside the enlarged hull
   transform. `commercial-fishing.test.ts` simulates 210-minute voyages and
   expenses; `browser/canal-boat.spec.ts` checks trawler bounds, human scale and
   helm sightline. Keep these models and voyage economics.
4. **Matches — tug rescue.** `towing.ts` implements consent, held fees,
   idempotent refund/settlement, swept physical towing and free self-recovery;
   `simulation.ts` cancels on death. `towing.test.ts` covers each, plus restart,
   disconnected captains and long-hull docking.
5. **Matches — seven trailers.** `trailers.ts`, `trailer-model.ts`,
   `trailer-scene.ts` and the trade path provide seven distinct rigs, ownership,
   cargo restrictions, parking, signed articulation, swept collision and load
   penalties. `trailers.test.ts` covers purchasing, exact cargo conservation,
   trading, livestock capacity, restart, prediction, death and collision.
6. **Matches — spaceport relocation.** `server/puddlewick-spaceport.ts` surveys
   vacant sites around 1.25 km, retains the business and other property, removes
   previous access keys/reservation and replaces the site-derived fences.
   `spaceport-site.test.ts` verifies distance, preservation, repeat migration,
   reservations, access and portable design.
7. **Matches — runway exclusion and road reconnection.** `town.ts` filters
   `runwayRoad`; `road-routing.ts` reserves the strip; `road-projects.ts`
   reconnects disconnected components; `roads.ts` schedules that work.
   `road-alignment.test.ts`, `road-projects.test.ts` and `road-growth.test.ts`
   cover exclusion, safe connections and incremental growth.
8. **Gap G2 — doubled tractor zoom misses menu buttons.** `scene.ts` wheel and
   pinch paths allow 5.6, twice the ordinary 2.8 maximum, but `main.ts`'s
   `camera-zoom` handler still clamps to 2.8. Existing camera tests exercise
   offsets and water clearance, not the menu path. Share the existing camera
   limit between all three input paths, without changing other vehicle limits.
9. **Matches — motorboat and canal price.** Slot 33 costs 24s and slot 3 costs
   60s. `simulation.ts` provides empty-tank rowing; `boat-fishing.ts`,
   `boat-rescue.ts` and `boat-tender.ts` provide fishing, fuel delivery and
   physical tender recovery. `motorboat.test.ts` checks these and restart,
   death, offshore recall refusal and independent recovery tanks.
10. **Matches — no free town teleport.** `simulation.ts` rejects legacy respawn
    and reset-position requests before mutation; death and authorised caretaker
    recovery remain. `no-town-teleport.test.ts` checks unchanged state on refusal,
    real death and caretaker authority.
11. **Matches — cape routes, grades and bends.** `road-routing.ts` uses bounded
    kilometre-scale A*, terrain costs and deterministic safe curves. `roads.ts`
    retains the 12 m/day budget. `road-alignment.test.ts` checks both capes,
    gentle routes, seeded curves and clearance; `road-growth.test.ts` checks
    growth/catch-up. Do not extend this claim into the planned ford programme.

### Release 0.105.0

1. **Matches — livestock and pastures.** `pastures.ts`, `pasture-land.ts`,
   `livestock.ts`, `staffing.ts`, `livestock-scene.ts` and `pasture-motion.ts`
   implement reserved adjoining parcels, fences, grazing, breeding capacity,
   scaled rations/output/staffing and world multipliers. `pastures.test.ts` and
   `livestock.test.ts` cover those claims, migration and portable designs;
   `browser/vehicle-editor.spec.ts` includes pasture purchase.
2. **Matches — map icons, names and stable navigation.** `map-icons.ts` and
   `parish-map.ts` provide catalogue icons, focus/hover names, sparse labels and
   preserved world anchors through zoom/snapshots. `map-icons.test.ts`,
   `map-layout.test.ts`, `browser/map-icons.spec.ts` and
   `browser/map-navigation.spec.ts` exercise these paths.
3. **Gap G3 — charter passenger and tank tuning is not honoured everywhere.**
   `vehicle-config.ts` and `vehicle-editor.ts` expose and export `hitch` and
   `tank`, but `charter.ts` hard-codes six boarders and `charter-panel.ts`
   hard-codes six seats/192 tank units. Generic slots, movement, fuel, cargo,
   provisions, crew, recovery, tracks, cockpit, lamps and components have the
   resolver/schema and `vehicle-config.test.ts` coverage. Fix the charter
   exception using `vehicleDef`, retaining six/192 catalogue defaults. Existing
   `charter.test.ts` proves six default seats but not a changed world limit.

### Release 0.104.0

1. **Matches — charter fishing and settlement.** `charter.ts`,
   `boat-fishing.ts` and `simulation.ts` implement agreed fares, saved escrow,
   stopped passenger angling, catch ownership and proportional settlement.
   `charter.test.ts` checks these, full/refused boarding, cancellation, death,
   dock return and restart; charter browser specs cover the panel/trip. G3 above
   addresses editor tuning, not a rebuild of this business.
2. **Matches — independent synchronized headlights.** `vehicle-lights.ts`
   updates each vehicle's own lamp materials and a bounded nearby beam pool;
   `scene.ts` handles the local beam. `browser/vehicle-lights.spec.ts` checks
   all six tractors with separate switches and serialized snapshot patches.
3. **Matches — random rod bites at intended means.** `boat-fishing.ts` samples
   exponential waits once per cast, using the mode/location mean and depth
   multiplier. `fishing-timing.test.ts` tests distribution means, tails,
   memorylessness and scheduled bites. Leave the existing random timing intact.

## Full implementation order

Each numbered entry is a work item, split into the indicated independently
verified commits where needed. All are pending unless explicitly marked done in
the execution record. The road sections are interleaved to respect their shared
implementation order rather than building paving before ford-aware persistence.

1. G1: hide motor readouts/controls for walking and the lifeboat.
2. G2: give tractor menu zoom the same doubled maximum as wheel/pinch.
3. G3: honour charter passenger/tank tuning in boarding and the panel.
4. **Make a landing possible**: contact rules and strict option; airbrake;
   keyboard stability; safe wider/longer runway and gentle shoulders. Verify a
   full-keypress arrival on the real graded strip and destructive cases.
5. **Flight view: terrain squares, chunky ground and distant towns**: try fog
   first, then slant range, directional building priority, transition softening,
   distance rings if needed, and uniform distant-town terrain. Establish the
   performance budget and test path before changing rendering.
6. **Walking speed follows snow depth**: shared tractor surface lookup, world
   enable/scale rules, ordinary/Shift pace, road/verge and resident coverage.
7. **Natural gathering grounds without abandoned tools**: default natural
   geometry, configurable wear conditions, low/high-distance/province previews.
8. **Fuel tanker trailer with roadside fuel sales**: fuel-only rig, owner
   transfers, direct refuelling, taxed sales/offline payment, rules and balance.
9. **Canoes**: owned state model, carrying and blocked actions, launch/beach,
   home storage, death/ownership policy, persistence and carried rendering.
10. **CB radios**: channel/transmission state, duration and collisions,
    propagation/moderation, rescue prompts, dashboard and input methods.
11. **Make the remaining hard-coded gameplay numbers per-world rules**:
    separate fieldset batches in the spec's order: survival/needs; economy/trade;
    gathering/farming/production; vehicles/travel; climate/calendar/environment.
    Default-preserving tests plus changed-value, editor and export tests for each.
12. **Solid trees, boulders and vehicles — done, live in 0.124.0**: shared deterministic obstacle data,
    spatial queries, static collision/escape, pedestrian sliding, moving-vehicle
    contacts and offline policy; integrate road/navigation/build/snow users and
    measure tick/frame cost before proceeding.
13. **Cargo boat for dock-to-dock freight — done, live in 0.125.1**: definition/model/tuning; persistent
    hold; quay and existing landing transfers; decide optional barge; route
    economics. Follow the entry's internal order.
14. **Rowboats and Storm capsizing — done, live in 0.126.0**: rowboat shore access,
    seats/hold, beached persistence, tender policy and no-carry enforcement; then
    the storm sea survey/defaults, seeded/ramped risk, warnings, occupants/death/
    loss and shelter-time checks. Verify rowboat storm acceptance before marking
    either section done. Canoe and cargo hull classifications already exist.
15. **Springs, pump-houses and desalination plants — done, live in 0.127.0**: deterministic frozen
    springs/headwaters; scenery/drinking; grandfathered desalination; fresh-water
    siting/recipes/models; northern NPC founding, migration and catalogue/docs.
16. **Butcher, meat and livestock life cycle — done, live in 0.128.0**: young/cohorts/rations/breeding;
    adult slaughter service/shop; raw meat/spoilage; business and home cooking;
    NPCs, migration, portable catalogues and taxed chain margins.
    **Item 13 coastal cargo boat scale follow-up — done, live in 0.129.0.**
    Target about 3× the shipped physical hull size, with human-scale fittings and
    configurable dimensions/clearance. Read the deferred follow-up in BACKLOG.md;
    write concrete red scale/access tests before implementation. Verify enlarged
    berth clearance, boarding, cargo placement, handling and recovery in browser,
    with before/after screenshots. This is a follow-up to item 13, not unfinished
    work in its recorded release. Finish item 16 first.
17. **Open bay doors and modelled interiors — done, live in 0.130.0**: derived hours/staff state and
    real apertures; motion/visibility; shells and every listed trade's props;
    stock/architecture variants, reduced detail, preview mode and bounds/budget.
18. **Tractors stay where you leave them; walking, doors and arrival
    animations — done, live in 0.131.0**: parked records and migration; walk/return/refuel; home/lodging;
    sign-off/sign-in/towing/solid footprints and trailers; NPC return constraint;
    mount/dismount and approach/panel timing on desktop/mobile/controller.
19. **Alternate road routes and gradual city paving** together with **River
    crossings, bridges and highway haulage**, in this exact sub-order:
    - Survey current settlements and haulage economics read-only; define shared
      city/surface/ford/bridge records and configurable defaults. Decide access,
      toll and refrigeration policies before their implementations.
    - **Done, live in 0.133.0/0.134.0:** persistent useful alternate routes and
      deterministic ford-aware dirt growth, including a new distant town, absent
      fords and multiple rivers.
    - **Done, live in 0.135.0:** sustained city qualification, slow density-directed
      paving, rural lanes staying dirt, one boundary exit, city-only trunks,
      bank-ending paved projects and dirt feeders. Dirt fords never count as paved
      links; usable bridge integration belongs to the following stage.
    - Expensive contributed bridge construction, reservations, approaches,
      maintenance/removal and old-ford preservation.
    - Automotive factory construction, inputs/staffing and manufactured orders
      and deliveries; then detailed highway tractors and specialised trailers,
      articulation, loading, surface speeds and profitable long-run balance.
    - Restart/export, concurrent construction, water/terrain/obstruction edits,
      bridge removal, growth/shrinkage and browser travel validation.
20. **Earthmoving machines and a building slope limit** (factory and solid
    scenery now exist): grade rule/refusal/site shading; cached earthwork pads;
    plant licence/manufactured machines; survey/passes/material balance and
    weathering; contracts/permissions/NPC posting; hillside-to-building browser
    flow, roads/trees and mobile/controller implements.
21. **Snow ploughing: roads that stay snowed in until someone clears them**:
    segment accumulation/lookup/rendering; tractor blade/pay; factory-made truck;
    salt/hopper/pay; NPC/council acquisition; one-time Puddlewick defaults;
    offline catch-up, clean/raised/empty states and browser map/road coverage.
22. **Player-built airstrips and commercial aviation**: rotated owned airfield
    list; expensive multi-contributor airstrip/access/parking/fuel; land aircraft
    definitions and weight performance; passenger fares/seats/baggage/crash
    stranding; apron freight/economics; restart, import, demolition, licences,
    night lighting and input coverage. Preserve its six-stage internal order;
    add the amphibian variant in the following dedicated item, using these
    shared seats, baggage and crash rules.
23. **Seaplanes**: amphibian definition/model/price/hold; two seats and loading;
    gear-dependent land/water contacts, depth/run/wave qualification, taxi/moor
    and loaded takeoff; nearest-shore rescue and floating surplus cargo. Landing
    and shared aviation acceptance must already pass.
24. **Helicopters: sling loads, sea rescue and passenger charters**: rotorcraft
    and cockpit; owned parked-tractor sling; consent/winch/return hull; passenger
    lifts and directory; contracts/escrow/bounty/NPC requests. Parked vehicles,
    aviation crash/seats and storm thresholds are prerequisites.
25. **Forestry and logging**: shared tree IDs/stages; sparse overlay; safe
    felling/bucking/piles; hand/log-wagon/backhoe loading; construction clearing;
    permissions/stumpage/nurseries/woodlots; NPC plan, regeneration, map and
    performance. Solid trees and earthmoving must be complete first.
26. **Flight combat for fighting worlds**: health/damage; fixed guns with
    bounded rewind/reload; bombs/rockets/turrets; arena round and dogfight;
    additional hull hardpoints/gunner; recorded replay, performance and inputs.
    Non-fighting worlds must retain civil behaviour throughout.

27. **Land-use districts and building permissions**: extend existing town zoning,
    map/preview permissions, grandfathering and NPC construction checks.
28. **Regional industry, freight routes and a desert frontier**: survey existing
    provinces and route economics; optional unoccupied desert extension; regional
    producers/buyers, migration, map and performance checks. The prior transport,
    water, forestry and zoning features must already be complete.
29. **Oil deposits, extraction sites and refinery supply**: eligible inland/offshore
    sites, conserved crude transport, balanced refining and staged legacy migration.
30. **Petrol stations and dedicated fuel retail**: supplied forecourts and existing
    paid-refuelling integration; prove coverage before retiring general-shop restocks;
    retain tanker/rescue services, old stock and compact-world compatibility.

The four later entries above incorporate Lightmun's Discord feature request,
accepted by Henry on 2026-11-05. They are planned work only and do not expand the
current collision slice or block releases of the original transport features.
Existing item numbers and historical counts remain unchanged: the live planning
scope is now **29 eligible Planned sections**, with **8 complete** at this update.
The full dependency order remains the list above; piloted spaceflight is excluded.
Before each new entry starts, record concrete commands/browser steps and measured
numerical defaults, then run failing tests as required by the completion protocol.

## Execution record

### Plan commit

- Done: initial audit and full dependency order committed and pushed as `5252631`.
- Whole-suite baseline: `npm test > /tmp/aclone-backlog-baseline.log 2>&1`,
  1,313 passed, zero failed.
- Type baseline: `npx tsc --noEmit`, clean.
- No implementation changes before this plan commit.

### G1 — motor-free HUD

Done: committed and pushed as `74c79e4` after the checks below.

Red evidence: `npm run test:e2e -- tests/browser/personal-controls.spec.ts`
failed at the walking Fuel assertion: expected zero bars, received one, after
the actual inventory Walk action successfully changed the player to slot 5.

Claim: “Walking flashlight and appropriate controls; no engine controls/readouts
for walking or the emergency raft.”

Completion criteria, fixed before production changes:

- Extend a real game browser test: enter on a tractor with a nonempty tank; show
  its Fuel bar and engine controls. Switch to walking; no Fuel bar, no engine
  control or ENGINE ON/OFF label; the flashlight can still toggle. With an empty
  stored tank, still no Fuel bar. Render an isolated lifeboat player at sea;
  no Fuel bar or engine label/button, and ROWING remains visible. Return to a
  tractor; Fuel reappears with the actual stored tank value.
- Run `npm run test:e2e -- tests/browser/personal-controls.spec.ts`; confirm the
  old unconditional Fuel bar fails the walking assertion before editing code.
- Run `npm test -- --test-name-pattern='walking flashlight|torch follows|reboard hint'`
  for existing control/torch/reboarding assertions, plus `npx tsc --noEmit` and
  Prettier on the changed files. Browser screenshots prove both motor-free states.
- Update PLAYING.md and README for the visible HUD correction; add an imperative
  Unreleased fix. No new gameplay values or switches are necessary for this fix.

Green evidence: the browser flow passed, including the flashlight, restored 50%
tractor fuel readout, raft ROWING status and hidden mobile engine/lights controls.
`npm test -- --test-name-pattern='walking flashlight|torch follows|reboard hint'`
ran the whole suite under this runner: 1,313 passed. `npx tsc --noEmit` is clean.
Prettier ran on all six changed paths. The first screenshots showed the HUD
ahead of the software-rendered model, so the fixture now freezes daylight and
allows the model to settle before the final visual check; acceptance assertions
are unchanged.
The final browser rerun passed in 1.0 minutes. Visually inspected
`test-results/personal-controls-walking.png` and
`test-results/personal-controls-lifeboat.png`: the walking figure and orange raft
are rendered, Fuel is absent, and their distinct controls remain visible.

### G2 — menu zoom

Done: committed and pushed as `09ed219` after the checks below.

Red evidence: `npm run test:e2e -- tests/browser/camera-zoom.spec.ts` failed
after repeated actual menu clicks: expected scene zoom 5.6, received 2.8.

- Concrete command: `npm run test:e2e -- tests/browser/camera-zoom.spec.ts`.
  On a temporary local world, open phone Actions and repeatedly click Zoom out.
  Read the real scene zoom (test-only observation, no changed camera behaviour):
  expect 5.6 for the tractor, matching wheel and pinch; close the panel and check
  the settled third-person horizontal distance is 21 × 5.6 metres. Zoom in stops
  at 0.55. Walking still stops at 2.8. Capture the zoomed-out tractor view.
- Before code, add a failing browser regression that clicks Zoom out repeatedly
  in a tractor and measures camera distance matching wheel/pinch maximum (5.6),
  twice other vehicles' 2.8. Exercise Zoom in at the lower bound and walking's
  unchanged upper bound. Reuse one camera limit, not another literal copy.
- Run the browser regression, `npm test` for touched camera tests, TypeScript and
  Prettier. Update the player guide, README and Unreleased changelog.

Validation: `npm test` passed all 1,313 tests and `npx tsc --noEmit` is clean.
The first green browser attempt passed tractor menu/wheel/pinch and camera
distance checks, then timed out because Walk correctly closes Actions. The test
now reopens Actions before checking the walking limit; no criterion changed.
`test-results/camera-zoom-tractor.png` was visually inspected at phone size.
Final browser rerun passed in 37.6 seconds, including walking's unchanged 2.8
limit. Prettier and a final TypeScript/diff check passed.

### G3 — charter tuning

Done: committed and pushed as `730ff74` after the checks below.

Red evidence: the new Store-backed unit regression failed with “Missing expected
exception” when a zero-seat charter accepted and charged a guest. The browser
successfully saved zero seats and a 300-unit tank via the editor, then failed:
the panel still read “Six passenger places”, “Tank 0.0/192”, “Passengers 0/6”.

- Concrete commands: `node_modules/.bin/tsx --test tests/charter.test.ts`
  (red), `npm test` (green), and
  `npm run test:e2e -- tests/browser/charter-tuning.spec.ts`.
  In the local browser, save zero passenger berths and a 300-unit tank through
  F10 → Vehicles; Inventory must show 0/0 passengers, the 300-unit tank, and no
  waiting passengers. Save two berths, fill the boat, then accept an invitation
  as a third guest: show the two-place refusal and retain the guest's money.
  After a cancellation, boarding must work again. Retain default six-seat tests
  and persist tuned capacity through a Store save/load.
- Before code, extend `charter.test.ts`: tune passenger capacity to two, board
  two, reject the third without taking fare; tune to zero and reject all; retain
  six-seat default coverage and repeat/save behaviour. Verify changed tank and
  passenger counts in the actual charter panel, including no waiting passengers
  and full/refused boarding, using the vehicle editor's existing values.
- Run the red unit test, then the changed unit suite through `npm test`, the
  charter browser flow, TypeScript and Prettier. Update WORLD_BUILDING.md,
  charter/player documentation, README and the Unreleased changelog.

Validation in progress: all 11 charter unit tests pass; TypeScript is clean.
Browser attempts passed the editor, empty panel and full refusal, but failed the
post-cancellation boarding check. Initially suspected slow rendering/input; the
actual cause was the test retaining its world reference after the server correctly
rolled a rejected action back to a cloned world. The test now cancels/reoffers on
the live world and asserts its live player state. The fixture uses only the
boatyard, with scenery disabled, and keyboard activation for guest acceptance.
The screenshot scroll also avoids waiting for a periodically replaced panel to
become stable. All original acceptance criteria remain.

Final browser run passed in 2.0 minutes, including successful boarding after
cancellation. Visually inspected `test-results/charter-tuning-empty.png`,
`charter-tuning-full.png` and `charter-tuning-refused.png`: configured 0/0 and 2/2
places, 300-unit tank capacity, empty waiting area and the correct refusal are
visible. TypeScript and Prettier pass. `npm test` passed all 1,314 tests, zero
failed (`/tmp/aclone-g3-unit.log`).

### Make a landing possible

Done: committed and pushed as `f154a0a` after the checks below.

Completion criteria, before production changes:

- `node_modules/.bin/tsx --test tests/landing.test.ts tests/flight.test.ts tests/airfield.test.ts`:
  a fixed schedule of full keyboard presses (S/B, then a late short flare; no
  continuously calculated target pitch) reaches the real graded public runway,
  survives a modest bank and nose-down arrival, and brakes to rest on its paint.
  Cover ordinary and delayed key release. Rolling over a gentle shoulder at
  approach speed must survive; an abrupt rise must still count as an impact.
- At contact, defaults permit sink below 8 m/s, nose from −15° to +25°, bank
  below 25°, slip below 40°, and speed below 100 mph. A 10 m/s dive, 45° bank,
  water and a building still destroy the aircraft. Excess speed and slip get
  distinct reasons. A strict option retains the old 3.5 m/s, −0.1 rad/+20°,
  12° bank, 0.35 rad slip and 36 m/s limits.
- B in flight increases descent and slows a fast approach; near 24 m/s it
  permits a roughly 2–4 m/s descent without requiring nose-down input. It cannot
  cause a stall at an already slow, level approach. Ground B remains a brake.
  Released pitch and roll settle gradually, and a short keyboard tap changes
  attitude by a few degrees; analog input retains greater authority.
- Put new limits, airbrake toggle/strength, approach speed, keyboard authority,
  stability, throttle/brake rates and runway target length/width/shoulder in
  validated per-world settings with shared defaults. Test changed values,
  missing-key fallback, creation, editor, summary, save/load and design export.
  Target 400 × 30 m with an 18 m blend; use the longest safe level site where
  400 m cannot fit. Existing public strips must receive a safe, idempotent
  upgrade without moving/deleting property or resetting player changes.
- `npm run test:e2e -- tests/browser/landing.spec.ts`: in a disposable local
  public-parish fixture, use actual keyboard controls to land on the real
  graded runway and stop. Inspect third-person/cockpit runway views, B's touch
  label, rules editor and crash notice. Include airbrake-disabled and strict
  failure states. Do not replace this with the old infinite-plane controller.
- Finish with `npm test`, `npx tsc --noEmit`, Prettier on all changed files,
  player/world-builder flight instructions, README and an Unreleased entry.

Red evidence (`/tmp/aclone-landing-red.log`): firm arrival returned “hard landing”;
B did not increase descent; the fixed key schedule stopped outside the narrow
paint; strict settings were unknown; neutral bank did not settle; six metres
past the level grade was already outside the old blend. The runway regression
also failed with width 18 rather than 30. A further rule test rejected the
ground-wing/drop settings as unknown before those were exposed.

Progress: the first 32 flight/landing/airfield checks passed after tuning. The
new browser flow passed in 1.1 minutes: actual keys landed and stopped on the
graded strip, mobile B was visible, and editor-selected strict contacts produced
the hard-landing notice with airbraking disabled. Screenshots of the stopped
runway, cockpit, rules and crash were visually inspected. The rules fieldset was
then widened to avoid cramped labels. Full browser and unit verification remain.

The initial extended site survey rejected the whole feathered bounding rectangle.
It now requires the pavement/level clearance inside town, permits a gentle blend
onto clear countryside, and protects existing property wherever grading changes
elevation. Already level fringe points need no earthwork. Current ordinary
300/310-metre-radius fixtures fit 250/260 × 30 m; a wholly clear, level fixture
fits the full 400 m target. Legacy strips retain their existing hangar.

Final verification: `npm test` passed all 1,325 tests, zero failed
(`/tmp/aclone-landing-full.log`). TypeScript is clean, Prettier ran on every changed
path, and the diff check passed. The existing takeoff browser test and the new
landing flow passed together (2.8 minutes); after adding the remaining world-rule
fields, the final landing browser rerun also passed (1.1 minutes). Portable
designs, creation overrides, missing-key defaults, ground wing/drop rules and
the original western hangar/property preservation are covered. Stable terrain
interpolation preserves already-equal ground heights exactly.

### Flight view: terrain squares, chunky ground and distant towns

Done: committed and pushed as `80520ca` after the checks below.

Initial approach: Implement/measure fog first, then slant
range and directional preparation, then soften the surface transition. Replace
the tile system with rings only if those smaller changes fail these criteria.
Remove town-specific horizon refinement without rebuilding the shipped scenery.
Graphics limits belong to client quality settings, not world-owner rules.

Concrete completion criteria:

- At ground height preserve the existing 560 m enter / 680 m retain detail disc.
  At height above 680 m, settle to coarse tiles everywhere, including underneath.
  Descending at 8 m/s restores the fine tile underneath by 20 m above terrain.
- Along a warmed, clear-weather 66 mph path at 120 m altitude, no detailed/coarse
  boundary or missing tile within 300 m horizontally may persist over 2 seconds.
  Prioritise forward preparation within the existing 4 ms builder budget. Exercise
  reversal, climb/descent and cancellation while streaming as well as steady flight.
- Shared boundary vertices retain equal heights for every adjacent resolution;
  snow, river and cliff attributes remain valid. Surface-mask resolution changes
  must not leave a tile-aligned inked line in cockpit and chase views.
- Flight fog hides the distant coarse silhouette; walking/boating visibility
  remains unchanged. Buildings use the same atmosphere as land. A town outside
  loaded tiles must not introduce a special mesh-density pad. Inspect both that
  state and the approach after ground tiles arrive in the browser.
- Performance baseline: `PROFILE_OUT=/tmp/aclone-flight-before npx tsx
scripts/flight-view-performance.ts`. Fixed Performance graphics, 1280×800,
  frozen clear noon, 45 seconds at 66 mph from (1300,120,-1300) toward town.
  Proposed budget awaiting Henry's response: hardware Chromium median ≤50 ms,
  p95 ≤66.7 ms and no more than 10% regression on the same machine/path.
  Save GPU identity and screenshots so software fallback cannot masquerade as
  hardware performance evidence. Repeat after the fog-only experiment and at end.
- Before production edits add and run regression tests for flight fog, streaming
  height/priority, shared edges and town horizon density, recording actual failures.
  Browser verification must render the real `GameScene`, including initially
  empty streamed ground, town approach, high flight and descent to the runway.
  Finish with `npm test`, `npx tsc --noEmit`, explicit-path Prettier, and update
  `docs/FLYING.md`, README and the imperative Unreleased changelog.

Red evidence: both `tests/flight-view.test.ts` assertions failed (45 km airborne
fog and town-only fine cells); the new browser height test failed with 61 detailed
tiles at 800 m instead of zero. Baseline on actual Quadro M1200 OpenGL hardware:
1,350 frames / 45 seconds, median 33.3 ms, p95 38.0 ms, p99 44.9 ms, 457,048
triangles, 277 tiles, 0 browser errors. Start/end cockpit screenshots inspected.
The first production experiment changes only airborne fog (1,600 m clear,
1,000 m storm); ground/boat visibility is untouched.

Further red evidence: the intermediate-grid test initially received the full
fine mesh, and the scenery range test found no per-fragment range uniform.
The real-scene test initially counted 28 invisible picking boxes as visible
building materials; its inspection now excludes those non-rendered hit targets.
Visible building geometry retains the fog-fade assertion.

Height/descent, original ground hysteresis, streaming cancellation and the
66 mph forward/reversed path now pass. All shared edge tests pass with the
intermediate grid; lighthouse-support cliffs keep their shipped geometry while
ordinary towns no longer select a finer horizon cell size. The real browser
flow passes for initially empty streamed ground, town loading, 800 m flight,
runway approach and grounded visibility restoration. Final screenshots and
performance measurements are still being checked before completion.

Use the proposed 30 FPS acceptance budget as the working limit unless Henry
selects a different one. The fog-only run measured median 33.4 / p95 43.7 ms;
a later run with scenery fading measured 33.4 / 43.3 ms, both missing the 10%
p95-regression limit. Sharing duplicated cell vertices kept identical triangles
and edge heights while reducing terrain/snow sampling. The next isolated run
passed at median 33.3 / p95 37.3 / p99 39.5 ms with 1,350 frames, 277 tiles and
zero browser errors. The benchmark now asserts the hardware and absolute budget,
and `PROFILE_BASELINE=/tmp/aclone-flight-before/results.json` also asserts both
10% regression limits. No builder time-budget increase was needed.

A further high-altitude cliff regression failed because the old feature override
still built a dense interior even when a tile was labelled coarse. High flight
now coarsens that interior while preserving every 2 m cliff/river boundary
sample and the surface attributes. Ground and low flight retain feature detail.

Final browser group: `TEST_GPU=1 npm run test:e2e --
tests/browser/flight-view.spec.ts tests/browser/flight-terrain.spec.ts
tests/browser/terrain-streaming.spec.ts tests/browser/coastal-visibility.spec.ts`
passed all four checks (1.2 minutes). Inspected the empty-town, fully loaded town,
high-flight and cockpit-approach images. Loaded ground is continuous; the empty
state retains supporting land; coastal flashes remain visible at 1 and 30 km.
The completed terrain screenshots wait for all requested tiles rather than
mistaking the first tile under the aircraft for completed loading.

Final hardware verification (`PROFILE_OUT=/tmp/aclone-flight-verified
PROFILE_BASELINE=/tmp/aclone-flight-before/results.json npx tsx
scripts/flight-view-performance.ts`) exited successfully: median 33.3 ms,
p95 41.0 ms (7.9% above baseline), p99 45.4 ms, 1,350 frames / 45 seconds,
277 tiles, 472,588 triangles and no browser errors. Both absolute limits and
both 10% regression assertions pass. TypeScript is clean and Prettier has run
on every changed path. Full-suite verification remains in progress.

Full `npm test` passed all 1,330 tests, zero failures (195 seconds;
`/tmp/aclone-flight-full.log`). The final diff check is clean. This slice meets
its criteria without replacing the tile system or increasing its frame budget.

### Walking speed follows snow depth

Done: committed and pushed as `03a8aa7` after the checks below.

Concrete completion criteria before production changes:

- Exercise `move` for slot 5 at a flat, clear fixture, starting above the speed
  cap: ordinary and Shift caps must equal 5 and 8.5 m/s times the existing
  `drivingSurface` factor in snow. Off-road 4 cm gives 40%; 1 m gives about 10%.
  Compare the normalised walker and tractor caps at the same point.
- Across the existing 2 m verge, sampled caps decrease gradually from the
  unchanged wet-road factor to the field factor. Roads keep today's clear/wet
  behavior. Without snow, preserve walking's existing dry and wet-ground pace.
- Default-on `walkingSnow` and `walkingSnowScale` default 1 live in the settings
  catalogue. Disabled restores the prior walking cap. Scale 0 removes additional
  field drag while keeping wet-road pace; 1 uses the tractor factor exactly;
  greater values strengthen field drag, without a second snow-depth formula.
  Scale the field-to-road ratio, not the road speed. Validate scale 0–2.
- New worlds (including Puddlewick), old saves missing the keys, settings edits,
  creation overrides, portable design export/import, saved reload and the rules
  summary all use those defaults/overrides. Invalid types and scale bounds reject.
- Server movement, predicted movement and a resident's Navigator inputs use the
  same snow cap. Keep boats, aircraft, tractors and ostriches unchanged when
  toggling the walking rule. An ordinary resident still reaches a short snowy
  destination through actual movement.
- Red first: `node_modules/.bin/tsx --test tests/walking-snow.test.ts`. Browser:
  isolated local world, actual Walk/forward/Shift input in snowy field and on a
  road; observe reduced movement and normal road pace. In F10 Rules disable and
  re-enable snow drag, change the scale and verify actual travel; inspect the
  empty-snow state too. No live-world changes.
- Finish with the browser flow, full `npm test`, clean `npx tsc --noEmit`, and
  explicit-path Prettier. Update `docs/PLAYING.md`, world-building rules guidance,
  README and the imperative Unreleased changelog.

Red evidence (`/tmp/aclone-walking-red.log`): the normalised walker cap stayed 1
instead of the tractor factor, the default rule was absent, and a resident's
maximum in a metre of snow remained 5 m/s. The unchanged-other-vehicle check
passed. After implementation all nine walking/driving checks pass, including
server/prediction equality, road/verge samples, settings validation, legacy
fallback, persistence/designs and a completed resident journey. The old driving
test now asserts walking's changed snow pace and retains the ostrich/flying
exemptions. Its expected Shift value uses the same multiplication order to avoid
an irrelevant 3.4 versus 3.4000000000000004 floating-point mismatch.

The first browser run revealed noon thaw changing the seeded 4 cm layer while
speed was measured (3.454 rather than 3.4 m/s). The isolated fixture now uses
existing overcast-rain weather, where snow does not melt. The speed assertions
are unchanged; this measures fixed depth rather than silently accepting thaw.

`TEST_GPU=1 npm run test:e2e -- tests/browser/walking-snow.spec.ts` passed
(40.8 seconds). Actual Walk, W and Shift input covered 4 cm and 1 m fields,
clear roads, disabled drag, strengths 0/2/1 and bare ground. Travel distance per
second and the visible MPH readout matched the expected caps. Inspected deep
snow, clear road, bare-ground and world-rule screenshots; the new full-width
fieldset is readable. Full-suite checks are running before this slice is committed.

Final verification: full `npm test` passed all 1,334 tests, zero failures
(194 seconds; `/tmp/aclone-walking-full.log`). TypeScript is clean, Prettier ran
on every changed path, and the diff check passed. Player/world-builder guides,
README and the Unreleased changelog describe the new behavior and rules.

### Flight-view follow-up: retain fading through static batching

Done: committed and pushed as `df1ebb4` after the checks below.

Before continuing gathering-ground production work, inspection found that
`batchStaticScenery` cloned building materials without their shader hooks and
merged equal-looking materials with different shader behavior. The previous
browser assertion covered remaining unbatched meshes, leaving this blind spot.

Criteria: a fog-decorated building material must keep its shader hook/cache key
through batching, and may not merge with an ordinary material. Write/run a red
`tests/scenery-fog.test.ts` regression, then preserve those properties in the
batch clone/key. Re-run the real flight-view and coastal browser flows, the same
hardware performance budget, full `npm test`, TypeScript and explicit-path
Prettier. Update the Unreleased fix note and flight guide/README as appropriate.

Red evidence: the batching regression merged two different shader behaviors into
one mesh (`1 !== 2`). The fix includes shader identity in the batch key and
retains shader callbacks on the cloned material. All four fog unit checks now
pass. The flight guide already describes buildings fading into the same haze;
reviewed it unchanged, and clarified the README/Unreleased fix note.

The strengthened browser check also verifies the static building batches. The
flight-view/coastal flows passed, but the performance run missed the unchanged
41.8 ms p95 limit at 45.0 ms. Removing unused streaming-distance shader work from
unbounded building materials passed its new red/green regression, but an isolated
repeat still measured 46.5 ms. Neither result satisfies the acceptance budget.

Frame-pacing investigation reproduced a 51.2 ms gap in a new regression with
ordinary animation-callback arrival jitter (`/tmp/aclone-flight-pacing-red.log`).
The criterion is to keep 30 FPS on a 60 Hz display, with no skipped refresh caused
by callback arrival jitter; the simulated maximum gap must stay below 40 ms.
Use the browser display timestamp for scheduling while retaining actual elapsed
time for movement and performance measurements. All eleven focused pacing/fog
tests pass; the same hardware benchmark is being rerun without concurrent checks.

The display-clock benchmark passes: 1,350 frames in 45 seconds, median 33.3 ms,
p95 37.2 ms and p99 39.7 ms on the same Quadro M1200, with 277 terrain tiles,
472,588 triangles and no page errors. The original p95 baseline is 38.0 ms and
the unchanged regression limit is 41.8 ms. Evidence:
`/tmp/aclone-flight-display-clock/results.json`.

Final verification: both real flight/coast browser flows pass (58.5 seconds),
including static-batch haze, empty terrain, loaded town, high flight, landing
approach and distant lighthouse support. Inspected the town screenshots.
Full `npm test` passes all 1,337 tests (196 seconds), TypeScript is clean,
Prettier ran on every changed path, and `git diff --check` is clean.

### Natural gathering grounds without abandoned tools

Done: committed and pushed as `b17b036` after the checks below.

Completion criteria, before production changes:

- Default geometry for all four materials contains no wheelbarrow, shovel,
  hammer, sawn rounds, chopping block or chips. Retain banks, surface textures,
  weathered rock, roots/sod, trees and a bark-covered windfall. Both detail levels
  preserve tree placement. Check six variants per kind, finite position/normal/UV,
  x/z inside the existing 10 m radius bounds and y between -1.5 and 11 m.
- Do not grow the measured per-site triangle budgets (high/low): logs 4004/2500,
  stone 3876/1720, gravel 4022/2282, dirt 3500/1860. Include worn and legacy modes
  in the budget checks; keep at most five merged surface draws per site.
- Per-world `gatheringScenery` chooses natural, worked-near-settlements (default),
  or always-worked. Defaults for the adjustable town-edge distance and recent-use
  window are 100 metres and 600 simulation seconds, respectively. Keep defaults
  solely in `data/settings.json`; validate distances 0–5000 m and times 0–86400 s.
  Zero means no extra town buffer / no recent-use window. Missing legacy keys use
  defaults; creation, F10 Rules, summary, saves and portable designs preserve edits.
- Natural mode never adds wear. Default mode adds only light wear inside a town
  or its configured buffer, while depleted, during an active gathering task, or
  within the recent-use window. Fully regrown, expired and remote sites return
  to natural. No towns/no saved use is the empty state. Update visible sites from
  snapshots without reloading the world. Always-worked retains legacy scenery:
  this follows the explicit compact-world wheelbarrow exception. The optional
  clarification question was unanswered; the two other modes stay tool-free.
- Red first: extend `tests/resource-scenery.test.ts` with no-tool/natural timber,
  exact triangle ceilings and wear conditions; run and record the actual failures.
  Keep the existing actual gather, inventory implement/yield and NPC access tests.
- Browser: view all four kinds near and at streaming distance in lowland and
  northern provinces. Change all three rules through F10, check untouched,
  depleted/recent, expired and empty states, and verify no page errors. Run
  `scripts/resources.ts`, `PREVIEW_GPU=1 npx tsx scripts/northern-island-preview.ts`
  and building catalogue previews for quarry, mine and sawmill; inspect images.
- Finish with full `npm test`, clean TypeScript, explicit-path Prettier and diff
  checks. Update player/world-builder guidance, README and imperative Unreleased
  changelog. No gameplay, map-icon or business-building changes.

Red evidence: `/tmp/aclone-natural-red.log` reports worked wood in the natural
timber variant; `/tmp/aclone-gathering-rules-red.log` reports missing default
scenery rules. The geometry/rule implementation now passes seven focused tests,
including all 144 kind/variant/quality/style combinations, exact previous triangle
ceilings, natural/default tool absence, wear conditions and rule persistence.
The existing real gathering and resident-access tests also pass. A real browser
regression is checking live mode changes before snapshot/render integration.

The live browser regression failed because switching an installed timber site to
always-worked did not restore its worked wood. Snapshot updates now refresh only
installed local/chunk sites whose style changes; new chunk jobs also receive the
latest state. Geometry and material decoration survive switching without a full
world reload. An initial browser fixture omitted the optional `resources` map;
initialising that empty map fixed the fixture without changing its assertions.

Both browser flows passed (65 seconds): all four kinds near/far in lowland and
northern provinces, depletion/natural/expired changes, all three F10 modes and
threshold edits, plus an invalid negative threshold remaining unapplied. Inspected
all sixteen site images and the readable Rules panel. The catalogue, northern
preview, recent-full-site check and final suite are still being verified.

`PREVIEW_GPU=1 SCREENSHOT_OUTPUT_DIR=/tmp/aclone-natural-resources npx tsx
scripts/resources.ts` rendered the four catalogue views and completed an ordinary
three-unit gravel Gather action with no page errors. Visual inspection found the
wear patch could hide under the existing bank. A new regression failed because
the path did not extend outside that patch; move its existing four triangles onto
the approach, retaining the same budget. Recheck worn screenshots before finishing.

Final browser repeat passes both flows (67 seconds), including full-but-recent
sites retaining wear and no browser console errors. Inspected all eight corrected
worn views: the short approach path is visible for every kind in both regions.
The full northern-island preview completed its terrain/water/dock and map checks;
inspected headwater, river and dock images. The quarry, mine and sawmill catalogue
preview completed without errors and all three contact sheets were inspected.

The final resource catalogue/Gather repeat also completed without page errors;
inspected all four final catalogue views. Full `npm test` reports 1,341 passes,
zero failures/cancellations (194 seconds), but the command wrapper returned 143.
Do not accept that ambiguous process result: repeat with an explicit shell exit
status file before committing. TypeScript, formatting and diff checks are clean.

Confirmation: all 1,341 tests pass again (189 seconds), and both the command and
`/tmp/aclone-natural-full-confirm.status` report exit 0. The slice meets its
completion criteria; no gameplay gathering, business models or map icons changed.

### Fuel tanker trailer with roadside fuel sales

Completion criteria, before production changes (two sequential slices):

1. **Fuel-only rig, model and tuning.** Add an eighth trailer using the Dales
   tank/chassis assembly, with a distinct tank colour, hazard placards and rear
   hose/nozzle. Keep the Dales water/milk acceptance unchanged. Default price
   57.5s and capacity 700 weight, held once in the trailer catalogue and adjustable
   through per-world trailer tuning in F10 Vehicles. Validate whole price
   0–100,000,000 internal units and capacity 1–100,000; refuse reducing capacity
   below any existing load. Missing tuning uses catalogue defaults. Preserve
   tuning in saves/designs and show effective values in purchase/cargo panels.
   Test garage purchase, fuel-only acceptance, refinery-to-trailer loading, owner
   inventory transfers, loaded drag/fuel penalties, death parking/cargo policy,
   restart and an empty/full model in the browser. Default 700 Fuel supplies
   5,600 tank units using the existing per-world Fuel catalogue value of 8: one
   3,200-unit trawler plus 2,400 spare, or bounded smaller-vessel refills. Do not
   introduce another hard-coded Fuel conversion. Run red unit tests first.
2. **Roadside service.** Persist an owner-set whole-unit sell price; zero means
   closed to other buyers, while owner pumping/transfers remain free. Permit
   attached and parked service only outside, stationary, within the shared
   refuelling range (default 15 m), with valid vehicle/height/activity checks.
   Buy Fuel into inventory or pump directly, consuming/charging whole Fuel and
   capping the vehicle tank without a partial-item refund. Assert exact stock,
   buyer cash, online-owner cash/offline-owner bank, town tax and ledger entries;
   refuse insufficient cash/cargo, empty/full tank, closed sales, excess quantity,
   moving/out-of-range/airborne users, missing owners and repeated invalid actions
   without mutations. Nearby boats must be alongside the land-based trailer.
   Set defaults: roadside sales on, offline sales on, transaction limit 10,000,
   optional shop-relative ceiling 0 (off), resident purchasing on with a separate
   reasonable-price factor 1.25. NPCs may buy only when no usable shop is within
   normal trading reach; never spend their protected needs reserve. Put these
   defaults/limits in the world rules and cover creation, editor, summary,
   persistence and portable designs. Use the existing per-world Fuel catalogue
   conversion for pumping and economics.

For roadside export acceptance, extend the unoccupied-world design import with
parked fuel-tanker placements, load and sell price only; exclude attached rigs
and private source-owner IDs, and assign imported placements to the new world's
owner as with imported businesses. Validate IDs, positions, price, fuel-only
load and tuned capacity before accepting the design. Ordinary world saves retain
actual ownership. Do not change export behavior for the seven existing trailers.

Browser steps: buy the new kind at the garage, inspect empty/full rig and its
hazard/hose details, load from a refinery, transfer inventory fuel, then park.
Use a second local player to purchase inventory fuel and refuel a nearly full
vehicle; inspect owner price control, refusal/empty states and offline service.
Edit tuning/rules in F10 and verify effective panels and transactions. Test NPC
fair-price versus overpriced/no-shop cases through its normal decision path.

Each slice requires its red-to-green tests, affected browser flows, full
`npm test`, clean TypeScript, explicit-path Prettier and diff checks. Update
`docs/HAULAGE.md`, player/world-builder guidance, README and imperative Unreleased
changelog. The whole item remains pending until both slices meet these criteria.

Fuel rig red evidence: all three new unit tests failed for the missing fuel
catalogue/action; the browser model check failed for the absent rear hose.
The fixture initially used vehicle slot 3 instead of the shipped trawler slot 30
and omitted the existing 3% bulk discount at 500 units; correct those fixture
expectations without changing trading behavior. Ten fuel/existing-haulage unit
tests now pass, including tuned-capacity refusal without mutation.

Browser evidence: both `tests/browser/fuel-trailer.spec.ts` flows pass on hardware
WebGL (25 seconds). Inspect the empty/full amber tank, hazard diamond, ladder,
valve, hose reel and nozzle, and unchanged silver liquid tank; inspect tuned
60s/800-weight garage purchase, full refinery load, own inventory unload/parking,
and refusal to reduce capacity below the parked load. No browser page errors.
An additional red test caught partial tuning clearing an untouched field; preserve
omitted values and confirm all 11 focused haulage tests pass. TypeScript is clean.
The first full-suite process ended early with 143 and no assertion failure;
repeat the full suite and require a recorded exit 0 before committing.

Confirmation: full `npm test` passes all 1,345 tests in 191 seconds, with command
and `/tmp/aclone-fuel-full-confirm.status` both reporting exit 0. TypeScript,
Prettier and diff checks are clean. The fuel-only rig/model/tuning slice meets
its criteria; roadside sales and parked-tanker design placements remain next.

Fuel-only rig/model/tuning: **done**, pushed as `e220ec4` on
`backlog-implementation`. Begin the roadside-service slice under the criteria
above. Additional concrete decisions: posted Fuel prices at completed shops
anchor the optional ceiling even when out of stock; if none exist, use the
world catalogue Fuel price. Protect NPC food/drink/rent reserves, allowing its
one-fuel reserve to pay for fuel. Refuse a stale expected sale price. Keep exact
Fuel stock public for nearby purchase quotes, like shop stock.

Roadside red evidence: sales actions and settings were missing, parked design
placements were absent, and normal resident drive preparation selected no tanker.
The browser failed on the absent roadside sales panel. The initial free-owner
ledger expectation incorrectly counted the two player-creation faucet entries;
assert no additional entries instead. All eleven focused roadside tests now pass.

Correction to the earlier conversion assumption: the existing world catalogue
allows custom items but refuses built-in Fuel overrides. A new red settings test
confirmed this missing per-world rule. Move Fuel's default conversion (8) into
`data/settings.json` once, derive the built-in catalogue value from it, and expose
`fuelUnitsPerItem` to world owners. Ordinary item use, carried assistance and
pumping read the effective world item definition. Shared refuelling distance,
height and stopped-speed rules default to the existing 15 m, 3 m and 0.5 m/s.

Browser failures found and fixed: offline owners are intentionally absent from
player snapshots, so publish only seller name/online/stopped facts for the
customer quote; never trust those hints for server execution. Add a red snapshot
test, then verify offline sales without exposing balances. The next browser run
caught stale stock/closed-sale displays after remote changes; refresh only the
roadside panel while preserving active inputs. The flow now passes in 29 seconds,
covering owner price/free use, near-full pumping, offline bank payment, inventory
sales, empty/closed/full states and saved rules. Twenty-eight focused tests pass;
TypeScript is clean. The final combined browser/full-suite checks are running.

The combined browser run passes all three tanker flows (1.9 minutes under full
suite load); the focused sales repeat passes in 33 seconds and the actual rules
fieldset is visually inspected. Full-suite integration initially found two NPC
regressions: an optional field violated the strict provider schema, and the new
standalone action exceeded the existing 96,000-byte worst-case request limit.
Reuse the existing player-operation protocol and its price parameter instead;
retain stale-price validation, the complete existing guide budget and both tests'
limits. All 19 NPC-provider/guide/roadside tests pass. Do not commit until the
new full-suite run is green.

Final verification: `npm test` passes all 1,357 tests in 191 seconds, exit 0
(recorded in `/tmp/aclone-fuel-sales-full-final.status`); both NPC integration
regressions are green in that run. TypeScript, changed-file Prettier and diff
checks pass. The roadside slice meets its criteria, completing the tanker item.

Pushed `3ef141b`: roadside sales and the complete fuel-tanker item are **done**.

### Canoes — portable ownership and storage slice

Concrete criteria before production: a canoe is a purchasable/craftable inventory
item and a persistent owned small-craft record when carried or set down. Buy at a
completed carpenter or boathouse; craft at a carpenter using wood. Default price
150d, hull weight 8, wood cost 8, carrying speed 0.4 of ordinary walking, interaction
range 3m, stopped speed 0.5m/s and two canoes per owned home are world rules.
Use an explicit carry action to lift a canoe transported in inventory; an overhead
canoe's weight is included exactly once. Pickup defaults to owner-only; an enabled
world rule transfers ownership when another player picks up a set-down hull.
A carried canoe prevents running, jetpack/jumping, vehicle changes, fishing,
gathering and construction. Set it down on dry, unobstructed ground, persist its
owner/position/heading/paint, and let both players see it and the inverted carried
hull. Store at the owner's home as ordinary home inventory, removing the world
object; retrieve at the door, respecting weight and home limit. Stored stock uses
ordinary property death rules; carried hulls follow inventory death rules;
set-down hulls survive boat-loss deaths unless the separate land-loss rule is on.

Run `node_modules/.bin/tsx --test tests/canoe.test.ts` with assertions covering
purchase/craft, carrying/weight/blocked actions, two-player ownership, set-down,
home storage/limits, invalid actions without mutation, save/restart and death.
First confirm the new action fails because it is absent. Browser:
`TEST_GPU=1 npm run test:e2e -- tests/browser/canoe.spec.ts`: buy/carry/set-down/
pickup/store/retrieve through real controls; inspect overhead and ground hulls,
empty state, insufficient funds/wood, full home and ownership refusal; inspect
F10 changed rules. Capture screenshots and inspect the hull orientation. Finish
with `npm test`, `npx tsc --noEmit` and changed-file Prettier. Update PLAYING,
WORLD_BUILDING, README and Unreleased. Shore launch and the rowing vehicle are
explicitly the following slice; the canoe item is not done until both slices pass.

Initial canoe red run: all four original tests fail on missing `canoe` action or
unknown canoe setting. Extend coverage to exact 0.3/0.7 carrying multipliers,
Shift and jetpack input, ordinary construction/task actions, public snapshot
visibility, both carried-death policies, portable rules and home-stock bypasses.
Use old-age death in fixtures: zero health heals before the ordinary injury check.

Browser inspection finds the overhead inverted hull and upright set-down hull
visible. Seal the bow/stern ends after a mesh-boundary regression fails (20 open
edges instead of the intended 14 rim edges). The focus regression initially also
races the existing delayed action-result redraw; wait for that response to finish
and then verify steady snapshots preserve focus. Normalize the generated DOM
before replacing changed controls. The repeated real browser flow passes with
owner-only pickup, empty/poor state, full home and all F10 canoe rules visible.

The first full suite passes 1,363 of 1,365 tests. The new commodity lacks default
port import/export quotes, and its documentation pushes the existing worst-case
NPC request over 96,000 bytes. Add quotes derived from the single canoe price,
retaining the port anti-arbitrage test. Remove physical prose line wraps and
manual headings duplicated in the guide topic index, preserving all words,
structured Markdown, source links and every indexed heading. Added red tests
confirm that these transformations preserve the content. Keep the 12,500-character
guide budget and 96,000-byte request limit unchanged. Focused canoe/economy/guide
regressions pass; full-suite verification remains required before commit.

Final portable-canoe verification: `npm test` passes all 1,368 tests in 204 seconds
(exit 0 in `/tmp/aclone-canoe-full-final.status`); TypeScript and changed-file
Prettier are clean. The final browser run passes in 1.1 minutes, including a
successful wood craft after the insufficient-cash/wood state. Inspect the overhead,
whole set-down hull, owner-only pickup, full home, empty/poor and F10 screenshots.
The carrying/storage slice meets its criteria; launching and rowing remain next.

Pushed `b23d3b2`: portable canoe ownership, carrying and home storage are **done**.

### Canoes — launch, paddle, beach and recover

Before production, extend `tests/canoe.test.ts` and add shore-flow browser coverage.
Default paddling speed 1.2m/s and hold 12 weight belong to the canoe world rules;
one occupant and no engine/fuel are structural. Use mode 3 and ordinary rowing
movement, with Shift unable to accelerate it. Minimum water depth 0.08m, maximum
step-out depth 0.6m, bank reach 6m, maximum dry-bank rise 1.5m, and gentle shore
contact threshold 2m/s are per-world rules. Dry placement keeps its existing
handling range. World-rule values, UI explanations and authority/prediction share
one source. Block generic vehicle purchasing/boarding of the canoe slot so it
cannot manufacture or summon a hull.

From a carried/set-down owned canoe at a shoreline or riverbank, **Launch canoe**
finds nearby unobstructed water with depth for the whole hull; reject no-water,
blocked, too-shallow, overweight, moving, airborne and other-owner attempts before
mutation. The same hull id becomes an occupied launched record and mode-3 vehicle.
Paddle upstream through a channel that stops the canal boat. A stopped canoe in
the step-out depth band can **Beach canoe** onto nearby clear dry land, leaving
that hull moored at the bank; board it there or pick it up from the bank. No dock
is required. Completed boathouses, pier and river docks also launch/board/moor it.
Keep existing powered-boat shore recoil/damage tests green; at ordinary canoe
speed, shore contact stops travel without condition loss or recoil onto land.

Tests must verify every water/land transition, unchanged identity/paint, no
inventory duplication, exact hold boundary, seat refusal, ordinary and Shift
paddling, narrow shallow headwater passage, save/restart mooring, other-player
visibility/ownership, and both world boat-death policies. Death afloat loses the
hull/cargo in loss worlds; otherwise use existing stranded-boat recovery and cargo
spoilage, with recovery restoring the same hull. Land property keeps the previous
slice's settled policy. Empty-tank rescue must not create a lifeboat from a
fuel-free canoe. Show the seated paddler and moving paddle afloat; keep an empty
moored hull visible and preserve the already verified overhead model.

Browser commands: `TEST_GPU=1 npm run test:e2e -- tests/browser/canoe.spec.ts
 tests/browser/canoe-water.spec.ts`. Exercise actual launch/paddle/beach/reboard
controls and keyboard movement at coast and riverbank; inspect model/screenshots,
no-water and overloaded controls, ownership refusal, restored saved mooring and
changed F10 speed/capacity/depth rules. Unit command:
`node_modules/.bin/tsx --test tests/canoe.test.ts tests/boat-shore.test.ts
 tests/boat-abandonment.test.ts tests/boating.test.ts`. Require the initial red run, then green focused tests,
full `npm test`, clean TypeScript and changed-file Prettier. Update PLAYING,
WORLD_BUILDING, HAULAGE, README and Unreleased. Only then is the Canoes entry done.

Water-slice red tests fail on the absent launch action. Subsequent regressions
catch an occupied hull id surviving death, a grounded bow preventing deliberate
beaching, river-bank rise measured against sea instead of adjacent river water,
and the static seated human having no animation bones. Fix each and keep existing
powered-boat recoil/damage tests green. The real northern headwater survey finds
an unobstructed 3m canoe sweep where the canal hull collides, and actual canoe
movement travels over 2m into that reach. Boathouse and pier round trips preserve
the same hull. Browser coast and elevated-river launch/paddle/beach flows pass;
add an explicit server-close/reopen check for mooring and finish preservation.
A visual check catches water covering the open interior; add a failing floor
regression and a visible lining above calm water. Full verification remains pending.

The restart browser run preserves the same moored id, location and paint and
boards it through the real control. Add moving, airborne, shallow and obstructed
launch refusals with unchanged hull/cargo. River-dock round trips pass, including
an online nearby passenger refused specifically for lack of a seat. A red pickup
regression exposes a stale bank location after carrying a moored canoe inland;
clear the old landing when lifting it. River screenshots expose the lining at
the inland water plane and a moored hull not following the river slope. Raise
the lining above that plane and apply the existing boat sea pose to moored
canoes each frame, with tide/slope regression coverage. Re-run the coast flow
with actual F10 edits to speed, hold and minimum depth.

Final diff review finds the generic-vehicle guard attached to vehicle reset rather
than vehicle switching. The new boathouse regression fails because ordinary
walk-away controls create a second mooring. Move the guard to vehicle switching;
test both leaving an occupied canoe and summoning a moored one through generic
controls. Stop the overlapping verification runs and rerun after the fix, without
source edits while the browser is running.

Recovery regressions fail on Fuel being poured into a nonexistent canoe tank and
an elevated-river transfer being checked against sea level. Restrict emergency
hold-space refuelling to motorised hulls; check transfers and place the recovered
hull at the local water surface. Preserve existing powered-boat recovery tests.

The complete suite passes 1,384 of 1,385 tests; the sole failure asserts the old
34-slot catalogue count. Update it to 35 and explicitly compare the original 34
slots with their unchanged definitions, then assert the appended canoe is a
fuel-free mode-3 hull. Retain the finite movement and fuel checks for the original
five driving modes. All four browser flows pass in 1.6 minutes, including changed
F10 rules, riverbank use, restart and carrying/storage. Inspect their screenshots;
the canoe lining now remains visible above river water. Full-suite rerun required.

Final water-slice verification: `npm test` passes all **1,385** tests in 192 seconds
(exit 0, `/tmp/aclone-canoe-full-final2.status`). `npx tsc --noEmit` is clean
(`/tmp/aclone-canoe-tsc-final2.log`); Prettier has run on every changed file.
The 74 focused boating regressions and four real browser flows pass. The canoe
entry's carrying, storage, water access, movement, mooring, ownership and recovery
criteria are satisfied. Ready to commit and push this slice before marking it done.

Pushed `894ae4a`: canoe launch, paddling, beaching and recovery are **done**;
the entire Canoes entry is now complete.

### Remaining-order dependency correction

The Rowboats tests explicitly require “the storm behaviour below”. The initial
order separated that acceptance dependency from its hull work. Keep Rowboats and
Storm capsizing together, after the cargo hull, and move independent CB radios,
world-rule batches and solid scenery ahead of that pair. This changes no completed
work or completion criteria; do not mark rowboats done with storm tests deferred.

### CB radios — transient authority and propagation slice

Before production, add `tests/radio.test.ts`. Define the full radio entry's
criteria here, with this slice implementing server authority and the following
slice supplying the real dashboard/input/event flow. Neither completes the whole
CB entry on its own.

Each supported vehicle has persistent per-player/per-slot channel, handle, volume
and squelch; the enabled rule defaults on, 40 channels, emergency channel 9 and
road convention 19. Foot travel has no radio. All gameplay thresholds belong to
world rules: base ground range 3km, water range multiplier 1.5, antenna height by
vehicle type, terrain attenuation, speaking rate, simultaneous-key window,
message length, static/drop thresholds and rescue reach. Residents default off.
Text uses the same moderation and chat lock as ordinary chat; no public chat log
entry is created. Radio keys need a nonempty permitted message; duration derives
from its length and the configured speaking rate. Reject out-of-range channels,
invalid controls, disabled radios, walking and duplicate keys without mutation.

Hold transmitter/session state outside the saved World. `key`, `release`,
`channel`, `squelch`, volume and handle actions affect only the caller's radio.
A later key while hearing a transmission is refused as busy; simultaneous keys
inside the per-world key window collide for listeners who hear both. Different
channels remain isolated, and remote stations outside reception can reuse a
channel. Tick reception per listener from positions, distance, antenna altitude
and bounded terrain samples. Squelch hides weak signals, then dropped words and
static progressively obscure reception. Flat-ground 3km reach, hills/aircraft
extension, over-water extension, ridge obstruction and no cross-island reception
must be reproducible in tests. A released/expired transmission ends, leaving a
finite received event log. Preserve selected channel/handle across save/reload,
but restart drops active transmissions and received traffic. Leaving a vehicle
clears its transient log. Residents do not respond.

The later UI slice must render a separate radio pane in tractors, boats and
aircraft, including channel, handle, volume/squelch, keyed status, received signal
and busy/doubling notices. Use actual keyboard, touch and controller bindings and
verify them in browser flows, including disabled/no-radio/empty-message/busy and
weak reception. Channel 9 stranded-vessel calls surface a nearby rescue prompt
with ordinary manual recovery controls; no automatic response or rescue. Test
moderation parity and chatLocked. Update PLAYING, WORLD_BUILDING and README.

For this authority slice: focused `node_modules/.bin/tsx --test
 tests/radio.test.ts`, then full `npm test`, `npx tsc --noEmit` and explicit-file
Prettier. Initial red tests must show missing radio authority before implementation.
The real action/event integration and editor belong to the next slice, whose
browser command and concrete platform steps will be recorded before its code.

Authority slice refinement before editor code: the shared completion protocol
requires new rules in the editor and summary now. Add editor/export regressions,
and `tests/browser/radio-rules.spec.ts`: open F10 → Rules → CB radios, inspect
all controls, change channel count/range/speaking rate, disable radios, apply,
reopen and verify saved values. The initial grouped-fieldset assertion must fail.
Run `TEST_GPU=1 npm run test:e2e -- tests/browser/radio-rules.spec.ts` and inspect
the screenshot. Degradation boundary tests also expose correlated word hashes
that leave weak messages fully legible; fix the deterministic distribution.

Initial authority tests fail on the missing radio action/module. Eleven focused
regressions now cover channels, time, collision, reach, squelch, degradation,
persistent selections, transient logs, world switches, emergency cues and portable
rules. Weak-word hashing initially leaves all ten words intact at reduced signal;
add a deterministic avalanche so nearby word indices do not correlate. A real
socket regression then fails because a rejected action replaces World and erases
its WeakMap radio state. Checkpoint radio state with the action transaction and
restore it onto the rollback copy, including rollback of a key whose save fails.
Keep this integration in the authority slice rather than defer a known failure.

The socket transaction regression passes after checkpoint restoration. A late-range
listener regression then receives “firs” instead of the actually spoken “last”:
record the received character spans on each tick rather than taking a prefix at
completion. Capture the speaking rate when keying so changing a world rule does
not rewrite an in-progress transmission's timeline.

Full verification passes 1,397/1,398 tests. Compact snapshot traffic is 75,708 bytes
against a 74,695-byte ceiling (30% of legacy), because every clock update repeats
all world settings, including the new radio rules. Preserve the existing size
limit. Add a red settings-delta regression for clock-only updates, edits and
explicit removal. Introduce negotiated protocol 4 for settings field patches;
protocol 3 must continue receiving complete settings objects. Verify reconstruction,
legacy compatibility and the unchanged snapshot budget, then rerun the real editor
browser flow using protocol 4. Update protocol/architecture/hosting documentation.

Final authority-slice verification: `npm test` passes all **1,399** tests in 197
seconds (exit 0, `/tmp/aclone-radio-full-final.status`). TypeScript is clean
(`/tmp/aclone-radio-transport-tsc.log`), and explicit changed-file Prettier has run.
The 26 focused transport/radio regressions pass. The F10 browser flow passes on
protocol 4 in 16.7 seconds; inspect its screenshot with changed channel count,
range, speech rate and disabled-radio state. The unchanged snapshot benchmark now
uses 11,028 compact bytes against 248,985 legacy bytes (4.4%, below the 30% ceiling).
Authority, rules and transport meet this slice's criteria; dashboard/input/event
presentation still remains before the CB radio entry can be marked done.

Pushed `1a75606`: CB authority, world rules and compact settings transport are
**done**. SSH push failed with a public-key error; the existing authenticated
`gh` credential helper successfully pushed over HTTPS, and the GitHub branch SHA
was verified. No reauthentication or remote configuration change was needed.

### CB radios — dashboard, controls and received events

Before production, add browser coverage in `tests/browser/radio.spec.ts` and
extend socket tests. Initial red: a vehicle has no CB dashboard button/pane and
no private `radio` socket event. Send listener-specific radio views only to that
peer, on change, with world/vehicle identity; never expose other channels through
public state. Events show the keyed stations, remaining airtime, strength,
dropped text/static, doubling and manual rescue cues. Preserve transient clearing
when walking, changing vehicles, disconnecting or changing worlds.

Dashboard criteria: a dedicated CB panel on tractors, boats and aircraft, opened
from the vehicle HUD or V, also from mobile Actions. Show channel, call sign,
volume, squelch, a draft, Hold to transmit, current carrier and a received log.
No received traffic has a clear empty state. Disabled worlds and walking explain
why controls are unavailable. Empty messages cannot key; busy and muted refusals
remain visible. Snapshots/action results preserve a focused draft and held button.
Volume changes the radio notification sound; existing master mute still applies.

Keyboard: V opens the panel; after drafting, hold T to key and release T to stop;
normal typing must never key or change channels. Touch: hold/release the actual
transmit button, including pointer cancellation. Controller: View (8) opens CB,
right trigger (7) holds/releases PTT, and existing D-pad navigation/adjustment
operates channel, volume and squelch. Bindings are configurable with other
controller controls. Blur, lost capture, hiding the page or disconnecting must
release/cancel PTT. No stale held input can resume a transmission on reconnect.

Browser command: `TEST_GPU=1 npm run test:e2e -- tests/browser/radio.spec.ts
 tests/browser/radio-rules.spec.ts`. Two real local pilots exchange a keyboard
transmission; test channel isolation, busy, doubling, weak reception, selected
channel/handle after reload, foot/disabled/empty/muted states, and manual channel-9
rescue options. Inspect screenshots of the pane in a tractor, boat and aircraft.
A mobile viewport must fit without horizontal overflow and send by touch; an
emulated Gamepad must use the actual polling/binding path for open, channel and
PTT. Require private socket-event tests, full `npm test`, clean TypeScript and
changed-file Prettier. Update PLAYING, WORLD_BUILDING, README and Unreleased, and
only then mark the complete CB entry done.

Dashboard progress: the initial browser failure was the missing CB button; the
private-event socket test timed out because no event existed, and the audio test
failed on the missing radio notification method. The first integrated desktop
and mobile/controller flows pass. Visual inspection found the desktop's generic
230px textarea pushes the received log below the fold: add an in-viewport empty
log assertion before reducing the radio draft's own height. A no-tick reconnect
regression also fails correctly: received traffic survives a rapid reconnect.
Clear that listener and microphone at server departure rather than relying on a
future simulation tick. Preserve channel/handle configuration.

CB dashboard verification: all 15 focused radio/audio/socket tests pass, including
listener isolation, unchanged-event suppression and immediate reconnect cleanup.
All three real browser flows pass (F10 rules, two-pilot desktop, mobile/controller)
in 2 minutes. Inspected screenshots show the compact empty log, tractor/boat/
aircraft dashboards, doubling/static traffic and the mobile controls without
horizontal overflow. Full `npm test` passes **1,401 tests** in 215 seconds (exit 0,
`/tmp/aclone-radio-ui-full.status`); `npx tsc --noEmit` is clean
(`/tmp/aclone-radio-ui-tsc2.log`). Prettier ran and its explicit-file check passes.
Player/world-building/protocol docs, README and imperative Unreleased changelog
are updated. The CB entry is ready to commit and push without a version bump.

Pushed `39602ab`; GitHub's branch SHA matches. **CB radios are done**, including
both the authority/rules and dashboard/input slices. All work remains Unreleased.

### Gameplay rules — survival and needs: tuition, licences and public labour

Read the complete rules entry before implementation. One spec discrepancy needs
Henry's answer: its health bullet says 65,000, but `maximumHealth` and its tests
use 60,000; 65,000 is the energy ceiling. The same entry requires current defaults
to be preserved. An explicit clarification is pending; do not choose or change
the health default without that answer. Continue the independent tuition/labour
portion of this same fieldset first; finish survival/needs before economy.

Before production, add `tests/survival-rules.test.ts` and a browser flow.
Concrete criteria: new worlds and missing-key old saves retain 80d/60s first
lessons, 160d/2,400s later lessons, catalogue overrides, and licences counting
against the skill limit. Change each default via validated owner settings;
learning charges the changed price and uses the changed end time. Excluding
`driver`, `pilot` and `captain` from the skill limit permits those licences at a
full professional limit, and permits a profession when only licences are held.
Server, school controls and resident training plans must agree. The pricing
first/later distinction still counts lessons already learned; only limit counting
is optional.

Public relief currently evaluates to 150d (15,000 internal money units), with a
50d means test, 1,800-second cooldown and a 15-second shift. Preserve those
values as named defaults in settings. Changed relief amount, means threshold,
cooldown and labour shift duration affect quotes, task completion, payout and
all live help/rules/agent text that quotes them. Ordinary pay/cap and diminishing
returns stay as they are. In-progress shifts retain their quoted payout and end.
Reject invalid bounds/types atomically, including edits to old saves missing keys.
Export/import and new-world creation retain the rules.

Commands: `node_modules/.bin/tsx --test tests/survival-rules.test.ts
 tests/public-labour.test.ts tests/npc-follow-through.test.ts tests/npc-employment.test.ts`, full `npm test`, `npx tsc --noEmit`, and
Prettier on changed files. Browser: F10 → Rules → Survival and needs, edit/apply/
reopen tuition and relief controls; open the actual school and Odd Jobs Office,
verify changed quotes and durations, the skill-limit refusal and exempt licence
case; inspect screenshots. Update WORLD_BUILDING, PLAYING, README and Unreleased.

School/relief progress: all initial tests failed on absent settings/fieldset.
The first focused run passes 38 tests, and the real browser flow passes in 32.5s:
F10 save/reopen, changed tuition and course completion, disabled profession at the
limit, exempt pilot enrolment and a changed-duration relief payout. Inspected the
rule, school-limit and Odd Jobs screenshots. A further default-preservation test
caught a proposed resident check-in changing from 60s to 600s; restore its original
60s maximum while shortening it for shorter configured lessons. Seven new rule
tests now pass. TypeScript is clean and changed files have been formatted.

The first full run reports 1,407 passes and one cancelled test: the unchanged
45s slow-network integration test times out. The preceding CB full run took
42.8s for that same test. Diagnose with an isolated unchanged test and then run
the full suite without concurrent formatting or focused test processes; do not
raise its timeout or relax its delivery/lag assertions. No commit until it passes.

Final school/relief verification: the unchanged isolated slow-network test passes
in 34.2s with maximum state age 0.76s. The full rerun, without concurrent test or
formatter work, passes **1,408 tests** in 198.7s (exit 0,
`/tmp/aclone-survival-school-full-final.status`), including that same unchanged
45s network test. No assertions, limits or timeouts were weakened. The seven new
rule tests pass, TypeScript is clean (`/tmp/aclone-survival-school-tsc-final.log`),
and explicit-file Prettier checking passes. Browser acceptance and screenshots
are verified as described above. Tuition/licence/relief is ready to commit and
push; the full survival fieldset and remaining rules entry are not done.

Pushed `25766db`; GitHub's branch SHA matches. **The tuition, licence-limit and
public-labour slice is done.** The survival/needs section remains in progress.

### Resolved stop — health-default clarification

The next survival criterion has conflicting defaults. BACKLOG's survival bullet
names “the base maximum health (65,000)”, while its Approach requires “the default
reproduces today's behaviour”. `src/shared/nutrition.ts` currently computes
60,000 plus the bounded nutrition adjustment; `tests/nutrition.test.ts` asserts
that 60,000 baseline and 66,000 upper ceiling. The 65,000 value in simulation is
the energy ceiling. Choosing either health default would silently override one
of those requirements, so the explicit question sent to Henry remains pending:
**preserve 60,000 health, or change the health default to 65,000?**

No health default has been changed. Stop here for that answer; do not mark the
remaining survival/needs work or the gameplay-rules entry done, and do not move
on to economy or later backlog sections. Automatic feeding/starvation thresholds,
health/nutrition limits, repeat-serving and energy-regeneration rules still need
completion criteria, red tests and implementation. All later ordered work also
remains pending. Piloted spaceflight stays excluded. Resume with this same branch
and plan after the default is resolved; deployment still requires Henry's explicit
authorization.

### Resume — survival thresholds, health and nutrition

Henry resolved the default conflict: **change base maximum health to 65,000**.
The preceding stop is resolved. Keep the other stated defaults: automatic meals
at 30,000; damage at 50,000; nutrition adjustment ±6,000; repeated manual servings
receive half value starting with serving three; online energy regenerates at
3,000/second. Define each once in settings, with missing-key fallback.

Before production, add concrete regression tests in `tests/survival-needs.test.ts`.
Verify new-player and death/arena health, positive and negative nutrition bounds,
healing caps, changed automatic feeding/damage thresholds, pantry exhaustion,
empty stores, online/offline chunk equivalence, repeat-serving start and factor,
resident forecasts and changed/zero energy regeneration. Use non-default settings
so tests detect a second literal copy. Reject invalid values and cross-field pairs
atomically: feeding must precede damage, nutrition adjustment must stay below base
health. Validate creation/export/import, editor fields and live summary text.

Commands: `node_modules/.bin/tsx --test tests/survival-needs.test.ts`, then relevant
nutrition/offline/combat/creator/resident tests and full `npm test`;
`npx tsc --noEmit`; run Prettier on every changed file. Record the first red result
before production edits. Update existing default-health assertions only where
Henry's 65,000 decision changes their expected outcome.

Browser: extend the local survival-rule flow. F10 → Rules → Survival and needs;
edit/apply/reopen all seven fields. An invalid threshold pair must show an error
and preserve settings. Check health/hunger/thirst/wellbeing HUD percentages against
configured ceilings, consume repeated food through Inventory, and observe stocked
home feeding followed by empty-pantry damage. Inspect screenshots and page errors.
Update WORLD_BUILDING, PLAYING, README and Unreleased. No later item starts before
these criteria pass and this slice is pushed.

Initial red run: all seven survival-needs tests fail as expected (missing defaults,
Unknown setting, absent editor fields and unchanged fixed damage threshold).
Evidence: `/tmp/aclone-survival-needs-red.log`. Proceed to production changes.

Survival verification: eight new tests pass; the caretaker regression first failed
because its need meters still used 50,000 and now passes using the world limit.
The 60-test focused run passes. Existing health assertions were updated only for
Henry's approved baseline change; damage, collision, consumption and timing
requirements remain intact. TypeScript is clean.

The real browser flow passes in 16.9 seconds: all seven settings save/reopen,
invalid threshold pairs leave the world unchanged and show a toast, HUD and
caretaker meters use the configured ceilings, manual repeat meals use the changed
factor, and entering a stocked home consumes its water before empty-pantry damage.
Inspected all three screenshots; no page errors. Two test-harness corrections
selected the error toast and scoped Use to Inventory rather than the HUD shortcut.
No behavior criteria were weakened.

Full `npm test` passes **1,416 tests** in 197.5 seconds, exit 0
(`/tmp/aclone-survival-needs-full.status`). Prettier has run on every changed file;
WORLD_BUILDING, PLAYING, README and imperative Unreleased entries describe the
rules and the 65,000 health default. This completes the survival/needs fieldset,
pending final formatting/type checks and commit/push; economy remains next.

Pushed `bf3109b`; GitHub's branch SHA matches. **The survival/needs fieldset is
done**, including Henry's approved 65,000 base maximum health. Final TypeScript
and explicit-file Prettier checks pass. Start economy/trade next; all work stays
Unreleased on `backlog-implementation`.

### Gameplay rules — economy: purchase bids and quantity limits

First economy slice: expose the existing 1d minimum building purchase bid (100
hundredths) and 10,000-item quantity limit, preserving missing-key defaults.
Before production, add tests for a changed bid minimum in building administration,
actual sales, bulk-sale hints and database reload; below-floor saved offers must
remain unavailable until repriced, without secretly raising them on reload.
Legacy worlds missing the rule retain the existing free-bid repair. A lowered
minimum must allow affordable sub-denarius bids and preserve them across reload.

Expose a whole-item transaction limit (1–100,000) for the existing common quantity
operations: shop trade, stockroom transfers, giving/discarding goods and owner
item commands. Carry/storage/cash checks still apply. Client bulk sales and shop
quantity inputs use this limit; resident action parsing must allow the supported
range while the server enforces each world's limit. Keep discount-tier limits as
catalogue validation bounds; they are separate from allowed transaction size.

Commands: `node_modules/.bin/tsx --test tests/economy-rules.test.ts
 tests/trading-offers.test.ts tests/bulk-sale.test.ts tests/ownership-and-trade.test.ts`,
full `npm test`, `npx tsc --noEmit`, explicit-file Prettier. Verify default/changed
creation, missing keys, invalid ranges, editor summary and design round-trip.
Browser: F10 Economy and trade save/reopen; set a 0.5d bid via Building Admin,
then use a visitor shop's changed quantity maximum and Sell all cap. Verify the
empty-inventory state and rejected over-limit trade preserve stock/cash, and an
increased minimum refuses an existing cheap bid. Inspect screenshots. Update
WORLD_BUILDING, PLAYING, README and Unreleased before commit/push. Other economy
rules remain pending after this slice.

The quantity audit also found the same 10,000 limit in boat provisions, private
trade offers, shop tax previews and resident commitments. Include these paths in
this slice, with a red cross-path test. Existing offers retain their quoted size
if the limit later falls; new offers use the current rule. Trailer shop trades
use the common transaction rule; trailer loading retains its separate capacity
checks. Initial five tests fail on missing settings/fields as expected.

Economy bid/quantity verification: the seven new tests pass, including saved
sub-denarius bids, rejection without mutation, raised limits, boat stores,
private offers, tax previews and resident business requests. The resident request
regression first caught a separate fixed 1d check and now uses the shared minimum.
The 32-test trade/social/boat run and 19-test resident-finance run pass.

The real browser flow passes in 16.9 seconds: F10 save/reopen, 0.5d Building Admin
price, a three-item shop limit, rejected excess quantity, capped Sell all down to
empty goods, a raised minimum refusing a saved bid, private-offer quantity/empty
state, a trailer sale and boat-store transfer. Inspected the rule, empty goods
and boat-store screenshots; no page errors. Full `npm test` passes **1,423 tests**
in 197.8 seconds, exit 0 (`/tmp/aclone-economy-full.status`). TypeScript is clean
(`/tmp/aclone-economy-tsc-final.log`), and all changed files pass Prettier.
Documentation and Unreleased are updated; ready to commit/push. Outside investment
is the next economy slice, followed by the remaining fees, finance and construction
rules. No whole economy section is marked done yet.

Pushed `b5215c4`; GitHub's branch SHA matches. **Minimum purchase bids and item
transaction limits are done.** Continue with outside investment; all remaining
economy/trade rules and later fieldsets stay pending.

### Gameplay rules — economy: outside return and operating reserve

Next slice: expose the outside-investor return cap (8%) and minimum operating
reserve (2,000 hundredths). Before production, test named/missing-key defaults,
changed and zero values, reserve-protected collection, and existing-claim locks.
A changed return applies to new deposits only; topping up adds a separately priced
claim to the existing total. Persist the agreed total across reload. The old
migration that recognizes 25% launch-era claims must not rewrite a newly agreed
25% stake. Legacy unmarked 25% claims still receive their existing default repair.

Commands: `node_modules/.bin/tsx --test tests/investment-rules.test.ts
 tests/outside-investment.test.ts tests/npc-finances.test.ts`; full `npm test`;
`npx tsc --noEmit`; Prettier. Check validation, creation fields, rules summary and
portable designs. Browser: edit/reopen Economy and trade, invest at 25%, change
rate to 10%, verify the original claim and a new top-up, reject collection without
profits and with funds at the operating reserve, then collect from earned surplus.
Check current terms and existing-claim wording, empty stake state and screenshots.
Update player/world-building docs, README and Unreleased. Transfer-size and NPC
budget constants remain for later economy slices.

Initial investment run: four tests fail on missing defaults/settings/editor fields;
the unchanged legacy-repair test passes. Record `/tmp/aclone-investment-red.log`.

The first full investment run fails one unchanged criterion: the 96,000-byte
resident request budget (`tests/npc-guide.test.ts`). Investigation found the new
trade and investment paragraphs appended beneath the school/relief heading in
PLAYING, so a school-help query retrieves unrelated investment text with it.
Give these complete paragraphs their own accurate headings, preserving every
word and every budget/memory assertion; test that investment help is indexed
under its own topic. Do not truncate required memory or raise request limits.

Final investment verification: 28 focused investment/finance tests and all eight
guide tests pass. The real browser flow passes in 16.5 seconds, covering edited
terms, a retained 25% claim plus 10% top-up, no-profit/reserve refusals, actual
shop earnings and a 50d collection. Inspected the rules and claim screenshots;
no page errors. The guide fix only adds accurate chapter headings: no text,
memory, assertions or budgets were removed or weakened.

Full rerun passes **1,429 tests** in 198.7 seconds, exit 0
(`/tmp/aclone-investment-full-final.status`). TypeScript is clean
(`/tmp/aclone-investment-tsc-final.log`), and explicit-file Prettier passes.
README, PLAYING, WORLD_BUILDING and imperative Unreleased entries are updated.
Ready to commit/push the outside return and operating-reserve slice; fees and
money-transfer limits follow, with broader finance/NPC budgets still pending.

Pushed `d19d296`; GitHub's branch SHA matches. **Outside return and minimum
operating reserve are done.** Continue with garage/map/ammunition fees and parts;
transfer-size limits and the remaining economy rules stay pending.

### Gameplay rules — economy: service, maps and ammunition

Before production, add tests for named defaults: garage labour 1,000 hundredths
(10d), one Steel per service, a 1,000-hundredth printed map and a 2,500-hundredth
ammunition refit. Change all four through validated settings. Check actual cash
and garage revenue, parts consumption, owner labour exemption, roadside repairs,
map uniqueness, refit inventory/energy, and atomic missing-parts/cash failures.
Zero fee/parts settings must work without manufacturing or subtracting phantom
stock. Resident service plans and all live labels must quote the same prices and
buy only the missing number of parts. Keep the existing 25-point repair unchanged.

Commands: `node_modules/.bin/tsx --test tests/service-rules.test.ts
 tests/vehicle-services.test.ts`; full `npm test`; `npx tsc --noEmit`; Prettier.
Verify old-key fallback, validation, creation fields, summary and design transfer.
Browser: F10 edit/reopen all four, visit a garage, refuse missing Steel, service
with the correct parts/fee, buy the priced map, refit at the changed price, and
exercise roadside repair readiness and empty-parts failure. Inspect UI screenshots
and page errors. Update PLAYING, WORLD_BUILDING, README and Unreleased.

Service red run: all six tests in `tests/service-rules.test.ts` fail for missing
named defaults, Unknown setting, or absent editor fields. No production changes
preceded that run (`/tmp/aclone-service-red.log`).

The first browser run reached payment/refit but the test world used energy
combat, hiding the ammunition control. Correct the fixture to fighting + ammo;
the same flow then passes in 16.4s. A source sweep found the empty-map and
Activities help still quoting old prices. Extend the browser assertions first;
the empty-map check fails on 10d versus configured 1.23d. Update both help strings
to the shared rules, retaining their existing visibility conditions.

Service verification: all 22 focused service/guide tests pass; the existing phone
garage browser test passes. The extended browser flow passes in 16.4s after
scoping Activities to its dialog: all four editor fields persist, missing parts
leave money/condition untouched, garage service takes 2 Steel and 3.21d, map
printing takes 1.23d, refit takes 4.56d, and roadside readiness/consumption agree.
Empty-map and Activities help quote the same prices. Inspect all three captured
screenshots; no page errors. `npx tsc --noEmit` is clean. Full `npm test` passes
1,435 tests in 201.5s. Run changed-file Prettier; player/world-builder docs, README
and imperative Unreleased entry are updated. Ready to commit and push.

Pushed and verified `d68f434` on `backlog-implementation`. **Garage labour and
service Steel, map printing and ammunition refit rules are done.** Continue with
money gifts and bank/investment transfer limits.

### Gameplay rules — economy: money gifts and cash transfers

Before production, test `maximumMoneyGift` = 100,000,000 hundredths (1,000,000d)
and `cashTransferLimit` = 10,000,000 hundredths (100,000d). Missing save keys use
those same named defaults. Both accept integer 1–1,000,000,000 hundredths; the
upper bound remains far below unsafe integer balances. Changing the gift cap
must affect exact-decimal parsing, player form maximum/readiness and authoritative
gifts without changing online/permission/cash/overflow checks. Changing the cash
transfer cap must affect bank deposits/withdrawals and owner/outside investments
in both directions; over-cap attempts leave balances, contracts and ledger intact.
Existing balances and claims remain intact when limits fall. NPC transfer plans
and schemas must support configured limits without changing household budgets or
price validation. Keep separate property/catalogue/loan limits untouched.

Commands: `node_modules/.bin/tsx --test tests/money-transfer-rules.test.ts
 tests/player-aid.test.ts tests/outside-investment.test.ts tests/npc-finances.test.ts`,
`TEST_GPU=1 npm run test:e2e -- tests/browser/money-transfer-rules.spec.ts`, full
`npm test`, `npx tsc --noEmit`, and changed-file Prettier. Verify rule validation,
creation fields, summary and portable designs. Browser: edit/reopen both rules,
enter an over-cap gift (disabled with reason), send the exact cap, change the cap
with a drafted gift, and exercise bank and investment limits with successful
transfers and insufficient-funds/empty-return failures. Inspect screenshots and
page errors. Update PLAYING, WORLD_BUILDING, README and Unreleased.

Transfer red run: all six new tests fail for absent defaults, Unknown setting
or missing editor fields before production edits (`/tmp/aclone-transfer-red.log`).

Transfer browser verification passes in 18.8s after using the Close dialog button
for focused inputs and the actual target HUD selector. Inspect all four
screenshots; no page errors. TypeScript is clean. Focused transfers/finance tests
pass, but the unchanged 96,000-byte resident request test now fails as rules and
manual topics grow. Do not raise the budget or cut guidance. Selected manual
entries duplicate their section slug in both `id` and `source`. Add a regression
requiring source document paths without repeated anchors while preserving every
selected text, section id and title index; full `searchGuide` citations keep
anchors. Confirm it fails before compacting this redundant request metadata.

The new guide-metadata test failed on the repeated anchor as expected; compacting
only that duplicate makes both it and the unchanged request-budget test pass.
All 45 focused tests pass, including gift permission/overflow protections and
resident finance regressions. Full `npm test` passes 1,442 tests in 199.7s;
`npx tsc --noEmit` is clean. Changed-file Prettier is complete. Browser evidence
covers configured limits, an unchanged live gift draft, exact-cap payment, empty
bank failure and unearned-investment-return failure. Docs and Unreleased are
updated. Ready to commit and push the transfer-rule slice.

Pushed and verified `33996ad` on `backlog-implementation`. **Money gift and
bank/investment transfer limits are done.** Continue with parish supply-order
period and share limits.

### Gameplay rules — economy: parish supply-order timing and shares

Before production, test defaults `parishOrderPeriod` = 3,600 real seconds,
`parishOrderShare` = 0.5 (rounded-up per-supplier fraction), and
`parishOrderShareWindow` = 0.5 of the round. Period accepts integer 60–86,400;
fractions accept 0–1. Missing keys use these named defaults. A changed period
must rotate/fund orders once per current round, retire expired escrow and avoid
replaying missed rounds. Each funded round keeps its posted duration/share terms
through subsequent rule edits and reloads; new rounds use new rules. Avoid order
ID reuse when a duration change repeats a period index. Zero share permits no
early deliveries; zero share-window opens demand immediately. Reaching the
window boundary removes the share cap; stock, funded budget, location and
expiry checks still apply. Rejected deliveries are atomic.

Commands: `node_modules/.bin/tsx --test tests/procurement-rules.test.ts
 tests/procurement.test.ts`, real browser via
`TEST_GPU=1 npm run test:e2e -- tests/browser/procurement-rules.spec.ts`, full
`npm test`, `npx tsc --noEmit`, changed-file Prettier. Verify editor fields,
summary, portable designs and saved-round preservation. Browser: edit/reopen
120-second rounds, 25% early share for the first quarter; see the local terms,
deliver exactly the allowed share, see exhausted allowance, open remaining demand
at the boundary, and inspect disabled and no-current-order states. Capture and
inspect screenshots/page errors. Update PLAYING, ECONOMY, WORLD_BUILDING, README
and imperative Unreleased entry.

Supply-order red run: all five tests fail for absent defaults, Unknown setting
or missing editor fields (`/tmp/aclone-procurement-red.log`), before production.

The browser exposes a stale supply panel: only its countdown refreshed, so newly
carried goods and a newly open share window could leave delivery disabled. Keep
the failing live flow and use existing panel draft preservation to refresh
changed supply facts. Also strengthen the duration-change test: after downtime
the new round schedule must retain its phase, not reset to the global grid.
Verify a stale order ID cannot deliver into the new round and legacy round
metadata retains original half-order/half-round terms.

The extended schedule test fails by 3,480 seconds after downtime; anchor future
rounds to the previous expiry to preserve the new schedule. The browser now
passes live cargo, exact-share exhaustion, boundary reopening with draft retained,
and disabled-state checks. For its no-current-order case, expire the funded
round with no eligible public collection point, matching the normal refresh path.
Deleting the optional world record directly in a test fixture left an older
record in the client's partial snapshot; ordinary expiry retains the record and
marks it unavailable. Keep the same no-current-text/no-form assertions.

Supply-order verification: six new rule tests plus nine guide tests pass, and
the two existing procurement tests pass. The final browser flow passes in 16.5s;
the existing phone delivery flow also passes. Inspect all four final screenshots:
120-second rounds, 25% early share for 0.5 minutes, exhausted share, retained
draft at reopening, disabled state and expired/no-current state all behave as
claimed. No page errors. Full `npm test` passes 1,448 tests in 200.7s. TypeScript
and changed-file Prettier are clean. Player/economy/world-builder docs, README
and imperative Unreleased entry are updated. Ready to commit and push.

Pushed and verified `7cf24f9` on `backlog-implementation`. **Parish supply-order
period and share limits are done.** Continue with export timing/import premiums.

### Gameplay rules — economy: export shipment interval

Before production, test `exportShipmentInterval` = 1,800 real seconds, integer
60–86,400, with the same missing-key default. At 60 seconds exports must remove
real eligible cargo and credit only its settlement, once per departure. Retain
necessity reserves, catalogue price caps, the 48-departure catch-up bound and
Puddlewick/public-terminal scope. A changed interval starts a fresh interval at
the edit time; it must not reinterpret the old period counter as unprocessed
cargo departures or trigger an immediate windfall. Saving the same value must
not postpone departure. Persist the time cursor and convert legacy half-hour
cursors without replay; missing legacy cursors start at the legacy current
boundary. Failed settings edits leave schedule and rules unchanged.

Commands: `node_modules/.bin/tsx --test tests/export-rules.test.ts
 tests/economy-circulation.test.ts tests/commercial-fishing.test.ts
 tests/boathouse-tackle.test.ts`, browser
`TEST_GPU=1 npm run test:e2e -- tests/browser/export-rules.spec.ts`, full `npm test`,
clean `npx tsc --noEmit` and changed-file Prettier. Check creation field, summary,
design round-trip and changed interval across reload. Browser: F10 edit/reopen,
inspect real terminal stock/revenue before and after a scheduled shipment, then
an empty terminal with no export revenue. Inspect screenshots/page errors. Update
ECONOMY, WORLD_BUILDING, README and Unreleased. Import premiums are the next slice.

Export red run: all five new tests fail for absent default, Unknown setting or
missing editor field (`/tmp/aclone-export-red.log`), before production edits.

The 24 focused export/fishing tests and nine guide tests pass; TypeScript is
clean. The first browser check reopened the terminal before the stock snapshot
arrived, leaving its static stock row on the prior value. Retry the same
close/reopen/read flow until the snapshot is visible; preserve the exact 160-unit
and zero-stock assertions and revenue checks.

Export verification: all 24 focused export/fishing tests and nine guide tests
pass. The browser passes in 15.0s: F10 retains 60 seconds, a departure reduces
terminal Tools from 200 to 160 and credits the actual settlement, and an empty
terminal earns no export revenue. Inspect all three screenshots; no page errors.
TypeScript and changed-file Prettier are clean. Full `npm test` passes 1,453 tests
in 201.0s. Economy/world-builder docs, README and imperative Unreleased entry are
updated. Ready to commit and push.

Pushed and verified `c5d2b09` on `backlog-implementation`. **Export shipment
interval is done.** Continue with import premiums.

### Gameplay rules — economy: government import premiums

Before production, test the existing premium formula as named defaults:
`governmentImportPremium` 25%, `governmentWaterFloor` 1,000 hundredths,
`governmentBreadFloor` 10,000, `governmentFuelFloor` 4,500, and
`governmentImportBidMargin` 100 hundredths above public bids. Premium accepts
0–500%; floors integer 0–1,000,000 and bid margin integer 1–1,000,000. Missing keys
use the same defaults. Computed quotes take the maximum of the floor, premium
on public sell quotes and margin above public bids; Fuel also considers private
sell quotes. Preserve construction exclusion and existing Puddlewick shop scope.

Changing these pricing rules explicitly republishes the reserved government's
three necessity quotes. Saving unchanged values or unrelated rules must preserve
manually configured food prices. Other public/private shops, stock, ownership,
and cash remain untouched. Ordinary periodic fuel repricing and initial shop
creation use the same rule formula. Empty-shelf purchases charge the configured
published price, with existing import-cost accounting and no guaranteed resale
profit; insufficient cash is atomic. Import settlement-cost fractions and
catalogue shop prices are separate from this premium slice.

Commands: `node_modules/.bin/tsx --test tests/import-premium-rules.test.ts
 tests/government-stores.test.ts`, browser
`TEST_GPU=1 npm run test:e2e -- tests/browser/import-premium-rules.spec.ts`, full
`npm test`, clean `npx tsc --noEmit`, changed-file Prettier. Verify editor fields,
summary, validation, defaults, portable designs and reload without repricing
custom food quotes. Browser: edit/reopen all five, view published prices, buy at
the changed price from an empty shelf, and reject an unaffordable purchase without
changing cash or stock. Inspect screenshots/page errors. Update ECONOMY,
WORLD_BUILDING, README and imperative Unreleased entry.

Import-premium red run: all six tests fail for absent defaults, Unknown setting
or missing editor fields (`/tmp/aclone-import-red.log`), before production.

The initial accounting assertion included the fixture's town sales tax; remove
that fixture tax to isolate the unchanged 80% import cost. All six new rules and
nine guide tests then pass. The browser passes in 15.2s with automatic ticks
paused solely to observe an empty shelf: all five rules persist, fuel is quoted
and charged at 170d, the shop receives 34d after import costs, and a second
purchase rejects insufficient cash without changing inventory or stock. Inspect
all three screenshots; no page errors. TypeScript is clean.

Import-premium final verification: all 12 premium/government-store tests and nine
guide tests pass. Full `npm test` passes 1,459 tests in 201.0s. TypeScript and
changed-file Prettier are clean. Browser and screenshots satisfy the prices,
empty-shelf purchase and insufficient-cash criteria. Economy/world-builder docs,
README and imperative Unreleased entry are updated. Ready to commit and push.

Pushed and verified `9a299d1` on `backlog-implementation`. **Government import
premiums are done.** Continue with loan rates/terms/count/collateral, then credit
score weights.

### Gameplay rules — loan offers

Before production, turn the loan-table claim into these criteria. Keep default
personal APR exactly `10 + (850-score)/350*18` percent and mortgage APR exactly
`6 + (850-score)/350*8`, rounded as today; the quoted 10–26% personal band is
rounded at its 540-score eligibility threshold. Expose the four base/spread
percentages, 350 score span, minimum scores 540/500, offered terms
`6,12,24,36,60`, active-loan maximum 3 and mortgage LTV 0.75. Percentages accept
0–100, score span 1–1000, eligibility scores 300–850, count integer 0–100 and
LTV 0–1. Terms are a nonempty comma-separated ascending unique list of integer
months 1–120 (at most 120 entries). Zero active loans closes new lending without
affecting repayments. Missing saved fields use named defaults. Score weights
remain the next separate batch.

Verify exact default quotes; custom zero-interest quotes and amortization;
changed eligibility, count, LTV and terms; atomic malformed settings and stale
quote rejection; existing signed APR/payment/term and collateral persistence;
new-world/editor/summary/design/reload parity; and resident plans using an offered
term if 12 is removed. Run `node_modules/.bin/tsx --test tests/loan-rules.test.ts
 tests/loans.test.ts tests/npc-guide.test.ts`, `TEST_GPU=1 npm run test:e2e --
 tests/browser/loan-rules.spec.ts tests/browser/bank.spec.ts`, full `npm test`,
`npx tsc --noEmit` and changed-file Prettier. Browser: edit and reopen all offer
rules in F10, view custom terms, accept a zero-interest loan, see a second loan
refused by the one-loan limit, repay, see an empty-capital rejection, and see
zero-count lending disabled while existing loans remain repayable. Inspect
screenshots and page errors. Update ECONOMY, WORLD_BUILDING, README and Unreleased.

Loan-offer red run: all six tests fail for absent defaults, Unknown setting or
missing editor controls (`/tmp/aclone-loan-rules-red.log`), before production.

The resident regression fails specifically when 12 months is removed; choose the
nearest offered term (9 from 9/18) and carry that term into the actual operation.
The persistence assertion now compares the serialized loan representation:
JSON omits an undefined optional collateral property; every stored value remains
asserted. The planner assertion checks its typed `operation` step rather than an
`act` step; it still requires the actual borrowed term to be 9.

Loan browser verification: both the existing bank flow and new loan-rules flow
pass (38.3 seconds total). All ten editor controls persist; a 90d, three-month
loan at zero APR pays 30d monthly; one-loan/zero-loan limits reject new offers;
repayment succeeds while lending is closed; empty capital rejects. Inspect all
four screenshots; no page errors. Updated Economy/world-builder docs, README
and imperative Unreleased entry.

Loan-offer final verification: all seven new tests, nine guide tests and existing
loan tests pass. Full `npm test` passes 1,466 tests in 204.1 seconds. TypeScript
and changed-file Prettier are clean. Both bank browser flows and inspected
screenshots pass the criteria. Signed mortgage terms and liens also survive
settings changes and a Store reload. Ready to commit and push.

Pushed and verified `72cda6a` on `backlog-implementation`. **Loan offer rules are
done.** Continue with credit-score weights.

### Gameplay rules — credit-score weights

Before production, preserve the existing score table as named defaults: minimum
300, maximum 850, starting score 550; history 3/month capped at 60; on-time
repayments 6 each capped at 120; observed employment up to 60; one asset point
per 50,000 hundredths capped at 35; late/default penalties 25/100 capped together
at 220; debt ratio ×100 capped at 100 with a denominator floor of 10,000
hundredths. Expose all 16 values in a Credit score fieldset, summary, creation,
portable designs and resident world rules. Point values/bounds accept integer
0–1,000; currency divisors integer 1–100,000,000. Require minimum ≤ starting ≤
maximum. Missing keys preserve defaults. Rate distance uses the configured score
maximum; bank score/explanation and rule descriptions show the actual bounds.

Test exact default and custom scores with recorded history, employment, assets,
late/default events and debt; each cap, zero-weight disabling, lower/upper score
clamps, invalid atomic edits, reload/design parity, and updated quotes without
rewriting signed loans or credit records. No invented credit history or balance
changes. Browser: edit/reopen all weights; show 700/900 and the corresponding
20.29% APR with zero weights; accept a loan, lower the starting score to 400,
show borrowing refusal while the existing signed rate persists, then repay.
Attempt minimum above maximum and verify rejection without server mutation.
Run `node_modules/.bin/tsx --test tests/credit-rules.test.ts tests/loan-rules.test.ts
 tests/npc-guide.test.ts`, affected bank browser flows, full `npm test`,
`npx tsc --noEmit`, changed-file Prettier; inspect screenshots/errors and update
ECONOMY, WORLD_BUILDING, README and imperative Unreleased.

Credit-score red run: all five tests fail for missing defaults, Unknown setting
or absent controls (`/tmp/aclone-credit-red.log`), before production changes.

All score/loan tests passed, but adding the 16 rules exceeded the resident's
existing 96,000-byte request limit. Preserve the limit, notebook, memory, all
manual text, citations and lookup topics. A new red test requires every manual
heading and exact lookup ID in a keyed topic index. Replace repeated
`{id,title}` objects with `{id: title}` entries, preserving the whole index;
update existing assertions only for that representation, retaining their
content/citation/uniqueness assertions. No guidance or test limits are cut.

Credit-score verification: all 22 focused rules/guide tests pass, including the
unchanged request budget and full topic-index conservation test. The existing
loan-rules browser passes in 18.6s; the credit-rules browser passes in 16.7s.
All 16 editor values persist; the bank shows 700/900 at 20.29% APR; changing to
400 rejects borrowing while preserving the signed rate/payment; repayment works;
invalid score bounds reject atomically. Inspect all four screenshots; no page
errors. Documentation and imperative Unreleased entry are updated.

Credit-score final gates: full `npm test` passes 1,472 tests in 200.1 seconds;
all 22 focused tests pass after docs updates, TypeScript is clean, and Prettier
has been run on every changed file. Browser flows and inspected screenshots
satisfy score display, new APR, refusal, repayment and invalid-bound criteria.
Ready to commit and push.

Pushed and verified `f9851bc` on `backlog-implementation`. **Credit-score weights
are done.** Continue with lighthouse wage and boat-service defaults/escrow rules.

### Gameplay rules — lighthouse keeper wage cap

Before production, expose the claimed 8d/game-day cap as `lighthouseWageCap`,
default 800 hundredths, integer 0–1,000,000. Use one effective-wage calculation
for payouts, building-admin clamps, jobs command, building UI and resident
observations. Editing the cap alone preserves the building's posted wage;
raising it permits a higher owner-configured wage. Zero caps keeper pay at zero
without removing employment/quarters. Keep taxes, daily scheduling, the separate
4d private-owner allowance and ordinary factory wages unchanged.

Test missing-key defaults, lower/higher/zero caps, admin edits, actual payments
and taxes, inactive shifts/no keeper, filled-job failure, ordinary wage isolation,
summary/editor/design/reload and live resident quotes. Commands:
`node_modules/.bin/tsx --test tests/lighthouse-rules.test.ts tests/lighthouse.test.ts
 tests/npc-guide.test.ts`, `TEST_GPU=1 npm run test:e2e --
 tests/browser/lighthouse-rules.spec.ts`, full `npm test`, clean
`npx tsc --noEmit`, changed-file Prettier. Browser: F10 cap 321 persists, lighthouse
quotes 3.21d, take the job and receive exactly that gross wage on a local test
cycle; cap zero shows 0d and pays nothing while quarters remain available; filled
job is unavailable to another player. Inspect screenshots/errors. Update
PLAYING, WORLD_BUILDING, README and imperative Unreleased.

Keeper-cap red run: all five tests fail for absent defaults, Unknown setting or
missing editor field (`/tmp/aclone-keeper-red.log`), before production.

Browser failure: the actual keeper button is rendered then hidden by the shared
job-visibility filter, which excludes all building owners and anyone already
employed. This conflicts with existing supported lighthouse owner-hiring and
renewal. A new unit regression fails on owner visibility before the fix. Apply
the lighthouse exception in that filter only; retain ordinary owner-job,
other-employment and jobs-disabled restrictions, with filled places visible but
disabled by the existing blocker. Keep all original browser assertions.

Keeper browser now passes in 20.6s. The editor retains 321; the owner can take
and renew the keeper job; the panel and cash HUD show exactly 3.21d; a visitor
sees a disabled filled-job button; a zero cap pays nothing and keeps quarters
available. The local fixture pauses autonomous ticks and advances two explicit
daily cycles so gross pay and the separate 4d owner allowance are exact. Inspect
all four screenshots; no page errors. Update player/world-builder docs, README
and imperative Unreleased entry.

The first full keeper run has 1,477 passes and one cancellation: the unchanged
slow compressed TCP integration test hits its 45-second timeout under the full
suite (`/tmp/aclone-keeper-full.log`). No deadline or assertion is changed.
The isolated test then passes in 33.9 seconds with maximum state age 0.95s,
18 slow frames and 134 fast frames (`/tmp/aclone-keeper-network.log`). Retry the
full suite unchanged before declaring this slice done.

The unchanged default-concurrency retry also times out the abrupt-kill durability
and delayed-input network tests, alongside the slow-link test. The machine load
rose to 24; this is broader than the keeper flow. Run the same full `npm test`
with `--test-concurrency=2` to reduce unrelated CPU contention. Keep every test,
assertion, link rate and timeout unchanged; do not change package scripts. The
isolated slow-link result remains the strict latency check.

The appended npm argument did not control Node concurrency: inspection showed
more than two child test processes. Stop that incorrectly configured attempt.
Use the exact test-script command with the option before the files:
`node_modules/.bin/tsx --test --test-concurrency=2 tests/*.test.ts`.
This runs the entire npm test suite with unchanged assertions and deadlines;
only parallel scheduling differs. No repository test script is modified.

Keeper final gates: the entire unchanged test suite passes all 1,478 tests with
two concurrent files in 371.0 seconds. The previously timed-out durability,
delayed-input and slow-link tests pass in 11.8s, 8.0s and 33.9s respectively under
their original deadlines. All 26 focused tests pass; TypeScript is clean and
changed-file Prettier has been run. Browser criteria and inspected screenshots
pass. Default-concurrency failures remain recorded above; no test, deadline,
package script or acceptance criterion was weakened. Ready to commit and push.

Pushed and verified `51005f5` on `backlog-implementation`. **Lighthouse keeper
wage cap is done.** Continue with charter/tug fee defaults and escrow limits.

### Gameplay rules — charter offer terms

Before production, expose the existing charter economics: default fare 7,500
hundredths (75d), maximum fare 100,000 (1,000d), default duration 60 minutes,
minimum/maximum duration 15/180 minutes, maximum outstanding offers 16, and
return-request cooldown 60 seconds. These are seven rules. Fare/default ceiling
accept integer 0–100,000,000; durations integer 1–1,440 minutes; outstanding
offers integer 0–100; cooldown integer 0–3,600 seconds. Validate default fare ≤
maximum fare and minimum duration ≤ default duration ≤ maximum duration. Missing
keys retain named defaults. Apply to new offers, UI defaults/limits and request
throttling; keep complete fare escrow, proportional early settlement, full
cancellation refunds and idempotence as money-conservation invariants.

Issued offers and accepted tickets retain agreed prices/durations after edits
and reloads. The elapsed-time cap must accommodate all accepted ticket durations,
including a longer trip after lowering the rule maximum; it must also allow new
trips longer than the old three-hour cap. Zero maximum outstanding offers stops
new invitations but preserves existing offers/tickets. No autonomous resident
charter purchases are introduced. Use one source for the panel and main handler's
fallback values, and include rules in creation/editor/summary/design and live
resident rules.

Test defaults, missing keys, bounds/atomic invalid changes, maximum outstanding
offers, insufficient passenger funds, changed return cooldown, old terms through
reload and lower limits, long-trip settlement, cancellation/repeat-refund
conservation. Commands: `node_modules/.bin/tsx --test tests/charter-rules.test.ts
 tests/charter.test.ts tests/npc-guide.test.ts`; browser
`TEST_GPU=1 npm run test:e2e -- tests/browser/charter-rules.spec.ts
 tests/browser/charter-tuning.spec.ts`; full npm test suite (two concurrent files
if needed for the documented machine contention), TypeScript and changed-file
Prettier. Browser: edit/reopen seven rules, verify fare/duration defaults and
limits, empty shore, invite a passenger, reject unaffordable acceptance, accept
an affordable offer with exact held fare, reject an extra invitation at the
configured count, then cancel/refund once. Inspect screenshots and page errors;
update charter/player/world-builder docs, README and imperative Unreleased.

Charter red run: all five tests fail on absent rules/defaults/editor controls
(`/tmp/aclone-charter-rules-red.log`), before production changes.

The extra elapsed-time regression fails before its fix: a two-hour trip with a
15-minute ticket rewinds to 1,800 seconds when the new-offer maximum is reduced
to 30 minutes (expected 7,200). Preserve accumulated time in the cap calculation;
keep accepted long-ticket coverage and full settlement assertions unchanged.

Both browser flows pass (28.2s for local charter rules, 25.5s for vehicle tuning).
Inspect all five charter screenshots: all seven editor fields persist, empty
shore is explained, an extra invitation is refused, insufficient cash rejects,
and an affordable fare is held then refunded exactly once. No page errors.
Update charter/player/world-builder docs, README and imperative Unreleased entry.

Charter final gates: all 27 focused tests pass. The entire npm test suite passes
1,484 tests in 310.1 seconds with two concurrent files. TypeScript is clean and
Prettier has been run on all changed files. Both browser flows and inspected
screenshots meet the criteria. The extra elapsed-time regression passes without
changing settlement or weakening any test. Ready to commit and push.

Pushed and verified `0816091` on `backlog-implementation`. **Charter offer rules
are done.** Continue with tug rescue offer/escrow limits.

### Gameplay rules — tug rescue offers

Before production, expose `towDefaultFee` 20,000 hundredths (200d),
`towMaximumFee` 10,000,000 hundredths (100,000d) and `towOfferSeconds` 600 real
seconds. Fees accept integer 0–100,000,000 with default ≤ maximum; expiry accepts
integer 1–86,400 seconds. Missing keys preserve defaults. Use these for the
Inventory fee form and authoritative new offers. Preserve full fee escrow on
acceptance, full cancellation refunds, one-time delivery payment, free self
recovery, and existing physical tow/refuelling/death mechanics. Escrow fractions
are conservation invariants, not tunable money-loss or duplication switches.

Capture expiry in each new offer so rule edits do not change posted terms.
Legacy offers without expiry retain the old 600-second lifetime, independent of
new world limits. Preserve the old boundary: valid at the exact expiry, expired
afterward. Reject expired acceptance even between maintenance ticks, without
charging cash. Maintenance removes expired unaccepted offers; accepted jobs never
expire. Fee/expiry edits and Store reloads preserve issued terms and held money.

Tests: default/missing-key parity, local fees/ceiling/expiry, zero-fee offers,
atomic invalid patches and unaffordable acceptance, exact/late expiry, legacy
fallback, agreed terms after lower limits and reload, no accepted-job expiry,
repeat cancellation/delivery conservation, free self recovery, creation/editor/
summary/portable-design parity. Commands: `node_modules/.bin/tsx --test
 tests/towing-rules.test.ts tests/towing.test.ts tests/npc-guide.test.ts`,
`TEST_GPU=1 npm run test:e2e -- tests/browser/towing-rules.spec.ts`, entire npm
test suite with documented two-file scheduling, TypeScript and changed-file
Prettier. Browser: edit/reopen three rules; see no stranded candidates; add a
local stranded test captain, see custom fee/default maximum, reject insufficient
cash, accept with exact held funds, cancel/refund, then expire another offer and
show the empty agreement state. Inspect screenshots/errors. Update HAULAGE,
PLAYING, WORLD_BUILDING, README and imperative Unreleased before committing.

Tow red run: all six new tests fail before production. Five report missing
rules/defaults/editor fields; the separate default-expiry regression reports
“Missing expected exception” because acceptance currently permits an offer older
than 600 seconds before maintenance runs (`/tmp/aclone-tow-rules-red.log`).

The first tug browser flow passes in 29.8 seconds. Screenshot review finds the
empty-list explanation below the viewport, so require it to be scrolled into
view and capture notices at full opacity. The rerun catches a DOM replacement
during scrolling, not a state mismatch. Retry that same scroll-and-viewport
assertion across the live snapshot redraw; keep every original economic and
expiry assertion unchanged.

The stronger browser flow now passes in 34.0 seconds. Inspect all five states:
three saved editor fields, visible empty-candidate explanation, visible cash
refusal without charge, exact 10d held with no tug payment, and expired offer
removed with cash intact. Cancellation refunds once and its button disappears.
No page errors. All 22 focused tests pass after documentation updates; update
HAULAGE, PLAYING, WORLD_BUILDING, README and imperative Unreleased.

Tug final gates: the entire npm test suite passes all 1,490 tests in 315.7
seconds with two concurrent files; all 22 focused tests pass. TypeScript is clean,
changed-file Prettier is complete, and the browser plus inspected screenshots
meet the criteria. No economic assertions or deadlines were weakened. Ready to
commit and push.

Pushed and verified `616d5a1` on `backlog-implementation`. **Tug rescue offer rules
are done.** Continue with resident household reserves and budget constants.

### Gameplay rules — resident household forecast

Before production, expose four household forecasting constants:
`npcHouseholdSeconds` 21,600 real seconds (integer 60–604,800),
`npcBudgetNeedAllowance` 15,000 need units (integer 0–1,000,000),
`npcBudgetCarriedShare` 0.5 (fraction 0–1), and `npcBudgetFuelThreshold` 8 tank
units (0–1,000,000). Missing settings retain the defaults. The ordinary household
reserve uses the configured horizon; explicit trip/long-term horizons still take
precedence. The need allowance and carried nutrition share affect estimated
replacement purchases, not actual feeding or inventory. A low tank with no
carried fuel reserves one quoted Fuel purchase; fuel threshold zero disables
that reserve. Preserve perceived-market quotes, fallback catalogue prices,
owned-house/valid-room eligibility, stocked pantry deductions and rent accounting.
Daily replacement-cost comparisons remain exactly one real day, using the same
need baseline and excluding fuel purchases at every configured threshold.

Test exact default and custom forecasts, explicit horizons, carried credit at
zero/one, low-fuel boundaries, full pantry, missing suppliers/catalogue fallback,
expired rooms and no mutation/grants; verify reserve changes feed into optional
spending. Validate atomic bad edits and creation/summary/editor/design/reload
parity. Commands: `node_modules/.bin/tsx --test tests/npc-household-rules.test.ts
 tests/npc-household.test.ts tests/npc-guide.test.ts`, browser
`TEST_GPU=1 npm run test:e2e -- tests/browser/npc-household-rules.spec.ts`, entire
npm test suite, TypeScript and changed-file Prettier. Browser: edit/reopen all
four fields, observe the local fixture's reserve change from the actual server
calculation, and reject an out-of-range fraction without changing saved rules.
Inspect screenshot/errors. Update WORLD_BUILDING, NPCS, README and imperative
Unreleased. Further cash floors, strategic horizons, portable reserves and
business budget rules remain subsequent slices; server AI dollar budgets are
operational controls, not gameplay currency rules.

Code inspection also found that household/homecoming forecasts repeat 0.8 despite
the existing `homeNeedsMultiplier` rule already governing actual survival. Before
production, add regressions for that existing rule at zero and one, including
zero-rate readiness without NaN and changed pantry-shopping quantities. Reuse
`homeNeedsMultiplier(w)` in these forecasts; do not add a second shelter setting.

Household red run: correct the fixture's nonexistent store/inn catalogue IDs to
market/hotel, then confirm all six tests fail for absent rules or editor controls,
and the existing shelter-rule mismatch (forecast 300 instead of 0 with shelter
consumption disabled). No production edits precede this run.

The first household browser run confirms saved values and native out-of-range
refusal, then fails because closing/reopening intentionally preserves an unsaved
invalid draft. Keep the exact saved-value assertion and reload the page before
checking it. This tests the authoritative saved value without changing editor
draft-preservation behavior or removing the refusal check.

Household browser passes in 19.3 seconds: all four controls persist; the local
fixture's actual server forecast changes from 800 to 300 hundredths without
changing cash or inventory; an invalid 1.1 fraction displays native range refusal,
and reload restores the saved 1.0. Inspect both screenshots; no page errors.
All 21 focused tests pass after docs changes; TypeScript and changed-file
Prettier are clean. NPC/world-builder docs, README and imperative Unreleased
are updated. Run the full suite before committing.

The full household run passes 1,495 tests but cancels the unchanged slow compressed
TCP integration test at its 45-second deadline (581.4 seconds total). Machine
load averages were 13.70/12.64/8.11 despite two-file scheduling. No test or deadline
is changed. Run that test alone to distinguish a reproducible network failure
from contention before deciding whether the completion gate can be met. Do not
commit this slice or begin the next while the full-suite gate is unresolved.

The isolated slow-link test passes in 37.8 seconds with maximum state age 0.95s,
18 slow frames and 134 fast frames. Retry the entire unchanged npm test suite with
one concurrent file (`node_modules/.bin/tsx --test --test-concurrency=1
 tests/*.test.ts`) to reduce contention further. Preserve all tests, deadlines,
link rates and acceptance assertions; do not alter the package script.

Household final gates: all 1,496 tests pass in the serial full-suite run (967.2
seconds). The slow-link test passes in 36.5 seconds under its original 45-second
deadline, with maximum state age 1.19 seconds. All 21 focused tests pass; TypeScript,
changed-file Prettier, browser criteria and inspected screenshots are clean.
The earlier timeout and isolated result remain recorded above; no tests, limits,
deadlines or package scripts were changed. Ready to commit and push.

Pushed and verified `c6f2227` on `backlog-implementation`. **Resident household
forecast rules are done.** Continue with cash and portable-supply reserves.

### Gameplay rules — resident cash and portable reserves

Before production, expose four cash rules: `npcCareCashFloor` 12,000 hundredths,
`npcBankCashFloor` 40,000, `npcBankDepositShare` 0.5 and
`npcBankMinimumDeposit` 1,000 hundredths. Currency values accept integer
0–100,000,000 and share 0–1. Cash floors take the maximum with the computed
household reserve; all transfers remain capped by the existing world cash limit
and actual balances. Zero share disables saving deposits, not withdrawals; zero
minimum must never create a zero-value action. Planning never grants cash.

Expose seven portable-supply rules: `npcPortableWater` 6, `npcPortableBread` 3,
`npcPortableMinimum` 3, `npcPortableMaximum` 12, `npcPortableNutrition` 24,000
need units, `npcPortableEquipment` 1 per listed tool/tackle/Fuel item, and
`npcFishingSurplus` 3 fish above the reserve. Counts accept integer 0–100;
nutrition integer 0–1,000,000; require minimum ≤ maximum. Water/bread retain their
specific counts; other nutrition uses the catalogue value and clamped ceiling of
target/value. Non-provisions stay unreserved. Fishing still respects actual
cargo capacity, and sales/unloading keep the same configured reserves. Zero is
supported without granting supplies or bypassing storage/ownership/stock checks.
Defaults and absent keys preserve old behavior.

The existing `transactionItemLimit` must also cap stranded-cargo actions; its
current private 10,000 copy can produce rejected recovery plans in edited worlds.
Add a failing small-limit regression, then reuse the existing rule and prove
repeated bounded recovery actions can make walking possible while keeping the
configured provisions. Do not change physical carry capacities in this slice.

Tests: default and custom care/bank plans; zero/minimum/share boundaries; actual
ordinary transfer conservation; changed household reserve and existing transfer
cap; portable item classes, min/max, fishing cutoff, surplus sales and bounded
stranded recovery; atomic invalid settings, missing fields, editor/summary/design/
reload parity. Commands: `node_modules/.bin/tsx --test tests/npc-reserve-rules.test.ts
 tests/npc-cargo.test.ts tests/npc-household.test.ts tests/npc-guide.test.ts`, browser
`TEST_GPU=1 npm run test:e2e -- tests/browser/npc-reserve-rules.spec.ts`, whole npm
test suite (serial if contention persists), TypeScript and changed-file Prettier.
Browser: edit/reopen all eleven, observe resulting local plan quantities and
reserved supplies through the server calculations, reject inverted reserve bounds
atomically, reload to verify saved values. Inspect screenshots/errors; update
NPCS, WORLD_BUILDING, README and imperative Unreleased. Strategic horizons and
business budgets remain subsequent slices.

The existing opportunistic trade reserve differs from unloading: `spareSupplies`
keeps one food or two drink items, while cargo recovery uses the larger portable
reserve. Preserve that distinction with `npcTradeFoodReserve` 1 and
`npcTradeDrinkReserve` 2 (integer 0–100), bringing this batch to thirteen fields.
Test both defaults and changed values rather than unifying them and changing
shipped behavior. Surplus unloading also caps its ordinary trade/stock action by
the existing transaction limit; test that bounded plan separately.

Reserve red run: all eight tests fail before production for missing defaults,
Unknown setting or absent editor controls. Existing small-limit regressions also
fail directly: stranded recovery proposes more than five items and surplus sale
proposes 20 instead of the configured five (`/tmp/aclone-reserves-red.log`).

All 28 focused tests pass. The browser passes in 33.1 seconds: thirteen values
persist, planned savings change from 30,000 to 20,000 hundredths, configured
portable reserves are used without inventory/cash changes, and inverted min/max
reject atomically with a visible reason. Inspect all three screenshots; no page
errors. Typecheck identifies fixture typing only: resources are a record, not an
array, and recovery assertions must narrow quantity-bearing actions. Correct
those fixture types without changing expected outcomes, then rerun gates.

Final reserve browser rerun passes in 35.8 seconds after explicitly narrowing the
bank action in the fixture; inspect all three screenshots again. TypeScript is
clean. The full unchanged npm test suite is running serially to avoid the earlier
host-contention timeout. Do not commit or begin the next slice until it passes.

Henry requests relevant-test selection instead of repeating the full suite. Stop
the serial run intentionally after 846 passing checks; this is not a full-suite
pass. Replace that completion gate with the changed reserve tests, household and
guide checks, and existing direct-consumer tests for care, cargo, strategy, bank
choices and business policy. Run the twenty selected test files with
`node_modules/.bin/tsx --test --test-concurrency=2`, recorded in
`/tmp/aclone-reserves-relevant.log`. The global protocol above now governs later
slices; browser, TypeScript and formatting requirements remain in force.

Relevant reserve gate: all 166 tests pass in 54.9 seconds. The explicit command is:

```sh
node_modules/.bin/tsx --test --test-concurrency=2 \
  tests/npc-reserve-rules.test.ts tests/npc-cargo.test.ts \
  tests/npc-household.test.ts tests/npc-guide.test.ts \
  tests/npc-business-policy.test.ts tests/npc-business-continuity.test.ts \
  tests/npc-owner-recovery.test.ts tests/npc-strategy.test.ts \
  tests/npc-finances.test.ts tests/npc-prosperity.test.ts \
  tests/npc-audit.test.ts tests/npc-circulation.test.ts \
  tests/economy-recovery.test.ts tests/money-transfer-rules.test.ts \
  tests/staffing.test.ts tests/intoxication.test.ts tests/captain.test.ts \
  tests/survival-needs.test.ts tests/business-health.test.ts \
  tests/business-management.test.ts
```

TypeScript, changed-file formatting and the browser criteria pass. No production
change followed those checks. Ready to commit and push this slice.

Pushed and verified `d7b003b` on `backlog-implementation`. **Resident cash and
portable reserve rules are done.**

### Gameplay rules — resident strategic horizon and pantry buffer

Before production, add `npcStrategicSeconds` (86,400 real seconds, integer
60–604,800) and `npcPantryBufferSeconds` (900 real seconds, integer 0–86,400) to
Resident household budget. The first governs existing one-day reserves for
property, construction, business procurement/withdrawals, ambitions and household
provisioning; the second is the existing extra pantry/housing coverage. Ordinary
household forecasts keep their separate rule. Explicit absence lengths still
apply, with housing protecting the greater of the strategic horizon and the
absence plus buffer. Fixed daily replacement-cost comparisons remain 86,400
seconds; career review timers are outside this budget slice.

Completion criteria: defaults and absent keys preserve results; changed horizons
alter actual protected cash, owner draws and procurement execution guards in
agreement; home provisioning and career completion use the same horizon; zero
buffer permits exact coverage but never counts a missing home as stocked;
explicit longer absences still require coverage. Changing rules grants no cash,
stock or shelter. Replace the fixed "a day" pantry-plan text with the configured
horizon. Both fields validate atomically, appear in summaries/editor/observations,
and survive design export/import and storage reload.

Commands: red then green `node_modules/.bin/tsx --test
 tests/npc-planning-rules.test.ts`; relevant regressions include npc-household-rules,
npc-household, npc-housing, npc-construction, npc-business-policy,
npc-business-continuity, npc-prosperity, npc-finances, npc-circulation and npc-guide.
Run them with the same runner, two files concurrently. Browser command:
`TEST_GPU=1 npm run test:e2e -- tests/browser/npc-planning-rules.spec.ts`.
Browser: F10 → Rules, edit/reopen both fields, verify the fixture's actual server
owner draw changes from 2,400 to 300 hundredths without changing balances;
verify a zero buffer at the coverage boundary, reject a horizon below 60, reload
and inspect the saved values, screenshots and page errors. Finish with clean
`npx tsc --noEmit`, changed-file Prettier, NPCS/WORLD_BUILDING/README and imperative
Unreleased updates. No full-suite run is planned under Henry's revised policy.

Planning red run: all seven tests fail before production. Exact failures include
2,400 versus 300 for a shortened owner/housing reserve, a 100 versus 0 procurement
draw, false versus true at zero-buffer exact coverage, an unnecessary one-day
pantry errand and missing defaults/editor fields (`/tmp/aclone-planning-red.log`).

Planning gates: all seven new tests and 83 relevant regression tests pass (90
checks in 11.1 seconds). Browser passes in 19.2 seconds: both fields persist, the
owner draw changes from 2,400 to 300 without a transfer, exact 7,500-second home
coverage accepts zero buffer, and native validation rejects 59 seconds. Reload
restores the saved values. Inspect both screenshots; no page errors. TypeScript,
changed-file Prettier and diff checks are clean; update NPCS, WORLD_BUILDING,
README and imperative Unreleased. Ready to commit and push.

Pushed and verified `42eba20` on `backlog-implementation`. **Resident strategic
horizon and pantry buffer rules are done.**

### Gameplay rules — resident business input buffers

Before production, expose six related stock-budget rules under Resident business
budgets: `npcInputReserveBatches` 6 and `npcInputMaximumBatches` 24 (integer
0–1,000, reserve ≤ maximum), `npcInputSalesHours` 2 (0–168),
`npcOutputCapacityShare` 0.75 (0–1), `npcOutputMinimumBatches` 12 (integer
0–1,000), and `npcOutputBufferMultiplier` 2 (0–10). Keep actual per-hour sales
measurement as a time unit. Use the reserve-batch rule for the existing fallback
input and acquisition budgets; payroll multiples are a separate following slice.

Defaults/absent keys preserve six-to-24 batches, two hours of measured sales and
backlog cutoff at the lesser of 75% capacity and the larger of 12 or twice the
planned output batches. Changed rules alter targets, input cash budgets,
procurement bounds and ordinary bid pause/reopen decisions. Physical output room
and input storage capacity still bound every target. Farms retain their manual
policy; breeding-animal minimums remain catalogue requirements. Zero target or
zero backlog threshold stops automatic input buying without creating stock.
Negative/fractional count values and inverted min/max reject atomically. Editor,
summary, observations, designs and reloads carry all six fields.

Tests: red/green `node_modules/.bin/tsx --test tests/npc-input-buffer-rules.test.ts`;
regressions `tests/npc-business-continuity.test.ts`, `tests/npc-owner-recovery.test.ts`,
`tests/npc-business-policy.test.ts`, `tests/npc-prosperity.test.ts`,
`tests/npc-construction.test.ts`, `tests/npc-finances.test.ts`,
`tests/npc-planning-rules.test.ts` and `tests/npc-guide.test.ts` with the same
runner, concurrency two. Browser: `TEST_GPU=1 npm run test:e2e --
 tests/browser/npc-input-buffer-rules.spec.ts`; edit/reopen six fields, observe a
known factory's server input target change, test a zero target and invalid joint
bounds, reload saved values and inspect screenshots/page errors. Finish TypeScript,
changed-file Prettier, NPCS/WORLD_BUILDING/README and Unreleased documentation.

Input-buffer red run: all six tests fail before production. Observed differences
include target 12 versus 4, zero target still 12, unchanged cash reserve 2,400
versus 1,600, a bid raised to 200 instead of paused at zero, and missing settings/
editor fields (`/tmp/aclone-input-buffer-red.log`).

Correct two fixture assumptions exposed after the new behavior passes: give the
dairy two cattle so it actually needs water, and assert the established pause
representation (no active bid, preserved paused price 100) rather than an active
zero price. Preserve the required pause/reopen and breeding checks. All six new
tests then pass; all 79 relevant checks pass in 7.0 seconds. Browser passes in
21.0 seconds with six saved fields, target 12 → 4 → 0, unchanged stock/cash, and
atomic inverted-bound refusal. Inspect all three screenshots; no page errors.
TypeScript, changed-file Prettier and diff checks pass. Documentation and
Unreleased are updated. Ready to commit and push.

Pushed and verified `0eba6af` on `backlog-implementation`. **Resident business
input-buffer rules are done.**

### Gameplay rules — resident working capital and startup budgets

Before production, add nine fields to Resident business budgets:
`npcPayrollReserveBatches` 6 and `npcMinimumPayrolls` 3 (integer 0–1,000),
`npcBusinessCashFloor` 2,000 and `npcPropertyOperatingReserve` 20,000 hundredths
(integer 0–100,000,000), `npcStartupBatches` 3 (integer 0–1,000),
`npcStartupMaterialMultiplier` 1.1 (1–10), `npcHayReserveItems` 40,
`npcHayCustomerStockLimit` 40 and `npcHayCustomerFundedItems` 10 (integer
0–10,000). Keep distinct hay ownership and customer thresholds despite their
matching old defaults. Payroll cycles govern operating and acquisition reserves;
minimum payrolls govern minimum bid funding, non-production reserves and funded
peer-wage references. Property fallback reserve, startup operating batches and
material contingency use their corresponding rules. Farm seed/harvest costs,
actual quotes, investor claims and ordinary ownership/transaction checks remain.

Default/absent-key tests must retain exact existing reserves. Changed values must
alter actual production/acquisition, retained capital, property affordability,
construction estimates, hay funding/restocking and customer selection. Zero
reserves are supported, but a zero rule grants no money or goods. Bound hay
purchase/deposit plans by the existing transaction limit as well as real capacity;
prove a low-limit ordinary plan executes. Validate all nine fields, include them
in editor/summary/observations/designs/reloads, and keep documents' quoted counts
labelled as defaults of the relevant rule.

Commands: failing-first `node_modules/.bin/tsx --test
 tests/npc-working-capital-rules.test.ts`; relevant tests are npc-input-buffer-rules,
npc-business-policy, npc-business-continuity, npc-owner-recovery, npc-prosperity,
npc-finances, npc-construction, npc-hay, npc-planning-rules and npc-guide (same
runner, concurrency two). Browser `TEST_GPU=1 npm run test:e2e --
 tests/browser/npc-working-capital-rules.spec.ts`: save/reopen all nine fields,
observe a local actual retained-capital change, exercise zero reserves and native
refusal below the material multiplier's minimum, reload saved values and inspect
screenshots/errors. Require clean TypeScript, changed-file Prettier, relevant docs
and imperative Unreleased. Bid pricing, loan-affordability and remaining household
shopping cash budgets follow before construction world rules.

Pre-production inspection corrects one mistaken criterion above: the 20,000
property fallback is unreachable in both economyChoices and enterpriseChoices.
Each loop requires a non-farm production recipe and skips unknown recipes before
calling productionBudget, which consequently returns a reserve. Ordinary markets
are not candidates in that loop. Do not add a setting with no live effect or add
new market acquisition behavior. Keep the affordability regression, using a real
production reserve and checking that ordinary markets remain excluded. Omit
`npcPropertyOperatingReserve`; this slice has eight active rules. All other
criteria remain. The inactive legacy fallback can remain without a new rule.

Working-capital red run: all eight tests fail before production, including the
corrected production-affordability check. Failures show payroll reserve 2,400
instead of 1,600, startup operating capital 27,612 instead of 9,204, hay quantity
40 instead of 5, and the independent transaction-limit failure 40 instead of 3.

Working-capital gates: all eight new tests and 82 relevant regressions pass (90
checks in 7.1 seconds). Input-buffer and working-capital browser flows both pass
(20.8/16.4 seconds); the final working-capital rerun after help text/formatting
passes in 19.6 seconds. Eight settings persist; retained capital changes
2,000 → 400 → 0 without transfers; below-one material contingency is refused and
saved values survive reload. Inspect the controls, refusal and updated help text;
no page errors. Correct an action-union narrowing in the test helper, rerun its
eight tests and confirm clean TypeScript. Prettier and diff checks pass. Relevant
docs and Unreleased are updated; no full suite is run. Ready to commit and push.

Pushed and verified `5cd6b3b` on `backlog-implementation`. **Resident working
capital and startup budget rules are done.**

### Gameplay rules — resident pricing and affordability

Before production, expose eleven live policies in a separate Resident pricing
fieldset: `npcHaulageMargin` 0.08 (fraction 0–1), `npcTravelTimeValue` 5
hundredths/second (0–10,000), `npcInputMinimumAllowance` 100 hundredths
(integer 0–1,000,000), `npcMaximumInputBid` 10,000,000 hundredths (integer
0–10,000,000, bounded by the existing price validator), `npcBidReopenFraction`
0.5 and `npcWageMarginShare` 0.8 (fractions 0–1),
`npcProductionPriceMultiplier` 1.05 (1–10), `npcSurplusMinimumStock` 12
(integer 0–100,000), `npcSurplusCapacityShare` 0.25 (0–1),
`npcPricingMinimumLoad` 6 and `npcPricingMaximumLoad` 1,000 (integer
1–100,000; minimum ≤ maximum).

Defaults and missing keys preserve delivered quotes, sustainable asks and surplus
markdowns. Share the haulage margin/time valuation between input and output quotes;
keep the input-only minimum allowance distinct. Use the existing minimumBuyPrice
for new and remembered input bids instead of the private 100 copy. A planned bid
must fit the configured ceiling; zero ceiling suppresses quotes, without changing
already-posted bids or contract prices. Estimate one load within transactionItemLimit
and physical/funded storage bounds. Zero reopening fraction disables automatic
reopening/raising; zero wage share cannot raise wages and never cuts an existing
wage. Sustainable asks retain input/payroll/tax coverage. Minimum stock/capacity
and useful-load bounds govern optional markdowns; no supplier/customer or no
profitable route remains no offer. Farm forecast assumptions and finance approval
budgets remain following slices.

Write/run failing `tests/npc-pricing-rules.test.ts`, then relevant regressions
npc-feedback, npc-business-continuity, npc-owner-recovery, npc-business-policy,
npc-input-buffer-rules, npc-working-capital-rules, economy-rules, and npc-guide with `node_modules/.bin/tsx --test
 --test-concurrency=2 <paths>`. Validate all fields, atomic inverted bounds, summary,
editor, observations, design transfer and reload. Browser `TEST_GPU=1 npm run
test:e2e -- tests/browser/npc-pricing-rules.spec.ts`: save/reopen eleven fields,
observe a local input quote change with no stock/cash changes, set zero bid ceiling,
reject inverted load bounds, reload and inspect controls/refusal/screenshots/errors.
Finish TypeScript, changed-file Prettier and NPCS/WORLD_BUILDING/README/Unreleased.

Pre-production pricing audit also identifies the one-hundredth minimum sustainable
ask: add `npcMinimumOutputAsk` 1 (integer 0–1,000,000), bringing this batch to twelve
fields. It is independent of the production-cost multiplier and cannot lower a
positive cost forecast. Preserve the existing floating-point ceiling at default
quotes: the fixture's default ask is 141, not a mathematically rounded 140.

Pricing red run: seven tests fail for missing rules, input quote 200 versus 150,
ignored ceiling, existing world bid floor 500 ignored in favor of 200, unchanged
reopening threshold and production price multiplier. The direct existing-rule
regression also checks load three and invalid remembered quotes; use
`tests/economy-rules.test.ts` as the verified relevant filename.

Pricing relevant gates expose a request-budget regression: the long-memory fixture
is 96,172 bytes against the unchanged strict 96,000-byte limit. Preserve every
rule, selected manual text, topic, memory excerpt and citation. Store manual source
paths once in a `sources` dictionary keyed by the existing section-ID prefix,
instead of repeating the same path on every embedded manual entry. Direct guide
lookup keeps full anchored citations and catalogue entries keep their sources.
Extend citation tests to reconstruct and compare every source from that dictionary,
require no repeated source on embedded manual entries, and keep the budget test.
Run the new representation test red before changing guide production code.

Pricing gates: seven pricing tests and 63 relevant regressions pass (70 in 7.1
seconds), including the unchanged 96 KB long-memory request budget. Citation
dictionary assertions fail before implementation and pass afterwards; all selected
text, topic IDs, memory limits and direct anchored lookup results remain intact.
The browser passes in 22.1 seconds; inspect all three screenshots for saved input
and output settings and the inverted-bound warning. Quote changes 200 → 150 and
zero ceiling suppresses a new quote without changing posted bids, cash or stock.
No browser errors. Finish clean TypeScript, changed-file Prettier and diff checks
before committing this slice. No full test suite is run.

Pushed and verified `1693c6f` on `backlog-implementation`. **Resident pricing
rules are done.** TypeScript, changed-file Prettier and diff checks pass.

### Gameplay rules — loan affordability budgets

Before production, finish the loan budget policies found by the resident-finance
audit. Add eight Loan offers rules with current defaults: `loanLiquidityReserve`
20,000 hundredths (integer 0–100,000,000), `loanIncomePaymentShare` 0.35 (0–1),
`loanLiquidPaymentDivisor` 2 (1–1,000), `loanPersonalLimit` 100,000 hundredths
(integer 0–10,000,000), `loanIncomeBorrowingMonths` 6 (0–120),
`loanLiquidBorrowingShare` 0.5 (0–1), `loanMinimumAmount` 1,000 and
`loanMaximumAmount` 10,000,000 hundredths (integers 1–10,000,000, minimum ≤ maximum).
Loan limits and payment capacity use these rules, ordinary bank capital/credit/
existing-debt checks remain, zero unsecured limit closes new personal borrowing,
and signed loans/repayment are unchanged. The bank amount input, initial value
clamped into its bounds, and refusal text read the same local bounds.

Add four resident business rules: `npcLoanMinimumShortfall` 1,000 and
`npcLoanMaximumShortfall` 10,000 hundredths (integers 0–10,000,000, minimum ≤ maximum),
`npcLoanPaymentBuffer` 3 (1–1,000), and `npcLoanProfitBatches` 20 (0–1,000).
Only positive shortfalls in range qualify; maximum zero or profit batches zero
suppresses new financing plans. Require payment × buffer strictly below estimated
batch margin × profit batches, plus actual loan approval and no unpaid loan.
Existing cash-transfer limits must bound the planned capital deposit. No edit
transfers funds or rewrites an accepted loan.

Write failing `tests/loan-affordability-rules.test.ts` before production. Assert
exact default/missing-key capacity and limits, independent changed-value formulas,
valid approved borrowing and atomic refusals, zero policies, strict resident
profit boundary, existing debt/bank funding/transaction bounds, all twelve fields'
validation, summaries, editor, observations, portable designs and save/reload.
Run this file plus loan-rules, loans, npc-business-policy, npc-prosperity,
npc-working-capital-rules and npc-guide using the npm-test tsx runner. TypeScript
must be clean; run changed-file Prettier. Browser: save/reopen all fields, inspect
local bank input bounds and an approved quote, set zero personal limit and verify
a readable refusal without a transfer, reject inverted amount/shortfall bounds,
and preserve an existing loan through an edit and repayment. Keep the existing
loan browser empty-bank-capital test. Inspect screenshots and page errors.
Update WORLD_BUILDING, NPCS, README and imperative Unreleased; leave loan lifecycle
and the remaining NPC household/farm budgets for their own subsequent audit.

Affordability red: all six unit tests fail for missing fields/unchanged policies;
the transfer-limit regression independently produces a financing plan above the
permitted deposit. The browser fails waiting for the absent liquidity field.
After implementation, all six new tests pass, including exact default capacity
7,500 and unsecured limit 90,000, changed independent formulas and strict profit
equality. Run the relevant regressions and browser gates next.

Affordability gates pass: six new tests plus 58 relevant regressions (64 in 20.3
seconds); clean TypeScript and changed-file Prettier/diff checks. Both loan
browser flows pass (23.6 and 16.5 seconds), including approved borrowing, closed
personal lending, repayment, empty bank capital, both inverted-bound refusals and
reload. The final new-flow rerun passes in 21.0 seconds after waiting for the
warning's color transition before capture. Inspect saved bank/resident settings,
the quote, closed-lending notice and readable warning; no page errors. No full
suite is run. Ready to commit and push.

Pushed and verified `32d93e2` on `backlog-implementation`. **Loan affordability
budgets are done.**

### Gameplay rules — owner withdrawal reserves

Before production, expose the active owner-draw forecast in `shared/stakes.ts`,
used by resident withdrawal hypotheses: `npcOwnerCashFloor` 4,000 hundredths
(integer 0–100,000,000), `npcOwnerFuelThreshold` 10 tank units (0–1,000,000),
and `npcOwnerFuelFallback` 800 hundredths (integer 0–100,000,000). Add them to
Resident cash and portable reserves. Keep this small discretionary forecast
separate from the emergency and household reserve defaults. The fuel allowance
uses the cheapest stocked, positive-price supplier; the fallback applies only
when none exists, and carried Fuel suppresses it. Zero floor/threshold disables
that part of the forecast. Rule edits grant nothing. An actual withdrawal remains
bounded by claims, operating reserves and the cash-transfer limit.

Write failing `tests/npc-owner-reserve-rules.test.ts`; require exact defaults and
missing-field behavior, custom/zero boundaries, stocked supplier versus fallback,
carried Fuel, an actual ordinary withdrawal with conservation and investor lock,
and all-field validation, editor, summary, observation, designs and reload. Run
this file plus npc-hypotheses, npc-reserve-rules, npc-business-policy, stakes and
npc-guide (verify exact filenames). Browser: save/reopen all three fields, observe
a changed forecast, zero both components, reject an out-of-range value and reload
saved values. Inspect controls/refusal and page errors; require TypeScript,
Prettier, WORLD_BUILDING/NPCS/README and imperative Unreleased before push.

Owner-reserve red: all four tests fail before production for missing rules or
unknown settings. After implementation, four pass: default need 3,800 hundredths,
custom 1,300, stocked quote 1,700, zero controls and conserved capped withdrawal.
The verified relevant stake files are outside-investment and investment-rules.

Owner-reserve relevant run: 56 pass, with the unchanged long-memory budget at
96,019 bytes (strict limit 96,000). The gameplay instructions repeat the exact
prohibition on pretending to be a human operator in their opening and later
resident-voice paragraph. Keep the prohibition in residentVoice (also used by
chat), and keep the opening's explicit AI identity, while removing only that
repeated clause. Add a red assertion that the gameplay instruction contains the
prohibition exactly once and still identifies an openly AI resident. Preserve
all guide content/rules/memory and the byte limit. Also narrow the test's
investment action before reading its amount; this is a test typing correction.

The browser's out-of-range field correctly prevents form submission using native
number-input validation; there is no server toast because no request is sent.
Correct the harness to check focus, rangeOverflow, the nonempty native message
naming the limit, unchanged saved value and reload. Keep all refusal criteria.
The duplicate-clause test fails 2 versus 1 before editing; the revised instructions
retain explicit AI identity and the full prohibition, and the unchanged budget
now passes. Sixteen changed-file tests pass; prior relevant checks remain green.

Owner-reserve gates pass: 56 initially passing relevant checks plus the corrected
budget and new identity test (58 unique checks); the 16 tests in both changed
unit files pass in 1.1 seconds after the narrow repair. Browser passes in 19.6
seconds, with saved controls, forecast 3,800 → 1,300 → 0, unchanged cash, native
upper-bound refusal and preserved value after reload. Inspect both screenshots;
no page errors. TypeScript is clean after action narrowing; changed-file Prettier
and diff checks pass. No full suite is run. Ready to commit and push.

Pushed and verified `a4934f6` on `backlog-implementation`. **Owner withdrawal
reserve rules are done.**

### Gameplay rules — pantry shopping and lodging budgets

Before production, add six Resident household forecast fields:
`npcPantryNeedAllowance` 20,000 (integer 0–1,000,000),
`npcUnhousedProvisionItems` 2 (integer 0–100),
`npcProvisionDrinkCashReserve` 1,500 hundredths (integer 0–100,000,000),
`npcProvisionBatchLimit` 20 (integer 0–10,000),
`npcLodgingBufferSeconds` 1,200 (integer 0–86,400), and
`npcLodgingCashReserve` 2,000 hundredths (integer 0–100,000,000).
Preserve current pantry target, homeless two-item purchase, money protected for
drink when buying food, shopping batch, booking padding and retained cash by
default and with missing keys. These are budgets; care/consume triggers and
actual room capacity/booking limits are unchanged. Zero budget components remove
only that allowance; zero shopping batch suppresses source purchases/withdrawals.
Carried deposits retain their current quantity logic, bounded by the existing
transaction limit. Shopping, owned-stock withdrawal and deposits obey that same
limit, actual funds, supplier stock, storage and carry capacity. Preserve room
expiry, personal pantry ownership and ordinary conservation.

Write failing `tests/npc-pantry-budget-rules.test.ts`. Assert exact defaults,
changed pantry quantities, zero unhomed provision count, drink cash protection,
zero/reduced batches, owned-output withdrawals, carried-deposit transaction caps,
booking duration/cash boundaries and real paid booking. Validate fields, editor,
summary, observation, portable designs and save/reload. Run new tests plus
npc-household, npc-household-rules, npc-planning-rules, npc-habits, npc-housing and
npc-guide using the npm-test runner; broaden only for a discovered shared risk.
Browser: save/reopen all six fields, observe pantry quantity change without cash
or stock grants, zero shopping batch, native range refusal and saved-value reload.
Inspect screenshots/page errors. Finish clean TypeScript, changed-file Prettier,
WORLD_BUILDING/NPCS/README and imperative Unreleased before commit/push.

Pantry red: all five new tests fail before production for missing budget fields.
After implementation, five pass; relevant household flows pass, but adding live
rules brings the long-memory request to 96,166 bytes against the unchanged 96 KB
limit. Group the manual topic index by its existing source prefixes once, retaining
every section slug and title and explicitly documenting `prefix:section` IDs.
The all-manual-heading test must reconstruct exactly the same complete ID/title
mapping from grouped keys; retain all selected text, citations and memory. The
new grouped-prefix assertion fails against the flat index before production.
This changes only repeated JSON metadata, not topic coverage or lookup behavior.

Pantry gates pass: 44 initially passing relevant checks plus the repaired byte
budget and new grouped-index assertion (46 unique checks). All 13 guide checks
pass after the metadata-only change, including exact reconstructed topic mapping.
Browser passes in 19.6 seconds: six values persist, bread quantity changes 2 → 3,
zero batch stops shopping, cash/stock remain unchanged, native upper-bound refusal
protects the saved lodging padding and reload preserves it. Inspect both
screenshots; no page errors. TypeScript, changed-file Prettier and diff checks are
clean. No full suite is run. Ready to commit and push.

Pushed and verified `f233725` on `backlog-implementation`. **Pantry shopping and
lodging budgets are done.**

### Gameplay rules — bid-policy briefing follow-up

The follow-on budget audit finds a stale claim in `npc/finances.ts`: the resident
briefing still says below half target after the reopening fraction became a rule.
Before production, extend npc-finances tests to require the actual default 50%,
custom 75%, and a clear disabled policy at zero while preserving explicit manual
pause and overstock messages. Both the direct briefing and the observation used
for dialogue must carry the same correct policy; the change grants no actions or
prices. Run the new tests red, then npc-finances, npc-pricing-rules and npc-guide,
clean TypeScript and changed-file Prettier. Update NPCS, README and imperative
Unreleased. This changes model briefing text, with no UI/rendering implementation
change; the pricing editor browser flow is already verified for this rule.

Bid-policy briefing red reproduces the stale “half target” sentence. After the
small text fix, all 33 relevant checks pass in 1.6 seconds, including matching
conversation observations, zero policy, manual pause and overstock precedence.
TypeScript, changed-file Prettier and diff checks pass. Ready to commit and push.

Pushed and verified `66b504e` on `backlog-implementation`. **Bid-policy briefing
follow-up is done.**

### Gameplay rules — resident farm forecasts

Before production, expose five Resident business budgets:
`npcFarmYieldShare` 0.5 (0–1), `npcFarmWaterBudget` 6 and
`npcFarmCompostBudget` 1 (integers 0–1,000),
`npcFarmCustomerFundedItems` 20 (integer 1–10,000), and
`npcFarmCustomerStockLimit` 20 (integer 0–10,000).
Default and absent fields preserve sustainable farm asks, acquisition viability
and expansion demand checks. Share the yield fraction between pricing and farm
acquisition. A forecast of zero whole harvested units has no sustainable ask and
cannot justify acquiring a farm; no division by zero. Water/compost zero removes
only that estimated input cost. Actual crop yield, tending, seed prices, wages
and land costs remain separate. Expansion still requires a busy farm, proven
receipts, reserve funds, a clear parcel and a funded buyer below its stock cutoff;
zero stock cutoff disables this demand signal. Funding descriptions must name the
actual current plot count rather than claiming four on an expanded farm.

Write failing `tests/npc-farm-budget-rules.test.ts`: exact default/missing-field
asks, independent custom costs/yield, zero/tiny-yield refusal, changed acquisition
viability, buyer funding/stock boundaries, no new cash/stock, correct expanded-farm
funding text, and all fields' validation/editor/summary/observation/design/reload.
Run the new file plus npc-pricing-rules, npc-farmer, npc-prosperity,
npc-working-capital-rules and npc-guide. Browser: save/reopen five fields, observe
a changed wheat ask, zero yield (no finite quote), native range refusal and saved
reload; inspect screenshots/errors. Require TypeScript, Prettier, WORLD_BUILDING,
NPCS, README and imperative Unreleased before commit/push.

Farm forecast red: all six tests fail for missing settings or the stale four-plot
funding description. After implementation, all six pass, including exact asks
90 → 31 → 43, no finite zero/tiny-yield quote, shared acquisition viability,
funded-buyer and stock boundaries, and unchanged real cash/stock.

Farm forecast gates pass: all 58 relevant tests in 4.2 seconds, clean TypeScript,
changed-file Prettier and diff checks. Browser passes in 20.1 seconds: five fields
persist, wheat ask changes 90 → 31, zero yield has no finite quote, native range
validation refuses a share above one, and reload preserves zero. Inspect saved
controls/refusal screenshots; no page errors or cash/stock grants. No full suite
is run. Ready to commit and push.

Pushed and verified `07599c5` on `backlog-implementation`. **Resident farm
forecast budgets are done.**

### Gameplay rules — resident experiment budgets

Before production, expose four Resident business budgets used by hypotheses:
`npcExperimentCashFloor` 2,000 hundredths (integer 0–100,000,000),
`npcExperimentOwnerFundingUnits` 4 (integer 1–1,000),
`npcExperimentRestockBatches` 2 (integer 0–1,000), and
`npcExperimentLoadLimit` 8 (integer 0–10,000).
The cash floor applies to owner/outside funding and acquisition startup budgets;
the owner multiplier applies to an owned shop's cheapest bid and an acquired
producer's initial till estimate. Restock batches govern only the small experiment,
within the ordinary input target. Load limits govern speculative trade, restock,
output sales and surplus fish, bounded by the existing world transaction limit.
Zero restock batches or load disables that corresponding experiment. Actual
household/operating reserves, cash transfer limits, funds, cargo, stock and buyer
room remain required; changing a setting grants nothing.

Write failing `tests/npc-experiment-budget-rules.test.ts`, including independent
existing-rule tests for a transaction limit of one and a buyer with only one free
slot. Assert exact defaults and missing fields, custom funding/acquisition budgets,
restock/load zeros, output/fish capacity bounds and an ordinary conserved sale.
Validate all fields, summaries, observations, editor, designs and reload. Run new
tests plus npc-hypotheses, npc-owner-reserve-rules, npc-input-buffer-rules,
npc-business-policy, npc-finances and npc-guide. Browser: save/reopen all four,
observe changed owned-shop funding without a grant, refuse invalid input and
reload saved values. Inspect screenshots/page errors; finish TypeScript,
Prettier, WORLD_BUILDING/NPCS/README and imperative Unreleased before push.

Experiment red: all six tests fail before production. The independent transaction
and buyer-room regressions both reproduce quantity 8 instead of 1, without new
settings. After implementation, six pass, including a conserved real sale,
unchanged default loads, zero controls and funding 2,000 → 600/250/1,500 by role.

Experiment gates pass: all 60 relevant checks in 3.1 seconds, clean TypeScript,
changed-file Prettier and diff checks. Browser passes in 19.5 seconds: four rules
persist, owned-shop funding changes 2,000 → 600 without a transfer, native
validation rejects a multiplier below one and saved values survive reload.
Inspect both screenshots; no page errors. No full suite is run. Ready to commit
and push.

Pushed and verified `b2127b4` on `backlog-implementation`. **Resident experiment
budgets are done.**

### Gameplay rules — resident property, paint and farm funding thresholds

Before production, expose five Resident cash and portable reserves rules, each an
integer in 0–100,000,000 hundredths: `npcPropertyCashReserve` 20,000,
`npcPaintCashThreshold` 20,000, `npcFarmFundingTillThreshold` 10,000,
`npcFarmFundingCashThreshold` 15,000 and `npcFarmFundingAmount` 5,000.
Both ordinary property and farmer purchase choices must retain the same local
property reserve. Paint remains optional only strictly above its cash threshold;
actual paint cost and ordinary eligibility still apply. Farm funding is considered
only below the till threshold and strictly above the cash threshold, with the
amount bounded by actual cash and the existing transfer limit. Zero amount/till
threshold disables this farm-funding suggestion; zero cash/property thresholds
remove only that eligibility cushion. Keep startup/household reserves separate.
Describe local amounts accurately, and never move cash merely by changing rules.

Write failing `tests/npc-discretionary-budget-rules.test.ts` for defaults and absent
fields, exact purchase and paint boundaries, shared farmer/general property
rules, funding thresholds/zero/transfer cap and a conserved executed deposit.
Cover atomic validation, editor, summary, observation, portable designs and reload.
Run it with npc-adaptive, npc-farmer, npc-reserve-rules and npc-guide (verify paths).
Browser: save/reopen five fields, observe changed farm-funding suggestion, zero
amount gives no suggestion, native invalid input is refused and saved values
survive reload. Inspect screenshots and page errors. Finish clean TypeScript,
changed-file Prettier, WORLD_BUILDING/NPCS/README and imperative Unreleased.

Discretionary-budget red: five checks fail for missing settings, and an independent
existing-transfer-limit regression proposes 5,000 where only 50 is allowed.
After implementation all six pass, including exact purchase/paint boundaries,
zero controls, actual-cash caps and a conserved farm deposit.

Discretionary-budget gates pass: 51 relevant tests in 5.3 seconds, clean TypeScript,
changed-file Prettier and diff checks. Browser passes in 20.2 seconds: five settings
persist; the planned farm deposit changes 5,000 → 200 without moving money; zero
suppresses it; native validation refuses a negative amount and reload preserves
zero. Both screenshots inspected; no page errors. No full suite is run.

Pushed and verified `db980d3` on `backlog-implementation`. **Resident property,
paint and farm-funding thresholds are done.**

### Gameplay rules — resident training and town ambition budgets

Before production, expose `npcGroupTrainingCashReserve` 5,000 hundredths (integer
0–100,000,000) and `npcTownFoundingCostMultiplier` 4 (0–100, step 0.25) in Resident
cash and portable reserves. The first only controls whether an unqualified
resident considers a group employment invitation to train: require actual tuition
plus this cushion, while retaining needs, skill limits, other-course, preference
and existing-job gates. It does not accept a job or pay tuition. The second gates
an optional town ambition at household reserve plus charter cost times the local
multiplier; retain actual charter/cottage/household affordability, proven funded
businesses, home, permissions and site checks. Zero removes only the extra budget
gate, never actual costs. Defaults and missing fields preserve existing behavior.

Write failing npc-ambition-budget-rules tests for exact default/custom/zero
boundaries, no acceptance or grants, actual charter costs and all rule persistence
surfaces. Run that file, npc-group-chat, npc-prosperity, npc-guide and
npc-discretionary-budget-rules. Browser: save/reopen both values, observe changed
training interest with unchanged cash/skill/job, zero reserve still refuses
unaffordable tuition, invalid multiplier is refused and saved values reload.
Inspect screenshots/errors; finish TypeScript, Prettier, world-builder/NPC/README
and imperative Unreleased documentation before commit/push.

Ambition-budget red: all four checks fail for missing settings after isolating the
charter-multiple boundary with an already-stocked household (otherwise the actual
cottage-plus-household cost correctly dominates that boundary). All four now pass,
including zero cushions without waived tuition or charter costs and unchanged
qualifications/ownership/accounts.

The relevant request-budget regression fails at 96,032 bytes against the unchanged
96,000-byte ceiling. Before changing guide production, add a failing round-trip
criterion: embed selected sections as a dictionary keyed by their lookup ID,
with manual text as the value and catalogue metadata retained. Reconstruct every
selected ID/text/source and preserve the complete topic index, selection limits,
memories and direct lookup citations. This removes repeated JSON id/text fields;
it must not shorten any content or relax the request ceiling. Update existing
shape consumers in guide tests and the one resident guide integration test.

Ambition gates pass: 42 unique relevant checks across focused runs, including the
new guide round-trip and resident lookup integration. The original request ceiling
passes with every selected passage and citation preserved; guide/ambition checks
take 1.2 seconds, affected group/prosperity consumers 1.0 second, lookup integration
0.9 second. TypeScript, changed-file Prettier and diff checks pass. Browser passes
in 19.5 seconds: both rules persist; lowering the training reserve changes interest
without paying tuition; zero still refuses unaffordable tuition; native validation
rejects multiplier 101 and reload preserves 5.25. Both screenshots inspected, no
page errors. No full suite or unnecessary browser rerun after the server-only
serialization change. Ready to commit/push.

Pushed and verified `03ed658` on `backlog-implementation`. **Resident training and
town ambition budgets are done.**

### Gameplay rules — resident breeding reserves

Before production, expose four Resident business budgets:
`npcBreedingCashThreshold` 15,000 hundredths (integer 0–100,000,000),
`npcBreedingFeedReserve` 20 and `npcBreedingWaterReserve` 20 items, and
`npcBreedingSpareAnimals` 2 (each integer 0–10,000). Consider breeding only strictly
above the cash threshold, at or above feed/water thresholds, and below the
species' minimum plus spare-animal target. Cattle/sheep count hay toward feed;
other species cannot. Zero spare target disables replacement suggestions. Zero
other budgets removes only that extra reserve: actual breeding fees, rations,
health, qualifications, ownership, existing pregnancy and pasture/building capacity
must still pass the ordinary action's checks. Share its pure refusal check with
the planner rather than copying biological limits into a second policy.

Write failing npc-breeding-budget-rules tests for defaults/absent fields, exact
custom thresholds and zeros, species-specific hay, real paid breeding, no grants,
and an independent existing building-capacity refusal. Cover validation, summaries,
observations, editor, portable designs and reload. Run the new file, livestock,
pastures, npc-prosperity, npc-working-capital-rules and npc-guide. Browser: persist
four fields, observe changed breeding eligibility without starting a pregnancy,
zero spare target produces no plan, reject invalid input and reload. Inspect
screenshots/errors; require TypeScript, formatting and relevant docs before push.

Breeding red: four tests reject missing settings; the independent capacity test
reproduces a replacement plan for a full barn. All five pass after implementation,
including exact boundaries, hay restrictions, zero safeguards and a paid breeding
action that consumes the specified fee/rations without creating an immediate animal.
The portable-design fixture uses clear flat ground, no roads and valid sea level;
its initial default roads and out-of-range sea-level setup were corrected without
changing design validation.

Breeding gates pass: all 54 relevant tests in 5.8 seconds, clean TypeScript,
changed-file Prettier and diff checks. Browser passes in 20.4 seconds: four rules
persist and enable the expected replacement plan without changing stock, funds or
pregnancy; zero spare target leaves no plan; native validation rejects a negative
target and reload preserves zero. Both screenshots inspected; no page errors.
No full suite is run. Ready to commit/push.

Pushed and verified `accbd02` on `backlog-implementation`. **Resident breeding
reserves are done.**

### Gameplay rules — resident provision shopping and carried-input reserves

Before production, expose aggregate portable shopping targets under Resident
household forecasts: `npcShoppingFuelTarget` 2, `npcShoppingDrinkTarget` 6 and
`npcShoppingFoodTarget` 3 items (integers 0–10,000). Count all carried items with
that nutrient, preserving the existing priority fuel → drink → food. Zero stops
that category's optional restock choice, not urgent care/use or pantry planning.
Shopping must obey the existing transaction limit, affordability, stock and cargo.
Owned-business delivery of carried inputs must use the existing portable Water
and Bread reserve rules, preserving the existing zero reserve for other input
kinds, and cap the stock deposit by the existing transaction limit.

Write failing npc-shopping-budget-rules tests for default/missing targets,
independent custom/zero targets, aggregate carried drinks, paid conserved shopping,
stock/funds/cargo bounds, and independent regressions for the existing transaction
limit and owner-delivery Water/Bread reserves. Validate/persist all new fields
through editor, summary, observation, design and reload. Run the new file,
npc-farmer, npc-prosperity, npc-reserve-rules, npc-pantry-budget-rules and npc-guide.
Browser: save/reopen three targets, inspect changed optional shopping quantities
without a grant, zero target removes that choice, refuse invalid input and reload.
Inspect screenshots/errors, then TypeScript, Prettier and relevant docs.

Shopping red: missing targets, a two-item purchase despite a one-item transaction
limit, and an owner delivering four Water instead of the two allowed by its local
reserve all fail as expected. Existing stock/cash/cargo/conservation checks pass.
All six checks now pass, including independent category totals and zero controls.

Shopping gates pass: all 57 relevant tests in 4.7 seconds, clean TypeScript,
changed-file Prettier and diff checks. Browser passes in 20.4 seconds: all three
targets persist, quantities change to Fuel 4/drink 9/food 5 without a purchase,
zero drink removes only that restock, negative input is refused and reload keeps
zero. Both screenshots inspected; no page errors. No full suite is run.

Pushed and verified `9e94cfe` on `backlog-implementation`. **Resident portable
shopping targets and carried-input reserves are done.**

### Gameplay rules — remaining resident goods-transfer limit consumers

Before production, extend the existing transaction-limit rule to the remaining
ordinary NPC purchase, input delivery, crop/output collection and sale,
construction procurement, general trade and career loops. Every trade/stock leg
must use the same bounded quantity as its paired leg and description. A one-item
limit must produce a feasible smaller plan instead of either an oversized action
or a missing option from the adaptive dry-run. Worker input errands must bound
carried and purchased inputs. Gathering retains the actual timed yield; gather
only enough whole batches for the bounded sale, keep any excess aboard, and state
newly gathered versus delivered quantities accurately. Preserve default volumes,
ordinary costs, stock/cargo/funds/reserves and supply permissions.

Write failing npc-transfer-limit tests for each planner family, including the
one-item world rule, an executed conserved output sale, a construction purchase,
worker delivery and gathering with a yield larger than the sale limit. Run these
plus npc-farmer, npc-adaptive, npc-projects, npc-construction, npc-prosperity,
npc-business-policy, npc-shopping-budget-rules and npc-experiment-budget-rules.
No UI/rendering implementation changes: the existing rule's browser editor and
transaction refusal flow are already verified; this slice fixes server-side plan
consumers. Require TypeScript, changed-file formatting and NPC/world-builder,
README and imperative Unreleased docs before pushing.

Transfer-limit red: eight checks reproduce oversized 2–100-item actions or missing
adaptive alternatives under a one-item limit. The setup uses a non-backlogged
producer and the real Wood item ID so failures concern transfer sizing, not absent
stock targets or unknown cargo. A ninth red check exposes gathering's buyer filter
still requiring room/funds for the entire yield; it must budget the bounded sale
while retaining the actual whole gather and surplus cargo.

All nine transfer checks pass. Strengthening the service-parts fixture to a supplier
with only one Steel exposes a second missing-option filter; the supplier lookup
and quantity must use available stock as well as the transfer limit, preserving
the partial-purchase/no-premature-service behavior. That test fails before the
filter change. TypeScript also catches incomplete test state objects and optional
empty-inventory inference; fix the fixture types without changing assertions.

Transfer-limit gates pass: 76 unique relevant tests; initial regression run takes
5.9 seconds, followed by 22 affected transfer/adaptive checks in 1.8 seconds after
the stricter supplier-stock fix. TypeScript, changed-file Prettier and diff checks
are clean. Ordinary output sales and construction delivery conserve goods/money;
gathering sells one and retains two from the unchanged three-item yield, including
a buyer with only one free slot and funds for one item. No new UI/rendering code
or settings controls changed, so the already-verified browser flow is not repeated.
No full suite is run. Ready to commit/push.

Pushed and verified `47f5449` on `backlog-implementation`. **Remaining audited
resident transaction-limit consumers are done.**

### Gameplay rules — general resident trade and storage load targets

Before production, add a Resident trade and storage loads fieldset with eight
integer 0–10,000 policies: `npcGeneralSupplyTarget` 3,
`npcConstructionLoadLimit` 20, `npcParishSupplyLoadLimit` 20,
`npcGeneralTradeLoadLimit` 10, `npcStorageDepositLoadLimit` 10,
`npcStorageWithdrawalLoadLimit` 5, `npcRoomStorageLoadLimit` 3, and
`npcCareerTradeLoadLimit` 1,000. Keep absent-field defaults in the shared settings
source. General supply target governs the optional small purchase, carried target
and free-source allowance; construction load bounds both those purchases and
explicit construction procurement. Parish load limits obtaining goods from a
supplier, not fulfilling an order from cargo already carried. Storage deposit,
withdrawal and room transfer limits remain distinct; career trading has its own
larger load target. Zero suppresses the corresponding optional leg, while owned
cargo, order terms and existing world transaction/stock/cash/capacity limits remain
intact. No setting edit makes a transfer.

Write failing npc-cargo-budget-rules tests for exact default/custom/zero behavior,
all eight missing-field fallbacks, general trade/storage, construction, public
supply, room pantry and career trade. Cover atomic validation, editor/summary,
observations, design and save reload; retain the one-item transaction regressions.
Run new tests plus npc-transfer-limit, npc-adaptive, npc-projects, npc-construction,
npc-guide and the existing NPC guide integration if its request format changes.
Browser: save/reopen all eight, observe changed trade loads without a transfer,
zero removes the trade option, reject invalid input and reload; inspect screenshots
and errors. Require TypeScript, Prettier, NPC/world-builder/README and imperative
Unreleased documentation before push.

Cargo red: all six tests fail for missing rules after giving the parish fixture
its ordinary full share so the 20-item policy can be observed independently of
share limits. All six now pass. The unchanged request-size check fails at 96,074
bytes. Before further guide production changes, require a lossless topic encoding:
retain every full title grouped by source prefix and document the existing exact
slug algorithm for reconstructing its lookup ID. Compare the complete reconstructed
ID/title index against all original manual headings, retain all selected text and
citations, and leave lookup/memory/size limits unchanged. This avoids repeating
both a long heading and its mechanically derived slug in every request.

Cargo gates pass: 55 relevant tests plus one resident guide integration; the
browser passes persistence, changed/zero trade loads and invalid-input handling
in 20.1 seconds. Inspect all three screenshots. TypeScript exposes the missing
Settings cargo-rules intersection; add that type declaration and rerun TypeScript
successfully, without repeating unaffected runtime checks. Changed-file Prettier
and diff checks are clean. All eight absent-field defaults and the 1,000-item
career baseline pass. The lossless topic index reconstructs every original lookup
ID and the unchanged request-size limit passes. No full suite is run.

Pushed and verified `c43bd9c` on `backlog-implementation`. **General resident trade
and storage load targets are done.**

### Gameplay rules — resident business and farm cargo budgets

Before production, expose eight integer 0–10,000 rules in Resident business cargo:
`npcBusinessCollectionLoad` 20, `npcSmallInputPurchaseLoad` 5,
`npcSmallInputPurchaseBatches` 2, `npcCarriedSurplusSaleLoad` 25,
`npcFarmCollectionLoad` 25, `npcOwnedSourceReserveBatches` 3,
`npcBusinessOutputSaleLoad` 30 and `npcFarmOutputSaleLoad` 20. Preserve distinct
collection and sale policies. Small-input batches select optional restocking;
zero disables that optional restocking, without suppressing the separate purchase
of one required gathering implement. Source reserve batches protect inputs at an
owned supplier, with actual breeding minima retained even at zero. Zero load
suppresses that optional transfer. All paths retain transaction, available stock,
capacity, affordability and household protections. Missing keys use JSON defaults.

Write failing `npc-business-load-rules` tests for defaults and missing fields,
custom/zero behavior for all eight policies, exact input-stock boundary, owned
supplier reserves including breeding minimum, ordinary execution and conservation,
and settings validation, summary, observation, design and reload. Run this file
plus npc-transfer-limit, npc-farmer, npc-business-policy, npc-enterprise (if present),
npc-prosperity and npc-guide. Browser `npc-business-load-rules.spec.ts`: edit all
eight, reopen/reload, observe changed collection load and zero's absent option
without a transfer, reject negative input, inspect screenshots and browser errors.
Require TypeScript, changed-file Prettier, world-builder/NPC docs, README review and
imperative Unreleased entry before push. Do not repeat the full suite.

Business cargo red: six checks fail for absent defaults/validation, unchanged
20-item collections, 25-item surplus sales, two-batch purchase thresholds and
three-batch supplier reserves. After implementation five pass immediately; the
breeding-minimum fixture names the output item as a recipe. Correct that fixture
to the actual dairy recipe and all six pass, including the unchanged two-animal
source minimum. No assertion or acceptance criterion is weakened.

Business cargo gates pass: all 61 relevant checks in 3.6 seconds, including the
unchanged guide request-size check. TypeScript and diff checks are clean; Prettier
runs on every changed file. Browser persistence, changed/zero collection load,
invalid input and reload pass in 20.0 seconds, with no browser errors; inspect all
three screenshots. No full suite is run. The named npc-enterprise test file does
not exist; enterprise behavior is covered directly by the new tests and existing
transfer, business-policy and prosperity tests.

Pushed and verified `80c9d47` on `backlog-implementation`. **Resident business and
farm cargo budgets are done.**

### Gameplay rules — resident fallback input and crop-demand budgets

Before production, expose three integer 0–10,000 fields in Resident business cargo:
`npcRoutineSupplyBatches` 2 and `npcRoutineDepositBatches` 4 for the routine
procurement/carried-deposit fallback when a producer has no calculated stock target
(including livestock), and `npcCropDemandBatches` 6 for funded downstream crop
demand. Preserve the herd-minimum/2 quantity basis of routine herd replenishment;
zero suppresses the corresponding fallback. Calculated ordinary producer targets
retain precedence. Crop demand zero removes the forecast buffer, but retains
actual urgent one-batch need and ordinary seed, staffing and farm policies.
Enterprise supply uses the existing `npcInputReserveBatches` (default 6) for its
fallback inputs, preserving actual breeding-minimum targets separately.

Extend npc-business-load-rules with red checks for exact defaults/missing fields,
custom/zero routine purchases and deposits, real input delivery, ordinary-target
precedence, enterprise fallback input reserves and breeding minima, and crop
selection changed by funded demand. Extend validation/design/summary/observation
and browser persistence to all three fields. Browser must show changed/zero
routine livestock-supply options, retained goods/cash, invalid input and reload.
Run the changed test file plus npc-transfer-limit, npc-farmer, npc-business-policy,
npc-prosperity, npc-breeding-budget-rules and npc-guide; require TypeScript,
Prettier and world-builder/NPC/README/Unreleased documentation before push.

Fallback red: missing defaults/validation, fixed two-batch purchases and fixed
six-batch crop forecasts fail. A larger nine-batch enterprise reserve reproduces
a 12-versus-18-item cap; smaller custom reserves already work through the shared
procurement bound. Preserve those bounds and replace the stale six-batch copy.
The crop fixture initially names nonexistent Barley; use actual Potatoes and
an employed farmer with valid crop policy/rotation so the test isolates funded
demand. All ten targeted checks then pass without weakening criteria.

Fallback-input gates pass: 70 relevant tests in 5.4 seconds, TypeScript clean,
changed-file Prettier and diff checks clean. Browser passes in 21.8 seconds with
no errors, saving/reopening all three new controls, changing the dairy supply
from four to six items, suppressing it at zero, preserving source/target stock,
rejecting negative input and retaining saved zero after reload. Inspect all three
screenshots, including new fields and full explanatory text. No full suite runs.

Pushed and verified `c20ccec` on `backlog-implementation`. **Resident fallback input
and crop-demand budgets are done.**

### Gameplay rules — resident journey and equipment budgets

Before production, add Resident journey budgets with `npcJourneyDistanceMultiplier`
1.5 (1–10), `npcJourneySpeedFraction` 0.6 (0.01–1),
`npcJourneyFuelFallbackPrice` 4,500 hundredths (integer 0–100,000,000),
`npcEquipmentPaybackLoads` 8 (0–1,000), and `npcDriveFuelThreshold` 10 tank units
(0–1,000,000). Share JSON defaults for absent fields. Journey estimates use actual
vehicle tuning, the cheapest stocked positive Fuel quote, and walking's zero fuel
cost. Zero fallback price removes only the unquoted allowance. Equipment payback
zero rejects new paid implements but permits owned tools. Zero drive threshold
suppresses optional fuel shopping; an empty vehicle can still walk or use carried
fuel through normal travel preparation. Do not change actual fuel use/refuel units
in this slice; the vehicle/travel rules slice will supply that shared conversion.

Write failing npc-journey-budget-rules tests: exact default/custom/missing journey
estimates, quoted/absent Fuel, walking, multi-leg distance, equipment purchase
boundary and owned tools, drive threshold boundary/zero/empty tank/insufficient
cash, atomic validation, editor/summary/observation/design/reload. Browser: save all
five fields, reopen, inspect changed estimates and absent optional refuel choice
without transfers, reject invalid input, reload and inspect screenshots/errors.
Run new tests plus npc-projects, npc-drive, npc-feedback, npc-household,
npc-business-policy, fuel-sales and npc-guide. Require TypeScript, Prettier and
world-builder/NPC/README/imperative Unreleased docs before push.

Journey red: five checks fail for absent defaults/validation, fixed distance/speed/
price estimates, fixed eight-load equipment allowance and fixed refuelling
threshold. Isolate the tool supplier so a cheaper alternate quote cannot mask the
payback boundary. After implementation the zero-threshold test catches an early
return that skips empty-tank recovery; require positive tank fuel for that early
return and retain ordinary travel preparation when optional refuelling is off.
All five focused checks pass, including exact eight-load equality, custom and
zero values and missing-field defaults.

Journey gates pass: all 62 relevant checks in 6.4 seconds, TypeScript clean,
Prettier on changed files and diff checks clean. Browser passes in 20.6 seconds:
all five controls persist, estimates change from 25 seconds/625 hundredths to
40/1,000, the higher refuel threshold enables an affordable option, zero removes
it without changing fuel/cargo/cash, and negative input is refused across reload.
Inspect all three screenshots; no browser errors occur. No full suite runs.

Pushed and verified `fd6a221` on `backlog-implementation`. **Resident journey and
equipment budgets are done.**

### Gameplay rules — resident living advice and lodging offers

Before production, add `npcAdviceCashFloor` 12,000 hundredths (integer
0–100,000,000), `npcAdviceMealItems` 3 and `npcAdviceDrinkItems` 6 (integers
0–10,000) to Resident household forecasts, and `npcLodgingOfferRate` 600
hundredths/hour (integer 0–1,000,000, matching the ordinary rate bound) to Resident
pricing. Advice remains max(cash floor, observed meal price × meal items + observed
drink price × drink items); preserve the existing nutrition-value selection and
empty-source reporting. Zero removes the respective advisory component. Lodging
suggestions use the configured rate, including free zero-rate offers, only through
ordinary owner/innkeeper configuration. Rule edits never rewrite posted rates,
bookings or balances; renter descriptions keep actual posted rates. Missing fields
retain defaults. DailyLivingCost's 86,400-second normalization is a unit conversion
for a per-day figure, not an additional optional forecast horizon.

Write failing npc-advice-budget-rules tests for defaults/missing keys, exact custom
and zero advice, absent supplies, quote selection, lodging suggestion text and
operation, owner/qualification restrictions, ordinary configuration preserving
paid bookings and balances, invalid settings, editor/summary/observations/design
and reload. Browser: edit all four in their existing fieldsets, reopen, inspect
changed advice and suggested rate without a transfer, zero advice/rate, native
invalid input and reload, and screenshots/browser errors. Run new tests plus
npc-strategy, npc-adaptive, npc-household, npc-pricing-budget-rules (if present),
lodging and npc-guide; require TypeScript, Prettier and NPC/world-builder/README/
imperative Unreleased docs before push.

Advice red: all four tests fail for absent fields/validation and fixed 24,000
advice despite the configured 7,000 allowance. After implementation all four
pass, including empty-source advice, unchanged snapshots, exact posted-operation
rates, zero, ordinary configuration, paid bookings and ownership/qualification
restrictions. The relevant price suite is npc-pricing-rules; lodging behavior is
in living-world, so use those actual files rather than nonexistent planned names.

Advice gates pass: 64 relevant tests in 8.3 seconds, TypeScript clean, changed-file
Prettier and diff checks clean. Browser passes in 22.1 seconds with no errors:
all four fields persist, advice changes from 24,000 to 7,000 and zero, suggested
rates change to 800 then zero while the posted 200 rate remains intact, invalid
negative input is refused and saved zero survives reload. Inspect all three
screenshots in the household/pricing panels. No full suite runs.

Pushed and verified `a234b09` on `backlog-implementation`. **Resident living advice
and lodging suggestions are done.**

### Gameplay rules — existing resident currency conversion and account trade budgets

Before production, expose five integer policies in Resident account trade budgets:
`npcExchangeCashReserve` 20,000 hundredths (0–100,000,000),
`npcExchangeCreditLoad` 10 credits (0–1,000,000), `npcAccountTradeCreditReserve`
10 credits (0–1,000,000), `npcAccountTradeBuyLoad` 5 and
`npcAccountTradeSellLoad` 100 items (0–10,000). These govern existing account-based
currency conversion and station trade suggestions. Use the resident's current
local world for conversion and its saved last local world for off-world planning;
landing already changes that saved world. Calls without world context retain
JSON defaults. Zero load suppresses that optional leg; zero reserve removes only
the optional cushion. Preserve exchange caps/rates, actual station/ship/cargo
limits, courier cargo, normal credit charges and rescue eligibility. This slice
introduces no new travel mode or flight behavior.

Write failing npc-account-budget-rules tests for exact default/custom/missing/zero
buy and sell quantities and credit reserve boundaries, conversion cash/load/day
cap, current-world isolation and saved last-world selection, ordinary economic
execution/conservation, validation, editor/summary/observation/design/reload.
Use the existing resident choice flow for conversion/world-context checks.
Browser: save/reopen all five, observe changed/zero account trade suggestions
without transferring cargo/credits/cash, invalid input and reload; inspect
screenshots/errors. Run new tests plus npc-adaptive, npc-projects, npc-guide and
relevant account/universe/resident integration checks after identifying actual
file names. Require TypeScript, Prettier and NPC/world-builder/README/imperative
Unreleased docs before push. The excluded piloted-spaceflight work remains
unstarted and is not part of this slice.

Account red: missing defaults/validation, the fixed credit reserve and the fixed
local cash cushion fail. Isolate the port fixture from a crowded construction/
shopping menu to test conversion itself. Four checks pass after implementation.
A new large-load check then reproduces 120 suggested items against the ordinary
100-item account transaction ceiling. Share that existing ceiling between execution
and planning, then verify courier hold reservation too. Do not change its value or
any rescue, ship, mission or travel behavior.

Account-budget gates pass: 48 relevant tests in 5.7 seconds, including existing
galactic transaction/persistence checks and new resident current/last-world
integration. Browser persistence, five-item to two-item and zero suggestions,
unchanged credits/cargo/cash, invalid input and reload pass in 20.6 seconds; inspect
all three screenshots, with no browser errors. TypeScript catches three test-only
filter predicates that need explicit operation narrowing; annotate those types
and rerun TypeScript cleanly without repeating unaffected runtime/browser gates.
Changed-file Prettier and diff checks are clean. No full suite runs.

Pushed and verified `1f2893a` on `backlog-implementation`. **Existing resident
account trade budgets are done.**

The NPC reserve/budget audit is complete for the listed scope. Remaining numeric
menu-ranking weights, candidate tax/price adjustments and scheduling/API limits
are not spending reserves or budgets. Existing action constraints (room capacity,
rescue eligibility, service ranges and actual biological/vehicle costs) remain
shared gameplay constraints; the listed gathering/production and vehicle rules
below still need their own implementation. Valid ordinary producer budgets make
the legacy 20,000 fallback branches unreachable; no new rule is added for dead
fallback behavior. Loan tables, limits and credit weights have been exposed;
loan delinquency lifecycle changes are not among this entry's named loan tables.

### Gameplay rules — construction clearances, placement reach and refunds

Before production, add Construction rules: `constructionMinimumSpacing` 12 m,
`constructionPlacementReach` 4 m, `spawnClearance` 12 m and
`townCentreClearance` 8 m (each 0–1,000 m), plus `constructionRefundShare` 0.75
(range 0–1). Missing fields use shared JSON defaults. Spacing retains the existing
strict greater-than centre-distance comparison and separate oriented footprint
checks. Placement reach retains its inclusive boundary for remote shoreline sites.
Spawn and town clearances protect rotated footprints/fields/pastures through the
shared reservation helper; explicit spawn-zone radii remain their own settings.
The one spawnClearance field also covers the later duplicate 12 m spawn-clearance
bullet. Refunds remain floored shares of the recorded base cash cost, never tax,
delivered materials or an edited asking price; old receipt-less saves retain the
conservative base-value rule. Zero removes only that buffer/reach/refund; footprint
collisions, terrain, reservations, permissions and funds remain enforced.

Write failing construction-rules tests for exact default/missing/custom/zero and
boundary behavior, server construction/shoreline reach, shared spawn/town geometry,
NPC site selection, recorded/legacy refunds and atomic invalid settings, summary,
editor, observations, designs and reload. Browser: save/reopen fields, see changed
spacing refusal in the build preview and server acceptance after moving clear,
see the configured refund percentage and amount, cancel once and verify cash,
see zero refund and invalid input/reload; inspect screenshots and browser errors.
Run new tests and affected construction-site/spawn-reserve/construction-cancel,
civics-construction, npc-construction, farm/pasture reservation tests and guide
request-size regression. Require TypeScript, Prettier, player/world-builder docs,
README and imperative Unreleased entry before push. Expansion multipliers and
farm/pasture sizes follow as separate slices.

Construction red: all seven initial checks fail for absent defaults/validation,
fixed spacing/reach/reservations/refunds and NPC site selection. Add an eighth
check for shoreline site search and confirm the same spacing gap there before
changing it. All eight now pass; refund tests include original receipts, edited
prices, delivered materials, conservative legacy bases, zero and duplicate
cancellation. Run the focused regressions and browser placement/refund flow next.

Construction regression gates pass: 55 relevant checks in 6.0 seconds, clean
TypeScript and changed-file Prettier. Default desktop/phone cancellation passes
in 17.1/13.9 seconds; the custom placement/refund/invalid-input flow passes in
32.3 seconds. Adjust screenshot scrolling to expose the refusal and invalid field;
that flow passes again in 33.9 seconds. Inspection shows all fields, the refusal,
custom refund and zero-refund panel clearly, with no browser errors.

A final percentage-formatting regression reproduces 28.999999999999996% for a
0.29 share. Use a shared display formatter without changing calculation precision.
All 24 construction/guide checks and TypeScript pass after that fix. The browser
rerun terminates with exit 143 before a test result; retry the affected flow using
29% and zero. Do not repeat the unrelated gates.

The final browser retry passes in 33.8 seconds: 29% is displayed cleanly and the
ordinary refund matches the recorded cost; zero refunds, walking clear to build,
settings persistence and invalid-input refusal all pass without browser errors.
Inspect the updated refund screenshot. All slice criteria are met; no full suite
was run and no live state was touched.

Pushed and verified `c714a98` on `backlog-implementation`. **Construction clearances,
placement reach and cancellation refunds are done.**

### Gameplay rules — construction expansion cost multipliers

Before production, add `expandedConstructionCostMultiplier` 1.55 and
`largeConstructionCostMultiplier` 2.15 to Construction rules, each 1–10 with
fractional values. One means no expansion surcharge; retain ordinary base and
finish/model costs and materials. The lower bound keeps expansion from costing
less than the same standard shell. Store defaults only in settings JSON. Both
cash and material bills use the configured size multiplier with existing ceiling
rounding; capacity, geometry, room counts, specialist inputs and standard-size
quotes remain unchanged. Existing buildings/sites retain recorded prices,
materials and capacity when rules change. Missing fields retain shipped defaults.

Write failing construction-expansion-rules tests for default/missing/custom/unit
multipliers, ceiling rounding, unsupported sizes, exact server base/tax/materials,
refund from the recorded design cost, no rewriting existing sites, validation,
editor/summary/observation/design/reload. Browser: save/reopen both, select Expanded
and Large in Build, compare visible cash/materials and stored foundation bill,
see normal insufficient-cash refusal, unit multiplier, invalid input/reload;
inspect screenshots and browser errors. Run new tests, building-designs,
building-architecture, construction-cancel, construction-rules, civics-construction,
npc-construction and npc-guide (manual changes). Require clean TypeScript,
changed-file Prettier, player/world-builder/README and imperative Unreleased docs.
Farm limits and pasture dimensions remain the next slice.

Expansion red: all three tests fail for absent defaults/validation and a fixed
124,000 base charge against the configured 240,000. All three pass after sharing
world multipliers with quote and placement. Default/context-free geometry callers
retain their size metadata without additional rule resolution. Browser and focused
regression gates follow.

Expansion gates pass: 61 relevant checks in 8.3 seconds, browser in 22.3 seconds.
The browser saves/reopens both rules, displays 3× Expanded and 4× Large bills,
refuses the unaffordable Large foundation without charging, persists a 1× Large
setting after rejecting zero, and places the Expanded foundation for exactly its
quoted cash/material bill. Inspect all five screenshots; no browser errors.
TypeScript identifies an unreachable fallback after the standard-size early
return; remove that dead branch and rerun TypeScript cleanly. Changed-file
Prettier and diff checks pass. No unaffected runtime/browser tests are repeated.

Pushed and verified `668adea` on `backlog-implementation`. **Construction expansion
cost multipliers are done.**

### Gameplay rules — maximum farm plots

Before production, add `maximumFarmPlots` (default 16) to Construction rules;
validate multiples of four from 4 through 64. Four retains the starting parcel
and disables further expansion. Buying still adds four plots, charges the existing
increasing land price and checks the full reserved land. Lowering the cap must not
remove purchased plots, planted crops or access to them. Saved counts above 16
must remain usable and rendered, with terrain/roads/property reservations intact.
Missing settings retain 16. Preserve the farm's purchased plot count in portable
designs as well as saves; designs still omit active crops and operating stock.

Write failing farm-plot-limit-rules tests for defaults/missing keys, 4/8/20 caps,
64-count support, invalid/fractional/non-four values, exact one-time charges,
blocked/unauthorized/poor expansion, planting and harvesting the twentieth plot,
lowered-cap preservation, field geometry/road reservation and design/save reload.
Check editor/summary/observation values. Browser: edit/reopen the rule, buy the
fifth parcel from a sixteen-plot fixture, inspect 20 field cards and the new land,
see the cap message with no purchase button, lower to four without losing land,
reject invalid six, and verify reload. Run new tests plus hay, farming, spawn-reserve,
npc-farm-budget-rules, npc-hay and npc-guide; TypeScript, changed-file Prettier,
player/economy/world-builder docs, README and imperative Unreleased are gates.
Pasture parcel dimensions follow separately.

Farm limit red: defaults/validation are absent, expansion stops at the fixed 16
cap, and the twentieth plot is absent from land reservations. Correct the owner
fixture to make the nonowner a worker so it reaches the owner-only purchase
check; then it exposes the fixed-cap error for the other scenarios. All five
checks pass after implementation. Compare serialized crop records without
undefined-only properties because JSON intentionally omits those keys; crop
content, dates and care values still compare exactly.

Farm-limit gates pass: 46 relevant checks in 11.7 seconds, clean TypeScript,
changed-file Prettier and diff checks. Browser passes in 29.5 seconds with no
errors: purchase the fifth parcel for 450d, show 20 cards and the cap refusal,
lower to four without removing fields, reject six as a non-four increment, and
retain four/20 across reload. Inspect all five screenshots, including the new
rows of field geometry and the twentieth fallow plot. No full suite runs.

Pushed and verified `d5d4868` on `backlog-implementation`. **Maximum farm plots
are done.**

### Gameplay rules — pasture parcel dimensions

Before production, add `pastureParcelSize` (default 16 m), integer 8–64, to
Construction rules. Save the chosen dimension on each newly claimed pasture;
legacy parcels without a saved size retain the shared JSON default. Changing the
rule must not move existing fences, claim occupied land, move animals or alter
capacity/price. Adjoining expansion uses that pasture's recorded dimension.
Reservations, rotated fences, road obstacles, grazing routes and displayed areas
must use the same dimension. Keep the four-parcel maximum, gate width, capacity
multiplier, price rules and ordinary permission/funds/clearance checks unchanged.
Include odd dimensions in boundary sampling; no unsampled outer edge may admit
water or property. Existing empty/no-clear-parcel states remain usable.

Write failing pasture-size-rules tests for default/missing/custom/legacy dimensions,
8/21/64 geometry and rotation, cache invalidation, full boundary reservations,
paid expansion with correct area, rule edits preserving old land and herds,
animal paths inside fences, invalid input, editor/summary/observations/design/save
reload and empty blocked siting. Browser: save/reopen rule, inspect a new 20 m
pasture and its 400 m² offer, buy adjoining land and see 800 m²/fences, change rule
without resizing that pasture, inspect a barn with no clear land, reject invalid
input/reload, and inspect screenshots/errors. Run new tests plus pastures,
spawn-reserve, road-projects, npc-livestock and relevant animal/render tests after
identifying actual files, plus npc-guide for player docs. Require TypeScript,
Prettier, player/world-builder/README and imperative Unreleased before push.

Pasture-size red: all five checks fail for absent defaults/validation, fixed
16 m geometry, a 512 m² message instead of 800 m², and missed outer-edge
obstructions. All five pass with stored dimensions and endpoint-inclusive
sampling. Legacy plots retain 16 m; new plots use the selected rule and ordinary
expansion preserves that recorded size and existing capacity/prices.

Pasture-size gates pass: 47 relevant checks in 6.7 seconds, TypeScript clean,
changed-file Prettier/diff checks clean. Browser passes in 36.6 seconds: save/reopen
20 m, quote and purchase 400 m² adjoining land for the ordinary 250d, show 800 m²,
retain that size after switching new parcels to 8 m, reject seven and preserve
8 m across reload, show the no-clear-land state and render the enlarged fence
with both cows inside. Inspect all six screenshots; no browser errors occur.
The actual livestock suites cover resident herd choices; no npc-livestock test
file exists. No full suite runs.

Pushed and verified `7563245` on `backlog-implementation`. **Pasture parcel
dimensions are done.** The listed construction constants are now world rules.

### Gameplay rules — gathering yields and durations

Before production, add Gathering rules: `gatheringBaseYield` 3 and
`gatheringSkilledYield` 6 (integer 1–1,000), `gatheringBaseSeconds` 20 and
`gatheringSkilledSeconds` 12 (integer 1–600). Positive values prevent empty loads
or zero-time repeat loops. Forester/excavator eligibility selects yield and time
independently; an unskilled yield of six must not accidentally get the skilled
duration. Missing fields retain defaults. Existing in-progress reservations keep
their recorded amount/end; new tasks and repeats use current rules. HUD, resource
menu and resident capacity/availability/batch/time estimates use the same rate.
Keep implements, node capacity/regrowth, permissions, cargo, cancellation returns
and ordinary task completion intact; their named rules follow in later slices.

Write failing gathering-rate-rules tests for defaults/missing fields, swapped
3/6 amounts with independent durations, exact reservation/completion/cancellation,
in-flight rule edits, shortage/cargo refusal, NPC career load/duration and general
gathering choice eligibility, invalid settings, editor/summary/observations/design/
reload. Browser: save/reopen all four, see changed HUD/menu rates, perform an
ordinary timed gather, inspect depleted and missing-implement refusals, reject
invalid input and reload; inspect screenshots/errors. Run new tests plus resources,
repeat-gathering if present, npc-projects, npc-construction, npc-journey-budget-rules
and npc-guide; require TypeScript, Prettier and player/economy/world-builder/README/
imperative Unreleased docs before push.

Gathering-rate red: correct the test-only journeyEstimate import, then all five
checks fail for missing defaults/validation, fixed rates, shortage checks and NPC
choices. All five pass after sharing the skill-selected rate. Swapping basic and
skilled yields verifies that duration selection does not depend on the number
six; edits retain active reservations/end times and cancellation returns once.

Gathering-rate verification: 42 relevant checks pass (new rates, resources,
npc-projects/construction/journey budgets and guide) in 4.4 seconds; the actual
repeat-gathering coverage is first-steps-controller, whose three checks pass in
0.7 seconds. Browser passes in 34.6 seconds through saved rates, HUD/menu, ordinary
timed completion, depletion, skill, missing implement and invalid input/reload.
Review catches a carried-sale edge case: a larger skilled load must not hide a
sale of carried goods under a smaller transaction limit. A sixth test fails for
that reason; fix the candidate filter and all 15 rate/career tests pass in 1.7
seconds. TypeScript fixture assertions need optional-map and action narrowing;
correct test types and the subsequent typecheck passes.

Inspect all six screenshots. Their menu introduction still promises that school
always doubles yield and shortens time, which is false for custom rates. Before
correcting that text, extend the browser check to require wording that describes
selection of the world's skilled load and time; retain the actual displayed
numeric assertions. Run that browser regression red, then correct the introduction
and rerun only the affected browser flow and TypeScript.

The browser assertion fails on the old unconditional school promise, then passes
with the corrected introduction (33.5 seconds). Inspect the updated menu capture:
text and configured numeric load/time are readable. The other five visual states
were inspected before this text-only correction. TypeScript and changed-file
Prettier/diff checks pass. No full suite runs.

Pushed and verified `5554b32` on `backlog-implementation`. **Gathering yields and
durations are done.**

### Gameplay rules — deposit capacities and regrowth

Before production, transcribe the backlog's node capacities (18 logs / 30 others)
and regrowth seconds (1,800 / 600), beyond the existing recovery multiplier, into
`resourceLogsCapacity`, `resourceOtherCapacity` (integer 1–10,000), and
`resourceLogsRegrowthSeconds`, `resourceOtherRegrowthSeconds` (integer 10–86,400).
Use the JSON defaults once. World rules govern generated and saved grounds with
standard survey values; preserve an authored non-default capacity or interval as
a per-ground override. Do not change stable IDs, locations, scenery or the
three-unit recovery increment. Missing rules keep shipped behavior.

An owner edit must settle earned stock under the old pace, preserve partial
interval progress under the new pace/multiplier, and cap stock at the new capacity.
Increasing capacity must not mint stock in untouched or depleted grounds; new
headroom refills normally. Simultaneous edits must use one old-to-new transition.
Existing reserved loads retain their amount/time, cancellation returns once up
to current capacity, and offline recovery remains finite and capped. Cache changes
must update HUD/menu and resident availability immediately. Preserve custom survey
overrides in saves and portable designs.

Write failing resource-deposit-rules tests for default/missing fields, generated
and saved grounds, custom overrides, cache refresh, old/new earned stock and
fractional progress, simultaneous changes, capacity decrease/increase, untouched
stock, cancellation, invalid atomic patches, settings/editor/summary/observation,
portable designs and save/offline reload. Run explicit relevant files with
`node_modules/.bin/tsx --test --test-concurrency=2`: new deposit tests, resources,
resource-patches, resource-expansion, gathering-rate-rules and npc-guide. Browser
`TEST_GPU=1 npm run test:e2e -- tests/browser/resource-deposit-rules.spec.ts` must
save/reopen rules, display changed capacity in HUD/Resources, show depleted refusal,
recover and gather after the configured interval, reject invalid input/reload,
and expose an empty gathering list without errors. Inspect screenshots. Require
clean `npx tsc --noEmit`, changed-file Prettier/diff checks and updated player,
economy/world-builder/README and imperative Unreleased notes before commit/push.

Deposit red: all five new tests fail on missing defaults, unchanged stock and
unknown settings. Keep raw survey geometry/values stable and resolve live limits
when reading status/stock; this avoids rewriting frozen surveys into accidental
per-ground overrides and preserves cached node references. The same resolver
must compare scenery depletion against the effective capacity.

Deposit implementation: all five tests pass after correcting the new transition
import. The 45 relevant checks pass in 8.0 seconds, including resource-scenery
because its depletion comparison now uses effective capacity. Browser passes in
37.4 seconds; TypeScript and formatting pass. Inspect rules, recovered stock,
invalid input and the empty-list captures. The depleted capture precedes the HUD's
return after closing the editor; strengthen the test to await HUD visibility and
assert `0/9 available`, then rerun that flow for usable evidence.

Review adds a sixth regression: shrinking an untouched full deposit must not
mark it recently worked. It fails (`worn` instead of `natural`); avoid creating a
depletion record when an untouched capacity stays equal or shrinks. The six
deposit, six resource and 15 guide checks pass in 2.4 seconds after this change
and the economy-doc clarification of base intervals versus the multiplier.
TypeScript is clean again. The earlier geometry/travel tests need no rerun for
this narrowly scoped stock-transition branch.

The strengthened browser flow passes in 36.2 seconds, showing a visible depleted
`0/9` HUD, then three recovered units, ordinary gathering, invalid-input rejection
with persisted settings and an empty list without browser errors. Inspect the
replacement depleted screenshot and confirm readable refusal/disabled controls.
All slice gates pass; changed files are formatted and the diff is clean. No full
suite runs.

Pushed and verified `182f6b3` on `backlog-implementation`. **Deposit capacities
and regrowth are done.**

### Gathering-rate follow-up — resident experiments

Before the next rule family, inspection of implement consumers reveals a missed
consumer of gathering rates: `inventHypotheses` still checks, sells and values a
fixed three units. Fix this gap to the gathering-rate criteria before proceeding.
An experiment must require enough stock/cargo for the actual skill-selected load,
then sell no more than that load, the existing transaction/experiment limits,
buyer funds and buyer space. Zero experiment allowance suppresses the experiment.
Keep ordinary timed gathering and sales; do not change tools or other ideas yet.

Extend gathering-rate-rules with a failing experiment regression for a two-unit
load, skilled load refusal, small transaction limits, buyer capacity/cash and zero
allowance. Execute its actual gather/completion/sale and assert inventory/cash.
Run gathering-rate-rules, npc-hypotheses and npc-experiment-budget-rules, then
TypeScript, changed-file Prettier/diff checks. This is server planning only; the
unchanged player gathering UI already passed both rate/deposit browser flows.
Update imperative Unreleased and review/update README and world-builder guidance.

Experiment-rate regression initially also encounters the planner's existing
four-ground candidate cap. Isolate the intended ground by depleting other fixture
grounds; rerun against the original committed planner and confirm it still fails
because two units cannot satisfy its fixed-three check. Restore the implementation:
all seven gathering checks pass in 0.74 seconds, including actual gathering/sale,
skilled/cargo refusal, small limits and buyer constraints. The other 17 hypothesis/
experiment checks passed in the preceding targeted run; production is unchanged
since that run. TypeScript and formatting pass; no browser rerun is required for
this server-only consumer fix.

Pushed and verified `19cb71a` on `backlog-implementation`. **Resident experiment
gathering-rate coverage is done.**

### Journey-rule follow-up — resident refuelling experiments

The same consumer audit finds an optional refuelling experiment still using a
literal ten-unit threshold instead of `npcDriveFuelThreshold`. Before production,
require it to follow the existing rule/default: below threshold permits a funded
fuel purchase or carried-fuel use, equality does not, and zero suppresses optional
purchases. An empty tank may still use carried fuel when the threshold is zero,
as the existing drive planner does. Keep shop funds/stock and normal use actions.
Extend npc-journey-budget-rules with a failing hypothesis check for defaults,
missing fields, custom/equality/zero values and carried-fuel recovery. Run that
file and npc-hypotheses, TypeScript and changed-file Prettier/diff checks. This is
server planning only, with no UI/rendering change. Update imperative Unreleased,
README and world-builder guidance; no new rule/default or release heading.

Refuelling-experiment red: the new assertion fails at a custom threshold of 20
with 15 tank units, because the planner still uses ten. Replace the literal with
the shared journey rule and retain a separate carried-fuel path for an empty tank.
All 17 journey/hypothesis checks pass in 1.1 seconds, including ordinary fuel use;
TypeScript, changed-file formatting and diff checks pass. No UI or full-suite run.

Pushed and verified `55ebcb8` on `backlog-implementation`. **Resident refuelling
experiment coverage is done.**

### Gameplay rules — gathering implements per material

Before production, make each material's implement requirement a world rule:
`gatheringLogsImplement` defaults to `chainsaw`, `gatheringStoneImplement` to
`pickaxe`, and `gatheringGravelImplement`/`gatheringDirtImplement` to `shovel`.
Allow `none` or one of those three existing gathering implements. A required
implement remains reusable; workshop tools do not become gathering implements.
Missing rules retain defaults. New tasks use current requirements; started tasks
retain their reservation and finish time. No change to rates, stock, cargo,
permissions, movement or ordinary completion/cancellation.

The HUD and Resources menu must name current requirements. F10 must expose four
selectors and preserve them on reopen/reload. Resident career, general, experiment
and construction procurement plans must use the configured implement (or no
implement), without buying disabled requirements or producing an undefined item.
A rule edit never grants a tool. Validate unknown values atomically and preserve
values through saves, portable designs, summaries and observations.

Write failing gathering-implement-rules tests for every default/missing/custom/
none requirement, wrong/missing tools, reuse, mid-task edits and ordinary remaining
refusals, all four resident planning consumers and tool-shopping choices, invalid
settings and persistence. Run the new tests, resources, gathering-rate-rules,
npc-projects, npc-construction, npc-hypotheses and npc-guide as relevant consumers.
Browser `TEST_GPU=1 npm run test:e2e -- tests/browser/gathering-implement-rules.spec.ts`:
save/reopen all selectors, change topsoil to pickaxe and see wrong/missing-tool
HUD/menu refusal, choose none and complete a normal gather without that implement,
inspect depleted refusal and persistence across reload; inspect screenshots/errors.
Require TypeScript, changed-file Prettier/diff checks, player/economy/world-builder/
README documentation and imperative Unreleased before commit/push.

Implement-rule red: all four new tests fail on missing defaults/unknown settings.
The shared resolver replaces the fixed per-material map; all four pass, including
custom procurement and no-implement routes in career, general, experiment and
construction planners. No inventory entries are fabricated for a disabled tool.
The 54 relevant checks pass in 5.1 seconds; TypeScript is clean and changed files
are formatted. Browser verification remains before commit.

Implement browser passes in 28.4 seconds: saved selectors, current pickaxe refusal
with a shovel and then an empty inventory, menu requirements, ordinary no-tool
gather, depletion, tampered-selector rejection and persisted reload. Inspect all
six screenshots. Apply the editor's existing full-width fieldset class to avoid
a narrow single-column group. Rerun only browser/typecheck for that layout change:
browser passes in 27.7 seconds, TypeScript stays clean; inspect the corrected
full-width rules capture. Formatting/diff checks pass and no browser errors occur.
No full suite runs.

Pushed and verified `d940a91` on `backlog-implementation`. **Per-material gathering
implement requirements are done.**

### Gameplay rules — compost bonus and rotation penalty

Irrigation requires clarification before implementation: the backlog names +33%,
but shipped irrigation changes moisture using rain/thirst/water and multiplies
yield by 0.6–1.0; only compost uses a fixed +33%. Ask Henry whether to preserve and
expose that formula or replace it with a +33% bonus. Leave irrigation pending;
these two independent crop modifiers can proceed without deciding that question.

Before production, add `farmCompostYieldBonus` default 0.33 (fraction 0–5) and
`farmRotationYieldPenalty` default 0.2 (fraction 0–1). Compost multiplies the
existing weather/moisture-adjusted crop yield by one plus its bonus; repeating
the previous crop family multiplies it by one minus the penalty. Retain existing
floor rounding and minimum one unit. Zero removes only that modifier, and missing
fields retain shipped defaults. Existing compost applications remain recorded;
new estimates and harvest reservations use current rules, while a started harvest
retains its already-reserved quantity. Soil restoration still clears the previous
family and consumes the same real goods; irrigation/weather/crop timing stay intact.

Player estimates and fertilizer bonus text must use these values. Both ordinary
resident farm choices and the serial farmer routine must avoid spending compost
or money when its bonus is zero, and their fertilizer value estimate must use the
configured bonus. Permissions, staff budgets, real inputs and import price remain.
Write failing farm-yield-rules tests for defaults/missing fields, zero/custom
bonuses/penalties with floor rounding, same/different families, real compost and
soil restoration, reservations, resident decisions, invalid input and all rule
persistence/editor/summary/observation paths. Run new tests plus farming,
farm-supplies, farm-policy, actual NPC farmer suites and npc-guide. Browser must
save/reopen both rules, fertilize a growing plot with real compost, see the custom
bonus/estimate, show the empty plot and no-compost/funds refusal, reject invalid
input/reload, and inspect screenshots/errors. TypeScript, changed-file Prettier,
player/economy/world-builder/README and imperative Unreleased remain required.

Include the farmer's rotation tie-break: when demand ties and the penalty is zero,
choose by the existing seed-cost tie-break instead of avoiding the prior family.
All five initial farm-yield tests fail on absent defaults/unknown settings before
production. The additional rotation assertion uses empty plots with previous hay:
default penalty prefers wheat, zero penalty permits cheaper hay.

All five farm-yield checks pass after implementation; the 46 relevant checks pass
in 12.8 seconds, including harvest-all reservations, offline catch-up, staff budgets,
resident farm behavior and the guide budget. TypeScript catches the farm panel
referencing `w` where this renderer uses `world`; correct that reference before
accepting the browser result. Do not rerun unaffected simulation tests for this
renderer-only correction.

The initial browser run cannot update the fertilizer label because of that bad
reference. Correct it; browser passes in 27.9 seconds and TypeScript is clean.
Replace stale hard-coded fertilizer prices in the player/economy docs with the
catalogue-price source; all 15 guide checks pass in 1.3 seconds. Inspect all five
screenshots. Show the configured rotation percentage in the farm introduction
(including zero), and wait for the refusal toast's opacity/colour transition before
capturing it. The affected browser flow passes in 27.4 seconds after that change;
TypeScript and formatting stay clean. Inspect the final crop/refusal captures:
50% fertilizer bonus, 25% repeated-family penalty, estimated 67 units after one
real compost, and a readable no-compost/funds refusal. Empty plots and invalid
input/reload also pass, with no browser errors. No full suite runs.

Pushed and verified `e49cef4` on `backlog-implementation`. **Compost bonus and
crop-rotation penalty rules are done.**

### Stopped pending irrigation clarification

The next unresolved crop rule cannot yet have an unambiguous default acceptance
criterion. `BACKLOG.md` names a +33% irrigation bonus, while `cropStatus` computes
moisture from rain, crop thirst and watering, then scales yield by `0.6 + 0.4 *
moisture`. The resulting watering benefit varies by crop and weather; there is no
fixed +33% irrigation value to expose. Only compost had the fixed 1.33 multiplier,
now implemented as its world rule.

Henry's decision is pending: preserve the shipped irrigation formula and expose
its existing values, or replace that behavior with a +33% irrigation bonus. No
irrigation production change or acceptance test has been made. Do not treat the
unanswered question as approval. Stop here and wait before continuing the remaining
hard-coded rules or later Planned sections. All completed slices above are pushed,
unreleased, tested within their relevant scope and recorded; the full backlog
is not complete. Piloted spaceflight remains excluded and unstarted. No PR,
version bump, deployment, live-server edit or player grant has occurred.

### Irrigation decision resolved — preserve the existing formula

Henry chose to preserve and expose the shipped irrigation formula and make it fully
configurable in world-building. The previous stop is resolved; the backlog's
“+33% irrigation” shorthand does not replace the formula with a fixed bonus.

Before production changes, completion criteria for this slice:

- Preserve default and missing-setting results for all seven crops and both clear
  and rainy weather: moisture = min(cap, (rainFraction × rainContribution +
  baseline + treatments × treatmentContribution) / cropThirst); yield moisture
  multiplier = dryYield + moistureYield × moisture. Defaults remain cap 1,
  rainContribution 0.9, baseline 0.25, treatmentContribution 0.25, dryYield 0.6,
  moistureYield 0.4. Move each crop's existing thirst default into the same JSON
  settings source; expose all seven separately with positive denominators.
- Expose water per treatment (3) and maximum treatments (3), integral rules.
  Allow zero cost; zero treatments disables watering. Consume farm stock before
  personal water, refuse insufficient supplies/empty or ripe plots/the limit,
  and leave balances and treatment counts unchanged on refusal. A lower limit
  preserves recorded treatments. Existing harvest reservations keep their yield.
- Both resident farm planners use the same cost and limit, including zero and
  limits above three, while retaining drinking reserves and ordinary permissions.
- Validate finite ranges, integer counts and positive thirst; reject an invalid
  mixed patch atomically. New worlds, legacy fallbacks, F10 fields, rules summary,
  NPC observations, save/reload and portable design round-trips agree.
- Add `tests/farm-irrigation-rules.test.ts`, run it before production and record
  the actual red failure. Run it and relevant farming, supplies, policy, winter,
  harvest-all, farmer, crop-yield and guide tests after implementation. Run
  `npx tsc --noEmit` and Prettier on every changed path.
- Browser: `TEST_GPU=1 npm run test:e2e -- tests/browser/farm-irrigation-rules.spec.ts`.
  In an isolated world edit F10 crop yield rules, save/reopen/reload; open a farm,
  see a changed moisture/yield estimate and local water price, perform watering
  with real stock, inspect a fallow plot, and show insufficient-water and
  treatment-limit refusals. Reject invalid zero thirst and retain saved values.
  Inspect screenshots of these states. Update player/world-builder/economy docs,
  README and Unreleased changelog; commit/push only this coherent slice.

Failing-first result: the legacy formula test passes for all seven crops in clear
and rainy weather; four new-rule tests fail because `farmIrrigationBaseline` is
absent and the settings action rejects the custom patch as `Unknown setting`.
The first run also exposed an invalid test-only weather enum (`default`); corrected
it to the supported `rain` fixture and reran before any production edits.

Irrigation validation complete: 56 targeted tests passed (16.3 s), including the
new formula/rules tests, farming, supplies, policy, winter, harvest-all, resident
farmer and guide budget tests. A further consumer audit found the farm button's
fixed three-treatment visibility cap; an additional regression failed `false !==
true` for a configured fourth treatment before fixing that consumer. The final
12 irrigation/action-visibility tests pass (1.3 s). TypeScript is clean after the
final change; Prettier and `git diff --check` pass.

The final affected browser flow passes (29.0 s), with all six screenshots inspected:
F10 saved/reloaded values; real watering moves 10%/15 units to 40%/24 units and
consumes one stocked plus one carried water; a limit of one hides the completed
care action and explains “watering limit reached”; missing supplies refuse with
the local two-water quote; fallow plots have no watering action; zero thirst is
rejected and reload retains one. The original browser run also exercised the
server's limit refusal before correcting visibility. Server tests retain explicit
limit, empty and ripe refusal coverage. No acceptance criterion was weakened.

**Irrigation slice done and pushed:** `ac1df60de1fba21af24ee9a0a1eecc58b4ae29a4`.
Remote branch SHA verified. Henry's formula decision is implemented; the earlier
irrigation stop is closed. Continue the remaining hard-coded rules in order.

### Ripe-quality rules — completion criteria before production

The entry names “the ripe-quality window (six real hours, up to 35% loss)”. Expose
`farmRipeQualitySeconds` (21,600), `farmLateMaximumLoss` (0.35) and the existing
`farmLateLossPerDay` (0.005). Keep the shipped formula's arithmetic order:
`max(1 - maximumLoss, 1 - max(0, age / DAY_SECONDS - window / DAY_SECONDS) × lossPerDay)`.
Days here are the existing 600-second crop/calendar day; the window is real seconds.

- Default and missing-rule worlds retain exactly the same yields before, at and
  after the six-hour boundary and at the capped loss. Custom settings change only
  that factor. Zero loss rate or maximum loss disables lateness loss; zero window
  starts loss immediately after ripening. Winter still kills unharvested crops.
- Validate finite values: window integer 0–604,800 seconds, maximum loss 0–1 and
  loss rate 0–1 per game day. Invalid mixed patches change nothing. Persist in
  saves/designs; include in F10, rule summaries and resident observations.
- New harvests use current estimates; an already reserved harvest retains its
  amount. Empty plots remain empty and winter crops cannot be harvested.
- Add `tests/farm-ripe-quality-rules.test.ts`, confirm the missing-setting failure,
  then run that test with the affected farming, winter, harvest-all and guide tests.
  Run TypeScript, changed-file Prettier and diff checks.
- Browser `TEST_GPU=1 npm run test:e2e -- tests/browser/farm-ripe-quality-rules.spec.ts`:
  save/reload custom rules in F10, inspect a ripe crop's changed estimate and
  updated quality-window/loss help, inspect a fallow plot, refuse harvesting with
  a full store, reject an out-of-range loss and preserve saved values. Inspect
  screenshots. Update the player/world-builder docs, README and Unreleased changelog.

Failing-first: one default/boundary test passes; three new-rule tests fail on
`Unknown setting` or missing `farmRipeQualitySeconds`. Inspection confirms winter
expiry deliberately clears the plot before refusing care; the winter regression
checks the unchanged no-harvest/no-task behavior, not preservation of a dead crop.

Ripe-quality validation so far: all 35 relevant tests pass (13.9 s), covering the
new rules, ordinary farming, winter expiry, harvest-all and guide request budget;
TypeScript, changed-file Prettier and diff checks pass. The first browser run
failed because the fixture's negative planting date fell in winter and correctly
showed “Crop lost to winter.” Move only the isolated fixture clock into spring,
keeping the same 18-day crop duration and 30-minute age; rerun the affected browser.

Final browser flow passes (27.6 s). All six states have been visually inspected:
custom saved rules, 48-unit ripe estimate, dynamic 600-second/10%/50% help, fallow
plots, full-stockroom refusal and invalid maximum-loss input with saved value
retained. The second fixture correction acknowledged that choosing Harvest already
closes its dialog before the stockroom refusal; the test now asserts that state
instead of trying to close an absent dialog. Production criteria are unchanged.
Final TypeScript and formatting checks pass; no unrelated test suite was rerun.

**Ripe-quality slice done and pushed:** `1a35ad2edb07fea16f92f93fddd862308ca4783a`.
Remote SHA verified. Continue with the entry's frost sensitivity scaling.

### Crop frost rules — completion criteria before production

Preserve the current frost factor `max(0.35, 1 - frostDays / cropDays × sensitivity)`.
Expose maximum frost loss (0.65) and each existing crop sensitivity (wheat 0.25,
potatoes 0.7, hops 0.5, grapes 1, tea 0.4, coffee 1.3, hay 0.2) as world rules.
Move the sensitivity defaults from crop JSON into settings JSON without a second
production copy. Keep the existing below-zero frost-day test and winter expiry.

- Default and legacy yields match for all seven crops in clear and frozen weather;
  custom sensitivities change their own crops, cap losses, and preserve the minimum
  one-unit yield. Zero sensitivity or maximum loss disables frost yield loss.
  New harvests use current estimates; started harvests retain reserved amounts.
- Validate sensitivities 0–5 and maximum loss 0–1; reject nonfinite/out-of-range
  mixed patches atomically. New worlds, editor fields, summaries, NPC observations,
  saves and portable designs agree, with JSON defaults for absent fields.
- Add `tests/farm-frost-rules.test.ts`, run failing before production, then run the
  new test and affected irrigation, farming, winter, harvest-all and guide tests.
  TypeScript and changed-file Prettier/diff checks must pass.
- Browser `TEST_GPU=1 npm run test:e2e -- tests/browser/farm-frost-rules.spec.ts`:
  save/reload F10 sensitivities and cap, inspect the resulting crop estimate and
  displayed frost rules in an isolated snowy spring, inspect a fallow plot, reject
  an invalid loss cap and retain saved values. Inspect screenshots. Document
  rules in player/world-builder docs, README and Unreleased changelog.

Failing-first frost result: the all-crop default/legacy comparison passes; three
new-rule tests fail on absent `farmFrostMaximumLoss` and `Unknown setting`, before
production edits.

The crop catalogue is also read by resident guide lookup. Preserve its default
thirst and frost information after moving those values into world settings: a
`crop:coffee` lookup must still include 0.7 thirst and 1.3 frost sensitivity and
identify the settings source. Add a failing guide regression before updating
that consumer; do not duplicate the defaults or remove guide information.

Frost validation complete: all 41 affected tests pass (14.4 s). The guide consumer
regression first failed because `crop:coffee` lacked `"thirst":0.7`; its lookup now
resolves thirst and frost from the shared settings defaults and cites that source.
All 16 guide tests then pass (1.2 s), including the unchanged request-size ceiling.
The browser passes (31.0 s); inspected all four screenshots: saved sensitivities,
30-unit snowy wheat estimate with local 0.5 sensitivity/80% cap, fallow plots and
invalid cap with reload preservation. Final TypeScript, Prettier and diff checks
pass. No whole-suite rerun, version bump or deployment.

**Frost slice done and pushed:** `738cede8e8b9fa5e2583b482f15723ceb53d4f4d`.
Remote SHA verified. The remaining fishing rules are independent of one another;
handle the smaller bite-wait means before offshore boundaries and trawl constants.

### Fishing bite-wait means — completion criteria before production

Expose the four existing mean waits: shore/ordinary 75 seconds, anywhere-mode
shore 20, coastal boat 65, deep-water boat 225. Keep exponential sampling, depth
multipliers, species selection and the eight-second bite window unchanged. Rules
are finite numbers 1–3,600 seconds. Changes affect newly scheduled bites only;
a waiting cast retains its recorded catch and deadlines. Mode zero still disables
fishing; world rules do not grant tackle or catches.

- New tests in `tests/fishing-wait-rules.test.ts` must first fail on missing rules,
  then pass default/legacy/custom context selection, preserved scheduled casts,
  shared settings validation/editor/summary/observation/save/design round-trips.
- Run those tests with fishing timing, fishing-water, charter boat fishing and
  guide tests where present. Run TypeScript and changed-file Prettier/diff checks.
- Browser `tests/browser/fishing-wait-rules.spec.ts`: configure F10 Fishing rules,
  save/reload, cast a real line with tackle, inspect waiting/empty-catch state,
  see local mean help, reject invalid zero mean and retain saved values. Preserve
  fishing-disabled refusal. Inspect screenshots; update player/boating/world-builder
  docs, README and Unreleased changelog. No whole-suite test run.

Failing-first bite-wait result: all three tests fail at the custom patch or absent
settings (`Unknown setting`). Correct the disabled-fishing test's action name to
the existing `joinGame` API before production edits.

Bite-wait validation complete: 26 wait/timing/offshore/guide tests pass (3.0 s),
and all 11 tests in the actual `tests/charter.test.ts` pass (1.4 s), including
passenger fishing. The initially listed `charter-boat.test.ts` path does not exist;
run the discovered charter suite separately rather than count that missing path.
TypeScript, changed-file Prettier and diff checks pass. Browser passes (27.1 s);
all five screenshots inspected: saved rules, local seven-second base mean help,
real cast with disabled reel and no caught fish, rejected zero mean, and disabled
fishing with no cast action. The server test confirms the disabled-mode refusal;
reload/editor activity preserves the recorded catch and bite deadlines.

**Bite-wait slice done and pushed:** `05562636124e70fa048a8bb879cf3da712d75ef3`.
Remote SHA verified. Continue with the shared offshore depth and coast clearance.

### Offshore fishing limits — completion criteria before production

Expose the entry's deep-fishing depth (8 m) and shore distance (150 m), shared by
rod fishing and trawling. Keep the existing conservative 10 m coastal grid and
small-islet checks, world bounds, seabed influence, species and saved clocks.
Depth range 0.1–1,000 m; shore clearance 0–1,000 m, where zero disables only the
shore buffer. Dry ground remains ineligible. No duplicate defaults.

- Add `tests/fishing-depth-rules.test.ts` and confirm missing-setting failures.
  Default/legacy worlds preserve current inshore/offshore outcomes; custom depth
  and shore rules change both rod species eligibility and trawl deployment.
  Repeated edits invalidate cached shoreline decisions even without replacing
  the terrain array; unchanged snapshots still reuse the cache. Zero buffer
  retains depth and world bounds. Invalid patches are atomic.
- New worlds, saves/designs, F10, summaries and resident observations agree.
  Run new tests with fishing-water, fishing-timing, commercial-fishing, charter
  and guide tests, then TypeScript and changed-file Prettier/diff checks.
- Browser `tests/browser/fishing-depth-rules.spec.ts`: configure/save/reload F10,
  inspect the local depth/clearance help; from an isolated fishing boat fail net
  deployment under an excessive depth rule, lower it and deploy successfully,
  then haul an empty net. Reject invalid zero depth and retain saved values.
  Inspect screenshots. Update player/boating/world-builder docs, README and
  Unreleased changelog; push only after these gates pass.

Failing-first offshore result: default/legacy rod/net comparison passes; three
custom/validation tests fail because the new rule keys are absent or unknown.

Offshore validation complete: 48 relevant tests pass (31.9 s, including existing
commercial-fishing voyage balance checks). Added explicit 60 m → 300 m → zero
shore edits on the same terrain/cache; all four new tests pass again (0.9 s).
The first browser attempt looked for trawl controls in Activities; corrected it
to the existing Inventory boating panel. Final browser passes (25.8 s), with all
five screenshots inspected: saved depth/clearance, excessive-depth refusal,
successful deployment after lowering depth, empty haul and invalid depth with
saved value retained. Final TypeScript, Prettier and diff checks pass. No whole
suite or live-world work was performed.

**Offshore limits slice done and pushed:** `e12a5ec942779c9cd4e577c8c97297b0753c5823`.
Remote SHA verified. Continue with the four named trawl constants.

### Trawl world rules — completion criteria before production

Expose default towing speed 2.4 m/s, net capacity 640 weight, shoal mean interval
360 seconds and towing fuel rate 8.5 units/minute. Existing per-slot vehicle tuning
continues to override speed/capacity/fuel; world values are their shared fallback.
Use ranges matching vehicle tuning: speed 1–8, capacity integer 10–5,000, fuel
0.06–60 per minute; shoal mean integer 1–86,400 seconds. Retain catch distribution,
reference interval, voyage luck, crew/depth modifiers and paid-time requirements.

- Add `tests/trawl-rules.test.ts`, run red before production. Verify default/legacy
  and custom/vehicle-override fuel, speed, capacity and activity cues. New shoal
  schedules use the local mean; existing encounter clocks survive rule edits.
- Lower capacity without deleting earned fish; refuse redeployment if the net or
  pending fish no longer fits. Raising capacity may resume a formerly full net.
  Hauling retains real fish and cannot duplicate them. Invalid patches are atomic;
  editor, summaries, observations, saves and designs share defaults and overrides.
- Run new tests with commercial-fishing, vehicle-config, fishing-water, trawl-status
  and guide tests. Run TypeScript and changed-file Prettier/diff checks.
- Browser `tests/browser/trawl-rules.spec.ts`: save/reload F10 trawl rules, inspect
  effective speed/capacity/fuel help, deploy and haul an empty net, reject invalid
  capacity, and verify full-net refusal in an isolated fixture with a recorded
  catch. Inspect screenshots. Update player/boating/world-builder docs, README
  and Unreleased changelog; push only after all criteria pass.

Failing-first trawl result: default/missing burn and speed checks pass before the
custom mode; all four tests then fail on unknown or absent new settings.

Additional consumer check: F10 Vehicles must show the effective world trawl defaults
(20 weight, 0.1 fuel/second and 1.5 m/s in the fixture), retaining explicit vessel
overrides. The added vehicle-editor test fails on its hard-coded net capacity.
Extend the same browser flow to inspect these three fields. The guide request
currently exceeds its unchanged 96,000-byte limit by 74 bytes; tighten the boating
paragraph without removing any instructions or facts, then rerun guide tests.

The boating paragraph is not selected by the budget fixture, so its shorter
wording does not change that request. Compact the guide's lookup instructions
with the same topic-slug algorithm, catalogue kinds, example ID and default-value
warning. Preserve every selected manual section and all memory limits.

Trawl validation complete: all 46 non-guide tests from the initial relevant run
pass, including the long voyage balance regression. The additional vehicle-editor
test and eight vehicle configuration tests pass. All 16 guide tests now pass
(1.3 s), including the unchanged 96,000-byte ceiling and complete source/text/ID
retention checks; update only the exact wording assertion for the equivalent
shorter slug instructions. Extended browser passes (31.4 s); inspect all six
screenshots covering rules, effective vessel defaults, deployment, empty hauling,
full-net refusal and invalid capacity. TypeScript, changed-file Prettier and diff
checks pass. No repeat of the long voyage simulation after UI/text-only changes.

**Trawl slice done and pushed:** `3fb5fdee3a22d937312824d8930e9747b53cd9c4`.
Remote SHA verified. Continue with vehicle/travel rules.

### Vehicle running costs — completion criteria before production

Refuelling audit: matches already configurable behavior. `fuel-rules.ts`,
`player-aid.ts`, `fuel-sales.ts` and `world-catalogue.ts` share the 15 m range and
8 tank-units conversion; `fuel-sales.test.ts` covers custom limits, missing-key
fallback, validation, F10, summaries and save/design round-trips; the existing
`browser/fuel-sales.spec.ts` edits the range. Leave that shipped implementation.

Expose wear per metre (0.0002, range 0–1), trailer speed/fuel base coefficients
(each 1.12, range 1–10) and load coefficients (0.33 speed / 0.3 fuel, range 0–10).
Preserve speed = 1/(speed base + load fraction × speed coefficient) and fuel =
fuel base + load fraction × fuel coefficient. No trailer remains neutral. Zero
wear disables distance loss but retains mileage; the maintenance switch still
gates wear and condition effects. Do not erase condition, mileage, cargo or fuel.

- Add `tests/vehicle-running-rules.test.ts`; confirm missing-rule failures first.
  Test default/legacy/custom wear, immutable prediction records, walking/minigame
  exemptions, zero wear and disabled maintenance. Test empty/half/full trailers,
  no trailer, zero load coefficients, actual speed/fuel integration, live edits
  preserving cargo and saved state; test invalid patches atomically.
- Verify creation, F10, summaries, observation and save/design round-trips. Run
  new tests with vehicle-services, trailers and guide tests; run TypeScript and
  changed-file Prettier/diff checks. Refuelling code is unchanged: inspect existing
  tests, without rerunning unrelated sales tests.
- Browser `tests/browser/vehicle-running-rules.spec.ts`: save/reload custom rules,
  inspect garage wear help and a real movement's recorded wear, show an unused
  vehicle's no-journey state and refuse service at full condition, reject invalid
  negative wear and retain saved values. Inspect screenshots. Update PLAYING,
  WORLD_BUILDING, README and Unreleased changelog before committing/pushing.

Failing-first running-cost result: all four tests fail on unknown/absent rules.
Correct the fixture's trailer dictionary and Wood weight (2) first; original
default/legacy factor assertions then pass up to the missing custom-rule edit.

All 19 running-cost/vehicle-service/trailer tests pass. The guide budget catches
136 bytes of new rules (request 96,129 bytes). Keep the ceiling and content limits;
shorten the equivalent help-use instructions while retaining trusted sources,
lookup sequencing, private-state boundaries, human controls, response limit,
no incidental purchases/jobs/travel, uncertainty and credential prohibitions.
Include the maintenance switch alongside the wear rate in observations.

Running-cost validation complete: all 19 new/service/trailer tests pass; all 16
guide tests pass (1.4 s), retaining the request ceiling and complete guide/memory
coverage. TypeScript is clean. Browser passes (39.7 s); inspect all four screenshots
for saved rules, unused full-condition vehicle, real reverse travel reducing the
displayed condition to 99.8%, and invalid negative wear. The longer drive improves
visible evidence beyond the initial run's rounded 100.0%. No service charge or
state mutation occurs at full condition. Changed-file Prettier and diff checks pass.

**Vehicle running-cost slice done and pushed:** `753f91750bc030b6b52a925df8c37c3abe00ccee`.
Remote SHA verified.

### Boat impact and arrival rules — completion criteria before production

Expose shore-impact condition loss (default 1, range 0–100), afloat boathouse
arrival radius (30 m), afloat pier/river landing radius (14 m) and shore boarding
radius at those landings (5 m), all radii 0.1–100 m. Preserve hull-oriented arrival
distance, continuous clear-water path checks, the separate 40 m boathouse shore
menu range, gentle canoe exemptions and collision recoil/throttle latch. Zero
impact damage still blocks land crossing. Existing fleet condition is unchanged
until a new impact; these rules do not move boats or award inventory.

- Add `tests/boat-navigation-rules.test.ts`, run red. Verify default/legacy and
  custom/zero impact loss, prediction immutability/server agreement, bounded
  condition and retained recoil/stop. Check exact arrival boundaries, custom
  radii, oriented hull reach, dry obstruction and unchanged shore boathouse range.
- Validate finite ranges atomically; verify F10, summaries, resident observations,
  saves and portable designs. Run the new tests with boat-shore, boating, dock,
  boat-abandonment and guide tests; TypeScript and changed-file Prettier.
- Browser `tests/browser/boat-navigation-rules.spec.ts`: configure/save/reload
  F10, inspect local docking help, show no landing available outside a small
  radius, enlarge it and disembark through Inventory, preserve an empty moored
  vessel, then reject zero arrival radius and retain saved values. Inspect
  screenshots. Update BOATING, PLAYING, WORLD_BUILDING, README and Unreleased.

Failing-first boat navigation result: all three tests fail on unknown/absent
rules after default and legacy assertions pass. Use a wet initial hull position
for recoil, a dry ridge wider than the existing two-metre path sampling, and
compare predicted motion/fleet state separately from server-only voyage accounts.
Further audit gap to fix after this slice: the Inventory boating paragraph still
says eight tank units even though `fuelUnitsPerItem` is already configurable.

All 49 navigation/shore/boating/dock/abandonment tests pass. New observation
fields exceed the unchanged guide request ceiling by 91 bytes. Shorten the
plan-use paragraph without changing its multi-step/repeat guidance, completion
and failure handling, human interruption/resumption or private-reply boundaries.

Boat navigation validation complete: all 49 relevant physics/docking/recovery
tests and all 16 guide tests pass (3.5 s initial run, 1.3 s guide recheck).
TypeScript and changed-file Prettier/diff checks pass. Browser passes (30.4 s);
correct the fixture's reboarding label to the catalogue name “Outboard motorboat”.
Inspect all four screenshots: persisted rules, no landing within 4 m, successful
disembark/mooring after changing to 40 m, and invalid zero radius with 40 retained.
No full-suite or live-world tests were run.

**Boat navigation slice done and pushed:** `c656e6c99c28d855e4c4e632cdb3258378ac2a5f`.
Remote SHA verified.

### Boating fuel-help audit gap — completion criteria before production

The existing Fuel conversion rule works, but Inventory boating help hard-codes
eight units. Extend `tests/browser/boat-refuelling.spec.ts` to keep the existing
eight-unit fill, edit F10 Roadside fuel to 12, then require help to say 12 and a
second can to add 12 units. Confirm the help assertion fails before production.
Keep lifeboat blocked-refuelling visibility and unchanged remaining Fuel; inspect
screenshots of custom help/refill and blocked use. Render help from the same
effective item definition as inventory consumption. Run relevant motorboat and
fuel-sales tests, TypeScript and changed-file Prettier. Update BOATING, README
and Unreleased; no new rule or duplicate default.

The first browser attempt cannot open Rules: the old public-world fixture's
player lacks editor authority. Move this test to an isolated owner-created world,
retaining the same rescue state and original assertions, and rerun red. This
changes only the local test fixture; no live authority is granted.

Correct red result: browser fails at the custom-help assertion after saving 12;
the panel still displays “Each can adds up to 8 tank units” (21.8 s).

Fuel-help validation complete: 19 relevant fuel-sales/motorboat tests pass
(1.5 s), TypeScript is clean, and browser passes (16.8 s). Retry only the
screenshot scroll when a live snapshot replaces its DOM node. Inspect both
screenshots: custom twelve-unit help after a real 8 → 20 refill, and carried
Fuel still visible on the lifeboat with its tank and inventory unchanged.
Changed-file Prettier and diff checks pass; no consumption logic changed.

**Boating fuel-help slice done and pushed:** `c0e304d1aa47531a9749e0812a5295520f11a956`.
Remote SHA verified.

### River dock limits — completion criteria before production

Expose required river depth 1.2 m (range 0.1–20), maximum vessel length 14 m
(range 0.1–50) and beam 3.6 m (range 0.1–20) in Boat navigation. These are
eligibility limits, not jetty geometry. Retain dry-bank, whole-berth river/depth,
rotation, bounds and obstacle checks. Changed limits affect current access but
never remove existing docks, moored vessels, fuel or cargo; restoring a limit
restores access. Ponds and the sea still do not qualify.

- Extend `tests/river-dock.test.ts` with default/legacy/custom vessel acceptance,
  depth rejection and dynamic placement/refusal messages, retained moorings and
  restored access. Extend `boat-navigation-rules.test.ts` for range validation
  and editor/summary/observation/save/design round-trips. Run red before code.
- Run both tests plus boating, construction-site and guide tests, TypeScript
  and changed-file Prettier. Verify actual discovered test paths before invoking.
- Browser `tests/browser/river-dock-rules.spec.ts`: at a real generated river dock,
  save/reload F10 limits, show local depth/size help, refuse boarding a canal
  boat under a 5 m length cap, restore the cap and board; set excessive draft
  and verify no usable landing without losing vessel state; reject zero draft.
  Inspect screenshots, update BOATING/WORLD_BUILDING, README and Unreleased.

Failing-first river limits: four new/extended tests fail on absent or unknown
settings; six existing/default behavior tests pass. The placement suite is
`tests/civics-construction.test.ts` (there is no construction-site test file).

All 27 river/navigation/boating/construction tests pass. The guide request is
42 bytes over its unchanged ceiling; compact the delivery-stock guidance while
retaining its carried/owned-stockroom boundary, building ownership of job stock
and requirement to buy that stock normally before promising delivery.

Browser first run reaches the final reload after all eligibility, mooring,
restoration and invalid-input assertions pass. Trace shows first/second terrain
startup at 34.95/36.45 seconds; the two-minute overall harness deadline interrupts
the third readiness wait after 30 seconds. Allow 180 seconds for the three loads
and interactions, retaining every assertion and each existing 60-second startup
limit. This is not a rendering-performance change or a relaxed behavior criterion.

River-limit validation complete: all 27 relevant behavior tests and 16 guide
tests pass (3.1 s initial run; 1.2 s guide recheck), with TypeScript and changed-file
Prettier/diff checks clean. Browser passes in 2.1 minutes with all three terrain
loads and unchanged readiness limits. Inspect all four screenshots: saved limits,
size-based unavailable boarding, excessive-draft unavailable landing, invalid
zero draft. Restoring depth/length permits boarding and disembarking while
retaining the exact mooring and 23 fuel units. No live-world work occurred.

**River-limit slice done and pushed:** `38727644249a6f8c1df818580e87368f808a1114`.
Remote SHA verified.

### River completion handoff — audit and completion criteria

Read Henry's `output/river-handoff/README.md` on 2026-11-04. Incorporate this
interrupted-work audit before continuing climate/calendar rules. The handoff
and its generated output remain unstaged. No deployment or excluded spaceflight.

- Tenfold northern land, preserved south/property/resources, six provinces,
  forests/ponds/mountain/five downhill rivers: implementation and explicit
  regression coverage exist in northern-island and migration code/tests;
  verification pending the targeted run and current screenshots.
- Winding slope-sensitive channels, sparse stones, smooth shoulders and visible
  intermediate water surfaces, ford/deep-water movement: existing code/tests
  cover these claims; current renderer verification pending.
- Permanent summit cover, alpine rain-to-snow, readout and walking umbrellas:
  shared alpine weather exists; audit its client consumers and browser evidence.
- River docks: catalogue/siting/orientation/reservation and small-boat eligibility
  exist. Current rule slice verified dynamic depth/size and preserved moorings.
  Still verify actual construction preview/build, both canal/motorboat access,
  persistent visible local-elevation mooring and large-vessel refusal.
- **Confirmed code gap:** lifeboat launch depth/clearance, launch position and
  dock boarding use ocean height. Tow/tender obstacle sweeps and occupied tow
  placement also use ocean height. Add failing elevated-river regressions before
  production; distinguish real river defects from coastal-only boathouse logic.
- Map decluttering/outlines and CPU water culling exist. Produce and inspect
  current full-map, watershed, matched southern views, bank, dock/boat and summit
  screenshots. Do not treat old screenshots/changelog prose as current evidence.
- Performance remains unverified: run isolated current river/forest/summit/storm
  and genuine leave/return streaming, populated fixture, map pan/zoom, constrained
  CPU/mobile and large-snapshot join/reconnect. Record frame tails/long tasks,
  CPU/heap/geometry with hardware and fixture limitations; run benchmarks alone.
- Cargo/quay mechanics, forestry and unrelated future backlog sections stay in
  their existing order. They are deliberately separate, not river-completion gaps.

Recovery completion criteria: new `tests/inland-boat-recovery.test.ts` must fail
before code because elevated navigable river water is mistaken for land/ocean
height. Cover real river launch and dock boarding, unchanged main vessel/cargo,
local water height on recovery and occupied towing, raised solid obstacles
blocking tender/tow movement, save/reload and unchanged offshore refusal. Use
`surfaceWaterLevel` at each sampled position without changing numeric thresholds.
Run this test plus boat abandonment, motorboat, towing, river dock and relevant
lifeboat tests; confirm paths first. Browser: empty-fuel launch on a river,
moored lifeboat boarding, restored main vessel, no-launch/blocked states, current
local-height screenshot. TypeScript, changed-file Prettier and Unreleased/player
and world docs are required before commit/push. Record actual results below.

Recovery red result: all four new tests fail for the intended reasons: river
launch rejected as dry land; dock boarding returns -2 m instead of 69.93 m;
occupied tow returns -2 m instead of 100 m; tender crosses a raised solid object.
The local-water substitutions pass all four. Audit also finds captain-death
passenger escape uses ocean height; add a failing case before correcting it.
A separate rod-fishing gate still assumes sea level; record and verify that gap
in a follow-up slice after this recovery slice is complete.

Recovery verification: 66 relevant tests pass in 6.5 seconds (inland recovery,
boat abandonment, motorboat, towing, boating, charter, river dock); added dry/
blocked launch atomicity test passes separately (1.3 seconds). The captain-death
regression first fails at -2 versus 100 m, then passes. Browser
`TEST_GPU=1 npm run test:e2e -- tests/browser/inland-boat-recovery.spec.ts` passes
in 1.5 minutes: launch at a generated river dock, disembark, reconnect, reboard
lifeboat/main boat, retain seven cod and zero fuel, refuse dry-bank launch.
Inspect all four screenshots, copied to `output/river-handoff-verification/recovery/`.
TypeScript and changed-file Prettier pass. No ocean exit constraints or numeric
thresholds changed. Tests and screenshot evidence do not yet complete the wider
river construction/rendering/performance audit above.

**River recovery slice done and pushed:** `d8c8a208c39f5c2754ff7b8951aeaa327bb7a6b5`.
Remote SHA verified.

### River rod fishing — completion criteria before production

Existing boat rod fishing promises to fish at the vessel's position, but the
start-depth gate and assigned height use ocean datum. Extend the inland regression
with a stopped canal boat, tackle and navigable elevated water: cast successfully,
keep x/z and local y, schedule ordinary fish (not deep-sea fish), and stop in place.
A boat on a dry bank must still fail without entering fishing. Confirm red at the
water gate, then change only those two surface-height lookups. Relevant tests:
inland boat recovery, fishing timing/wait/depth/water and boating. Browser on the
same generated river: cast, see waiting state, stop, reject dry-bank cast, inspect
screenshots. Keep deepFishingWater offshore-only. TypeScript, Prettier and player
docs/README/Unreleased before commit/push.

Rod-fishing red fails at “Take the boat into water before fishing” on a 100 m
river. After two local-surface substitutions, all 34 relevant tests pass (4.9 s)
and TypeScript is clean. Browser initially hits a strict-selector ambiguity
between HUD and dialog Cast buttons; scope to the Activities dialog. Rerun passes
(49.2 s): waiting at unchanged river x/z/y, ordinary fish, stop in place, dry-bank
refusal without lost tackle. Inspect both screenshots, retained under
`output/river-handoff-verification/fishing/`. Changed-file Prettier is clean.

**River rod-fishing slice done and pushed:** `94e6e16` (remote SHA verified).

### River dock recovery eligibility and labels — criteria before production

Audit finds tender docking omits the known motorboat slot when resolving a river
landing, bypassing configured vessel dimensions, and moored lifeboat boarding
also lacks a size check. Both recovery/docking labels call river docks “Fishing
pier”. Add failing tests: default tender secured at a river dock identifies it;
length cap below motorboat length refuses without moving/deleting the tender;
cap below lifeboat length refuses boarding without changing recovery/cargo; restore
cap to recover access. Browser recovery panel must identify the named river dock.
Keep existing coastal labels and offshore refusal. Run relevant inland recovery,
motorboat, boating and river-dock tests, affected browser, TypeScript/Prettier.

Eligibility red: both new unit cases fail with missing expected exceptions.
Browser red explicitly shows “Recovery lifeboat: Fishing pier.” where the actual
landing is River dock (1.9 minutes). Correct the known vessel lookup, add the
lifeboat size preflight before mutation, and use the saved building name in help.
All 36 relevant tests pass (4.5 s); TypeScript is clean. Browser recheck pending.

Travel-rule audit outside the handoff: runway dimensions already match the
per-world requirement (`flight-rules`, `puddlewick-airfield`, airfield/landing
tests for changed width and target length). Cargo capacity already resolves
per-world vehicle tuning (`vehicle-config`, `canCarry`, vehicle-config and
tractor-fleet tests including capacity boundaries and save/design round-trips).
Puddle tractor defaults to 150; On foot defaults to 60. Keep both existing slot
controls and defaults; do not create duplicate global capacity controls.

Eligibility/label verification complete: browser passes in 1.5 minutes, including
reconnect and the named River dock recovery label. Inspect updated moored view;
retain four current recovery screenshots in the handoff verification directory.
All 36 relevant tests, TypeScript and changed-file Prettier/diff checks pass.

**River recovery eligibility/label slice done and pushed:** `c938691` (remote SHA
verified).

### River handoff verification — current evidence criteria

Run current northern-island, alpine-weather, umbrella, map-terrain-job and
slow-network/network/snapshot tests after reviewing their corresponding code.
Do not change shipped terrain merely to duplicate existing features. Add a
browser construction audit using an actual generated bank and the UI's 15-degree
rotation increments: invalid orientation disables placement with a depth/bank
reason; correct preview quotes 30 Logs/10 Gravel and 3s base cash; place and supply
the foundation; board/disembark/reboard a canal boat and motorboat in independent
fixtures, retain exact mooring/fuel across reconnect, and refuse larger vessels.
Existing tests only exercise actual river mooring with canal boats, so extend the
same behavior check to motorboats rather than relying on the eligibility boolean.

Use the actual renderer preview script with a distinct output directory for full
map, watershed, matched original/expanded southern maps, riverbanks, dock/boat
and summer summit. Add summit view and explicit output selection to the harness,
not gameplay. Verify local rain/snow readout and umbrella behavior in browser.

Performance harness criteria: retain original/expanded comparison, run all six
routes in order (town, river, forest, summit, storm coast, return town), record
actual start/end position and tile identities to prove leave/return streaming.
Add optional generated population and CPU/viewport metadata, CPU render-time
percentiles and map open/pan/zoom measurements. Run alone on i7-7700HQ/Quadro
M1200, low quality, 1280x800; repeat a populated subset at 390x844 with 4x CPU
throttling. Record tails, >100 ms frames, long tasks, heap, geometry and CPU time;
no invented universal frame budget or warm-cache load-speedup claim. Run current
large-geography network join/reconnect/browser checks separately from benchmarks.

**Confirmed construction gap:** current browser preview of the default Log landing
adds a generic house shell: 13 gravel, 5 stone blocks, 2 wood and 3s 24.01d,
instead of the documented 30 logs/10 gravel/3s catalogue bill. The browser audit
fails at the material assertion; interrupt the duplicate motorboat scenario.
Before production, extend building-design tests for the plain river landing in
each supported finish, using catalogue price/materials including world overrides.
A bare platform has no enclosed wall/roof shell. Preserve all finishes and the
existing additional-building variants; only the plain landing's bill uses the
catalogue directly. The existing browser criteria remain unchanged and must
verify both actual construction and supply at that bill. Run building-design,
construction-expansion, civics-construction and river-dock tests plus TypeScript.

**Plain river landing bill verification:** the new unit regression first fails
at 32,401 versus the catalogue 30,000; the earlier actual browser preview fails
with the generic masonry shell. Bypass that shell only for the plain river
landing, preserving the selected finish and catalogue overrides. All 23 relevant
tests pass (building designs, construction expansion, civics construction, river
docks; 3.8 seconds). Both real browser construction/mooring scenarios pass in
3.1 minutes: refusal at the wrong orientation, exact 30 logs/10 gravel/3s quote,
actual cash/material deduction and completion, canal boat and motorboat boarding,
local elevation, disembark/reconnect/reboard with unchanged fuel/mooring, and
larger-vessel refusal. Inspect preview/refusal/reconnected screenshots; retain
six under `output/river-handoff-verification/construction/`. TypeScript,
changed-file Prettier and diff checks pass.

**Plain river landing bill slice done and pushed:** `72c84c9` (remote SHA verified).

**Remaining audit method:** observe the real app's GameScene from a browser-only
module wrapper; do not change gameplay to expose test state. At summer lowland
rain, the HUD reports rain and the walking umbrella fully opens; relocate the
local fixture to the generated summit, require snow in the same HUD and a closed
umbrella, then clear weather with no precipitation. Keep the normal readiness
timeout. Preview harnesses now wait for staged scenery revisions and count only
visible-frame renders, excluding offscreen geometry warmup. These are verification
harness updates, not new island features.

**Audit gate failure — slow-link freshness:** 13 of 14 network/snapshot tests
pass, and the actual browser slow-link join/reconnect/driving/chat check passes
(1.6 minutes, two parked neighbours, 613 ms displayed ping). The existing
`slow-network.test.ts` fails its unchanged `<2 s` state-age criterion both during
concurrent browser work and alone (32.1 seconds). Do not dismiss this as contention
or weaken the threshold. Record packet age/transport metrics, identify the stale
queue, and fix the confirmed cause before completing this audit/checkpoint.
No server production changes precede this failing test.

Diagnostic red records 17.5/18.6/19.0-second ages for the first three states,
then 2.12 seconds for the first post-entry state. The current three-state window
queues two already-obsolete deltas behind the large geography transfer. Require
entry/world-switch flow control to wait for the full snapshot ACK, then retain
the ordinary three-state window. Add a transport regression for initial, normal,
switch and stale-ACK states; rerun the unchanged slow-link age/driving/chat gates,
transport/snapshot/network tests and actual browser slow-link reconnect.

The new initial/world-switch transport assertion fails red (`ready` is true
while the full snapshot is unacknowledged). Gate that first snapshot, retaining
the three-frame window after its ACK. The isolated slow-link test now passes in
36.6 seconds: initial download remains 17.5 seconds at 64 kbit/s, subsequent
recorded state ages are 1.00–1.95 seconds; ACK pause/resume, driving, chat and fast
peer independence all pass. Temporary diagnostic logging is removed; the
original test and all thresholds remain unchanged. Browser reconnect and focused
transport/snapshot/network checks are being reverified before commit.

**Initial snapshot gate verification complete:** all 17 transport/snapshot/network
tests pass (28.9 seconds), plus the isolated slow-link test above. The actual
browser network flow passes again after the change (normal entry, two neighbours,
64 kbit/s reconnect, driving/release and chat; no page errors). Inspect and retain
`output/river-handoff-verification/network/slow-network-fixed.png`. TypeScript,
changed-file Prettier and diff checks pass. Alpine verification remains a separate
pending harness check: enable normal server ticks/broadcasts after relocating the
current player object; disabling ticks prevented the relocation from being sent.

**Initial snapshot gate slice done and pushed:** `1d19a0c` (remote SHA verified).
Alpine browser verification passes in 23.4 seconds after correcting the local
fixture's disabled broadcasts: summer lowland rain opens the walker umbrella,
summit snow closes it, and clear weather hides precipitation. Production alpine
weather/umbrella code matches the claim and is left unchanged.

### River handoff requirement verdicts

- **Matches — geography/preservation.** Current northern-island tests verify the
  9.5–10.5 land-area ratio, exact sampled southern terrain/woodland and original
  resource identities/depletion/buildings, idempotent migration and design
  round-trips. Six provinces have tested strengths/scarcities without increased
  overall deposit density. Keep the shipped generator.
- **Matches — river topology and navigation.** Five descending channels, wet beds
  between survey points, smooth banks, sediment, upper fords and impassable lower
  crossings have direct terrain/travel tests. Current renderer/map views below
  verify the claimed appearance. Both small boat slots also pass an actual
  movement-physics approach to a generated berth.
- **Matches — alpine climate/umbrellas.** Seasonal/permanent summit coverage and
  gradual local precipitation pass unit tests; actual summer HUD, walking
  umbrella and clear-weather browser checks pass. Keep shipped behavior.
- **Fixed gaps — inland integration.** Recovery/towing/tender/lifeboat/death
  elevation (`d8c8a20`), river rod fishing (`94e6e16`), recovery eligibility/names
  (`c938691`), and the plain landing designer/construction bill (`72c84c9`) pass
  their recorded unit/browser checks. The current dock rules preserve defaults
  and configurable depth/vessel limits; motorboat and canal moorings both survive
  reconnect with exact fuel and local elevation.
- **Separate future work.** Cargo/quay mechanics, ford-aware road routing and
  bridges remain their own Planned sections; this audit does not implement them.
- **Verified with recorded limits.** Full map/watershed/matched southern views,
  rendered bank/dock/summer summit, and populated travel/phone measurements below.
  Network join/reconnect/privacy/flow control now pass, including the newly fixed
  initial-snapshot queue (`1d19a0c`).

**Populated desktop route verification:** run alone with
`PROFILE_POPULATION=12 PROFILE_OUT=output/river-handoff-verification/performance-desktop tsx scripts/island-performance.ts`.
Fixture: 13 visible players including the surveyor, 39 buildings (24 added homes),
1280×800, Performance quality/pixel ratio 0.85, i7-7700HQ/Quadro M1200; generated
worlds, no live population or server/NPC simulation. Each location has a 10-second
transition plus 15-second sample. Original and expanded town both measure 33.8 ms
p95. Expanded river/forest/summit/storm-coast/return-town p95 values are
36.2/35.8/35.0/35.5/33.8 ms; no measured frame exceeds 100 ms (steady maximum
57 ms). The river transition has one 90 ms long task; other transitions have none.
Measured JS heap is 44.1 MiB in expanded town, peaks at 70.7 MiB at the river,
and returns to 45.9 MiB. Render CPU p95 spans 3.6–9.8 ms on expanded routes.

Positions prove travel away from town and a return from (120,4560) to (0,0);
returned tile keys match the original town's 248 cells and 20 scenery chunks,
with 239 draw calls in both town visits. These fixtures relocate between regions
and then move locally; they do not simulate a continuous cross-island journey.
River/forest streaming remains active during movement. Full-map opening and
zoom-in/pan-right/zoom-out complete without long tasks or page errors; measured
interaction/worker completion times are 229/13/159 ms. Do not interpret warm
initialization timings as cold-load speedups or extrapolate to all hardware.

**Constrained viewport verification:** run alone with
`PROFILE_WORLD=expanded PROFILE_CASES=town,river,return-town PROFILE_POPULATION=12 PROFILE_PHONE=1 PROFILE_THROTTLE=4 PROFILE_OUT=output/river-handoff-verification/performance-phone tsx scripts/island-performance.ts`.
At 390×844 and 4× CPU throttling, town/river/return-town p95 is 34.5/44.7/35.0 ms,
with steady maxima 56.3/64.0/37.0 ms and no sampled steady frame over 100 ms.
The initial fixture preparation takes 47 seconds. The river relocation records
one **203 ms main-thread task**, plus four 50–60 ms tasks: constrained transition
work still hitches, so this is not an all-device smoothness guarantee. The fixture
jumps roughly 24 km before moving locally, rather than walking that journey.
After returning, the camera is at town and 123 of its 248 ground cells are loaded
at sample end; background streaming remains active. Desktop return is fully
settled; do not claim the same for this throttled sample. Heap returns from
61.9 MiB at the river to 42.5 MiB (initial town 42.7 MiB); map open/navigation
completes with no long tasks/errors (zoom/pan/zoom completion 427/186/252 ms).
These limitations are recorded, not hidden by a new performance threshold.

**Actual renderer/map views:**
`PREVIEW_GPU=1 SHOTS=bank,dock,summit PREVIEW_OUT=output/river-handoff-verification/views tsx scripts/northern-island-preview.ts`
passes, including map overview/local-detail assertions and river raycasts.
Inspect all eight PNGs: bank, dock, summer summit, full island, watershed, river
valley, original south and expanded south. The bank sample has rendered water at
70.025 m above its 68.116 m ground; the boat/dock render at the local 69.93 m
reach, and the summer summit is covered at 1,423.84 m. River outlines are
continuous, banks are smooth, and the southern land/coastline shapes match.
Contour label placement differs with map sampling; exact sampled southern
terrain/resource preservation is established by the unit tests, not screenshot
pixel identity. Preview generation reports no page errors.

The fully settled bank/dock previews submit 4.1/6.5 million triangles at their
1600×1000 review camera angles. The short moving river benchmark still had
streaming active, so run a focused desktop river sample with 90 seconds of
preparation before its 15-second movement sample to assess the loaded view.
This follow-up is justified by the newly observed geometry load; no broader
suite rerun is needed.

**Final navigation coverage check:** the construction browser exercises both boat
slots at the berth, but does not sail an approach. Before declaring that handoff
claim matched, add a focused generated-bank simulation check for both canal boat
and motorboat: start eight metres along the berth axis, drive under normal hull
collision physics into boarding range, remain at local river elevation, then
mooring/disembark/reboard must preserve fuel and position. Run the river-dock unit
file; if a real failure appears, fix it before closing this checkpoint.

**Longer river measurement:** the isolated 90-second preparation plus 15-second
movement run passes without page errors. It renders 4.93 million triangles,
186 draw calls, 132 ground tiles and 23 tree chunks at sample end. Frame p95 is
37.4 ms, maximum 46.2 ms, render CPU p95 6.4 ms, JS heap 55.9 MiB, with no long
tasks or >100 ms frames during the movement sample. The preceding preparation
records 99/74/76/73 ms tasks and a 94.9 ms maximum frame. Streaming is still active
after 90 seconds and during movement: this is a substantially loaded view, not
proof that every distant cell has settled. Keep this limitation and the fully
settled visual previews separate. Evidence:
`output/river-handoff-verification/performance-settled-river/` (directory name
identifies the intended check, not a claim that streaming completed).

**Navigation coverage result:** both boat slots sail the eight-metre approach
under the existing hull physics, reach within 0.3 m of the berth at local river
height, disembark and reboard with exact remaining fuel. All nine river-dock
tests pass in 2.0 seconds. The first assertion incorrectly looked for fuel on
`mooredBoats`; existing storage keeps it with the player's fuel-slot state.
Correct the fixture's fuel-slot identity and assert that documented storage plus
reboarded fuel. This was a test-fixture mistake, not a production gap. Existing
navigation code matches and remains unchanged. The real browser construction,
boarding, mooring, reconnect and larger-vessel refusal results above still apply.

### Proposed release checkpoint — finished feature boundary

Cut the next release from this branch after Henry authorizes deployment. Do not
begin another Planned section before that decision. This is a usable boundary:
all included features and rule batches have their own completed acceptance
checks; the unfinished part of the rules section adds further independent
settings, with existing behavior remaining in place meanwhile. No new cargo,
parked-vehicle, forestry or aviation system is partly implemented in this cut.

- Reviewed all 20 shipped claims; leave 17 matches intact and include the three
  verified corrections (motor-free HUD, menu zoom, charter tuning).
- Finish seven of 25 eligible Planned sections: landing, flight terrain/towns,
  snow walking, natural gathering scenery, fuel tanker, canoes and CB radios.
- Include the finished survival/needs, economy/trade, construction,
  gathering/farming/fishing/trawling and vehicle/travel rule batches. Preserve
  and expose the existing irrigation formula, with configurable defaults.
- Include the Lightmun scene-freeze fix, inland recovery/fishing/eligibility and
  landing-bill corrections, and initial-snapshot flow-control fix. Close the
  river handoff with current code/tests/browser evidence and the measured
  performance limitations above.
- Resume later at world/weather/environment rules, then follow the remaining
  dependency order. Piloted spaceflight remains excluded.

Release verification uses the relevant tests and affected browser flows recorded
above, not a new full-suite run. The final audit itself adds verification scripts,
tests and documentation only; it changes no gameplay. The 21 northern-island,
alpine-weather, umbrella and map-terrain-job tests pass in 7.0 seconds
(`tsx --test --test-concurrency=2 tests/northern-island.test.ts tests/alpine-weather.test.ts tests/umbrella.test.ts tests/map-terrain-job.test.ts`).
The nine river-dock tests and actual alpine browser check pass as recorded above.
`npx tsc --noEmit`, changed-file `npx prettier --write` and `git diff --check`
pass. `npx vite build` also succeeds (5.44 seconds); it reports dependency pure-
annotation warnings and the large main-chunk advisory, with no build errors.
Keep version 0.114.5 and all changes under Unreleased. No server is changed by
this checkpoint.

**River completion/populated-travel audit done and pushed:**
`5fc18b820ba31b777b691ca93a552737d82d0d44` (remote SHA verified). This closes the
river handoff at the release checkpoint, with the documented streaming/device
limitations. Preserve local evidence under `output/`; do not commit it or private
world captures. Pause here for Henry's explicit deployment authorization.

## Release 0.115.0 — authorized 2026-11-04

Henry explicitly authorized releasing this checkpoint and asked to be told when
it is live. Prepare 0.115.0 (compatible features), move the existing Unreleased
entries into its dated changelog section, refresh current guides and README, and
commit/push on backlog-implementation. Keep main untouched and deploy the exact
pushed commit with DEPLOY_REF. Preserve SQLite/upload backups and the private
environment. Run focused documentation/guide tests, website checks and the
production-prefix browser smoke against disposable data; retain the completed
feature verification above. Verify the live health/version and public assets
after deployment; do not create live test pilots or grant player resources.
Release metadata verification: all 16 NPC guide tests pass after updating the two
expected heading/lookup assertions to their released titles; content and budget
assertions remain intact. TypeScript and the `/aclone/` production build pass.
Website checks pass at four widths, including all 51 building previews, touch,
keyboard, empty search and fallback states. The built-client registration,
world entry, map, movement, saved position and reconnect browser flow passes on
a disposable local server through the prefix proxy. Review the mobile website
and game screenshots; keep evidence under `output/release-0.115.0/`. No full
suite was repeated for these metadata/documentation changes.
Deployment status: **live**, verified 2026-11-04 at 21:57 America/New_York.
Release commit `545a89b8b8dbdd88424f838458b03f0a2a62e714` is pushed on
backlog-implementation and matches the clean server checkout. Main was not
pushed. `aclone.service` is active; public health reports 0.115.0 and five worlds.
The live browser shows ALPHA 0.115.0, loads the prefixed client and map-worker
JavaScript, and records no page errors. The matching public website is live on
0.115.0. Production checks are read-only; no live test pilots/worlds or manual
player grants were created.

Pre-upgrade SQLite backup:
`/var/lib/aclone/backups/pre-deploy-20261104-215503.sqlite` (424,550,400 bytes).
No uploaded-assets directory existed to archive. Website rollback archive:
`/var/backups/aclone-website/site-20261104-215641.tar.gz`. Keep these private on
the host. A clean tracked-source archive and SHA-256 checksum are retained under
`output/release-0.115.0/`, alongside deploy logs, local browser evidence and the
live verification JSON/screenshots. Generated output and untracked NPC status
notes remain unstaged. Disposable smoke processes have been stopped. This
record-only follow-up does not change the deployed code or require a restart.

## Post-checkpoint fix — spaceport razor wire at night

Henry reports a bright wire outline around the spaceport at night, including
from aircraft. Inspecting `spaceport-fence.ts` confirms an unlit LineBasicMaterial
above lit MeshStandardMaterial chainlink. Before production edits, add an actual
browser-render regression: render the generated fence close up by day, with no
lights, and under dim night lighting from ground and aircraft viewpoints. Wire
must remain visible in daylight, render black with no incident light, share the
chainlink's roughness/metalness and non-emissive response, and have physical
thickness that shrinks with distance. Exercise production static batching and an
empty world; keep bounded batches and the existing fence/collision geometry.
Run the new browser test red, then relevant spaceport rendering/static-scene
checks, TypeScript and changed-file formatting. Update Unreleased and README.
This correction does not authorize another deployment or start another backlog
feature; keep it separate from the released checkpoint.

Red verification: the browser renders wire at brightness 168/255 even with all
lights off (required <=2), reproducing the unlit glow. The initial harness had
omitted the empty animated-branch list to freezeScenery; correct that harness
call before obtaining this pixel failure. A separate static-scene regression
fails because bounded meshes are merged away. Preserve explicitly marked wire
batches so converting lines to lit mesh does not create one giant GPU upload.

Wire verification passes: 12 static-scene/fog/GPU-warmup tests, the new lighting
browser regression and existing spaceport effects browser flow. Full compound
night-ground and night-air views also pass without shader errors and were
visually inspected. Daylight wire peaks at 212/255; unlit darkness is 0, dim
night ground is 3 and aerial night is 1, with zero pixels above 100 in either
night view. Visible wire uses 8–12 draw calls and up to 344,344 triangles in these
views. The material matches chainlink roughness/metalness with no emissive term;
physical 16 mm crossed strips replace constant-screen-width lines. Empty-world
fence generation remains empty, and marked batches survive static batching.
TypeScript and changed-file Prettier/diff checks pass. Updated player-guide
lookup/content tests pass as well. Evidence: `output/spaceport-wire-fix/`.
Keep this fix unreleased; the announcement requested next covers live 0.115.0.

Done: commit `f45e817568a54b1ebd3b881369e2cfb4608d0abe` is pushed to
`backlog-implementation`. The wire correction remains unreleased.

## Checkpoint announcement and additional airplane gift

Henry explicitly requests a bot announcement in Discord's announcements channel,
with screenshots of the playable 0.115.0 features, and one additional airplane for
every existing human player, including players who already own one.

Apply the gift once per eligible human account with an existing world character,
prefer its Puddlewick character, and exclude NPCs and the known automated test
account. Add one spare airframe without replacing existing aircraft, fuel, paint
or other player state. Test selection and existing/new-aircraft cases before the
live operation. Stop the service, back up SQLite, apply an atomic transaction
with a persistent idempotency receipt, restart, and verify the saved counts.

Verified: all 24 recipients have exactly one additional airframe after restart;
the service is active. The script's state-preservation assertions and selection
self-tests pass. Backup:
`/var/lib/aclone/backups/pre-01150-airframes-20261105-031532.sqlite`.
The private audit and idempotency receipt remain on the server; operational
scripts and public announcement evidence are in `output/announcement-0.115.0/`
and are not staged. Existing planes retain their fuel; spare airframes start
empty under the existing hangar rules. This operation does not deploy the wire
fix or resume an unfinished backlog feature.

Done: publish the seven illustrated feature cards through `aclone-bot` to
[Discord announcements](https://discord.com/channels/1562183434254680175/1565527790785404968/1567745710449754212).
Verify the saved bot identity, channel, exact text, seven image dimensions and
successful PNG responses. The post prominently states that all 24 recipients
receive an additional airframe even when they already own one. Consolidate the
new world-builder settings into one short paragraph. Screenshots use local
in-game demonstration scenes; omit the unreleased wire fix from the announcement.

## Resume with a release after each finished item — authorized 2026-11-04

Henry explicitly authorizes continuing the dependency order and, after every
finished item, committing, pushing, deploying and posting a Discord announcement
with a screenshot. This supersedes the checkpoint pause and unreleased-only
restriction for completed work. Keep the failing-first/relevant-test/browser/
TypeScript/format gates. Release independently usable rule batches as specified
by the existing plan; bump SemVer, retain an empty Unreleased section, refresh
README/player/world-builder/release docs, back up and deploy the exact pushed
branch commit, verify live health/assets, then publish through aclone-bot to the
existing announcements channel. Do not push main or open a PR. No further player
grants are authorized. Piloted spaceflight remains excluded.

First publish the already verified wire correction as 0.115.1. Its original red
and green evidence remains above; metadata changes require the affected NPC
guide tests, TypeScript, formatting and production-prefix build, followed by
read-only live client/website/asset checks. Use the reviewed local night-fence
screenshot in the announcement. Then resume item 11 at climate/calendar and
environment batches, with concrete criteria recorded before each implementation.

0.115.1 release gates pass: all 16 affected guide tests, clean TypeScript via
`BASE_PATH=/aclone/ npm run build`, successful prefixed production assets,
changed-file Prettier and `git diff --check`. The wire’s previously completed
rendering/unit checks apply unchanged; do not repeat the full suite for metadata.

0.115.1 is done and live: release commit `2ab2ddb` is pushed, matches the server,
and health/client/website all report 0.115.1. The prefixed client and map worker
load without browser errors. SQLite backup:
`/var/lib/aclone/backups/pre-deploy-20261104-224840.sqlite`; website rollback:
`/var/backups/aclone-website/site-20261104-224944.tar.gz`.
[Bot announcement with reviewed night screenshot](https://discord.com/channels/1562183434254680175/1565527790785404968/1567748026955604050)
is published; exact text, image dimensions and PNG availability are verified.
Evidence: `output/release-0.115.1/`. No player state was manually edited.

### Climate rules — precipitation, storms and snowfall

Before production edits, preserve the old deterministic weather output as a
SHA-256 fingerprint across three world seeds, three fractions per day and three
years. Expose spring/summer/autumn wet-event chances (0.64/0.64/0.9), winter
minimum/maximum wet-event chance (0.25/0.75), wet-event storm strength threshold
(1.1), winter blizzard chance (0.028), natural snowfall per strength (0.018 m/day),
blizzard extra snowfall (0.15 m/day), and forced snow/snowstorm rates
(0.12/0.48 m/day). Preserve event timing, random streams, duration, temperatures,
existing snow and crop reservations. Keep alpine snow-line/permanent coverage and
calendar/lunar/lottery changes pending as the next independent batches.

Completion criteria: a new `tests/climate-rules.test.ts` must fail for missing
rules before implementation. Explicit defaults and missing-key worlds must match
the captured weather fingerprint. Zero chances produce clear natural weather;
changed seasons affect only their season, and higher probabilities increase wet
opportunities without rerolling timing. Threshold/blizzard edits affect storms;
snowfall edits change accumulation, including creator-forced weather. Split live
steps and offline catch-up agree. Invalid/non-finite/range and inverted winter
bounds reject atomically. World creation, F10 fields, rules summary, resident
observations, SQLite reload and portable designs retain effective settings.

Browser criteria: in a disposable winter world, open F10 → Rules → Climate,
inspect defaults, change wet chances to zero and see clear weather, restore wet
chances and see snowfall, save/reload and inspect retained values, then submit
inverted winter bounds and prove rejection preserves the saved settings. Capture
the visible weather and settings for the release announcement. Run relevant
climate/environment/snow/farming/ocean/alpine consumers and guide tests, clean
TypeScript and explicit-file Prettier. Release, deploy and announce only after
all criteria pass; otherwise stop at the failing criterion.

Red verification: all five climate unit cases fail on missing defaults/unknown
settings, and the browser case fails because the Climate input is absent.
Evidence: `output/climate-rules/red.log` and `browser-red.log`. The frozen
weather fingerprint is `bb12b70eccd747f3ac869c3935b03fa72ffa8b2176294f11e9f20e90d1ae210a`.
Blizzard probability applies to snowy events, including cold shoulder seasons,
matching the existing formula; it is not restricted to winter.

The first green run found a pre-existing import atomicity gap (destination
revision changed before rule rejection). Apply designs on a disposable copy and
assign only after validation. All five climate cases then pass. The 69 relevant
checks pass except the resident request budget: new world-rule fields put it
196 bytes over its unchanged 96,000-byte ceiling. Compact the existing guide-use
instructions without removing requirements; keep all climate values observable.
The real-browser climate flow passes, including saved values and invalid edits.

Climate verification now passes: all 69 relevant checks are green after rerunning
the 16 guide cases affected by instruction compaction. The unchanged 96,000-byte
request ceiling passes. The browser clear/snowfall/reload/rejected-bounds flow
passes (2.4 minutes). Evidence is in `output/climate-rules/`. Prepare 0.116.0
with TypeScript/production-prefix build and formatting before commit/deployment.

0.116.0 release gates: clean TypeScript and successful `/aclone/` production
build; changed-file Prettier and whitespace checks pass. The new rule module
uses only `data/settings.json` defaults. No manual live world/player edits.

0.116.0 is done and live: pushed commit `60220c2` matches the server; health,
client and website report 0.116.0, prefixed client/map-worker assets load and
read-only live browser checks report no errors. SQLite backup:
`/var/lib/aclone/backups/pre-deploy-20261104-230708.sqlite`; website rollback:
`/var/backups/aclone-website/site-20261104-230820.tar.gz`.
[Verified screenshot announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1567752685808128081).
Release evidence: `output/release-0.116.0/`.

### Alpine climate rules — snow line and permanent summit snow

Completion criteria before production edits: expose the existing 1,180–1,390 m
snow-line transition above sea datum, permanent summit coverage (default on),
and alpine rain-to-snow rate (0.018 + intensity × 0.06 m/day). Preserve the
existing altitude/temperature formula and the northern-island scope. Numeric
snow-line values accept 0–10,000 m with full coverage strictly above the start;
rates accept 0–10 m/day. Disabling permanent coverage leaves seasonal snow and
snowfall intact. No terrain heights, existing snowpack or weather timing change.

Capture the old alpine output over four seasons, five weather modes, two sea
levels and 181 elevations. New `tests/alpine-rules.test.ts` must first fail on
missing rules, then prove default/missing-key equivalence, custom transitions,
disabled and absent-island states, rate changes, atomic rejection of equal or
inverted bounds/non-finite values, and creation/editor/summary/resident/save/design
round trips. Commands: `npx tsx --test tests/alpine-rules.test.ts` plus affected
alpine/climate/environment/import/guide consumers; `npx tsc --noEmit`; explicit
changed-file Prettier.

Browser criteria: use a disposable northern-island world, F10 → Rules → Alpine
climate, change the snow line and disable permanent snow, then reload and confirm
saved controls. Reject inverted bounds without changing saved settings. Observe
actual near-ground and distant-horizon materials following edits without a
reload/rebuild, and capture the snowy and disabled mountain views. Preserve
seasonal coverage in both shaders and absent-island behavior. Run the existing
alpine rain/snow/umbrella flow if the changed rendering path can affect it.
Release, deploy, verify and announce only after these criteria pass.

Alpine red verification: all four unit cases fail on undefined defaults or
unknown settings; the browser fails at the absent Alpine climate input after
loading the real mountain world. Evidence: `output/alpine-rules/red.log` and
`browser-red.log`. Frozen default fingerprint:
`cde3152d3924b338617c40a12259cd1d73876360092cbab4a0841657f726e57d`.

All five alpine unit cases and three existing alpine cases pass, including the
unchanged default fingerprint. An extra failing checkbox test caught a missing
checked attribute before browser verification; the editor now preserves both
default-on and saved-off states. The relevant 33-check run passes except the
resident budget (110 bytes over); compact its plan-use guidance without changing
requirements or the request limit, then rerun affected guide tests.

Alpine completion criteria pass: 33 relevant checks, including the corrected
16-case guide run with its unchanged request budget; clean TypeScript; default
fingerprint equality. Both browser flows pass (2.8 minutes total): local and
horizon shader values change live while material identities remain stable,
snow-covered slopes become bare when disabled, reload retains settings, inverted
bounds reject, and existing summer rain/summit snow/umbrella behavior remains.
Screenshots are reviewed in `output/alpine-rules/browser/`. Prepare 0.117.0 with
production-prefix build, changed-file formatting, exact-commit deployment and
read-only live checks before the screenshot announcement.

0.117.0 is done and live: pushed commit `97e6cfd` matches the server; client,
health and website report 0.117.0; prefixed client/map-worker assets and read-only
browser checks pass without errors. SQLite backup:
`/var/lib/aclone/backups/pre-deploy-20261104-231917.sqlite`; website rollback:
`/var/backups/aclone-website/site-20261104-232120.tar.gz`.
[Verified before/after screenshot announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1567756187389268009).
Evidence: `output/release-0.117.0/`.

### Calendar rules — lunar period

Before production edits, capture two years of existing sky/phase/tide output.
Expose `calendarLunarDays` in Calendar, default 28 game days, range 1–3,650
(fractional periods allowed). Visible moon phases and lunar tides must use the
same local period. Preserve solar motion, decorative-clock independence, wave
strength, saved economic time and the existing five-day phase offset. Missing
keys preserve old behavior. A changed period can change the current moon phase
and tide immediately; it does not reset time or change tidal range.

Completion criteria: failing-first `tests/lunar-rules.test.ts` for default and
legacy fingerprint equivalence, phase periodicity/custom moon positions and
actual water level, year/midnight continuity, zero tidal range, invalid/non-finite
period rejection and creation/editor/summary/resident/save/design round trips.
Run affected astronomy, ocean, sky-weather and guide tests, TypeScript and
changed-file Prettier.

Browser: a disposable clear-night world opens F10 → Rules → Calendar with 28
shown; change to 14 and verify the rendered moon directions/illumination and sea
level use the new period at the same saved date. Capture full-moon and dark-night
views, reload to confirm retention, and submit zero to prove rejection retains 14. No render errors. Year/season/lottery changes remain pending; their crop,
ageing, property and signed-loan dependencies are assessed separately. Release,
deploy, verify and announce after all criteria pass.

Lunar red verification: all three unit cases fail on absent defaults/unknown
settings. The real-browser case fails at the missing Calendar input. Evidence:
`output/lunar-rules/red.log` and `browser-red.log`. Frozen sky/tide fingerprint:
`c3fe86c73bea19161f51f7be6fe213ae582f1f514bd2a725cc11919e20c9b477`.

All 35 relevant lunar checks pass; TypeScript is clean and the 16 guide checks
pass again after documentation edits. The first green browser run verifies the
full-moon shader and tide, then catches a screenshot-harness assumption: fading
toasts retain their text after becoming transparent. Wait for CSS opacity zero
instead of empty text, preserving the clean-screenshot criterion and every
moon/tide/reload/invalid-value assertion; rerun the browser flow.

Lunar completion criteria pass: 35 relevant checks, the final 16 guide checks
after docs, clean TypeScript, and the complete browser flow (2.0 minutes) with
rendered moon direction/illumination and sea level matching the local rule. The
invalid zero period is blocked by the browser and rejected by server/unit import
validation; saved 14-day settings survive reload. Reviewed screenshots show the
same night changing from moonlit to dark. Prepare 0.118.0 with prefixed build and
formatting, then deploy the exact pushed commit and verify before announcing.

0.118.0 is done and live: pushed commit `c611299` matches the server; health,
client and website report 0.118.0, prefixed assets and the read-only browser pass.
SQLite backup: `/var/lib/aclone/backups/pre-deploy-20261104-233534.sqlite`;
website rollback: `/var/backups/aclone-website/site-20261104-233655.tar.gz`.
[Verified moonlight screenshot announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1567760016243560479).
Evidence: `output/release-0.118.0/`.

### Communication rules

Before production edits: expose `chatMaxLength` (default 1,200 UTF-16 characters,
integer range 1–12,000) and `npcGroupReplyCooldown` (default 30 real seconds,
range 0–86,400) in Communication. Apply the chat limit to public/private player
and resident speech, provider schemas and validation, and both chat/CB inputs.
CB retains the smaller of its radio limit and the local chat limit. Preserve
blank-text rejection, moderation, command restrictions, history, drafts and
complete text; never silently truncate. Provider token/transport budgets remain
independent ceilings, not a promise to generate the maximum permitted text.
Group replies retain one interested respondent and existing qualification/needs/
preference filters; zero disables only the shared delay, and saved reply times
survive edits/restarts. Missing keys retain shipped defaults.

Completion criteria: `npx tsx --test tests/communication-rules.test.ts` starts
red on missing settings and proves default/custom boundaries, public/private/NPC
speech, muted/locked/blank refusals, CB limits, cooldown boundaries and saved
state, validation and creation/editor/summary/observation/save/design round trips.
Mock both provider transports in plan and conversation mode to prove their
advertised and accepted limits agree, including limits above 1,200 and default
rejection of 1,201. Run affected messages/radio/group/conversation/provider/guide
checks, `npx tsc --noEmit`, production build and changed-file Prettier.

Browser: disposable world, F10 → Rules → Communication displays 1,200/30;
edit to 80/5, verify live chat and CB maxlength, preserved drafts/history, an
80-character sent message and blank/muted refusals. Raise to 1,600 and send a
complete message longer than 1,200; reload retains settings and history. Zero
chat length is rejected without changing the saved value. Capture the controls
and visible chat flow, inspect screenshots and require no browser errors. Release,
deploy, verify and post a screenshot announcement only after criteria pass.

Communication audit also finds family chat's independent 1,200-character copy.
Include that chat surface in the same local rule, preserving its private copies
and existing trimming/moderation. Durable letters keep their separate limit.
Add a failing family boundary/UI test before changing it. CB's independent
maximum remains 1,200, so a larger parish limit does not raise its radio cap.

Communication red verification: all nine unit/provider cases fail for the missing
settings, fixed provider ceiling or unchanged family boundary; the browser fails
on the absent Communication input. Logs: `output/communication-rules/red.log`
and `browser-red.log`. Proceed with production changes.

The first relevant run passes 86/87 checks; the added observed fields put the
unchanged 96 KB NPC request test 35 bytes over budget. Compact equivalent
reliability guidance rather than enlarge the budget. TypeScript catches an
over-specific Zod generic shared by two different tool shapes; use the common
JSON-schema property shape. The browser proves the live settings update, then
hits an editor-refresh race while scrolling for its screenshot. Capture the
filled controls before Apply and rerun all remaining assertions. A CB fixture
also needed its pilot online to test transmission limits rather than boarding.

Communication completion criteria pass: all 89 relevant checks, including live
controller publication of complete >1,200-character replies through planning and
dialogue; TypeScript is clean. The final browser run passes (1.8 minutes): local
chat/CB caps, draft/history preservation, blank and muted states, longer public
and private family messages, reload and invalid-zero rejection. Reviewed
screenshots now show the controls unobscured and the complete chat ending.
Fixture corrections preserve the established whitespace trimming and exact
80-character boundary. Prepare 0.119.0, run the prefixed build and formatting,
then deploy the pushed commit and verify before its screenshot announcement.

0.119.0 release gates pass: the prefixed production build includes a clean
TypeScript check; all 17 guide checks pass after release documentation changes.
Changed files are formatted and `git diff --check` is clean. No production
player state has been manually changed.

0.119.0 is done and live: pushed commit `fad879f` matches the server; game health,
client and website report 0.119.0; prefixed assets and read-only browser checks
pass without errors. SQLite backup:
`/var/lib/aclone/backups/pre-deploy-20261104-235855.sqlite`; website rollback:
`/var/backups/aclone-website/site-20261105-000011.tar.gz`.
[Verified Communication screenshot announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1567765596593201222).
Evidence: `output/release-0.119.0/`.

### Calendar rules — lottery schedule

Before production edits: expose `lotteryDrawDays` in Calendar, default 365 game
days, integer range 1–3,650. Keep lottery timing explicitly in economic game
days (600 real seconds), independent of decorative clock, lunar cycle and the
pending year/season controls. This makes the lottery schedule independently
configurable without rewriting a paid round's deadline. First activation uses
the next interval boundary after world creation; existing rounds retain drawAt,
tickets, pot and ticket price. After that draw, use the current interval from
its saved deadline, skipping empty elapsed intervals as before. Never pay twice.
Disabling entries still honours paid tickets; no-ticket pots still carry forward.
Use accurate local schedule/countdown text, including before the first draw,
and call the UI Parish lottery instead of claiming every custom cycle is annual.
Retain recognition of historical annual-prize ledger records in statistics.

Completion criteria: add/run red `tests/lottery-rules.test.ts` proving default
and missing-field 365-day timing, custom first/next draws, unchanged pending
rounds, downtime bounds, cash conservation/offline payouts/exactly-once reload,
empty/disabled cases, invalid values and creation/editor/summary/observation/
save/design round trips. Run affected lottery/statistics/guide/lunar tests,
TypeScript and changed-file formatting; do not run the full suite.

Browser: disposable world, edit Calendar from 365 to 7; open Parish lottery and
verify local seven-day cadence/countdown and empty history. Buy tickets, change
the setting to 3 and verify the paid round's countdown stays at seven days.
Show an insufficient-cash refusal and disabled-entry state; advance only the
local fixture to its due time, check the winner and next three-day round, then
reload to verify no duplicate payout. Reject zero without changing the saved
rule. Capture/review the live controls and lottery panel. Release, deploy,
verify and announce with a screenshot only after all gates pass.

Lottery red verification: all five cases fail on the missing rule, fixed
schedule or unrecognized new prize label. The browser fails on the missing
Calendar interval field. Evidence: `output/lottery-rules/red.log` and
`browser-red.log`. Proceed with the smallest schedule change.

Lottery unit gates pass: 35 relevant checks, clean TypeScript and all 17 guide
checks after docs. The existing browser purchase/contribution flow passes. The
new flow reaches the disabled-state check with the remembered contribution
input still focused; normal panel refresh intentionally waits for a draft to
lose focus. Use the settings action and click the heading to finish editing,
then verify the same disabled-state and payout criteria. No criterion is removed.

The second browser run shows that focus was not the root cause: `tick:false`
also disables periodic snapshots. Direct fixture mutations cannot reach the
client until another network action. Run the normal disposable server loop,
start with the lottery disabled, then enable it through F10 alongside the
seven-day interval. Retain the focus-safe refresh check and all original payout,
reload and refusal assertions; this exercises actual live delivery.

Lottery completion criteria pass: 35 relevant tests plus the published-guide
check (36 unique checks), clean TypeScript, both browser flows (existing entry/
contribution and the 1.7-minute custom-schedule flow), and a short separate
Calendar screenshot capture. Reviewed controls, pending-round and winner
screenshots show the local interval, protected deadline, disabled entries,
paid winner and next interval. Zero rejects; reload retains the result without
another payout. Prepare 0.120.0 with release docs, prefixed build and formatting;
then deploy the pushed commit and verify before announcing.

0.120.0 release gates pass: prefixed production build and TypeScript, all 17
guide checks after release metadata, changed-file formatting and clean diff
checks. Deployment and public announcement follow; live player state remains
untouched apart from normal game simulation.

0.120.0 is done and live: pushed commit `d95c763` matches the server; game health,
client and website report 0.120.0, and prefixed assets/read-only browser checks
pass. The deploy script's first request caught a transient startup 502; the
follow-up service/health check and full browser verification passed without a
second deployment. SQLite backup:
`/var/lib/aclone/backups/pre-deploy-20261105-001714.sqlite`; website rollback:
`/var/backups/aclone-website/site-20261105-001838.tar.gz`.
[Verified lottery screenshot announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1567770328636072017).
Evidence: `output/release-0.120.0/`.

### Arrival and respawn location

Before production edits: the duplicate spawn-clearance claim already matches
`spawnClearance` (default 12 m) from the construction slice; reuse it. Expose
`respawnX`/`respawnZ` under Construction rules, defaults 0/17 m, finite coordinates
within the world's map bounds (global supported range ±50,000 m, fractions
allowed). The shared arrival point, ordinary death recovery and submerged-land-
vehicle fallback use this point at the actual ground height. Keep the named
PARISH_SPAWN default alias. Preserve existing players on settings edits/rejoins,
all death penalties and boat recovery/arena overrides, and the rejection of a
free respawn/teleport action. Reservations follow the new point; existing town
centres and explicit spawn zones remain protected.

Changing coordinates must reject submerged/high-tide ground and existing
building/solid-object/barrier obstructions before changing settings. Use the
existing spawn-clearance rule for the buffer, with a point collision check even
when that buffer is zero. Do not relocate or delete existing world objects.
Unchanged legacy coordinates remain editable with unrelated settings; future
terrain edits still require the builder to keep the selected site usable.
Missing fields retain the original arrival point. Creation, summaries, resident
observations, editor, saves and design export/import carry the coordinates.

Completion criteria: failing-first `tests/respawn-rules.test.ts` verifies default/
legacy positions, custom new arrivals and ordinary death at terrain height,
unchanged current players, relocated construction/farm reservations, finite/map/
water/occupied-site rejection with atomic settings/imports, and all round trips.
Run relevant spawn-reserve, construction, survival/life, boat-death and arena
checks, TypeScript, production build and changed-file formatting.

Browser: in a disposable flat world with a nearby house, F10 → Construction
rules shows 0/17 and existing clearance 12. Set 80/−80 and confirm the current
player stays put. Trigger death only in that local fixture; see the player arrive
at the configured clear site and ground height. Reload retains the position and
settings. Reject an out-of-map value, a flooded point and the occupied house
without changing the saved location; verify the player remains usable. Capture
and review the controls and actual arrival view, with no browser errors. Release,
deploy, verify and announce only after these criteria pass.

Respawn red verification: all six unit cases fail on missing coordinates or
unknown settings. The browser flow is written before production code; the red
unit run is the failing-first gate for this slice. Evidence:
`output/respawn-rules/red.log`. Use ordinary old-age death in the disposable
fixture, preserving survival mechanics rather than relying on a zero-health
fixture that can regenerate before the death check.

The first relevant run passes 94/95 checks. The remaining barrier fixture had
mutated the landscape array in place after its geometry cache was built; use
the actual landscape action to publish an immutable edit. The high-tide fixture
also needs sea datum zero to put its one-metre bank below the two-metre tide.
Keep all obstruction assertions. Add the required neutral boost input to the
submerged-vehicle fixture for TypeScript. Broaden only to flight/spaceport
movement checks because initial ground height now follows custom terrain.

Arrival/respawn completion gates pass: 116 unique relevant unit/guide checks,
including the corrected obstruction fixtures and flight/spaceport movement.
The browser flow passes in 1.5 minutes, including the actual rendered ground
position, reload, driving away and all three rejected-location states. Reviewed
controls and arrival screenshots show the configured site and a usable player.
TypeScript is clean; changed files are formatted. Prepare 0.121.0, run the final
production build and publish only after those release checks pass. Evidence:
`output/respawn-rules/`.

### Repair native Lua worker imports before the landscape release

The landscape import check uncovered a communication-slice regression: native
Node workers cannot load `messages.ts` because its settings JSON lacks an import
attribute, and its rule-module import needs an explicit extension. Preserve the
small native worker graph and existing isolation/resource budgets.

Completion criteria, before production edits: extend `tests/scripts.test.ts` with
an actual native worker loading chat validation, proving default and custom caps;
run it red. Existing pooled-worker isolation/recovery and actual HTTP design-import
checks must also pass. Run communication/chat/Lua checks, TypeScript and production
build. Browser: import a script-bearing world design into a disposable local
account, enter it, verify its scripted welcome appears, capture/review the view
and check for browser errors. Release a separate patch, deploy exact pushed code,
verify read-only live health/assets and announce with the local-world screenshot.
Do not change live scripts or create live test players.

Initial evidence: the existing HTTP import returned 400 with
`ERR_IMPORT_ATTRIBUTE_MISSING`; the pooled-runtime test fails on the same missing
JSON attribute. Logs: `output/landscape-rules/http.log` and `scripts-red.log`.
Landscape work is preserved separately until this blocking regression is repaired.

The new native-worker regression test fails before the import corrections and
passes afterwards. All 23 relevant script, HTTP import, communication and civic
Lua checks pass; pooled invocation isolation and budget recovery remain tested.
TypeScript is clean. Evidence: `output/release-0.121.1/`. Browser verification
continues using the editor's actual Transfer tab (the initial test used an
incorrect tab label and was stopped before retrying).

The browser import/entry/welcome flow passes (2.2 minutes). The captured welcome
is correct, but a transient software-rendering notice overlaps the screenshot;
wait for the notice to finish before recapturing the announcement image. The
unchanged guide budget and published-guide checks also pass (17 checks).

0.121.1 is done and live: commit `4a31148` is pushed and matches the server.
The recaptured browser flow passes and its welcome screenshot is reviewed; all
40 relevant unit/guide checks, TypeScript, formatting and production build pass.
Read-only health, client, website and map-worker checks pass without page errors.
SQLite backup: `/var/lib/aclone/backups/pre-deploy-20261105-005022.sqlite`;
website rollback: `/var/backups/aclone-website/site-20261105-005156.tar.gz`.
[Verified scripted-world announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1567778615591051354).
Resume the preserved landscape capacity work below.

0.121.0 is done and live: pushed commit `ba00d08` matches the server. Health,
client, website and prefixed map-worker assets pass read-only browser checks with
no page errors. SQLite backup: `/var/lib/aclone/backups/pre-deploy-20261105-003400.sqlite`;
website rollback: `/var/backups/aclone-website/site-20261105-003520.tar.gz`.
[Verified arrival screenshots announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1567774357734953000).
Evidence: `output/release-0.121.0/`.

### Terrain and landscape capacity

Before production edits: expose the existing terrain and landscape count/length
limits in a Landscape limits fieldset, retaining current defaults: terrain stamps
256; paths 16; barriers 16; surface brushes 64; scatter groups 16; instances per
scatter group 64 and per world 128; points per line 16 and total 128; barrier length
1,200 m. Zero count/length capacity disables new content in that category; each
line still needs at least two points. Keep brush dimensions, map bounds, the fixed
33 × 33 heightmap format, model validation and four-entry undo history unchanged.
Do not expose structural persistence identifiers or change their limits.

Bounded supported ceilings: 512 terrain stamps; 64 paths/barriers/scatter groups;
256 surfaces; 128 instances/group and 512 total; 32 points/line and 512 total;
4,800 m barriers. These are safety bounds, not additional default values. Verify
maximum-size geometry, payload size below the existing 512 KiB action envelope,
and a browser world above the former capacities before calling increases safe.

Completion criteria: first run `npx tsx --test tests/landscape-rules.test.ts` red.
Assert defaults and missing-key fallback; each custom limit accepts beyond its
former default and rejects overflow atomically; finite/integer/range validation;
creation, editor, summary, resident observations, saves and design round trips.
Reject lowering below current content or any retained undo state without changing
settings/content/history. Undo remains valid after a permitted limit edit. Design
imports validate their own settings before enforcing capacities, without weakening
ordinary default imports or changing the destination on failure. Preserve model,
point spacing, duplicate-ID, coordinate and heightmap checks.

Browser: disposable flat world, empty landscape and disabled scatter without a
model; change Rules → Landscape limits; add an extra visible path/surface above
the old cap, observe it in the landscape preview and world, reject an overflow,
undo, reload and verify saved content/settings. Reject lowering below saved work
with a clear message. Test terrain brushing at a raised stamp cap and its failure
state. Capture/review a screenshot and record responsiveness at supported bounds.
Run affected landscape/creator/design/terrain tests, guide checks, TypeScript,
production build and Prettier. Release/deploy/announce only if these pass.

Landscape red gate: all six cases failed on missing defaults/unknown settings
before production edits (`output/landscape-rules/red.log`). The first green run
passes all six, including every independent increased capacity, atomic overflows,
undo-history protection, portable raised layouts and transport/geometry bounds.
TypeScript passes. The browser stress fixture exercises supported combined bounds
in a disposable world; relevant existing checks are running.

After the native-worker repair, resume the same landscape criteria. The first
browser attempt reached the maximum saved surface count, but submitted the next
edit before that snapshot refreshed the form; wait for the visible capacity and
reset coordinates before asserting overflow. Keep the overflow assertion. The
resident request-size check also exceeded its unchanged 96 KB ceiling by 234
bytes; compact redundant instruction wording while preserving every constraint,
then rerun that gate. No next backlog item starts until this slice passes.

The second browser run confirms a real editor gap: after an accepted surface
edit the server has 256 surfaces, while the open form still reports 255 and
holds the previous snapshot. A second full-layout submission can overwrite the
prior edit. Refresh Landscape on accepted landscape/terrain snapshots, preserving
form drafts with PanelMemory, instead of the result timer that can precede the
snapshot. The existing failing browser assertion now guards this behavior; keep
its capacity/overflow/undo checks and assert the edited coordinate stays at zero
(the established draft-preservation behavior), not that it resets to 17.

The revised snapshot-driven browser flow passes accepted-count, draft retention,
overflow, undo and reduced-cap rejection steps and proceeds to reload/timing.
All 17 guide checks now pass with the unchanged 96 KB budget, explicit AI-identity
and operator-impersonation checks intact (`guides-final.log`). The HTTP design
import passes with the separately released native-worker repair.

Landscape completion gates pass: all 50 unique relevant unit/guide checks are
green after the worker fix and request-size corrections. The final resident
request is 95,938/96,000 bytes with full rule values and guide coverage retained.
TypeScript is clean. Both browser flows pass: raised-capacity desktop (2.3 min)
and existing mobile paths, fences, surface painting, heightmap preview and undo
(1.3 min). Reviewed preview/failure and rendered-world screenshots. The supported
combined-bound fixture fits the existing transport envelope and generates finite
geometry. Its software-rendered median frame interval is 533 ms versus 483 ms
for the baseline; this is local regression evidence, not a hardware FPS promise.
The final world screenshot shows the accepted surface and scattered test models.
Prepare 0.122.0 and run the final production build before deployment. Evidence:
`output/landscape-rules/`.

0.122.0 is done and live: pushed commit `3da4b69` matches the server. Health,
public client, website and prefixed map worker pass read-only checks without page
errors. SQLite backup: `/var/lib/aclone/backups/pre-deploy-20261105-010547.sqlite`;
website rollback: `/var/backups/aclone-website/site-20261105-010753.tar.gz`.
[Verified landscape screenshot announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1567782725631344640).
Evidence: `output/release-0.122.0/`.

### Year length and seasons — finish the remaining world rules

Before production edits: add Calendar fields `calendarYearDays` 365,
`calendarSpringDay` 59 (zero-based), `calendarSpringDays` 92,
`calendarSummerDays` 92 and `calendarAutumnDays` 91. Derive the remaining winter
length (90 by default), rather than storing a second conflicting year total.
Use whole days: year 4–3,650, each named season 1–3,650, spring start 0–3,650;
validate at least one winter day and spring start no later than the winter
length, so the seasonal cycle fits the year. A new world's calendar starts at
its spring boundary with the existing time-of-day offset. Missing keys preserve
the exact current calendar, weather, sky and snow behavior.

Proceed with the previously offered broad calendar interpretation: future ageing
and building wear, current estate annual discounts and new loan payment periods
follow year length. Existing ages and saved simulation time do not change on an
edit. Loan records capture their agreed period; old records without it retain
the original bank month. Interest, billing, grace/default deadlines, UI and NPC
borrowing must use the signed period. Quote acceptance rejects a changed period.
Credit records retain their recorded bucket cadence (legacy records use the old
month); normalize income and outstanding payment rates to the current quoted
month for affordability, without reinterpreting old income buckets or history.

Season boundaries drive planting, winter crop loss, NPC planting decisions,
weather, temperature, solar motion, daylight, lights and snow melt. Map the
seasonal solar/temperature cycle to the configured season lengths while keeping
the default calculations exact. Lunar elapsed time/period, tides, lottery
intervals, crop growth days, event intervals and already signed deadlines keep
their independent rules. Calendar edits can immediately change season/weather
and estate prices or expire crops; explain this clearly in the editor/docs.
Do not reset snowpack, ageing history, world time, loans or purchased land.
Invalidate ocean weather caching for same-time calendar/climate edits.

Completion criteria: record a pre-change deterministic default fingerprint of
calendar, weather and astronomy. Write and run failing tests in
`tests/calendar-year-rules.test.ts` and `tests/calendar-finance-rules.test.ts`
before production edits. Verify all season transitions/year wrapping, validation
and atomic invalid imports, defaults/legacy fingerprints, editor/summary/NPC/save/
design round trips, winter crop deadlines/catch-up, climate catch-up equivalence,
same-time weather-cache changes, unchanged lunar timing, future ageing/wear and
estate discounts. Verify new signed loan periods, stale quotes, legacy and
existing loan preservation, interest/billing/grace/defaults, mixed-period credit
rates and save/reload. Run affected existing calendar/climate/farming/astronomy,
property/loan/NPC-finance checks, TypeScript, production build and formatting.

Browser: a disposable owner world shows defaults and derived winter length in
Calendar; apply a valid short year and custom seasons, see its HUD date/season
and ground/sky, and verify reload. Reject impossible season totals and spring
boundaries without mutating settings. Show empty and planted farm behavior across
its custom winter. At a local bank, show the current month length, accept a new
quote with its period, change the year, and verify the existing loan retains its
schedule while a new quote uses the new period; stale quotes must fail safely.
Capture/review screenshots, check browser errors, then release/deploy/announce.
No next Planned section begins before these criteria pass.

Calendar red gate: all 11 new cases fail on missing fields/unknown settings before
production edits. Ten pass on the first implementation, including exact default
fingerprints and all finance cases. The remaining lunar assertion exposes an
inclination term tied to the solar longitude: keep that term on the existing
elapsed lunar orbit while allowing the configured seasons to move the sun. Do
not weaken the lunar phase assertion. Correct the partial-calendar argument types
and remaining debt-status period references reported by TypeScript. Evidence:
`output/calendar-year-rules/red.log` and `green.log`.

Browser follow-up: the bank flow passes (signed 6,000-second period retained;
new 12,000-second offer; stale acceptance rejected). The first farm assertion
held a pre-rollback building reference after an intentionally invalid settings
edit; the actual browser showed the planted wheat. Change the fixture to read
current server objects after rollback. Inspection also finds farm/help prose
still claiming a fixed ~61-hour year. Before fixing that prose, extend the farm
browser check to require `Four seasons span 20.00 real hours` for the 120-day
year; use the shared calendar conversion in both farm and general help.

Calendar verification: all 138 relevant unit/guide cases pass across the initial
run and targeted repairs. The five initial failures were four NPC-finance cases
(the operation schema needed the quoted period, and one description retained its
existing wording contract) and the 96 KB resident-request budget. Compact only
redundant instruction prose without removing behavior; the budget now measures
95,982 / 96,000 bytes. All 11 new checks pass on the final implementation, including
the exact pre-change calendar/weather/astronomy fingerprints. TypeScript is clean.
The farm-duration browser regression fails on the old fixed `~61 hours` text,
then both browser flows pass in 3.3 minutes after the fix. They cover invalid
settings, empty/ planted farms, winter loss, spring reopening, reload, new and
signed bank periods, stale offers and no browser errors. Review the editor,
farm/ground/sky and bank screenshots in `output/calendar-year-rules/browser/`.
Software-renderer warnings in test evidence are not a hardware performance claim;
the announcement uses the unobscured Calendar editor screenshot.

Commands/evidence: the 138-case affected suite in `relevant.log`, targeted repairs
in `repaired-final.log`, final new cases in `final-new.log`,
`npm run test:e2e -- tests/browser/calendar-year-rules.spec.ts` in
`browser-green.log`, `npx tsc --noEmit` in `tsc-final.log`, and changed-file
Prettier in `prettier.log`. Use the package's `test:e2e` runner (which loads tsx),
rather than bare Playwright CLI, for server-backed TypeScript fixtures.
Prepare release 0.123.0; push and verify before deploying the exact commit.

Release gates pass: the `/aclone/` production build completes with TypeScript
clean; the final 17 guide/budget checks pass after release documentation updates.

**Done and live — 0.123.0 / remaining world rules complete.** Commit
`ce74be3d7cb2b0afbce5659ef2073f9cf1a23656` is pushed to
`backlog-implementation` and verified through GitHub and the live checkout.
Database backup: `/var/lib/aclone/backups/pre-deploy-20261105-014130.sqlite`.
Website backup: `/var/backups/aclone-website/site-20261105-014249.tar.gz`.
The deploy script's first health request met a transient restart 502; subsequent
read-only checks confirm active service, 0.123.0 health, matching commit, loaded
browser assets/map worker, updated website and no browser errors. No redeployment
or live gameplay mutation was needed. The bot announcement and its 1440×900 image
are verified: <https://discord.com/channels/1562183434254680175/1565527790785404968/1567791375934685284>.
Evidence: `output/release-0.123.0/`. Eight of 25 eligible Planned sections are now
complete. Continue item 12, solid trees/boulders/vehicles; piloted spaceflight
remains excluded.

### Solid trees, boulders and vehicles — completion criteria before code

Implement item 12 as one complete feature before its release. The claim is a
shared, deterministic set of solid trunks and boulders, swept movement responses
without damage, vehicle/pedestrian contacts with server authority, configurable
modes and offline behavior, and shared road/navigation/construction/snow inputs.
Do not begin cargo boats until all these gates pass.

Use a shared 256-m chunk generator and spatial buckets, independent of graphics
quality. Preserve the existing tree/rock models and approximate normal-quality
placement density; decouple candidate seeds from exclusion decisions so adding a
building or road does not move unrelated trees. Exclude roads, existing buildings
and construction, farm plots/pastures, gathering grounds, airfields, the spaceport
reservation, water and spawn/town-centre reserves. Include village trees/rocks,
streamed woodland/upland rocks, coastal outcrops and the three large stone-ground
boulders. Their authored dimensions/positions must have one shared source used
by rendering and collision. Keep creator-solid scatter's existing path. Draw
solid trunks at both qualities; quality can simplify crowns. Reuse those same
instances for snow obstacles. Cache geometry by terrain/layout changes, not each
movement tick; query only spatial buckets overlapping the swept segment.

No explicit defaults are specified in the entry. Choose `solidScenery` =
`trunks-and-boulders` (also `off`, `trunks`), `vehicleCollision` = `glancing`
(also `off`, `stop-only`), `pedestrianBlocking` = true,
`offlineVehicleObstacleSeconds` = 60 (0–86,400), `vehicleGlancingDegrees` = 15
(0–45), and `vehicleGlancingSpeed` = 0.7 (0–1). Source defaults once from
settings; show/validate them at creation, editor, summary, saves/designs and NPC
observations. Exclude at-home/riding and airborne players, and offline drivers
after the configured timeout; zero ignores them immediately. Vehicle collision
`off` disables player contacts; pedestrian blocking can be independently disabled
while vehicle contacts remain enabled. Vehicle footprint dimensions belong to
the existing per-vehicle tuning catalogue. Refuse explicit engine-off parking in
arrival/town-centre reserves and narrow gate/bridge/jetty passages; never move a
stationary player in response to another player's input. Offline expiry prevents
an abandoned vehicle from becoming a permanent route obstruction.

Write/run red tests in `tests/solid-obstacles.test.ts` and
`tests/vehicle-contacts.test.ts` before production edits. Concrete assertions:

- Same chunk/seed and saved/reloaded world produce identical `{id,x,z,kind,radius,
height}` objects for server and both render qualities. Road/building/terrain
  edits invalidate affected placements. Assert all exclusions and stone/coastal
  model transforms; empty/scenery-disabled worlds and each rule mode behave as
  documented.
- A swept tractor hits a trunk/boulder even across a long step, stops with exactly
  unchanged fuel, health and condition, and can drive strictly outward after
  loading inside an obstacle. Walking slides round a trunk; boats and airborne
  players retain their existing movement. No crown collision.
- Rear-end contact stops only the moving/faster entrant; head-on closing stops
  both; shallow glancing contact slides along the other hull at reduced speed.
  Neither impact pushes the struck party or causes damage. Test rotated hulls,
  reverse motion, stationary targets, pedestrians against tractors, offline
  expiry, at-home exclusion, disabled modes and prediction never mutating another
  player's snapshot. Exercise grounded aircraft without changing aerial crash
  rules.
- New construction and its preview reject overlapping solid scenery; road
  growth routes round it; NPC ground routes and escape checks use the same data.
  Existing creator solids, river fords/deep reaches and road growth remain valid.
- Browser: low and normal quality show the same trunk locations; drive into a
  visible tree and boulder, walk around one, escape an initially overlapping
  trunk, encounter another local player, change/offline/disable rules, and check
  the rules editor and an obstructed construction preview. Show clear empty
  ground with scenery disabled. Verify real controls/server corrections, no
  browser errors, and review screenshots suitable for the announcement.

Run relevant existing scenery, movement, prediction, navigation, construction,
road-growth and northern-island tests plus TypeScript, changed-file Prettier and
the production build. Establish the pre-change renderer baseline with
`PROFILE_OUT=output/solid-obstacles/baseline PROFILE_WORLD=expanded
PROFILE_POPULATION=32 npx tsx scripts/island-performance.ts`; repeat the same
hardware/settings after implementation. Also add measured cached obstacle-query
and 32-player movement tick checks to that script: keep a 50 ms tick budget and
bounded spatial candidate counts. Compare steady frame p95 and transition tails;
investigate any material regression (over 10% beyond timing noise), do not claim
software-rendered timings as hardware performance. Baseline uses the available
NVIDIA Quadro M1200. Use `TEST_GPU=1` for this item's browser checks on this host.

Red gate: all 16 new cases fail before production changes (`output/solid-obstacles/red.log`):
missing rule defaults/shared placement module, pass-through contacts and accepted
parking in the arrival reserve. Baseline hardware survey completes all six
expanded-island scenarios with 33 rendered players: steady frame p95 is
35.5/41.8/37.5/36.4/37.0/35.6 ms (town/river/forest/summit/storm coast/return).
No steady frame exceeds 100 ms. Evidence: `output/solid-obstacles/baseline/`.

Solid-obstacle progress (unreleased): the initial 16 tests now pass, with added
coverage for NPC detours/escape, same-tick terrain/road replacement, grounded
planes, rule controls, reserved-route parking and unchanged hovercraft helm
eligibility (26 checks including the existing captain tests). Add
`clearRouteParking`, default true, to the configurable policy: false disables the
engine-off parking refusal. No bridges exist yet; the future crossing item must
register its reserved passage with this shared policy before bridge release.
The renderer regression first failed with 215 missing shared trunks in low
quality, then passed in both qualities after village/streamed renderers consumed
the same objects. Evidence: `output/solid-obstacles/render-red.log` and
`render-first.log`. The actual owner-editor browser flow first failed on the
missing named collision fieldset before that UI was added.

The broader relevant run passed 73/75 checks. The two failures are NPC approach
to stone grounds and long cape road surveys. Continuous NPC edge checks with
smaller grid inflation restore all gathering-site journeys; the cape survey is
still under investigation. Its eastern fixed endpoint now lies inside a solid
trunk, and coarse search steps also miss clear ways around scenery. Do not mark
this item done or release it until the routing criteria and browser/performance
gates pass. First 32-player warmed movement survey: p95 37.9 ms, maximum spatial
candidate count 12; cold generation 214 ms, reported separately. Cache tuning is
in progress; these are preliminary results, not release verification.

Solid-obstacle verification update: the affected 154-test run passes, including
navigation, road growth, northern rivers, flight, prediction, construction,
vehicle tuning, resource scenery, snow and resident-guide budgets. TypeScript is
clean. Long road surveys refine obstructed coarse edges on the existing fine
grid; all accepted segments still pass the shared solid-obstacle check. The old
eastern-cape endpoint is now inside a generated trunk: the regression explicitly
requires refusal there, then verifies a clear destination within six metres with
the original traversability and route-length checks. Short town-road routing
retains its previous simplification behavior.

A new red test demonstrated that a shallow vehicle contact could redirect an
otherwise clear trajectory into a trunk. Recheck the redirected sweep before
accepting movement; all 25 solid/contact checks pass after that correction.
The expanded browser flow verifies walking slide, overlap escape, blocked
construction, scenery removal, vehicle contact and offline timeout. Its final
mode-change step initially remained blocked by the deliberately invalid 46-degree
draft retained by the editor. Restore that draft to 15 after verifying native
validation, then rerun the flow without changing the acceptance assertions.
The first full performance comparison overlapped compilation/tests; its late
frame tails are not an isolated result. Repeat without concurrent workloads
before releasing. Keep the same performance gates and baseline.

Held-throttle browser verification exposed another real gap: after the first
blocked sweep, shorter subsequent ticks could advance the tractor toward the
trunk and charge fuel. `held-contact-red.log` reproduces this with variable tick
lengths. Preserve the original stop position and remember only the blocked
scenery reach; recheck against current geometry and the new direction, clearing
it when the driver turns away, changes vehicle/position or the obstacle is gone.
All original position/fuel/condition assertions remain intact. The 66 affected
movement/flight/navigation checks pass after this repair.

Offline snapshot regression: a recently signed-off vehicle remained solid for
60 seconds on the server but vanished from the client. The new test first fails
on the missing public obstacle (`offline-snapshot-red.log`). Retain its visible
public projection for exactly the configured collision lifetime, include its
sign-off time for prediction, and keep private inventory/finances excluded.
Existing snapshot privacy/deletion tests now additionally check the signed-off
projection and deletion at expiry. All 52 contact/snapshot/prediction checks pass.

**Solid-obstacle release gates passed (0.124.0).** All 176 relevant tests pass
(`output/solid-obstacles/release-tests.log`), covering contacts, snapshots/privacy,
prediction, roads, NPC navigation/construction, northern movement, flight, vehicle
configuration, creator/design import/export, resource scenery, snow and guide
budgets. The final owner browser flow passes in 47.3 seconds (`browser-clean.log`),
with both-quality rendered trunk parity also passing (`browser-held-contact.log`).
Review tree, boulder, walking, blocked-building, empty-ground, rules and vehicle
screenshots under `output/solid-obstacles/browser/`. Retrying a detached editor
fieldset and correcting the toast selector repaired test synchronization only;
all behavior assertions remain. Announcement images are the successful tree and
vehicle contacts, explicitly labelled as local verification-world captures.

The isolated `/aclone/` production build passes, including `tsc --noEmit`
(`build-isolated.log`); an earlier concurrent build received SIGTERM without a
compiler diagnostic, so it was rerun alone. Changed files are Prettier-formatted.
The isolated matched Quadro M1200 / 33-rendered-player performance run passes:
steady frame p95 **34.6/37.2/35.9/36.8/35.0/34.0 ms** versus baseline
35.5/41.8/37.5/36.4/37.0/35.6. No steady frame exceeds 100 ms; maximum is 85.2 ms,
with transition maxima 36.6–72.1 ms. Map open/pan/zoom record no long tasks.
The 32-player movement survey reports p95 **12.4 ms**, max **31.7 ms**, cached
queries p95 **0.18 ms**, and at most **12** spatial candidates. Cold placement
is **53.7 ms**, reported separately. Evidence: `output/solid-obstacles/isolated/`;
command: `PROFILE_OUT=output/solid-obstacles/isolated PROFILE_WORLD=expanded
PROFILE_POPULATION=32 npx tsx scripts/island-performance.ts`.

Prepare the 0.124.0 release on `backlog-implementation`; retain the separate
planning commit for later regional-industry work. Verify the pushed SHA before
deployment, back up through the deploy scripts, verify live assets/health and
website read-only, then publish the bot announcement. No player grants or live
world edits are part of this release.

**Done and live — solid trees, boulders and vehicles, 0.124.0.** Commit
`4acf3af25dbc22690bf2a42855cbbab720e2af78` is pushed to
`backlog-implementation` and matches the clean live checkout. The separate
regional-industry planning commit is `5319314`. Database backup:
`/var/lib/aclone/backups/pre-deploy-20261105-194624.sqlite`; website backup:
`/var/backups/aclone-website/site-20261105-194732.tar.gz`. Read-only verification
confirms 0.124.0 health, matching game and map-worker assets, website version and
no browser errors. The bot post and both 1440×900 screenshot attachments are
verified: <https://discord.com/channels/1562183434254680175/1565527790785404968/1568064462978683011>.
Evidence: `output/release-0.124.0/`. **Nine of 29 eligible Planned sections are
complete.** Continue item 13, cargo boat for dock-to-dock freight. Piloted
spaceflight remains excluded.

### Cargo boat for dock-to-dock freight — completion criteria before code

Implement item 13 in the spec's five-step order. Do not release a partial vessel
without its hold, landings, economy and browser checks. Preserve existing slot
IDs, including the derived canoe slot 34; append the coaster at slot 35. No
piloted-spaceflight work is included.

1. Add the vessel/model and editor tuning first. Start with a **20 m × 5.6 m
   coaster**, **2,000-weight dry general-cargo hold**, ordinary **60-weight
   captain inventory**, **6 m/s** speed, **0.02 fuel units/second**, **1,200-unit
   tank** and **240s** purchase price. These are balance candidates, not duplicate
   code constants: source them in the editable vehicle definition. The tank must
   complete the surveyed coast circuit with reserve under the measured loaded
   operating conditions; revise it before release if that test fails. Reuse
   existing captain qualification, two optional paid crew berths, provisions,
   persistent throttle, maintenance and boat death/recovery policy. Build an
   original human-scale wheelhouse, visible hold/load, hull, rails, fenders,
   mooring gear and navigation lights; bound geometry and test finite coordinates.
   Expose hold capacity/cargo policy with existing speed, burn, tank and price
   tuning, including validation and design portability. Reject tuning changes
   that strand saved cargo over capacity.
2. Store the hold with the persistent per-owner/per-slot boat record. Boarding,
   leaving at a boathouse, pier, river berth or quay, restart and owner transfers
   must preserve each good exactly; the captain's walking bag remains separate.
   Reuse trailer weight and per-good acceptance policies rather than copying
   them. Default dry-general cargo rejects livestock, loose liquids and seafood;
   configurable specialist policies retain their existing trailer restrictions.
   Transfers require an owned, stopped/moored boat at a compatible landing, and
   fail atomically for wrong owner, remote access, movement, missing berth,
   unsuitable goods, insufficient source, full destination and invalid quantities.
   Expose transfer rate and range as world rules, with actual timed transfer
   progress, cancellation and no duplicate completion. Choose/record rate and
   range defaults before their production code after inspecting the landing
   geometry; the UI must quote the same authoritative values.
3. Add a configurable quay building: a long open stone/timber wharf and a deeper
   berth, with no lifting hall. Shared siting/footprint/deck/boarding geometry must
   agree. Define dry land access, full hull depth/clearance, construction bill,
   materials, public/owned permissions and refusal reasons before code. Shops
   within the configured landing reach may buy/sell directly from the hold using
   the ordinary taxed, funded trade and bulk-discount path. Owner-stock transfers
   use normal ownership/storage checks. Existing compatible boathouses and piers
   get the same panel. Define river-berth transfer, paid or carried refuelling,
   delivery and stranded-vessel recovery through the existing flows; never summon
   an upriver boat to another landing. Test default coaster rejection at river
   docks even when its owner stands at the correct entrance.
4. Decide the optional river barge after the first landing integration is working.
   Prefer a distinct smaller freight hull if it supplies useful capacity within
   the existing 14 × 3.6 m river-dock limits; record its dimensions and economy
   before production code. Reuse the same hold/transfer model and preserve the
   existing canal boat and motorboat. Do not add a third ownership system.
5. Run an economics pass and document a reproducible funded coastal route with
   acquisition, sale tax/discount, consumed fuel, maintenance and crew settlement.
   Compare cost per delivered weight-distance with existing tractor/trailer
   combinations. A crew share applies to realised net freight profit, counting
   purchased cargo cost and avoiding repeated settlement or payments on losses;
   existing fishing settlements retain their behavior. Consider parish supply
   orders/intents explicitly and either integrate their existing settlement
   path or document why ordinary dockside trade supplies this slice's scope.

Tests first in `tests/cargo-boat.test.ts`, with separate hold/quay/economy tests
as those steps start. Step 1 red criteria: slot 35 exists without moving canoe 34,
resolves the stated defaults and changed tuning, requires captain appropriately,
accepts configurable hold fields, and renders finite human-scale empty/loaded
models with a bounded triangle count. Before each later step, extend these
criteria with exact action names and chosen values, then record its failing test.
Full gate: capacity boundaries, all compatible landing types, large-hull river
refusal, authoritative ownership/range/stock checks, cargo conservation through
save/reload and export/import, death/recovery and crew-profit settlement, plus
one measured profitable route. Keep world-design export semantics explicit:
configuration is portable; any exported moored property follows the existing
parked-property ownership remapping and never copies active player inventories
or account credentials. Test cargo-bearing export/import before claiming it.

Browser gate: buy/board at a valid boatyard; inspect empty and loaded holds,
wheelhouse and rendered cargo in low/normal quality; load, leave, sail, return,
moor, disembark and reboard; trade at a stocked dockside shop; reject a full hold,
empty seller, unfunded buyer, unsuitable cargo, remote boat and undersized river
berth; preview/build a valid quay and reject an invalid site; verify transfer
progress/cancellation and changed World Builder rules. Capture honest successful
screenshots and inspect console errors. Run `TEST_GPU=1 npm run test:e2e --
tests/browser/cargo-boat.spec.ts` plus relevant existing boating, crew, trade,
trailer, river-dock/recovery, catalogue/design and snapshot tests. Finish with
`npx tsc --noEmit`, changed-file Prettier and `/aclone/` production build. Update
HAULAGE.md, PLAYING.md, WORLD_BUILDING.md, README, release notes and CHANGELOG;
commit/push, deploy the verified SHA, then announce with screenshots.

Step 1 verification: the definition/editor/portability tests and relevant vehicle
and trailer tests pass (`output/cargo-boat/step1-tests.log`). The browser model
check passes with finite geometry, bounded triangles, human-scale helm and visible
empty/loaded states (`model-first.log`, `model-loaded.png`, visually inspected).
Extract the unchanged trailer definition data from its simulation dependencies
so vehicle tuning can reuse its cargo-policy keys without an initialization cycle.

Step 2 concrete persistence checks, before production: `npx tsx --test
 tests/cargo-boat-hold.test.ts` must conserve a 100-Stone hold across leaving at
the boatyard, JSON save/reload and boarding, while leaving the captain's bag
unchanged. Boarding consumes the moored cargo record; an active boat carries its
hold separately from personal inventory. Red tests also cover the existing
lifeboat launch/reboard and death/recovery flows, cargo loss under the loss rule,
and rejection of capacity/policy tuning that would invalidate any active, moored
or stranded hold. The default dry cargo policy must match trailer restrictions
exactly, with the boat's own weight limit. Timed transfers follow in step 3; no
new boat ownership or cargo transfer permission is introduced by this step.

Step 3 transfer choices before code: use `boatHold` actions (`load`, `unload`,
`cancel`; `slot`, `item`, `quantity`, optional owned `building`) and the existing
`trade` action with `storage: 'hold'` and `slot`. All transfers take weight /
**10 weight per second** (`freightTransferRate`), at a stopped compatible landing.
The captain may be aboard or at that boat's saved shore entrance. A shop/owned
stockroom must be within **30 m of the landing's shore entrance**
(`freightShopRange`); this allows the existing boatyard whose water berth is
farther from the shop than its land entrance. Neither rule teleports a ship or
permits an offshore transfer. At completion recheck boat/landing, owner, quantity,
capacity, inventory, price, funding and shop range; cancel with no stock/cash
movement if any prerequisite changed. A transfer locks movement using the
existing task system; cancellation moves nothing. Full 2,000-weight holds take
200 seconds at default rate. Configured rates/ranges must change quotes and
execution together. Ordinary trade tax, discounts, finite stock and funded
investment remain authoritative.

Step 3 quay choices before production: catalogue kind `quay`, default **24s**,
**80 Wood + 100 Stone + 20 Steel**, **4,000** stock capacity. Cost, materials and
stock capacity use the existing per-world building catalogue/template editor.
The open wharf uses one shared geometry definition: 28 m frontage, 5 m deck,
3 m gangway ending 14 m offshore, shore landing 3 m inland; an alongside berth
has 28 × 8 m clearance and requires **2 m water depth** (`quayDraft`, world rule).
Its fixed engineered footprint is shared by model, siting and deck collision;
visual customization stays in the existing Workshop. The entrance must be dry
at high water, its access gentle, and the full berth wet at low water with no
building/creator obstacle. Quays are publicly boardable like existing docks;
stockroom access stays owner-only and shop trades use the posted prices. Quays
keep vessels moored in view rather than storing them inside. Buy new vessels at
boathouses, not quays; a quay is freight infrastructure, not another boatyard.
Test a valid coast site, rotated/inland/shallow rejection, real construction
preview agreement, cargo transfers and full-hull dimensions at this new landing.

Optional river-barge decision: do not add a second default freight vessel in this
slice. The existing 13.5 × 3.42 m canal boat already carries 240 weight through
river docks; its newly available hold tuning also supports authored river-freight
worlds without adding another purchase/ownership class. Test that configurable
hold through a river berth, and the default coaster's refusal. Revisit a distinct
river barge with regional industry if actual route demand warrants it.

Freight accounting criteria before code: hold purchases retain actual discounted
acquisition cost per good with that vessel across mooring, recovery and restart.
A sale realizes only its proportional acquisition cost; unsold goods retain their
basis for the next voyage. Personal/owned-stockroom loads without purchase records
use the world's catalogue replacement value, explicitly shown in the guide.
Crew shares apply once to realized freight receipts less sold-goods basis and
existing consumed fuel/provision expenses. No pay on a loss, no second receipt
credit, and settlement refuses if the captain spent the money needed for shares.
The fishing-catch settlement path stays unchanged. Economy comparisons include
maintenance and vessel/trailer capital separately; acquiring the vessel is a
capital expense, not a new charge on each voyage. Ordinary funded dockside trade
is this slice's delivery settlement; parish supply orders/intents keep their
existing inventory delivery path rather than claiming an unimplemented hold
settlement integration.

Economics red result (`routes-first.log`): 0.02 fuel/s gave a fuel/weight-distance
coefficient of 1.6667e-6, worse than the Puddle tractor plus full tipping trailer
(8.5485e-7, including the tractor's own cargo). Preserve that comparative test.
Revise the editable vessel defaults to **0.008 fuel/s and a 320-unit tank**.
The surveyed expanded-island circuit is 164.85 km; the old burn consumed 576.67
units with maintenance enabled. The revised burn predicts about 230.67 units,
leaving about 89.33 (28%) from 320. This sizes the tank for the measured circuit
rather than several circuits; forty default Fuel cans fill it and fit in the
captain's bag. Re-run the actual movement circuit and funded route before release.

Cargo browser verification found a genuine quay construction-preview failure:
`freight-quay.spec.ts` leaves Place foundation enabled at an invalid site because
`mountBuildMenu` dereferences an absent architectural variant. Preserve the test:
select Freight quay, reject the inland-facing orientation, rotate to the sea,
check the quoted materials, construct it, and board/load at its berth with no
browser errors. Fix the absent-variant description without inventing quay models.

Quay preview/build/board/load now passes in the real browser (20.1 seconds,
`quay-browser-fixed.log`). The menu now omits architectural shell choices for
fixed infrastructure, preserving the catalogue material bill. A further rendering
regression test (`refresh-red.log`) confirms moored coasters ignored edited hull
dimensions; require a rebuilt hull after tuning, but reuse it when only position
changes. The independent live-shop-stock refresh check passes without a code change.

All three full browser flows pass (`browser-final.log`): normal-quality purchase
and freight failures, a generated river berth with a configurable canal hold and
coaster refusal, and quay construction/sailing/return in low and normal quality.
Final quote review adds one explicit criterion: changing a shop's unit price
while the captain edits quantity must refuse the stale displayed quote, before
starting a transfer. The panel regression is red for the missing displayed-price
binding (`quote-red.log`); retain the server's existing expected-price check.
Also verify unloading at the fishing pier after an actual SQLite reopen.

Cargo final verification: **183 relevant Node tests pass** in 31.9 seconds
(`relevant-final.log`), including trailers, construction/designs, ordinary boats,
crew, river recovery, towing, snapshots, private persistence and the measured
trade/circuit. Use `npx tsx --test` with explicit files: this repository's
`npm test -- files` still expands its full-suite glob. The final browser gate
checks the stale displayed quote and existing desktop/phone construction menus.
World-design policy is owner-only moored freight remapped to the recipient;
full database saves preserve everyone, including acquisition basis. The optional
barge remains deferred and parish-order delivery stays inventory-based, as
explicitly decided above.

Final stale-price browser check and the existing desktop/phone building designer
pass (`quote-designer-browser.log`, three tests, 1.6 minutes). TypeScript is clean
(`typecheck-final.log`). Screenshot review confirms the loaded coaster, clear helm
and open quay; no browser errors occurred. Prepare release **0.125.0**, with the
same shared defaults and no live player grants. Await the production build,
push, exact-SHA deployment, read-only live checks and verified Discord post
before marking item 13 done.

Release gate: `/aclone/` production build passes (`output/release-0.125.0/build.log`),
including its TypeScript check. Prettier verifies all 58 changed files; `git diff
--check` is clean. Stage only the implementation, tests, version and guide/plan
files; keep output evidence, NPC status notes and local attachments out of Git.

Item 13 implementation is complete and pushed as
`706f5ef4666d27fd56bce60a60f1347212db5bb5` (0.125.0), with all acceptance gates above
passing. Exact-SHA deployment and announcement verification follow before the
next item starts. This post-push status record travels with the next slice.

Deployment follow-through found a website integration gap after the game went
live: `npm run build:website` fails with **Missing building gallery image: quay**
(`output/release-0.125.0/deploy-website.log`). Do not announce or start the next
backlog item yet. Add the real rendered quay image, make the gallery's fixed-design
controls and image description truthful, and verify static build plus the browser
preview/rotation/close flow. The image-generation script must handle this single
engineered model without inventing architectural variants. Preserve 0.125.0's
released contents; ship this website integration correction as 0.125.1, then
complete deployment and announce the freight feature with verified images.

The gallery regression fails for the intended reason: the fixed quay presents an
enabled empty architectural selector (`gallery-red.log`). Add a disabled Fixed
design / As modelled choice, preserve working view controls, generate the actual
quay model image with the existing renderer, and derive gallery counts/alt text
from the catalogue rather than claiming five quay variants.

The full website check exposed its pre-existing assumption that every catalogue
entry has five architectural variants. Preserve that assertion for all existing
buildings; add an explicit quay case requiring its one fixed design and disabled
model/finish selectors. The cargo-boat entry requests an open wharf, not five new
architectural variants. The dedicated quay browser test passes in 2.6 seconds.

Website correction gates pass: the real quay preview opens, rotates, zooms and
closes without errors (`gallery-green.log`); the public-site check passes all four
screen widths, 52 image cards, search/empty search, every interactive model,
touch controls, fixed scale, focus restoration and WebGL/no-JavaScript failure
fallbacks (`output/release-0.125.1/website-final.log`). `npx tsc --noEmit` is clean.
The five-model assertion remains intact for all 51 pre-existing building kinds.

Gallery correction complete and pushed as
`ea7ebfe5e0d5f933836f6fc2edda7d2ca48aa64d` (0.125.1). Its website/browser checks,
TypeScript, production build and changed-file formatting pass. Deploy this exact
commit before the combined freight announcement; the core 183 freight tests
remain applicable because this correction changes only gallery integration.

Item 13 is **done and live**, including the gallery follow-through, at
`ea7ebfe5e0d5f933836f6fc2edda7d2ca48aa64d` / **0.125.1**. Public health, game bundle,
map worker, website version and the actual public quay preview pass with no
browser errors (`output/release-0.125.1/live-verification.json`). Database backup:
`/var/lib/aclone/backups/pre-deploy-20261105-210847.sqlite`; website backup:
`/var/backups/aclone-website/site-20261105-211008.tar.gz`. The bot announcement and
both 1440 × 900 screenshots are verified:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568085177941622886.
No player property or balances were granted or edited on the live server.

Current progress: **10 of 29 eligible Planned sections complete**; all 20 shipped
claims assessed (17 matches, 3 gaps fixed). Next is item 14, the linked rowboat
and storm-capsizing work. Keep both incomplete until their combined acceptance
criteria pass; piloted spaceflight remains excluded.

### Rowboats and storm capsizing — combined completion criteria before code

Item 14 stays unreleased until both entries pass. Append rowboat slot 36, preserving
all existing IDs. Use a 3.8 × 1.5 m flat-bottomed clinker hull, 30-weight carried
inventory, one passenger in addition to the rower, 1.6 m/s rowing speed, no fuel
or tank, and a 4s price. Source these once in the editable vehicle catalogue.
The passenger rides only; rowboats cannot be carried or used as motorboat tenders.
Do not add the optional carpenter recipe. Inventory follows the existing canoe/
small-boat carrying rules; no separate freight hold is claimed.

Per-world rowboat rules: enabled by default (disable new purchases without
stranding existing property), minimum hull depth 0.08 m, maximum step-out depth
0.8 m, bank access range 4 m, bank rise 1.2 m, gentle-contact speed 2 m/s,
public beached-boat pickup off. Existing vehicle tuning owns speed, acceleration,
capacity, dimensions, price and passenger count. Beached landings persist their
actual shore/berth geometry with the existing moored boat, not a new ownership
system. Public pickup transfers ownership and its saved vehicle state atomically;
refuse if the recipient already owns that class. Require clear dry bank access
and the entire hull afloat, including after terrain edits. At ordinary docks use
the same boarding, obstruction and river-dimension rules as other boats. Sell at
boathouses and the fishing pier, not arbitrary banks or freight quays.

First red gate: `npx tsx --test tests/rowboat.test.ts` must fail because slot 36
and beached boarding do not exist. Cover catalogue defaults and changed tuning,
sand/rock/riverbank exits and reboarding, overweight refusal, whole-hull depth,
blocked/remote/moving access, no carrying, two occupants and third refusal,
passenger disembark before captain, gentle contact without recoil/damage,
SQLite restart, ownership/default theft refusal/public transfer, disabled new
purchases and both death policies. Keep existing canoe/boating/recovery tests green.

Storm survey (`output/storm-survey.ts`): the pier is 3.65 m deep; bay samples
at z=300/1000/3000 are 28.91/22.38/30.91 m deep, approximately 150/600/1500 m
from land. Expanded outer-coast samples reach roughly 980–1093 m deep. Therefore
use **50 m depth and 1500 m shore clearance** for motor/canal ocean danger,
not the example 25 m which includes the bay. Survey distances use 64 rays at
25 m steps and are evidence, not the runtime safety classifier. Large storm
amplitude starts at **1.8 m**; the ordinary forced storm is 1.6 m, strong natural
storms reach 2.1 m. The storm flag is mandatory even if rough-sea amplitude is high.

Before storm production, add `tests/storm-capsizing.test.ts` and record its red
result. World rules: enabled true, evaluation cadence 5 seconds, small-craft
base risk 0.08/minute, motor/canal risk 0.04/minute, distance scale 1000 m,
wave reference 1.6 m, maximum distance multiplier 3, small-craft sheltered shore
band 15 m, ocean depth 50 m/shore clearance 1500 m, large-storm amplitude 1.8 m,
warning look-ahead 300 seconds, guaranteed initial escape period 300 seconds,
then a 300-second linear risk ramp. All are editable with validation and help;
zero rates disable the respective class. Seaworthy hulls are exempt by default,
with a per-vessel susceptibility classification available in vehicle tuning.
Do not copy these defaults into simulation or UI. Seed rolls by world, captain,
vessel and absolute evaluation boundary; persist exposure timing through saves.
Sheltered inland water and calm/merely rough weather have zero risk. Warn once
on entering danger ahead of/during a storm, with vessel/position/sea state. Reset
exposure on reaching shelter; changing captains must not reset an occupied boat's
exposure. Existing visible waves, forecast, marine visibility and spray must be
verified in browser. All actual passengers/paid crew die through ordinary death
handling. Small craft follow existing recovery/loss settings; motor/canal hulls
and their cargo are destroyed even under recovery policy. Log a clear loss notice.

Storm tests: deterministic rolls and cadence partitioning, restart continuity,
calm/rough/river/pond immunity, small-craft bay risk, default motor/canal bay
immunity and true-ocean large-storm risk, seaworthy exemption, changed rules,
warning before risk, timed safe return at each vulnerable hull's speed, ordinary
small-craft death/recovery, forced motor/canal loss, all occupants dying exactly
once and no duplicate cargo/reward. Add performance evidence for coastal queries.
If a selected default fails the escape test, revise the default, not the criterion.

Browser gate: buy at yard and pier, row to a real bank, stop/disembark/reboard,
inspect visible moored/stowed-oar and occupied/rowing states, view from another
player, inspect empty/no-nearby/disabled/overweight/ownership refusals, edit rules
and verify their effect. Enter approaching and active storm zones, observe the
warning and weather, turn back safely, and verify a seeded capsize/respawn with
passengers. Capture successful actual gameplay screenshots. Use
`TEST_GPU=1 npm run test:e2e -- tests/browser/rowboat.spec.ts tests/browser/storm-capsizing.spec.ts`.
Run relevant Node tests, `npx tsc --noEmit`, changed-file Prettier and production
build. Update PLAYING.md, WORLD_BUILDING.md, README, CHANGELOG and release notes.
Commit/push/deploy the completed pair, verify the live SHA and announce through
the bot with reviewed screenshots; then mark item 14 done.

Rowboat first-red evidence: `output/rowboats/first-red.log` rejects nonexistent
slot 36. After the definition and beached-landing integration, eight core tests
pass (`access-green.log`); the original 25 canoe tests also pass. The first
restart check exposed the ordinary pier's +0.15 m dry-deck requirement rejecting
a valid low sandy bank. Beached boarding now uses its verified dry-bank surface
without changing ordinary dock checks. Public transfer remains explicit and
owner-only by default. Model red evidence is `model-red.log`; finite geometry,
human-scale seat and stowed/moving oars now pass in `model-green.log`.

Escape-time review before storm code: a 1.6 m/s rowboat needs over 6 minutes to
return from the surveyed 600 m bay point, before loading/condition penalties.
A fixed 300-second grace alone cannot meet the stated safety criterion. Retain
300 seconds as the minimum, and compute an entry-time escape allowance from
nearest safe shore distance / that vessel's loaded, condition-adjusted available
speed, multiplied by a configurable **1.5**, plus **30 seconds** for turning.
Use the larger allowance, then the configured 300-second ramp. Freeze the
allowance on entry: continuing farther offshore does not earn more time. Expose
the multiplier/turn allowance and quote remaining safe time in warnings. Empty-
tank motorboats use their actual rowing speed. Existing motorboat rowing speed
1.6 m/s and acceleration 0.65 m/s² become shared rowed-navigation settings, so
escape estimates and movement use one authoritative value. Verify escape using
actual movement, not only the formula. Inland and sheltered-shore immunity
continues to reset exposure. This change makes existing default storms dangerous
to lingering craft while giving a prompt return a measured chance to finish.

Shutdown recovery: the working tree and logs survived. The last pushed release
remains 0.125.1; item 14 is local and incomplete. `shore-green.log` confirms
48 targeted tests (rowboats, storm behavior and existing canoes) passed before
the shutdown. `browser-first.log` has no completed result and is not evidence of
success. Re-run the browser gate, finish remaining review and documentation, and
deploy/announce only after the combined acceptance criteria pass.

Review adds regressions before fixes: public pickup must retain an authored
rowboat freight hold and acquisition basis as well as condition; a zero escape
travel multiplier must still honor the configured turning allowance; canoes
must expose the same forecast and remaining escape time as other vulnerable
craft. Evidence: `output/rowboats/restart-review-red.log`.

The restarted rowboat browser test reached the real purchase menu, which correctly
kept its overweight button disabled and explained the 32/30-weight refusal.
The test had incorrectly tried clicking that disabled button; assert its disabled
state and explanation, then verify purchase after unloading. This preserves the
capacity criterion. The three review regressions above are confirmed red before
fixing them; resume the browser with production source frozen for the run.

Post-resume browser and review gates: the temporary-bank summon and tiny-island
escape-distance regressions both failed before their fixes. Keep clearance
conservative, but derive return time from actual sampled dry ground. Require an
existing matching mooring for bank boarding. The coastal-return fixture lacked
the required captain skill; supply that skill without altering movement rules.
The rowboat browser wrongly tried to close an already-dismissed disembark dialog;
assert its dismissal instead. The storm browser exposed a real stale inventory
forecast: refresh marine status/countdown while the boat inventory stays open.
The existing browser assertion must show the weather transition and escape time
without closing/reopening the panel.

Browser review passed the purchase/beach/reboard and forecast/retreat/capsize
flows. Screenshot inspection found the legacy mooring fallback repainting the
new unpainted wooden hull blue. A new rowboat regression fails (`'blue' !== ''`);
retain the catalogue finish for unpainted rowboats and verify it in the second
player's view. SQLite close/reopen retains the same escape deadline (no new grace).

The second-player browser confirms a persistent visible wooden hull and private
ownership refusal. Browser inspection also exposed generic powered-boat help
in the rowboat inventory (fuel/engine and shore recoil instructions). Require
the rowboat flow to reject that text and show its actual fuel-free gentle-bank
rules before release; keep the powered-vessel help unchanged.

The rowboat help regression fails on the generic refuelling instructions before
its correction. Storm browser gates pass with sea/rain and warning screenshots.
The new moving-oar capture exposed a fixture race: the next pier setup must wait
for rowing input to settle before relocating the local player; retain the real
dry-shore boarding check. Recovery appearance has the same legacy blue fallback
as mooring; a focused death regression is red before preserving the rowboat's
catalogue finish there too.

**Item 14 verification before release:**

- Relevant Node gates: `npx tsx --test tests/rowboat.test.ts tests/storm-capsizing.test.ts tests/canoe.test.ts` plus `tests/boating.test.ts`, `tests/boat-abandonment.test.ts`, `tests/boat-navigation-rules.test.ts`, `tests/inland-boat-recovery.test.ts`, `tests/fishing-expedition.test.ts`, `tests/towing.test.ts`, `tests/vehicle-config.test.ts`, `tests/river-dock.test.ts` and `tests/snapshots.test.ts`: **143 distinct tests pass** across the targeted runs. Final recovery-finish change reruns rowboat, abandonment and inland recovery: **42/42**. Separate deep-ocean recovery-override test confirms the sunk hull and separate hold are removed while another owned hull remains.
- Browser: `TEST_GPU=1 npm run test:e2e -- tests/browser/rowboat.spec.ts` passes the full extended two-client flow in 2.0 minutes. `tests/browser/storm-capsizing.spec.ts` passes forecast/live countdown, actual rowing into shelter, all-occupant capsize and recovery UI. No browser page errors. Logs: `output/rowboats/browser-final-rowboat.log`, `output/rowboats/browser-final.log` (the latter retains the corrected fixture failure alongside the successful storm run).
- Reviewed actual gameplay captures: `beached-rowboat.png`, `rowboat-from-another-player.png`, `rowing-on-the-bay.png`, `storm-warning.png`, `storm-at-sea.png` under `output/rowboats/`. The hull retains its wooden finish, empty oars stow and moving oars extend. The storm view shows rain and whitecaps; the inventory displays the forecast and escape countdown live. Publish only the reviewed successful-run images.
- Coastal-query evidence: approximately 7 ms for a cold bay query and 1.7 ms total for 1,000 cached queries. Absolute boundary rolls and persisted exposure remain deterministic; real SQLite close/reopen grants no extra escape time.
- TypeScript is clean in the production-build gate. Prettier runs on all 35 explicit changed/new paths. The full test suite is intentionally not repeated under Henry's relevant-tests policy.
- Prepare release **0.126.0**, with player, boating, world-builder, README and release-note updates. Push and live verification/announcement still pending; neither linked section is marked done yet.

**Post-push record:** item 14 implementation committed and pushed as
`0365b4c8cfad4a467a6ecbef190167678e2128a7`; GitHub branch SHA matches local HEAD.
Production build passes (existing bundle-size and dependency-annotation warnings
only). Deploy that exact SHA, verify live service/assets and website, then post
the reviewed screenshots to #announcements before beginning item 15.

**Item 14 release complete (2026-11-05):** live game SHA matches
`0365b4c8cfad4a467a6ecbef190167678e2128a7`. Public health reports 0.126.0;
the released feature code, map worker, welcome page, website and gallery load
without browser errors. Game backup:
`/var/lib/aclone/backups/pre-deploy-20261105-222821.sqlite`; website backup:
`/var/backups/aclone-website/site-20261105-222945.tar.gz`. Bot announcement and
both PNG embeds verified by read-back and image fetch:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568105308591493183.
Read-only live verification is in `output/release-0.126.0/live-verification.json`.
Additional cold shore queries at 10–30 km offshore take 4.2–6.8 ms, adjacent
cached ocean cell 2.0 ms (`output/rowboats/coast-benchmark.log`).

Current progress: **12 of 29 eligible Planned sections complete**. All 20 shipped
claims remain assessed, with their three gaps fixed. Piloted spaceflight remains
excluded. Next: item 15, springs, pump-houses and desalination plants.

### Springs, pump-houses and desalination plants — completion criteria before code

Item 15 is one release: survey and drinking, both water buildings, authoritative
siting/production, creator controls, NPC founding, models/map and documentation.
Keep it unreleased until all these gates pass. No later item starts on a failure.

**Defaults and rule ownership.** Add a Water sources fieldset backed by one shared
rule registry and `data/settings.json`. Springs enabled; target **30 total** sites
including guaranteed river heads; minimum elevation **15 m**, curve from **2% at
20 m** to **40% at 300 m**, minimum spacing **250 m**, water exclusion **40 m**.
Headwaters are the explicit exception to ordinary dry-site/water-distance rolls:
keep each river's first point and record its river ID. Reject cliffs and sites
whose prospective pump-house footprint exceeds the existing construction rise
limit; reuse that limit rather than implementing the later earthmoving section.
Expose that existing **2 m** limit once as a construction rule shared by this
survey and the existing construction check. Keep normal construction defaults
unchanged. Expose the cliff-normal cutoff and all survey/drinking/flow limits;
use the current terrain cliff criterion as the initial cutoff after inspection.
Headwater flow **1.2**, ordinary flow **0.6–1.1**, deterministic and frozen.
Drinking enabled, on foot within **3 m**, **20 seconds** between drinks; apply
exactly the configured Water item's thirst relief, without making an item.

Pump-house: **900d**, 6 Wood, 6 Blocks, 1 Steel, 4 Gravel, two qualified workers,
same 22d wage and 500 stock capacity as the existing plant. Default recipe
**1 Fuel → 20 Water**; gravity-fed spring option off by default, **0 Fuel → 8
Water** when enabled for a spring intake. Flow scaling off by default; when on,
use the saved source flow with the stated 0.6–1.2 range, rounded to whole Water.
Catalogue owns price/materials/wage/capacity; water rules own normal and gravity
recipe inputs/outputs, flow toggle and bounds. Preserve deliberate catalogue or
premises recipe overrides. Keep desalination at **1 Fuel → 12 Water** and the
existing 13.25d water price unless the balance gate demonstrates a required
change; do not reprice private shops. Fresh intake depth **0.4 m**, foundation
freeboard **0.3 m**, intake reach **6–10 m**, spring snap reach **8 m**, same-river
spacing **60 m**. Make these operational thresholds editable and portable too.
True-ocean requirement on by default; off restores the old height-only siting.

**Survey/migration gate.** `npx tsx --test tests/springs.test.ts` first fails for
missing spring survey/types/rules. Then assert deterministic IDs/coordinates/flow,
25–35 total public-island springs, all river heads, upland-biased ordinary sites,
spacing and water/cliff/foundation exclusions. Test a private heightmap and a
world with springs off. A versioned first-load migration freezes `w.springs` and
marks pre-existing waterworks as grandfathered; subsequent loads, rule edits,
terrain edits and restarts must not move or regenerate the survey. Existing
buildings, ownership, stock and production stay intact. Real SQLite reopen and
design export/import retain source IDs, hand edits, reservations and cooldowns
where those belong (player cooldowns stay in saves, not portable designs).

**Siting/production gate.** `npx tsx --test tests/fresh-water.test.ts tests/waterworks.test.ts tests/economy-balance.test.ts`.
Extend the current edited-pond fixture before changing shoreline logic: a new
true-ocean plant must be refused, a migrated old plant must continue its original
recipe, and switching off the ocean requirement must admit the old site. A
height-only or `inlandWaterAt`-only test is insufficient for an enclosed edited
pond: verify actual connection to the sea. Check real coast acceptance at tidal
extremes, local-river water levels, pump snapping to a spring, dry full footprint,
occupied spring, insufficient depth, flooded/steep foundation and ocean refusal.
Failed purchases/placements consume no money/materials. Two river pumps inside
the configured spacing fail; river docks and fords remain usable. Deleting or
drying a source stops a new pump's production and its report/preview/NPC estimate
agree. Exercise normal, gravity and flow-scaled recipes with real staffing,
funded wages, stock limits and changed rules; ordinary production remains green.

**NPC and creator gate.** `npx tsx --test tests/water-source-npcs.test.ts` plus
existing waterworks/construction/production consumers that the changes affect.
The site finder searches actual world bounds with bounded coarse/refined work,
can find northern river/spring/coast sites and filters occupied/protected lots.
The water chain chooses a feasible nearby/economical kind and uses the same
construction action. Thirst perception, briefings and knowledge name both kinds.
Creator can place/delete springs with validation, configure every rule, save,
reload and export/import a design. Disabling springs hides/disables their use
without destroying the saved survey or resetting IDs when re-enabled.

**Player-visible/browser gate.** Add `tests/browser/water-sources.spec.ts` and run
with `TEST_GPU=1 npm run test:e2e -- tests/browser/water-sources.spec.ts`. Walk to a
real surveyed spring, see its wet stone basin/trickle/damp ground/reeds, drink,
observe cooldown and off-foot/out-of-range/disabled refusals. Verify droplet-ring
map symbols at gathering zoom levels and absence below that threshold. Place
and remove a creator spring; preview a valid spring and river pump (including
snap), a reserved spring, a coastal refusal and an empty/no-spring world. Build
both kinds and inspect their five named models, intake/source placement, stock
and production feedback. Confirm a headwater visibly begins at its spring.
Use the architecture and northern-island preview scripts for images, inspect
bounds/finite geometry and scenery streaming in both quality modes. Add the
pump-house's actual image and interactive model preview to the website gallery;
verify the public gallery after deployment. Capture reviewed gameplay evidence.

Update PLAYING's old waterworks/edited-pond wording, ECONOMY, NORTHERN_ISLAND,
WORLD_BUILDING, field guide, catalogue, README, CHANGELOG and release notes.
After relevant tests, clean TypeScript, changed-file Prettier and production
build, commit/push the complete item, deploy its verified SHA, check live assets,
and announce the feature through the bot with successful screenshots.

Initial red evidence: `output/water-sources/survey-red.log` fails on missing
`shared/springs`; `salt-red.log` confirms the current new-site survey wrongly
accepts the enclosed edited pond. Cliff shader starts exposing rock at normal-y
0.72; use **springMinimumNormalY = 0.72**, configurable. Ordinary springs must
also fit the current 2 m foundation-rise rule, shared with construction. Headwater
sources keep their explicit river-head exception.

Additional item 15 pre-release regression criteria: moving a pump in the editor
must invalidate a saved intake beyond its configured reach, and portable designs
must reject duplicate claims on one spring atomically. The fixed-intake red test
fails before those corrections; the targeted spring/production/catalogue run
then passes 21 tests. A pump snapped onto a spring must also recheck farmland
before charging: `tests/fresh-water.test.ts` adds an unchanged-world refusal
case, confirmed red with “Missing expected exception” in
`output/water-sources/farm-snap-red.log` before the correction.

The off-foot browser extension initially expected the inventory to stay open
when changing vehicles; the existing vehicle action deliberately closes it.
Reopen inventory after the confirmed vehicle transition, then retain the actual
“Stop on foot” disabled-button assertion and the subsequent successful drink.

The final rule audit also covers the existing desalination intake dimensions:
expose its 0.3 m depth, 0.2 m foundation clearance and 6–10 m rear reach through
the same Water sources registry. Keep those defaults and the legacy mean-water
survey unchanged; require invalid min/max edits to reject atomically, custom
values to affect siting, and editor/design/save paths to retain them. The new
`tests/water-salt.test.ts` case fails with “Unknown setting” before implementation
(`output/water-sources/desalination-rules-red.log`). Extend the real Rules browser
flow to edit and verify all four values. This closes the configuration gap
within this water-supply item, before release.

**Item 15 verification before release (2026-11-05):**

- Initial survey, salty-pond, drinking, persistence, pump construction, NPC search,
  UI and scenery regressions were red before implementation; logs remain under
  `output/water-sources/`. Final review also reproduces and fixes stale moved
  intakes, duplicate imported spring claims and snapping onto farmland. The moss
  edge regression removes the opaque circular paving appearance from springs.
- **163 distinct relevant Node tests pass** across the targeted runs, including
  survey/migration, actual SQLite reopen, economy/staffing, construction, existing
  waterworks, river docks, NPC founding/knowledge, portable catalogues, architecture
  and terrain/map consumers. The final six-file water/NPC run passes **44/44**;
  the final construction run passes **23/23**. The existing NPC request-size
  limit remains intact after shortening the new briefing. No full-suite rerun.
  Evidence: `relevant-tests.log`, `guide-green-check.log`, `fixed-intake-green.log`,
  `farm-snap-green.log`, `moss-edge-green.log`, `desalination-rules-green.log` and
  the deduplicated `passing-test-names.txt` in that output directory.
- `TEST_GPU=1 npm run test:e2e -- tests/browser/water-sources.spec.ts` passes both
  complete flows in **1.5 minutes** (`browser-release.log`): actual northern
  spring hiking/drinking, cooldown/range/off-foot/disabled/empty states, map zoom
  threshold, spring and river pump construction, coastal refusal, desalination
  construction, creator sources and all four desalination limit edits. No page
  errors. Vehicle switching correctly closes inventory; the fixture reopens it.
- Real architecture contact sheets for both kinds pass and are visually reviewed;
  publish their WebP conversions in the website gallery. Northern-island preview
  runs pass in **normal and low** quality, including headwater/channel contact,
  spring and pump scenery streaming, and existing map-detail checks. One original
  spring camera was inside a tree; reject that image and recapture the unchanged
  surveyed source `spring--15--60` in a clearing using `SPRING_ID`. Reviewed files:
  `spring-normal/spring.png`, `north-normal/headwater-spring.png`,
  `north-low/pump.png`, and both `models/*.png` under `output/water-sources/`.
- The built website passes both water-building cards/images, all ten interactive
  models, mobile dialog layout and empty search, without browser errors
  (`gallery-check.log`). Actual gallery screenshots are reviewed too.
- Measured public survey: **30 springs, about 489 ms once at migration**. Cold
  site queries take 20–121 ms; warmed queries take 1.3–32 ms, and choosing between
  water kinds takes about 27–29 ms in the measured southern/northern fixtures.
  Geometry proposals are cached and live occupation is checked per caller.
- `npx tsc --noEmit`, `npm run build` and `npm run build:website` pass. Prettier
  runs on every changed/new text path. Build warnings are the existing large
  bundle and dependency-annotation warnings. README, player/economy/island/world
  builder guides, release notes, catalogue and field guide describe the change.
- Prepare **0.127.0** as one complete water-supply release. Commit/push, exact-SHA
  deployment, live migration/assets/gallery verification and the reviewed-image
  bot announcement remain the final gates. Do not start item 16 before those pass.

**Item 15 post-push record:** implementation committed and pushed as
`11411ac320e051afc01ad88f983ee7c10c3d5914`; GitHub's branch SHA matches local HEAD.
Mark the implementation slice done after that push. Deployment, live migration
verification and #announcements follow before starting item 16.

**Item 15 release complete (2026-11-05):** live SHA is
`11411ac320e051afc01ad88f983ee7c10c3d5914`, public health is **0.127.0** with five
worlds. The deploy script's first check received 502 while startup was still
finishing; the service then reported ready and repeated public health, JavaScript,
map-worker and browser checks passed. No second restart was needed. Read-only
SQLite verification confirms every saved world has migration version 1;
Puddlewick has **30 springs, five headwaters**. Its saved building list contains
no old waterworks to grandfather; migration preservation is covered by tests.

Database backup: `/var/lib/aclone/backups/pre-deploy-20261105-233956.sqlite`.
Website backup: `/var/backups/aclone-website/site-20261105-234116.tar.gz`.
Both water-building images and interactive previews load on the live website
without browser errors. The bot post and both screenshot embeds pass read-back
and image-fetch verification:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568123251236798599.
Evidence is in `output/release-0.127.0/` (live verification, migration, SHA,
backups/deploy logs and announcement receipt).

Progress: **13 of 29 eligible Planned sections complete**, plus all 20 shipped
claims assessed and their three confirmed gaps fixed. Piloted spaceflight
remains excluded. Next is item 16: butcher, meat and livestock life cycle.

### Butcher, meat and livestock life cycle — completion criteria before code

Item 16 remains one unreleased feature until the pasture-to-plate flow is complete.
Develop and test the following dependent slices in order; do not deploy a partial
life cycle without its butcher/cooking consumers. The 0.127.0 release above is
complete and is the recoverable starting point.

**Scope and implementation order.** (1) Young animals, saved cohorts, healthy
maturation, pasture/rations, continuous breeding and physical transfers; (2)
butcher catalogue/skill/recipes, adult-only paid service and stock handling;
(3) raw-meat freshness and safe food consumption; (4) business and home cooking,
wholesale balance and NPC supply; (5) visible young animals, five butcher models
and ramp, all player/creator UI, browser journeys, gallery and documentation.
Boat-galley cooking is explicitly a later optional slice in the entry and is
not part of this completion. No tannery or new hide industry is introduced;
use compost as the optional existing-economy by-product where balance supports it.

**Rule ownership and starting defaults.** Use the established per-world field
registry/default-settings/editor/validation pattern. Keep existing adult herds,
base breeding costs/durations, herd minimums and primary outputs intact unless
an explicit balance test requires a documented change. Default maturity targets
are **6 days for chicks, 20 piglets, 25 lambs and 40 calves**; growth and breeding
speed multipliers start at **1**. Young stock uses **half an adult's pasture share
and ration**, has lower carried weight and catalogue price, produces no primary
goods and never satisfies adult minimums. Track fractional ration use rather
than repeatedly rounding a small young animal up to a full adult ration. Start
growth at condition **40%**, pause without feed/water, and lose young first below
a configurable **20%** condition floor. Expose care/breeding condition thresholds,
rations and species durations/costs through the same source of world defaults.
Continuous breeding is allowed by default but opt-in per farm; it is bounded by
adult parents, condition, available feed/water, investment and pasture space.

The butcher is a tier-0 business with one qualified butcher as ideal staff,
owner-set per-animal fees and a configurable default **33% of world animal value**.
Start with **30 seconds per service animal**. Default raw yields are **12 beef,
8 pork, 6 mutton, 1 poultry** for cow/pig/sheep/chicken. Treat the animal as the
farmer's property throughout the paid service: recheck the quoted fee, adult
stock, access, staff and output room at completion before charging or consuming
anything. Cancelling, leaving, losing access, or a changed quote must not duplicate
meat or silently consume the animal. The farmer can use their livestock wagon;
on foot allow one small adult, with a configurable maximum item weight initially
**3**. Show young refusals with remaining maturity days. Business stock can buy
adults and use ordinary staffed recipes to supply its meat counter.

Raw meat has no default food value. Default spoilage is **2 game days** outside
butcher/kitchen refrigeration or the chilled trailer. Preserve elapsed freshness
through transfer, cold storage, save/reopen and recovery; adding a fresh item
must not refresh an old batch. Expose spoilage duration, raw-edibility enable and
its relief, butcher availability, home-cooking enable, durations and yields.
Home cooking starts at **180 seconds for one meal** using the selected meat plus
its recipe's staple(s), takes from the home's stock then the cook's inventory,
needs no qualification and requires remaining inside the authorized home/inn
room. Business meals use qualified cooks and higher batch yield, initially four
servings per meat portion in the normal 600-second production cycle. Select final
raw/meal prices and recipe quantities with the taxed margin tests before making
them production defaults; catalogue/template controls own prices and recipes.

**Life-cycle test gate.** Add `tests/livestock-life-cycle.test.ts`; update the
existing breeding expectations in `tests/livestock.test.ts` to the new claim,
without weakening care, upkeep, adult minimum or catch-up checks. Confirm a red
birth assertion before code. Then prove each species produces its young item,
healthy age reaches maturity at the configured boundary, bad care pauses it,
young die before adults, young never boost milk/wool/eggs, pasture shares and
half rations are exact, continuous breeding cannot overfill or overspend, and
large catch-up equals small steps. Old saves still contain the same adult counts
and existing Steak remains edible. Save/reopen and design export/import retain
cohort progress. Transfers through inventory, farm shops and livestock wagons
retain the same cohort age; time outside a cared-for herd does not create free
maturation or reset an animal's progress. Exercise changed growth/calendar rules.

**Butcher/service test gate.** Add `tests/butcher.test.ts`: authoritative skill,
service access and stopped ramp checks; adult/young eligibility; owner fees;
exact transfer to investment; correct yields/by-products; capacity and funding
refusals; single-small-animal walking; wagon return; cancellations and completion
revalidation. A disabled butcher rule must prevent new construction and slaughter
without deleting saved buildings or stock. Counter production must consume owned
adult stock through ordinary funded production and pay qualified staff. Include
school qualification, world/template overrides and duplicate completion attempts.

**Freshness and cooking test gate.** Add `tests/meat-cooking.test.ts`: manual raw
consumption says “Raw meat must be cooked”; auto feeding ignores raw meat by
default, while a changed raw-edibility rule is honored consistently. Spoilage
uses persisted game-day progress, handles mixed ages, pauses in cold storage,
and resumes without refreshing on withdrawal. Cover shops, inventory, homes,
trailers and supported freight storage, as well as save/reopen. Home Cook is
inside-only, uses the selected authorized pantry/inventory, rechecks output
capacity and ingredients, and produces one cooked meal after the task. Leaving,
cancellation, lost housing access and empty stores have explicit outcomes.
Business menus cover beef stew, roast pork supper, mutton pie, roast chicken and
cooked Steak; café/pub variants and inn kitchens use the same recipe machinery.
New meals have better food/drink/health values than Hearty meals. Old stock keeps
its identity and edible status.

**Economy/NPC/portability gate.** Extend `tests/economy-balance.test.ts` with every
new recipe and a complete taxed farm → butcher → kitchen → retailer example.
Count ordinary milk/wool/egg/compost income and actual young care when assessing
farm viability, rather than treating young care as free. Public export/import
quotes bound intermediary bids/asks; the butcher's adult bid must beat the
stores without creating a guaranteed import-and-resell loop. Test an NPC farmer
opting into continuous breeding and physically selling only surplus adults to
the better butcher bid, while keeping breeding stock. Kitchens, café/pub, hotel,
B&B, Harbour stores and spaceport list the intended goods; NPC knowledge and
chain reasoning include them. New-listing migration preserves all existing
explicit prices, disabled bids, ownership and stock. Author settings validate
atomically; portable designs retain the new catalogue/recipes/cohorts/rules.

**Browser/rendering gate.** Add `tests/browser/meat-livestock.spec.ts` and run
`TEST_GPU=1 npm run test:e2e -- tests/browser/meat-livestock.spec.ts`. In a local
world using the actual app: see and distinguish young animals, enable continuous
breeding, see growth/condition/pasture information, load a young animal into a
wagon and see its slaughter refusal, deliver an adult at the butcher ramp, pay
for a completed service, observe the meat, verify raw-eating refusal, select a
business menu, and cook/eat at home. Exercise empty, outside, disabled, full,
insufficient-funds and changed/cancelled-task states. Use small configured times
for mechanics without changing the production defaults. Check normal/low-quality
scenery, desktop/mobile UI, the five named butcher models and their complete
ramp bounds. Produce and inspect actual game screenshots; publish and verify the
new gallery card and all five interactive models.

Before release, run only affected Node suites plus the browser flows, clean
`npx tsc --noEmit`, changed-file Prettier and both builds. Update PLAYING, ECONOMY,
HAULAGE/transport, WORLD_BUILDING, field guide, catalogue, README, CHANGELOG under
Unreleased and release notes. Then cut the next minor version, commit/push this
complete item on backlog-implementation, deploy the exact SHA, verify live
migration/assets/gallery and post the bot announcement with reviewed screenshots.
Stop on an unmet criterion; do not start item 17 while this item is incomplete.

Initial inspection: ordinary landed fish currently has no general freshness
clock; the existing persisted game-day spoilage timer covers death-abandoned boat
cargo. Reuse the calendar/time semantics for meat, without adding unrequested
changes to fish. Existing recipes, livestock upkeep and seafood menu machinery
provide the integration points for the new consumers.

**Item 16 development checkpoint (2026-11-06, unreleased):** life-cycle red
tests caught immediate adult births, missing transfer ages, adult chicken ration
rounding, ignored custom breeding reserves, owner-only care, calendar changes,
design cohort loss and private freight-age leakage. Fixes pass 51 relevant
livestock/pasture/trailer/freight/social tests plus the focused privacy regression.
TypeScript is clean. Evidence: `output/livestock-meat/`. UI/models and the rest of
this item remain unfinished; nothing from item 16 has been committed or deployed.

Butcher balance criteria before catalogue changes: adult bids must beat farm
retail and public export bids without exceeding public import prices. Initial
test quotes are cows 29120, pigs 23296, sheep 20384 and chickens 4368 (internal
currency); raw counter asks beef 3500, pork 4200, mutton 5000 and poultry 6500.
Each adult batch must retain at least 20% on purchased inputs plus a 600-unit
qualified wage after default sales tax. Restaurants bid 112% of raw counter
asks; raw public export/import quotes use the established bounded multipliers.
Default beef stew/pork supper/mutton pie/chicken dinner recipes yield four meals;
the cooked Steak recipe yields four existing Steak items from one beef, retaining
its old edible values and existing public quotes. Validate each recipe and the
complete chain before choosing final meal counter prices. Default butcher service
by-product is zero compost (configurable); the basic meat chain does not depend
on an invented hide industry or free by-product income.

Steak balance refinement: use four cooked portions per business batch so its
150-second per-portion throughput remains faster than the 180-second home cook.
This preserves existing Steak identity and nutrition while satisfying the same
business-versus-home acceptance test as the new meals.

**Item 16 complete-feature verification (2026-11-06, release being prepared):**
The life cycle, paid slaughter, counter production, raw freshness, home/inn cooking,
restaurant menus, NPC supply/pricing and player/creator controls are implemented.
No slice of this item has been deployed separately.

- Red-before-code evidence remains in `output/livestock-meat/`: young births,
  ration/growth clocks, transfers, rules/designs, butcher service, freshness,
  cooking, migration, NPC supply, models and actual browser controls. Follow-up
  failures caught raw ingredients refused by room pantries, age loss on recovery
  and design import, stale empty-store ledgers, private pantry/wagon projections,
  hidden raw-use controls, default-only NPC meat knowledge and optional by-product
  accounting. Each confirmed gap now has a passing regression.
- Relevant Node suites collectively contain **239 distinct passing test names**.
  The 101-test broader run found an empty-stock counter compatibility regression;
  retain the established zero counters for trading/stockrooms/freight while
  trailers retain their existing empty-key cleanup. The 58-test rerun and the
  timed freight consumer tests pass. No assertions were weakened. Clock freeze,
  changes, cold storage, mixed lots, actual ship-store transfers, private inn
  pantries, recovery and portable freight retain age. Existing adult stock and
  cooked Steak are preserved; migration keeps explicit and paused quotes.
- `npx tsx --test` was run with explicit paths, never the entire suite: livestock,
  pastures, models, butcher/cooking/migration/panels, economy balance, nutrition,
  trailers, freight/recovery, social, home provisions, snapshots, relevant NPC
  farmer/budget/business/chain/pricing/circulation and world-catalogue consumers.
  Evidence includes `combined-meat-green.log`, `architecture-green.log`,
  `stock-regression-green.log`, `storage-consumers-green.log` (the one freight
  zero-counter failure is fixed in `final-config-green.log`), and
  `chain-consumers-green.log` (47/47, including final NPC configuration coverage).
- `TEST_GPU=1 npm run test:e2e -- tests/browser/meat-livestock.spec.ts` passes the
  complete real-app journey: enable continuous breeding; load calf and adult cow
  into a wagon; see remaining-age refusal; process a walked chicken and wagon cow;
  pay exactly once; refuse eating raw meat; choose a kitchen menu; cook and eat at
  home. Empty/full stores, outside access, missing cash, changed fee, cancellation,
  leaving, disabled rules and mobile layout pass. The full-pantry fixture resets
  hunger so ordinary automatic feeding does not consume the goods being tested.
  Editor edits persist after reload; a zero maturity target is refused by the
  browser without changing the saved rule. `browser-final-creator.log` passes.
- Both pre-existing herd/nutrition browser flows pass unchanged (apart from the
  implementation retaining their established Dairy herd/Livestock headings).
  `npx tsx scripts/meat-livestock-preview.ts` verifies two visible adults and two
  smaller young, plus actual butcher scenery, in normal and low graphics with no
  browser errors. Reviewed real screenshots live under `scenery/`; model geometry
  and all five ramp bounds pass. The butcher contact sheet is reviewed and its
  WebP is added to the public gallery. No generated concept image is used.
- README, player/economy/haulage guides, world-builder references and field guide,
  art capture instructions, changelog and release/upgrade notes describe the final
  behavior. Prepare **0.128.0**; final formatted builds, website browser verification,
  commit/push, exact-SHA deployment and the reviewed-image bot announcement remain
  the release gates. Do not start the coastal-boat follow-up before these pass.

Final privacy criterion before release: a refrigerated trailer containing one
raw-meat item must still publish the existing rounded count of ten, without its
exact-count age ledger. Its owner retains an exact private count of one; other
players receive no private cargo. Add a regression to `tests/snapshots.test.ts`,
confirm it fails on the leaked `life` field, then run that suite and the affected
trailer/freight tests. This changes only snapshot privacy, not the verified UI.

Final release gates: the trailer-privacy regression failed on the exact-count
ledger, then passed after hiding that server-only field. Its 40-test snapshot,
trailer, freight and cooking rerun passes. The owner projection still contains
exact cargo; the saved server ledger remains intact. Website browser verification
passes the butcher image, all five models, mobile layout and empty search without
errors; desktop and mobile screenshots are reviewed. Both builds and the clean
TypeScript check pass, with existing bundler warnings only. Changed files are
Prettier-formatted and `git diff --check` is clean. Release 0.128.0 is ready for
commit/push and deployment. The full test suite was not rerun.

**Item 16 post-push record:** implementation committed and pushed as
`0f675e4dfa747ac65b7ba5684f0c64b764fbe955`; GitHub's branch SHA matches local HEAD.
Mark the implementation slice done after that push. The separate cargo-boat
follow-up plan is committed as `3fc27e8`. Exact-SHA deployment, live migration
verification and the reviewed-image announcement follow before the next item.

**Item 16 release complete (2026-11-06):** live SHA is
`0f675e4dfa747ac65b7ba5684f0c64b764fbe955`; public health and the website report
**0.128.0**. The deploy script's first health request saw startup 502; the service
then became ready and read-only health, client JavaScript, prefixed map-worker,
website and all five live butcher gallery models passed without browser errors.
No second restart was needed. All five saved worlds have `meatVersion: 1` and
the new market listings. No live player grants or manual world edits were made.

Database backup: `/var/lib/aclone/backups/pre-deploy-20261106-011033.sqlite`.
Website backup: `/var/backups/aclone-website/site-20261106-011206.tar.gz`.
The bot announcement and both reviewed screenshots pass read-back and image-fetch
verification: https://discord.com/channels/1562183434254680175/1565527790785404968/1568146105202507807.
Evidence is in `output/release-0.128.0/`. Progress: **14 of 29 eligible Planned
sections complete**, plus all 20 shipped claims assessed and the three confirmed
gaps fixed. Next: the requested item 13 coastal cargo boat scale follow-up, then
item 17. Piloted spaceflight remains excluded.

### Coastal cargo boat scale follow-up — completion criteria before code

Measured shipped definition/model: hull **20 × 5.6 m**, top 1.2 m above the
waterline and keel 1.25 m below it. Target **60 × 16.8 m**, freeboard 3.6 m,
draft 3.75 m. Store defaults only in the existing freight vehicle catalogue;
expose draft/freeboard with length/beam in the per-world vehicle editor, validate
and preserve them in saves and portable designs. Keep human, wheelhouse fittings,
rails and individual crates at human scale. The hold remains 2,000 weight, tank
320, price 240s and speed/fuel settings unchanged; rerun the existing route margin
and full-circuit tests rather than silently scaling the economy.

The current quay permits only 28 × 8 m. Use vessel-sized water clearances outside
the existing landing structure, not an enlarged structure that overwrites nearby
property. Configure quay vessel limits per world (60 m length, 20 m beam defaults)
and check actual depth/obstructions across the enlarged hull at boarding/mooring.
Keep river-dock limits and small-craft berths unchanged. The boathouse and fishing
pier need the same vessel-aware outside clearance. Preserve saved ownership,
hold/basis/freshness, and ensure existing moored cargo vessels can be retrieved.

Red tests before production changes:

- `npx tsx --test tests/cargo-boat.test.ts tests/cargo-boat-scale.test.ts`: assert
  the new default dimensions, configurable/portable draft and freeboard, unchanged
  economics, real enlarged-hull grounding and blocked-berth refusal without stock,
  money or ownership changes. Verify successful boarding, disembarking and freight
  retrieval at a clear quay, boathouse and pier; oversized river refusal remains.
- `TEST_GPU=1 npm run test:e2e -- tests/browser/cargo-boat-model.spec.ts`: assert
  60 m hull, 16.8 m beam, finite bounded geometry, human-scale helm and individual
  loads, empty/full hold visibility, and world-tuned geometry rebuilds. Capture a
  true-scale before/after view using the actual models, person and dock.
- Browser journeys: purchase/board, load/trade/cancel, sail and return, moor/reboard,
  cockpit and chase views, empty hold, blocked berth, river refusal, normal/low
  graphics, and editor dimension changes persisted after reload. Reuse affected
  cargo-boat, freight-quay and cargo-river flows; add missing scale-specific steps.
- Relevant freight, navigation, shore, recovery, world-design and route-economy
  suites pass; clean TypeScript, changed-file Prettier, game/website builds, updated
  HAULAGE/player/world-builder docs and release metadata. Commit/push/deploy the
  complete change, verify read-only live assets and announce reviewed screenshots.

Scale follow-up findings: the first enlarged model passes browser geometry and
human-size checks (60 m long, 17.15 m including fenders, 15,458 triangles). The
initial clearance implementation correctly refuses the public boatyard's former
berth: its shallowest full-hull point has only 1.45 m of water. Moving the berth
12 m farther seaward supplies the required draft. Add a per-world
`boatBerthSearchDistance` default of 30 m (zero disables the extra search), sampling
only farther outside the structure; retain full-hull validation so obstacles and
shallow patches cannot be bypassed. Test both ordinary launch and zero-search
refusal without altering the boatyard or flattening terrain. Deep-quay fixtures
now use an actual deep seabed for the 3.75 m keel; add an explicit shallow-water
refusal. The broader freight tests remain red until real existing docks work.

Scale follow-up verification so far: all 94 focused freight, navigation,
configuration, camera, abandonment and inland-recovery tests pass. Model browser
check passes at 60 m length with human-scale driver. Full coast circuit retains
89.33 of 320 fuel; the funded freight route remains profitable at about 11.46s
net after fuel, maintenance and a 20% crew share. The first broader run's 23
failures shared the old shallow public-berth setup; the seaward search resolves
those failures in the focused rerun. Camera, crew and actual SQLite legacy-mooring
regressions were red before their fixes, then pass. Browser player/editor journeys
and final release gates are still in progress; this follow-up is not deployed.

Visual review caught a real scaling defect before release: enlarging the hull
left a gap between the original short aft deck and the hold. Add a browser
raycast regression requiring a solid deck between wheelhouse and hold and at the
forepeak, while retaining the intended open cargo hold and human-sized pallets.
Fix and recheck the actual model before publishing screenshots. Move the local
comparison fixture away from race checkpoints so its unchanged dock/person scale
is unobscured. No production scenery is removed for the screenshots.

Scale follow-up release gates pass: 94 focused freight/navigation/camera/recovery
checks and 26 final scale/towing/vehicle-config checks are green (overlapping
coverage, not 120 distinct tests). The purchase/trade/editor, river refusal and
freight-quay browser journeys pass; the quay journey was rerun after the deck fix
and passes again. The model browser regression now proves both deck caps exist,
empty/full load visibility and tuned geometry rebuilds. Final geometry is 60 m
long, 17.15 m including fenders and 15,444 triangles, with a 1.43 m seated driver
and 1.6 × 1.5 m pallets. Actual normal/low scenery and helm screenshots are reviewed;
no browser errors. TypeScript (`npm run build`, including `tsc --noEmit`), game and
website builds pass; changed files are formatted and `git diff --check` is clean.
Existing bundler chunk-size and dependency-comment warnings remain non-fatal.
Evidence: `output/cargo-boat-scale/`; release preparation: `output/release-0.129.0/`.
Cut 0.129.0 with player/freight/world-builder docs and README refreshed. Push,
exact-commit deployment, saved-freight verification and announcement remain next.

Scale follow-up committed and pushed: `d31b83e`; the GitHub branch SHA matches.
Implementation is done. Exact-commit deployment and announcement are in progress;
this record is deliberately added after the push.

0.129.0 is done and live: pushed/deployed commit `d31b83e` matches exactly;
health, client and website report 0.129.0. Public client and prefixed map worker
load without browser errors. Read-only comparison of all five saved worlds with
the pre-deployment backup finds no existing owned/moored coastal freighters and
no ownership differences; legacy reberthing/freight preservation is exercised by
the local SQLite regressions rather than claimed as a live migration event.
Database backup: `/var/lib/aclone/backups/pre-deploy-20261106-015619.sqlite`.
Website backup: `/var/backups/aclone-website/site-20261106-015731.tar.gz`.
The bot announcement and both actual before/after-scale screenshot embeds were
read back and verified:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568157533158248538
Evidence: `output/release-0.129.0/`. No live grants or test-player changes.
The eligible-section count remains 14/29; this finishes the item 13 follow-up.
Next in order: item 17, Open bay doors and modelled interiors.

### Item 17 — Open bay doors and modelled interiors: criteria before code

Implement the entry in its stated order: shared door state and real apertures;
animated leaves and visibility; furnished shells for every named trade and
architecture; stock/owner variants; reduced detail; creator controls and gallery;
bounds, browser journeys and island performance. Do not start parked vehicles.

Completion criteria and commands:

- `npx tsx --test tests/building-doors.test.ts`: pure deterministic state is open
  at 07:00–19:00 with a stable ±20-minute building offset, only for staffed or
  public-service buildings. Construction, unstaffed and night cases shut; an
  owner/worker currently inside overrides hours. Test midnight schedules, frozen
  clock, old saves, public snapshots and unchanged collision. No persistent door
  state or separate door network messages. If private work/inside information is
  needed, project only the derived activity flags in the ordinary snapshot.
- Every gameplay/render policy default lives once in `data/settings.json`:
  mode (business hours / always open / always closed), opening/closing hours,
  unstaffed closure, offset minutes (20), motion seconds (5 within specified 4–6),
  animation reach (120 m), sound reach (40 m), swing (110 degrees), visibility
  threshold (0.02), interior detail (full/reduced/none). Validate changes atomically,
  expose labelled creator controls, and round-trip saves and portable designs.
  Six roll-up panels and the 6,000/15,000 triangle budgets are model constraints.
- `npx tsx --test tests/building-interiors.test.ts tests/scale.test.ts`: each
  applicable legacy and five-model design has real front apertures, floor, inward
  walls/back, ceiling with rafters/trusses and two/three keyed lamps. Door motion
  is six-panel sectional roll-up, paired sliders or paired 110-degree barn hinges
  as assigned in the entry; no change to collision. Closed interiors hide below
  threshold. Reduced mode shows shell and only two/three principal props; none
  draws no props. Custom creator models retain their own behaviour.
- Furnish and visually inspect all listed sets: hangar's two biplanes (one under
  repair), engine stand/propeller/tools/fuel/tyres/weather board; garage lifts and
  hash-selected tractor, tools/compressor/bench/tyre equipment/parts store/pit;
  sawmill carriage/saws/logs/lumber/ducts and through-open Lumber shed; brewery
  kettles/mash tun/fermenters/grain/kegs/hoses/steam; warehouse racks/forklift/
  packing/conveyor/loading edge and four actual-stock tiers; factory machines/
  walkways/gantry/cabinet/office; boat cradle/slipway/rope/loft/paint/steam box and
  real owned stored boats; forge hearth/anvil/bellows/tub/tools/power hammer/sand;
  carpenter/workshop bench/saws/clamps/lumber/furniture/stove or machine-shop kit;
  feed mill/hay barn/farm hopper/sacks/elevator/bales/cart/tractor; brickworks/
  concrete/mason/quarry/mine production equipment; livestock pens/animals/
  milking/churns/troughs/hay/hose; refinery pumps/pipes/valves/gauges/control desk;
  starport freight train/transporter/bowser/gantry/shuttle where specified, with
  glazed passenger-terminal doors. Assert prop bounds against each volume and
  triangle budgets, stock changes without scenery reconstruction, and human scale.
- `TEST_GPU=1 npm run test:e2e -- tests/browser/building-doors.spec.ts`: actual
  scene clock crosses opening/closing with visible smooth motion; walk to workshop,
  hangar and garage; verify near/far snapping and audible-range gating, staffed/
  unstaffed/construction states, empty/full warehouse, full/reduced/none and low
  quality, changed editor rules/reload and invalid-input refusal. Capture reviewed
  actual screenshots and a short successful browser recording for the release.
- Extend `scripts/building-architecture-preview.ts --open` with an open-interior
  sixth tile; review all applicable kinds and architecture layouts in normal/low
  quality. Publish matching website gallery assets. Compare town all-open versus
  all-closed frame distributions under the existing island budget, checking no
  synchronous full-scene rebuild on door/stock updates and bounded draw/triangle
  work; record exact measured results rather than assuming npm tests prove it.
- Relevant direct-consumer suites (building shapes/facades, snapshots, creator
  settings/designs, lighting/audio and scenery updates), clean `npx tsc --noEmit`,
  changed-file Prettier, game/website builds, player/world-builder/ART docs and
  README/changelog/release metadata. Commit, push, deploy exact SHA with backups,
  read-only live verification, then #announcements with reviewed screenshots.

Item 17 recovery audit (2026-11-06): still in progress, not released. Browser
state assertions initially passed while the actual screenshot showed shut doors:
static scenery batching had detached the leaves and merged hidden interiors into
the exterior. New regression tests first fail on missing retained meshes and
incorrect fresh-preview poses. Preserve the two dynamic subtrees through batching
and matrix freezing, initialize closed leaf poses, and verify raycasts against
actual rendered geometry. All nine door/scenery/sound regressions then pass; the
real clock/editor/reload browser flow passes in 50.7 seconds and its open-workshop
screenshot visibly shows the open aperture and furnishings. The center-seam ray
was moved 0.1 m into a leaf to avoid testing a floating-point crack at the seam.
Further red tests require actual kettle steam, retained flickering coals, a
modelled pattern-shop sand floor and the Band-saw mill's distinct saw. Remaining
completion gates include the full furnishing/storage audit, gallery and measured
all-open performance; do not treat geometry/state coverage as visual sign-off.

### Item 17 — Validation stop, 2026-11-06

**Incomplete; no commit, push, deployment or announcement. Live remains 0.129.0.**
Do not begin item 18. Preserve the working changes on `backlog-implementation`.

Further verified work:

- Test and remove painted doors/windows obstructing open apertures across legacy
  and all five applicable architectures, including the lumber shed's rear opening.
  Test and align the garage lift with its actual tractor.
- Test and add retained kettle steam and forge flicker, actual sand-floor geometry
  and a band saw for the Band-saw mill. Effects stop when shut or reduced.
- Preserve only a confirmed storage location in the existing vehicle record;
  project public boat identity/paint separately from private fleet data. Clear
  storage on boarding, retain it through saves, and record tender storage too.
  Show the motorboat in the dry workshop and canal boat in the existing lifting
  hall. Give that hall working doors without flooring over navigable water.
- Test and add hangar repair trestles, current-paint refresh, an actual rear-window
  aperture and an outdoor windsock. The final browser geometry survey passes
  all applicable legacy/five-model interiors, stored motorboat/canal-boat bounds,
  finite geometry and the 6,000/15,000-triangle budgets, including these hangar
  checks (`output/building-interiors/final-geometry.log`). This is geometry
  coverage, not a claim that all furnishings have received final visual review.
- Add `--open` architecture previews, including a sixth tile at human eye height.
  Review the initial workshop/garage screenshots; further final gallery review
  and website publication remain unfinished.
- First matched expanded-island town performance runs, low quality, 33 rendered
  players, Quadro M1200, 1280×800: closed/open p95 **35.3/35.3 ms**, maximum
  **37.7/37.0 ms**, zero frames over 100 ms, draws **248/262**. These measurements
  precede the later storage/hangar additions and need repeating at final sign-off;
  normal quality and the completed full-detail furnishing set remain unverified.
  Evidence: `output/building-interiors/performance-{closed,open}/results.json`.
- The boating suite initially exposed an existing rescue persistence failure:
  `cargoLife: undefined` disappears on JSON round trip. Reproduce it in an archive
  of released commit `d31b83e`, then omit absent optional metadata at creation.
  Keep the original equality assertion. All 14 boating tests and nine current
  interior unit tests pass across the focused runs.

The broader relevant gate ran 100 tests: **93 passed, 7 failed**. One failure
was a missing `loadingDoor` tag on the new freight-door group; restore that
semantic tag and verify the existing freight-sized-door assertion separately.
The other six known failures remain unresolved:

1. `building-architecture.test.ts` counts the entire newly furnished brewery
   against the older 3,500-triangle whole-building limit (expanded model-1: 3,886).
2. `building-finishes.test.ts` requires a whole garage to fit its old 366-triangle
   limit and then fewer than 100 triangles, including all hidden furnishings.
3. The same suite treats every `lightSource` as a six-index window pane with a
   window mask; the specified interior lamps are box fixtures (36 indices).
4. The catalogue material-library count is outside its older 12–18 range.
5. The scale suite's generic catalogue dimension limits fail on shipped geometry.
6. Its below-ground check rejects the shipped freight quay's piles.

An isolated archive of released commit `d31b83e` reproduces failures 4–6:
24/27 building architecture/finish/scale tests pass, three fail. Evidence:
`output/building-interiors/building-baseline.log`. Those old tests have not been
weakened, deleted or skipped. Failures 1–3 encode assumptions from the empty-shell
renderer that conflict with the new entry's furnished-interior budget and lamps.
Stop here under Henry's instruction to stop when the completion criteria cannot
be met; do not silently relax the old assertions to claim success.

Remaining implementation/verification beyond that validation conflict: audit all
named furnishings and architecture layouts (including hash-selected repair hulls,
staging, fully supported repair/lift geometry, stock-height presentation and
trade-specific detail); verify low-detail effects and the stored-boat update flow
visually; inspect the final hangar and waterside hall; cover editor invalid-input
and construction/far-distance player flows; finish gallery/website and player/
world-builder/ART docs; rerun final relevant gates, normal/low performance and a
successful recorded browser walkthrough. TypeScript is clean at the latest check;
changed files are formatted. No release metadata/version bump is warranted yet.

### Item 17 — Resume validation, 2026-11-06

Henry requested continuation. Reconcile legacy empty-shell assertions with the
entry's explicit furnished-interior contract: retain the original exterior
material-pass budgets (366 garage / 574 farm) and architecture exterior limit,
and measure the new interiors separately against 6,000 / 15,000 triangles.
The old sub-100 optimization assertion cannot describe split aperture walls;
the original exterior budgets remain enforced. Identify facade windows by
`facadeWindow`, preserving their frame/mask and batching assertions; test interior
lamps independently. Recognize the finite 20-member finish vocabulary, preserve
the 11 MiB memory ceiling, and fix the measured 11.5 MiB allocation rather than
raise it. Use the quay's canonical infrastructure dimensions and explicitly
recognize underwater piles/fenders, preserving other ground/footprint checks.
Run the reconciled tests red before fixing texture memory and fender identity;
then run all affected geometry, finish, lighting and interior tests. These are
validation repairs within item 17, not completion or permission to start item 18.

Additional furnishing audit criteria: confirm stock-to-eaves hay stacks and empty
stock, a tool chest per garage bay, full-size freight containers with gantry
clearance, rear boathouse apertures, actual hash-selected repair craft with
staging, supported lift platforms, wall-mounted tools, kettle manways and malt
pallets. Run geometry/bounds across every architecture before visual review.
Merge fixed furnishings across each principal/detail set by material, preserving
triangle count and bounds, animated effect subtrees and independent stock/paint
updates; verify reduced/closed visibility in the actual browser. Record red and
green evidence in `output/building-interiors/`.

Final performance command:
`TEST_GPU=1 npm run test:e2e -- tests/browser/building-interior-performance.spec.ts`
(run alone, no other browser/compiler load). Compare closed/open expanded-town
samples on the same machine, 32 other players, 10-second warmup and 15-second
sample, separately for low/normal quality. Retain the recorded frame-budget
contract: median ≤50 ms, p95 ≤66.7 ms and no more than 10% p95 regression against
the matched closed run; require zero steady frames above 100 ms and no page
errors. Do not substitute a geometry/state test for this measured browser gate.

Resume verification findings:

- Retain original facade windows in their own light batch; interior lamps no
  longer get detached from their visibility gate or replace the window mask.
  Reconciled geometry/finish/lighting checks pass; separate lamp regression covers
  open night, closed, daytime and no-detail states.
- The actual player screenshots exposed floating hangar aircraft missed by broad
  geometry boxes. A red precise-vertex check measured the lowest mesh at 1.193 m
  instead of the 0.28 m floor. Use precise bounds for placement and fit repair
  trestles to actual airframe contact points; the complete geometry survey passes.
- Final performance verification initially failed at closed-room p95 134.1 ms
  and 37 frames above 100 ms. A profiled retry also failed. The desktop app was
  concurrently generating thousands of binary `git diff --no-index` jobs for
  untracked `output/` archives/videos, many blocked on pipe output. Add local
  `.git/info/exclude` entries for `output/`, `.codex-attachments/` and
  `docs/NPC_STATUS*.md` (no tracked ignore change; preserve all evidence). Stop
  only verified read-only output diff jobs; let queued jobs and zombies drain.
  A retry during cleanup fails the unchanged 50 ms obstacle tick budget. Once
  the queue clears, matched low-quality closed/open frame p95 returns to
  35.5/35.6 ms, maxima 37.2/37.8 ms, zero steady frames above 100 ms, draws
  248/265. Continue the remaining quality comparisons without relaxing budgets.
- The expanded player journey reaches all requested buildings, stock and editor
  cases; its final Low reload assertion exposed a test setup that overwrote
  Low with Normal on every reload. Preserve the selected local quality in the
  setup and rerun before treating its video as successful evidence.

### Item 17 — Final local verification, 2026-11-06

The expanded player journey passes: clock-driven opening/closing, actual rendered
leaf positions, workshop/hangar/garage/warehouse views, all four shelf-stock tiers
without scenery replacement, unstaffed closure, invalid opening hour refusal,
Full/Reduced/None policies, saved settings and Low reload, construction and distant
doors. Evidence: `output/building-interiors/browser-final.log` and its successful
`browser/doors-rules-stock.webm`. A later precise-bounds survey exposed an
asymmetrical factory tool touching a wall; clamp its actual local min/max bounds
and rerun the complete geometry survey successfully (`geometry-final.log`).

The furnishing audit adds a grounded repair aircraft with exposed engine bearers,
a modelled radial engine on its stand, a contiguous garage workbench and lamps in
the waterside lifting hall. The radial-engine regression first had an invalid
Node fixture using the canvas-based hangar sign; correct the fixture to furnish
the actual planned volume, confirm the missing-radial-engine failure against the
previous box prop, then pass it with the new model. All 22 interior unit checks
pass. The direct-consumer run passes **126/126** tests for doors/interiors/sound,
static scenery, scale/architecture/finishes, lighting/audio, snapshots, boating,
boat abandonment, vehicle services, creator settings and rule sets
(`relevant-final.log`). TypeScript is clean (`types-final.log`).

Review all 25 applicable kinds × five architectural layouts, full/reduced detail,
in `gallery-compare/`; separately review the boathouse lifting hall in
`gallery-water/`. The actual boat rests on its rack, rear openings remain clear,
and reduced rooms retain their principal equipment. Regenerate the 25 public
WebP sheets with open exteriors and a sixth interior tile (`gallery-publish.log`).
Review the final garage/brewery public sheets and the actual hangar/garage/stock
player screenshots. The walkthrough-artifacts video reviewer confirms visible
floor contact, door motion and shelf-stock changes; retain the reviewed 26-second
clip `video-review/doors_interiors_stock_rules.mp4` (original seconds 17–43).
The clip excludes reload footage and is not evidence of persistence by itself.

`npm run build` passes; `npm run check:website` builds the matching website and
passes its four-width gallery/search/image/keyboard/touch checks, all 54 building
previews, empty search, delayed-load cancellation, WebGL failure and no-JavaScript
fallbacks. The normal biplane model/cockpit browser regression passes (1/1),
confirming the maintenance variant leaves the flyable aircraft behavior intact.
Prepare release 0.130.0 and reviewed screenshot announcement; the final isolated
performance gate and push/deployment verification are still pending below.

Final isolated performance gate passes on the completed implementation
(`performance-release.log`, 3.1 minutes): low closed/open p95 **35.6/35.4 ms**,
maxima **39.2/38.8 ms**, draws **248/265**; normal closed/open p95 **18.6/17.2 ms**,
maxima **29.2/21.2 ms**, draws **248/272**. All four samples meet median ≤50 ms,
p95 ≤66.7 ms, the 10% matched-regression limit and zero frames above 100 ms,
with no browser errors. Six furnished interiors are visible when open and zero
when closed. Fixture: expanded town, 32 other players, Quadro M1200, 1280×800,
10-second warmup and 15-second sampling. No other render/compile jobs run during
these measurements. All item 17 local completion gates now pass.

Item 17 is done and pushed as `022dc7b1f6cbd61384f2313f27e9eb303f6284a3`;
GitHub branch SHA matches. All local gates pass, changed files are formatted and
TypeScript is clean. Deploy that exact 0.130.0 SHA with normal backups, then verify
live health/client/website/assets and publish the reviewed screenshot announcement.
Eligible Planned sections complete: **15 of 29**. Piloted spaceflight stays excluded.

0.130.0 is done and live: pushed/deployed commit
`022dc7b1f6cbd61384f2313f27e9eb303f6284a3` matches exactly. Health, client and
website report 0.130.0; prefixed JavaScript and map worker load correctly. The
public garage, brewery and boathouse gallery files match the local SHA-256 hashes.
Read-only browser verification reports no errors. Database backup:
`/var/lib/aclone/backups/pre-deploy-20261106-150707.sqlite`; website backup:
`/var/backups/aclone-website/site-20261106-150853.tar.gz`.

The bot announcement is posted and verified with three readable image embeds:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568356762556440576
Evidence: `output/release-0.130.0/`. No live player grants or manual world edits.
Continue with item 18; helicopters remain dependent on persistent parked vehicles.

### Item 18 — Persistent vehicles and arrivals: completion criteria

Read the complete entry before production changes. Implement in its named order:
parked records/migration and switching; fuel/home/lodging; sessions/towing/solid
footprints/trailers/NPC return; then mount/dismount and building arrival animations.
Do not release a partial parking or arrival system.

- `npx tsx --test tests/parked-vehicles.test.ts`: walking from a motor vehicle
  creates exactly one owner/slot record with position, heading, height, paint,
  condition, fuel and parking time; no duplicate tank remains in parkedFuel.
  Stand 1.4 m left of the driver axis. Reject a return beyond 3 m without any
  mutation and show the distance. Returning restores the exact tank/condition;
  default-off worlds retain instant switching. Exercise changed ranges and
  disabled NPC parking separately. Grounded aircraft stay on their apron;
  airborne dismount remains refused. Existing boat/crew/tender rules remain.
- Store the current tractor inside a garage when changing to another owned
  machine there. An outside parked machine must be retrieved where left, not
  teleported to the garage. Only previously stored/migrated/new machines drive
  out of the garage. Show the owner's actual stored tractor in its interior.
- Refuel a nearby parked tank with carried Fuel using the canonical item rate;
  refuse distant, full, unavailable and unowned targets without consuming items.
  Preserve the existing optional help-refuel policy for another player's tank.
  Prevent ordinary Use Fuel from remotely filling a parked tank while walking.
- Home/booked lodging parks at a dry, clear door-side kerb, without blocking the
  path or another parked vehicle. Leave on foot by default; both departure
  controls work. If no safe parking exists, refuse before mutating fuel/state.
- Session tests: sign-off leaves a public driverless record, lights/engine off;
  reconnect restores the seat only for a driving departure. Walking departures
  stay on foot. The opt-out hides the vehicle as before. Restart/catch-up keeps
  records. Absence-limit processing removes the absent owner's parked records.
- Tow only expired vehicles on a public road, after seven game days by default,
  counting catch-up on the world clock. Protect owned property, garages/hangars
  and non-road parking. Prefer a clear home kerb, then a garage; preserve every
  tank, paint, condition and trailer load. Record the configurable fee and notice;
  do not repeatedly charge after moving. No safe destination means defer intact.
- Movement/construction/apron tests: use full configured footprints, shared with
  prediction; parked vehicles stop/slide without damage according to collision
  rules. Prevent construction and aircraft spawning over parked vehicles.
  Hitched trailers remain with the parked tractor and do not follow its walker.
- Migration tests: keep current drivers unchanged; place each legacy parkedFuel
  tank once at a safe home kerb or garage, retain old inference and ownership,
  never place machines in water. A blocked placement preserves pending fuel.
  Enable persistence once for public Puddlewick, retain later owner overrides,
  and keep other worlds on their existing behavior unless explicitly enabled.
- Rules: canonical defaults in data/settings.json, shared validation/summary,
  F10 controls and save/design round trips. Besides persistence, sign-off and NPC
  switches, expose 7-day grace, towing fee (20d initial default, the entry gives
  no amount), 3 m return/refuel reach, 1.4 m door offset, safe parking search reach,
  1.6 s mount/dismount, full/quick/off arrival mode, 1 s quick arrival, 2–4 s full
  arrival, 18 m approach reach and 90° pedestrian door swing. Reuse existing
  vehicle dimensions, fuel-item rate, collision policy and clock settings.
- `tests/arrival.test.ts` and actual browser flow: approach refuses out-of-range
  or occupied/invalid targets before mutation; records a server entering task,
  immobilises controls, parks/dismounts, walks to the shared facade doorway,
  opens/closes the real door and hides the person only after entry. Panel opens
  only on authoritative completion; Escape/cancel/close reverses the sequence.
  Other clients observe the same state. Home departure mounts only when chosen.
  Closed business bays allow their side entrance and occupancy lights.
- Browser checks in disposable worlds on desktop, touch and controller input:
  walk away, visible unmanned machine and attached trailer; map pin, distance and
  out-of-fuel direction; distant return/refuel refusal; buy fuel, walk back and
  drive; home/lodging departure; second-client sign-off/reconnect; garage storage;
  mount steps/seat transition/camera hold; entry panel timing and door angle;
  full/quick/off, persisted custom rules, invalid inputs and missing destination.
  Review screenshots and a successful recording before publication.
- NPC tests require routing back to a stranded/parked tractor before refuelling
  or boarding it, without an infinite prep loop; short walking trips stay valid.
  Run affected tractor, fuel, player-aid, boat, trailer, home/lodging, movement,
  construction, snapshot, migration, NPC and UI suites only where affected.
  Clean TypeScript, changed-file Prettier, game/website builds, focused browser
  verification and performance checks on added parked scenery are required.
  Update PLAYING, WORLD_BUILDING, README/changelog/release docs. Commit, push,
  deploy exact SHA with backups, verify read-only and announce with reviewed
  screenshots only when the entire item meets these criteria.

Item 18 resumed on 2026-11-06 from `2bf2678`; release 0.130.0 remains live.
The five initial core tests failed for the intended missing parking/return/refuel
behaviour (`output/parked-vehicles/core-red.log`) and then passed. Subsequent
red-before-green batches cover rule validation/editor/design portability, remote
garage refusal, migration, home/lodging, sessions, trailer attachment, physical
collision/construction/apron occupancy, calendar-based towing and NPC return
routing. Evidence is under `output/parked-vehicles/` (`rules-*`, `home-migration-*`,
`sessions-*`, `world-*`, `npc-*`). Existing focused core regressions: 35/35;
home/trailer/snapshot/contact regression batch: 57/57. These are intermediate
checks, not completion of item 18.

Server arrival tests now cover pending/finished entry, movement locking,
quick/off/custom duration, cancellation, invalid destinations and home departure.
Rendering tests found and reproduce both a trailer following its walker and
pedestrian hinges being consumed by static batching. Parked lamps must use
independent materials; muting them must not darken another driver's headlights.
The actual browser arrival flow is being added and run red before UI integration.
No item 18 release, push, deployment or announcement has occurred. Remaining gates
include full visible arrivals/mounting/panel timing, stored garage displays,
map/HUD/refuel controls, real session and mobile/controller flows, performance,
final regression/type/format checks and player/world-builder documentation.

Item 18 continuation, 2026-11-06: the HUD/map regression first failed because the
parked-vehicle control was missing, then passed in the real browser. The HUD now
names the physical tank, distance and compass direction, explains return/refuel
refusals, and marks the vehicle on both maps. Edge tests reproduced and fixed a
hitched trailer being left behind by home parking, missing home departure targets,
and walking boat-tank refuelling being incorrectly intercepted by land parking.
The successful compact-arrival browser check also verifies the progress indicator
stays clear of the central view; parked nameplates no longer grow with proximity.

Mount/dismount tests now verify configured duration, movement locking, observer
snapshots, actual model seat anchors, driver fading and material restoration.
Garage tests verify outside-only switching, safe drive-out, storage of the arrival
tractor and display of its actual model/paint. The home browser test exposed an
unintended exit sent when the Go home panel closed; it now passes with both
explicit departure controls. A subsequent industrial test caught approach targeting
the solid wall between loading bays. Shared entrance placement now selects an
actual pedestrian doorway or bay; crossing opens that bay and occupied rooms light
after hours. Focused batch: 63/63; TypeScript clean before the latest browser run.
Evidence: `hud-*`, `edge-*`, `boat-*`, `compact-browser-*`, `home-controls-*`,
`mount-garage-*`, `mount-render-*`, and `bay-*` in `output/parked-vehicles/`.
These are intermediate results. The extended mount/garage browser flow and the
remaining session, mobile/controller, customized rules, trailer-storage and
performance checks are still required. Item 18 remains unfinished and unreleased.

Visual review of item 18's successful desktop recording found an upright mounting
figure crossing the cab roof and continuous siding behind an open cottage door.
New regression tests require the animated skeleton to settle into the driver's
seated pose and a ray through the open doorway to reach a recessed entrance.
Both failed before the fixes and now pass (`visual-review-red/green.log`). A
separate boat compatibility test caught building approach bypassing disembark;
the action now refuses atomically while the existing boat interaction UI remains.
The next roadside-help check requires the existing player-help button to fill the
nearby parked tank when its owner has walked away, honour the world's parked reach
and help switch, preserve the owner's walking tank, and issue the existing receipts.
Browser review must recheck the roof and doorway fixes before publication.

Additional item 18 integration checks reproduce accepted NPC garage actions
losing the storage location and NPC sign-off bypassing parking. Garage recovery
now preserves that location and retrieves stored vehicles before using fuel;
resident visits use the same sign-off/seat-restoration helpers as human sessions.
The focused NPC/core batch and shutdown test pass after their recorded red runs.
Safe parking must also reject loose trailers and reject any relocated trailer
footprint overlapping another parked machine; the next regression covers both.

World-builder compatibility check: a parked machine must retain its assigned
creator vehicle model and tuning, rather than reverting to the stock tractor.
The renderer regression uses a distinct custom model and verifies its dimensions.

Performance gate for item 18: run the isolated expanded-town profile at low and
normal quality with 32 resident actors, then the same population with its 21 motor
vehicles parked and their drivers signed off. Require every parked model to be
present, no browser errors, over 200 sampled frames, median <=50 ms, p95 <=66.7 ms,
no >100 ms sampled frames, and parked p95 within 10% of the matched active case.
Run `TEST_GPU=1 npm run test:e2e -- tests/browser/parked-performance.spec.ts` alone
with production edits frozen. Record results before release.

The final focused batch passed 330/332 tests. The new doorway recess exceeded
existing geometry budgets; exposed planes and simpler small round fittings now
keep every original budget unchanged. A fresh-world save/reload also acquired a
meat migration marker and revision on first load; newly created worlds now mark
their already-current catalogue. The legacy migration fixture explicitly omits
that marker. The 40-test repair batch and 20 directly affected follow-up tests
pass. A frozen-matrix label regression failed before its correction and now
passes: near entrance labels must stay below 3.6% of viewport height after static
scenery preparation, restoring their normal scale at distance.

Successful browser checks cover desktop arrivals/mounting/garage storage,
mobile/controller inputs and persisted/invalid/off rules, two-client sign-off
and reconnect, empty-tank fuel shopping and driving, and helping another player's
parked tank on desktop and phone. Video review confirms door timing and seated
mounting. The fuel-rescue review additionally found the chase camera crossing the
parked tractor roof. Before release, add a renderer regression requiring a camera
behind a parked hull to move to the unobstructed player-side segment, while a
clear camera stays unchanged. Re-run the actual fuel-rescue flow and inspect the
return walk, including the previously obscured 35.5-second point. Keep mounting
camera hold and first-person behaviour intact.

Performance fixture audit: the first comparison counts all 21 parked meshes but
its default camera faces away from the resident fleet (active and parked draw
counts are identical). Do not accept that as visible-fleet evidence. Point the
survey camera toward the fleet, save a profile screenshot, and assert each
parked model actually submits a mesh during the sampled frames. Keep the same
population, quality settings, frame count and timing thresholds in the corrected
comparison; this strengthens coverage rather than changing the budget.

Persistence integration audit: changing the world switch from off to on must
place existing spare tanks immediately, retaining the current driver and tank;
a restart must not be required for the advertised rule to apply. Repainting an
owned parked vehicle at a garage must update its physical record, and boarding
must retain that paid-for paint. Add direct action regressions for both existing
flows before production changes, preserving invalid-action atomicity.

The first camera correction cleared the roof by shortening the view, but video
review showed the walker filling the screen and the next mount hidden by the
vehicle. Strengthen the camera regression to retain chase distance as well as an
unobstructed target-to-lens segment (red: lost chase distance). Lift over the near
edge of the parked hull instead; the 16 renderer/mount tests pass. Recheck the
successful fuel flow again before publication. The initial reviewed desktop
retake already confirms compact labels and correct door/mount timing.

World-switch migration and garage repaint both failed for the intended missing
state update, then passed with the existing fleet, appearance and rules tests
(43/43). The saved-rules touch/controller browser recheck also passes (34.8 s).

The roof-lift retake exposed excessive height when the walker nearly touches the
hull. Extend the camera test with near-zero clearance: keep a clear sightline and
useful chase distance without launching overhead. It fails before the fix. The
camera now uses the pedestrian's outward side when lifting would exceed chase
distance, resolves the desired position before interpolation, and still holds
through mounting. All 16 renderer/mount checks pass; final browser review pending.

Pre-release compatibility audit: mandatory building approach now dismounts the
player and parks the hitched rig. Existing trailer trades, garage buy-and-hitch
and vehicle services require a driven/hitched vehicle; butcher service requires
the loading ramp. They must remain usable without remotely moving the tractor or
weakening cargo, ramp and ownership checks. Add an integration regression for
approach followed by trailer trade and verify the actual outdoor service UI
before release. This is a release gate, not a deferred follow-up.

Compatibility criteria: retain default E/tap/controller building entry, but add
an explicit “Trade & services outside” control for loading-ramp, garage and bulk
cargo work while standing or driving outside. It must leave position, vehicle,
hitch and task untouched and retain existing server-side range/ownership/cargo
checks. Browser: open outside at a garage, service the tractor with carried Steel,
buy and hitch a trailer, buy Fuel into it, then use normal E to enter and park the
rig. The nearby parked rig must also remain usable by the trailer trade controls
already shown in an entered shop; physics must not treat it as following the
walker. Missing outdoor control and rejected post-entry trailer trade are recorded
red before implementation. Keep remote trailer access refused.

Corrected performance gate passes in 3.1 minutes: low active/parked p95
37.4/36.8 ms, normal active/parked 18.9/19.3 ms. Both parked cases submit all 21
models, contain over 200 sampled frames, have no browser errors or frames over
100 ms, and stay within the matched 10% p95 limit. Visible-fleet screenshots and
metrics are in `output/parked-vehicles/performance-{low,normal}-{active,parked}`.
The final fuel rescue recording passes visual review with a full visible walker,
empty cab and unobstructed mount. These gates pass; outdoor service compatibility
is the remaining release blocker. Nothing has been released or announced.

### Item 18 — Final local verification, 2026-11-06

Outdoor compatibility now passes: 64 focused parked-vehicle, trailer, vehicle
service and player-aid tests; the desktop browser services a tractor, buys and
hitches a trailer, buys Fuel into it, enters normally and uses the butcher ramp.
The mobile browser opens outdoor services without changing position, vehicle,
inside state or task, then completes normal entry and controller controls. Both
browser checks pass (22.6/33.7 seconds). Video review confirms the service and
butcher results. Nearby parked-trailer trades pass and remote access is refused.

All item criteria now pass, including the repaired 40-test regression batch,
20 migration/simulation follow-ups, 43 persistence/paint/rules checks, 16
renderer/mount checks, desktop/mobile arrivals, reconnect, fuel rescue and helper
refuelling. The corrected visible-fleet performance comparison passes as recorded
above. Evidence remains in `output/parked-vehicles/`; unsuccessful recordings are
not used in the announcement. Final `npm run build` (including TypeScript),
`npm run build:website` and `npm run check:website` pass. The website check covers
four widths, navigation, gallery interactions and WebGL/no-JavaScript fallbacks.
Prettier runs over all 65 changed files; `git diff --check` is clean.

Prepare version 0.131.0 with an empty Unreleased section retained, updated player
and world-builder docs, README and release notes. Commit and push this complete
slice, deploy the exact pushed SHA with the established backup scripts, verify
public health/assets/website read-only, then publish the reviewed two-screenshot
bot announcement. Mark done only after those operations succeed.

### Item 18 — Done and live, 2026-11-06

Commit `b1e4647a0a78e59b49b182636c6ebb7bc83b90a8` is pushed to
`backlog-implementation` (GitHub SHA verified) and matches the running server.
Game health, loaded client, map worker and website report 0.131.0; the read-only
live browser has no errors and existing gallery images retain their expected
hashes. The deploy script's initial public check received a startup 502; the
service subsequently answered 200 and all independent public checks passed.
Database backup: `/var/lib/aclone/backups/pre-deploy-20261106-171253.sqlite`.
Website backup: `/var/backups/aclone-website/site-20261106-171407.tar.gz`.

The bot announcement and both screenshot embeds were posted and re-read:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568388161174904922
Evidence: `output/release-0.131.0/`. No player grants, main push or PR.

Progress: all 20 shipped claims assessed (17 matches, three gaps fixed); **16 of
29 eligible Planned sections complete**, plus the cargo scale follow-up. Next is
item 19 in its recorded internal order: read-only settlement/economics survey,
then persistent alternate dirt routes and ford routing before paving or bridges.
Piloted spaceflight remains excluded.

### Priority fix — New-pilot world selection (2026-11-06)

Pause item 19 without including its unfinished road changes in this release.
Completion criteria, recorded before production edits:

- Run `TEST_GPU=1 node --import tsx node_modules/@playwright/test/cli.js test tests/browser/pilot-entry.spec.ts`.
- Register a new pilot at 1440 × 900, 390 × 844 and 320 × 568. Without scrolling,
  the full Puddlewick landing button must fit in the viewport and land in the world.
- Put the built-in Puddlewick first (including after ownership changes) even when the directory is reordered;
  label it **Main world — Recommended for new pilots**. Label player-created
  worlds distinctly, including one also named Puddlewick. Preserve other worlds.
- Keep the complete existing rules available behind an initially closed disclosure;
  keep landing above the disclosure and galaxy navigation after world choices.
- Show an explicit empty-directory message with world creation still available;
  explain refresh failures while retaining the last known world list.
- Check browser errors, horizontal overflow and the real landing flow. Inspect
  desktop/phone screenshots. Run relevant galaxy/server tests, `npx tsc --noEmit`,
  and Prettier on changed files. Commit, push, deploy and announce the verified fix.

Red test confirmed before production edits: the 1440 × 900 browser measured the
landing button bottom at 4,989 px. The live directory confirms Puddlewick has an
assigned owner, so identify the built-in main world by its permanent ID, not by
owner or display name.

Verification: all five browser checks pass, including actual new-pilot registration
and landings at all three sizes, name-collision/ownership/reordered-directory
coverage, full rules disclosure, and empty/503 directory states. Screenshots
`output/pilot-entry/welcome-desktop.png` and `welcome-phone.png` were inspected;
the phone layout omits the cramped credits/ship box. The 17 targeted galaxy,
account and server tests pass (`npx tsx --test tests/galaxy.test.ts tests/server.test.ts tests/accounts.test.ts`).
Release evidence is under `output/release-0.131.1/`; deployment and announcement
must be verified before marking this fix done.

`npx tsc --noEmit` is clean, changed files pass Prettier, and
`npm run check:website` passes its four-width navigation/gallery checks. The
recorded first-flight walkthrough was reviewed and confirms both directory
layouts followed by arrival in Puddlewick. Prepare patch release 0.131.1.

### New-pilot world selection — Done and live, 2026-11-06

Release commit `7ba3451acca945fbc6fddd86147ba7b56e7e2230` is pushed to
`backlog-implementation` and deployed. The public game, client/map-worker assets
and website report 0.131.1, with no browser errors. Database backup:
`/var/lib/aclone/backups/pre-deploy-20261106-192331.sqlite`; website backup:
`/var/backups/aclone-website/site-20261106-192446.tar.gz`.

The bot announcement and phone screenshot were posted and re-read:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568421114177134808

Follow-up priorities requested during release: add an obvious **Find tractor**
control that sets the navigation arrow, then make human/AI pilot name tags smaller
and proximity-based, with world-builder controls. Preserve the pending item 19
road work and resume it after these fixes. No player grants or manual live-world
edits were made.

### Priority fix — Find tractor (2026-11-06)

Before production edits, require a visible **Find tractor** shortcut on the desktop
HUD and in Menu, Inventory and phone Actions. It sets the existing navigation
arrow and distance to the nearest owned parked tractor, including its garage
when stored. It must work while walking, using another vehicle, indoors or busy;
it must never choose someone else's tractor or the last-used aircraft. Preserve
world map-access and vehicle-persistence rules. Explain no tractor/currently
driving/map-required states without replacing an existing waypoint or moving a
vehicle/player. No new gameplay limits or duplicate rule defaults are needed.

Run `npx tsx --test tests/parking-ui.test.ts tests/waypoint.test.ts` and
`TEST_GPU=1 node --import tsx node_modules/@playwright/test/cli.js test tests/browser/find-tractor.spec.ts`.
Browser steps: find a distant tractor from the desktop shortcut; check the visible
arrow/distance and unchanged player/tractor coordinates; repeat through phone
Actions, test map-required and empty states, and inspect screenshots. Keep the
existing parked-vehicle/refuelling flow green. Require clean TypeScript and
Prettier, then commit, push, deploy and announce this separate patch.

Red browser test confirmed the missing desktop Find tractor button after the real
world finished loading; the click timed out on the absent shortcut.

Find tractor verification: ten relevant parking/waypoint tests pass, including
owned-versus-foreign records, aircraft exclusion, multiple tractors, stored
positions, busy/indoor/other-vehicle access and persistence-disabled behavior.
The browser flow passes desktop and phone navigation at 212 m, unchanged physical
positions, map-required and empty states, and preservation of an existing waypoint
when navigation cannot be set. The initial distance assertion used a space before
`m`; it was corrected to the existing HUD format (`212m`), retaining the exact
expected distance. Desktop and phone screenshots were inspected. Evidence is in
`output/release-0.131.2/`; name-tag work remains next, before item 19.

### Find tractor — Done and live, 2026-11-06

Release `729abaa023e56f1062f7661ab8203fba5ad27cfa` is pushed and deployed as
0.131.2. TypeScript is clean, changed files pass Prettier, and public health,
client/map-worker assets and website were verified with no browser errors.
The reviewed desktop/phone screenshots show the actual arrow and 212 m distance;
empty-state and waypoint-preservation evidence comes from the passing tests.

The bot announcement and screenshot were posted and re-read:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568423446700884100
Website backup: `/var/backups/aclone-website/site-20261106-193438.tar.gz`.
Full backup and verification records: `output/release-0.131.2/`.

### Priority fix — Quieter proximity-based pilot name tags (2026-11-06)

Before production edits, require human and AI pilot tags (including custom models)
to use a smaller single-line name, with no large PILOT heading or pointer. Preserve
AI identification and depth occlusion. Fade by distance from the player, not the
camera; default to full opacity through 20 m, fade out by 40 m, 60% model scale,
80% opacity and a maximum 24 CSS-pixel height. Hide tags in scenery view.

Keep those defaults only in `data/settings.json`. Expose enabled, range, fade
start, scale, opacity and maximum height in World Builder; validate finite bounds
and fade-start ≤ range atomically, preserve old-save defaults, and round-trip the
rules through saved worlds and exported designs. Building signs remain unchanged.

Commands: `npx tsx --test tests/labels.test.ts tests/pilot-labels.test.ts` and
`TEST_GPU=1 node --import tsx node_modules/@playwright/test/cli.js test tests/browser/pilot-labels.spec.ts`.
Browser steps: view nearby human/AI/custom-model pilots, compare fading at 30 m
and hidden tags at 40 m or farther, change the range/opacity/switch in F10 Rules,
verify the all-hidden state and rejected invalid settings, and inspect desktop
and phone screenshots. Require clean TypeScript/Prettier and relevant regressions;
then commit, push, deploy and announce independently of unfinished item 19.

Name-tag verification: the pre-change test failed on the oversized two-line badge.
All 22 relevant label, parked-render and ruleset tests now pass. They cover fade
boundaries, disable/zero-opacity/reappearance, custom parent scaling in the pixel
cap, unchanged sign depth behavior, atomic validation, old-save defaults and
save/export/import round trips. The final browser flow passes nearby human/AI
and custom-model tags, 30 m fading, distant hiding, scenery view, desktop/phone
layouts, live F10 changes, invalid-range rejection and the all-hidden state.
TypeScript is clean and changed files pass Prettier. Screenshots were inspected;
labels sit closer to heads/vehicles and keep the AI suffix. Evidence:
`output/release-0.131.3/`. Prepare patch release 0.131.3.

### Quieter pilot name tags — Done and live, 2026-11-06

Release `9a2f8216947b80279b799bdebb55f81932699d3b` is pushed and deployed as
0.131.3. All 22 relevant tests and the desktop/phone browser flow pass; TypeScript,
Prettier and the production build pass. Public health, released client/map-worker
assets and website were verified with no browser errors. The reviewed screenshots
show compact human/AI labels and a fainter distant tag. Exact range, opacity,
custom-model and persistence claims are supported by tests.

The bot announcement and screenshot were posted and re-read:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568426832901181460
Database backup: `/var/lib/aclone/backups/pre-deploy-20261106-194642.sqlite`.
Website backup: `/var/backups/aclone-website/site-20261106-194757.tar.gz`.
Evidence: `output/release-0.131.3/`. Item 19 road work remains unreleased.

### Priority performance check — Walking/driving pauses, 2026-11-06

Henry reports that a new player on a desktop gaming PC saw lag and loading that
could not keep up while walking/driving. No flying was involved. Keep the road
backlog changes unreleased while checking the deployed client separately.

A read-only current world snapshot (86 buildings, 2,003 grown roads, 83 retired
segments) was replayed locally against released 0.131.3, in performance mode on
NVIDIA Quadro M1200 hardware. The rendering-only path uses scripted motion; it is
not proof of the player's exact session, network conditions or collisions.
Walking: 25 s, p95 frame interval 46.7 ms, maximum 85.3 ms. Driving: 45 s,
p95 52.8 ms, maximum 245.4 ms, two intervals over 100 ms. Nearby terrain remained
present throughout both paths, with no browser errors. CPU sampling identifies
repeated road-key generation/filtering in the frame's tyre-track path as a major
avoidable cost, including in dry weather. The full road list is only used there
to suppress snow tracks on roads. Evidence: `output/player-travel-20261106/`;
private world JSON must remain untracked and unpublished.

Before production edits, add a real-browser regression with a mature road list:
after loading settles, dry walking and driving must perform no road-network
queries solely for tyre tracks; snowy driving must still query roads and retain
existing snow-track behavior. Run it red on the released code. Then condition
the lookup on snow, run affected track tests, TypeScript and Prettier, and repeat
the same hardware/rendering path. Require no lost nearby terrain or browser
errors and no material p95 regression. Do not claim all reported lag fixed.
Commit/push/deploy this independent patch and announce measured results with a
gameplay screenshot only after verification.

### Recorded movement report — Captured, diagnosis still open, 2026-11-06

Henry demonstrated forward/left/right walking on the live game. The requested
60-second desktop recording is saved at
`output/player-travel-20261106/henry-walking-input-demo.mp4` in the primary checkout
(1920 × 1080, 30 FPS). Keep this private diagnostic recording out of Discord.
Reviewed observations: the avatar pauses while the camera still turns; sampled
HUD readings show 21–29 FPS and ping rising from 131 ms to 1,305 ms and then
2,871 ms. CONNECTING remains visible despite state updates. The recording has
no key overlay, so exact input-to-response timings and a definite teleport are
not established. Recording overhead may affect FPS.

Code inspection: LocalPrediction stops advancing after 500 ms without a fresh
state and resets after a 1,500 ms receive gap. Delayed updates could therefore
explain stop/catch-up behavior, but displayed ping alone cannot distinguish a
busy client, server stall or network delay. The welcome response is sent after
the initial snapshot through a buffered-send guard; investigate whether a large
initial snapshot drops welcome before interpreting CONNECTING as reconnections.

The local full-game keyboard replay is **invalid**, not a passing movement test:
loading resumes after the readiness predicate, and the player does not move.
An explicit movement assertion now rejects that run. Do not use its ping or
correction figures to claim the live issue reproduced or passed. Next: make the
local replay wait for stable usable controls, capture input send/ack and frame
intervals, and reproduce the delayed-update behavior with deterministic tests
before changing movement production code. No movement fix has been deployed.
The separate dry-weather tyre-track microfix remains unverified and unreleased;
its browser green run was interrupted for this recording.

### Priority responsiveness repair — Completion criteria, 2026-11-06

Keep the unfinished road backlog isolated. Capture a stable, fully loaded local
copy of the mature world, replay forward 5 s / forward-left 1 s / forward-right
1 s / forward 10 s, and record actual sent controls, authoritative positions,
rendered positions, frame gaps and ping. A run without actual movement is invalid.
Compare baseline and repaired runs on the same hardware, without concurrent tests.
Require no browser errors, no missing nearby ground, prompt response to each
control change and no unexplained stop/catch-up behavior on the local connection.
Use delayed-link tests to distinguish normal latency from accumulating stale
controls or movement corrections. Do not claim the entire live report resolved
from a render-only benchmark or a successful health request.

Handshake hypothesis criteria before production edits: a real compressed
protocol-4 WebSocket entering a mature world must receive exactly one welcome,
the correct world state, and a later pong. The state must arrive before welcome
so the existing world/galaxy UI routing stays correct. Test with a first snapshot
larger than 1 MiB; show that missing welcome (not a socket failure) fails the test.
Browser: saved-world login reaches CONNECTED, stays in the world and accepts
walking controls. Verify login without a saved world and an invalid saved world
still reach the directory. Keep state backpressure/ACK behavior intact. Run
relevant socket/input/slow-network tests, TypeScript and Prettier.

Live 15 s CPU profile (2 ms sampling, inspector closed afterwards, no restart)
confirms repeated townRoads filtering/key formatting/runway exclusions dominate
NPC movement and parking checks. Service stays active. A complete local world
advance profile spends 3.18 s in 300 Puddlewick ticks (p50 10.18 ms, p95 14.05 ms),
mostly the same road work. This is unrelated to visual complexity.

Road-query repair criteria before production edits: reuse the unchanged filtered
network across simulation ticks and immutable client snapshots; avoid reformatting
road keys on repeated reads. Preserve exact road objects/order, retired segments,
runway exclusions, starter-layout switches and world isolation. In-place append,
replacement, removal, endpoint/width edits, retired-list edits, airfield changes
and landscape replacement must invalidate immediately. No world/save mutation
or persisted cache. Add a failing mature-world regression, run road growth,
road alignment, landscape, driving and parking tests after the fix, and repeat
local CPU and full browser movement profiles. Re-profile live after deployment;
do not infer improvements solely from unit timing.

The unchanged released source also fails the existing 64 kbit/s protocol-3
slow-link test: state age grows to 2.81 s. This is a confirmed pre-existing gap,
not grounds to loosen its <2 s acceptance limit. A fixed three-frame window
queues too much data for such clients. Before changing transport, add a
clock-controlled regression: a delayed ACK reduces that recipient to one pending
snapshot; fresh ACKs restore the existing fast-client window; invalid/old ACKs
and world switches cannot release the wrong baseline. Retain the existing slow
TCP test unchanged except for diagnostic failure text, and run it independently.
Also exercise current protocol 4 under the same shaping. These are transport
scheduling limits, not new world gameplay rules.

### Responsiveness checkpoint — Deployed 0.131.4; remaining tail-latency investigation open

The road-query regression failed on repeated preparation before the change;
all four cache/edit tests now pass. Twenty related road/alignment/landscape tests,
132 movement/parking/scenery/snapshot/prediction regressions, five transport tests,
and the real-socket handshake/input tests pass. The isolated slow-link checks
pass for protocols 3 and 4 with maximum checked state ages 1.15 s and 1.10 s;
unchanged released code failed at 2.81 s. Tests retain their original <2 s limit.

Browser snow/mud tracks and dry road-query checks pass on final code. Saved-world
entry reaches CONNECTED and the keyboard replay moves the actual local/server
player. No-saved-world and invalid-saved-world directory checks pass in a separate
browser test. The first combined diagnostic incorrectly reapplied its saved-world
fixture on every reload; that harness error is recorded, not an application failure.

Actual 17 s keyboard sequence plus release: walking has p95 frame interval 38.6 ms,
maximum 60.6 ms, ping at most 27 ms; driving (with video recording enabled) has
p95 39.1 ms, maximum 52.2 ms, ping at most 11 ms. Neither has a >100 ms render gap
or browser error. The driving video is reviewed separately. These are local
network results; they do not promise the same ping over the internet.

The identical render-only terrain path retains nearby ground with no errors:
walking p95 46.7 -> 45.0 ms, max 85.3 -> 61.7 ms; driving p95 52.8 -> 50.0 ms,
max 245.4 -> 135.3 ms, >100 ms gaps two -> one. Its full-world cloning costs
roughly 10 s across the 70 s test, unlike actual compact network updates. Keep
the remaining short hitch visible in evidence; do not claim perfect rendering.
The separate simulation benchmark drops Puddlewick CPU time from 3.18 s to
1.36 s per 300 ticks (57% less). Recheck live CPU after deployment.

Evidence is under `output/player-travel-20261106/` and `output/release-0.131.4/`
in the managed worktree. Private snapshots and Henry's desktop video stay local.
Unfinished road-building backlog work remains in the primary checkout and is
excluded from this maintenance release. Deploy only the verified release commit,
check public assets and server health, then post the authorized bot announcement
with a local gameplay screenshot and record the live measurements.

The first driving route met the workshop wall late in the replay, so it could
not demonstrate the entire requested final straight. A second full replay starts
on the airfield with a clear route: actual controls 5 s forward, 1 s left,
1 s right, 10 s forward, then release. It passes continuous movement throughout
the final straight (no collision masking a stall), CONNECTED, zero browser errors,
p95 frame interval 45.4 ms, maximum 78.6 ms, zero intervals above 100 ms.
Recording and profiling are enabled; peak local ping is 184 ms, ending at 2 ms.

Release `998cb496e03fcff1f6bbd204475aa600fc628805` is pushed to
`backlog-implementation` and deployed. Public health, version, matching built
client (`index-5Qr0FV-u.js`), map worker, website and building gallery pass;
read-only public browser verification has no errors. Database backup:
`pre-deploy-20261106-222342.sqlite`; website backup: `site-20261106-222427.tar.gz`.
The completed runway video review finds steady movement through both turns and
the full final straight, continuous ground, no visible rubber-banding, and
release deceleration to 1 MPH at the end. Exact input timing comes from the
instrumentation, not inference from the video.

Live 15 s profiles: idle samples increase from 0.14% to 54.47%; repeated road
formatting/filtering no longer dominates. A separate 30.6 s stability check keeps
the same PID and restart counter, uses 49.1% of one CPU core, and returns all
60 health requests successfully (median 1.96 ms). However p95 is 128.8 ms and
maximum 1,088.3 ms. This confirms a major sustained-CPU improvement but leaves
long-tail latency unresolved. Continue that investigation before claiming the
reported responsiveness problem fully fixed.

Operational diagnostic incident: closing the first post-deploy inspector through
a dynamic import in Runtime.evaluate raised ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING
and caused one automatic service restart. The service recovered; inspector port
9229 closed. This is the diagnostic cleanup command, not a production-code error.
Replace the diagnostic with synchronous process.getBuiltinModule('node:inspector')
and prove in a separate local child process that cleanup closes only the inspector
and leaves the process alive before another live capture. That local check passes.
Keep the failed command and incident in evidence; do not claim a restart-free audit.

The 45 s follow-up profile uses the verified cleanup method: PID 360550 remains
active, restart count stays 1 and inspector port closes. Correlated health/CPU
samples identify further main-thread stalls in NPC ground-route construction
(about 163 ms in the longest sampled request) and synchronous checkpoint commits
(about 184 ms in that same NPC tick; periodic saves also block roughly 100–180 ms).
These are confirmed separate causes to address; do not assume the CPU cache repair
eliminates them. The one-second request in the earlier interval was not profiled,
so its exact cause remains unproven.

The 0.131.4 bot announcement and screenshot are posted and read back successfully:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568467499702292511
It explicitly states that occasional longer delays remain under investigation.

### Responsiveness follow-up — NPC planning and checkpoint stalls

Before production edits, require deferred NPC ground-route construction to return
without building a grid, then advance in bounded slices shared by all NPCs in a
server tick. Player movement/network processing must get control between slices.
A route still uses the exact existing collision/water/grade/arrival behavior;
compare deferred and synchronous waypoint results, exercise blocked and already
arrived destinations, and invalidate unfinished work when geometry changes.
No motion may use a partial path. Run an initially failing regression proving
construction does no terrain sweep, actual slice timings remain below 100 ms on
a mature-sized fixture, and waiting/failed routes return idle controls safely.
Run relevant NPC navigation, solid scenery, walking, parking and spaceport tests,
then the actual browser control replay with no errors or missing terrain.

For persistence, first prove the existing periodic batch performs redundant durable
commits. Preserve transaction rollback, pending public messages, ledger rows and
playtime on save failure and retry. Never reduce SQLite synchronous durability or
acknowledge player actions before their required save. Design the smallest safe
change only after reviewing those invariants; do not trade data loss for speed.

Follow-up red/green evidence: deferred construction initially performs 20,897
terrain reads before returning; the blocked route throws synchronously and a
flood edit retains an obsolete path. New regressions now pass for deferred work,
shared budget, exact waypoint parity, ordinary-physics arrival and edit failure.
On the private mature-world copy (2,003 roads, 86 buildings), the unchanged cold
route takes 247.7 ms. Deferred constructors take at most 0.21 ms; five routes
share slices with a measured maximum 15.12 ms and identical waypoint/error results.

Checkpoint regression initially observes five write-bearing commits for five
worlds (six COMMIT calls including empty playtime), ledger trimming before an
outer rollback and unreleased chat buffers after a nested commit. Tests now prove
one write-bearing periodic commit, one for multiple resident checkpoints, retained
FULL durability, successful retry after failed COMMIT/outer rollback, isolation
of rolled-back inner savepoints, and preservation of events added after a save.
61 related persistence/NPC/chat/playtime/federation tests pass; 61 navigation,
collision, snow and parking tests pass. TypeScript is clean.

The first concurrent navigation suite exceeded the 100 ms slice gate under
competing test processes. The unchanged gate passes with relevant suites run
serially and in the mature-world timing run; keep both logs. A separate existing
spaceport design-export test fails because its generated access path exceeds the
schema's 128-point limit. It reproduces using released navigation source; this
patch changes neither the exporter nor that schema. The actual spaceport
navigation test passes in both directions. Record that export gap for a separate
repair; do not hide it or call the complete spaceport suite green.

The final full-game local driving replay for 0.131.5 passes the uninterrupted
5/1/1/10-second input sequence and release, CONNECTED, actual player movement and
zero browser errors. With video/profile capture enabled: 552 frame intervals,
p95 51.9 ms, maximum 83.9 ms, no interval over 100 ms, maximum ping 60 ms.
This is a local connection; live-server latency needs its own post-deploy check.
No rendering behavior changed in this follow-up. Evidence is under
`output/responsiveness-followup/` and `output/release-0.131.5/`.

### Responsiveness follow-up — 0.131.5 deployed; daily road stall confirmed

Release 77a649423749f0ffb9fb922409a952f487d4a718 is pushed and live with matching
public assets (`index-vekHwjLB.js`), website, health and clean browser entry.
The final local video review confirms continuous driving and release deceleration,
with no visible collision, rubber-banding or missing terrain. A 45-second live
profile leaves PID 361105 and restart count 0 unchanged and closes its inspector.
378 health samples: median 1.47 ms, p95 24.06 ms, maximum 4,934.98 ms.
The worst event is now directly attributed to daily growRoads: 4.78 seconds inside
advance, including 3.87 seconds in roadComponents. NPC planning and disk batching
repairs are live, but overall responsiveness remains open because of this stall.

Next repair criteria, before production edits: road component discovery must skip
far-away pairs, preserve exact connectivity (crossings, width-based touches,
degenerate segments, duplicate references), and preserve deterministic group and
road order used by planners. Add a failing mature-network work-count regression,
compare against the existing exhaustive algorithm on mixed geometry, and run
road growth/project/alignment/navigation tests. Replay the copied mature world at
its next game-day boundary: require the growth call to return within 100 ms
without changing generated roads, project or daily allowance. If eliminating
quadratic comparisons is insufficient, retain that gate and make planning yield;
do not claim the periodic freeze resolved based only on a component microtest.
No ford behavior, road gameplay settings or unfinished item-19 content belongs
in this independent repair.

0.131.5 checkpoint slice: **Done and announced**, with the broader performance
investigation continuing. Verified bot post and screenshot:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568471928954556558
The announcement explicitly identifies daily road growth as the next unresolved
stall rather than claiming every hitch is fixed.

The component regression fails at 8,020,012 exact distance calls on 2,003 separated
segments. A counter-only harness replaces the initial call-recording mock, which
exhausted its heap by retaining millions of call records; that harness failure is
not application evidence. Spatial candidates pass the exact-connectivity/order
comparison and cut the microtest to 10.5 ms. However mature-world daily growth
still takes 809.5 ms (down from 4,839.7 ms), above the unchanged 100 ms gate.
Its persisted result matches after normalizing omitted undefined JSON fields.
Proceed with resumable planning, retaining the gate for every slice and preserving
the eventual exact road/project/daily-allowance result. New red tests require
unfinished work to persist through restart and invalidate on a flood edit before
laying any road. Keep route generation behavior unchanged; only schedule its work.

Scheduling regression evidence: the mature-world isolated replay returns in
bounded slices and preserves the exact persisted result. The first full-game
5/1/1/10-second browser replay nevertheless leaves the daily survey pending.
A second instrumented replay shows no geometry changes, but 3.8 seconds in
roadGeometryKey: serializing almost 1 MiB of geography consumes the planning
budget before the generator can advance. Add a failing compact-key regression
for 5,000 resources, retain in-place edit detection without revision bumps, and
replace repeated resource coordinate formatting with checked scalar snapshots.
Keep the failed replay evidence in output/release-0.131.6/failed-survey-replay.
Do not call the browser criterion passed until construction finishes during the
actual driving replay.

Also noticed during this audit: the released NPC deferred-route key includes
settings.time. Confirm with a regression using a moving game clock after the
current road slice passes; unfinished NPC planning must survive ordinary clock
updates while still invalidating actual terrain/policy edits. Treat this as a
separate logical correction, not an unrelated backlog feature.

The compact-resource regression now passes, including in-place location and kind
changes. Mature-world growth completes with the exact old saved result in 102
slices, maximum 57.85 ms (original uninterrupted call: 4,839.7 ms).
The actual full-game driving replay now completes the road day after 8.48 seconds
of background work while controls continue: 556 render intervals, p95 48.4 ms,
maximum 78.3 ms, none above 100 ms, maximum local ping 44 ms and no browser errors.
18 road/scheduler tests and 23 related alignment/cache/NPC/checkpoint tests pass.
The restart regression saves and reloads through SQLite, not just a JSON clone.
TypeScript caught a test fixture referencing a nonexistent building cash field;
the fixture now changes actual stock and the clean typecheck is rerun.

Both affected browser checks pass: distant hill-town roads/scenery and all
mature-network map segments/widths. Final TypeScript is clean; the release build
and formatting are verified before commit. Daily road work is ready as an
independent 0.131.6 maintenance slice; unfinished item 19 remains excluded.

0.131.6 road slice: **Done, pushed, deployed and announced**. Release 0220400
serves index-DZ0vHT4x.js; public game, map worker, website and gallery checks pass.
The reviewed video shows continuous motion, both turns and release deceleration,
with no visible rubber-banding or terrain gaps. Post-release 45-second live health
capture: 415 requests, median 1.58 ms, p95 40.04 ms, maximum 134.22 ms.
PID 361934 and restart count 0 are unchanged; inspector closes. This interval
does not include a daily boundary; do not present it as that proof.
Verified announcement:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568477106361602078

NPC clock follow-up criteria: under bounded planning slices, increment both game
time and displayed time each tick; planning must complete with the exact same
waypoints as synchronous planning. Keep the existing blocked, already-arrived,
edit-invalidated and shared-budget tests green, and confirm arrival through real
physics while the server clock advances in the browser replay. The first timing-
dependent test eventually squeezed the short warmed route into one tick; use a
deterministic work clock to ensure the route actually spans ticks. That regression
fails with no path after 1,000 slices and passes after excluding settings.time
from the geometry key. Other settings and water/terrain geometry remain in the key.
12 navigation tests pass. Run the actual-clock browser flow, typecheck and format
before releasing this independent correction.

The combined tractor/NPC replay proves the NPC arrives with the real clock
advancing, but the tractor then hits scenery after its turns, so it is not proof
of the final straight. The final on-foot replay preserves the full requested
5/1/1/10-second sequence and release: CONNECTED, no errors, 546 render intervals,
p95 54.3 ms, maximum 85.0 ms, none above 100 ms. Maximum local ping is 142 ms;
retain that outlier rather than promising zero latency. The NPC waits across 42
planning ticks, then arrives in 5.90 seconds using ordinary physics; road day
5503 completes to 5504 during the same replay. Evidence:
output/release-0.131.7/. Final build/typecheck/format precede release.

0.131.7 is pushed and deployed (9a63c28), with public index-B6y8EUcB.js,
website, worker, gallery and clean browser checks. The final reviewed walking
video shows continuous travel and both turns; NPC arrival is established by
server data, not inferred from the distant pedestrian. Verified announcement:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568479104913637457

Live daily-boundary verification completes road day 5512 to 5513, retaining the
same PID 362416 and zero restarts. 238 health requests over 52.09 s: median
1.76 ms, p95 54.29 ms. The first request takes 1,942.82 ms; all subsequent requests
are at most 201.52 ms. Keep the first outlier visible; its cause is not established.
A further 45-second CPU capture confirms recurring 200–313 ms delays in SQLite
saveWorld writes/commits. The five-second road stall is repaired, but persistence
latency needs another measured pass.

Before changing persistence: use a file-backed WAL regression with a mature-sized
world record to detect dirty-page writes before the outer transaction commits.
Prove the current page cache spills within the transaction, then test a bounded
larger cache without reducing FULL synchronous durability. Preserve rollback,
messages, ledger retry, save/load and online backup behavior. Measure commit
latency on a disposable database; if the cache change does not address the
confirmed cause, do not claim it fixes live stalls. Do not change the live DB
manually or disable durability to satisfy performance thresholds.

The page-cache experiment passes the spill/rollback/FULL tests plus 22 server/NPC
persistence tests, but does not establish a responsiveness improvement. The first
shadow database was under /tmp (tmpfs on the server); it cannot measure disk-sync
latency. Repeat against an online backup of the full live database, in a private
/var/tmp directory on the database's disk, removing only that disposable directory.
That faithful run shows default/larger-cache medians 71/65 ms, p95 155/358 ms,
and cold outliers 1361/1119 ms. Do not release the cache increase by itself.
Measure background PASSIVE WAL checkpointing separately, preserving FULL commit
synchronization and existing transaction ordering. Evidence remains private in
output/checkpoint-cache; no live DB pragma or game-state edits are used.

The second full-database experiment compares 40 saves per configuration on the
actual disk. Default cache/automatic checkpoints: median 70.92 ms, p95 107.56 ms,
max 168.32 ms. Larger cache alone: median 65.30 ms, p95 166.96 ms, max 697.76 ms.
Larger cache plus a separate PASSIVE checkpoint worker: median 56.36 ms,
p95 126.07 ms, max 1255.03 ms. Preserve all cold outliers; these experiments do
not demonstrate a reliable reduction in worst-case input blocking. A first
worker harness failed because it inherited --input-type=module while using
CommonJS require; the corrected harness clears execArgv. Both harnesses touched
only disposable copies, which were removed. No worker or pragma experiment is
live. Server PID 362416 and restart count 0 remain unchanged.

**Persistence slice stopped at the unmet latency criterion.** The 16 MiB cache
change and its passing spill/rollback regression remain uncommitted in the
managed worktree for investigation, not in the deployable branch. Do not delete
or weaken that regression, and do not publish the cache change as a lag fix.
FULL commits themselves can block; moving only WAL checkpointing is insufficient.
A future asynchronous writer must address all writers and preserve atomic account,
world, NPC, ledger and public-chat changes, bounded queues, error/retry handling,
shutdown and backup consistency. Simply starting a second writer is unsafe as a
performance solution: the main thread's BEGIN IMMEDIATE can still wait for its
write lock, and a stale background snapshot must never overwrite a newer action.
No further backlog item starts while this acceptance failure remains unresolved.

### Resume persistence — asynchronous periodic saves, 2026-11-07

Henry requested continuation. Retain the performance priority unless he chooses
to resume roads in the pending priority question. Start with periodic checkpoints,
without claiming that every synchronous NPC/account write has been removed.
Completion criteria before production:

- Use a separate SQLite connection holding a real write lock for 400 ms. A
  periodic checkpoint must wait without freezing a 10 ms heartbeat or movement
  input; no heartbeat gap above 100 ms during the blocked save. The baseline
  synchronous save must reproduce the event-loop stall.
- Save all worlds, public messages, ledger and playtime atomically, with FULL
  durability. Keep late messages/ledger events queued; failed writes must retain
  pending data for retry. Allow only one in-flight checkpoint, with no unbounded
  snapshot queue and no stale save overtaking newer player/account/NPC writes.
- Other database consumers must await the checkpoint asynchronously. Input,
  acknowledgement, ping, simulation and snapshot delivery continue. Exercise
  login/actions/disconnect, NPC model completion, shutdown and online backup
  while the checkpoint is delayed. Preserve existing nested transaction tests.
- Run focused persistence/server/account/NPC regressions, clean TypeScript and
  changed-file formatting. Repeat the actual walking/turning browser flow while
  a checkpoint is delayed; retain every measured outlier. Compare a disposable
  full-database run on the live disk before any release. Do not include item 19
  or the unproven page-cache-only change in this slice.

The locked-writer regression reproduces a 434.3 ms main-thread stall. The worker
passes it without weakening the 100 ms heartbeat gate. Additional regressions
cover atomic multi-world rollback/retry, late history, overlapping-save refusal,
backup ordering, idle worker replacement, delayed NPC completion, reconnects and
shutdown. The reconnect test first fails because deferred old-session sign-off
marks the replacement offline; keep the old peer discoverable until sign-off and
skip movement for closed sockets. Shutdown initially throws with a save pending;
its draining method now waits for commit and worker exit.

Verification for the independent 0.131.8 slice: 34 focused account/HTTP/NPC/chat/
checkpoint tests pass, followed by 16 final persistence/server tests after lifecycle
changes, plus the delayed-NPC regression. TypeScript is clean. The actual browser
walking/left/right/final-straight replay has 554 frame intervals, p95 51.3 ms,
maximum 70.1 ms, none above 100 ms, maximum local ping 60 ms and no browser errors.
Six checkpoints each wait 558–564 ms behind deliberately held SQLite write locks.
NPC route arrival and daily road work also complete during the replay.

A 40-save-per-variant disposable online backup on the server's real disk measures
heartbeat p95/max 61.0/142.6 ms synchronously versus 22.1/78.6 ms with the worker.
FULL sync and automatic WAL checkpoints are retained. The previous cache-only
experiment and its regression remain preserved in the stash named "Preserve
unproven page-cache experiment and regression"; neither is part of this release.
All benchmark copies are removed. No live state or player grants are changed.
Production build, final formatting, video review and live verification precede
completion. Individual action and NPC saves remain synchronous; do not equate
this periodic-save improvement with elimination of every server pause.

Production build and changed-file Prettier checks pass. The reviewed 18.96-second
browser clip shows continuous travel, opposing turns and a clean stop without
visible rubber-banding or terrain gaps. It begins already moving, so it does not
prove initial keypress latency. Live deployment and verification remain pending.

### Periodic saves — Done and live, 2026-11-07

Release 0.131.8, commit `52d81ba3339beab73276d3cc07a9fb6a4b981924`, is pushed
and matches the live checkout. The game health endpoint, public client and website
report 0.131.8. Read-only browser checks pass with no errors, including map-worker
availability and the building gallery. The deployment takes an online backup at
`/var/lib/aclone/backups/pre-deploy-20261107-192154.sqlite`.
The bot's screenshot announcement is verified:
https://discord.com/channels/1562183434254680175/1565527790785404968/1568783135905423390

The 45-second live profile records 413 health requests: median 1.489 ms,
p95 39.305 ms, maximum 732.788 ms, three above 100 ms. The largest pause is
NPC `choices`/`adaptiveChoices` preparation, including cargo feasibility and
water-site/chain surveys. Two 125.843/127.417 ms requests overlap resident
memory/action checkpoint work. These remain open; the isolated periodic-save
criteria passed, but overall responsiveness has not. Service PID 370797 and
restart count 0 remain unchanged during profiling; inspector port 9229 is closed.
Evidence stays under `output/release-0.131.8/` and `output/async-checkpoint/`.

### NPC decision preparation — criteria before production, 2026-11-07

Reproduce the live choice-generation pause on an isolated mature world. Keep
actual eligible choices, quantities, prices, privacy boundaries and ordering;
do not remove choices or lower world-configurable limits to meet a timing gate.
Before production changes, add a regression that keeps a 10 ms event-loop
heartbeat below 100 ms while the real adaptive catalogue is assembled. Require
identical choices to the current synchronous calculation on the same snapshot,
no live-world mutations, bounded concurrent preparation, cancellation on close,
and no stale result applied after world/character changes. Cover failure without
charging a model call and recovery on subsequent attempts. Run affected NPC
planning/economics/privacy tests, TypeScript and formatting, then repeat walking
and turning in the browser with decision preparation active. Preserve all timing
outliers. Do not resume item 19 while the recorded responsiveness gate fails.

### Priority fix — Keep spare tractors in garage storage (2026-11-07)

Henry reports that Lightmun's fleet crowds his yard and makes boarding difficult.
Before resuming backlog work, keep only the current/last-used tractor outdoors;
switch models at a completed garage and keep all spare tractors invisible in storage.

Completion criteria (before production changes):

- Add fail-first tests in `tests/tractor-storage.test.ts`. Run
  `node --import tsx --test tests/tractor-storage.test.ts`: migration of a crowded
  saved fleet must preserve the current tractor's position, fuel, paint, condition
  and attached trailer, while spare records become invisible garage storage.
  Repeat migration and save/load without duplicating machines or losing assets.
- Owned spare tractors, including ones with only legacy tanks or no parked record,
  must refuse switching outside a completed garage. Garage switching must store the
  previous tractor (even when reached on foot), restore the selected machine's
  own tank/paint/condition and attached trailer, and leave only it outdoors.
  Reject distant, unfinished and aircraft-only garages without mutation; preserve
  existing cargo and blocked-departure safeguards. Aircraft and boats stay unchanged.
- Expose `garageStoresSpareTractors` (default true) beside the existing parking
  rules in World Builder; preserve it through settings validation, save/load and
  portable designs. When false, retain the existing multiple parked tractor policy.
  It applies when persistent parking is enabled; existing instant-switch worlds
  retain their rules. Enabling it tidies existing fleets immediately.
- Browser: load a local saved crowded fleet, confirm only the current tractor is
  visible, walk away/return and use Find tractor, visit the garage, select a spare,
  drive it out and park it. Confirm garage storage guidance, empty/no-spare state,
  unavailable/blocked switching and the World Builder toggle. Capture a passing
  screenshot and walkthrough; no live player mutations for testing.
- Run relevant parking/tractor/render/snapshot/settings tests, `npx tsc --noEmit`,
  production build and Prettier on changed paths. Update player/world-builder docs,
  README and changelog. Keep unfinished roads and performance work out of this slice.
- Commit, push, deploy and announce with screenshot only after these criteria pass,
  following Henry's standing release instructions. Record verification and receipt.

Status: **done — released as 0.131.9**, 2026-11-07.

- Confirmed the first three regression tests failed for the reported behaviors:
  spare tractors stayed outside, owned spare recall bypassed the garage, and a
  swap left the old tractor outdoors. Additional regressions caught obsolete map
  pins (six markers instead of one) and resident plans naming virtual storage
  instead of a real garage. Fixed these without relaxing the assertions.
- 189 relevant tests pass across 22 files, including 10 new storage tests; fuel,
  paint, condition, rig/cargo, save/load, rule/design round trips, no-garage worlds,
  blocked departures, cargo limits and migration idempotence are covered.
- Two actual Chromium browser flows pass: six-tractor migration → one rendered
  tractor/map marker → board → garage swap → park → Find tractor → rule toggle;
  and a single-tractor owner with no spares seeing disabled unaffordable purchase.
  Screenshots and video are in `output/tractor-garage/browser/` (not committed).
- TypeScript, production build and Prettier pass. A 48-player saved-world dry run
  preserves ownership, current vehicles/tanks and every trailer; outdoor tractor
  records fall from 12 to 9, with eight spare records safely stored (including
  previously individually stored tractors). Repeat migration makes no change.
  Release verification and the screenshot announcement follow before marking done.
- The separate NPC-performance candidate and unfinished road work remain
  unreleased in their original checkouts. Version 0.131.9 is now reserved for this
  tractor fix; older performance evidence under `output/release-0.131.9/` is a
  failed, unreleased candidate, not evidence for this release.

Release verification for the tractor-storage slice:

- Commit `6e03bc5dd4627cb6102d343e1ac54afb7c4f20b7` pushed on
  `backlog-implementation` and deployed explicitly; main was not pushed.
- Database backup: `/var/lib/aclone/backups/pre-deploy-20261107-230208.sqlite`.
  Game health and public website report 0.131.9. Public Chromium check confirms
  the new client storage rule, working map worker and no browser errors.
  Service is active, PID 372872, with zero automatic restarts.
- Read-only live database verification: 31 human characters, none with more than
  one outdoor tractor. Lightmun retains all four owned tractors: the Swift Kestrel
  remains outside, while three spares are stored. Compared with the pre-deploy
  backup, every one retains its fuel, condition and paint. Aircraft/other vehicles
  remain as before. No grants or manual player edits were performed.
- Posted and verified the bot's [screenshot announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1568838623518793878).
- Video review confirms the clear garage selection → drive away → park → Find
  tractor sequence. Reviewed clip:
  `output/tractor-garage/browser/garage_swap_drive_and_park.mp4`.
  Migration counts are test-backed; the recording is not a filmed before/after.
- Active release checkout: `/home/henry/.codex/worktrees/tractor-garage/Aclone`.
  The primary checkout stays detached at 030d809 with its road WIP intact;
  `/home/henry/.codex/worktrees/pilot-entry/Aclone` retains the uncommitted NPC
  performance candidate. Integrate those deliberately before resuming their work.

### Priority feedback — Trailer navigation and reversing lights (2026-11-08)

Henry relayed Lightmun's report: parked trailers trap residents, and reversing to
hitch a trailer at night needs rear illumination. Complete these as separate
logical fixes, with relevant tests and browser verification before each release.

1. Trailer navigation: reproduce with `node --import tsx --test
tests/npc-trailer-navigation.test.ts`. A walking resident and a tractor driver
   must reach a destination beyond rotated parked trailers using ordinary `move`
   inputs; no relocation of the resident/trailer or cargo changes. A newly parked,
   moved or removed trailer must invalidate an existing route without rebuilding
   terrain grids or bypassing the shared planning time budget. Stored rigs must
   not block routes. If already overlapped, movement strictly toward the nearest
   free boundary must work, while inward movement and entry from outside remain
   blocked. A genuinely blocked destination must fail safely without movement.
   Run relevant navigation-budget, ground-collision, trailer and parking tests,
   TypeScript, Prettier and build. Browser: watch actual NPC input-driven travel
   around a trailer and recovery from overlap; capture passing evidence.
2. Reverse illumination: add a failing light-state/render test before production.
   Tractor reverse travel must illuminate the rear hitch area at night; forward
   travel, stopped/parked tractors and non-tractors must not emit reverse light.
   Expose enable/output/reach controls in World Builder with one canonical set of
   defaults, preserving settings validation/save/export. Browser: reverse toward
   a trailer at night, verify the rear ground/hitch is visible, then stop and drive
   forward to verify light-off states, including low graphics. Keep light/shadow
   costs bounded. Run relevant lighting/tractor/settings tests, TypeScript,
   Prettier and build; update player/world-builder documentation.

Status: **both done** — navigation released as 0.131.10; reversing lights released as 0.132.0.

- Confirmed failing tests for missing planned detours, changed obstacles and
  overlap escape before production changes; retained all assertions.
- All 67 relevant navigation, budget, trailer, parking and ground tests pass.
- Both Chromium flows pass: a tractor resident detours around the rotated trailer,
  and an overlapped walking resident escapes using ordinary movement. The trailer
  and cargo remain unchanged. Evidence: `output/trailer-feedback/browser/`.
- TypeScript, production build and Prettier pass. Dynamic trailer changes reuse
  cached terrain grids and consume the existing shared planning budget.
- Preserve the separate road and NPC-performance WIP. The performance candidate
  also edits navigation.ts and will require deliberate integration.

Reverse-light implementation criteria: defaults in data/settings.json are enabled,
intensity 90 and range 18 m; editor intensity range 0–1000 (0 disables output),
reach 1–100 m. A single local shadow-free rear spotlight illuminates the hitch;
nearby reversing tractors reuse the existing two remote beam slots, prioritising
rear illumination while reversing. No light allocation or shadow-map changes on
switching. Test `tests/tractor-reverse-lights.test.ts` covers all six tractors,
forward/stopped/engine-off/walking/aircraft/indoors/passenger states, independent
headlight switching, disabled/custom rules and editor/save/design round trips.
The real low-graphics browser flow must reverse toward a trailer at midnight,
show illuminated hitch/ground, stop and drive forward with the beam off, and
save/reload custom World Builder controls.

Navigation release receipt: pushed and deployed
`fcfd9e78e71b2462fedf17f3eab5880de001c609` on backlog-implementation. Backup:
`/var/lib/aclone/backups/pre-deploy-20261108-092127.sqlite`. Public browser
verification confirms game/website 0.131.10, working client/map-worker assets and
no browser errors; service active, PID 380915, zero automatic restarts. Both
walkthrough clips were reviewed; the initial overlap recording had a development
reload and was replaced with a clean passing rerun. Verified bot
[screenshot announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1568994516780843119).
No live player data edits or grants.

Reverse illumination verification (released as 0.132.0):

- Confirmed initial failures: no reverse beam controller, no nearby rear output,
  and unknown world settings. A short-range boundary test also failed because the
  target could fall ahead of the lamp; anchored the aim behind the actual lamp.
- All 27 relevant lighting, tractor, trailer, settings and vehicle-running tests
  pass, including every tractor slot, legacy defaults, disabled/zero/custom output,
  hidden/indoor/passenger/engine-off/forward/stopped states and save/design round trips.
- Two Chromium checks pass: real midnight keyboard reversing on low graphics →
  illuminated drawbar → stop → hitch loaded trailer → forward with reverse beam
  off → change enable/brightness/reach in World Builder → reload retained values;
  and existing per-player headlights on all six tractors. Cargo stays unchanged.
- The initial settings screenshot hit a DOM replacement during the editor refresh;
  fixed test synchronization and reran successfully. No acceptance assertion was removed.
- Reuse the existing two remote beam slots, prioritising rear beams while reversing;
  add one fixed local shadow-free spotlight. Switching does not allocate lights or
  change shader light counts. Read canonical settings directly in the render loop
  rather than allocating a settings object for every vehicle on every frame.
- TypeScript, production build and Prettier pass. Evidence is in
  `output/trailer-feedback/reverse-browser/`; release receipts follow.
  No unrelated road/performance work is included.

Reverse-light release receipt:

- Pushed and deployed `c09d20c207d704628f8cae11e12aa913baa6d698` from
  backlog-implementation; no main push or PR. Backup:
  `/var/lib/aclone/backups/pre-deploy-20261108-093057.sqlite`.
- Public Chromium verification confirms game and website 0.132.0, all three new
  rule keys in the served client, working map-worker/gallery assets and no browser
  errors. Service active, PID 381392, zero automatic restarts.
- Reviewed `output/trailer-feedback/video-review/night_reverse_and_hitch.mp4`:
  rear illumination, engine-off beam extinction and “Trailer hitched.” confirmation.
  Exact input/settings behavior is covered by the passing browser assertions.
- Posted and verified the bot's
  [night-hitching screenshot announcement](https://discord.com/channels/1562183434254680175/1565527790785404968/1568996798335291573).
- Release checkout is clean apart from the intentionally untracked node_modules
  symlink. Evidence remains untracked under output/. No live grants or manual
  player edits. Primary road WIP and pilot-entry performance WIP remain intact;
  integrate their navigation/settings changes deliberately against these releases.

### Resume performance before backlog item 19 — 2026-11-08

The road slice stays pending until the original NPC responsiveness gate passes.
Integrate the preserved pilot-entry candidate onto released 0.132.0 in this
checkout, retaining tractor garage storage, trailer avoidance and reversing lights.
The original failing-first tests and 249-test receipts remain under
pilot-entry/output/npc-choice-preparation; do not rebuild those fixes from scratch.

Completion criteria remain: exact menu/observation parity, selected journal and
conversation privacy, cancellation/retry/stale reply safeguards, scheduler limits,
strict provider schemas and the 96,000-byte request limit. Run affected NPC,
checkpoint, road cache and navigation tests, including the new trailer navigation
regressions, TypeScript and Prettier. No new gameplay values or rules are introduced.

Run the existing populated-world browser replay with at least four actual NPC
preparations: five seconds forward, one second left, one second right, ten seconds
forward. Require successful independent NPC arrival, completed daily road work,
connected client, forward speed >=1 m/s during the final straight section, and
maximum server heartbeat below 100 ms. Retain original assertions and record FPS,
ping/correction, profiles, browser errors and host load. Do not run tests/builds
alongside the replay. Review a passing video before releasing or announcing.
Old output/release-0.131.9 is failed candidate evidence, not a version reservation.
The laptop currently has load averages below 1; the earlier heavy media jobs are
no longer running. Both original WIP checkouts remain recoverable and unchanged.

Resumed verification: 256 affected tests pass in two runs (50 focused and 206
remaining), including storage/trailer compatibility, worker parity, conversation
privacy, cancellation, strict schema variants, request size (95,977/96,000 bytes),
checkpoint persistence and concurrency. The unmodified private-world replay passes
all gates: five preparations/decisions, completed independent resident route and
daily road work, maximum heartbeat 79.553 ms, p95 38.331 ms, zero gaps >=100 ms,
maximum local ping 5 ms, correction 0.565 m and no browser errors. Minimum reported
client FPS is 17; this is an NPC-stall fix, not universal smoothness certification.
Evidence: output/npc-performance-resume/attempt-1/. Reviewed private video shows
continuous terrain and the requested turns without an obvious long freeze or jump.
Do not publish captured private labels; prepare anonymous demonstration evidence.
Keep the provider action-schema correction in a separate logical commit from the
worker/scheduling/cache change; release the verified checkpoint together.

The anonymous public-evidence replay also passes unchanged assertions: five
preparations, maximum heartbeat 94.029 ms, no gaps >=100 ms, maximum local ping
30 ms, correction 0.877 m, no browser errors and minimum reported FPS 16. Business,
resident and town display names are replaced and chat cleared before recording;
raw private fixtures are never staged or posted. Both runs remain in the evidence;
report frame-rate limitations rather than claiming all lag is fixed.

Final release checks: production build (including `tsc --noEmit`) and Prettier
pass. Review the unmasked anonymous 20.1-second clip,
`output/npc-performance-resume/public-walk/video-review/walking_background_full_sequence.mp4`:
forward movement, opposing turns, continued travel and release to 0 mph are visible;
no obvious long freeze, teleport, collision or terrain gap. The reviewed clip
contains generic resident labels and shipped map names, with no private chat,
original human names or custom business labels. Prepare version 0.132.1.

### NPC responsiveness — Done and live, 2026-11-08

Release 0.132.1, commit `c539adb125b84f5acad4d0bcd78baf1fbde2cc16`, is pushed
and deployed from backlog-implementation. The separate provider-schema commit
`ee327e0` is included. All 256 relevant tests, both unchanged browser replays,
TypeScript, production build and changed-file Prettier pass. The reviewed public
clip shows the complete requested walking/turning sequence. Minimum reported
16–17 FPS remains a limitation; do not claim general client performance is solved.

The deployment's immediate public check hit a startup 502; subsequent independent
checks pass: game and website report 0.132.1, correct script and map worker load,
gallery hashes match and the public browser has no errors. Service PID 383656,
zero automatic restarts, running exactly the pushed release commit. Database
backup: `/var/lib/aclone/backups/pre-deploy-20261108-123836.sqlite`; website backup:
`/var/backups/aclone-website/site-20261108-123926.tar.gz`.

The bot announcement and anonymous screenshot were posted and re-read:
https://discord.com/channels/1562183434254680175/1565527790785404968/1569043825287241902
Evidence: `output/npc-performance-resume/`. No main push, PR or player edits.
Mark this priority slice done; resume item 19 next, leaving piloted spaceflight out.

## Preserved item 19 criteria and initial evidence

### Item 19 — Survey and completion criteria before production

Re-read both complete entries, **Alternate road routes and gradual city paving**
and **River crossings, bridges and highway haulage**. Preserve their six-stage
order. This combined item is not complete until all stages pass. Keep new work
unreleased until a complete player-facing slice satisfies its recorded gates;
never announce unfinished bridges, paving or manufactured trucks.

Read-only survey (2026-11-06): query the public world's saved JSON with SQLite
`mode=ro`, then run `npx tsx output/roads-cities/survey.ts` locally. Keep private
world/player data out of commits and announcements. Puddlewick has 62 buildings,
59 completed occupied/public buildings, 33 businesses and 26 distinct housed or
registered residents. Other settlements have at most four occupied buildings,
three businesses and one resident. There are 2,076 effective road segments.
Counts use actual occupied buildings, not acreage or town membership alone.
City starting thresholds: 80 occupied buildings, 40 businesses and 35 residents,
all sustained for 30 game days; demote only after 30 days below 80% of the entry
thresholds. These defaults exceed present development without requiring a huge
population jump; existing pavement remains after demotion.

The five rivers contain 164–176 surveyed shallow crossings each that ground
movement accepts, but the existing road planner accepts **zero** because it
requires dry land throughout. This is a confirmed first gap. Ford selection must
still verify full lane width, bank slopes, obstacles and the whole route; shallow
centre points alone are insufficient. No live state was changed by this survey.

Current freight evidence is supply-limited: no stocked steel or fish sellers;
one wood seller holds 18 units, with best quoted spread 10.04d over 947 m. Fuel's
best quoted spread is 4.28d over 360 m before tax/fuel; wheat's best seller holds
one unit. These are quotes, not proven sustainable earnings. Before manufacturing,
run production/trade simulations including stock replenishment, buyer capital,
taxes, wear, return fuel and loading time; do not claim profitability from an
unlimited-stock arithmetic example. Ordinary steel mills and shipyards cost
1,200d before construction materials, a useful lower-capital comparison.

Policies to implement in their dependent stages: completed player-funded bridges
are public and toll-free by default; world owners can configure access and toll
policy. Crossing refusal must be known before entering a span, with no mid-span
stranding or repeated charge while reversing. Construction uses existing town
permissions, reserves the full span/approaches, and accepts multiple contributors
without granting control of their accounts. Refrigeration uses a separate paid
Fuel supply and slows existing age accumulation only while powered; exhaustion
resumes ordinary spoilage without resetting cargo age. Refrigeration rate,
consumption and applicable goods are world/catalogue controls. Final bridge and
factory bills must be calculated and recorded before their production changes.

1. **Shared records/rules and first dirt routes.** Add backward-compatible optional
   road-surface/crossing metadata, persisted city qualification/progress and
   bridge project records only as their consuming stages land. Existing roads
   default to dirt and remain present when a shortcut opens. Canonical new
   defaults belong in `data/settings.json`, validated F10 fields/help, rules
   summary and portable designs. Start with road growth 12 m/day, width 5 m,
   maximum road grade 35%, shared ground/ford depth 0.8 m, ford search enabled,
   alternate-route saving at least 20% and 100 m, and a configurable parallel
   redundancy limit. Technical survey/caching bounds are not gameplay sliders.
2. **Failing-first dirt-routing tests:** `npx tsx --test tests/road-fords.test.ts
tests/road-projects.test.ts tests/road-alignment.test.ts tests/road-growth.test.ts`.
   Verify actual shallow fords and approaches, deep/absent/blocked fords, multiple
   rivers and distant-town connection, deterministic restart, changed depth/width/
   grade/water rules, obstruction/terrain edits and survey invalidation. Compare
   shortest existing graph journeys with complete terrain-aware proposals. Grow
   useful triangle loops incrementally, reject redundant parallel links and
   pointless detours, retain old road geometry. Validate whole-rig passage with
   real ground movement; no crossing accepted from endpoint proximity alone.
3. **City/paving tests:** sustained entry/demotion and changed rules; centre-out
   connected growth prioritises compact occupied clusters. Default paving 1 m
   per game day, density samples within 60 m requiring four occupied buildings,
   with 30-day eligibility persistence. No farm-lane paving based only on radius,
   no leapfrogging, one suitable boundary exit suffices, destination must also be
   a city. Persist progress and pavement through restart and shrinkage. Paved
   projects stop on safe banks; dirt fords never satisfy paved connectivity or
   become paved. Dirt feeders preserve interim access. Browser map and driving
   show progressive surfaces, no-city/low-density and bridge-waiting states.
4. **Bridge tests:** survey real stable banks, navigable clearance, dry approaches,
   whole-span reservations, price/material conservation near the entry's 800s
   target for a reference span, concurrent contributions and overlap refusal.
   Unfinished projects remain impassable; completed decks support vehicles and
   boats can pass below. Existing fords survive. Restart/design, maintenance,
   removal and changed water/terrain/permissions remain safe. Browser preview,
   insufficient money/materials, contributed completion, loaded crossing and
   under-bridge passage must agree with shared collision.
5. **Factory then highway haulage:** first test construction investment, upstream
   metal/gravel/wood chain, staffing/working capital, timed orders and conserved
   manufactured inventory/delivery. Then test detailed tractor units and useful
   refrigerated/box/stake trailers, cargo restrictions, owned coupling/parking,
   death/recovery, restart/design, load/braking/turning and swept whole-rig
   collision. Target 45 mph dirt and 65 mph paved, extremely slow off-road, without
   gaining paved speed from tiny or disconnected patches. Prove sustained net
   earnings with actual production/trade actions; retain ordinary transport roles.
   Browser cab, lights, mirrors, articulation/reversing, loading and bridge/gate
   clearance, empty/unpowered/refused states, desktop/mobile/controller inputs.
6. **Release gate:** run only tests reasonably affected by each change, all named
   acceptance tests at the completed boundary, clean TypeScript, changed-file
   Prettier and production builds. Browser-check changed world rendering and
   populated-world update/frame timings before release. Record every red/green
   result and measured limits. Commit/push/deploy/announce with successful
   screenshots only after those criteria pass. Piloted spaceflight stays excluded.

First red run: `npx tsx --test tests/road-fords.test.ts` fails on dry-only
road eligibility, ignored configurable ground depth and unknown world settings.
Before production edits, correct the fixture to a surveyed slanted approach that
meets the existing 35% grade limit (33.7% maximum across the lane); perpendicular
banks are too steep and must remain refused. The corrected test retains a grade
precondition and still fails for dry-only eligibility. Raw red evidence is in
`output/roads-cities/ford-red.log`. No acceptance limits were relaxed.

The first three ford tests pass, and all 29 existing road/alignment/growth/island
regressions pass. The distant-settlement regression fails correctly: the 2.4 km
journey has dry endpoints and a deep direct crossing, but grid routing returns no
route (3.2 seconds). Next replace grid-only river discovery with validated ford
portals in the staged search, retaining grade/width/depth checks and deterministic
cache invalidation. Do not proceed to city paving until distant routes pass.

README reviewed for this unreleased substep: its 0.131.0 feature description still
matches the live release, so retain it until the road item is ready. The initial
three ford checks and 29 road/island regressions pass; TypeScript is clean before
the portal-search addition. The first portal attempt still fails the distant-town
criterion (14 seconds including an uncached 10-second survey). It is not ready to
release. Inspect complete approach paths and cache/search costs before proceeding.

The staged route now passes all four ford tests, including every segment of the
2.4 km distant-town journey checked against road grade/width and actual vehicle
water collision. Diagnostic landward approaches also pass independently. However,
the full uncached route takes 17.5 seconds and the ford survey alone takes 10.3
seconds. `growRoads` runs synchronously inside `advance`, so these timings would
freeze an active server. Add a regression before further production changes:
`npx tsx --test --test-name-pattern='road growth yields' tests/road-fords.test.ts`
must return control within 100 ms on the distant-town fixture, retaining pending
work for later ticks. This applies the existing no-long-stall safety bar to road
planning, not a gameplay setting. Do not release or begin paving while it fails.

### Item 19 — Validation stop, 2026-11-06

**Blocked on server responsiveness; do not release this item or start paving.**
The new `road growth yields` test fails for the intended reason: a single
`growRoads` call blocks for **16,999.1 ms**, against the 100 ms return-control gate.
The full distant route is physically valid, but its synchronous survey/search
cannot be used on an active server. Evidence: `output/roads-cities/road-tick-red.log`.

Tried: accept only physically shallow/graded lane-width crossings, add cached
explicit ford portals to the existing grid, diagnose each landward approach,
and join separately validated approach stages. The first three regressions pass;
the staged distant-route regression passes, including actual vehicle water
collision on every segment. The first portal-only version failed to connect
otherwise valid approaches; the staged fallback fixes that reachability gap but
retains an unacceptable cold survey/search delay. Do not weaken or remove either
reachability or responsiveness criteria.

Resume by making ford surveying and road planning incremental/resumable under a
bounded server work budget, with pending growth preserved across ticks/restarts.
Cache only validated geometry and invalidate on relevant edits. Then complete
alternate-route persistence/benefit, blocked/multiple-river cases, rule/browser
checks and the remaining stages in their original order. No city paving, bridge,
factory or highway-truck production code has begun. The current road edits and
failing regression remain uncommitted; they are not part of the live 0.131.0.

Stop-state checks: all 29 existing road/alignment/growth/island tests still pass
with the staged planner. `npx tsc --noEmit`, Prettier on all 13 changed/new paths,
and `git diff --check` pass. Four new functional checks pass; the server tick
responsiveness test remains red. Road editor/browser release checks remain
pending and are not claimed. Leave this working tree intact for resumption.

### Item 19 — Resume bounded planning, 2026-11-06

Retain the failing 100 ms tick test. Strengthen it before production changes:
repeated ticks must eventually lay exactly the accrued 12 m/day allowance, save
and reload while the survey is pending must retain the unpaid days, and ordinary
clock advancement must not restart geometry work. A newly added obstruction must
invalidate a pending route before any unsafe segment is laid. Keep synchronous
survey helpers for deterministic diagnostics, but make authoritative growth use
the same algorithms as resumable generators. Yield inside ford surveys, route
expansion/refinement and whole-route validation; do not merely defer a 17-second
operation to the next tick. Existing growth assertions retain their game-day
budgets and geometry expectations, with pending work drained at the same game
clock when testing the completed result.

### Item 19 — Resume after performance release, 2026-11-08

Integrate the primary checkout's preserved candidate against released 0.132.1;
retain original failing-first logs and all reachability/100 ms tick assertions.
The original 19 road paths remain untouched in /home/henry/dev/Aclone. Recheck
ford, policy, growth, project, alignment, cache and navigation consumers before
new production changes. Add missing multiple-river/blocked/alternate-route
regressions before implementing those gaps. Validate editor and real crossing
in a local browser, including refusal states, before any road release. Preserve
all newer garage/trailer/reverse-light/performance behavior during integration.

Integrated baseline: all 33 ford/policy/growth/project/alignment/cache/budget
checks pass (`output/roads-resume/integrated-baseline.log`). Read-only inspection
finds a remaining full-lane gap: a road centreline just outside a deep bank is
accepted although the vehicle footprint enters impassable water. Add a concrete
regression at the generated first river's point 340: centreline outside the water,
actual 2.5 m-radius movement blocked, road segment refused. Run it red before
changing production; retain all successful ford and distant-route/tick checks.

The dry-centreline regression fails as expected (road accepted, vehicle blocked).
Checking the lane whenever either endpoint is within its half-width plus verge of
inland water fixes it. The shallow-ford, changed-depth and new bank-edge checks
all pass. Continue the full distant-route/tick gate after remaining river cases.

The nine river checks expose a second confirmed gap: a route across two physically
separate river channels is returned, but one smoothed segment fails the same
full-lane safety check. Eight checks pass, including the 2.4 km route, 25.2 ms
maximum growth tick, exact 24 m allowance after reload, and absent/deep/steep
crossing refusal. Preserve the failing multiple-river assertion and inspect the
alignment stage; no alternate-road or paving work starts while this is red.

World-rule coverage additionally requires residents to observe current road/ford
settings (not assume the old fixed depth). Add a regression for all five changed
values before adding them to observation. Retain the 96,000-byte request budget,
selected guide content and memory limits if the extra rule fields need space.

Alignment fix: reject non-finite curve costs, validate joins between all rounded
corners, and fall back to the already surveyed safe path if any bend fails. The
previously failing two-river test now passes both lane and real movement checks.
The resident-rule regression initially fails on missing groundWaterDepth. After
adding the five canonical road values, the full request reaches 96,073 bytes;
shortening repeated voice wording (not facts, examples, selected guide sections
or memory counts) restores 95,973/96,000 bytes. Identity/privacy assertions pass.

Strengthen the distant-settlement acceptance: after reload and default 24 m over
two days, change the world growth rule to 1,000 m/day and finish the same route.
Require one connected road network, no unfinished project, physically traversable
laid segments, JSON persistence, and every construction tick <=100 ms. Keep the
original 90-second planning/completion bounds. Browser steps will show actual
road growth and driving through the shallow crossing, deep-water refusal and
World Builder rules/reload; this remains an unreleased dirt-routing substep.

Release boundary for this substep: usable ford-aware dirt connections and their
configurable rules only. Item 19 as a whole remains unfinished; alternate useful
loops are next, followed by city paving, bridges and manufactured haulage in the
existing order. The real browser flow passes grown-road driving, stricter-depth
refusal, retained road geometry, and persisted editor changes. Complete relevant
regressions, typecheck/build, formatting, populated-world responsiveness replay
and video review before releasing this independently usable substep.

All 103 relevant checks pass, as does the populated-world input/NPC/daily-growth
replay with unchanged assertions. Before release, add the final river-cache
invalidation check: move an already-surveyed river's coordinates in place and
require the resulting ford survey to equal a fresh save/reload survey. A new ford
list must not reuse the old underlying water spatial index.

The moved-river regression fails before invalidation and passes afterward. Road
surveys now invalidate cached water bounds/curves when the existing river geometry
stamp or pond geometry changes. Clock-stable reuse remains intact; no new gameplay
values are introduced. The four targeted crossing/cache checks pass. Rerun the
affected river/alignment/cache regressions and populated-world responsiveness
after this final cache fix before releasing.

Final cache rerun: all 42 affected river, ford, alignment, geometry-budget and
island tests pass, including the newly red-then-green moved-river regression.
There are 104 unique passing relevant tests across the main 103-test run and
this added regression. The guide request remains 95,987/96,000 bytes after the
player documentation update. The reviewed crossing clip shows an approach,
river crossing and exit without an obvious freeze/teleport; stricter-depth
refusal is visible after reload. Prepare candidate 0.133.0, then run the production
build and final populated-world replay before publishing.

Final release gate failed: the unchanged populated-world replay recorded a
102.117 ms heartbeat (limit strictly below 100 ms), despite successful movement,
NPC choices, navigation and daily road growth. Keep 0.132.1 live. The captured CPU
profile identifies repeated farm-plot allocation and spawn-reservation rebuilding
in scenery generation during road surveys/navigation. Before optimization, require
a cold scenery chunk to resolve spawn clearances fewer than 20 times, preserve
exact farm/pasture coverage including rotations, padding, exclusions and first-plot
slices, and retain all scenery edit/determinism checks. Run the focused tests,
TypeScript/build, Prettier and the same real-browser input replay after changes;
do not relax the 100 ms gate or publish the failed recording. Evidence:
`output/roads-resume/final-populated-replay/`.

Scenery regression: cold generation read spawn-clearance rules 164 times and
failed the new <20 operation-count assertion. Resolve reservations once per chunk
and query farm plots directly, retaining JavaScript slice semantics. All 40
affected exclusion, farm, spawn, collision, navigation and road-budget tests pass.
The unchanged populated-world replay now passes: maximum heartbeat 76.563 ms,
zero gaps at least 100 ms, five real preparations/decisions, completed daily road
work and NPC arrival, continuous final walking, no browser errors. Minimum client
FPS remains 19; maximum ping 416 ms is one initial round trip retained by the HUD until the
next five-second probe (later probes: 1, 71 and 2 ms), so this
is not a claim that all client latency is resolved. Evidence:
`output/roads-resume/exclusions-red.log`, `exclusions-green.log`,
`exclusions-replay/result.json`. Complete the final build and video review before
committing/pushing/deploying the ford checkpoint.

The final production build (including `tsc --noEmit`) passes after the exclusion
optimization. Prettier and `git diff --check` pass. Release only this independently
usable ford substep; retain item 19 as in progress for alternate loops and paving.

Video review passes: `exclusions-replay/video-review/walking_during_road_candidates.mp4`
shows the full forward/left/right/forward sequence and stop, with no obvious long
freeze, teleport or terrain gap. Generic resident labels only; no private chat.
Retain the measured client FPS/ping limitations. Proceed with the verified ford
checkpoint and separate scenery optimization commits; no later item is complete.

### Item 19 — Ford checkpoint released, 2026-11-08

**Done: persistent ford-aware dirt connections and configurable road rules.**
Push/deploy commit `517483e89de983f1cf359d064e1804bd23589a8a`, including the
separate scenery-work fix `00b9106`. Game health, public client, map worker,
marketing site and building gallery pass the read-only browser check; all report
0.133.0 with no browser errors. Server PID 384383, restart count zero. Database
backup `/var/lib/aclone/backups/pre-deploy-20261108-131046.sqlite`; website backup
`/var/backups/aclone-website/site-20261108-134850.tar.gz`. Verified bot announcement
with passing crossing screenshot:
https://discord.com/channels/1562183434254680175/1565527790785404968/1569061266998435933
Evidence: `output/roads-resume/`. **Item 19 remains in progress.**

### Item 19 — Useful alternate routes: criteria before production

Claim: keep growing useful loops after all destinations connect. Compare the
shortest existing road journey with a completely surveyed terrain-safe proposal;
consider towns and the spaceport without hard-coded names. Preserve older roads
and build gradually. Reject insignificant savings and redundant parallel roads.

Canonical per-world defaults: enable alternate routes; require both 20% shorter
travel and 100 m saved. Reject proposals with more than 25% of their length within
15 m of existing road centre lines (excluding the normal endpoint connections).
Expose all five values in F10, validation, portable designs, rules summary and NPC
observations; use the same rules when geometry/policy changes during construction.
These defaults implement the prior settlement survey's benefit targets; the
parallel rule prevents a second lane following an existing route.

Before production, add and run failing tests in `tests/road-alternates.test.ts`:
connected triangle/spaceport shortcut, an already efficient triangle, insufficient
absolute/relative savings, terrain detour wiping out apparent straight-line gain,
parallel duplication, disconnected destinations retaining connection priority,
exact daily allowance, old-road preservation, changed rules, save/reload and
repeated evaluation without duplicate loops. Verify actual graph junctions and
mid-segment crossings when computing shortest travel. Keep survey work yielding
inside graph construction, path search and scoring; retain <100 ms tick/replay
gates on populated worlds. Relevant road tests, `npx tsc --noEmit`, production
build and Prettier must pass. Browser: watch an existing connected network gain
a useful loop gradually, drive the finished shortcut, inspect unchanged old roads,
then disable alternate growth and verify no extra route is added. Test/edit/save
F10 thresholds and show the no-benefit state. Capture and review screenshots/video
before commit/push/deploy/announcement. City paving and bridges remain later.

Alternate-route progress: the initial regression fails because a connected triangle
receives no shortcut. Add a yielding road graph that splits real intersections and
T junctions, retains lane-width joins with physical distance, and compares shortest
journeys against completely surveyed paths. Grow useful loops with the existing
daily allowance; retain old roads and save/reload progress. Required connections
and property access retain priority. Disabling/changing optional-route policy
discards its remaining proposal, preserving already built segments.

All 77 relevant tests pass, including 13 new route/junction checks: useful triangle,
spaceport access, efficient network, both benefit thresholds, parallel limit and
override, impassable barrier, a traversable detour whose actual length erases the
saving, junction splitting, bounded mature graph work, policies and design export.
The NPC request budget first fails at 96,152 bytes after exposing the new rules;
shorten instruction prose while retaining facts, privacy, guides and memory limits.
The existing 96,000-byte gate now passes. Fix a test-only TypeScript narrowing
error without changing its assertions. Browser/editor/driving and populated-world
responsiveness verification are pending; alternate routes are not released.
Evidence: `output/road-alternates/`.

Browser first attempt finds a confirmed player-visible gap: an open parish map
retains old road geometry after authoritative growth. Add a browser assertion that
the rendered road path changes after the first day's construction, and verify
road-only updates retain the terrain layer/job, zoom, pan and focus. Update only
road geometry when it changes; avoid a full terrain rebuild. The initial driving
check also finds the harness's steering sign reversed (A increases heading in the
existing controls); correct the harness while retaining its lane-distance check.
No performance threshold or gameplay assertion is relaxed; failed videos remain
private. The five alternate-rule values now have explicit NPC observation checks.

The final populated-world replay blocks release: server heartbeat stays below
100 ms (81.399 ms maximum), but daily planning does not finish during the unchanged
driving sequence. Profiling finds a local shortcut triggering a whole-island ford
survey and parallel scoring visiting every road for each path sample. Before
production fixes, require a local safe route to avoid distant ford depth checks
and a 2,000-segment connected triangle to produce its useful alternate in fewer
than 200,000 yielding operations. Preserve route safety, scoring and all existing
ford checks; rerun the unchanged populated replay. Keep 0.133.0 live until it passes.

The scoped replay still leaves daily work pending (82.287 ms heartbeat). Both
new operation-count regressions pass, but the optional planner spends 5.43 CPU
seconds surveying every plausible pair before choosing the same strongest route.
Add a red-then-green best-first regression: retain the strongest rectangle shortcut
and finish its planning in fewer than 10,000 yielding operations (initially 12,662).
Use the straight-line distance only as an upper bound on possible benefit, never
as acceptance of unsurveyed terrain. Preserve original ordering for tied scores.

Best-first planning retains the identical route in the populated fixture while
reducing isolated planning from 5.43 s to 0.53 s. All 56 affected road regressions
pass, including the three new performance checks; all 15 alternate/junction checks
are included. The prior NPC/provider/navigation and map checks remain green.
TypeScript and production build pass. The unchanged populated replay now passes:
99.238 ms maximum heartbeat, no gaps >=100 ms, five preparations/decisions,
completed daily road work and NPC arrival, continuous final walking (minimum
5 m/s), CONNECTED and no browser errors. Maximum ping 65 ms; minimum client FPS
14 remains a limitation. Evidence: `output/road-alternates/best-first-replay/`.
Prepare 0.134.0; complete the final browser/video review before commit and release.

Final feature browser rerun passes after the planning optimizations: gradual
shortcut growth, normal-keyboard driving, retained original roads, live map ink
without terrain rebuild/pan/focus loss, efficient-network refusal and saved F10
disabled/custom rules. Existing map navigation regression also passes. Reviewed
20-second populated-world clip includes the full forward/left/right/forward/stop
sequence without an obvious long freeze, teleport or terrain gap. Retain the
measured 14 FPS limitation and narrow heartbeat headroom. Formatting and diff
checks pass; no full-suite rerun is required for unrelated code. Commit/push the
complete alternate-route slice; verify deployment and screenshot post before
marking it done. City paving remains the next dependent stage.

### Item 19 — Alternate-route checkpoint released, 2026-11-08

**Done: useful alternate dirt routes and configurable benefit/parallel policy.**
Push/deploy `cc3dcf89c116565b07f402c859b17569afbfe444` as 0.134.0.
Read-only browser checks verify game health, released client settings, map worker,
website and gallery with no errors. Server PID 385663, restart count zero; exact
commit matches. Database backup:
`/var/lib/aclone/backups/pre-deploy-20261108-142252.sqlite`; website backup:
`/var/backups/aclone-website/site-20261108-142411.tar.gz`.
Reviewed and verified the bot's two-screenshot announcement:
https://discord.com/channels/1562183434254680175/1565527790785404968/1569070308554575877
Evidence: `output/road-alternates/`. **Item 19 remains in progress.**

Next dependent stage remains city paving, preceded by a fresh read-only settlement
survey. First inspect the captured client profile for the remaining 14 FPS dips,
following Henry's standing performance priority. Do not claim the passing server
heartbeat alone proves responsive rendering; turn any confirmed client bottleneck
into concrete failing-first criteria before changing production code.

### Performance follow-up — Local road lookups for grass: criteria before production

The passing alternate-route replay's client profile attributes about 1.2 seconds
to exhaustive road-distance checks during countryside regeneration. Grass only
uses distances within 5 metres, but checks all 2,003 road segments for each tuft.
Reuse the bounded spatial lookup already used by snow, without changing road-edge
clearances, roadside density, seeded placement or snow/paved-surface behaviour.

Before production: `node --import tsx --test tests/scenery-road-lookup.test.ts`
must fail when 2,600 scattered grass candidates plus the start of the roadside
pass read more than 100,000 coordinates from a 2,000-segment distant network.
Verify bounded distance decisions against exhaustive road distance at negative
coordinates, cell boundaries, wide roads, zero-length and long diagonal segments,
empty networks and rebuilt indexes after geometry edits. Keep snow's additional
square/runway/spaceport surfaces unchanged. Run affected scenery/snow tests,
TypeScript/build and Prettier. Replay actual walking/turning, NPC choices and daily
road growth with the unchanged <100 ms server gate and no errors; compare the
captured client road-distance cost and inspect screenshots/video for missing grass
or new road overlaps. Do not infer universal frame-rate gains from this one fix.

Grass regression fails correctly at 30,526,000 road-coordinate reads. Extract
road-only distance lookup from the existing snow index and use it for grass's
existing maximum 5 m roadside predicate. Keep square/runway/spaceport snow
clearances in the surface wrapper. All 18 affected scenery, snow and surface
checks pass, including exhaustive near-edge equivalence and distant/long/edited
roads. README reviewed: keep released 0.134.0 information until browser/profile
verification and this follow-up's release. No new gameplay rule is introduced.

The grass check now reads 26,000 coordinates versus 30,526,000 before the fix.
All 18 affected tests pass, plus strengthened exact cell-boundary/runway/spaceport
comparisons. TypeScript/build and formatting pass. The unchanged populated-world
replay passes at 93.946 ms maximum heartbeat, five preparations/decisions,
completed growth and NPC arrival, continuous walking and no browser errors.
Road-distance profile self time falls 1,182.828→34.158 ms; countryside inclusive
1,645.524→784.5 ms, world build 2,757.069→2,192.806 ms. Minimum recorded client
FPS rises 14→17, but rendering costs remain. One initial ping is 372 ms (held in
the HUD until the next probe); later probes are 4, 111 and 1 ms. Preserve this
limitation in release notes. The real snow/thaw browser test also passes all four
depths, including zero snow, with no errors. Review screenshots/video, then
release this independent performance fix as 0.134.1.
Evidence: `output/scenery-road-lookup/`.

Video review passes: the 20.2-second input clip shows forward travel, both turns,
continued walking and stopping, without obvious long freezes, teleports, missing
grass or grass covering pavement. Start-view grass matches the preceding replay.
The 4 cm and zero-snow browser screenshots retain clear roads and normal thawed
grass. Measurements support reduced road-query work, not a universal smoothness
claim. All criteria pass; commit/push/deploy the 0.134.1 performance slice and
post the reviewed local-test screenshot before continuing city-paving work.

### Performance follow-up — Grass lookup checkpoint released, 2026-11-08

**Done.** Push/deploy `0add0037c1b02f7e2a8fda1fc612a986dcd18b90` as 0.134.1.
Read-only browser verification confirms game, client, map worker, website and
gallery with no errors. Exact server commit matches; service active, PID 386237,
zero restarts. Database backup:
`/var/lib/aclone/backups/pre-deploy-20261108-143654.sqlite`; website backup:
`/var/backups/aclone-website/site-20261108-143806.tar.gz`.
Verified bot announcement with reviewed screenshot:
https://discord.com/channels/1562183434254680175/1565527790785404968/1569073652769624340
Evidence: `output/scenery-road-lookup/`. Continue item 19 city paving.

### Item 19 — City paving: refreshed survey and concrete criteria before production

Read-only live survey on 2026-11-08: Puddlewick has 69 buildings, 52 completed
occupied/public buildings, 27 businesses and 26 distinct housed/registered
residents. Other settlements have at most three occupied buildings, two
businesses and one resident. Effective road segments: 2,157. Private input stays
in `output/city-paving/`. Count a completed public building, an inhabited home,
or premises with a known owner/employee; do not count an empty owned house as
inhabited. Businesses exclude residential and civic uses; acreage never counts.
Deduplicate housed and registered residents. Keep canonical proposed defaults:
80 occupied buildings, 40 businesses, 35 residents sustained 30 game days;
demotion after 30 days below 80% of any entry threshold. Existing paving persists.

Implement the entire dependent paving stage before releasing it:

- `node --import tsx --test tests/city-paving.test.ts`: fail first for absent city
  assessment/state, then cover sustained qualification, interrupted eligibility,
  hysteresis, count deduplication, construction/empty houses/unknown owners,
  changed settings, paused time, restart and no retroactive qualification.
- Test continuous centre-connected paving, one metre per game day by default,
  dense corridor/destination preference, four occupied buildings within 60 m
  sustained 30 days, and continued dirt access to sparse farms inside a city.
  Sample corridors at a configurable maximum 10 m spacing; all samples must
  qualify. Persist progress; no leapfrogging, duplicate daily budgets, or
  demolition when density/status falls. Re-evaluate changed roads/obstructions.
- Test one suitable connected boundary exit enabling an intercity trunk without
  paving every street. Both destinations must qualify; smaller towns and rural
  side lanes stay dirt. Dry approaches stop safely at banks, exclude all fords
  from paved connectivity, and grow safe dirt feeders to usable fords. Preserve
  old roads; no automatic bridge. Test absent/blocked fords and terrain edits.
- Validate every new gameplay switch/threshold/rate through F10 settings actions;
  reject invalid values atomically, expose canonical defaults/help and current
  values in rules/NPC observations, and round-trip rules/surfaces through designs.
- Browser: use a local real-server world, watch qualification and daily pavement
  growth on the ground and map, drive it, verify the farm lane stays dirt, then
  show the no-city/low-density/paused and bridge-waiting states. Change settings
  in F10, reload, and verify persistence. Check map focus/pan and terrain-cache
  preservation. Capture and review successful screenshot/video evidence.
- Run affected city/road/terrain/map/design/snapshot tests, `npx tsc --noEmit`,
  changed-file Prettier and build. Repeat the populated walking/turning replay
  with NPC choices/daily work and the unchanged <100 ms server heartbeat gate.
  Record frame/ping limitations candidly. Do not deploy or announce partial city
  data/schema work; stage 3 is complete only when its full criteria pass.

City-stage progress (unreleased): qualification first fails because no assessment
exists; sustained counts, gaps, demotion, restart, policy/day-length changes and
legacy catch-up now pass. Dense-road tests first fail at zero pavement; gradual
budgeted growth, sparse lanes, no leapfrogging and one-exit trunks now pass.
A forced-yield regression catches publication before charging a day; construction
now commits atomically after the entire daily job, discarding drafts after edits.
River integration uses the real enlarged-island terrain and existing ford route:
first fails on absent bank state, then passes safe dry approaches, retained ford
geometry and separately queued dirt feeders. Evidence: `output/city-paving/`.

Nineteen targeted city tests pass, including snapshot privacy/cache identity,
canonical rule validation, portable geometry/layout and town status. Corrected
new-world import fixtures before the relevant red run; no import safety rule was
relaxed. Public empty houses do not count; this does not change the fresh survey's
52/27/26 Puddlewick counts. README retains released 0.134.1 status while this stage
is under verification. Browser tests first fail for absent pavement map ink,
then confirm the stroke exists. A horizontal SVG path has zero geometric height,
so verify its painted stroke and screen position rather than Playwright's box
visibility heuristic. A further red check catches stale Town labels after city
qualification; update only the label, preserving map navigation. Continue ground,
driving, settings and bridge-waiting browser verification, remaining edge cases
and affected performance gates before any city release.

Resume after usage reset: the main city browser flow passes; the real river-bank
flow first fails because no missing-bridge map marker is drawn. Add that marker
without rebuilding terrain or disturbing navigation. Extend the completion
criteria to keep the HUD's town/city wording consistent, discard trunks aimed at
moved towns, exclude flooded/obstructed historical pavement from connectivity,
and resume a bank approach after a crossing becomes dry. New tests fail for the
stale HUD, moved destination, flooded connectivity and stale bridge wait, then
pass after targeted fixes. Strengthen the disconnected-exit fixture to prove the
origin remains qualified. A forced-yield/day-boundary regression passes without
a production change: unchanged qualification does not restart the survey.
All 26 city tests pass; river, browser and release performance checks remain.

The real river daily-scheduler check completes in 4,099 bounded slices; maximum
slice 10.2 ms, below the unchanged 100 ms gate. It catches replacement of untouched
ford-road objects during atomic publication. Preserve original road records when
geometry has not changed; keep new/extended construction atomic. The disabled-ford
and flooded-bank checks pass. The successful bank browser capture initially shows
its map before the terrain worker finishes; wait for the rendered terrain before
capturing the final evidence, rather than claiming the blank map demonstrates
river geography.

NPC request regression: adding all canonical city rules increases the request to
96,183 bytes against the unchanged 96,000-byte ceiling. Tighten duplicated NPC
instruction wording while retaining observations, selected guide text, recall
and action rules; request size becomes 95,898 bytes. NPC guide/conversation and
road-policy tests pass, including custom city settings in resident observations.

The broader gate also finds two legacy building-design assertions: whole-model
triangle counts include the shipped furnished interiors, and a hotel-door check
looks only at direct children although shipped doors now use animation pivots.
Confirm them against the released source. Follow the item 17 validation contract
already recorded above: retain the original exterior triangle ceiling, enforce
the separate 6,000/15,000 interior ceilings, and check actual world-space doorway
clearance through the pivot hierarchy. Do not change shipped building geometry
or increase the exterior budget. Keep this test maintenance distinct from the
city feature commit; verify it before release.

Affected unit gate: 134/136 pass before the two legacy model-check repairs.
An archive of released HEAD reproduces both exact failures (boathouse whole-model
4,350 triangles; direct-child hotel door absent). All nine design checks then
pass with unchanged exterior limits, separately enforced interior budgets, and
world-space clearance for the animated door. No production model changes.
Real city-bank scheduling passes at 11.7 ms maximum; absent/disabled fords,
flooded banks, actual dirt-feeder daily budget/restart/obstruction, city rules,
road graph/growth, snapshots, terrain, snow and NPC checks pass. All 136 affected
checks have now passed across the focused runs. Keep browser, TypeScript/build,
formatting and populated-world performance verification as remaining gates.

All four browser checks pass: gradual city paving/driving/settings; the actual
river-bank approach and rendered “Bridge needed” map; mature-map road batching;
and snow/thaw down to zero. Improve coverage with visible town-government
qualification/status as well. Two further red regressions expose stale city
history when reimporting into an unoccupied world and wording that implies a ford
exists even when none is usable. Clear simulation history explicitly on import
while preserving authored surfaces, and describe fords as excluded from paved
connectivity without claiming availability. All 55 city/import/NPC checks pass.

### Item 19 — City paving release readiness, 2026-11-08

All stage-3 completion criteria pass. The final touched-scope run passes 67/67
checks; the broader affected scope passes 136 checks across focused runs. Four
browser flows pass (city growth/driving/settings, rendered river-bank map,
mature-road map updates and snow/thaw), followed by an expanded government-panel
flow showing both qualification progress and established city status. TypeScript,
changed-file Prettier, production build and diff whitespace checks pass.

The unchanged populated-world replay completes five NPC preparations/decisions,
daily road growth and NPC arrival while the player walks forward, turns both
ways, continues and stops. Maximum server heartbeat gap is 79.97 ms with zero
100 ms violations. Minimum client FPS remains 17; peak ping is 298 ms and maximum
prediction correction is 0.575 m. These remain performance follow-ups, not a
claim that all lag is fixed. Video review finds no obvious long freeze, teleport
or missing terrain. The final city-driving and rendered river-bank clips pass
review; all published screenshots must identify the accelerated local test world.

Prepare 0.135.0 with complete player/world-builder/release documentation. Keep the
released-model test maintenance in its own commit. Push and deploy the exact city
feature commit, verify the live version/assets read-only, and announce through
the Discord bot before marking this slice done. Evidence: `output/city-paving/`.

### Item 19 — City paving released, 2026-11-08

**Stage 3 done.** Push/deploy `051ee6c63379ff629a715c5492efeb8b596c382a` as
0.135.0; preceding test-maintenance commit `78c87cc` remains separate. Read-only
browser verification confirms game/client, map worker, website and gallery with
no browser errors. Server commit matches; service active, PID 387197, zero
restarts. Database backup:
`/var/lib/aclone/backups/pre-deploy-20261108-152914.sqlite`; website backup:
`/var/backups/aclone-website/site-20261108-153018.tar.gz`.
Verified bot announcement with two reviewed, explicitly local-test screenshots:
https://discord.com/channels/1562183434254680175/1565527790785404968/1569086777753604147
Evidence: `output/city-paving/`. Live Puddlewick is below default city thresholds;
no player/world settings were edited to force qualification. Continue measured
client-performance follow-up, then stage 4 bridges.

### Performance follow-up — Repeated calendar/climate rule resolution

The 0.135.0 populated-world client profile records 221.8 ms in `calendarRules`,
110.0 ms in its field mapper and 111.6 ms in `climateRules` during walking.
Both resolvers allocate field lists, pairs and settings objects on every call,
including repeated environmental/sea/render queries against unchanged settings.
Before production edits, define this narrow optimization's completion criteria:

- Add `tests/environment-rule-cache.test.ts`: repeated lookups of unchanged
  settings reuse an immutable resolved subset, including absent/partial defaults.
  Every field's in-place edit/deletion must take effect on the next call, as must
  replacement settings and switching worlds. A prior result must not change;
  unrelated settings must not leak into the resolved rules or invalidate them.
  Run first and confirm failure from repeated allocation, not missing fixtures.
- Preserve exact existing calendar/weather/sky fingerprints and custom/zero rules.
  Run relevant calendar/climate/environment, astronomy, ocean, snow, farming and
  financial-calendar tests. Do not change canonical defaults or add gameplay knobs
  for an internal allocation optimization.
- Measure an identical repeated weather-query workload before/after, retain its
  checksum, and demonstrate reduced resolver allocation/work. Repeat the unchanged
  populated-world walking/NPC/daily-growth replay; retain the <100 ms server gate
  and record client frame/ping/correction results without promising universal FPS.
- Browser: run the climate editor's clear/snow/reload/invalid-bounds flow and the
  calendar editor's custom-year/invalid/empty/planted-winter/reload flow. Preserve
  immediate world-builder effects. Review successful walking video/screenshots.
- Require clean TypeScript, changed-file Prettier and production build. Release
  only after these criteria pass; bridges remain the next feature stage.

Calendar/climate reuse: all four new regressions fail first on repeated object
allocation, then pass with weakly cached, frozen rule subsets and immediate
field-by-field change detection. No settings are stored in a global world cache;
old results remain stable and unrelated settings stay out of the resolved subset.
The identical 30,000-query benchmark's median falls from 461.7 ms to 253.4 ms
(45.1%); all five output checksums match. For 1,000 paired lookups, resolved
objects fall from 2,000 to two. All 95 affected unit tests pass, including frozen
weather/calendar/sky fingerprints, every live rule edit, snow, farming, tides,
storm risk and financial-calendar consumers. TypeScript passes. README reviewed;
retain released 0.135.0 wording until browser/performance/release gates complete.
The first browser command omitted the project's tsx loader and could not load
JSON; rerun using the documented `node --import tsx` test runner.

Browser verification: climate clear/snow/reload/invalid-bounds and custom-calendar
winter/farm/reload flows pass. The banking test first races the first loan's
100 ms panel refresh: it requests the second quote after server acceptance but
before the browser renders the signed loan, and the scheduled refresh removes
that quote. Wait for the actual rendered loan before requesting another. The
retry passes unchanged stale-offer rejection, preserved signed periods and new
calendar terms. No banking production logic or acceptance criterion changes.
All three affected browser flows have passed; timed populated replay is next.

Final performance verification passes: five NPC preparations/decisions, completed
daily road growth and resident arrival, connected walking/left/right/forward/stop,
no browser errors, server heartbeat maximum 74.95 ms with zero >=100 ms gaps.
Client rule CPU self time falls 566.4→170.4 ms; frame p95 56.4→50.7 ms, minimum FPS
18, maximum ping 106 ms and correction 0.337 m. One 104 ms client frame remains;
measured `setWorld`/prediction calls peak at 23.9/21.3 ms. Retain that limitation.
Final TypeScript, production build, formatting and diff checks pass. Prepare
0.135.1 metadata; successful video review remains required before publishing.
Evidence: `output/climate-rule-cache/`.

Video review passes for the final 20.6-second walking/turning/stopping clip:
no obvious long freeze, large teleport, collision or missing terrain, and no
private names/chat in the reviewed evidence. The climate editor visibly reports
inverted winter bounds; persistence is covered by browser assertions. Keep the
recorded 18 FPS/106 ms ping/0.337 m correction/104 ms frame limitations. All gates
for this focused optimization now pass; commit/push/deploy and announce 0.135.1.

### Performance follow-up — Environment rule cache released, 2026-11-08

**Done.** Push/deploy `2804659eb9de3780a97efbc083bf15189130eb42` as 0.135.1;
keep browser synchronization maintenance separate in `9e73bd9`. Read-only public
browser checks confirm game/client, map worker, website and gallery without
errors; exact server commit matches, service active, PID 387753, zero restarts.
Database backup: `/var/lib/aclone/backups/pre-deploy-20261108-154423.sqlite`;
website backup: `/var/backups/aclone-website/site-20261108-154520.tar.gz`.
Verified bot announcement with reviewed local-test screenshot:
https://discord.com/channels/1562183434254680175/1565527790785404968/1569090581978816543
Evidence: `output/climate-rule-cache/`. Continue item 19 stage 4 bridge construction;
retain measured frame-rate limitations and existing performance acceptance gates.
