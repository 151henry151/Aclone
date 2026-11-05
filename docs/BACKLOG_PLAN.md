# Backlog implementation plan

Source: [BACKLOG.md](BACKLOG.md), read in full before changes. Base: `main` at
`1423116eae06134ebbc2b90dc3fd72cd3a216b0c`. Work branch: `backlog-implementation`.
The implementation phase kept changes unreleased, with no version bump, pull
request, deployment, live server edits or player grants. Henry authorized release
and deployment of this checkpoint on 2026-11-04; the release record below
supersedes those restrictions for that cut. Later authorizations and operations are recorded below. Piloted spaceflight is excluded and remains pending.

## Completion protocol

Before each implementation slice, transcribe its acceptance criteria here as
specific assertions, commands and player-visible browser steps. Run a new or
extended regression test and record the actual failure before production edits.
Use the existing world rule/catalogue as the single source for gameplay values;
new gameplay defaults require validation, creation, summary, editor and portable
design coverage. Flight graphics follow client graphics settings instead.

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
12. **Solid trees, boulders and vehicles**: shared deterministic obstacle data,
    spatial queries, static collision/escape, pedestrian sliding, moving-vehicle
    contacts and offline policy; integrate road/navigation/build/snow users and
    measure tick/frame cost before proceeding.
13. **Cargo boat for dock-to-dock freight**: definition/model/tuning; persistent
    hold; quay and existing landing transfers; decide optional barge; route
    economics. Follow the entry's internal order.
14. **Rowboats**, together with **Storm capsizing** (15): rowboat shore access,
    seats/hold, beached persistence, tender policy and no-carry enforcement; then
    the storm sea survey/defaults, seeded/ramped risk, warnings, occupants/death/
    loss and shelter-time checks. Verify rowboat storm acceptance before marking
    either section done. Canoe and cargo hull classifications already exist.
15. **Springs, pump-houses and desalination plants**: deterministic frozen
    springs/headwaters; scenery/drinking; grandfathered desalination; fresh-water
    siting/recipes/models; northern NPC founding, migration and catalogue/docs.
16. **Butcher, meat and livestock life cycle**: young/cohorts/rations/breeding;
    adult slaughter service/shop; raw meat/spoilage; business and home cooking;
    NPCs, migration, portable catalogues and taxed chain margins.
17. **Open bay doors and modelled interiors**: derived hours/staff state and
    real apertures; motion/visibility; shells and every listed trade's props;
    stock/architecture variants, reduced detail, preview mode and bounds/budget.
18. **Tractors stay where you leave them; walking, doors and arrival
    animations**: parked records and migration; walk/return/refuel; home/lodging;
    sign-off/sign-in/towing/solid footprints and trailers; NPC return constraint;
    mount/dismount and approach/panel timing on desktop/mobile/controller.
19. **Alternate road routes and gradual city paving** together with **River
    crossings, bridges and highway haulage**, in this exact sub-order:
    - Survey current settlements and haulage economics read-only; define shared
      city/surface/ford/bridge records and configurable defaults. Decide access,
      toll and refrigeration policies before their implementations.
    - Persistent useful alternate routes and deterministic ford-aware dirt
      growth, including a new distant town, absent fords and multiple rivers.
    - Sustained city qualification, slow density-directed paving, rural lanes
      staying dirt, one boundary exit, city-only trunks, bank-ending paved
      projects and dirt feeders. Count bridges, never dirt fords, as paved links.
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
