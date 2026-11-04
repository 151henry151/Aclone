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
10. **Rowboats**: reuse canoe bank/shore access, rowed hull, seats and hold,
    beached persistence, tender policy and no-carry enforcement.
11. **CB radios**: channel/transmission state, duration and collisions,
    propagation/moderation, rescue prompts, dashboard and input methods.
12. **Make the remaining hard-coded gameplay numbers per-world rules**:
    separate fieldset batches in the spec's order: survival/needs; economy/trade;
    gathering/farming/production; vehicles/travel; climate/calendar/environment.
    Default-preserving tests plus changed-value, editor and export tests for each.
13. **Solid trees, boulders and vehicles**: shared deterministic obstacle data,
    spatial queries, static collision/escape, pedestrian sliding, moving-vehicle
    contacts and offline policy; integrate road/navigation/build/snow users and
    measure tick/frame cost before proceeding.
14. **Cargo boat for dock-to-dock freight**: definition/model/tuning; persistent
    hold; quay and existing landing transfers; decide optional barge; route
    economics. Follow the entry's internal order.
15. **Storm capsizing**: sea survey and defaults; seeded/ramped risk by hull;
    warnings and forecast; occupants/death/loss; shelter-time checks. Canoe,
    rowboat and cargo hull classifications now exist.
16. **Springs, pump-houses and desalination plants**: deterministic frozen
    springs/headwaters; scenery/drinking; grandfathered desalination; fresh-water
    siting/recipes/models; northern NPC founding, migration and catalogue/docs.
17. **Butcher, meat and livestock life cycle**: young/cohorts/rations/breeding;
    adult slaughter service/shop; raw meat/spoilage; business and home cooking;
    NPCs, migration, portable catalogues and taxed chain margins.
18. **Open bay doors and modelled interiors**: derived hours/staff state and
    real apertures; motion/visibility; shells and every listed trade's props;
    stock/architecture variants, reduced detail, preview mode and bounds/budget.
19. **Tractors stay where you leave them; walking, doors and arrival
    animations**: parked records and migration; walk/return/refuel; home/lodging;
    sign-off/sign-in/towing/solid footprints and trailers; NPC return constraint;
    mount/dismount and approach/panel timing on desktop/mobile/controller.
20. **Alternate road routes and gradual city paving** together with **River
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
21. **Earthmoving machines and a building slope limit** (factory and solid
    scenery now exist): grade rule/refusal/site shading; cached earthwork pads;
    plant licence/manufactured machines; survey/passes/material balance and
    weathering; contracts/permissions/NPC posting; hillside-to-building browser
    flow, roads/trees and mobile/controller implements.
22. **Snow ploughing: roads that stay snowed in until someone clears them**:
    segment accumulation/lookup/rendering; tractor blade/pay; factory-made truck;
    salt/hopper/pay; NPC/council acquisition; one-time Puddlewick defaults;
    offline catch-up, clean/raised/empty states and browser map/road coverage.
23. **Player-built airstrips and commercial aviation**: rotated owned airfield
    list; expensive multi-contributor airstrip/access/parking/fuel; land aircraft
    definitions and weight performance; passenger fares/seats/baggage/crash
    stranding; apron freight/economics; restart, import, demolition, licences,
    night lighting and input coverage. Preserve its six-stage internal order;
    add the amphibian variant in the following dedicated item, using these
    shared seats, baggage and crash rules.
24. **Seaplanes**: amphibian definition/model/price/hold; two seats and loading;
    gear-dependent land/water contacts, depth/run/wave qualification, taxi/moor
    and loaded takeoff; nearest-shore rescue and floating surplus cargo. Landing
    and shared aviation acceptance must already pass.
25. **Helicopters: sling loads, sea rescue and passenger charters**: rotorcraft
    and cockpit; owned parked-tractor sling; consent/winch/return hull; passenger
    lifts and directory; contracts/escrow/bounty/NPC requests. Parked vehicles,
    aviation crash/seats and storm thresholds are prerequisites.
26. **Forestry and logging**: shared tree IDs/stages; sparse overlay; safe
    felling/bucking/piles; hand/log-wagon/backhoe loading; construction clearing;
    permissions/stumpage/nurseries/woodlots; NPC plan, regeneration, map and
    performance. Solid trees and earthmoving must be complete first.
27. **Flight combat for fighting worlds**: health/damage; fixed guns with
    bounded rewind/reload; bombs/rockets/turrets; arena round and dogfight;
    additional hull hardpoints/gunner; recorded replay, performance and inputs.
    Non-fighting worlds must retain civil behaviour throughout.

## Execution record

### Plan commit

- Initial audit and full dependency order: ready for the first commit.
- Whole-suite baseline: `npm test > /tmp/aclone-backlog-baseline.log 2>&1`, running.
- Type baseline: `npx tsc --noEmit`, clean.
- No implementation changes before this plan commit.

### G1 — motor-free HUD

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

### G2 — menu zoom

- Before code, add a failing browser regression that clicks Zoom out repeatedly
  in a tractor and measures camera distance matching wheel/pinch maximum (5.6),
  twice other vehicles' 2.8. Exercise Zoom in at the lower bound and walking's
  unchanged upper bound. Reuse one camera limit, not another literal copy.
- Run the browser regression, `npm test` for touched camera tests, TypeScript and
  Prettier. Update the player guide, README and Unreleased changelog.

### G3 — charter tuning

- Before code, extend `charter.test.ts`: tune passenger capacity to two, board
  two, reject the third without taking fare; tune to zero and reject all; retain
  six-seat default coverage and repeat/save behaviour. Verify changed tank and
  passenger counts in the actual charter panel, including no waiting passengers
  and full/refused boarding, using the vehicle editor's existing values.
- Run the red unit test, then the changed unit suite through `npm test`, the
  charter browser flow, TypeScript and Prettier. Update WORLD_BUILDING.md,
  charter/player documentation, README and the Unreleased changelog.
