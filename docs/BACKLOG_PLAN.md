# Backlog implementation plan

Source: [BACKLOG.md](BACKLOG.md), read in full before changes. Base: `main` at
`1423116eae06134ebbc2b90dc3fd72cd3a216b0c`. Work branch: `backlog-implementation`.
All changes remain unreleased. No version bump, pull request, deployment, live
server edits or player grants. Piloted spaceflight is excluded and remains pending.

## Completion protocol

Before each implementation slice, transcribe its acceptance criteria here as
specific assertions, commands and player-visible browser steps. Run a new or
extended regression test and record the actual failure before production edits.
Use the existing world rule/catalogue as the single source for gameplay values;
new gameplay defaults require validation, creation, summary, editor and portable
design coverage. Flight graphics follow client graphics settings instead.

Every finished slice requires its acceptance checks, the touched unit tests via
`npm test`, clean `npx tsc --noEmit`, and
`npx prettier --write <explicit changed paths>`. UI/rendering slices also require
the affected real browser flow, including specified empty/refusal states. Record
commands and outcomes below. Commit explicit paths only, excluding `output/` and
`docs/NPC_STATUS*.md`, push this branch, then mark the slice done in this plan.
Stop at a failed completion criterion; do not weaken it or move on.

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
